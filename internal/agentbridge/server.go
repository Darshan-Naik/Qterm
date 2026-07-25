package agentbridge

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
)

type ControlAPI interface {
	CreateTerminal(projectID, name, cwd string) (map[string]any, error)
	RenameTerminal(id, name string) error
	ListTerminals() ([]map[string]any, error)
	GetTerminal(id string) (map[string]any, error)
	CreateProject(path, name string) (map[string]any, error)
	RenameProject(id, name string) error
	ListProjects() ([]map[string]any, error)
	SetTheme(theme string) error
	GetTheme() string
	FocusSession(id string) error
}

type Server struct {
	dataDir  string
	token    string
	port     int
	onIntent func(Intent)
	api      ControlAPI

	mu   sync.Mutex
	http *http.Server
	seq  atomic.Uint64
}

func NewServer(dataDir string, onIntent func(Intent), api ControlAPI) (*Server, error) {
	token, err := LoadOrCreateToken(dataDir)
	if err != nil {
		return nil, err
	}
	s := &Server{
		dataDir:  dataDir,
		token:    token,
		port:     DefaultPort,
		onIntent: onIntent,
		api:      api,
	}
	return s, nil
}

func (s *Server) Start() error {
	mux := http.NewServeMux()
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/v1/hooks/", s.auth(s.handleSourceHook))
	mux.HandleFunc("/v1/tools/", s.auth(s.handleTools))

	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", s.port))
	if err != nil {
		ln, err = net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			return err
		}
		s.port = ln.Addr().(*net.TCPAddr).Port
	}
	if err := WriteEndpoint(s.dataDir, s.port, s.token); err != nil {
		_ = ln.Close()
		return err
	}

	s.http = &http.Server{Handler: mux}
	go func() { _ = s.http.Serve(ln) }()
	return nil
}

func (s *Server) Stop(ctx context.Context) error {
	if s.http == nil {
		return nil
	}
	return s.http.Shutdown(ctx)
}

func (s *Server) Port() int     { return s.port }
func (s *Server) Token() string { return s.token }
func (s *Server) BaseURL() string {
	return fmt.Sprintf("http://127.0.0.1:%d", s.port)
}

func (s *Server) auth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		token := strings.TrimPrefix(auth, "Bearer ")
		if token == "" {
			token = r.Header.Get("X-Qterm-Token")
		}
		if token != s.token {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		next(w, r)
	}
}

func (s *Server) handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{"ok":true,"service":"qterm-agent-bridge"}`))
}

func (s *Server) handleSourceHook(w http.ResponseWriter, r *http.Request) {
	source := strings.Trim(strings.TrimPrefix(r.URL.Path, "/v1/hooks/"), "/")
	if source == "" || strings.Contains(source, "/") {
		http.NotFound(w, r)
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, 2<<20))
	if err != nil {
		http.Error(w, "bad body", http.StatusBadRequest)
		return
	}
	var raw map[string]any
	if len(body) > 0 {
		if err := json.Unmarshal(body, &raw); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
	}
	if raw == nil {
		raw = map[string]any{}
	}
	// Authoritative identity from PTY env (relay forwards QTERM_SESSION_ID).
	// Without it, ignore the hook — defense in depth if an old relay still POSTs
	// from an agent started outside Qterm (cmux CMUX_SURFACE_ID pattern).
	qtermID := strings.TrimSpace(r.Header.Get("X-Qterm-Terminal-Id"))
	if qtermID == "" {
		qtermID = firstString(raw, "qterm_terminal_id", "QTERM_SESSION_ID")
	}
	if qtermID == "" {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{}`))
		return
	}
	projectHint := strings.TrimSpace(r.Header.Get("X-Qterm-Project-Id"))

	p, ok := FindBySource(source)
	var intents []Intent
	if ok {
		intents = p.MapHook(raw)
	} else {
		intents = ParseHook(ParseInput{
			Source:    source,
			Title:     source,
			Event:     firstString(raw, "hook_event_name", "hookEventName", "event", "name"),
			SessionID: firstString(raw, "session_id", "sessionId"),
			Cwd:       firstString(raw, "cwd", "Cwd"),
			Raw:       raw,
		})
	}
	for i := range intents {
		intents[i].ID = fmt.Sprintf("%s-%d", intents[i].HookID, s.seq.Add(1))
		intents[i].TerminalID = qtermID
		if projectHint != "" {
			if intents[i].Payload == nil {
				intents[i].Payload = map[string]any{}
			}
			intents[i].Payload["projectId"] = projectHint
		}
		if s.onIntent != nil {
			s.onIntent(intents[i])
		}
	}
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(`{}`))
}

func (s *Server) handleTools(w http.ResponseWriter, r *http.Request) {
	if s.api == nil {
		http.Error(w, "api unavailable", http.StatusServiceUnavailable)
		return
	}
	path := strings.TrimPrefix(r.URL.Path, "/v1/tools/")
	switch {
	case path == "terminals" && r.Method == http.MethodGet:
		list, err := s.api.ListTerminals()
		writeHTTPJSON(w, list, err)
	case path == "terminals/self" && r.Method == http.MethodGet:
		hint := strings.TrimSpace(r.Header.Get("X-Qterm-Terminal-Id"))
		out, err := s.api.GetTerminal(hint)
		writeHTTPJSON(w, out, err)
	case path == "terminals" && r.Method == http.MethodPost:
		var req struct {
			ProjectID string `json:"projectId"`
			Name      string `json:"name"`
			Cwd       string `json:"cwd"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		out, err := s.api.CreateTerminal(req.ProjectID, req.Name, req.Cwd)
		writeHTTPJSON(w, out, err)
	case path == "terminals/rename" && r.Method == http.MethodPost:
		var req struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		writeHTTPJSON(w, map[string]any{"ok": true}, s.api.RenameTerminal(req.ID, req.Name))
	case strings.HasPrefix(path, "terminals/") && strings.HasSuffix(path, "/rename") && r.Method == http.MethodPost:
		id := strings.TrimSuffix(strings.TrimPrefix(path, "terminals/"), "/rename")
		var req struct {
			Name string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		if id == "" || id == "focused" || id == "current" || id == "." {
			if hint := strings.TrimSpace(r.Header.Get("X-Qterm-Terminal-Id")); hint != "" {
				id = hint
			}
		}
		writeHTTPJSON(w, map[string]any{"ok": true}, s.api.RenameTerminal(id, req.Name))
	case strings.HasPrefix(path, "terminals/") && strings.HasSuffix(path, "/focus") && r.Method == http.MethodPost:
		id := strings.TrimSuffix(strings.TrimPrefix(path, "terminals/"), "/focus")
		if id == "" || id == "focused" || id == "current" || id == "." {
			if hint := strings.TrimSpace(r.Header.Get("X-Qterm-Terminal-Id")); hint != "" {
				id = hint
			}
		}
		writeHTTPJSON(w, map[string]any{"ok": true}, s.api.FocusSession(id))
	case path == "projects" && r.Method == http.MethodGet:
		list, err := s.api.ListProjects()
		writeHTTPJSON(w, list, err)
	case path == "projects" && r.Method == http.MethodPost:
		var req struct {
			Path string `json:"path"`
			Name string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		out, err := s.api.CreateProject(req.Path, req.Name)
		writeHTTPJSON(w, out, err)
	case strings.HasPrefix(path, "projects/") && strings.HasSuffix(path, "/rename") && r.Method == http.MethodPost:
		id := strings.TrimSuffix(strings.TrimPrefix(path, "projects/"), "/rename")
		var req struct {
			Name string `json:"name"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		writeHTTPJSON(w, map[string]any{"ok": true}, s.api.RenameProject(id, req.Name))
	case path == "theme" && r.Method == http.MethodGet:
		writeHTTPJSON(w, map[string]any{"theme": s.api.GetTheme()}, nil)
	case path == "theme" && r.Method == http.MethodPost:
		var req struct {
			Theme string `json:"theme"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		writeHTTPJSON(w, map[string]any{"ok": true}, s.api.SetTheme(req.Theme))
	default:
		http.NotFound(w, r)
	}
}

func writeHTTPJSON(w http.ResponseWriter, v any, err error) {
	w.Header().Set("Content-Type", "application/json")
	if err != nil {
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]any{"error": err.Error()})
		return
	}
	_ = json.NewEncoder(w).Encode(v)
}
