package main

import (
	"fmt"
	"os"

	"qterm/internal/agentcli"
	"qterm/internal/agentcli/bridge"
	"qterm/internal/config"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) startAgentBridge() {
	onIntent := func(intent agentcli.Intent) {
		cwd, _ := intent.Payload["cwd"].(string)
		cliID := intent.SessionID
		if sid := a.resolveSessionForAgent(cliID, cwd, intent.TerminalID); sid != "" {
			intent.SessionID = sid
			intent.TerminalID = sid
		}

		if intent.Type == agentcli.IntentAutoTitle {
			name, _ := intent.Payload["name"].(string)
			if intent.SessionID != "" && name != "" {
				_ = a.applyFirstPromptTitle(intent.SessionID, name)
			}
			return
		}
		if intent.Type == agentcli.IntentRename {
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
	srv, err := bridge.NewServer(a.store.DataDir(), onIntent, &bridgeAPI{app: a})
	if err != nil {
		println("agent bridge:", err.Error())
		return
	}
	if err := srv.Start(); err != nil {
		println("agent bridge start:", err.Error())
		return
	}
	a.bridge = srv
	agentcli.RefreshInstalledRelays(a.store.DataDir())
	a.upgradeOutdatedAgentCLIs()
}

func (a *App) ListAgentCLIs() []agentcli.CLIInfo {
	list := agentcli.ListCLIs(a.store.DataDir())
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
			dirty = true
		}
	}
	if dirty || len(next) != len(recorded) {
		_ = a.store.Update(func(cfg *config.AppConfig) {
			cfg.AgentCLIs = next
		})
	}
	return list
}

func (a *App) InstallAgentCLI(id string) (agentcli.InstallResult, error) {
	exe, _ := os.Executable()
	result, err := agentcli.Install(id, a.store.DataDir(), exe)
	if err != nil {
		return result, err
	}
	_ = a.store.Update(func(cfg *config.AppConfig) {
		if cfg.AgentCLIs == nil {
			cfg.AgentCLIs = map[string]string{}
		}
		cfg.AgentCLIs[id] = agentcli.PluginVersion()
	})
	result.Installed = true
	if result.Message == "" {
		result.Message = "Connected (plugin " + agentcli.PluginVersion() + ")"
	}
	return result, nil
}

func (a *App) UninstallAgentCLI(id string) error {
	if err := agentcli.Uninstall(id, a.store.DataDir()); err != nil {
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

func (a *App) upgradeOutdatedAgentCLIs() {
	for _, cli := range a.ListAgentCLIs() {
		if !cli.Installed || !cli.Outdated {
			continue
		}
		if _, err := a.InstallAgentCLI(cli.ID); err != nil {
			println("agent plugin upgrade:", cli.ID, err.Error())
			continue
		}
		println("agent plugin upgraded:", cli.ID, "→", agentcli.PluginVersion())
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
