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
//
// Antigravity hooks use a different schema than Gemini/Claude:
//   { "qterm-bridge": { "PreInvocation": [...], "Stop": [...], "PostToolUse": [{matcher, hooks}] } }
// Events: PreInvocation, PostInvocation, PreToolUse, PostToolUse, Stop.
// Timeouts are seconds. Payload uses conversationId (no hook_event_name) — relay injects it.

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
	if err := writeConfigJSON(filepath.Join(root, "hooks.json"), agyHooksConfig(relay)); err != nil {
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

// agyHooksConfig builds Antigravity's named-hook schema.
// Skip PreToolUse so we never risk blocking tool permission decisions.
func agyHooksConfig(relayPath string) map[string]any {
	cmd := func(event string) string {
		return fmt.Sprintf(`/bin/bash %q agy %s`, relayPath, event)
	}
	handler := func(event string, timeoutSec int) map[string]any {
		return map[string]any{
			"type":    "command",
			"command": cmd(event),
			"timeout": timeoutSec,
		}
	}
	return map[string]any{
		"qterm-bridge": map[string]any{
			// Flat events (list of handlers).
			"PreInvocation":  []any{handler("PreInvocation", 5)},
			"PostInvocation": []any{handler("PostInvocation", 5)},
			"Stop":           []any{handler("Stop", 5)},
			// Grouped tool events need matcher + hooks wrapper.
			"PostToolUse": []any{
				map[string]any{
					"matcher": "*",
					"hooks":   []any{handler("PostToolUse", 5)},
				},
			},
		},
	}
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
