package agentbridge

import (
	"os"
	"os/exec"
	"path/filepath"
)

// Gemini CLI extension at ~/.gemini/extensions/qterm/
// https://github.com/google-gemini/gemini-cli/blob/main/docs/extensions/reference.md

func geminiExtensionRoot() string {
	return filepath.Join(userHomeDir(), ".gemini", "extensions", qtermPluginName)
}

func geminiSettingsJSON() string {
	return filepath.Join(userHomeDir(), ".gemini", "settings.json")
}

func installGeminiExtension(ctx InstallCtx) (InstallResult, error) {
	root := geminiExtensionRoot()
	if err := os.MkdirAll(filepath.Join(root, "hooks"), 0o755); err != nil {
		return InstallResult{CLI: "gemini"}, err
	}
	if err := writePluginRelay(filepath.Join(root, "hooks", "relay.sh"), ctx.DataDir, ctx.Token, "gemini"); err != nil {
		return InstallResult{CLI: "gemini"}, err
	}
	if err := writeConfigJSON(filepath.Join(root, "gemini-extension.json"), map[string]any{
		"name":        qtermPluginName,
		"version":     qtermPluginVersion,
		"description": "Connect Gemini CLI to the Qterm macOS terminal — live status, rename, and app control.",
		"mcpServers": map[string]any{
			"qterm": qtermMCPServer(ctx.MCPCommand, ctx.DataDir, ctx.Token),
		},
	}); err != nil {
		return InstallResult{CLI: "gemini"}, err
	}

	events := []string{
		"SessionStart", "SessionEnd", "BeforeAgent", "AfterAgent",
		"BeforeTool", "AfterTool", "Notification",
	}
	hooks := nestedCommandHooks(events, `bash "${extensionPath}/hooks/relay.sh" gemini`, nil, map[string]any{
		"name":    "qterm-bridge",
		"timeout": 5000,
	})
	if err := writeConfigJSON(filepath.Join(root, "hooks", "hooks.json"), map[string]any{"hooks": hooks}); err != nil {
		return InstallResult{CLI: "gemini"}, err
	}
	if err := writeQtermSkill(filepath.Join(root, "skills", "qterm-terminal")); err != nil {
		return InstallResult{CLI: "gemini"}, err
	}
	_ = os.WriteFile(filepath.Join(root, "GEMINI.md"), []byte(
		"# Qterm\n\nUse the Qterm MCP `rename_terminal` tool to rename this terminal. Do not use printf/OSC title hacks.\n",
	), 0o644)

	_ = exec.Command("gemini", "extensions", "enable", qtermPluginName).Run()
	_ = removeQtermHooks(geminiSettingsJSON())

	return InstallResult{
		CLI:       "gemini",
		Installed: true,
		Message:   "Installed ~/.gemini/extensions/qterm (hooks + MCP). Restart Gemini CLI.",
	}, nil
}

func uninstallGeminiExtension() error {
	_ = exec.Command("gemini", "extensions", "uninstall", qtermPluginName).Run()
	_ = exec.Command("gemini", "extensions", "disable", qtermPluginName).Run()
	_ = removeQtermHooks(geminiSettingsJSON())
	_ = os.RemoveAll(geminiExtensionRoot())
	return nil
}

func geminiExtensionInstalled() bool {
	_, err := os.Stat(filepath.Join(geminiExtensionRoot(), "gemini-extension.json"))
	return err == nil
}
