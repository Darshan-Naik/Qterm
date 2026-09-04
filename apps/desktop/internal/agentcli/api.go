package agentcli

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"qterm/internal/agentcli/cli/agy"
	"qterm/internal/agentcli/cli/claude"
	"qterm/internal/agentcli/cli/codex"
	"qterm/internal/agentcli/cli/cursor"
	"qterm/internal/agentcli/cli/gemini"
	"qterm/internal/agentcli/core"
)

// Re-export core types used by the app / Wails bindings.
type (
	Adapter       = core.Adapter
	CLIInfo       = core.CLIInfo
	InstallCtx    = core.InstallCtx
	InstallResult = core.InstallResult
	Session       = core.Session
	AgentSession  = core.Session // Wails / UI name
	SessionQuery  = core.SessionQuery
	ResumeSpec    = core.ResumeSpec
	Intent        = core.Intent
	ToolKind      = core.ToolKind
	ToolItem      = core.ToolItem
	ToolsCaps     = core.ToolsCaps
)

const (
	ToolKindPlugin      = core.ToolKindPlugin
	ToolKindSkill       = core.ToolKindSkill
	ToolKindMarketplace = core.ToolKindMarketplace
	ToolKindMCP         = core.ToolKindMCP
	ToolKindExtension   = core.ToolKindExtension
)

const (
	IntentAnimate   = core.IntentAnimate
	IntentRename    = core.IntentRename
	IntentAutoTitle = core.IntentAutoTitle
)

func PluginVersion() string { return core.PluginVersion() }

// EnsureUserPath merges login-shell / Homebrew paths into PATH for GUI launches.
func EnsureUserPath() { core.EnsureUserPath() }

// All returns every registered CLI adapter.
func All() []core.Adapter {
	return []core.Adapter{
		claude.New(),
		codex.New(),
		gemini.New(),
		agy.New(),
		cursor.New(),
	}
}

// Find returns an adapter by id.
func Find(id string) (core.Adapter, bool) {
	for _, a := range All() {
		if a.ID() == id {
			return a, true
		}
	}
	return nil, false
}

// FindBySource returns an adapter by hook source id.
func FindBySource(source string) (core.Adapter, bool) {
	for _, a := range All() {
		if a.ID() == source {
			return a, true
		}
	}
	return nil, false
}

// ListCLIs returns settings rows for every adapter.
func ListCLIs(dataDir string) []core.CLIInfo {
	out := make([]core.CLIInfo, 0, 8)
	for _, a := range All() {
		info := core.CLIInfo{ID: a.ID(), Name: a.Name(), ExpectedVersion: core.PluginVersion()}
		if path, ok := a.Available(); ok {
			info.Available = true
			info.Path = path
		}
		info.Installed = a.Installed()
		out = append(out, info)
	}
	return out
}

// Install connects a CLI plugin.
func Install(id, dataDir, mcpCommand string) (core.InstallResult, error) {
	a, ok := Find(id)
	if !ok {
		return core.InstallResult{CLI: id}, fmt.Errorf("unknown agent CLI %q", id)
	}
	token, err := core.LoadOrCreateToken(dataDir)
	if err != nil {
		return core.InstallResult{CLI: id}, err
	}
	_ = core.WriteEndpoint(dataDir, core.DefaultPort, token)
	relay, err := writeSharedRelay(dataDir, token)
	if err != nil {
		return core.InstallResult{CLI: id}, err
	}
	return a.Install(core.InstallCtx{
		DataDir:    dataDir,
		RelayPath:  relay,
		Token:      token,
		MCPCommand: mcpCommand,
	})
}

// Uninstall disconnects a CLI plugin.
func Uninstall(id, dataDir string) error {
	a, ok := Find(id)
	if !ok {
		return fmt.Errorf("unknown agent CLI %q", id)
	}
	if err := a.Uninstall(core.InstallCtx{DataDir: dataDir}); err != nil {
		return err
	}
	still := false
	for _, other := range All() {
		if other.ID() != id && other.Installed() {
			still = true
			break
		}
	}
	if !still {
		_ = os.Remove(filepath.Join(core.ScriptsDir(dataDir), "relay.sh"))
	}
	return nil
}

// RefreshInstalledRelays rewrites hook relays for every connected CLI.
func RefreshInstalledRelays(dataDir string) {
	token, err := core.LoadOrCreateToken(dataDir)
	if err != nil {
		return
	}
	_, _ = writeSharedRelay(dataDir, token)
	for _, a := range All() {
		if !a.Installed() {
			continue
		}
		if p := a.RelayPath(); p != "" {
			_ = core.WritePluginRelay(p, dataDir, token, a.ID())
		}
	}
}

// ListSessions aggregates on-disk history from connected (installed) CLI adapters only.
// Disconnect a CLI in settings to hide its sessions from search.
func ListSessions(dataDir string, q core.SessionQuery) []core.Session {
	limit := core.NormalizeLimit(q.Limit)
	out := make([]core.Session, 0, limit)
	for _, a := range All() {
		if q.CLI != "" && a.ID() != q.CLI {
			continue
		}
		if !a.Installed() {
			continue
		}
		sessions, err := a.ListSessions(core.SessionQuery{Query: q.Query, Limit: limit})
		if err != nil || len(sessions) == 0 {
			continue
		}
		out = append(out, sessions...)
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Score != out[j].Score {
			return out[i].Score > out[j].Score
		}
		return out[i].UpdatedAt > out[j].UpdatedAt
	})
	if len(out) > limit {
		out = out[:limit]
	}
	return out
}

// Resume asks the CLI adapter for the shell command to continue a session.
func Resume(cliID, sessionID string) (core.ResumeSpec, error) {
	a, ok := Find(cliID)
	if !ok {
		return core.ResumeSpec{}, fmt.Errorf("unknown agent CLI %q", cliID)
	}
	if sessionID == "" {
		return core.ResumeSpec{}, fmt.Errorf("missing session id")
	}
	return a.Resume(sessionID)
}

func asTooling(id string) (core.Tooling, core.Adapter, error) {
	a, ok := Find(id)
	if !ok {
		return nil, nil, fmt.Errorf("unknown agent CLI %q", id)
	}
	t, ok := a.(core.Tooling)
	if !ok {
		return nil, a, core.ErrToolsUnsupported
	}
	return t, a, nil
}

// GetToolsCaps returns management capabilities for a CLI (empty caps if unsupported).
func GetToolsCaps(id string) (core.ToolsCaps, error) {
	t, _, err := asTooling(id)
	if err != nil {
		if err == core.ErrToolsUnsupported {
			return core.ToolsCaps{}, nil
		}
		return core.ToolsCaps{}, err
	}
	return t.ToolsCaps(), nil
}

// ListTools returns installed/registered tools for a connected CLI.
func ListTools(id string) ([]core.ToolItem, error) {
	t, a, err := asTooling(id)
	if err != nil {
		if err == core.ErrToolsUnsupported {
			return nil, nil
		}
		return nil, err
	}
	if !a.Installed() {
		return nil, fmt.Errorf("%s is not connected — connect it in Settings first", a.Name())
	}
	return t.ListTools()
}

// InstallTool installs a plugin/skill/marketplace from a source string.
func InstallTool(id string, kind core.ToolKind, source string) error {
	t, a, err := asTooling(id)
	if err != nil {
		return err
	}
	if !a.Installed() {
		return fmt.Errorf("%s is not connected — connect it in Settings first", a.Name())
	}
	if _, ok := a.Available(); !ok {
		return fmt.Errorf("%s CLI not found on PATH", a.Name())
	}
	source = strings.TrimSpace(source)
	if source == "" {
		return fmt.Errorf("missing install source")
	}
	caps := t.ToolsCaps()
	if !caps.Install {
		return fmt.Errorf("%s: install not supported", a.Name())
	}
	return t.InstallTool(kind, source)
}

// UninstallTool removes a plugin/skill/marketplace (not the qterm bridge).
func UninstallTool(id string, kind core.ToolKind, toolID string) error {
	t, a, err := asTooling(id)
	if err != nil {
		return err
	}
	if !a.Installed() {
		return fmt.Errorf("%s is not connected — connect it in Settings first", a.Name())
	}
	if err := core.GuardQtermSystem(toolID); err != nil {
		return err
	}
	caps := t.ToolsCaps()
	if !caps.Uninstall {
		return fmt.Errorf("%s: uninstall not supported", a.Name())
	}
	return t.UninstallTool(kind, toolID)
}

// SetToolEnabled enables or disables a tool (not the qterm bridge).
func SetToolEnabled(id string, kind core.ToolKind, toolID string, enabled bool) error {
	t, a, err := asTooling(id)
	if err != nil {
		return err
	}
	if !a.Installed() {
		return fmt.Errorf("%s is not connected — connect it in Settings first", a.Name())
	}
	if !enabled {
		if err := core.GuardQtermSystem(toolID); err != nil {
			return err
		}
	}
	caps := t.ToolsCaps()
	if !caps.Enable {
		return fmt.Errorf("%s: enable/disable not supported", a.Name())
	}
	return t.SetToolEnabled(kind, toolID, enabled)
}

// UpdateTool updates a plugin/extension/marketplace (not the qterm bridge).
func UpdateTool(id string, kind core.ToolKind, toolID string) error {
	t, a, err := asTooling(id)
	if err != nil {
		return err
	}
	if !a.Installed() {
		return fmt.Errorf("%s is not connected — connect it in Settings first", a.Name())
	}
	if err := core.GuardQtermSystem(toolID); err != nil {
		return err
	}
	caps := t.ToolsCaps()
	if !caps.Update {
		return fmt.Errorf("%s: update not supported", a.Name())
	}
	return t.UpdateTool(kind, toolID)
}

func writeSharedRelay(dataDir, token string) (string, error) {
	relay := filepath.Join(core.ScriptsDir(dataDir), "relay.sh")
	if err := os.WriteFile(relay, []byte(core.RelayScriptBody(dataDir, token, "")), 0o755); err != nil {
		return "", err
	}
	return relay, nil
}
