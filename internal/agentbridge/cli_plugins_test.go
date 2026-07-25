package agentbridge

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func testInstallCtx(t *testing.T, home string) InstallCtx {
	t.Helper()
	t.Setenv("HOME", home)
	dataDir := filepath.Join(home, "Library", "Application Support", "q-term")
	_ = os.MkdirAll(filepath.Join(dataDir, "agent"), 0o755)
	_ = os.WriteFile(filepath.Join(dataDir, "agent", "bridge.json"), []byte(`{"url":"http://127.0.0.1:19527","token":"t","port":19527}`), 0o600)
	return InstallCtx{
		DataDir:    dataDir,
		RelayPath:  filepath.Join(dataDir, "agent", "scripts", "relay.sh"),
		Token:      "t",
		MCPCommand: "/tmp/Qterm",
	}
}

func mustExist(t *testing.T, paths ...string) {
	t.Helper()
	for _, p := range paths {
		if _, err := os.Stat(p); err != nil {
			t.Fatalf("missing %s: %v", p, err)
		}
	}
}

func TestInstallClaudePluginLayout(t *testing.T) {
	home := t.TempDir()
	ctx := testInstallCtx(t, home)
	res, err := installClaudePlugin(ctx)
	if err != nil || !res.Installed {
		t.Fatalf("install: %v %#v", err, res)
	}
	root := filepath.Join(home, ".claude", "plugins", "qterm")
	mustExist(t,
		filepath.Join(root, ".claude-plugin", "plugin.json"),
		filepath.Join(root, "hooks", "hooks.json"),
		filepath.Join(root, "hooks", "relay.sh"),
		filepath.Join(root, ".mcp.json"),
		filepath.Join(root, "skills", "qterm-terminal", "SKILL.md"),
		filepath.Join(home, ".claude", "plugins", ".claude-plugin", "marketplace.json"),
	)
	// Must not use skills-dir shortcut.
	if _, err := os.Stat(filepath.Join(home, ".claude", "skills", "qterm")); !os.IsNotExist(err) {
		t.Fatal("legacy ~/.claude/skills/qterm should not exist")
	}
	hooks, _ := os.ReadFile(filepath.Join(root, "hooks", "hooks.json"))
	if !strings.Contains(string(hooks), `${CLAUDE_PLUGIN_ROOT}/hooks/relay.sh`) {
		t.Fatalf("expected CLAUDE_PLUGIN_ROOT:\n%s", hooks)
	}
	market, _ := os.ReadFile(filepath.Join(home, ".claude", "plugins", ".claude-plugin", "marketplace.json"))
	if !strings.Contains(string(market), `"./qterm"`) {
		t.Fatalf("marketplace source wrong:\n%s", market)
	}
	settings, _ := os.ReadFile(filepath.Join(home, ".claude", "settings.json"))
	if !strings.Contains(string(settings), `qterm@local`) {
		t.Fatalf("expected enabledPlugins qterm@local:\n%s", settings)
	}
	if !strings.Contains(string(settings), `mcp__plugin_qterm_qterm`) {
		t.Fatalf("expected MCP allow rules:\n%s", settings)
	}
	if !claudePluginInstalled() {
		t.Fatal("claudePluginInstalled false")
	}
}

func TestInstallGeminiExtensionLayout(t *testing.T) {
	home := t.TempDir()
	ctx := testInstallCtx(t, home)
	res, err := installGeminiExtension(ctx)
	if err != nil || !res.Installed {
		t.Fatalf("install: %v %#v", err, res)
	}
	root := filepath.Join(home, ".gemini", "extensions", "qterm")
	mustExist(t,
		filepath.Join(root, "gemini-extension.json"),
		filepath.Join(root, "hooks", "hooks.json"),
		filepath.Join(root, "hooks", "relay.sh"),
	)
	hooks, _ := os.ReadFile(filepath.Join(root, "hooks", "hooks.json"))
	if !strings.Contains(string(hooks), `${extensionPath}/hooks/relay.sh`) {
		t.Fatalf("expected extensionPath:\n%s", hooks)
	}
	ext, _ := os.ReadFile(filepath.Join(root, "gemini-extension.json"))
	if !strings.Contains(string(ext), `"mcpServers"`) {
		t.Fatalf("expected mcpServers:\n%s", ext)
	}
	if !geminiExtensionInstalled() {
		t.Fatal("geminiExtensionInstalled false")
	}
}

func TestInstallAgyPluginLayout(t *testing.T) {
	home := t.TempDir()
	ctx := testInstallCtx(t, home)
	res, err := installAgyPlugin(ctx)
	if err != nil || !res.Installed {
		t.Fatalf("install: %v %#v", err, res)
	}
	root := filepath.Join(home, ".gemini", "antigravity-cli", "plugins", "qterm")
	mustExist(t,
		filepath.Join(root, "plugin.json"),
		filepath.Join(root, "hooks.json"),
		filepath.Join(root, "mcp_config.json"),
		filepath.Join(root, "scripts", "relay.sh"),
	)
	// Must be root hooks.json, not hooks/hooks.json
	if _, err := os.Stat(filepath.Join(root, "hooks", "hooks.json")); !os.IsNotExist(err) {
		t.Fatal("agy should not use hooks/ subdirectory")
	}
	if !agyPluginInstalled() {
		t.Fatal("agyPluginInstalled false")
	}
}

func TestInstallCodexPluginLayout(t *testing.T) {
	home := t.TempDir()
	ctx := testInstallCtx(t, home)
	res, err := installCodexPlugin(ctx)
	if err != nil || !res.Installed {
		t.Fatalf("install: %v %#v", err, res)
	}
	root := filepath.Join(home, ".codex", "plugins", "qterm")
	mustExist(t,
		filepath.Join(root, ".codex-plugin", "plugin.json"),
		filepath.Join(root, "hooks", "hooks.json"),
		filepath.Join(root, "hooks", "relay.sh"),
		filepath.Join(root, ".mcp.json"),
		filepath.Join(root, "skills", "qterm-terminal", "SKILL.md"),
		filepath.Join(home, ".agents", "plugins", "marketplace.json"),
	)
	if _, err := os.Stat(filepath.Join(home, ".codex", "qterm-marketplace")); !os.IsNotExist(err) {
		t.Fatal("legacy qterm-marketplace should not exist")
	}
	hooks, _ := os.ReadFile(filepath.Join(root, "hooks", "hooks.json"))
	if !strings.Contains(string(hooks), `${PLUGIN_ROOT}/hooks/relay.sh`) {
		t.Fatalf("hooks should use PLUGIN_ROOT:\n%s", hooks)
	}
	market, _ := os.ReadFile(filepath.Join(home, ".agents", "plugins", "marketplace.json"))
	if !strings.Contains(string(market), `"./.codex/plugins/qterm"`) {
		t.Fatalf("marketplace path wrong:\n%s", market)
	}
	cfg, _ := os.ReadFile(filepath.Join(home, ".codex", "config.toml"))
	if !strings.Contains(string(cfg), `[plugins."qterm@home"]`) {
		t.Fatalf("plugin not enabled:\n%s", cfg)
	}
	if !strings.Contains(string(cfg), `default_tools_approval_mode = "approve"`) {
		t.Fatalf("expected MCP auto-approve:\n%s", cfg)
	}
	if !codexPluginInstalled() {
		t.Fatal("codexPluginInstalled false")
	}
}

func TestInstallCursorPluginLayout(t *testing.T) {
	home := t.TempDir()
	ctx := testInstallCtx(t, home)
	res, err := installCursorPlugin(ctx)
	if err != nil || !res.Installed {
		t.Fatalf("install: %v %#v", err, res)
	}
	root := filepath.Join(home, ".cursor", "plugins", "local", "qterm")
	mustExist(t,
		filepath.Join(root, ".cursor-plugin", "plugin.json"),
		filepath.Join(root, "hooks", "hooks.json"),
		filepath.Join(root, "scripts", "relay.sh"),
		filepath.Join(root, "mcp.json"),
		filepath.Join(home, ".cursor", "hooks.json"),
		filepath.Join(home, ".cursor", "mcp.json"),
	)
	userHooks, _ := os.ReadFile(filepath.Join(home, ".cursor", "hooks.json"))
	if !strings.Contains(string(userHooks), `"version"`) {
		t.Fatalf("expected version field:\n%s", userHooks)
	}
	if !strings.Contains(string(userHooks), "sessionStart") {
		t.Fatalf("expected camelCase events:\n%s", userHooks)
	}
	if !cursorPluginInstalled() {
		t.Fatal("cursorPluginInstalled false")
	}
	perms, _ := os.ReadFile(filepath.Join(home, ".cursor", "permissions.json"))
	if !strings.Contains(string(perms), `"qterm:*"`) {
		t.Fatalf("expected mcpAllowlist:\n%s", perms)
	}
}

