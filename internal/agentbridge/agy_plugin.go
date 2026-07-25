package agentbridge

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
)

// Antigravity CLI plugin at ~/.gemini/antigravity-cli/plugins/qterm/
// hooks.json + mcp_config.json at plugin root (not hooks/ subdirectory).
// https://antigravity.google/docs/cli/plugins

func agyPluginRoot() string {
	return filepath.Join(userHomeDir(), ".gemini", "antigravity-cli", "plugins", qtermPluginName)
}

func agyLegacyHooksJSON() string {
	return filepath.Join(userHomeDir(), ".gemini", "antigravity-cli", "hooks.json")
}

func installAgyPlugin(ctx InstallCtx) (InstallResult, error) {
	root := agyPluginRoot()
	if err := os.MkdirAll(filepath.Join(root, "scripts"), 0o755); err != nil {
		return InstallResult{CLI: "agy"}, err
	}
	relay := filepath.Join(root, "scripts", "relay.sh")
	if err := writePluginRelay(relay, ctx.DataDir, ctx.Token, "agy"); err != nil {
		return InstallResult{CLI: "agy"}, err
	}
	if err := writeConfigJSON(filepath.Join(root, "plugin.json"), map[string]any{
		"$schema":     "https://antigravity.google/schemas/v1/plugin.json",
		"name":        qtermPluginName,
		"description": "Connect Antigravity CLI to the Qterm macOS terminal — live status, rename, and app control.",
	}); err != nil {
		return InstallResult{CLI: "agy"}, err
	}

	// Absolute quoted path — Antigravity plugins do not expand ${extensionPath}.
	cmd := fmt.Sprintf(`/bin/bash %q agy`, relay)
	events := []string{
		"SessionStart", "SessionEnd", "BeforeAgent", "AfterAgent",
		"BeforeTool", "AfterTool",
	}
	hooks := nestedCommandHooks(events, cmd, nil, map[string]any{
		"name":    "qterm-bridge",
		"timeout": 5000,
	})
	if err := writeConfigJSON(filepath.Join(root, "hooks.json"), map[string]any{"hooks": hooks}); err != nil {
		return InstallResult{CLI: "agy"}, err
	}
	if err := writeConfigJSON(filepath.Join(root, "mcp_config.json"), map[string]any{
		"mcpServers": map[string]any{"qterm": qtermMCPServer(ctx.MCPCommand, ctx.DataDir, ctx.Token)},
	}); err != nil {
		return InstallResult{CLI: "agy"}, err
	}
	if err := writeQtermSkill(filepath.Join(root, "skills", "qterm-terminal")); err != nil {
		return InstallResult{CLI: "agy"}, err
	}

	_ = exec.Command("agy", "plugin", "install", root).Run()
	_ = exec.Command("agy", "plugin", "enable", qtermPluginName).Run()
	_ = removeQtermHooks(agyLegacyHooksJSON())

	return InstallResult{
		CLI:       "agy",
		Installed: true,
		Message:   "Installed ~/.gemini/antigravity-cli/plugins/qterm. Restart Antigravity CLI.",
	}, nil
}

func uninstallAgyPlugin() error {
	_ = exec.Command("agy", "plugin", "uninstall", qtermPluginName).Run()
	_ = exec.Command("agy", "plugin", "disable", qtermPluginName).Run()
	_ = removeQtermHooks(agyLegacyHooksJSON())
	_ = os.RemoveAll(agyPluginRoot())
	return nil
}

func agyPluginInstalled() bool {
	_, err := os.Stat(filepath.Join(agyPluginRoot(), "plugin.json"))
	return err == nil
}
