package oscnotify

import (
	"sync"
	"time"
)

// DoneFunc is called when a notification OSC is parsed for a session.
type DoneFunc func(sessionID string, ev Event)

// Tracker keeps per-session OSC notify parsers.
type Tracker struct {
	mu   sync.Mutex
	sess map[string]*Parser
	on   DoneFunc
}

func NewTracker(on DoneFunc) *Tracker {
	return &Tracker{sess: make(map[string]*Parser), on: on}
}

// Feed parses notify OSC sequences, invokes on for each, and returns the
// chunk with those sequences removed for the UI forward path.
func (t *Tracker) Feed(sessionID string, chunk []byte) []byte {
	if t == nil || sessionID == "" || len(chunk) == 0 {
		return chunk
	}
	t.mu.Lock()
	p := t.sess[sessionID]
	if p == nil {
		p = &Parser{}
		t.sess[sessionID] = p
	}
	forward, events := p.Feed(chunk)
	t.mu.Unlock()
	if t.on != nil {
		for _, ev := range events {
			t.on(sessionID, ev)
		}
	}
	return forward
}

func (t *Tracker) Remove(sessionID string) {
	if t == nil {
		return
	}
	t.mu.Lock()
	delete(t.sess, sessionID)
	t.mu.Unlock()
}

// Attention is a waiting session with a human-readable notice.
type Attention struct {
	SessionID string    `json:"sessionId"`
	Text      string    `json:"text"`
	At        time.Time `json:"at"`
}
