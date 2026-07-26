package ptyemit

import (
	"bytes"
	"sync"
	"time"
)

const (
	flushInterval = 12 * time.Millisecond
	flushBytes    = 64 << 10 // flush early on large dumps
)

// Handler receives coalesced PTY output for a session.
type Handler func(sessionID string, data []byte)

// Coalescer batches rapid PTY reads into ~12ms frames so scrollback append,
// base64 encode, and EventsEmit run once per frame instead of per OS read.
type Coalescer struct {
	mu      sync.Mutex
	bufs    map[string]*bytes.Buffer
	timers  map[string]*time.Timer
	onFlush Handler
}

func New(onFlush Handler) *Coalescer {
	return &Coalescer{
		bufs:    make(map[string]*bytes.Buffer),
		timers:  make(map[string]*time.Timer),
		onFlush: onFlush,
	}
}

func (c *Coalescer) Push(sessionID string, data []byte) {
	if len(data) == 0 || c.onFlush == nil {
		return
	}
	c.mu.Lock()
	buf := c.bufs[sessionID]
	if buf == nil {
		buf = &bytes.Buffer{}
		c.bufs[sessionID] = buf
	}
	buf.Write(data)
	flushNow := buf.Len() >= flushBytes
	if flushNow {
		if t := c.timers[sessionID]; t != nil {
			t.Stop()
			delete(c.timers, sessionID)
		}
		payload := buf.Bytes()
		out := make([]byte, len(payload))
		copy(out, payload)
		buf.Reset()
		c.mu.Unlock()
		c.onFlush(sessionID, out)
		return
	}
	if c.timers[sessionID] == nil {
		id := sessionID
		c.timers[id] = time.AfterFunc(flushInterval, func() {
			c.flush(id)
		})
	}
	c.mu.Unlock()
}

func (c *Coalescer) flush(sessionID string) {
	c.mu.Lock()
	delete(c.timers, sessionID)
	buf := c.bufs[sessionID]
	if buf == nil || buf.Len() == 0 {
		c.mu.Unlock()
		return
	}
	payload := buf.Bytes()
	out := make([]byte, len(payload))
	copy(out, payload)
	buf.Reset()
	c.mu.Unlock()
	c.onFlush(sessionID, out)
}

// FlushAll drains every pending session (call on shutdown).
func (c *Coalescer) FlushAll() {
	c.mu.Lock()
	ids := make([]string, 0, len(c.bufs))
	for id, t := range c.timers {
		t.Stop()
		delete(c.timers, id)
	}
	for id, buf := range c.bufs {
		if buf != nil && buf.Len() > 0 {
			ids = append(ids, id)
		}
	}
	pending := make(map[string][]byte, len(ids))
	for _, id := range ids {
		buf := c.bufs[id]
		pending[id] = append([]byte(nil), buf.Bytes()...)
		buf.Reset()
	}
	c.mu.Unlock()
	for id, data := range pending {
		c.onFlush(id, data)
	}
}
