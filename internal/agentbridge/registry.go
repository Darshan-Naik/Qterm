package agentbridge

import (
	"os"
	"path/filepath"
)

// Registry is the list of supported agent CLIs.
var Registry = []Plugin{
	{
		ID: "claude", Name: "Claude Code", Binaries: []string{"claude"}, Source: "claude",
		CheckInstalled: claudePluginInstalled,
		DoInstall:      installClaudePlugin,
		DoUninstall:    func(InstallCtx) error { return uninstallClaudePlugin() },
		RelayPath:      func() string { return filepath.Join(claudePluginRoot(), "hooks", "relay.sh") },
	},
	{
		ID: "codex", Name: "Codex", Binaries: []string{"codex"}, Source: "codex",
		CheckInstalled: codexPluginInstalled,
		DoInstall:      installCodexPlugin,
		DoUninstall:    func(InstallCtx) error { return uninstallCodexPlugin() },
		RelayPath:      func() string { return filepath.Join(codexPluginRoot(), "hooks", "relay.sh") },
	},
	{
		ID: "gemini", Name: "Gemini CLI", Binaries: []string{"gemini"}, Source: "gemini",
		CheckInstalled: geminiExtensionInstalled,
		DoInstall:      installGeminiExtension,
		DoUninstall:    func(InstallCtx) error { return uninstallGeminiExtension() },
		RelayPath:      func() string { return filepath.Join(geminiExtensionRoot(), "hooks", "relay.sh") },
	},
	{
		ID: "agy", Name: "Antigravity CLI", Binaries: []string{"agy", "antigravity"}, Source: "agy",
		CheckInstalled: agyPluginInstalled,
		DoInstall:      installAgyPlugin,
		DoUninstall:    func(InstallCtx) error { return uninstallAgyPlugin() },
		RelayPath:      func() string { return filepath.Join(agyPluginRoot(), "scripts", "relay.sh") },
	},
	{
		ID: "cursor", Name: "Cursor Agent", Binaries: []string{"cursor-agent"}, Source: "cursor",
		CheckInstalled: cursorPluginInstalled,
		DoInstall:      installCursorPlugin,
		DoUninstall:    func(InstallCtx) error { return uninstallCursorPlugin() },
		RelayPath:      func() string { return filepath.Join(cursorPluginRoot(), "scripts", "relay.sh") },
	},
}

func FindPlugin(id string) (Plugin, bool) {
	for _, p := range Registry {
		if p.ID == id {
			return p, true
		}
	}
	return Plugin{}, false
}

func FindBySource(source string) (Plugin, bool) {
	for _, p := range Registry {
		if p.Source == source || p.ID == source {
			return p, true
		}
	}
	return Plugin{}, false
}

func ListPlugins(dataDir string) []CLIInfo {
	out := make([]CLIInfo, 0, len(Registry))
	for _, p := range Registry {
		out = append(out, p.Info(dataDir))
	}
	return out
}

// InstallPlugin prepares shared relay/token then delegates to the plugin.
func InstallPlugin(id, dataDir, mcpCommand string) (InstallResult, error) {
	p, ok := FindPlugin(id)
	if !ok {
		return InstallResult{CLI: id}, fmtUnavailable(id)
	}
	token, err := LoadOrCreateToken(dataDir)
	if err != nil {
		return InstallResult{CLI: id}, err
	}
	_ = WriteEndpoint(dataDir, DefaultPort, token)
	relay, err := writeRelayScript(dataDir, token)
	if err != nil {
		return InstallResult{CLI: id}, err
	}
	return p.Install(InstallCtx{
		DataDir:    dataDir,
		RelayPath:  relay,
		Token:      token,
		MCPCommand: mcpCommand,
	})
}

// UninstallPlugin delegates to the plugin, then drops shared relay if unused.
func UninstallPlugin(id, dataDir string) error {
	p, ok := FindPlugin(id)
	if !ok {
		return fmtUnavailable(id)
	}
	if err := p.Uninstall(InstallCtx{DataDir: dataDir}); err != nil {
		return err
	}
	still := false
	for _, other := range Registry {
		if other.ID != id && other.IsInstalled(dataDir) {
			still = true
			break
		}
	}
	if !still {
		_ = os.Remove(filepath.Join(ScriptsDir(dataDir), "relay.sh"))
	}
	return nil
}

// RefreshInstalledRelays rewrites hook relay scripts for every installed CLI plugin
// so gating fixes (e.g. QTERM_SESSION_ID early-exit) apply without requiring reconnect.
func RefreshInstalledRelays(dataDir string) {
	token, err := LoadOrCreateToken(dataDir)
	if err != nil {
		return
	}
	_, _ = writeRelayScript(dataDir, token)
	for _, p := range Registry {
		if !p.IsInstalled(dataDir) || p.RelayPath == nil {
			continue
		}
		_ = writePluginRelay(p.RelayPath(), dataDir, token, p.Source)
	}
}

func fmtUnavailable(id string) error {
	return &pluginError{msg: "unknown agent CLI plugin \"" + id + "\""}
}

type pluginError struct{ msg string }

func (e *pluginError) Error() string { return e.msg }
