//go:build darwin

package globhotkey

// Declarations only. Implementations live in hotkey_darwin.c. cgo copies this
// preamble into two C files whenever //export is used, so definitions here
// would duplicate at link time (Wails "Generating bindings" on macOS).
/*
#cgo LDFLAGS: -framework Carbon
#include <stdint.h>

int qtermRegisterHotKey(uint32_t keyCode, uint32_t modifiers);
void qtermUnregisterHotKey(void);
*/
import "C"
import (
	"fmt"
	"sync"

	"qterm/internal/config"
)

var (
	handlerMu sync.Mutex
	handler   Handler
)

//export qtermHotkeyFired
func qtermHotkeyFired() {
	handlerMu.Lock()
	h := handler
	handlerMu.Unlock()
	if h != nil {
		h()
	}
}

func register(c config.KeyChord, h Handler) error {
	key, mods, ok := carbon(c)
	if !ok {
		return fmt.Errorf("hotkey needs a modifier and a known key")
	}
	handlerMu.Lock()
	handler = h
	handlerMu.Unlock()
	if st := C.qtermRegisterHotKey(C.uint32_t(key), C.uint32_t(mods)); st != 0 {
		return fmt.Errorf("register hotkey: %d", int(st))
	}
	return nil
}

func unregister() {
	C.qtermUnregisterHotKey()
	handlerMu.Lock()
	handler = nil
	handlerMu.Unlock()
}
