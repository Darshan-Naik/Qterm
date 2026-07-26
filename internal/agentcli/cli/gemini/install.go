package gemini

import (
	"os"
	"os/exec"
	"path/filepath"

	"qterm/internal/agentcli/core"
)

// Gemini CLI extension at ~/.gemini/extensions/qterm/
// https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/reference.md

type adapter struct{}

// New returns the Gemini CLI adapter.
func New() core.Adapter { return adapter{} }

func (adapter) ID() string         { return "gemini" }
func (adapter) Name() string       { return "Gemini CLI" }
func (adapter) Binaries() []string { return []string{"gemini"} }
func (a adapter) Available() (string, bool) {
	return core.LookPath(a.Binaries())
}
func (adapter) Installed() bool { return extensionInstalled() }
func (adapter) RelayPath() string {
	return filepath.Join(extensionRoot(), "hooks", "relay.sh")
}
func (adapter) MapHook(raw map[string]any) []core.Intent {
	return core.ParseHook(core.ParseInput{
		Source:    "gemini",
		Title:     "Gemini CLI",
		Event:     core.FirstString(raw, "hook_event_name", "hookEventName", "event", "name"),
		SessionID: core.FirstString(raw, "session_id", "sessionId", "GEMINI_SESSION_ID"),
		Cwd:       core.FirstString(raw, "cwd", "Cwd", "GEMINI_CWD"),
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

func extensionRoot() string {
	return filepath.Join(core.UserHomeDir(), ".gemini", "extensions", core.PluginName)
}

func settingsJSON() string {
	return filepath.Join(core.UserHomeDir(), ".gemini", "settings.json")
}

func install(ctx core.InstallCtx) (core.InstallResult, error) {
	root := extensionRoot()
	if err := os.MkdirAll(filepath.Join(root, "hooks"), 0o755); err != nil {
		return core.InstallResult{CLI: "gemini"}, err
	}
	if err := core.WritePluginRelay(filepath.Join(root, "hooks", "relay.sh"), ctx.DataDir, ctx.Token, "gemini"); err != nil {
		return core.InstallResult{CLI: "gemini"}, err
	}
	if err := core.WriteConfigJSON(filepath.Join(root, "gemini-extension.json"), map[string]any{
		"name":        core.PluginName,
		"version":     core.Version,
		"description": "Connect Gemini CLI to the Qterm macOS terminal — live status, rename, and app control.",
		"mcpServers": map[string]any{
			"qterm": core.QtermMCPServer(ctx.MCPCommand, ctx.DataDir, ctx.Token),
		},
	}); err != nil {
		return core.InstallResult{CLI: "gemini"}, err
	}

	events := []string{
		"SessionStart", "SessionEnd", "BeforeAgent", "AfterAgent",
		"BeforeTool", "AfterTool", "Notification",
	}
	hooks := core.NestedCommandHooks(events, `bash "${extensionPath}/hooks/relay.sh" gemini`, nil, map[string]any{
		"name":    "qterm-bridge",
		"timeout": 5000,
	})
	if err := core.WriteConfigJSON(filepath.Join(root, "hooks", "hooks.json"), map[string]any{"hooks": hooks}); err != nil {
		return core.InstallResult{CLI: "gemini"}, err
	}
	if err := core.WriteQtermSkill(filepath.Join(root, "skills", "qterm-terminal")); err != nil {
		return core.InstallResult{CLI: "gemini"}, err
	}
	_ = os.WriteFile(filepath.Join(root, "GEMINI.md"), []byte(
		"# Qterm\n\nUse the Qterm MCP `rename_terminal` tool to rename this terminal. Do not use printf/OSC title hacks.\n",
	), 0o644)

	_ = exec.Command("gemini", "extensions", "enable", core.PluginName).Run()
	_ = core.RemoveQtermHooks(settingsJSON())

	return core.InstallResult{
		CLI:       "gemini",
		Installed: true,
		Message:   "Installed ~/.gemini/extensions/qterm (hooks + MCP). Restart Gemini CLI.",
	}, nil
}

func uninstall() error {
	_ = exec.Command("gemini", "extensions", "uninstall", core.PluginName).Run()
	_ = exec.Command("gemini", "extensions", "disable", core.PluginName).Run()
	_ = core.RemoveQtermHooks(settingsJSON())
	_ = os.RemoveAll(extensionRoot())
	return nil
}

func extensionInstalled() bool {
	_, err := os.Stat(filepath.Join(extensionRoot(), "gemini-extension.json"))
	return err == nil
}
