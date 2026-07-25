package hooks

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"
)

type Permissions struct {
	ReadOutput bool `json:"readOutput"`
	WritePty   bool `json:"writePty"`
	Notify     bool `json:"notify"`
	Animate    bool `json:"animate"`
	Network    bool `json:"network"`
}

type Manifest struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	Version     string      `json:"version"`
	Description string      `json:"description"`
	Command     string      `json:"command"`
	Args        []string    `json:"args"`
	Permissions Permissions `json:"permissions"`
}

type InstalledHook struct {
	Manifest    Manifest    `json:"manifest"`
	Path        string      `json:"path"`
	Enabled     bool        `json:"enabled"`
	Granted     Permissions `json:"granted"`
	ProjectOnly []string    `json:"projectOnly,omitempty"`
}

type Intent struct {
	ID        string         `json:"id"`
	HookID    string         `json:"hookId"`
	SessionID string         `json:"sessionId"`
	Type      string         `json:"type"` // notify | animate | suggest | request_approval
	Payload   map[string]any `json:"payload"`
	CreatedAt time.Time      `json:"createdAt"`
}

type IntentHandler func(intent Intent)

type Host struct {
	mu       sync.RWMutex
	dir      string
	hooks    map[string]*runtime
	intents  map[string]Intent
	onIntent IntentHandler
}

type runtime struct {
	meta InstalledHook
	cmd  *exec.Cmd
	stdin io.WriteCloser
	enc  *json.Encoder
}

type envelope struct {
	Method string          `json:"method"`
	ID     string          `json:"id,omitempty"`
	Params json.RawMessage `json:"params,omitempty"`
	Result json.RawMessage `json:"result,omitempty"`
	Error  string          `json:"error,omitempty"`
}

func NewHost(dir string, onIntent IntentHandler) *Host {
	_ = os.MkdirAll(dir, 0o755)
	h := &Host{
		dir:      dir,
		hooks:    make(map[string]*runtime),
		intents:  make(map[string]Intent),
		onIntent: onIntent,
	}
	return h
}

func (h *Host) Dir() string { return h.dir }

func (h *Host) List() []InstalledHook {
	entries, err := os.ReadDir(h.dir)
	if err != nil {
		return nil
	}
	out := make([]InstalledHook, 0)
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		meta, err := h.loadMeta(filepath.Join(h.dir, e.Name()))
		if err != nil {
			continue
		}
		h.mu.RLock()
		if rt, ok := h.hooks[meta.Manifest.ID]; ok {
			meta = rt.meta
		}
		h.mu.RUnlock()
		out = append(out, meta)
	}
	return out
}

func (h *Host) loadMeta(dir string) (InstalledHook, error) {
	data, err := os.ReadFile(filepath.Join(dir, "manifest.json"))
	if err != nil {
		return InstalledHook{}, err
	}
	var m Manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return InstalledHook{}, err
	}
	statePath := filepath.Join(dir, "state.json")
	ih := InstalledHook{
		Manifest: m,
		Path:     dir,
		Enabled:  true,
		Granted: Permissions{
			ReadOutput: true,
			Notify:     true,
			Animate:    true,
		},
	}
	if b, err := os.ReadFile(statePath); err == nil {
		_ = json.Unmarshal(b, &ih)
		ih.Manifest = m
		ih.Path = dir
	}
	return ih, nil
}

func (h *Host) saveState(ih InstalledHook) error {
	b, err := json.MarshalIndent(ih, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(ih.Path, "state.json"), b, 0o644)
}

func (h *Host) InstallFromPath(src string) (InstalledHook, error) {
	data, err := os.ReadFile(filepath.Join(src, "manifest.json"))
	if err != nil {
		return InstalledHook{}, err
	}
	var m Manifest
	if err := json.Unmarshal(data, &m); err != nil {
		return InstalledHook{}, err
	}
	if m.ID == "" {
		m.ID = uuid.NewString()
	}
	dest := filepath.Join(h.dir, m.ID)
	if err := copyDir(src, dest); err != nil {
		return InstalledHook{}, err
	}
	// rewrite manifest in case id was assigned
	b, _ := json.MarshalIndent(m, "", "  ")
	_ = os.WriteFile(filepath.Join(dest, "manifest.json"), b, 0o644)

	ih := InstalledHook{
		Manifest: m,
		Path:     dest,
		Enabled:  true,
		Granted: Permissions{
			ReadOutput: true,
			Notify:     true,
			Animate:    true,
		},
	}
	_ = h.saveState(ih)
	if err := h.Activate(m.ID); err != nil {
		return ih, err
	}
	return ih, nil
}

func (h *Host) Uninstall(id string) error {
	_ = h.Deactivate(id)
	return os.RemoveAll(filepath.Join(h.dir, id))
}

func (h *Host) SetPermissions(id string, granted Permissions) error {
	ih, err := h.loadMeta(filepath.Join(h.dir, id))
	if err != nil {
		return err
	}
	ih.Granted = granted
	if err := h.saveState(ih); err != nil {
		return err
	}
	h.mu.Lock()
	if rt, ok := h.hooks[id]; ok {
		rt.meta = ih
	}
	h.mu.Unlock()
	return nil
}

func (h *Host) SetEnabled(id string, enabled bool) error {
	ih, err := h.loadMeta(filepath.Join(h.dir, id))
	if err != nil {
		return err
	}
	ih.Enabled = enabled
	_ = h.saveState(ih)
	if enabled {
		return h.Activate(id)
	}
	return h.Deactivate(id)
}

func (h *Host) Activate(id string) error {
	ih, err := h.loadMeta(filepath.Join(h.dir, id))
	if err != nil {
		return err
	}
	if !ih.Enabled {
		return nil
	}
	_ = h.Deactivate(id)

	cmdPath := ih.Manifest.Command
	if !filepath.IsAbs(cmdPath) {
		local := filepath.Join(ih.Path, cmdPath)
		if _, err := os.Stat(local); err == nil {
			cmdPath = local
		}
	}
	cmd := exec.Command(cmdPath, ih.Manifest.Args...)
	cmd.Dir = ih.Path
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return err
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	cmd.Stderr = os.Stderr
	if err := cmd.Start(); err != nil {
		return err
	}
	rt := &runtime{meta: ih, cmd: cmd, stdin: stdin, enc: json.NewEncoder(stdin)}
	h.mu.Lock()
	h.hooks[id] = rt
	h.mu.Unlock()

	go h.readLoop(rt, stdout)
	_ = h.send(rt, "onActivate", map[string]any{"hookId": id})
	return nil
}

func (h *Host) Deactivate(id string) error {
	h.mu.Lock()
	rt, ok := h.hooks[id]
	if ok {
		delete(h.hooks, id)
	}
	h.mu.Unlock()
	if !ok {
		return nil
	}
	_ = h.send(rt, "onDeactivate", map[string]any{})
	_ = rt.stdin.Close()
	if rt.cmd.Process != nil {
		_ = rt.cmd.Process.Kill()
		_, _ = rt.cmd.Process.Wait()
	}
	return nil
}

func (h *Host) ActivateAll() {
	for _, ih := range h.List() {
		if ih.Enabled {
			_ = h.Activate(ih.Manifest.ID)
		}
	}
}

func (h *Host) BroadcastOutput(sessionID string, data []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, rt := range h.hooks {
		if !rt.meta.Granted.ReadOutput {
			continue
		}
		_ = h.send(rt, "onOutput", map[string]any{
			"sessionId": sessionID,
			"data":      string(data),
		})
	}
}

func (h *Host) BroadcastExit(sessionID string, code int) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, rt := range h.hooks {
		_ = h.send(rt, "onExit", map[string]any{
			"sessionId": sessionID,
			"code":      code,
		})
	}
}

func (h *Host) send(rt *runtime, method string, params any) error {
	b, err := json.Marshal(params)
	if err != nil {
		return err
	}
	return rt.enc.Encode(envelope{Method: method, Params: b})
}

func (h *Host) readLoop(rt *runtime, r io.Reader) {
	sc := bufio.NewScanner(r)
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for sc.Scan() {
		line := sc.Bytes()
		var env envelope
		if err := json.Unmarshal(line, &env); err != nil {
			continue
		}
		if env.Method == "emit" {
			h.handleEmit(rt, env.Params)
		}
	}
}

func (h *Host) handleEmit(rt *runtime, params json.RawMessage) {
	var p struct {
		Type      string         `json:"type"`
		SessionID string         `json:"sessionId"`
		Payload   map[string]any `json:"payload"`
	}
	if err := json.Unmarshal(params, &p); err != nil {
		return
	}
	// permission gate
	switch p.Type {
	case "notify":
		if !rt.meta.Granted.Notify {
			return
		}
	case "animate":
		if !rt.meta.Granted.Animate {
			return
		}
	case "request_approval":
		// always allowed to request; write happens only after approve
	case "suggest":
		if !rt.meta.Granted.Notify {
			return
		}
	default:
		return
	}
	intent := Intent{
		ID:        uuid.NewString(),
		HookID:    rt.meta.Manifest.ID,
		SessionID: p.SessionID,
		Type:      p.Type,
		Payload:   p.Payload,
		CreatedAt: time.Now(),
	}
	h.mu.Lock()
	h.intents[intent.ID] = intent
	h.mu.Unlock()
	if h.onIntent != nil {
		h.onIntent(intent)
	}
}

func (h *Host) ResolveIntent(intentID string, approved bool) (map[string]any, error) {
	h.mu.Lock()
	intent, ok := h.intents[intentID]
	if ok {
		delete(h.intents, intentID)
	}
	rt := h.hooks[intent.HookID]
	h.mu.Unlock()
	if !ok {
		return nil, fmt.Errorf("intent not found")
	}
	result := map[string]any{"approved": approved, "intentId": intentID}
	if rt != nil {
		_ = h.send(rt, "onIntentResolved", map[string]any{
			"intentId": intentID,
			"approved": approved,
			"intent":   intent,
		})
	}
	if approved && intent.Type == "request_approval" {
		if cmd, ok := intent.Payload["command"].(string); ok {
			result["command"] = cmd
			result["sessionId"] = intent.SessionID
			result["writePty"] = rt != nil && rt.meta.Granted.WritePty
		}
	}
	return result, nil
}

func copyDir(src, dst string) error {
	if err := os.MkdirAll(dst, 0o755); err != nil {
		return err
	}
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		target := filepath.Join(dst, rel)
		if info.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		in, err := os.Open(path)
		if err != nil {
			return err
		}
		defer in.Close()
		out, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, info.Mode())
		if err != nil {
			return err
		}
		defer out.Close()
		_, err = io.Copy(out, in)
		return err
	})
}
