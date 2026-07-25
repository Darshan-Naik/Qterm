package main

import (
	"path/filepath"
	"strings"

	"qterm/internal/config"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Rename lanes (intentional — do not collapse):
//
//	renameUser   — UI rename; sets nameLocked (blocks auto/hook titles)
//	renameAuto   — first-prompt + hook session_title; skipped when nameLocked
//	renameSystem — bootstrap / system fix; apply, leave lock unchanged
//	renameAgent  — MCP rename_terminal; always apply, clears nameLocked
type renameMode int

const (
	renameUser renameMode = iota
	renameAuto
	renameSystem
	renameAgent
)

// RenameSession is the Wails entrypoint for a user (UI) rename.
func (a *App) RenameSession(id, name string) bool {
	return a.renameSession(id, name, renameUser)
}

// SetSessionName updates a terminal name without locking (bootstrap / system fixes).
func (a *App) SetSessionName(id, name string) bool {
	return a.renameSession(id, name, renameSystem)
}

// applyFirstPromptTitle sets the tab name once from the first user prompt hook.
// Skipped when the user locked the name or an auto/agent title was already applied.
func (a *App) applyFirstPromptTitle(id, name string) bool {
	name = strings.TrimSpace(name)
	if name == "" || a.isNameLocked(id) || a.isAutoTitled(id) {
		return false
	}
	if !shouldAdoptAutoTitle(name) || a.titleMatchesSessionContext(id, name) {
		return false
	}
	if !a.renameSession(id, name, renameAuto) {
		return false
	}
	a.markAutoTitled(id)
	return true
}

// applyHookSessionTitle applies an explicit CLI session title from hooks
// (/rename, customTitle). Respects nameLocked — unlike MCP rename_terminal.
func (a *App) applyHookSessionTitle(id, name string) bool {
	if looksLikeAgentStatusTitle(name) {
		if sess, ok := a.pty.Get(id); ok && looksLikeAgentStatusTitle(sess.Name) {
			if cleaned := stripAgentStatusTitle(sess.Name); cleaned != "" && cleaned != sess.Name {
				if a.renameSession(id, cleaned, renameAuto) {
					a.markAutoTitled(id)
					return true
				}
			}
		}
		return false
	}
	if looksLikeShellTitle(name) {
		return false
	}
	if a.titleMatchesSessionContext(id, name) {
		return false
	}
	// Explicit titles may be short single tokens ("auth") — allow them.
	if a.isNameLocked(id) {
		return false
	}
	if !a.renameSession(id, name, renameAuto) {
		return false
	}
	a.markAutoTitled(id)
	return true
}

// titleMatchesSessionContext is true when the title is just the project or cwd
// folder — already visible in the sidebar, not a useful terminal label.
func (a *App) titleMatchesSessionContext(id, name string) bool {
	name = strings.TrimSpace(name)
	if name == "" {
		return false
	}
	sess, ok := a.pty.Get(id)
	if !ok {
		return false
	}
	if base := filepath.Base(sess.Cwd); base != "" && base != "." && base != "/" {
		if strings.EqualFold(base, name) {
			return true
		}
	}
	if sess.ProjectID != "" && a.projects != nil {
		if p, ok := a.projects.Get(sess.ProjectID); ok {
			if strings.EqualFold(strings.TrimSpace(p.Name), name) {
				return true
			}
			if base := filepath.Base(p.Path); base != "" && strings.EqualFold(base, name) {
				return true
			}
		}
	}
	return false
}

func (a *App) isAutoTitled(id string) bool {
	if a.store == nil || id == "" {
		return false
	}
	for _, s := range a.store.Get().Sessions {
		if s.ID == id {
			return s.AutoTitled
		}
	}
	return false
}

func (a *App) markAutoTitled(id string) {
	if a.store == nil || id == "" {
		return
	}
	_ = a.store.Update(func(cfg *config.AppConfig) {
		for i := range cfg.Sessions {
			if cfg.Sessions[i].ID == id {
				cfg.Sessions[i].AutoTitled = true
			}
		}
	})
}

func (a *App) isNameLocked(id string) bool {
	if a.store == nil || id == "" {
		return false
	}
	for _, s := range a.store.Get().Sessions {
		if s.ID == id {
			return s.NameLocked
		}
	}
	return false
}

func (a *App) renameSession(id, name string, mode renameMode) bool {
	name = strings.TrimSpace(name)
	if name == "" {
		return false
	}
	// Ignore shell OSC titles like user@host — those are not session labels.
	if looksLikeShellTitle(name) {
		return false
	}
	if id == "" || id == "focused" || id == "current" || id == "." {
		id = a.focusedSessionID
	}
	if id == "" {
		return false
	}
	if mode == renameAuto && a.isNameLocked(id) {
		return false
	}
	if sess, ok := a.pty.Get(id); ok && sess.Name == name {
		_ = a.store.Update(func(cfg *config.AppConfig) {
			for i := range cfg.Sessions {
				if cfg.Sessions[i].ID == id {
					switch mode {
					case renameUser:
						cfg.Sessions[i].NameLocked = true
					case renameAgent:
						cfg.Sessions[i].NameLocked = false
						cfg.Sessions[i].AutoTitled = true
					}
				}
			}
		})
		return true
	}
	ok := a.pty.Rename(id, name)
	if ok {
		_ = a.store.Update(func(cfg *config.AppConfig) {
			for i := range cfg.Sessions {
				if cfg.Sessions[i].ID == id {
					cfg.Sessions[i].Name = name
					switch mode {
					case renameUser:
						cfg.Sessions[i].NameLocked = true
					case renameAgent:
						cfg.Sessions[i].NameLocked = false
						cfg.Sessions[i].AutoTitled = true
					}
				}
			}
		})
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "session:renamed", map[string]any{"id": id, "name": name})
			runtime.EventsEmit(a.ctx, "sessions:changed", nil)
		}
	}
	return ok
}

// looksLikeShellTitle matches typical prompt window titles (user@host[:path]).
func looksLikeShellTitle(name string) bool {
	at := strings.IndexByte(name, '@')
	if at <= 0 || at == len(name)-1 {
		return false
	}
	host := name[at+1:]
	if strings.ContainsAny(host, " \t") {
		return false
	}
	return true
}

// shouldAdoptAutoTitle filters process/folder/status titles that shouldn't
// replace session labels for first-prompt auto-naming.
func shouldAdoptAutoTitle(name string) bool {
	name = strings.TrimSpace(name)
	if name == "" || looksLikeShellTitle(name) || looksLikeAgentStatusTitle(name) {
		return false
	}
	if len(name) > 80 {
		return false
	}
	lower := strings.ToLower(name)
	switch lower {
	case "bash", "zsh", "sh", "fish", "terminal", "qterm", "tmux", "screen",
		"codex", "claude", "claude code", "gemini", "agy", "antigravity",
		"cursor", "cursor-agent", "agent", "node", "python", "python3", "vim", "nvim":
		return false
	}
	// Bare single tokens are almost always the CLI binary or project folder.
	if !strings.ContainsAny(name, " \t") && !strings.Contains(name, "-") {
		return false
	}
	return true
}

// looksLikeAgentStatusTitle matches CLI window chrome (e.g. Claude "Action Required | proj").
// Qterm already shows needs-input via the sidebar dot/animation — don't mirror that text.
func looksLikeAgentStatusTitle(name string) bool {
	lower := strings.ToLower(strings.TrimSpace(name))
	if lower == "" {
		return false
	}
	switch {
	case strings.Contains(lower, "action required"),
		strings.HasPrefix(lower, "needs input"),
		strings.HasPrefix(lower, "waiting for input"),
		strings.HasPrefix(lower, "permission required"),
		strings.HasPrefix(lower, "awaiting"):
		return true
	}
	return false
}

func stripAgentStatusTitle(name string) string {
	if i := strings.LastIndex(name, "|"); i >= 0 {
		rest := strings.TrimSpace(name[i+1:])
		if rest != "" && !looksLikeAgentStatusTitle(rest) {
			return rest
		}
	}
	return ""
}
