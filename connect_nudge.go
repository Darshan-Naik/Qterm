package main

import (
	"time"

	"qterm/internal/agentcli"
	"qterm/internal/procs"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// Connect nudges cannot use agent hooks: hooks only exist after Connect, so an
// unconnected CLI is invisible to the bridge. On new terminal we queue a few
// delayed process-tree checks (10s / 20s / 50s) for that session only.

var connectNudgeDelays = []time.Duration{10 * time.Second, 20 * time.Second, 50 * time.Second}

// ConnectNudge is emitted when a terminal is running an agent CLI that isn't connected.
type ConnectNudge struct {
	CLI       string `json:"cli"`
	CLIName   string `json:"cliName"`
	SessionID string `json:"sessionId"`
}

// enqueueConnectNudgeChecks schedules 10s / 20s / 50s scans for one new terminal.
func (a *App) enqueueConnectNudgeChecks(sessionID string) {
	if sessionID == "" {
		return
	}
	a.nudgeMu.Lock()
	if a.nudgeTimers == nil {
		a.nudgeTimers = map[string][]*time.Timer{}
	}
	// Cancel any prior queue for this session (shouldn't happen, but be safe).
	for _, t := range a.nudgeTimers[sessionID] {
		t.Stop()
	}
	timers := make([]*time.Timer, 0, len(connectNudgeDelays))
	sid := sessionID
	for _, d := range connectNudgeDelays {
		delay := d
		timers = append(timers, time.AfterFunc(delay, func() {
			a.scanConnectNudgeSession(sid)
		}))
	}
	a.nudgeTimers[sessionID] = timers
	a.nudgeMu.Unlock()
}

func (a *App) cancelConnectNudgeChecks(sessionID string) {
	a.nudgeMu.Lock()
	defer a.nudgeMu.Unlock()
	for _, t := range a.nudgeTimers[sessionID] {
		t.Stop()
	}
	delete(a.nudgeTimers, sessionID)
	if a.nudgeSeen != nil {
		prefix := sessionID + "\x00"
		for key := range a.nudgeSeen {
			if len(key) >= len(prefix) && key[:len(prefix)] == prefix {
				delete(a.nudgeSeen, key)
			}
		}
	}
}

func (a *App) scanConnectNudgeSession(sessionID string) {
	if a.ctx == nil || a.shuttingDown || a.pty == nil || sessionID == "" {
		return
	}

	shellPID, ok := a.pty.ShellPID(sessionID)
	if !ok || shellPID <= 0 {
		return
	}

	all, err := procs.List()
	if err != nil || len(all) == 0 {
		return
	}

	clis := a.ListAgentCLIs()
	byID := make(map[string]agentcli.CLIInfo, len(clis))
	for _, c := range clis {
		byID[c.ID] = c
	}

	kids := procs.Descendants(shellPID, all)
	adapters := agentcli.All()

	a.nudgeMu.Lock()
	defer a.nudgeMu.Unlock()
	if a.nudgeSeen == nil {
		a.nudgeSeen = map[string]struct{}{}
	}

	for _, ad := range adapters {
		info := byID[ad.ID()]
		if !info.Available || info.Installed {
			continue
		}
		matched := false
		for _, kid := range kids {
			if procs.MatchBinary(kid, ad.Binaries()) {
				matched = true
				break
			}
		}
		if !matched {
			continue
		}
		key := sessionID + "\x00" + ad.ID()
		if _, ok := a.nudgeSeen[key]; ok {
			continue
		}
		a.nudgeSeen[key] = struct{}{}
		runtime.EventsEmit(a.ctx, "agent:connect-nudge", ConnectNudge{
			CLI:       ad.ID(),
			CLIName:   ad.Name(),
			SessionID: sessionID,
		})
	}
}
