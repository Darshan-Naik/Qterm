package main

import (
	"fmt"
	"strings"
	"time"

	"qterm/internal/agentcli"
	"qterm/internal/config"
	"qterm/internal/notify"
	"qterm/internal/osc133"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) initNotify() {
	a.poster = notify.New()
	a.waiting = map[string]struct{}{}
	a.lastNeeds = map[string]time.Time{}
	a.poster.SetOnActivate(func(sessionID string) {
		a.revealWindow()
		if sessionID != "" && a.ctx != nil {
			runtime.EventsEmit(a.ctx, "app:focus-session", sessionID)
		}
	})
	a.poster.RequestAuth()
}

func (a *App) initShellTracker() {
	a.shells = osc133.NewTracker(func(sessionID string, res osc133.Result) {
		a.maybeNotifyCommand(sessionID, res)
	})
}

func (a *App) emitHookIntent(intent agentcli.Intent) {
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "hook:intent", intent)
	}
	a.maybeNotifyAgent(intent)
}

func (a *App) maybeNotifyAgent(intent agentcli.Intent) {
	if intent.Type != agentcli.IntentAnimate {
		return
	}
	state, _ := intent.Payload["state"].(string)
	sid := intent.SessionID
	if sid == "" {
		return
	}
	switch state {
	case "action_required":
		a.markWaiting(sid, true)
		a.notifyKind(notify.KindNeedsInput, sid, "needs input", "An agent is waiting in this terminal.")
	case "task_complete":
		a.markWaiting(sid, false)
		a.notifyKind(notify.KindTaskComplete, sid, "finished", "The agent finished a turn.")
	default:
		if state == "none" || state == "thinking" || state == "idle" {
			a.markWaiting(sid, false)
		}
	}
}

func (a *App) maybeNotifyCommand(sessionID string, res osc133.Result) {
	if a.store == nil || !config.NotifyCommandEnabled(a.store.Get()) {
		return
	}
	min := config.ClampNotifyCommandMinSec(a.store.Get().NotifyCommandMinSec)
	if !notify.CommandLongEnough(res.Duration, min) {
		return
	}
	secs := int(res.Duration.Round(time.Second) / time.Second)
	body := fmt.Sprintf("Ran for %d seconds.", secs)
	if res.ExitCode > 0 {
		body = fmt.Sprintf("Exited %d after %d seconds.", res.ExitCode, secs)
	}
	a.notifyKind(notify.KindCommandDone, sessionID, "command finished", body)
}

func (a *App) notifyKind(kind notify.Kind, sessionID, titleSuffix, body string) {
	if a.poster == nil || a.store == nil {
		return
	}
	cfg := a.store.Get()
	enabled := config.NotifyAgentEnabled(cfg)
	if kind == notify.KindCommandDone {
		enabled = config.NotifyCommandEnabled(cfg)
	}
	var last time.Time
	if kind == notify.KindNeedsInput {
		a.waitingMu.Lock()
		last = a.lastNeeds[sessionID]
		a.waitingMu.Unlock()
	}
	if !notify.Should(notify.Decision{
		Kind:      kind,
		SessionID: sessionID,
		AppActive: a.poster.AppActive(),
		FocusedID: a.focusedSessionID,
		Enabled:   enabled,
		LastSent:  last,
		Now:       time.Now(),
	}) {
		return
	}
	name := a.sessionNotifyName(sessionID)
	a.poster.Post(notify.Note{
		ID:        fmt.Sprintf("%s-%s-%d", kind, sessionID, time.Now().UnixNano()),
		Title:     name + " " + titleSuffix,
		Body:      body,
		SessionID: sessionID,
	})
	if kind == notify.KindNeedsInput {
		a.waitingMu.Lock()
		a.lastNeeds[sessionID] = time.Now()
		a.waitingMu.Unlock()
	}
}

func (a *App) sessionNotifyName(id string) string {
	if a.pty != nil {
		if s, ok := a.pty.Get(id); ok && strings.TrimSpace(s.Name) != "" {
			return s.Name
		}
	}
	return "Qterm"
}

func (a *App) markWaiting(sessionID string, on bool) {
	a.waitingMu.Lock()
	if a.waiting == nil {
		a.waiting = map[string]struct{}{}
	}
	if on {
		a.waiting[sessionID] = struct{}{}
	} else {
		delete(a.waiting, sessionID)
		delete(a.lastNeeds, sessionID)
	}
	n := len(a.waiting)
	if a.focusedSessionID != "" {
		if _, ok := a.waiting[a.focusedSessionID]; ok {
			n--
		}
	}
	a.waitingMu.Unlock()
	if n < 0 {
		n = 0
	}
	if a.poster != nil {
		a.poster.SetBadge(n)
	}
}

func (a *App) refreshBadge() {
	a.waitingMu.Lock()
	n := len(a.waiting)
	if a.focusedSessionID != "" {
		if _, ok := a.waiting[a.focusedSessionID]; ok {
			n--
		}
	}
	a.waitingMu.Unlock()
	if n < 0 {
		n = 0
	}
	if a.poster != nil {
		a.poster.SetBadge(n)
	}
}

func (a *App) revealWindow() {
	if a.ctx == nil {
		return
	}
	a.windowMu.Lock()
	a.windowHidden = false
	a.windowMu.Unlock()
	runtime.WindowShow(a.ctx)
	runtime.WindowUnminimise(a.ctx)
	if a.poster != nil {
		a.poster.BringToFront()
	}
}

func (a *App) toggleWindow() {
	if a.ctx == nil {
		return
	}
	if a.poster != nil && !a.poster.AppActive() {
		a.revealWindow()
		return
	}
	a.windowMu.Lock()
	hidden := a.windowHidden
	a.windowMu.Unlock()
	if hidden || runtime.WindowIsMinimised(a.ctx) {
		a.revealWindow()
		return
	}
	a.windowMu.Lock()
	a.windowHidden = true
	a.windowMu.Unlock()
	runtime.WindowHide(a.ctx)
}

// SaveNotifyPrefs persists agent/command notification toggles.
func (a *App) SaveNotifyPrefs(agent, command bool, minSec int) error {
	minSec = config.ClampNotifyCommandMinSec(minSec)
	return a.store.Update(func(cfg *config.AppConfig) {
		cfg.NotifyAgent = boolPtr(agent)
		cfg.NotifyCommand = boolPtr(command)
		cfg.NotifyCommandMinSec = minSec
	})
}

func boolPtr(v bool) *bool { return &v }

// CopyLastCommandOutput copies the last OSC 133 command output to the clipboard.
func (a *App) CopyLastCommandOutput(id string) (string, error) {
	if a.shells == nil {
		return "", fmt.Errorf("no command output yet")
	}
	res, ok := a.shells.Last(id)
	if !ok || strings.TrimSpace(res.Output) == "" {
		return "", fmt.Errorf("no command output yet")
	}
	if a.ctx != nil {
		_ = runtime.ClipboardSetText(a.ctx, res.Output)
	}
	return res.Output, nil
}
