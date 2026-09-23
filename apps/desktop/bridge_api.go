package main

import (
	"fmt"
	"os"
	"strings"

	"qterm/internal/agentcli"
	"qterm/internal/agentcli/bridge"
	"qterm/internal/config"
	"qterm/internal/notify"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) startAgentBridge() {
	onIntent := func(intent agentcli.Intent) {
		cwd, _ := intent.Payload["cwd"].(string)
		cliID := intent.SessionID
		if sid := a.resolveSessionForAgent(cliID, cwd, intent.TerminalID); sid != "" {
			a.syncPersistedAgent(sid, intent.HookID, cliID, intent.Type, intent.Payload)
			intent.SessionID = sid
			intent.TerminalID = sid
		}

		if intent.Type == agentcli.IntentAutoTitle {
			name, _ := intent.Payload["name"].(string)
			if intent.SessionID != "" && name != "" {
				_ = a.applyFirstPromptTitle(intent.SessionID, name)
			}
			a.trySlashAutoTitle(intent.SessionID)
			return
		}
		if intent.Type == agentcli.IntentRename {
			source, _ := intent.Payload["source"].(string)
			name, _ := intent.Payload["name"].(string)
			if source == "rename_slash_auto" && intent.SessionID != "" {
				path, _ := intent.Payload["transcriptPath"].(string)
				a.armSlashAutoTitle(intent.SessionID, path)
				return
			}
			if intent.SessionID != "" && name != "" {
				if source == "rename_slash" {
					_ = a.applySlashSessionTitle(intent.SessionID, name)
				} else {
					_ = a.applyHookSessionTitle(intent.SessionID, name)
				}
			}
			a.trySlashAutoTitle(intent.SessionID)
			return
		}
		a.trySlashAutoTitle(intent.SessionID)
		if a.ctx == nil {
			return
		}
		a.emitHookIntent(intent)
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

func (a *App) GetAgentToolsCaps(cliID string) (agentcli.ToolsCaps, error) {
	return agentcli.GetToolsCaps(cliID)
}

func (a *App) ListAgentTools(cliID string) ([]agentcli.ToolItem, error) {
	return agentcli.ListTools(cliID)
}

func (a *App) InstallAgentTool(cliID, kind, source string) error {
	return agentcli.InstallTool(cliID, agentcli.ToolKind(kind), source)
}

func (a *App) UninstallAgentTool(cliID, kind, toolID string) error {
	return agentcli.UninstallTool(cliID, agentcli.ToolKind(kind), toolID)
}

func (a *App) SetAgentToolEnabled(cliID, kind, toolID string, enabled bool) error {
	return agentcli.SetToolEnabled(cliID, agentcli.ToolKind(kind), toolID, enabled)
}

func (a *App) UpdateAgentTool(cliID, kind, toolID string) error {
	return agentcli.UpdateTool(cliID, agentcli.ToolKind(kind), toolID)
}

// upgradeOutdatedAgentCLIs runs on launch after an app update (or any time the
// installed Qterm plugin is older than this build). Connected CLIs get a fresh
// skills, hooks, and MCP package, including copies the CLI cached at install time.
func (a *App) upgradeOutdatedAgentCLIs() {
	if a == nil {
		return
	}
	var names []string
	for _, cli := range a.ListAgentCLIs() {
		if !cli.Installed {
			continue
		}
		if !cli.Outdated && !agentcli.PluginSnapshotsStale(cli.ID) {
			continue
		}
		if _, err := a.InstallAgentCLI(cli.ID); err != nil {
			println("agent plugin upgrade:", cli.ID, err.Error())
			continue
		}
		println("agent plugin upgraded:", cli.ID, "→", agentcli.PluginVersion())
		if cli.Name != "" {
			names = append(names, cli.Name)
		}
	}
	a.notePluginRefresh(names)
}

func (a *App) notePluginRefresh(names []string) {
	if a == nil || len(names) == 0 {
		return
	}
	cp := append([]string{}, names...)
	a.pluginRefreshMu.Lock()
	a.pluginRefresh = cp
	a.pluginRefreshMu.Unlock()
	if a.ctx != nil && !a.shuttingDown {
		runtime.EventsEmit(a.ctx, "app:plugins-refreshed", cp)
	}
}

// ConsumePluginRefresh returns CLI names whose Qterm plugin was refreshed on this
// launch, once. The UI shows that after an update.
func (a *App) ConsumePluginRefresh() []string {
	if a == nil {
		return []string{}
	}
	a.pluginRefreshMu.Lock()
	defer a.pluginRefreshMu.Unlock()
	out := a.pluginRefresh
	a.pluginRefresh = nil
	if out == nil {
		return []string{}
	}
	return out
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
	b.app.SetFocusedSession(id)
	if b.app.ctx != nil {
		runtime.EventsEmit(b.app.ctx, "app:focus-session", id)
	}
	return nil
}

func (b *bridgeAPI) SplitTerminal(id, direction, name string) (map[string]any, error) {
	id = b.app.resolveSessionForAgent(id, "", id)
	if id == "" {
		return nil, fmt.Errorf("session not found")
	}
	src, ok := b.app.pty.Get(id)
	if !ok {
		return nil, fmt.Errorf("session not found")
	}
	dir := strings.ToLower(strings.TrimSpace(direction))
	switch dir {
	case "down", "below", "vertical":
		dir = "down"
	default:
		dir = "right"
	}
	sess, err := b.app.CreateSession(src.ProjectID, strings.TrimSpace(name), src.Cwd)
	if err != nil {
		return nil, err
	}
	if b.app.ctx != nil {
		runtime.EventsEmit(b.app.ctx, "app:split-session", map[string]any{
			"besideId":  id,
			"newId":     sess.ID,
			"name":      sess.Name,
			"projectId": sess.ProjectID,
			"cwd":       sess.Cwd,
			"direction": dir,
		})
	}
	return map[string]any{
		"id": sess.ID, "name": sess.Name, "projectId": sess.ProjectID, "cwd": sess.Cwd, "direction": dir,
	}, nil
}

func (b *bridgeAPI) WriteTerminal(id, data string, submit bool) error {
	id = b.app.resolveSessionForAgent(id, "", id)
	if id == "" {
		return fmt.Errorf("session not found")
	}
	if data == "" && !submit {
		return fmt.Errorf("data is empty")
	}
	if submit && !strings.HasSuffix(data, "\r") && !strings.HasSuffix(data, "\n") {
		data += "\r"
	}
	return b.app.WriteSession(id, data)
}

func (b *bridgeAPI) NotifyUser(title, body, sessionID string, focus bool) error {
	sessionID = b.app.resolveSessionForAgent(sessionID, "", sessionID)
	if strings.TrimSpace(title) == "" {
		title = b.app.sessionNotifyName(sessionID)
	}
	if strings.TrimSpace(body) == "" {
		body = "An agent needs you in Qterm."
	}
	b.app.noteAttention(sessionID, title, body)
	if b.app.poster != nil {
		b.app.poster.Post(notify.Note{
			ID:        "mcp-" + sessionID,
			Title:     title,
			Body:      body,
			SessionID: sessionID,
		})
	}
	if focus {
		b.app.revealWindow()
		if sessionID != "" && b.app.ctx != nil {
			runtime.EventsEmit(b.app.ctx, "app:focus-session", sessionID)
		}
	}
	return nil
}

func (b *bridgeAPI) ListUnread() ([]map[string]any, error) {
	return b.app.listUnread(), nil
}

func (b *bridgeAPI) JumpUnread() (map[string]any, error) {
	id := b.app.jumpUnread()
	if id == "" {
		return map[string]any{"ok": true, "id": ""}, nil
	}
	if err := b.FocusSession(id); err != nil {
		return nil, err
	}
	return map[string]any{"ok": true, "id": id}, nil
}

func (b *bridgeAPI) OpenPathInIDE(path, sessionID string) error {
	path = strings.TrimSpace(path)
	if path == "" {
		sessionID = b.app.resolveSessionForAgent(sessionID, "", sessionID)
		if sessionID != "" {
			if s, ok := b.app.pty.Get(sessionID); ok {
				path = s.Cwd
			}
		}
	}
	return b.app.OpenInIDE(path)
}
