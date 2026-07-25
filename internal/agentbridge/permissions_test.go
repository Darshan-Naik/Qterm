package agentbridge

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestEnsureClaudeQtermPermissions(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	_ = os.MkdirAll(filepath.Join(home, ".claude"), 0o755)
	path := filepath.Join(home, ".claude", "settings.json")
	_ = os.WriteFile(path, []byte(`{"permissions":{"allow":["Read"],"ask":["mcp__plugin_qterm_qterm"]}}`), 0o644)
	if err := ensureClaudeQtermPermissions(); err != nil {
		t.Fatal(err)
	}
	b, _ := os.ReadFile(path)
	s := string(b)
	for _, rule := range qtermClaudeAllowRules() {
		if !strings.Contains(s, rule) {
			t.Fatalf("missing allow rule %q in:\n%s", rule, s)
		}
	}
	if strings.Contains(s, `"ask"`) && strings.Contains(s, `mcp__plugin_qterm_qterm"`) {
		// ask should not still list the qterm rule we moved to allow
		if strings.Contains(s, `"ask":["mcp__plugin_qterm_qterm"]`) || strings.Contains(s, `"ask": [ "mcp__plugin_qterm_qterm" ]`) {
			t.Fatalf("qterm rule still in ask:\n%s", s)
		}
	}
	if !strings.Contains(s, `"Read"`) {
		t.Fatalf("should preserve existing allows:\n%s", s)
	}
}

func TestEnsureCodexQtermMCPApproval(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	_ = os.MkdirAll(filepath.Join(home, ".codex"), 0o755)
	if err := ensureCodexQtermMCPApproval("home"); err != nil {
		t.Fatal(err)
	}
	b, _ := os.ReadFile(filepath.Join(home, ".codex", "config.toml"))
	s := string(b)
	if !strings.Contains(s, `[plugins."qterm@home"]`) {
		t.Fatalf("missing plugin enable:\n%s", s)
	}
	if !strings.Contains(s, `[plugins."qterm@home".mcp_servers.qterm]`) {
		t.Fatalf("missing mcp_servers:\n%s", s)
	}
	if !strings.Contains(s, `default_tools_approval_mode = "approve"`) {
		t.Fatalf("missing approval mode:\n%s", s)
	}
	// Idempotent rewrite
	if err := ensureCodexQtermMCPApproval("home"); err != nil {
		t.Fatal(err)
	}
	b2, _ := os.ReadFile(filepath.Join(home, ".codex", "config.toml"))
	if strings.Count(string(b2), `default_tools_approval_mode = "approve"`) != 1 {
		t.Fatalf("duplicated approval blocks:\n%s", b2)
	}
}

func TestEnsureCursorQtermPermissions(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	if err := ensureCursorQtermPermissions(); err != nil {
		t.Fatal(err)
	}
	b, _ := os.ReadFile(filepath.Join(home, ".cursor", "permissions.json"))
	if !strings.Contains(string(b), `"qterm:*"`) {
		t.Fatalf("missing mcpAllowlist:\n%s", b)
	}
}

func TestSessionTitleFromHook(t *testing.T) {
	intents := ParseHook(ParseInput{
		Source:    "claude",
		Event:     "UserPromptSubmit",
		SessionID: "s1",
		Raw:       map[string]any{"session_title": "Fix login bug"},
	})
	found := false
	for _, in := range intents {
		if in.Type == "rename" {
			found = true
			if in.Payload["name"] != "Fix login bug" {
				t.Fatalf("payload %#v", in.Payload)
			}
		}
	}
	if !found {
		t.Fatalf("expected rename intent, got %#v", intents)
	}
}
