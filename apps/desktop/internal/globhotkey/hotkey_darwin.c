// Carbon hotkey helpers. Kept out of the Go //export preamble because cgo
// copies that preamble into two C files and duplicate symbols fail the
// Wails macOS link (see cmd/cgo: definitions vs declarations).
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
		EventTypeSpec spec = {kEventClassKeyboard, kEventHotKeyPressed};
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
