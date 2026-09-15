package osc133

import (
	"bytes"
	"strconv"
)

// Kind is one FinalTerm / VS Code / iTerm OSC 133 semantic mark.
type Kind byte

const (
	KindPromptStart Kind = 'A'
	KindPromptEnd   Kind = 'B'
	KindOutputStart Kind = 'C'
	KindCommandEnd  Kind = 'D'
)

// Event is one complete OSC 133 sequence.
type Event struct {
	Kind     Kind
	ExitCode int // KindCommandEnd only; -1 if omitted
	Start    int // byte index of ESC in this Feed's view
	End      int // first byte after the OSC
}

// Parser is a streaming OSC 133 scanner. O(chunk), no full-buffer copies.
type Parser struct {
	buf []byte
}

const maxHold = 64

// Feed consumes a PTY chunk and returns complete OSC 133 events in order.
// Start/End are indexes into the concatenation of any held prefix plus chunk.
func (p *Parser) Feed(chunk []byte) (data []byte, events []Event) {
	if len(chunk) == 0 && len(p.buf) == 0 {
		return nil, nil
	}
	data = chunk
	if len(p.buf) > 0 {
		data = append(append([]byte{}, p.buf...), chunk...)
		p.buf = p.buf[:0]
	}
	i := 0
	for i < len(data) {
		esc := bytes.IndexByte(data[i:], 0x1b)
		if esc < 0 {
			break
		}
		esc += i
		if esc+1 >= len(data) {
			p.hold(data[esc:])
			break
		}
		if data[esc+1] != ']' {
			i = esc + 1
			continue
		}
		rest := data[esc+2:]
		term := findTerm(rest)
		if term < 0 {
			p.hold(data[esc:])
			break
		}
		end := esc + 2 + term
		payload := rest[:term]
		if ev, ok := parsePayload(payload); ok {
			ev.Start = esc
			ev.End = end
			events = append(events, ev)
		}
		i = end
	}
	// Drop an incomplete OSC tail so the next Feed does not append it twice.
	if n := len(p.buf); n > 0 && n <= len(data) {
		data = data[:len(data)-n]
	}
	return data, events
}

func (p *Parser) hold(tail []byte) {
	if len(tail) > maxHold {
		tail = tail[len(tail)-maxHold:]
	}
	p.buf = append(p.buf[:0], tail...)
}

func findTerm(b []byte) int {
	for i := 0; i < len(b); i++ {
		if b[i] == 0x07 {
			return i + 1
		}
		if b[i] == 0x1b && i+1 < len(b) && b[i+1] == '\\' {
			return i + 2
		}
	}
	return -1
}

func parsePayload(payload []byte) (Event, bool) {
	if len(payload) == 0 {
		return Event{}, false
	}
	if payload[len(payload)-1] == 0x07 {
		payload = payload[:len(payload)-1]
	} else if len(payload) >= 2 && payload[len(payload)-2] == 0x1b && payload[len(payload)-1] == '\\' {
		payload = payload[:len(payload)-2]
	}
	if !bytes.HasPrefix(payload, []byte("133;")) {
		return Event{}, false
	}
	rest := payload[4:]
	if len(rest) == 0 {
		return Event{}, false
	}
	kind := Kind(rest[0])
	switch kind {
	case KindPromptStart, KindPromptEnd, KindOutputStart, KindCommandEnd:
	default:
		return Event{}, false
	}
	ev := Event{Kind: kind, ExitCode: -1}
	if kind == KindCommandEnd && len(rest) > 2 && rest[1] == ';' {
		n, err := strconv.Atoi(string(bytes.TrimSpace(rest[2:])))
		if err == nil {
			ev.ExitCode = n
		}
	}
	return ev, true
}
