package osc133

import (
	"sync"
	"time"
)

const maxOutput = 256 << 10 // 256 KiB of last command output

// Result is the most recent finished command for a session.
type Result struct {
	Output   string
	ExitCode int
	Duration time.Duration
	EndedAt  time.Time
}

// DoneFunc is called after Feed returns when a command ends.
type DoneFunc func(sessionID string, res Result)

// Tracker keeps per-session OSC 133 state and last output.
type Tracker struct {
	mu    sync.Mutex
	sess  map[string]*session
	onEnd DoneFunc
}

type session struct {
	parser  Parser
	running bool
	started time.Time
	out     []byte
	last    Result
	hasLast bool
}

func NewTracker(onEnd DoneFunc) *Tracker {
	return &Tracker{sess: make(map[string]*session), onEnd: onEnd}
}

func (t *Tracker) Feed(sessionID string, chunk []byte) {
	if sessionID == "" || len(chunk) == 0 {
		return
	}
	t.mu.Lock()
	s := t.sess[sessionID]
	if s == nil {
		s = &session{}
		t.sess[sessionID] = s
	}
	data, events := s.parser.Feed(chunk)
	var done []Result
	now := time.Now()
	cursor := 0
	for _, ev := range events {
		if s.running && ev.Start > cursor {
			s.out = appendCapped(s.out, data[cursor:ev.Start])
		}
		switch ev.Kind {
		case KindOutputStart:
			s.running = true
			s.started = now
			s.out = s.out[:0]
			cursor = ev.End
		case KindCommandEnd:
			if s.running {
				res := Result{
					Output:   stripOSC(s.out),
					ExitCode: ev.ExitCode,
					Duration: now.Sub(s.started),
					EndedAt:  now,
				}
				s.last = res
				s.hasLast = true
				s.running = false
				s.out = s.out[:0]
				done = append(done, res)
			}
			cursor = ev.End
		default:
			cursor = ev.End
		}
	}
	if s.running && cursor < len(data) {
		s.out = appendCapped(s.out, data[cursor:])
	}
	cb := t.onEnd
	t.mu.Unlock()
	if cb != nil {
		for _, res := range done {
			cb(sessionID, res)
		}
	}
}

func appendCapped(dst, add []byte) []byte {
	need := len(dst) + len(add)
	if need <= maxOutput {
		return append(dst, add...)
	}
	cut := need - maxOutput
	if cut >= len(dst) {
		add = add[len(add)-(maxOutput):]
		return append(dst[:0], add...)
	}
	n := copy(dst, dst[cut:])
	dst = dst[:n]
	return append(dst, add...)
}

// stripOSC drops escape sequences so clipboard paste is plain text.
func stripOSC(in []byte) string {
	if len(in) == 0 {
		return ""
	}
	out := make([]byte, 0, len(in))
	i := 0
	for i < len(in) {
		if in[i] == 0x1b {
			if i+1 < len(in) && in[i+1] == ']' {
				rest := in[i+2:]
				term := findTerm(rest)
				if term > 0 {
					i += 2 + term
					continue
				}
			}
			i++
			continue
		}
		out = append(out, in[i])
		i++
	}
	return string(out)
}

func (t *Tracker) Last(sessionID string) (Result, bool) {
	t.mu.Lock()
	defer t.mu.Unlock()
	s := t.sess[sessionID]
	if s == nil || !s.hasLast {
		return Result{}, false
	}
	return s.last, true
}

func (t *Tracker) Remove(sessionID string) {
	t.mu.Lock()
	delete(t.sess, sessionID)
	t.mu.Unlock()
}
