package scrollback

import (
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const defaultMaxBytes = 1 << 20 // 1 MiB per session

// Store keeps an in-memory ring buffer of PTY output per session and
// mirrors it to disk so history survives app relaunches.
type Store struct {
	mu      sync.Mutex
	dir     string
	max     int
	bufs    map[string]*buffer
	dirty   map[string]bool
	saveCh  chan struct{}
	stopped bool
}

// buffer is locked independently so one busy session cannot stall others.
type buffer struct {
	mu   sync.Mutex
	data []byte
	seq  uint64
}

func NewStore(dir string) (*Store, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	s := &Store{
		dir:    dir,
		max:    defaultMaxBytes,
		bufs:   make(map[string]*buffer),
		dirty:  make(map[string]bool),
		saveCh: make(chan struct{}, 1),
	}
	go s.persistLoop()
	return s, nil
}

func (s *Store) path(id string) string {
	return filepath.Join(s.dir, id+".bin")
}

func (s *Store) getOrCreate(id string) *buffer {
	s.mu.Lock()
	defer s.mu.Unlock()
	b := s.bufs[id]
	if b == nil {
		b = &buffer{}
		s.bufs[id] = b
	}
	return b
}

func (s *Store) markDirty(id string) {
	s.mu.Lock()
	s.dirty[id] = true
	s.mu.Unlock()
	select {
	case s.saveCh <- struct{}{}:
	default:
	}
}

// Append stores chunk and returns the buffer sequence after the write.
func (s *Store) Append(id string, chunk []byte) uint64 {
	if id == "" || len(chunk) == 0 {
		return 0
	}
	chunk = stripColorOSC(chunk)
	if len(chunk) == 0 {
		b := s.getOrCreate(id)
		b.mu.Lock()
		seq := b.seq
		b.mu.Unlock()
		return seq
	}

	b := s.getOrCreate(id)
	b.mu.Lock()
	b.data = append(b.data, chunk...)
	// Amortized trim: only cut when we grow past 2× max, then drop to max
	// in-place (keeps capacity so the next growth window is cheap).
	if len(b.data) > s.max*2 {
		b.data = trimFrontInPlace(b.data, s.max)
	}
	b.seq++
	seq := b.seq
	b.mu.Unlock()

	s.markDirty(id)
	return seq
}

func (s *Store) Snapshot(id string) (data []byte, seq uint64) {
	s.mu.Lock()
	b := s.bufs[id]
	s.mu.Unlock()
	if b == nil {
		return nil, 0
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	if len(b.data) == 0 {
		return nil, 0
	}
	clean := syncStart(b.data)
	out := make([]byte, len(clean))
	copy(out, clean)
	return out, b.seq
}

// Hit is one session whose scrollback contains the query.
type Hit struct {
	SessionID string
	Snippet   string
}

// Search returns sessions whose plain-text scrollback contains query
// (case-insensitive). ids limits the scan; empty means all loaded buffers.
func (s *Store) Search(query string, ids []string) []Hit {
	q := strings.ToLower(strings.TrimSpace(query))
	if len(q) < 2 {
		return nil
	}
	needle := []byte(q)

	s.mu.Lock()
	if len(ids) == 0 {
		ids = make([]string, 0, len(s.bufs))
		for id := range s.bufs {
			ids = append(ids, id)
		}
	}
	bufs := make([]*buffer, len(ids))
	for i, id := range ids {
		bufs[i] = s.bufs[id]
	}
	s.mu.Unlock()

	out := make([]Hit, 0, 8)
	for i, b := range bufs {
		if b == nil {
			continue
		}
		b.mu.Lock()
		plain := stripANSI(syncStart(b.data))
		b.mu.Unlock()
		if len(plain) == 0 {
			continue
		}
		lower := bytes.ToLower(plain)
		idx := bytes.Index(lower, needle)
		if idx < 0 {
			continue
		}
		out = append(out, Hit{
			SessionID: ids[i],
			Snippet:   snippetAround(plain, idx, len(needle)),
		})
	}
	return out
}

// stripANSI removes ESC sequences and most C0 controls so scrollback is searchable as text.
func stripANSI(in []byte) []byte {
	if len(in) == 0 {
		return nil
	}
	out := make([]byte, 0, len(in))
	i := 0
	for i < len(in) {
		c := in[i]
		if c == 0x1b {
			if end := escapeEnd(in[i:]); end > 0 {
				i += end
				continue
			}
			i++
			continue
		}
		if c < 0x20 {
			if c == '\n' || c == '\t' || c == '\r' {
				out = append(out, ' ')
			}
			i++
			continue
		}
		if c == 0x7f {
			i++
			continue
		}
		out = append(out, c)
		i++
	}
	return out
}

func snippetAround(plain []byte, idx, matchLen int) string {
	const pad = 36
	start := idx - pad
	if start < 0 {
		start = 0
	}
	end := idx + matchLen + pad
	if end > len(plain) {
		end = len(plain)
	}
	snip := string(plain[start:end])
	snip = strings.Join(strings.Fields(snip), " ")
	if start > 0 {
		snip = "…" + snip
	}
	if end < len(plain) {
		snip = snip + "…"
	}
	if len(snip) > 120 {
		snip = snip[:117] + "…"
	}
	return snip
}

// Load reads a session's scrollback from disk into memory (before PTY restore).
func (s *Store) Load(id string) {
	data, err := os.ReadFile(s.path(id))
	if err != nil || len(data) == 0 {
		return
	}
	data = stripColorOSC(data)
	if len(data) > s.max {
		data = trimFront(data, s.max)
	}
	data = syncStart(data)
	b := &buffer{data: append([]byte(nil), data...), seq: 1}
	s.mu.Lock()
	s.bufs[id] = b
	s.mu.Unlock()
}

func (s *Store) Remove(id string) {
	s.mu.Lock()
	delete(s.bufs, id)
	delete(s.dirty, id)
	s.mu.Unlock()
	_ = os.Remove(s.path(id))
}

func (s *Store) Flush() {
	s.mu.Lock()
	ids := make([]string, 0, len(s.dirty))
	for id, d := range s.dirty {
		if d {
			ids = append(ids, id)
		}
	}
	snapshots := make(map[string][]byte, len(ids))
	for _, id := range ids {
		if b := s.bufs[id]; b != nil {
			b.mu.Lock()
			snapshots[id] = append([]byte(nil), b.data...)
			b.mu.Unlock()
		}
		s.dirty[id] = false
	}
	s.mu.Unlock()
	for id, data := range snapshots {
		_ = os.WriteFile(s.path(id), data, 0o644)
	}
}

func (s *Store) Close() {
	s.mu.Lock()
	s.stopped = true
	s.mu.Unlock()
	s.Flush()
}

func (s *Store) persistLoop() {
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-s.saveCh:
			s.mu.Lock()
			stopped := s.stopped
			s.mu.Unlock()
			if stopped {
				return
			}
			time.Sleep(400 * time.Millisecond)
			s.Flush()
		case <-ticker.C:
			s.mu.Lock()
			stopped := s.stopped
			hasDirty := false
			for _, d := range s.dirty {
				if d {
					hasDirty = true
					break
				}
			}
			s.mu.Unlock()
			if stopped {
				return
			}
			if hasDirty {
				s.Flush()
			}
		}
	}
}

// trimFrontInPlace drops oldest bytes into the front of the same backing array
// so capacity is retained (avoids realloc on every subsequent Append).
func trimFrontInPlace(data []byte, max int) []byte {
	if len(data) <= max {
		return data
	}
	cut := len(data) - max
	if i := bytes.IndexByte(data[cut:], '\n'); i >= 0 && cut+i+1 < len(data) {
		cut = cut + i + 1
	}
	n := copy(data, data[cut:])
	return data[:n]
}

// trimFront allocates a trimmed copy (tests / one-shot Load).
func trimFront(data []byte, max int) []byte {
	if len(data) <= max {
		return data
	}
	cut := len(data) - max
	if i := bytes.IndexByte(data[cut:], '\n'); i >= 0 && cut+i+1 < len(data) {
		cut = cut + i + 1
	}
	return append([]byte(nil), data[cut:]...)
}

// syncStart skips a leading incomplete escape sequence so restore doesn't
// paint control bytes as mojibake.
func syncStart(data []byte) []byte {
	if len(data) == 0 {
		return data
	}
	if data[0] != 0x1b {
		// Also skip orphaned CSI params if we cut after ESC was dropped.
		if data[0] == '[' || data[0] == ']' {
			if i := bytes.IndexByte(data, '\n'); i >= 0 {
				return data[i+1:]
			}
		}
		return data
	}
	// Complete ESC sequence from offset 0, or skip to next newline.
	if end := escapeEnd(data); end > 0 {
		return data
	}
	if i := bytes.IndexByte(data, '\n'); i >= 0 {
		return data[i+1:]
	}
	return nil
}

func escapeEnd(data []byte) int {
	if len(data) < 2 || data[0] != 0x1b {
		return -1
	}
	switch data[1] {
	case '[': // CSI: ends with @-~
		for i := 2; i < len(data); i++ {
			if data[i] >= 0x40 && data[i] <= 0x7e {
				return i + 1
			}
		}
	case ']': // OSC: BEL or ST
		for i := 2; i < len(data); i++ {
			if data[i] == 0x07 {
				return i + 1
			}
			if data[i] == 0x1b && i+1 < len(data) && data[i+1] == '\\' {
				return i + 2
			}
		}
	case 'P', 'X', '^', '_': // DCS/SOS/PM/APC: ST
		for i := 2; i < len(data); i++ {
			if data[i] == 0x1b && i+1 < len(data) && data[i+1] == '\\' {
				return i + 2
			}
		}
	default:
		// Two-byte ESC Fe
		return 2
	}
	return -1
}

// stripColorOSC removes OSC 10/11/12 (and 110–112) color set/report sequences.
// These often pollute scrollback after theme queries and replay as garbage.
func stripColorOSC(in []byte) []byte {
	if !bytes.Contains(in, []byte{0x1b, ']'}) {
		return in
	}
	out := make([]byte, 0, len(in))
	i := 0
	for i < len(in) {
		if in[i] == 0x1b && i+1 < len(in) && in[i+1] == ']' {
			rest := in[i+2:]
			ps, n := readOSCPs(rest)
			if n >= 0 && isColorOSC(ps) {
				termAt := findOSCTerm(rest[n:])
				if termAt >= 0 {
					i += 2 + n + termAt
					continue
				}
			}
		}
		out = append(out, in[i])
		i++
	}
	return out
}

func readOSCPs(b []byte) (ps int, n int) {
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

func isColorOSC(ps int) bool {
	switch ps {
	case 10, 11, 12, 110, 111, 112:
		return true
	default:
		return false
	}
}

func findOSCTerm(b []byte) int {
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

// ExtractWindowTitles returns OSC 0/2 window titles from a PTY chunk, in order.
func ExtractWindowTitles(in []byte) []string {
	if !bytes.Contains(in, []byte{0x1b, ']'}) {
		return nil
	}
	var titles []string
	i := 0
	for i < len(in) {
		if in[i] == 0x1b && i+1 < len(in) && in[i+1] == ']' {
			rest := in[i+2:]
			ps, n := readOSCPs(rest)
			if n >= 0 && (ps == 0 || ps == 2) {
				termAt := findOSCTerm(rest[n:])
				if termAt >= 0 {
					payload := rest[n : n+termAt]
					title := decodeOSCTitlePayload(payload)
					if title != "" {
						titles = append(titles, title)
					}
					i += 2 + n + termAt
					continue
				}
			}
		}
		i++
	}
	return titles
}

func decodeOSCTitlePayload(payload []byte) string {
	if len(payload) == 0 {
		return ""
	}
	if payload[len(payload)-1] == 0x07 {
		payload = payload[:len(payload)-1]
	} else if len(payload) >= 2 && payload[len(payload)-2] == 0x1b && payload[len(payload)-1] == '\\' {
		payload = payload[:len(payload)-2]
	}
	return strings.TrimSpace(string(payload))
}
