package agentbridge

import (
	"fmt"
	"os/exec"
	"strings"
)

// InstallCtx is shared state for plugin install/uninstall (relay path, token, MCP binary).
type InstallCtx struct {
	DataDir    string
	RelayPath  string
	Token      string
	MCPCommand string
}

// Plugin is one agent CLI integration.
type Plugin struct {
	ID       string
	Name     string
	Binaries []string
	Source   string // relay.sh arg + /v1/hooks/{source}

	EventAliases   map[string]string
	ExtractEvent   func(raw map[string]any) string
	ExtractSession func(raw map[string]any) string
}

func (p Plugin) IsCLIAvailable() (path string, ok bool) {
	for _, bin := range p.Binaries {
		if path, err := exec.LookPath(bin); err == nil {
			return path, true
		}
	}
	return "", false
}

func (p Plugin) IsInstalled(dataDir string) bool {
	switch p.ID {
	case "codex":
		return codexPluginInstalled()
	case "claude":
		return claudePluginInstalled()
	case "gemini":
		return geminiExtensionInstalled()
	case "agy":
		return agyPluginInstalled()
	case "cursor":
		return cursorPluginInstalled()
	default:
		return false
	}
}

func (p Plugin) Info(dataDir string) CLIInfo {
	info := CLIInfo{ID: p.ID, Name: p.Name}
	if path, ok := p.IsCLIAvailable(); ok {
		info.Available = true
		info.Path = path
	}
	info.Installed = p.IsInstalled(dataDir)
	return info
}

func (p Plugin) Install(ctx InstallCtx) (InstallResult, error) {
	if _, ok := p.IsCLIAvailable(); !ok {
		return InstallResult{CLI: p.ID}, fmt.Errorf("%s CLI not found on PATH — install it first", p.Name)
	}
	if ctx.RelayPath == "" || ctx.Token == "" {
		return InstallResult{CLI: p.ID}, fmt.Errorf("install context incomplete")
	}
	switch p.ID {
	case "codex":
		return installCodexPlugin(ctx)
	case "claude":
		return installClaudePlugin(ctx)
	case "gemini":
		return installGeminiExtension(ctx)
	case "agy":
		return installAgyPlugin(ctx)
	case "cursor":
		return installCursorPlugin(ctx)
	default:
		return InstallResult{CLI: p.ID}, fmt.Errorf("unknown agent CLI %q", p.ID)
	}
}

func (p Plugin) Uninstall(ctx InstallCtx) error {
	switch p.ID {
	case "codex":
		return uninstallCodexPlugin()
	case "claude":
		return uninstallClaudePlugin()
	case "gemini":
		return uninstallGeminiExtension()
	case "agy":
		return uninstallAgyPlugin()
	case "cursor":
		return uninstallCursorPlugin()
	default:
		return fmt.Errorf("unknown agent CLI %q", p.ID)
	}
}

// MapHook parses a CLI hook payload into Qterm UI intents.
func (p Plugin) MapHook(raw map[string]any) []Intent {
	event := ""
	if p.ExtractEvent != nil {
		event = p.ExtractEvent(raw)
	} else {
		event = firstString(raw, "hook_event_name", "hookEventName", "event", "name")
	}
	sessionID := ""
	if p.ExtractSession != nil {
		sessionID = p.ExtractSession(raw)
	} else {
		sessionID = firstString(raw, "session_id", "sessionId", "GEMINI_SESSION_ID")
	}
	if alias, ok := p.EventAliases[event]; ok {
		event = alias
	} else if alias, ok := p.EventAliases[strings.ToLower(event)]; ok {
		event = alias
	}
	cwd := firstString(raw, "cwd", "Cwd", "GEMINI_CWD")
	return ParseHook(ParseInput{
		Source:    p.Source,
		Title:     p.Name,
		Event:     event,
		SessionID: sessionID,
		Cwd:       cwd,
		Raw:       raw,
	})
}
