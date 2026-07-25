package agentbridge

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// Cursor Agent: official user hooks + MCP (CLI), plus local plugin package (IDE).
// Hooks: https://cursor.com/docs/hooks
// Plugins: https://cursor.com/docs/reference/plugins
//
// cursor-agent loads ~/.cursor/hooks.json (camelCase events, version: 1).
// Local plugin at ~/.cursor/plugins/local/qterm provides mcp + skills for IDE.

func cursorPluginRoot() string {
	return filepath.Join(userHomeDir(), ".cursor", "plugins", "local", qtermPluginName)
}

func cursorUserHooksJSON() string {
	return filepath.Join(userHomeDir(), ".cursor", "hooks.json")
}

func cursorUserMCPJSON() string {
	return filepath.Join(userHomeDir(), ".cursor", "mcp.json")
}

func installCursorPlugin(ctx InstallCtx) (InstallResult, error) {
	root := cursorPluginRoot()
	if err := os.MkdirAll(filepath.Join(root, ".cursor-plugin"), 0o755); err != nil {
		return InstallResult{CLI: "cursor"}, err
	}
	if err := os.MkdirAll(filepath.Join(root, "scripts"), 0o755); err != nil {
		return InstallResult{CLI: "cursor"}, err
	}
	relay := filepath.Join(root, "scripts", "relay.sh")
	if err := writePluginRelay(relay, ctx.DataDir, ctx.Token, "cursor"); err != nil {
		return InstallResult{CLI: "cursor"}, err
	}
	if err := writeConfigJSON(filepath.Join(root, ".cursor-plugin", "plugin.json"), map[string]any{
		"name":        qtermPluginName,
		"version":     qtermPluginVersion,
		"description": "Connect Cursor Agent to the Qterm macOS terminal — live status, rename, and app control.",
		"author":      map[string]any{"name": "Qterm"},
		"keywords":    []string{"terminal", "hooks", "mcp"},
	}); err != nil {
		return InstallResult{CLI: "cursor"}, err
	}

	// Plugin hooks use CURSOR_PLUGIN_ROOT (IDE). CLI uses ~/.cursor/hooks.json below.
	pluginCmd := `bash "${CURSOR_PLUGIN_ROOT}/scripts/relay.sh" cursor`
	pluginEvents := []string{
		"sessionStart", "sessionEnd", "beforeSubmitPrompt", "stop",
		"preToolUse", "postToolUse", "beforeShellExecution", "afterShellExecution",
	}
	pluginHooks := map[string]any{}
	for _, ev := range pluginEvents {
		pluginHooks[ev] = []any{map[string]any{"command": pluginCmd}}
	}
	if err := writeConfigJSON(filepath.Join(root, "hooks", "hooks.json"), map[string]any{"hooks": pluginHooks}); err != nil {
		return InstallResult{CLI: "cursor"}, err
	}
	if err := writeConfigJSON(filepath.Join(root, "mcp.json"), map[string]any{
		"mcpServers": map[string]any{"qterm": qtermMCPServer(ctx.MCPCommand, ctx.DataDir, ctx.Token)},
	}); err != nil {
		return InstallResult{CLI: "cursor"}, err
	}
	if err := writeQtermSkill(filepath.Join(root, "skills", "qterm-terminal")); err != nil {
		return InstallResult{CLI: "cursor"}, err
	}

	// CLI path: absolute command in user hooks (cwd is ~/.cursor/).
	userCmd := fmt.Sprintf(`/bin/bash %q cursor`, relay)
	if err := upsertCursorUserHooks(userCmd); err != nil {
		return InstallResult{CLI: "cursor"}, err
	}
	if err := writeMCPConfig(cursorUserMCPJSON(), ctx.MCPCommand, ctx.DataDir, ctx.Token); err != nil {
		return InstallResult{CLI: "cursor"}, err
	}

	return InstallResult{
		CLI:       "cursor",
		Installed: true,
		Message:   "Installed ~/.cursor/plugins/local/qterm + user hooks/MCP. Restart Cursor Agent.",
	}, nil
}

func uninstallCursorPlugin() error {
	_ = stripCursorUserHooks()
	_ = removeMCP(cursorUserMCPJSON())
	_ = os.RemoveAll(cursorPluginRoot())
	return nil
}

func cursorPluginInstalled() bool {
	if _, err := os.Stat(filepath.Join(cursorPluginRoot(), ".cursor-plugin", "plugin.json")); err != nil {
		return false
	}
	b, err := os.ReadFile(cursorUserHooksJSON())
	if err != nil {
		return false
	}
	return strings.Contains(string(b), HookMarker) || strings.Contains(string(b), "plugins/local/qterm")
}

func upsertCursorUserHooks(command string) error {
	path := cursorUserHooksJSON()
	root := map[string]any{"version": 1}
	if b, err := os.ReadFile(path); err == nil && len(b) > 0 {
		_ = json.Unmarshal(b, &root)
	}
	root["version"] = 1
	hooks, _ := root["hooks"].(map[string]any)
	if hooks == nil {
		hooks = map[string]any{}
	}
	events := []string{
		"sessionStart", "sessionEnd", "beforeSubmitPrompt", "stop",
		"preToolUse", "postToolUse", "beforeShellExecution", "afterShellExecution",
	}
	for _, ev := range events {
		existing, _ := hooks[ev].([]any)
		cleaned := stripCursorQtermCommands(existing)
		cleaned = append(cleaned, map[string]any{"command": command})
		hooks[ev] = cleaned
	}
	root["hooks"] = hooks
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return writeConfigJSON(path, root)
}

func stripCursorUserHooks() error {
	path := cursorUserHooksJSON()
	b, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var root map[string]any
	if json.Unmarshal(b, &root) != nil {
		return nil
	}
	hooks, ok := root["hooks"].(map[string]any)
	if !ok {
		return nil
	}
	for k, v := range hooks {
		arr, _ := v.([]any)
		cleaned := stripCursorQtermCommands(arr)
		if len(cleaned) == 0 {
			delete(hooks, k)
		} else {
			hooks[k] = cleaned
		}
	}
	root["hooks"] = hooks
	return writeConfigJSON(path, root)
}

func stripCursorQtermCommands(entries []any) []any {
	out := make([]any, 0, len(entries))
	for _, e := range entries {
		em, ok := e.(map[string]any)
		if !ok {
			out = append(out, e)
			continue
		}
		cmd, _ := em["command"].(string)
		if strings.Contains(cmd, HookMarker) ||
			strings.Contains(cmd, "plugins/local/qterm") ||
			strings.Contains(cmd, "relay.sh") && strings.Contains(cmd, "cursor") {
			continue
		}
		out = append(out, e)
	}
	return out
}
