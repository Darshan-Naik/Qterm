package main

import (
	"context"
	goruntime "runtime"
	"strings"
	"time"

	"qterm/internal/appmode"
	"qterm/internal/config"
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
