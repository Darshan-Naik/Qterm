package scrollback

import "bytes"

// restoreFilter prepares a disk snapshot for a *new* shell after app relaunch.
// Live GetScrollback stays unfiltered so a still-running TUI can reattach.
//
// Matches native terminals (iTerm2 / VS Code / Ghostty): replay primary-screen
// shell history, never a frozen alt-screen / fullscreen CLI UI.
func restoreFilter(data []byte) []byte {
	if len(data) == 0 {
		return data
	}
	data = stripAltScreen(data)
	return stripFullscreenTUI(data)
}

var altScreenModes = map[int]bool{
	47:   true, // legacy alternate buffer
	1047: true,
	1049: true, // save cursor + alternate buffer (xterm)
}

// stripAltScreen drops bytes painted while the alternate screen is active,
// including an unmatched DECSET at EOF (app quit mid-TUI).
func stripAltScreen(in []byte) []byte {
	if len(in) == 0 {
		return in
	}
	out := make([]byte, 0, len(in))
	depth := 0
	i := 0
	for i < len(in) {
		if n, modes, set, ok := parseDECPrivate(in[i:]); ok {
			alt := false
			for _, m := range modes {
				if altScreenModes[m] {
					alt = true
					break
				}
			}
			if alt {
				if set {
					depth++
				} else if depth > 0 {
					depth--
				}
				i += n
				continue
			}
		}
		if depth == 0 {
			out = append(out, in[i])
		}
		i++
	}
	return out
}

// stripFullscreenTUI drops Ink-style primary-screen redraws (clear + home /
// hidden cursor). A lone `clear` is kept so regular shell history is intact.
func stripFullscreenTUI(in []byte) []byte {
	if !looksLikeFullscreenTUI(in) {
		return in
	}
	cut := -1
	if idx := firstEraseDisplay(in); idx >= 0 {
		cut = idx
	}
	if idx := indexCSI(in, []byte("?25l")); idx >= 0 && (cut < 0 || idx < cut) {
		cut = idx
	}
	if cut >= 0 {
		return trimTrailingC0(in[:cut])
	}
	return nil
}

func looksLikeFullscreenTUI(in []byte) bool {
	erases, homes, hides := 0, 0, 0
	i := 0
	for i < len(in) {
		if n, params, prefix, final, ok := parseCSI(in[i:]); ok {
			if prefix == '?' && final == 'l' {
				for _, p := range params {
					if p == 25 {
						hides++
					}
				}
			}
			if prefix == 0 && (final == 'J' || final == 'H' || final == 'f') {
				switch final {
				case 'J':
					ps := 0
					if len(params) > 0 {
						ps = params[0]
					}
					if ps == 2 || ps == 3 {
						erases++
					}
				case 'H', 'f':
					row, col := 1, 1
					if len(params) > 0 && params[0] > 0 {
						row = params[0]
					}
					if len(params) > 1 && params[1] > 0 {
						col = params[1]
					}
					if row <= 1 && col <= 1 {
						homes++
					}
				}
			}
			i += n
			continue
		}
		i++
	}
	if erases >= 1 && (hides >= 1 || homes >= 8) {
		return true
	}
	if hides >= 1 && homes >= 8 {
		return true
	}
	return false
}

func firstEraseDisplay(in []byte) int {
	i := 0
	for i < len(in) {
		n, params, prefix, final, ok := parseCSI(in[i:])
		if !ok {
			i++
			continue
		}
		if prefix == 0 && final == 'J' {
			ps := 0
			if len(params) > 0 {
				ps = params[0]
			}
			if ps == 2 || ps == 3 {
				return i
			}
		}
		i += n
	}
	return -1
}

func indexCSI(in []byte, inner []byte) int {
	needle := make([]byte, 0, 2+len(inner))
	needle = append(needle, 0x1b, '[')
	needle = append(needle, inner...)
	return bytes.Index(in, needle)
}

func trimTrailingC0(in []byte) []byte {
	i := len(in)
	for i > 0 {
		c := in[i-1]
		if c == '\n' || c == '\r' || c == ' ' || c == '\t' {
			i--
			continue
		}
		break
	}
	return in[:i]
}

// parseDECPrivate parses CSI ? ... h/l. Incomplete sequences return ok=false.
func parseDECPrivate(data []byte) (n int, modes []int, set bool, ok bool) {
	n, modes, prefix, final, ok := parseCSI(data)
	if !ok || prefix != '?' || (final != 'h' && final != 'l') {
		return 0, nil, false, false
	}
	return n, modes, final == 'h', true
}

// parseCSI parses ESC [ [prefix] params final. prefix is 0 or '?'.
func parseCSI(data []byte) (n int, params []int, prefix byte, final byte, ok bool) {
	if len(data) < 3 || data[0] != 0x1b || data[1] != '[' {
		return 0, nil, 0, 0, false
	}
	i := 2
	if data[i] == '?' || data[i] == '>' {
		prefix = data[i]
		i++
	}
	cur := 0
	hasDigit := false
	sawParam := false
	for i < len(data) {
		c := data[i]
		if c >= '0' && c <= '9' {
			hasDigit = true
			sawParam = true
			cur = cur*10 + int(c-'0')
			if cur > 99999 {
				return 0, nil, 0, 0, false
			}
			i++
			continue
		}
		if c == ';' {
			params = append(params, cur)
			cur = 0
			hasDigit = false
			sawParam = true
			i++
			continue
		}
		if c >= 0x40 && c <= 0x7e {
			if hasDigit || sawParam {
				params = append(params, cur)
			}
			return i + 1, params, prefix, c, true
		}
		return 0, nil, 0, 0, false
	}
	return 0, nil, 0, 0, false
}
