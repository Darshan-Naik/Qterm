package main

import (
	"fmt"
	"os"

	"qterm/internal/agentbridge"

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

		if intent.Type == "rename" {
			name, _ := intent.Payload["name"].(string)
			if intent.SessionID != "" && name != "" {
				_ = a.adoptSessionTitle(intent.SessionID, name)
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
}

func (a *App) ListAgentCLIs() []agentbridge.CLIInfo {
	return agentbridge.ListPlugins(a.store.DataDir())
}

func (a *App) InstallAgentCLI(id string) (agentbridge.InstallResult, error) {
	exe, _ := os.Executable()
	return agentbridge.InstallPlugin(id, a.store.DataDir(), exe)
}

func (a *App) UninstallAgentCLI(id string) error {
	return agentbridge.UninstallPlugin(id, a.store.DataDir())
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
	if b.app.isNameLocked(id) {
		return fmt.Errorf("terminal name was set by the user — auto rename skipped")
	}
	if !b.app.adoptSessionTitle(id, name) {
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
