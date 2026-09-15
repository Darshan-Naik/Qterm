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
	AppActive() bool
	BringToFront()
}

// New returns the platform poster (real on macOS, no-op elsewhere).
func New() Poster {
	return newPoster()
}
