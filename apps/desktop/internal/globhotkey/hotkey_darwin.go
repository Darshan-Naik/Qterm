//go:build darwin

package globhotkey

/*
#cgo LDFLAGS: -framework Carbon
#include <Carbon/Carbon.h>
#include <stdint.h>

extern void qtermHotkeyFired(void);

static EventHandlerRef qtermHotKeyHandlerRef = NULL;
static EventHotKeyRef qtermHotKeyRef = NULL;

static OSStatus qtermHotKeyHandler(EventHandlerCallRef next, EventRef event, void *userData) {
	(void)next;
	(void)event;
	(void)userData;
	qtermHotkeyFired();
	return noErr;
}

int qtermRegisterHotKey(uint32_t keyCode, uint32_t modifiers) {
	if (qtermHotKeyRef) {
		UnregisterEventHotKey(qtermHotKeyRef);
		qtermHotKeyRef = NULL;
	}
	if (qtermHotKeyHandlerRef == NULL) {
		EventTypeSpec spec = { kEventClassKeyboard, kEventHotKeyPressed };
		InstallApplicationEventHandler(NewEventHandlerUPP(qtermHotKeyHandler), 1, &spec, NULL, &qtermHotKeyHandlerRef);
	}
	EventHotKeyID hid;
	hid.signature = 'QTRM';
	hid.id = 1;
	OSStatus err = RegisterEventHotKey(keyCode, modifiers, hid, GetApplicationEventTarget(), 0, &qtermHotKeyRef);
	return (int)err;
}

void qtermUnregisterHotKey(void) {
	if (qtermHotKeyRef) {
		UnregisterEventHotKey(qtermHotKeyRef);
		qtermHotKeyRef = NULL;
	}
}
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
