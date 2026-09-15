//go:build darwin

package notify

// Declarations only. Implementations live in notify_darwin.m. cgo copies this
// preamble into two C files whenever //export is used, so definitions here
// would duplicate at link time (Wails "Generating bindings" on macOS).
/*
#cgo LDFLAGS: -framework Cocoa -framework UserNotifications
#include <stdlib.h>

void QtermNotifyInit(void);
void QtermNotifyRequestAuth(void);
void QtermNotifyPost(const char *ident, const char *title, const char *body, const char *sessionId);
void QtermSetDockBadge(int count);
int QtermAppIsActive(void);
void QtermBringToFront(void);
*/
import "C"
import (
	"sync"
	"unsafe"
)

var (
	activateMu sync.Mutex
	onActivate ActivateHandler
)

//export qtermNotifyActivated
func qtermNotifyActivated(sessionID *C.char) {
	sid := ""
	if sessionID != nil {
		sid = C.GoString(sessionID)
	}
	activateMu.Lock()
	h := onActivate
	activateMu.Unlock()
	if h != nil {
		h(sid)
	}
}

type darwinPoster struct{}

func newPoster() Poster {
	C.QtermNotifyInit()
	return darwinPoster{}
}

func (darwinPoster) RequestAuth() {
	C.QtermNotifyRequestAuth()
}

func (darwinPoster) Post(n Note) {
	ident := n.ID
	if ident == "" {
		ident = n.SessionID
	}
	if ident == "" {
		ident = "qterm"
	}
	cIdent := C.CString(ident)
	cTitle := C.CString(n.Title)
	cBody := C.CString(n.Body)
	cSID := C.CString(n.SessionID)
	defer C.free(unsafe.Pointer(cIdent))
	defer C.free(unsafe.Pointer(cTitle))
	defer C.free(unsafe.Pointer(cBody))
	defer C.free(unsafe.Pointer(cSID))
	C.QtermNotifyPost(cIdent, cTitle, cBody, cSID)
}

func (darwinPoster) SetBadge(count int) {
	C.QtermSetDockBadge(C.int(count))
}

func (darwinPoster) SetOnActivate(h ActivateHandler) {
	activateMu.Lock()
	onActivate = h
	activateMu.Unlock()
}

func (darwinPoster) AppActive() bool {
	return C.QtermAppIsActive() != 0
}

func (darwinPoster) BringToFront() {
	C.QtermBringToFront()
}
