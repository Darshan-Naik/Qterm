// Package termquery answers terminal capability/color queries on the Go side
// so shells (zsh/p10k) get replies without waiting for the webview round-trip.
package termquery

import (
	"bytes"
	"fmt"
	"strconv"
)

// Colors used for OSC 10/11/12 query replies (match app terminal CSS fallbacks).
type Colors struct {
	Fg     string // #rrggbb
	Bg     string
	Cursor string
}

// DefaultColors matches frontend terminalThemeFromCss fallbacks.
var DefaultColors = Colors{
	Fg:     "#fafafa",
	Bg:     "#252525",
	Cursor: "#7c6cf0",
}

var (
	replyPrimaryDA   = []byte("\x1b[?1;2c")
	replySecondaryDA = []byte("\x1b[>0;276;0c")
)

// Process scans PTY→emulator output for queries that need a fast reply.
// Answered sequences (DA, OSC 10/11/12 ?) are stripped from forward so xterm
// does not double-answer. CPR and similar stay in forward with urgent=true so
// the coalesce window is skipped.
func Process(in []byte, colors Colors) (forward, replies []byte, urgent bool) {
	if len(in) == 0 {
		return nil, nil, false
	}
	if colors.Fg == "" {
		colors = DefaultColors
	}
	forward = make([]byte, 0, len(in))
	i := 0
	for i < len(in) {
		if in[i] != 0x1b || i+1 >= len(in) {
			forward = append(forward, in[i])
			i++
			continue
		}
		next := in[i+1]
		switch next {
		case '[':
			n, reply, isUrgent, ok := handleCSI(in[i:])
			if ok {
				if len(reply) > 0 {
					replies = append(replies, reply...)
				}
				if isUrgent {
					urgent = true
					forward = append(forward, in[i:i+n]...)
				}
				i += n
				continue
			}
		case ']':
			n, reply, ok := handleOSC(in[i:], colors)
			if ok {
				if len(reply) > 0 {
					replies = append(replies, reply...)
				}
				i += n
				continue
			}
		}
		forward = append(forward, in[i])
		i++
	}
	return forward, replies, urgent
}

// ContainsUrgentQuery reports whether data includes a query that must reach
// the emulator without coalesce delay (CPR / remaining DA if unstripped).
func ContainsUrgentQuery(data []byte) bool {
	if len(data) < 3 || !bytes.Contains(data, []byte{0x1b}) {
		return false
	}
	i := 0
	for i < len(data) {
		if data[i] != 0x1b || i+1 >= len(data) {
			i++
			continue
		}
		switch data[i+1] {
		case '[':
			n, _, isUrgent, ok := handleCSI(data[i:])
			if ok {
				if isUrgent {
					return true
				}
				i += n
				continue
			}
		case ']':
			n, _, ok := handleOSC(data[i:], DefaultColors)
			if ok {
				// Color queries are answered in-process; still flush so any
				// sibling CPR in the same frame is not delayed — and so
				// partial handling stays snappy when callers only flush.
				_ = n
				return true
			}
		}
		i++
	}
	return false
}

func handleCSI(seq []byte) (n int, reply []byte, urgent bool, ok bool) {
	// seq starts with ESC [
	if len(seq) < 3 {
		return 0, nil, false, false
	}
	i := 2
	prefix := byte(0)
	if seq[i] == '?' || seq[i] == '>' {
		prefix = seq[i]
		i++
	}
	start := i
	for i < len(seq) {
		c := seq[i]
		if c >= '0' && c <= '9' || c == ';' {
			i++
			continue
		}
		break
	}
	if i >= len(seq) {
		return 0, nil, false, false
	}
	final := seq[i]
	params := seq[start:i]
	n = i + 1

	switch final {
	case 'c':
		// Device Attributes — answer in-process.
		if prefix == '>' {
			return n, replySecondaryDA, false, true
		}
		if prefix == 0 {
			return n, replyPrimaryDA, false, true
		}
		return 0, nil, false, false
	case 'n':
		// DSR: 5n status / 6n CPR. CPR needs cursor → flush to xterm.
		if prefix == '?' {
			// DEC origin-mode CPR variants — still need emulator.
			if paramsEqual(params, "6") {
				return n, nil, true, true
			}
			return 0, nil, false, false
		}
		if prefix == 0 {
			if paramsEqual(params, "6") {
				return n, nil, true, true
			}
			if paramsEqual(params, "5") {
				// Status report — safe fixed reply.
				return n, []byte("\x1b[0n"), false, true
			}
		}
		return 0, nil, false, false
	default:
		return 0, nil, false, false
	}
}

func handleOSC(seq []byte, colors Colors) (n int, reply []byte, ok bool) {
	// seq starts with ESC ]
	if len(seq) < 4 {
		return 0, nil, false
	}
	rest := seq[2:]
	ps, pn := readPs(rest)
	if pn < 0 {
		return 0, nil, false
	}
	body := rest[pn:]
	termAt := findTerm(body)
	if termAt < 0 {
		return 0, nil, false
	}
	payload := body[:termAt]
	// Consume BEL (1) or ST (2) terminator.
	var total int
	if body[termAt] == 0x07 {
		total = 2 + pn + termAt + 1
	} else if termAt+1 < len(body) && body[termAt] == 0x1b && body[termAt+1] == '\\' {
		total = 2 + pn + termAt + 2
	} else {
		return 0, nil, false
	}

	switch ps {
	case 10, 11, 12:
		if !isQueryPayload(payload) {
			return 0, nil, false
		}
		hex := colors.Fg
		if ps == 11 {
			hex = colors.Bg
		} else if ps == 12 {
			hex = colors.Cursor
		}
		rgb, err := hexToXRGB(hex)
		if err != nil {
			return 0, nil, false
		}
		// Prefer ST terminator (xterm.js triggerDataEvent path).
		reply = []byte(fmt.Sprintf("\x1b]%d;%s\x1b\\", ps, rgb))
		return total, reply, true
	default:
		return 0, nil, false
	}
}

func isQueryPayload(p []byte) bool {
	p = bytes.TrimSpace(p)
	return len(p) == 1 && p[0] == '?'
}

func paramsEqual(params []byte, want string) bool {
	return string(params) == want
}

func readPs(b []byte) (ps int, n int) {
	if len(b) == 0 || b[0] < '0' || b[0] > '9' {
		return -1, -1
	}
	ps = 0
	for n < len(b) && b[n] >= '0' && b[n] <= '9' {
		ps = ps*10 + int(b[n]-'0')
		n++
		if n > 4 {
			return -1, -1
		}
	}
	if n >= len(b) || b[n] != ';' {
		return -1, -1
	}
	return ps, n + 1
}

func findTerm(b []byte) int {
	for i := 0; i < len(b); i++ {
		if b[i] == 0x07 {
			return i
		}
		if b[i] == 0x1b && i+1 < len(b) && b[i+1] == '\\' {
			return i
		}
	}
	return -1
}

func hexToXRGB(hex string) (string, error) {
	if len(hex) == 0 {
		return "", fmt.Errorf("empty")
	}
	if hex[0] == '#' {
		hex = hex[1:]
	}
	if len(hex) != 6 {
		return "", fmt.Errorf("want rrggbb")
	}
	r64, err := strconv.ParseUint(hex[0:2], 16, 8)
	if err != nil {
		return "", err
	}
	g64, err := strconv.ParseUint(hex[2:4], 16, 8)
	if err != nil {
		return "", err
	}
	b64, err := strconv.ParseUint(hex[4:6], 16, 8)
	if err != nil {
		return "", err
	}
	// 8-bit → 16-bit channel (byte * 0x101), matching xterm reports.
	r := int(r64) * 0x101
	g := int(g64) * 0x101
	b := int(b64) * 0x101
	return fmt.Sprintf("rgb:%04x/%04x/%04x", r, g, b), nil
}
