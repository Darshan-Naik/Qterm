package globhotkey

import "qterm/internal/config"

// Default is Control+` (grave), a Visor-style show/hide chord.
func Default() config.KeyChord {
	return config.KeyChord{
		Key:      "`",
		Codes:    []string{"Backquote"},
		CtrlOnly: true,
	}
}

// ChordEqual is a small helper for persist/no-op checks.
func ChordEqual(a, b config.KeyChord) bool {
	if a.Key != b.Key || a.CtrlOnly != b.CtrlOnly || a.MetaOrCtrl != b.MetaOrCtrl || a.Shift != b.Shift || a.Alt != b.Alt {
		return false
	}
	if len(a.Codes) != len(b.Codes) {
		return false
	}
	for i := range a.Codes {
		if a.Codes[i] != b.Codes[i] {
			return false
		}
	}
	return true
}

// carbon maps a KeyChord to a Carbon virtual key + modifier mask.
// Returns ok=false for chords we cannot register (no modifiers, unknown keys).
func carbon(c config.KeyChord) (keyCode, modifiers uint32, ok bool) {
	const (
		cmdKey     = 1 << 8
		shiftKey   = 1 << 9
		optionKey  = 1 << 11
		controlKey = 1 << 12
	)
	key := c.Key
	if key == "" && len(c.Codes) > 0 {
		key = c.Codes[0]
	}
	code, known := virtualKey(key, c.Codes)
	if !known {
		return 0, 0, false
	}
	if c.CtrlOnly {
		modifiers |= controlKey
	} else if c.MetaOrCtrl {
		modifiers |= cmdKey
	}
	if c.Shift {
		modifiers |= shiftKey
	}
	if c.Alt {
		modifiers |= optionKey
	}
	if modifiers == 0 {
		return 0, 0, false
	}
	return code, modifiers, true
}

func virtualKey(key string, codes []string) (uint32, bool) {
	for _, c := range codes {
		if v, ok := codeToVK[c]; ok {
			return v, true
		}
	}
	if v, ok := keyToVK[key]; ok {
		return v, true
	}
	if len(key) == 1 {
		k := key[0]
		if k >= 'a' && k <= 'z' {
			k -= 32
		}
		if v, ok := keyToVK[string([]byte{k})]; ok {
			return v, true
		}
	}
	return 0, false
}

// ANSI virtual key codes (HIToolbox Events.h).
var keyToVK = map[string]uint32{
	"`": 0x32, "Backquote": 0x32,
	" ": 0x31, "Space": 0x31,
	"Escape": 0x35, "Esc": 0x35,
	"Tab": 0x30,
	"0":   0x1D, "1": 0x12, "2": 0x13, "3": 0x14, "4": 0x15,
	"5": 0x17, "6": 0x16, "7": 0x1A, "8": 0x1C, "9": 0x19,
	"A": 0x00, "B": 0x0B, "C": 0x08, "D": 0x02, "E": 0x0E,
	"F": 0x03, "G": 0x05, "H": 0x04, "I": 0x22, "J": 0x26,
	"K": 0x28, "L": 0x25, "M": 0x2E, "N": 0x2D, "O": 0x1F,
	"P": 0x23, "Q": 0x0C, "R": 0x0F, "S": 0x01, "T": 0x11,
	"U": 0x20, "V": 0x09, "W": 0x0D, "X": 0x07, "Y": 0x10,
	"Z": 0x06,
}

var codeToVK = map[string]uint32{
	"Backquote": 0x32,
	"Space":     0x31,
	"Escape":    0x35,
	"Tab":       0x30,
	"KeyA":      0x00,
	"KeyB":      0x0B,
	"KeyC":      0x08,
	"KeyD":      0x02,
	"KeyE":      0x0E,
	"KeyF":      0x03,
	"KeyG":      0x05,
	"KeyH":      0x04,
	"KeyI":      0x22,
	"KeyJ":      0x26,
	"KeyK":      0x28,
	"KeyL":      0x25,
	"KeyM":      0x2E,
	"KeyN":      0x2D,
	"KeyO":      0x1F,
	"KeyP":      0x23,
	"KeyQ":      0x0C,
	"KeyR":      0x0F,
	"KeyS":      0x01,
	"KeyT":      0x11,
	"KeyU":      0x20,
	"KeyV":      0x09,
	"KeyW":      0x0D,
	"KeyX":      0x07,
	"KeyY":      0x10,
	"KeyZ":      0x06,
	"Digit0":    0x1D,
	"Digit1":    0x12,
	"Digit2":    0x13,
	"Digit3":    0x14,
	"Digit4":    0x15,
	"Digit5":    0x17,
	"Digit6":    0x16,
	"Digit7":    0x1A,
	"Digit8":    0x1C,
	"Digit9":    0x19,
}

// Handler is invoked on the hotkey thread; keep it short and bounce to the app.
type Handler func()

// Register installs a system-wide hotkey. No-op on non-Darwin.
func Register(c config.KeyChord, h Handler) error {
	return register(c, h)
}

// Unregister removes the current hotkey.
func Unregister() {
	unregister()
}
