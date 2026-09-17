package grok

import (
	"os"
	"os/exec"
	"path/filepath"

	"qterm/internal/agentcli/core"
)

// Grok Build plugin at ~/.grok/plugins/qterm/
// User plugins there are auto-trusted. Plugins stay off until enabled
// ([plugins].enabled or `grok plugin enable`).
// https://docs.x.ai/build/features/skills-plugins-marketplaces
// https://docs.x.ai/build/features/hooks

type adapter struct{}

// New returns the Grok Build CLI adapter.
func New() core.Adapter { return adapter{} }

func (adapter) ID() string         { return "grok" }
func (adapter) Name() string       { return "Grok Build" }
func (adapter) Binaries() []string { return []string{"grok"} }
func (a adapter) Available() (string, bool) {
	return core.LookPath(a.Binaries())
}
func (adapter) Installed() bool { return pluginInstalled() }
func (adapter) RelayPath() string {
	return filepath.Join(pluginRoot(), "hooks", "relay.sh")
}
func (adapter) MapHook(raw map[string]any) []core.Intent {
	cwd := core.FirstString(raw, "cwd", "Cwd", "workspaceRoot", "GROK_WORKSPACE_ROOT")
	return core.ParseHook(core.ParseInput{
		Source:    "grok",
		Title:     "Grok Build",
		Event:     core.FirstString(raw, "hook_event_name", "hookEventName", "event", "name", "GROK_HOOK_EVENT"),
		SessionID: core.FirstString(raw, "session_id", "sessionId", "GROK_SESSION_ID"),
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

func grokHome() string {
	if h := os.Getenv("GROK_HOME"); h != "" {
		return h
	}
	return filepath.Join(core.UserHomeDir(), ".grok")
}

func pluginRoot() string {
	return filepath.Join(grokHome(), "plugins", core.PluginName)
}

func configToml() string {
	return filepath.Join(grokHome(), "config.toml")
}

func install(ctx core.InstallCtx) (core.InstallResult, error) {
	root := pluginRoot()
	if err := os.MkdirAll(filepath.Join(root, ".grok-plugin"), 0o755); err != nil {
		return core.InstallResult{CLI: "grok"}, err
	}
	if err := os.MkdirAll(filepath.Join(root, "hooks"), 0o755); err != nil {
		return core.InstallResult{CLI: "grok"}, err
	}
	if err := core.WritePluginRelay(filepath.Join(root, "hooks", "relay.sh"), ctx.DataDir, ctx.Token, "grok"); err != nil {
		return core.InstallResult{CLI: "grok"}, err
	}

	manifest := map[string]any{
		"name":        core.PluginName,
		"version":     core.Version,
		"description": "Connect Grok Build to the Qterm macOS terminal: live status, rename, and app control.",
		"author":      map[string]any{"name": "Qterm", "url": "https://github.com/Darshan-Naik/Qterm"},
		"keywords":    []string{"terminal", "hooks", "mcp"},
		"hooks":       "./hooks/hooks.json",
		"mcpServers":  "./.mcp.json",
		"skills":      "./skills/",
	}
	if err := core.WriteConfigJSON(filepath.Join(root, ".grok-plugin", "plugin.json"), manifest); err != nil {
		return core.InstallResult{CLI: "grok"}, err
	}
	if err := core.WriteConfigJSON(filepath.Join(root, "plugin.json"), manifest); err != nil {
		return core.InstallResult{CLI: "grok"}, err
	}

	events := []string{
		"SessionStart", "SessionEnd", "UserPromptSubmit",
		"Stop", "StopFailure", "StopCancelled",
		"Notification", "PermissionDenied",
		"PreToolUse", "PostToolUse", "PostToolUseFailure",
	}
	hooks := core.NestedCommandHooks(events, `bash "${GROK_PLUGIN_ROOT}/hooks/relay.sh" grok`, nil, map[string]any{
		"timeout": 5,
	})
	if err := core.WriteConfigJSON(filepath.Join(root, "hooks", "hooks.json"), map[string]any{
		"description": "Qterm agent bridge (" + core.HookMarker + ")",
		"hooks":       hooks,
	}); err != nil {
		return core.InstallResult{CLI: "grok"}, err
	}
	if err := core.WriteConfigJSON(filepath.Join(root, ".mcp.json"), map[string]any{
		"mcpServers": map[string]any{"qterm": core.QtermMCPServer(ctx.MCPCommand, ctx.DataDir, ctx.Token)},
	}); err != nil {
		return core.InstallResult{CLI: "grok"}, err
	}
	if err := core.WriteQtermSkill(filepath.Join(root, "skills", "qterm-terminal")); err != nil {
		return core.InstallResult{CLI: "grok"}, err
	}

	if err := setPluginEnabledInToml(configToml(), core.PluginName, true); err != nil {
		return core.InstallResult{CLI: "grok"}, err
	}
	_ = exec.Command("grok", "plugin", "enable", core.PluginName).Run()

	return core.InstallResult{
		CLI:       "grok",
		Installed: true,
		Message:   "Installed ~/.grok/plugins/qterm (hooks + MCP). Restart Grok Build.",
	}, nil
}

func uninstall() error {
	_ = exec.Command("grok", "plugin", "uninstall", core.PluginName, "--confirm").Run()
	_ = exec.Command("grok", "plugin", "disable", core.PluginName).Run()
	_ = setPluginEnabledInToml(configToml(), core.PluginName, false)
	_ = os.RemoveAll(pluginRoot())
	return nil
}

func pluginInstalled() bool {
	for _, p := range []string{
		filepath.Join(pluginRoot(), ".grok-plugin", "plugin.json"),
		filepath.Join(pluginRoot(), "plugin.json"),
	} {
		if _, err := os.Stat(p); err == nil {
			return true
		}
	}
	return false
}
