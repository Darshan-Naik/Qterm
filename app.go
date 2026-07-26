package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"qterm/internal/agentcli"
	"qterm/internal/agentcli/bridge"
	"qterm/internal/appmode"
	"qterm/internal/config"
	"qterm/internal/git"
	"qterm/internal/hooks"
	"qterm/internal/project"
	ptymgr "qterm/internal/pty"
	"qterm/internal/ptyemit"
	"qterm/internal/scrollback"

	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx              context.Context
	store            *config.Store
	pty              *ptymgr.Manager
	projects         *project.Service
	hooks            *hooks.Host
	scrollback       *scrollback.Store
	ptyOut           *ptyemit.Coalescer
	bridge           *bridge.Server
	shuttingDown     bool
	focusedSessionID string
	agentMu          sync.Mutex
	agentBind        map[string]string // CLI session id → Qterm session id (sticky)
	agentLastQterm   string            // last Qterm pane that received agent activity
}

func NewApp() *App {
	return &App{}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	setDockIcon(appIcon)
	store, err := config.NewStore()
	if err != nil {
		panic(err)
	}
	a.store = store
	cfg := store.Get()

	sb, err := scrollback.NewStore(filepath.Join(store.DataDir(), "scrollback"))
	if err != nil {
		panic(err)
	}
	a.scrollback = sb

	a.ptyOut = ptyemit.New(a.emitPtyData)
	a.pty = ptymgr.NewManager(cfg.Shell, a.onPtyData, a.onPtyExit)
	a.projects = project.NewService(store)
	a.hooks = hooks.NewHost(store.HooksDir(), a.onHookIntent)
	a.startAgentBridge()

	// Recreate terminals from last session
	a.restoreSessions()
	a.setupMenu()
}

func (a *App) setupMenu() {
	// First submenu is the macOS app menu. Custom so we can keep About + Settings together
	// (Wails AppMenu role can't be extended with extra items).
	app := menu.NewMenu()
	app.AddText("About "+appmode.AppTitle, nil, func(_ *menu.CallbackData) {
		_, _ = runtime.MessageDialog(a.ctx, runtime.MessageDialogOptions{
			Type:    runtime.InfoDialog,
			Title:   "About " + appmode.AppTitle,
			Message: "A fast terminal with project groups and agent hooks.",
		})
	})
	app.AddSeparator()
	app.AddText("Settings…", keys.CmdOrCtrl(","), func(_ *menu.CallbackData) {
		runtime.EventsEmit(a.ctx, "app:open-settings", "appearance")
	})
	app.AddSeparator()
	app.AddText("Quit "+appmode.AppTitle, keys.CmdOrCtrl("q"), func(_ *menu.CallbackData) {
		runtime.Quit(a.ctx)
	})

	items := []*menu.MenuItem{
		menu.SubMenu(appmode.AppTitle, app),
		menu.EditMenu(),
		menu.WindowMenu(),
	}
	// Developer tools only when the inspector is compiled in (wails dev / debug / --devtools).
	if appmode.IsDev {
		dev := menu.NewMenu()
		dev.AddText(
			"Toggle Developer Tools",
			keys.Combo("i", keys.CmdOrCtrlKey, keys.OptionOrAltKey),
			func(_ *menu.CallbackData) {
				runtime.EventsEmit(a.ctx, "app:open-inspector")
			},
		)
		items = append(items, menu.SubMenu("Developer", dev))
	}

	runtime.MenuSetApplicationMenu(a.ctx, menu.NewMenuFromItems(items[0], items[1:]...))
}

func (a *App) shutdown(ctx context.Context) {
	a.shuttingDown = true
	if a.ptyOut != nil {
		a.ptyOut.FlushAll()
	}
	if a.bridge != nil {
		_ = a.bridge.Stop(ctx)
	}
	if a.scrollback != nil {
		a.scrollback.Close()
	}
	if a.store != nil {
		a.store.Close()
	}
	if a.pty != nil {
		a.pty.CloseAll()
	}
	if a.hooks != nil {
		for _, h := range a.hooks.List() {
			_ = a.hooks.Deactivate(h.Manifest.ID)
		}
	}
}

func (a *App) restoreSessions() {
	cfg := a.store.Get()
	for _, meta := range cfg.Sessions {
		if a.scrollback != nil {
			a.scrollback.Load(meta.ID)
		}
		cwd := meta.Cwd
		if cwd == "" && meta.ProjectID != "" && meta.ProjectID != project.HomeID {
			if p, ok := a.projects.Get(meta.ProjectID); ok {
				cwd = p.Path
			}
		}
		_, err := a.pty.Create(ptymgr.CreateOpts{
			ID:        meta.ID,
			Name:      meta.Name,
			ProjectID: meta.ProjectID,
			Cwd:       cwd,
			Pinned:    meta.Pinned,
		})
		if err != nil {
			println("restore session failed:", meta.ID, err.Error())
		}
	}
}

func (a *App) onPtyData(sessionID string, data []byte) {
	if a.ptyOut != nil {
		a.ptyOut.Push(sessionID, data)
		return
	}
	a.emitPtyData(sessionID, data)
}

func (a *App) emitPtyData(sessionID string, data []byte) {
	var seq uint64
	if a.scrollback != nil {
		seq = a.scrollback.Append(sessionID, data)
	}
	runtime.EventsEmit(a.ctx, "pty:data", map[string]any{
		"sessionId": sessionID,
		"data":      base64.StdEncoding.EncodeToString(data),
		"seq":       seq,
	})
	if a.hooks != nil {
		a.hooks.BroadcastOutput(sessionID, data)
	}
}

func (a *App) onPtyExit(sessionID string, code int) {
	runtime.EventsEmit(a.ctx, "pty:exit", map[string]any{
		"sessionId": sessionID,
		"code":      code,
	})
	if a.hooks != nil {
		a.hooks.BroadcastExit(sessionID, code)
	}
	// Keep sessions on disk when the app is quitting so they restore next launch.
	if a.shuttingDown {
		return
	}
	a.removeSessionMeta(sessionID)
	runtime.EventsEmit(a.ctx, "sessions:changed", nil)
}

func (a *App) removeSessionMeta(sessionID string) {
	a.clearAgentBindsForQterm(sessionID)
	if a.scrollback != nil {
		a.scrollback.Remove(sessionID)
	}
	_ = a.store.Update(func(cfg *config.AppConfig) {
		next := make([]config.SessionMeta, 0, len(cfg.Sessions))
		for _, s := range cfg.Sessions {
			if s.ID != sessionID {
				next = append(next, s)
			}
		}
		cfg.Sessions = next
		// Drop leaves that pointed at this session from layouts.
		for key, layout := range cfg.Layouts {
			cleaned, changed := pruneSessionFromLayout(layout, sessionID)
			if changed {
				if cleaned.Type == "" {
					delete(cfg.Layouts, key)
				} else {
					cfg.Layouts[key] = cleaned
				}
			}
		}
	})
}

func pruneSessionFromLayout(node config.SplitNode, sessionID string) (config.SplitNode, bool) {
	if node.Type == "leaf" {
		if node.SessionID == sessionID {
			return config.SplitNode{}, true
		}
		return node, false
	}
	if node.Type != "split" || len(node.Children) != 2 {
		return node, false
	}
	left, lchg := pruneSessionFromLayout(node.Children[0], sessionID)
	right, rchg := pruneSessionFromLayout(node.Children[1], sessionID)
	if !lchg && !rchg {
		return node, false
	}
	if left.Type == "" {
		return right, true
	}
	if right.Type == "" {
		return left, true
	}
	node.Children = []config.SplitNode{left, right}
	return node, true
}

func (a *App) onHookIntent(intent hooks.Intent) {
	runtime.EventsEmit(a.ctx, "hook:intent", intent)
}

// --- Config ---

func (a *App) GetConfig() config.AppConfig {
	return a.store.Get()
}

func (a *App) SaveTheme(theme string) error {
	return a.store.Update(func(cfg *config.AppConfig) {
		cfg.Theme = theme
	})
}

func (a *App) SaveShell(shell string) error {
	a.pty.SetShell(shell)
	return a.store.Update(func(cfg *config.AppConfig) {
		cfg.Shell = shell
	})
}

func (a *App) SaveFontSize(size int) error {
	if size < config.MinFontSize {
		size = config.MinFontSize
	}
	if size > config.MaxFontSize {
		size = config.MaxFontSize
	}
	return a.store.Update(func(cfg *config.AppConfig) {
		cfg.FontSize = size
	})
}

func (a *App) SaveKeybindings(bindings config.KeybindingOverrides) error {
	return a.store.Update(func(cfg *config.AppConfig) {
		if len(bindings) == 0 {
			cfg.Keybindings = nil
			return
		}
		cfg.Keybindings = bindings
	})
}

func (a *App) SaveLayout(key string, layout config.SplitNode) error {
	return a.store.Update(func(cfg *config.AppConfig) {
		if cfg.Layouts == nil {
			cfg.Layouts = config.LayoutStore{}
		}
		if layout.Type == "" {
			delete(cfg.Layouts, key)
			return
		}
		cfg.Layouts[key] = layout
	})
}

func (a *App) GetLayout(key string) config.SplitNode {
	layouts := a.store.Get().Layouts
	if layouts == nil {
		return config.SplitNode{}
	}
	return layouts[key]
}

func (a *App) SaveActiveScope(scope string) error {
	return a.store.Update(func(cfg *config.AppConfig) {
		cfg.ActiveScope = scope
	})
}

func (a *App) SaveUIPrefs(prefs config.UIPrefs) error {
	return a.store.Update(func(cfg *config.AppConfig) {
		open := prefs.SidebarOpen
		cfg.SidebarOpen = &open
		cfg.SidebarWidth = config.ClampSidebarWidth(prefs.SidebarWidth)
		cfg.UiZoom = config.ClampUiZoom(prefs.UiZoom)
		if prefs.CollapsedProjects == nil {
			cfg.CollapsedProjects = map[string]bool{}
		} else {
			cfg.CollapsedProjects = prefs.CollapsedProjects
		}
	})
}

// GetScrollback returns base64 terminal output history and a sequence number
// so the UI can ignore duplicate live events already covered by the snapshot.
func (a *App) GetScrollback(sessionID string) map[string]any {
	if a.scrollback == nil {
		return map[string]any{"data": "", "seq": 0}
	}
	data, seq := a.scrollback.Snapshot(sessionID)
	if len(data) == 0 {
		return map[string]any{"data": "", "seq": seq}
	}
	return map[string]any{
		"data": base64.StdEncoding.EncodeToString(data),
		"seq":  seq,
	}
}

// SearchScrollback finds sessions whose output/prompt text contains query.
// Returns [{sessionId, snippet}, …] for the quick-open palette.
func (a *App) SearchScrollback(query string, sessionIDs []string) []map[string]any {
	if a.scrollback == nil {
		return nil
	}
	hits := a.scrollback.Search(query, sessionIDs)
	if len(hits) == 0 {
		return nil
	}
	out := make([]map[string]any, len(hits))
	for i, h := range hits {
		out[i] = map[string]any{
			"sessionId": h.SessionID,
			"snippet":   h.Snippet,
		}
	}
	return out
}

// ListAgentSessions returns on-disk agent history (no plugin/PATH required).
// Matches title first, then prompt/body text.
func (a *App) ListAgentSessions(query, cliID string) []agentcli.AgentSession {
	return agentcli.ListSessions(a.store.DataDir(), agentcli.SessionQuery{
		Query: query,
		CLI:   cliID,
		Limit: 80,
	})
}

// ResumeAgentSession asks the CLI adapter for the resume command, opens a
// terminal in that cwd, and types the command to continue the session.
func (a *App) ResumeAgentSession(cli, sessionID string) (SessionDTO, error) {
	if cli == "" || sessionID == "" {
		return SessionDTO{}, fmt.Errorf("missing agent session")
	}
	spec, err := agentcli.Resume(cli, sessionID)
	if err != nil {
		return SessionDTO{}, err
	}
	if strings.TrimSpace(spec.Command) == "" {
		return SessionDTO{}, fmt.Errorf("adapter returned empty resume command")
	}

	projectID := ""
	if spec.Cwd != "" {
		for _, proj := range a.projects.List() {
			if proj.Path == spec.Cwd {
				projectID = proj.ID
				break
			}
		}
	}
	name := strings.TrimSpace(spec.Title)
	if name == "" {
		if p, ok := agentcli.Find(cli); ok {
			name = p.Name()
		} else {
			name = cli
		}
	}
	if len(name) > 48 {
		name = name[:45] + "…"
	}

	dto, err := a.CreateSession(projectID, name, spec.Cwd)
	if err != nil {
		return SessionDTO{}, err
	}

	cmd := spec.Command
	if !strings.HasSuffix(cmd, "\n") {
		cmd += "\n"
	}
	go func(id, payload string) {
		time.Sleep(350 * time.Millisecond)
		_ = a.WriteSession(id, payload)
	}(dto.ID, cmd)

	return dto, nil
}

// --- Projects ---

func (a *App) ListProjects() []config.ProjectMeta {
	return a.projects.List()
}

func (a *App) AddProject(path, name string) (config.ProjectMeta, error) {
	return a.projects.Add(path, name)
}

func (a *App) RemoveProject(id string) error {
	return a.projects.Remove(id)
}

func (a *App) RenameProject(id, name string) error {
	return a.projects.Rename(id, name)
}

func (a *App) PickFolder() (string, error) {
	return runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select project folder",
	})
}

func (a *App) GetGitStatus(path string) git.Status {
	return git.Probe(path)
}

// --- Sessions / PTY ---

type SessionDTO struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	ProjectID string `json:"projectId"`
	Cwd       string `json:"cwd"`
	Pinned    bool   `json:"pinned"`
}

func (a *App) ListSessions() []SessionDTO {
	live := a.pty.List()
	byID := make(map[string]*ptymgr.Session, len(live))
	for _, s := range live {
		byID[s.ID] = s
	}
	out := make([]SessionDTO, 0, len(live))
	seen := make(map[string]bool, len(live))
	// Preserve config order (creation order) — never sort by name.
	for _, meta := range a.store.Get().Sessions {
		s, ok := byID[meta.ID]
		if !ok {
			continue
		}
		out = append(out, SessionDTO{
			ID: s.ID, Name: s.Name, ProjectID: s.ProjectID, Cwd: s.Cwd, Pinned: s.Pinned,
		})
		seen[s.ID] = true
	}
	// Live sessions missing from config (rare) append in creation order.
	extras := make([]*ptymgr.Session, 0)
	for _, s := range live {
		if !seen[s.ID] {
			extras = append(extras, s)
		}
	}
	sort.Slice(extras, func(i, j int) bool {
		return extras[i].CreatedAt.Before(extras[j].CreatedAt)
	})
	for _, s := range extras {
		out = append(out, SessionDTO{
			ID: s.ID, Name: s.Name, ProjectID: s.ProjectID, Cwd: s.Cwd, Pinned: s.Pinned,
		})
	}
	return out
}

func (a *App) CreateSession(projectID, name, cwd string) (SessionDTO, error) {
	if cwd == "" && projectID != "" && projectID != project.HomeID {
		if p, ok := a.projects.Get(projectID); ok {
			cwd = p.Path
		}
	}
	sess, err := a.pty.Create(ptymgr.CreateOpts{
		Name: name, ProjectID: projectID, Cwd: cwd,
	})
	if err != nil {
		return SessionDTO{}, err
	}
	dto := SessionDTO{ID: sess.ID, Name: sess.Name, ProjectID: sess.ProjectID, Cwd: sess.Cwd, Pinned: sess.Pinned}
	_ = a.store.Update(func(cfg *config.AppConfig) {
		upsert := true
		for i := range cfg.Sessions {
			if cfg.Sessions[i].ID == sess.ID {
				cfg.Sessions[i] = config.SessionMeta{
					ID: sess.ID, Name: sess.Name, ProjectID: sess.ProjectID, Cwd: sess.Cwd, Pinned: sess.Pinned,
				}
				upsert = false
				break
			}
		}
		if upsert {
			cfg.Sessions = append(cfg.Sessions, config.SessionMeta{
				ID: sess.ID, Name: sess.Name, ProjectID: sess.ProjectID, Cwd: sess.Cwd, Pinned: sess.Pinned,
			})
		}
	})
	runtime.EventsEmit(a.ctx, "sessions:changed", nil)
	return dto, nil
}

func (a *App) WriteSession(id, data string) error {
	return a.pty.Write(id, []byte(data))
}

func (a *App) WriteSessionBytes(id string, b64 string) error {
	raw, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return err
	}
	return a.pty.Write(id, raw)
}

func (a *App) ResizeSession(id string, cols, rows int) error {
	return a.pty.Resize(id, uint16(cols), uint16(rows))
}

func (a *App) KillSession(id string) error {
	// Persist removal before kill so onPtyExit doesn't race incorrectly.
	a.removeSessionMeta(id)
	err := a.pty.Kill(id)
	runtime.EventsEmit(a.ctx, "sessions:changed", nil)
	return err
}

// SetFocusedSession records which terminal the UI is focused on.
func (a *App) SetFocusedSession(id string) {
	a.focusedSessionID = id
}

func (a *App) PromoteSession(id, projectID string) error {
	sess, ok := a.pty.Get(id)
	if !ok {
		return os.ErrNotExist
	}
	sess.ProjectID = projectID
	if projectID != project.HomeID {
		if p, ok := a.projects.Get(projectID); ok {
			sess.Cwd = p.Path
		}
	}
	_ = a.store.Update(func(cfg *config.AppConfig) {
		for i := range cfg.Sessions {
			if cfg.Sessions[i].ID == id {
				cfg.Sessions[i].ProjectID = projectID
				cfg.Sessions[i].Cwd = sess.Cwd
			}
		}
	})
	runtime.EventsEmit(a.ctx, "sessions:changed", nil)
	return nil
}

// --- Agent CLI plugins / legacy intent resolve ---

func (a *App) ResolveHookIntent(intentID string, approved bool) (map[string]any, error) {
	if a.hooks == nil {
		return map[string]any{"ok": true}, nil
	}
	result, err := a.hooks.ResolveIntent(intentID, approved)
	if err != nil {
		return nil, err
	}
	if approved {
		if write, _ := result["writePty"].(bool); write {
			if cmd, ok := result["command"].(string); ok {
				if sid, ok := result["sessionId"].(string); ok && sid != "" {
					_ = a.pty.Write(sid, []byte(cmd+"\n"))
				}
			}
		}
	}
	return result, nil
}

func (a *App) OpenInFinder(path string) error {
	cmd := exec.Command("open", path)
	return cmd.Start()
}
