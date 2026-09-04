package main

import (
	"path/filepath"
	"strings"

	"qterm/internal/config"
	"qterm/internal/project"
	ptymgr "qterm/internal/pty"
)

func (a *App) ensureAgentMaps() {
	if a.agentBind == nil {
		a.agentBind = map[string]string{}
	}
}

func (a *App) bindAgentSession(cliSessionID, qtermID string) {
	a.agentMu.Lock()
	defer a.agentMu.Unlock()
	a.ensureAgentMaps()
	if cliSessionID != "" && qtermID != "" {
		a.agentBind[cliSessionID] = qtermID
	}
	if qtermID != "" {
		a.agentLastQterm = qtermID
	}
}

func (a *App) lookupAgentBind(cliSessionID string) string {
	a.agentMu.Lock()
	defer a.agentMu.Unlock()
	if a.agentBind == nil || cliSessionID == "" {
		return ""
	}
	return a.agentBind[cliSessionID]
}

func (a *App) clearAgentBind(cliSessionID string) {
	a.agentMu.Lock()
	defer a.agentMu.Unlock()
	if a.agentBind != nil && cliSessionID != "" {
		delete(a.agentBind, cliSessionID)
	}
}

func (a *App) clearAgentBindsForQterm(qtermID string) {
	a.agentMu.Lock()
	defer a.agentMu.Unlock()
	if a.agentBind != nil {
		for k, v := range a.agentBind {
			if v == qtermID {
				delete(a.agentBind, k)
			}
		}
	}
	if a.agentLastQterm == qtermID {
		a.agentLastQterm = ""
	}
}

func (a *App) lastAgentQtermSession() string {
	a.agentMu.Lock()
	defer a.agentMu.Unlock()
	return a.agentLastQterm
}

// syncPersistedAgent records which CLI conversation is live in a terminal so
// app relaunch can resume it. Session-end clears the record (shell is back).
func (a *App) syncPersistedAgent(qtermID, cli, cliSessionID, intentType string, payload map[string]any) {
	if qtermID == "" {
		return
	}
	state := ""
	if payload != nil {
		state, _ = payload["state"].(string)
	}
	if intentType == "animate" && state == "none" {
		a.clearAgentBind(cliSessionID)
		a.persistSessionAgent(qtermID, "", "")
		return
	}
	if cli == "" || cliSessionID == "" {
		return
	}
	a.persistSessionAgent(qtermID, cli, cliSessionID)
}

func (a *App) persistSessionAgent(qtermID, cli, cliSessionID string) {
	if a.store == nil || qtermID == "" {
		return
	}
	cfg := a.store.Get()
	for _, s := range cfg.Sessions {
		if s.ID == qtermID && s.AgentCLI == cli && s.AgentSessionID == cliSessionID {
			return
		}
	}
	_ = a.store.Update(func(cfg *config.AppConfig) {
		for i := range cfg.Sessions {
			if cfg.Sessions[i].ID != qtermID {
				continue
			}
			cfg.Sessions[i].AgentCLI = cli
			cfg.Sessions[i].AgentSessionID = cliSessionID
			return
		}
	})
}

func (a *App) sessionAgentCLI(qtermID string) string {
	if a.store == nil || qtermID == "" {
		return ""
	}
	for _, s := range a.store.Get().Sessions {
		if s.ID == qtermID {
			return s.AgentCLI
		}
	}
	return ""
}

// resolveSessionForAgent maps an agent/CLI session to a Qterm pane.
// Priority: explicit Qterm id (from QTERM_SESSION_ID) → exact id → sticky CLI bind
// → cwd match → last agent pane → focus → newest.
func (a *App) resolveSessionForAgent(sessionID, cwd, explicitQtermID string) string {
	if sessionID == "focused" || sessionID == "current" || sessionID == "." {
		sessionID = ""
	}
	if explicitQtermID == "focused" || explicitQtermID == "current" || explicitQtermID == "." {
		explicitQtermID = ""
	}

	// 0) Authoritative: PTY-injected QTERM_SESSION_ID (Ghostty/iTerm pattern).
	if explicitQtermID != "" {
		if _, ok := a.pty.Get(explicitQtermID); ok {
			a.bindAgentSession(sessionID, explicitQtermID)
			return explicitQtermID
		}
	}

	if sessionID != "" {
		if _, ok := a.pty.Get(sessionID); ok {
			a.bindAgentSession(sessionID, sessionID)
			return sessionID
		}
		if qid := a.lookupAgentBind(sessionID); qid != "" {
			if _, ok := a.pty.Get(qid); ok {
				a.bindAgentSession(sessionID, qid)
				return qid
			}
			a.clearAgentBind(sessionID)
		}
	}

	live := a.pty.List()
	if cwd != "" {
		if id := matchSessionByCwd(live, cwd, a.focusedSessionID); id != "" {
			a.bindAgentSession(sessionID, id)
			return id
		}
	}

	if sessionID == "" {
		if last := a.lastAgentQtermSession(); last != "" {
			if _, ok := a.pty.Get(last); ok {
				a.bindAgentSession("", last)
				return last
			}
		}
	}

	if a.focusedSessionID != "" {
		if _, ok := a.pty.Get(a.focusedSessionID); ok {
			a.bindAgentSession(sessionID, a.focusedSessionID)
			return a.focusedSessionID
		}
	}

	if len(live) == 0 {
		return ""
	}
	newest := live[0]
	for _, s := range live[1:] {
		if s.CreatedAt.After(newest.CreatedAt) {
			newest = s
		}
	}
	a.bindAgentSession(sessionID, newest.ID)
	return newest.ID
}

func matchSessionByCwd(live []*ptymgr.Session, cwd, preferID string) string {
	cwd = filepath.Clean(cwd)
	var candidates []string
	var exact []string
	bestLen := -1
	var best []string
	for _, s := range live {
		sc := filepath.Clean(s.Cwd)
		if sc == "" {
			continue
		}
		if sc == cwd {
			exact = append(exact, s.ID)
			candidates = append(candidates, s.ID)
			continue
		}
		if sessionContainsPath(sc, cwd) {
			candidates = append(candidates, s.ID)
			if len(sc) > bestLen {
				bestLen = len(sc)
				best = []string{s.ID}
			} else if len(sc) == bestLen {
				best = append(best, s.ID)
			}
		}
	}
	pick := func(ids []string) string {
		if preferID != "" {
			for _, id := range ids {
				if id == preferID {
					return id
				}
			}
		}
		if len(ids) > 0 {
			return ids[0]
		}
		return ""
	}
	if id := pick(exact); id != "" {
		return id
	}
	if id := pick(best); id != "" {
		return id
	}
	return pick(candidates)
}

func sessionContainsPath(sessionCwd, path string) bool {
	sessionCwd = filepath.Clean(sessionCwd)
	path = filepath.Clean(path)
	if sessionCwd == path {
		return true
	}
	sep := string(filepath.Separator)
	return strings.HasPrefix(path, sessionCwd+sep)
}

// resolveCreateTerminalTarget fills project/cwd when the agent omits them.
func (a *App) resolveCreateTerminalTarget(projectID, cwd string) (string, string) {
	if projectID != "" && projectID != project.HomeID {
		if p, ok := a.projects.Get(projectID); ok {
			if cwd == "" {
				cwd = p.Path
			}
			return projectID, cwd
		}
		// Agent sometimes passes a filesystem path as projectId.
		if looksLikePath(projectID) {
			abs, err := filepath.Abs(projectID)
			if err == nil {
				if id, pth, ok := a.findProjectByPath(abs); ok {
					if cwd == "" {
						cwd = pth
					}
					return id, cwd
				}
				if cwd == "" {
					cwd = abs
				}
			}
		}
	}

	if cwd != "" {
		if abs, err := filepath.Abs(cwd); err == nil {
			cwd = abs
		}
		if id, _, ok := a.findProjectByPath(cwd); ok {
			return id, cwd
		}
		return project.HomeID, cwd
	}

	if sid := a.lastAgentQtermSession(); sid != "" {
		if s, ok := a.pty.Get(sid); ok {
			return inheritProjectFromSession(s)
		}
	}
	if a.focusedSessionID != "" {
		if s, ok := a.pty.Get(a.focusedSessionID); ok {
			return inheritProjectFromSession(s)
		}
	}
	return project.HomeID, cwd
}

func inheritProjectFromSession(s *ptymgr.Session) (string, string) {
	pid := s.ProjectID
	if pid == "" {
		pid = project.HomeID
	}
	return pid, s.Cwd
}

func looksLikePath(s string) bool {
	return strings.HasPrefix(s, "/") || strings.HasPrefix(s, "~") || strings.Contains(s, string(filepath.Separator))
}

func (a *App) findProjectByPath(path string) (id, projectPath string, ok bool) {
	path = filepath.Clean(path)
	bestLen := -1
	for _, p := range a.projects.List() {
		pp := filepath.Clean(p.Path)
		if pp == path || sessionContainsPath(pp, path) {
			if len(pp) > bestLen {
				bestLen = len(pp)
				id, projectPath, ok = p.ID, p.Path, true
			}
		}
	}
	return id, projectPath, ok
}
