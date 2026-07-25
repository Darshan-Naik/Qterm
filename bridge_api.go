package main

import (
	"fmt"
	"os"

	"qterm/internal/agentbridge"
	"qterm/internal/config"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) startAgentBridge() {
	onIntent := func(intent agentbridge.Intent) {
		cwd, _ := intent.Payload["cwd"].(string)
		cliID := intent.SessionID
		// Prefer PTY-injected QTERM_SESSION_ID (via hook header) over focus heuristics.
		if sid := a.resolveSessionForAgent(cliID, cwd, intent.TerminalID); sid != "" {
			intent.SessionID = sid
			intent.TerminalID = sid
		}

		if intent.Type == agentbridge.IntentAutoTitle {
			name, _ := intent.Payload["name"].(string)
			if intent.SessionID != "" && name != "" {
				_ = a.applyFirstPromptTitle(intent.SessionID, name)
			}
			return
		}
		if intent.Type == agentbridge.IntentRename {
			name, _ := intent.Payload["name"].(string)
			if intent.SessionID != "" && name != "" {
				_ = a.applyHookSessionTitle(intent.SessionID, name)
			}
			return
		}
		if a.ctx == nil {
			return
		}
		runtime.EventsEmit(a.ctx, "hook:intent", intent)
	}
	srv, err := agentbridge.NewServer(a.store.DataDir(), onIntent, &bridgeAPI{app: a})
	if err != nil {
		println("agent bridge:", err.Error())
		return
	}
	if err := srv.Start(); err != nil {
		println("agent bridge start:", err.Error())
		return
	}
	a.bridge = srv
	// Rewrite installed plugin relays so in-app-only gating ships without reconnect.
	agentbridge.RefreshInstalledRelays(a.store.DataDir())
	// Full reinstall when the app's plugin version moved past what was last connected.
	a.upgradeOutdatedAgentCLIs()
}

func (a *App) ListAgentCLIs() []agentbridge.CLIInfo {
	list := agentbridge.ListPlugins(a.store.DataDir())
	recorded := a.store.Get().AgentCLIs
	if recorded == nil {
		recorded = map[string]string{}
	}
	dirty := false
	next := map[string]string{}
	for i := range list {
		ver := recorded[list[i].ID]
		list[i].ApplyConnectionVersion(ver)
		if list[i].Installed {
			if ver != "" {
				next[list[i].ID] = ver
			}
		} else if _, ok := recorded[list[i].ID]; ok {
			dirty = true // disk gone but config still lists it
		}
	}
	if dirty || len(next) != len(recorded) {
		_ = a.store.Update(func(cfg *config.AppConfig) {
			cfg.AgentCLIs = next
		})
	}
	return list
}

func (a *App) InstallAgentCLI(id string) (agentbridge.InstallResult, error) {
	exe, _ := os.Executable()
	result, err := agentbridge.InstallPlugin(id, a.store.DataDir(), exe)
	if err != nil {
		return result, err
	}
	_ = a.store.Update(func(cfg *config.AppConfig) {
		if cfg.AgentCLIs == nil {
			cfg.AgentCLIs = map[string]string{}
		}
		cfg.AgentCLIs[id] = agentbridge.PluginVersion()
	})
	result.Installed = true
	if result.Message == "" {
		result.Message = "Connected (plugin " + agentbridge.PluginVersion() + ")"
	}
	return result, nil
}

func (a *App) UninstallAgentCLI(id string) error {
	if err := agentbridge.UninstallPlugin(id, a.store.DataDir()); err != nil {
		return err
	}
	_ = a.store.Update(func(cfg *config.AppConfig) {
		if cfg.AgentCLIs == nil {
			return
		}
		delete(cfg.AgentCLIs, id)
	})
	return nil
}

// upgradeOutdatedAgentCLIs reinstalls connected plugins whose recorded version
// lags the app's current qtermPluginVersion (hooks/MCP/skills/relay changes).
func (a *App) upgradeOutdatedAgentCLIs() {
	for _, cli := range a.ListAgentCLIs() {
		if !cli.Installed || !cli.Outdated {
			continue
		}
		if _, err := a.InstallAgentCLI(cli.ID); err != nil {
			println("agent plugin upgrade:", cli.ID, err.Error())
			continue
		}
		println("agent plugin upgraded:", cli.ID, "→", agentbridge.PluginVersion())
	}
}

type bridgeAPI struct{ app *App }

func (b *bridgeAPI) CreateTerminal(projectID, name, cwd string) (map[string]any, error) {
	projectID, cwd = b.app.resolveCreateTerminalTarget(projectID, cwd)
	sess, err := b.app.CreateSession(projectID, name, cwd)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"id": sess.ID, "name": sess.Name, "projectId": sess.ProjectID, "cwd": sess.Cwd,
	}, nil
}

func (b *bridgeAPI) RenameTerminal(id, name string) error {
	id = b.app.resolveSessionForAgent(id, "", id)
	if id == "" {
		return fmt.Errorf("no agent terminal — call get_terminal_id first, or open an agent in a pane")
	}
	// MCP rename is intentional — allowed even after a user rename.
	// Only first-prompt / hook auto-titles respect nameLocked.
	if looksLikeAgentStatusTitle(name) {
		return fmt.Errorf("refusing status title %q", name)
	}
	if !b.app.renameSession(id, name, renameAgent) {
		return fmt.Errorf("session not found")
	}
	return nil
}

func (b *bridgeAPI) ListTerminals() ([]map[string]any, error) {
	list := b.app.ListSessions()
	out := make([]map[string]any, 0, len(list))
	for _, s := range list {
		out = append(out, map[string]any{
			"id": s.ID, "name": s.Name, "projectId": s.ProjectID, "cwd": s.Cwd,
		})
	}
	return out, nil
}

func (b *bridgeAPI) GetTerminal(id string) (map[string]any, error) {
	// id may be QTERM_SESSION_ID from MCP env, or empty → sticky agent pane.
	resolved := b.app.resolveSessionForAgent("", "", id)
	if resolved == "" {
		return nil, fmt.Errorf("could not identify this terminal — is the agent running inside a Qterm pane?")
	}
	s, ok := b.app.pty.Get(resolved)
	if !ok {
		return nil, fmt.Errorf("session not found")
	}
	return map[string]any{
		"id": s.ID, "name": s.Name, "projectId": s.ProjectID, "cwd": s.Cwd,
	}, nil
}

func (b *bridgeAPI) CreateProject(path, name string) (map[string]any, error) {
	p, err := b.app.AddProject(path, name)
	if err != nil {
		return nil, err
	}
	return map[string]any{"id": p.ID, "name": p.Name, "path": p.Path}, nil
}

func (b *bridgeAPI) RenameProject(id, name string) error {
	return b.app.RenameProject(id, name)
}

func (b *bridgeAPI) ListProjects() ([]map[string]any, error) {
	list := b.app.ListProjects()
	out := make([]map[string]any, 0, len(list))
	for _, p := range list {
		out = append(out, map[string]any{"id": p.ID, "name": p.Name, "path": p.Path})
	}
	return out, nil
}

func (b *bridgeAPI) SetTheme(theme string) error {
	if err := b.app.SaveTheme(theme); err != nil {
		return err
	}
	if b.app.ctx != nil {
		runtime.EventsEmit(b.app.ctx, "app:theme", theme)
	}
	return nil
}

func (b *bridgeAPI) GetTheme() string {
	return b.app.GetConfig().Theme
}

func (b *bridgeAPI) FocusSession(id string) error {
	id = b.app.resolveSessionForAgent(id, "", id)
	if id == "" {
		return fmt.Errorf("session not found")
	}
	if _, ok := b.app.pty.Get(id); !ok {
		return fmt.Errorf("session not found")
	}
	b.app.focusedSessionID = id
	if b.app.ctx != nil {
		runtime.EventsEmit(b.app.ctx, "app:focus-session", id)
	}
	return nil
}
