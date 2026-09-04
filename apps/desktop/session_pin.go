package main

import (
	"qterm/internal/config"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// SetSessionPinned toggles whether a terminal stays at the top of the sidebar list.
func (a *App) SetSessionPinned(id string, pinned bool) bool {
	if id == "" {
		return false
	}
	if a.pty == nil || !a.pty.SetPinned(id, pinned) {
		return false
	}
	_ = a.store.Update(func(cfg *config.AppConfig) {
		for i := range cfg.Sessions {
			if cfg.Sessions[i].ID == id {
				cfg.Sessions[i].Pinned = pinned
				return
			}
		}
	})
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "sessions:changed", nil)
	}
	return true
}
