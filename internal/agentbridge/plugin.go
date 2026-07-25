package agentbridge

import (
	"fmt"
	"os/exec"
)

// InstallCtx is shared state for plugin install/uninstall (relay path, token, MCP binary).
type InstallCtx struct {
	DataDir    string
	RelayPath  string
	Token      string
	MCPCommand string
}

// Plugin is one agent CLI integration. Install/uninstall/relay paths are
// function fields so adding a CLI does not require editing central switches.
type Plugin struct {
	ID       string
	Name     string
	Binaries []string
	Source   string // relay.sh arg + /v1/hooks/{source}

	CheckInstalled func() bool
	DoInstall      func(InstallCtx) (InstallResult, error)
	DoUninstall    func(InstallCtx) error
	RelayPath      func() string // absolute path to this plugin's relay.sh
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
	if p.CheckInstalled == nil {
		return false
	}
	return p.CheckInstalled()
}

func (p Plugin) Info(dataDir string) CLIInfo {
	info := CLIInfo{ID: p.ID, Name: p.Name, ExpectedVersion: qtermPluginVersion}
	if path, ok := p.IsCLIAvailable(); ok {
		info.Available = true
		info.Path = path
	}
	info.Installed = p.IsInstalled(dataDir)
	return info
}

// ApplyConnectionVersion stamps the recorded connect version onto CLIInfo and marks outdated.
// Empty recorded version while installed means a pre-versioning connect — treat as outdated.
func (info *CLIInfo) ApplyConnectionVersion(recorded string) {
	info.ExpectedVersion = qtermPluginVersion
	if !info.Installed {
		info.Version = ""
		info.Outdated = false
		return
	}
	info.Version = recorded
	info.Outdated = recorded != qtermPluginVersion
}

func (p Plugin) Install(ctx InstallCtx) (InstallResult, error) {
	if _, ok := p.IsCLIAvailable(); !ok {
		return InstallResult{CLI: p.ID}, fmt.Errorf("%s CLI not found on PATH — install it first", p.Name)
	}
	if ctx.RelayPath == "" || ctx.Token == "" {
		return InstallResult{CLI: p.ID}, fmt.Errorf("install context incomplete")
	}
	if p.DoInstall == nil {
		return InstallResult{CLI: p.ID}, fmt.Errorf("unknown agent CLI %q", p.ID)
	}
	return p.DoInstall(ctx)
}

func (p Plugin) Uninstall(ctx InstallCtx) error {
	if p.DoUninstall == nil {
		return fmt.Errorf("unknown agent CLI %q", p.ID)
	}
	return p.DoUninstall(ctx)
}

// MapHook parses a CLI hook payload into Qterm UI intents.
func (p Plugin) MapHook(raw map[string]any) []Intent {
	event := firstString(raw, "hook_event_name", "hookEventName", "event", "name")
	sessionID := firstString(raw, "session_id", "sessionId", "GEMINI_SESSION_ID", "conversationId", "conversation_id")
	cwd := firstString(raw, "cwd", "Cwd", "GEMINI_CWD")
	if cwd == "" && raw != nil {
		if paths, ok := raw["workspacePaths"].([]any); ok && len(paths) > 0 {
			if s, ok := paths[0].(string); ok {
				cwd = s
			}
		}
	}
	return ParseHook(ParseInput{
		Source:    p.Source,
		Title:     p.Name,
		Event:     event,
		SessionID: sessionID,
		Cwd:       cwd,
		Raw:       raw,
	})
}
