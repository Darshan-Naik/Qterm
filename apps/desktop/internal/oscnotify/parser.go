// Package oscnotify parses terminal notification OSC sequences (9 / 99 / 777).
// Same family cmux uses for attention rings without agent-specific hooks.
package oscnotify

import (
	"bytes"
	"strings"
)

// Event is one complete notification OSC.
type Event struct {
	Title string
	Body  string
	Start int
	End   int
}

// Parser is a streaming OSC 9 / 99 / 777 scanner. O(chunk), no full-buffer copies.
type Parser struct {
	buf []byte
}

const maxHold = 256

// Feed consumes a PTY chunk and returns complete notify events in order.
func (p *Parser) Feed(chunk []byte) (events []Event) {
	if len(chunk) == 0 && len(p.buf) == 0 {
		return nil
	}
	data := chunk
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
		if ev, ok := parsePayload(rest[:term]); ok {
			ev.Start = esc
			ev.End = end
			events = append(events, ev)
		}
		i = end
	}
	return events
}

func (p *Parser) hold(tail []byte) {
	if len(tail) > maxHold {
		tail = tail[len(tail)-maxHold:]
	}
	p.buf = append(p.buf[:0], tail...)
}

func findTerm(b []byte) int {
	for i := 0; i < len(b); i++ {
		if b[i] == 0x07 { // BEL
			return i + 1
		}
		if b[i] == 0x1b && i+1 < len(b) && b[i+1] == '\\' { // ST
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
	s := string(payload)
	switch {
	case strings.HasPrefix(s, "9;"):
		body := strings.TrimSpace(s[2:])
		if body == "" {
			return Event{}, false
		}
		return Event{Body: body}, true
	case strings.HasPrefix(s, "99;"):
		return parseKeyed(s[3:])
	case strings.HasPrefix(s, "777;"):
		rest := s[4:]
		if strings.HasPrefix(rest, "notify;") {
			return parse777(rest[len("notify;"):])
		}
		// iTerm2 / some agents: OSC 777;<title>;<body>
		return parse777(rest)
	default:
		return Event{}, false
	}
}

func parseKeyed(s string) (Event, bool) {
	// OSC 99;i=1:d=0;notify;Title;Body  (common agent form) or title=…;body=…
	parts := strings.Split(s, ";")
	var title, body string
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" || part == "notify" {
			continue
		}
		if strings.HasPrefix(part, "title=") {
			title = strings.TrimPrefix(part, "title=")
			continue
		}
		if strings.HasPrefix(part, "body=") {
			body = strings.TrimPrefix(part, "body=")
			continue
		}
		// Positional after options: first free field = title, second = body.
		if !strings.Contains(part, "=") {
			if title == "" {
				title = part
			} else if body == "" {
				body = part
			}
		}
	}
	if title == "" && body == "" {
		return Event{}, false
	}
	if body == "" {
		body = title
		title = ""
	}
	return Event{Title: title, Body: body}, true
}

func parse777(s string) (Event, bool) {
	s = strings.TrimSpace(s)
	if s == "" {
		return Event{}, false
	}
	if i := strings.IndexByte(s, ';'); i >= 0 {
		title := strings.TrimSpace(s[:i])
		body := strings.TrimSpace(s[i+1:])
		if body == "" {
			body = title
			title = ""
		}
		return Event{Title: title, Body: body}, true
	}
	return Event{Body: s}, true
}
