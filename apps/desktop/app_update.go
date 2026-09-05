package main

import (
	"context"
	"fmt"
	"os"
	"strings"
	"sync"
	"time"

	"qterm/internal/appmode"
	"qterm/internal/config"
	"qterm/internal/procs"
	"qterm/internal/update"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	appUpdateNotifyDelay   = 4 * time.Second
	appUpdateProgressEvent = "app:update-progress"
)

type appUpdateDL struct {
	mu      sync.Mutex
	prog    update.Progress
	cancel  context.CancelFunc
	lastPub time.Time
}

func (a *App) updateDL() *appUpdateDL {
	if a == nil {
		return nil
	}
	if a.upd == nil {
		a.upd = &appUpdateDL{}
	}
	return a.upd
}

func (a *App) updateContext() context.Context {
	if a != nil && a.ctx != nil {
		return a.ctx
	}
	return context.Background()
}

func (a *App) skippedAppUpdate() string {
	if a != nil && a.store != nil {
		return a.store.Get().SkippedAppUpdate
	}
	return ""
}

func (a *App) checkAppUpdate() (update.Status, error) {
	current := appmode.AppVersion
	c := update.Default()
	c.UA = "Qterm/" + current
	st, err := c.Check(a.updateContext(), current, a.skippedAppUpdate())
	if err != nil {
		return st, err
	}
	return overlayUpdateProgress(a, st), nil
}

// CheckForAppUpdate compares this build to the latest GitHub Release.
func (a *App) CheckForAppUpdate() (update.Status, error) {
	st, err := a.checkAppUpdate()
	if err != nil {
		return st, err
	}
	if st.Available && !st.Skipped && update.IsInstallerURL(st.DownloadURL) {
		go a.startAppUpdateDownload(st)
	}
	return st, nil
}

func overlayUpdateProgress(a *App, st update.Status) update.Status {
	if path, ok := update.CachedReady(st.LatestVersion); ok {
		st.State = update.StateReady
		if info, err := os.Stat(path); err == nil {
			st.Bytes = info.Size()
			st.Total = info.Size()
		}
	}
	if a == nil {
		return st
	}
	dl := a.updateDL()
	if dl == nil {
		return st
	}
	dl.mu.Lock()
	p := dl.prog
	dl.mu.Unlock()
	if p.State == "" {
		return st
	}
	if p.Version != "" && st.LatestVersion != "" && update.Normalize(p.Version) != update.Normalize(st.LatestVersion) {
		return st
	}
	st.State = p.State
	st.Bytes = p.Bytes
	st.Total = p.Total
	st.Error = p.Error
	return st
}

// SkipAppUpdate records a version the user does not want to be prompted about.
// Empty version clears the skip.
func (a *App) SkipAppUpdate(version string) error {
	if a == nil || a.store == nil {
		return nil
	}
	version = update.Normalize(strings.TrimSpace(version))
	if version != "" {
		a.cancelAppUpdateDownload()
	}
	return a.store.Update(func(cfg *config.AppConfig) {
		cfg.SkippedAppUpdate = version
	})
}

// StartAppUpdateDownload begins a background DMG fetch. Off the PTY path.
func (a *App) StartAppUpdateDownload() error {
	st, err := a.checkAppUpdate()
	if err != nil {
		return err
	}
	if !st.Available {
		return nil
	}
	a.startAppUpdateDownload(st)
	return nil
}

// ApplyAppUpdateAndRestart replaces this Mac app from the downloaded DMG after quit.
func (a *App) ApplyAppUpdateAndRestart() error {
	if a == nil {
		return nil
	}
	version := a.currentUpdateVersion()
	if version == "" {
		st, err := a.checkAppUpdate()
		if err != nil {
			return err
		}
		version = st.LatestVersion
	}
	path, ok := update.CachedReady(version)
	if !ok {
		return fmt.Errorf("The update is still downloading")
	}
	if err := update.ApplyAndRelaunch(path); err != nil {
		return err
	}
	if a.ctx != nil {
		runtime.Quit(a.ctx)
	}
	return nil
}

func (a *App) currentUpdateVersion() string {
	dl := a.updateDL()
	if dl == nil {
		return ""
	}
	dl.mu.Lock()
	defer dl.mu.Unlock()
	return dl.prog.Version
}

func (a *App) startAppUpdateDownload(st update.Status) {
	if a == nil || !st.Available || !update.IsInstallerURL(st.DownloadURL) || a.shuttingDown {
		return
	}
	if path, ok := update.CachedReady(st.LatestVersion); ok {
		info, _ := os.Stat(path)
		p := update.Progress{Version: st.LatestVersion, State: update.StateReady}
		if info != nil {
			p.Bytes = info.Size()
			p.Total = info.Size()
		}
		a.publishUpdateProgress(p)
		return
	}
	dl := a.updateDL()
	if dl == nil {
		return
	}
	dl.mu.Lock()
	if dl.prog.State == update.StateDownloading && update.Normalize(dl.prog.Version) == update.Normalize(st.LatestVersion) {
		dl.mu.Unlock()
		return
	}
	if dl.cancel != nil {
		dl.cancel()
		dl.cancel = nil
	}
	ctx, cancel := context.WithCancel(a.updateContext())
	dl.cancel = cancel
	dl.prog = update.Progress{Version: st.LatestVersion, State: update.StateDownloading}
	dl.mu.Unlock()

	a.emitUpdateProgress(update.Progress{Version: st.LatestVersion, State: update.StateDownloading})

	go func() {
		dest, err := update.CacheFile(st.LatestVersion)
		if err != nil {
			a.publishUpdateProgress(update.Progress{Version: st.LatestVersion, State: update.StateError, Error: err.Error()})
			return
		}
		err = update.Download(ctx, st.DownloadURL, dest, func(bytes, total int64) {
			a.publishUpdateProgress(update.Progress{
				Version: st.LatestVersion,
				State:   update.StateDownloading,
				Bytes:   bytes,
				Total:   total,
			})
		})
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			a.publishUpdateProgress(update.Progress{Version: st.LatestVersion, State: update.StateError, Error: err.Error()})
			return
		}
		p := update.Progress{Version: st.LatestVersion, State: update.StateReady}
		if info, err := os.Stat(dest); err == nil {
			p.Bytes = info.Size()
			p.Total = info.Size()
		}
		a.publishUpdateProgress(p)
	}()
}

func (a *App) cancelAppUpdateDownload() {
	dl := a.updateDL()
	if dl == nil {
		return
	}
	dl.mu.Lock()
	if dl.cancel != nil {
		dl.cancel()
		dl.cancel = nil
	}
	dl.prog = update.Progress{}
	dl.mu.Unlock()
}

func (a *App) publishUpdateProgress(p update.Progress) {
	dl := a.updateDL()
	if dl == nil {
		return
	}
	now := time.Now()
	dl.mu.Lock()
	stateChange := dl.prog.State != p.State || dl.prog.Error != p.Error
	if p.State == update.StateDownloading && !stateChange && !dl.lastPub.IsZero() && now.Sub(dl.lastPub) < 200*time.Millisecond {
		dl.prog = p
		dl.mu.Unlock()
		return
	}
	dl.prog = p
	dl.lastPub = now
	dl.mu.Unlock()
	a.emitUpdateProgress(p)
}

func (a *App) emitUpdateProgress(p update.Progress) {
	if a == nil || a.ctx == nil || a.shuttingDown {
		return
	}
	runtime.EventsEmit(a.ctx, appUpdateProgressEvent, p)
}

// BusyTerminal is a live PTY with a non-shell child process.
type BusyTerminal struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Commands []string `json:"commands"`
}

// UpdateRisk describes running terminal work that restarting to update would kill.
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
		if !ok {
			continue
		}
		cmds := procs.ActiveCommands(pid, all)
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

func (a *App) notifyAppUpdate() {
	timer := time.NewTimer(appUpdateNotifyDelay)
	defer timer.Stop()
	select {
	case <-timer.C:
	case <-a.updateContext().Done():
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
