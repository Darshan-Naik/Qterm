package main

import (
	"context"
	goruntime "runtime"
	"strings"
	"time"

	"qterm/internal/appmode"
	"qterm/internal/config"
	"qterm/internal/procs"
	"qterm/internal/update"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const appUpdateNotifyDelay = 4 * time.Second

// CheckForAppUpdate compares this build to the latest GitHub Release.
func (a *App) CheckForAppUpdate() (update.Status, error) {
	current := appmode.AppVersion
	skipped := ""
	if a != nil && a.store != nil {
		skipped = a.store.Get().SkippedAppUpdate
	}
	ctx := context.Background()
	if a != nil && a.ctx != nil {
		ctx = a.ctx
	}
	c := update.Default()
	c.UA = "Qterm/" + current
	return c.Check(ctx, current, skipped, goruntime.GOARCH)
}

// SkipAppUpdate records a version the user does not want to be prompted about.
// Empty version clears the skip.
func (a *App) SkipAppUpdate(version string) error {
	if a == nil || a.store == nil {
		return nil
	}
	version = update.Normalize(strings.TrimSpace(version))
	return a.store.Update(func(cfg *config.AppConfig) {
		cfg.SkippedAppUpdate = version
	})
}

// BusyTerminal is a live PTY with a non-shell child process.
type BusyTerminal struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Commands []string `json:"commands"`
}

// UpdateRisk describes open terminals that quitting to install would kill.
type UpdateRisk struct {
	SessionCount int            `json:"sessionCount"`
	Busy         []BusyTerminal `json:"busy"`
}

// ListUpdateRisk reports live terminals and running child commands. Off the PTY path.
func (a *App) ListUpdateRisk() UpdateRisk {
	risk := UpdateRisk{Busy: []BusyTerminal{}}
	if a == nil || a.pty == nil {
		return risk
	}
	live := a.pty.List()
	risk.SessionCount = len(live)
	if risk.SessionCount == 0 {
		return risk
	}
	all, err := procs.List()
	if err != nil || len(all) == 0 {
		return risk
	}
	for _, s := range live {
		pid, ok := a.pty.ShellPID(s.ID)
		cmds := []string{}
		if ok {
			cmds = append(cmds, procs.ActiveCommands(pid, all)...)
		}
		if cli := a.sessionAgentCLI(s.ID); cli != "" {
			cmds = appendUniqueCmd(cmds, cli)
		}
		if len(cmds) == 0 {
			continue
		}
		name := s.Name
		if name == "" {
			name = "Terminal"
		}
		risk.Busy = append(risk.Busy, BusyTerminal{ID: s.ID, Name: name, Commands: cmds})
	}
	return risk
}

func appendUniqueCmd(cmds []string, name string) []string {
	key := strings.ToLower(strings.TrimSpace(name))
	if key == "" {
		return cmds
	}
	for _, c := range cmds {
		if strings.ToLower(c) == key {
			return cmds
		}
	}
	return append(cmds, name)
}

func (a *App) notifyAppUpdate() {
	timer := time.NewTimer(appUpdateNotifyDelay)
	defer timer.Stop()
	ctx := context.Background()
	if a.ctx != nil {
		ctx = a.ctx
	}
	select {
	case <-timer.C:
	case <-ctx.Done():
		return
	}
	if a.shuttingDown {
		return
	}
	st, err := a.CheckForAppUpdate()
	if err != nil || !st.Available || st.Skipped {
		return
	}
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "app:update-available", st)
	}
}
