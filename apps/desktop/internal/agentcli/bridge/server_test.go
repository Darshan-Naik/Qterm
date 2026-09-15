package bridge

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"qterm/internal/agentcli/core"
)

func TestRelayScriptGatesOnQtermSessionID(t *testing.T) {
	body := core.RelayScriptBody("/tmp/qterm-data", "tok", "claude")
	if !strings.Contains(body, `if [[ -z "${QTERM_SESSION_ID:-}" ]]; then`) {
		t.Fatal("relay must early-exit when QTERM_SESSION_ID is unset")
	}
	if !strings.Contains(body, `X-Qterm-Terminal-Id: $QTERM_SESSION_ID`) {
		t.Fatal("relay must always forward QTERM_SESSION_ID as terminal id")
	}
}

func TestHookWithoutTerminalIDIsIgnored(t *testing.T) {
	var got []core.Intent
	s := &Server{
		token: "tok",
		onIntent: func(i core.Intent) {
			got = append(got, i)
		},
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/v1/hooks/", s.auth(s.handleSourceHook))

	payload, _ := json.Marshal(map[string]any{
		"hook_event_name": "UserPromptSubmit",
		"session_id":      "cli-outside",
		"prompt":          "rename this tab please",
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/hooks/claude", bytes.NewReader(payload))
	req.Header.Set("Authorization", "Bearer tok")
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rr.Code, rr.Body.String())
	}
	if len(got) != 0 {
		t.Fatalf("expected no intents without terminal id, got %#v", got)
	}
}

func TestHookWithTerminalIDIsAccepted(t *testing.T) {
	var got []core.Intent
	s := &Server{
		token: "tok",
		onIntent: func(i core.Intent) {
			got = append(got, i)
		},
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/v1/hooks/", s.auth(s.handleSourceHook))

	payload, _ := json.Marshal(map[string]any{
		"hook_event_name": "SessionStart",
		"session_id":      "cli-inside",
	})
	req := httptest.NewRequest(http.MethodPost, "/v1/hooks/claude", bytes.NewReader(payload))
	req.Header.Set("Authorization", "Bearer tok")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Qterm-Terminal-Id", "pane-abc")
	rr := httptest.NewRecorder()
	mux.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("status %d: %s", rr.Code, rr.Body.String())
	}
	if len(got) == 0 {
		t.Fatal("expected intents when terminal id is present")
	}
	for _, i := range got {
		if i.TerminalID != "pane-abc" {
			t.Fatalf("TerminalID=%q want pane-abc", i.TerminalID)
		}
	}
}

type stubAPI struct {
	splitID  string
	splitDir string
	wrote    string
	wroteID  string
	submit   bool
	notified string
	opened   string
}

func (s *stubAPI) CreateTerminal(string, string, string) (map[string]any, error) {
	return nil, nil
}
func (s *stubAPI) RenameTerminal(string, string) error { return nil }
func (s *stubAPI) ListTerminals() ([]map[string]any, error) {
	return nil, nil
}
func (s *stubAPI) GetTerminal(string) (map[string]any, error) { return nil, nil }
func (s *stubAPI) CreateProject(string, string) (map[string]any, error) {
	return nil, nil
}
func (s *stubAPI) RenameProject(string, string) error { return nil }
func (s *stubAPI) ListProjects() ([]map[string]any, error) {
	return nil, nil
}
func (s *stubAPI) SetTheme(string) error { return nil }
func (s *stubAPI) GetTheme() string      { return "dark" }
func (s *stubAPI) FocusSession(string) error {
	return nil
}
func (s *stubAPI) SplitTerminal(id, direction, name string) (map[string]any, error) {
	s.splitID = id
	s.splitDir = direction
	return map[string]any{"id": "new", "name": name, "direction": direction}, nil
}
func (s *stubAPI) WriteTerminal(id, data string, submit bool) error {
	s.wroteID = id
	s.wrote = data
	s.submit = submit
	return nil
}
func (s *stubAPI) NotifyUser(title, body, sessionID string) error {
	s.notified = title + "|" + body + "|" + sessionID
	return nil
}
func (s *stubAPI) OpenPathInIDE(path, sessionID string) error {
	s.opened = path + "|" + sessionID
	return nil
}

func TestToolsSplitWriteNotify(t *testing.T) {
	api := &stubAPI{}
	s := &Server{token: "tok", api: api}
	mux := http.NewServeMux()
	mux.HandleFunc("/v1/tools/", s.auth(s.handleTools))

	post := func(path string, body any) *httptest.ResponseRecorder {
		b, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader(b))
		req.Header.Set("Authorization", "Bearer tok")
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Qterm-Terminal-Id", "pane-1")
		rr := httptest.NewRecorder()
		mux.ServeHTTP(rr, req)
		return rr
	}

	rr := post("/v1/tools/terminals/focused/split", map[string]any{"direction": "down", "name": "logs"})
	if rr.Code != http.StatusOK {
		t.Fatalf("split %d %s", rr.Code, rr.Body.String())
	}
	if api.splitID != "pane-1" || api.splitDir != "down" {
		t.Fatalf("split got id=%q dir=%q", api.splitID, api.splitDir)
	}

	rr = post("/v1/tools/terminals/focused/write", map[string]any{"text": "ls", "submit": true})
	if rr.Code != http.StatusOK {
		t.Fatalf("write %d %s", rr.Code, rr.Body.String())
	}
	if api.wrote != "ls" || !api.submit || api.wroteID != "pane-1" {
		t.Fatalf("write %#v", api)
	}

	rr = post("/v1/tools/notify", map[string]any{"title": "Hi", "body": "Look"})
	if rr.Code != http.StatusOK || !strings.Contains(api.notified, "Hi|Look|pane-1") {
		t.Fatalf("notify %s %q", rr.Body.String(), api.notified)
	}

	rr = post("/v1/tools/open-ide", map[string]any{"path": "/tmp/app"})
	if rr.Code != http.StatusOK || !strings.HasPrefix(api.opened, "/tmp/app") {
		t.Fatalf("open-ide %s %q", rr.Body.String(), api.opened)
	}
}
