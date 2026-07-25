package agentbridge

import (
	"os"
	"path/filepath"
)

// Registry is the list of supported agent CLIs.
var Registry = []Plugin{
	{ID: "claude", Name: "Claude Code", Binaries: []string{"claude"}, Source: "claude"},
	{ID: "codex", Name: "Codex", Binaries: []string{"codex"}, Source: "codex"},
	{ID: "gemini", Name: "Gemini CLI", Binaries: []string{"gemini"}, Source: "gemini"},
	{ID: "agy", Name: "Antigravity CLI", Binaries: []string{"agy", "antigravity"}, Source: "agy"},
	{ID: "cursor", Name: "Cursor Agent", Binaries: []string{"cursor-agent"}, Source: "cursor"},
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

func fmtUnavailable(id string) error {
	return &pluginError{msg: "unknown agent CLI plugin \"" + id + "\""}
}

type pluginError struct{ msg string }

func (e *pluginError) Error() string { return e.msg }
