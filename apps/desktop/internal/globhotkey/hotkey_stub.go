//go:build !darwin

package globhotkey

import "qterm/internal/config"

func register(config.KeyChord, Handler) error { return nil }
func unregister()                             {}
