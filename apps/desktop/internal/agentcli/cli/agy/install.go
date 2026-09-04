package agy

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"qterm/internal/agentcli/core"
)

// Antigravity CLI plugin at ~/.gemini/antigravity-cli/plugins/qterm/
// hooks.json + mcp_config.json at plugin root (not hooks/ subdirectory).
// https://antigravity.google/docs/cli/plugins
//
// Antigravity hooks use a different schema than Gemini/Claude:
//
//	{ "qterm-bridge": { "PreInvocation": [...], "Stop": [...], "PostToolUse": [{matcher, hooks}] } }
//
// Events: PreInvocation, PostInvocation, PreToolUse, PostToolUse, Stop.
// Timeouts are seconds. Payload uses conversationId (no hook_event_name) — relay injects it.

type adapter struct{}

// New returns the Antigravity CLI adapter.
func New() core.Adapter { return adapter{} }

func (adapter) ID() string         { return "agy" }
func (adapter) Name() string       { return "Antigravity CLI" }
func (adapter) Binaries() []string { return []string{"agy", "antigravity"} }
func (a adapter) Available() (string, bool) {
	return core.LookPath(a.Binaries())
}
func (adapter) Installed() bool { return pluginInstalled() }
func (adapter) RelayPath() string {
	return filepath.Join(pluginRoot(), "scripts", "relay.sh")
}
func (adapter) MapHook(raw map[string]any) []core.Intent {
	return core.ParseHook(core.ParseInput{
		Source:    "agy",
		Title:     "Antigravity CLI",
		Event:     core.FirstString(raw, "hook_event_name", "hookEventName", "event", "name"),
		SessionID: core.FirstString(raw, "conversationId", "conversation_id", "session_id", "sessionId"),
		Cwd:       core.FirstString(raw, "cwd", "Cwd"),
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
	return filepath.Join(core.UserHomeDir(), ".gemini", "antigravity-cli", "plugins", core.PluginName)
}

func legacyHooksJSON() string {
	return filepath.Join(core.UserHomeDir(), ".gemini", "antigravity-cli", "hooks.json")
}

func install(ctx core.InstallCtx) (core.InstallResult, error) {
	root := pluginRoot()
	if err := os.MkdirAll(filepath.Join(root, "scripts"), 0o755); err != nil {
		return core.InstallResult{CLI: "agy"}, err
	}
	relay := filepath.Join(root, "scripts", "relay.sh")
	if err := core.WritePluginRelay(relay, ctx.DataDir, ctx.Token, "agy"); err != nil {
		return core.InstallResult{CLI: "agy"}, err
	}
	if err := core.WriteConfigJSON(filepath.Join(root, "plugin.json"), map[string]any{
		"$schema":     "https://antigravity.google/schemas/v1/plugin.json",
		"name":        core.PluginName,
		"version":     core.Version,
		"description": "Connect Antigravity CLI to the Qterm macOS terminal — live status, rename, and app control.",
	}); err != nil {
		return core.InstallResult{CLI: "agy"}, err
	}
	if err := core.WriteConfigJSON(filepath.Join(root, "hooks.json"), hooksConfig(relay)); err != nil {
		return core.InstallResult{CLI: "agy"}, err
	}
	if err := core.WriteConfigJSON(filepath.Join(root, "mcp_config.json"), map[string]any{
		"mcpServers": map[string]any{"qterm": core.QtermMCPServer(ctx.MCPCommand, ctx.DataDir, ctx.Token)},
	}); err != nil {
		return core.InstallResult{CLI: "agy"}, err
	}
	if err := core.WriteQtermSkill(filepath.Join(root, "skills", "qterm-terminal")); err != nil {
		return core.InstallResult{CLI: "agy"}, err
	}

	_ = exec.Command("agy", "plugin", "install", root).Run()
	_ = exec.Command("agy", "plugin", "enable", core.PluginName).Run()
	_ = core.RemoveQtermHooks(legacyHooksJSON())

	return core.InstallResult{
		CLI:       "agy",
		Installed: true,
		Message:   "Installed ~/.gemini/antigravity-cli/plugins/qterm. Restart Antigravity CLI.",
	}, nil
}

// hooksConfig builds Antigravity's named-hook schema.
// Skip PreToolUse so we never risk blocking tool permission decisions.
func hooksConfig(relayPath string) map[string]any {
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

func uninstall() error {
	_ = exec.Command("agy", "plugin", "uninstall", core.PluginName).Run()
	_ = exec.Command("agy", "plugin", "disable", core.PluginName).Run()
	_ = core.RemoveQtermHooks(legacyHooksJSON())
	_ = os.RemoveAll(pluginRoot())
	return nil
}

func pluginInstalled() bool {
	_, err := os.Stat(filepath.Join(pluginRoot(), "plugin.json"))
	return err == nil
}
