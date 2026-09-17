package main

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"qterm/internal/agentcli"
	"qterm/internal/config"
	"qterm/internal/notify"
	"qterm/internal/osc133"
	"qterm/internal/oscnotify"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func (a *App) initNotify() {
	a.poster = notify.New()
	a.waiting = map[string]struct{}{}
	a.waitingAt = map[string]time.Time{}
	a.attentionText = map[string]string{}
	a.lastNeeds = map[string]time.Time{}
	a.poster.SetOnActivate(func(sessionID string) {
		a.revealWindow()
		if sessionID != "" && a.ctx != nil {
			runtime.EventsEmit(a.ctx, "app:focus-session", sessionID)
		}
	})
	a.poster.SetOnActiveChange(func() {
		a.refreshBadge()
	})
	a.poster.RequestAuth()
}

func (a *App) initShellTracker() {
	a.shells = osc133.NewTracker(func(sessionID string, res osc133.Result) {
		a.maybeNotifyCommand(sessionID, res)
	})
	a.oscNotes = oscnotify.NewTracker(func(sessionID string, ev oscnotify.Event) {
		a.onOSCNotify(sessionID, ev)
	})
}

func (a *App) onOSCNotify(sessionID string, ev oscnotify.Event) {
	title := strings.TrimSpace(ev.Title)
	body := strings.TrimSpace(ev.Body)
	if body == "" {
		return
	}
	a.noteAttention(sessionID, title, body)
	a.notifyKind(notify.KindNeedsInput, sessionID, titleOr(title, "needs input"), body)
}

func titleOr(title, fallback string) string {
	if strings.TrimSpace(title) != "" {
		return title
	}
	return fallback
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
		msg := "An agent is waiting in this terminal."
		a.setAttentionText(sid, msg)
		a.notifyKind(notify.KindNeedsInput, sid, "needs input", msg)
	case "task_complete":
		a.markWaiting(sid, false)
		a.clearAttentionText(sid)
		a.notifyKind(notify.KindTaskComplete, sid, "finished", "The agent finished a turn.")
	default:
		if state == "none" || state == "thinking" || state == "idle" {
			a.markWaiting(sid, false)
			if state == "none" {
				a.clearAttentionText(sid)
			}
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
	if a.waitingAt == nil {
		a.waitingAt = map[string]time.Time{}
	}
	if on {
		a.waiting[sessionID] = struct{}{}
		a.waitingAt[sessionID] = time.Now()
	} else {
		delete(a.waiting, sessionID)
		delete(a.waitingAt, sessionID)
		delete(a.lastNeeds, sessionID)
	}
	n, focusedWaiting := a.waitingSnapshotLocked()
	a.waitingMu.Unlock()
	if a.poster != nil {
		a.poster.SetBadge(notify.BadgeCount(n, focusedWaiting, a.appIsFront()))
	}
}

// noteAttention marks a pane as needing attention and updates sidebar notice text.
func (a *App) noteAttention(sessionID, title, body string) {
	if sessionID == "" {
		return
	}
	text := strings.TrimSpace(body)
	if text == "" {
		text = strings.TrimSpace(title)
	}
	if text == "" {
		text = "needs attention"
	}
	a.markWaiting(sessionID, true)
	a.setAttentionText(sessionID, text)
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "hook:intent", agentcli.Intent{
			ID:        "notify-" + sessionID,
			HookID:    "notify",
			SessionID: sessionID,
			Type:      agentcli.IntentAnimate,
			Payload: map[string]any{
				"state": "action_required",
				"text":  text,
			},
		})
	}
}

func (a *App) setAttentionText(sessionID, text string) {
	a.waitingMu.Lock()
	if a.attentionText == nil {
		a.attentionText = map[string]string{}
	}
	a.attentionText[sessionID] = text
	a.waitingMu.Unlock()
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "session:notice", map[string]any{
			"sessionId": sessionID,
			"text":      text,
		})
	}
}

func (a *App) clearAttentionText(sessionID string) {
	a.waitingMu.Lock()
	delete(a.attentionText, sessionID)
	a.waitingMu.Unlock()
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "session:notice", map[string]any{
			"sessionId": sessionID,
			"text":      "",
		})
	}
}

func (a *App) listUnread() []map[string]any {
	a.waitingMu.Lock()
	defer a.waitingMu.Unlock()
	out := make([]map[string]any, 0, len(a.waiting))
	for id := range a.waiting {
		item := map[string]any{"sessionId": id}
		if t, ok := a.waitingAt[id]; ok {
			item["at"] = t.UTC().Format(time.RFC3339Nano)
		}
		if text := a.attentionText[id]; text != "" {
			item["text"] = text
		}
		if a.pty != nil {
			if s, ok := a.pty.Get(id); ok {
				item["name"] = s.Name
			}
		}
		out = append(out, item)
	}
	sort.Slice(out, func(i, j int) bool {
		ai, _ := out[i]["at"].(string)
		aj, _ := out[j]["at"].(string)
		return ai > aj
	})
	return out
}

func (a *App) jumpUnread() string {
	list := a.listUnread()
	if len(list) == 0 {
		return ""
	}
	id, _ := list[0]["sessionId"].(string)
	return id
}

func (a *App) refreshBadge() {
	a.waitingMu.Lock()
	n, focusedWaiting := a.waitingSnapshotLocked()
	a.waitingMu.Unlock()
	if a.poster != nil {
		a.poster.SetBadge(notify.BadgeCount(n, focusedWaiting, a.appIsFront()))
	}
}

func (a *App) waitingSnapshotLocked() (waiting int, focusedWaiting bool) {
	waiting = len(a.waiting)
	if a.focusedSessionID != "" {
		_, focusedWaiting = a.waiting[a.focusedSessionID]
	}
	return waiting, focusedWaiting
}

func (a *App) appIsFront() bool {
	if a.poster == nil {
		return false
	}
	a.windowMu.Lock()
	hidden := a.windowHidden
	a.windowMu.Unlock()
	return a.poster.AppActive() && !hidden
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
	a.refreshBadge()
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
	a.refreshBadge()
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
