package agentbridge

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"qterm/internal/appmode"
)

func TestRelayScriptGatesOnQtermSessionID(t *testing.T) {
	body := relayScriptBody("/tmp/qterm-data", "tok", "claude")
	if !strings.Contains(body, `if [[ -z "${QTERM_SESSION_ID:-}" ]]; then`) {
		t.Fatal("relay must early-exit when QTERM_SESSION_ID is unset")
	}
	if !strings.Contains(body, "exit 0") {
		t.Fatal("relay must exit 0 outside Qterm")
	}
	// Session id is required before curl — not optional.
	if strings.Contains(body, `if [[ -n "${QTERM_SESSION_ID:-}" ]]; then`) {
		t.Fatal("session id header must not be optional after gate")
	}
	if !strings.Contains(body, `X-Qterm-Terminal-Id: $QTERM_SESSION_ID`) {
		t.Fatal("relay must always forward QTERM_SESSION_ID as terminal id")
	}
}

func TestHookWithoutTerminalIDIsIgnored(t *testing.T) {
	var got []Intent
	s := &Server{
		token: "tok",
		onIntent: func(i Intent) {
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
	// Deliberately omit X-Qterm-Terminal-Id (agent outside Qterm / old relay).
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
	var got []Intent
	s := &Server{
		token: "tok",
		onIntent: func(i Intent) {
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

func TestRefreshInstalledRelaysRewritesGate(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	dataDir := filepath.Join(home, "Library", "Application Support", appmode.DataDir)
	ctx := testInstallCtx(t, home)
	if _, err := installClaudePlugin(ctx); err != nil {
		t.Fatal(err)
	}
	relayPath := filepath.Join(home, ".claude", "plugins", "qterm", "hooks", "relay.sh")
	// Simulate an old relay without the gate.
	old := "#!/bin/bash\n# old relay\ncurl http://example.com\nexit 0\n"
	if err := os.WriteFile(relayPath, []byte(old), 0o755); err != nil {
		t.Fatal(err)
	}
	RefreshInstalledRelays(dataDir)
	b, err := os.ReadFile(relayPath)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(b), `if [[ -z "${QTERM_SESSION_ID:-}" ]]; then`) {
		t.Fatalf("refresh did not rewrite gate:\n%s", b)
	}
}
