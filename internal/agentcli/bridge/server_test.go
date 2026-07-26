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
