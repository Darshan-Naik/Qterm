package grok

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"qterm/internal/agentcli/core"
)

// Grok Build plugin at ~/.grok/plugins/qterm/ plus always-on user hooks at
// ~/.grok/hooks/qterm.json. Dropping files under plugins/ is not enough: Grok
// only treats a plugin as installed after `grok plugin install --trust`, and
// CLI status still depends on global ~/.grok/hooks (always trusted).
// https://docs.x.ai/docs/grok-cli/plugins
// https://docs.x.ai/docs/grok-cli/hooks

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

func userHooksJSON() string {
	return filepath.Join(grokHome(), "hooks", "qterm.json")
}

func hookCommand(relay string) string {
	return fmt.Sprintf(`/bin/bash %q grok "${GROK_HOOK_EVENT}"`, relay)
}

func hookOpts() map[string]any {
	return map[string]any{
		"timeout": 5,
		"env": map[string]any{
			"QTERM_SESSION_ID": "${QTERM_SESSION_ID}",
			"QTERM_PROJECT_ID": "${QTERM_PROJECT_ID}",
		},
	}
}

func hookEvents() []string {
	return []string{
		"SessionStart", "SessionEnd", "UserPromptSubmit",
		"Stop", "StopFailure", "StopCancelled",
		"Notification", "PermissionDenied",
		"PreToolUse", "PostToolUse", "PostToolUseFailure",
	}
}

func writeGrokHooks(path, relay string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	hooks := core.NestedCommandHooks(hookEvents(), hookCommand(relay), nil, hookOpts())
	return core.WriteConfigJSON(path, map[string]any{
		"description": "Qterm agent bridge (" + core.HookMarker + ")",
		"hooks":       hooks,
	})
}

func install(ctx core.InstallCtx) (core.InstallResult, error) {
	root := pluginRoot()
	relay := filepath.Join(root, "hooks", "relay.sh")
	if err := os.MkdirAll(filepath.Join(root, ".grok-plugin"), 0o755); err != nil {
		return core.InstallResult{CLI: "grok"}, err
	}
	if err := os.MkdirAll(filepath.Join(root, "hooks"), 0o755); err != nil {
		return core.InstallResult{CLI: "grok"}, err
	}
	if err := core.WritePluginRelay(relay, ctx.DataDir, ctx.Token, "grok"); err != nil {
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
	if err := writeGrokHooks(filepath.Join(root, "hooks", "hooks.json"), relay); err != nil {
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

	// Global hooks always load. Plugin hooks only run after `plugin install --trust`.
	if err := writeGrokHooks(userHooksJSON(), relay); err != nil {
		return core.InstallResult{CLI: "grok"}, err
	}

	if err := setPluginEnabledInToml(configToml(), core.PluginName, true); err != nil {
		return core.InstallResult{CLI: "grok"}, err
	}
	if bin, err := core.FirstBinary("grok"); err == nil {
		_, _ = core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "install", root, "--trust")
		_, _ = core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "enable", core.PluginName)
	}

	return core.InstallResult{
		CLI:       "grok",
		Installed: true,
		Message:   "Installed Grok Build hooks + ~/.grok/plugins/qterm. Restart Grok Build.",
	}, nil
}

func uninstall() error {
	if bin, err := core.FirstBinary("grok"); err == nil {
		_, _ = core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "uninstall", core.PluginName, "--confirm")
		_, _ = core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "disable", core.PluginName)
	}
	_ = setPluginEnabledInToml(configToml(), core.PluginName, false)
	_ = os.Remove(userHooksJSON())
	_ = os.RemoveAll(pluginRoot())
	return nil
}

func pluginInstalled() bool {
	b, err := os.ReadFile(userHooksJSON())
	if err != nil {
		return false
	}
	return strings.Contains(string(b), core.HookMarker)
}
