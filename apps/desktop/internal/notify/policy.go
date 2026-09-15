package notify

import "time"

const (
	// DefaultCommandMinSec is how long a command must run before we notify on finish.
	DefaultCommandMinSec = 8
	// RepeatNeedsInputAfter is the minimum gap between needs-input banners for one pane.
	RepeatNeedsInputAfter = 30 * time.Second
)

// Kind is why we might surface a macOS notification.
type Kind string

const (
	KindNeedsInput   Kind = "needs_input"
	KindTaskComplete Kind = "task_complete"
	KindCommandDone  Kind = "command_done"
)

// Decision is the pure “should we banner?” check. No OS calls.
type Decision struct {
	Kind      Kind
	SessionID string
	AppActive bool
	FocusedID string
	Enabled   bool
	LastSent  time.Time
	Now       time.Time
}

// Should reports whether to post a user notification.
//
// Never banner the pane the user is already looking at in a focused app.
// Needs-input may repeat after RepeatNeedsInputAfter if they walked away again.
func Should(d Decision) bool {
	if !d.Enabled || d.SessionID == "" {
		return false
	}
	if d.AppActive && d.FocusedID == d.SessionID {
		return false
	}
	switch d.Kind {
	case KindNeedsInput:
		if d.LastSent.IsZero() {
			return true
		}
		if d.Now.IsZero() {
			d.Now = time.Now()
		}
		return d.Now.Sub(d.LastSent) >= RepeatNeedsInputAfter
	case KindTaskComplete, KindCommandDone:
		return true
	default:
		return false
	}
}

// CommandLongEnough is true when a finished command ran at least minSec.
func CommandLongEnough(dur time.Duration, minSec int) bool {
	if minSec <= 0 {
		minSec = DefaultCommandMinSec
	}
	return dur >= time.Duration(minSec)*time.Second
}
