package main

import (
	"strings"

	"qterm/internal/config"
	"qterm/internal/globhotkey"
)

func (a *App) initGlobalHotkey() {
	chord := globhotkey.Default()
	if a.store != nil {
		if c := a.store.Get().GlobalHotkey; c != nil && strings.TrimSpace(c.Key) != "" {
			chord = *c
		}
	}
	_ = globhotkey.Register(chord, func() {
		a.toggleWindow()
	})
}

// SaveGlobalHotkey registers a system-wide show/hide chord. Empty key resets to default.
func (a *App) SaveGlobalHotkey(chord config.KeyChord) error {
	if strings.TrimSpace(chord.Key) == "" {
		chord = globhotkey.Default()
	}
	if err := globhotkey.Register(chord, func() { a.toggleWindow() }); err != nil {
		return err
	}
	def := globhotkey.Default()
	return a.store.Update(func(cfg *config.AppConfig) {
		if globhotkey.ChordEqual(chord, def) {
			cfg.GlobalHotkey = nil
			return
		}
		c := chord
		cfg.GlobalHotkey = &c
	})
}
