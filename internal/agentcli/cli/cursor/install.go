package cursor

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"qterm/internal/agentcli/core"
)

// Cursor Agent: official user hooks + MCP (CLI), plus local plugin package (IDE).
// Hooks: https://cursor.com/docs/hooks
// Plugins: https://cursor.com/docs/reference/plugins
//
// cursor-agent loads ~/.cursor/hooks.json (camelCase events, version: 1).
// Local plugin at ~/.cursor/plugins/local/qterm provides mcp + skills for IDE.

type adapter struct{}

// New returns the Cursor Agent CLI adapter.
func New() core.Adapter { return adapter{} }

func (adapter) ID() string         { return "cursor" }
func (adapter) Name() string       { return "Cursor Agent" }
func (adapter) Binaries() []string { return []string{"cursor-agent"} }
func (a adapter) Available() (string, bool) {
	return core.LookPath(a.Binaries())
}
func (adapter) Installed() bool { return pluginInstalled() }
func (adapter) RelayPath() string {
	return filepath.Join(pluginRoot(), "scripts", "relay.sh")
}
func (adapter) MapHook(raw map[string]any) []core.Intent {
	cwd := core.FirstString(raw, "cwd", "Cwd")
	if cwd == "" && raw != nil {
		if paths, ok := raw["workspacePaths"].([]any); ok && len(paths) > 0 {
			if s, ok := paths[0].(string); ok {
				cwd = s
			}
		}
	}
	return core.ParseHook(core.ParseInput{
		Source:    "cursor",
		Title:     "Cursor Agent",
		Event:     core.FirstString(raw, "hook_event_name", "hookEventName", "event", "name"),
		SessionID: core.FirstString(raw, "session_id", "sessionId", "conversationId", "conversation_id"),
		Cwd:       cwd,
		Raw:       raw,
	})
}

func (a adapter) Install(ctx core.InstallCtx) (core.InstallResult, error) {
	if err := core.RequireCLI(a); err != nil {
		return core.InstallResult{CLI: a.ID()}, err
	}
	return install(ctx)
}

func (adapter) Uninstall(core.InstallCtx) error {
	return uninstall()
}

func pluginRoot() string {
	return filepath.Join(core.UserHomeDir(), ".cursor", "plugins", "local", core.PluginName)
}

func userHooksJSON() string {
	return filepath.Join(core.UserHomeDir(), ".cursor", "hooks.json")
}

func userMCPJSON() string {
	return filepath.Join(core.UserHomeDir(), ".cursor", "mcp.json")
}

func permissionsJSON() string {
	return filepath.Join(core.UserHomeDir(), ".cursor", "permissions.json")
}

func install(ctx core.InstallCtx) (core.InstallResult, error) {
	root := pluginRoot()
	if err := os.MkdirAll(filepath.Join(root, ".cursor-plugin"), 0o755); err != nil {
		return core.InstallResult{CLI: "cursor"}, err
	}
	if err := os.MkdirAll(filepath.Join(root, "scripts"), 0o755); err != nil {
		return core.InstallResult{CLI: "cursor"}, err
	}
	relay := filepath.Join(root, "scripts", "relay.sh")
	if err := core.WritePluginRelay(relay, ctx.DataDir, ctx.Token, "cursor"); err != nil {
		return core.InstallResult{CLI: "cursor"}, err
	}
	if err := core.WriteConfigJSON(filepath.Join(root, ".cursor-plugin", "plugin.json"), map[string]any{
		"name":        core.PluginName,
		"version":     core.Version,
		"description": "Connect Cursor Agent to the Qterm macOS terminal — live status, rename, and app control.",
		"author":      map[string]any{"name": "Qterm"},
		"keywords":    []string{"terminal", "hooks", "mcp"},
	}); err != nil {
		return core.InstallResult{CLI: "cursor"}, err
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
	if err := core.WriteConfigJSON(filepath.Join(root, "hooks", "hooks.json"), map[string]any{"hooks": pluginHooks}); err != nil {
		return core.InstallResult{CLI: "cursor"}, err
	}
	if err := core.WriteConfigJSON(filepath.Join(root, "mcp.json"), map[string]any{
		"mcpServers": map[string]any{"qterm": core.QtermMCPServer(ctx.MCPCommand, ctx.DataDir, ctx.Token)},
	}); err != nil {
		return core.InstallResult{CLI: "cursor"}, err
	}
	if err := core.WriteQtermSkill(filepath.Join(root, "skills", "qterm-terminal")); err != nil {
		return core.InstallResult{CLI: "cursor"}, err
	}

	// CLI path: absolute command in user hooks (cwd is ~/.cursor/).
	userCmd := fmt.Sprintf(`/bin/bash %q cursor`, relay)
	if err := upsertUserHooks(userCmd); err != nil {
		return core.InstallResult{CLI: "cursor"}, err
	}
	if err := core.WriteMCPConfig(userMCPJSON(), ctx.MCPCommand, ctx.DataDir, ctx.Token); err != nil {
		return core.InstallResult{CLI: "cursor"}, err
	}
	if err := ensureQtermPermissions(); err != nil {
		return core.InstallResult{CLI: "cursor"}, err
	}

	return core.InstallResult{
		CLI:       "cursor",
		Installed: true,
		Message:   "Installed ~/.cursor/plugins/local/qterm + user hooks/MCP (allowlisted). Restart Cursor Agent.",
	}, nil
}

func uninstall() error {
	_ = stripUserHooks()
	_ = core.RemoveMCP(userMCPJSON())
	_ = os.RemoveAll(pluginRoot())
	return nil
}

func pluginInstalled() bool {
	if _, err := os.Stat(filepath.Join(pluginRoot(), ".cursor-plugin", "plugin.json")); err != nil {
		return false
	}
	b, err := os.ReadFile(userHooksJSON())
	if err != nil {
		return false
	}
	return strings.Contains(string(b), core.HookMarker) || strings.Contains(string(b), "plugins/local/qterm")
}

func upsertUserHooks(command string) error {
	path := userHooksJSON()
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
		cleaned := stripQtermCommands(existing)
		cleaned = append(cleaned, map[string]any{"command": command})
		hooks[ev] = cleaned
	}
	root["hooks"] = hooks
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return core.WriteConfigJSON(path, root)
}

func stripUserHooks() error {
	path := userHooksJSON()
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
		cleaned := stripQtermCommands(arr)
		if len(cleaned) == 0 {
			delete(hooks, k)
		} else {
			hooks[k] = cleaned
		}
	}
	root["hooks"] = hooks
	return core.WriteConfigJSON(path, root)
}

func stripQtermCommands(entries []any) []any {
	out := make([]any, 0, len(entries))
	for _, e := range entries {
		em, ok := e.(map[string]any)
		if !ok {
			out = append(out, e)
			continue
		}
		cmd, _ := em["command"].(string)
		if strings.Contains(cmd, core.HookMarker) ||
			strings.Contains(cmd, "plugins/local/qterm") ||
			strings.Contains(cmd, "relay.sh") && strings.Contains(cmd, "cursor") {
			continue
		}
		out = append(out, e)
	}
	return out
}

// ensureQtermPermissions adds qterm:* to ~/.cursor/permissions.json mcpAllowlist.
// https://cursor.com/docs/reference/permissions
func ensureQtermPermissions() error {
	path := permissionsJSON()
	root := map[string]any{}
	if b, err := os.ReadFile(path); err == nil && len(b) > 0 {
		_ = json.Unmarshal(b, &root)
	}
	list := core.AsStringSlice(root["mcpAllowlist"])
	list = core.AddUniqueString(list, "qterm:*")
	root["mcpAllowlist"] = list
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return core.WriteConfigJSON(path, root)
}
