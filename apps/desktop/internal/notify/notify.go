package notify

// Note is a local user notification.
type Note struct {
	ID        string
	Title     string
	Body      string
	SessionID string
}

// ActivateHandler is called when the user clicks a notification.
type ActivateHandler func(sessionID string)

// Poster delivers notifications and dock badge updates.
type Poster interface {
	RequestAuth()
	Post(n Note)
	SetBadge(count int)
	SetOnActivate(h ActivateHandler)
	SetOnActiveChange(h func())
	AppActive() bool
	BringToFront()
}

// New returns the platform poster (real on macOS, no-op elsewhere).
func New() Poster {
	return newPoster()
}

// bounce runs h after returning so //export callbacks never call Wails/AppKit
// on the same stack. A notification click can already be on main; syncing back
// to the main queue from that stack deadlocks and looks like a crash.
func bounce(h func()) {
	if h == nil {
		return
	}
	go h()
}
