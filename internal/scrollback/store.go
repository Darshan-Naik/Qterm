package scrollback

import (
	"os"
	"path/filepath"
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

type buffer struct {
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

// Append stores chunk and returns the buffer sequence after the write.
func (s *Store) Append(id string, chunk []byte) uint64 {
	if id == "" || len(chunk) == 0 {
		return 0
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	b := s.bufs[id]
	if b == nil {
		b = &buffer{}
		s.bufs[id] = b
	}
	b.data = append(b.data, chunk...)
	if len(b.data) > s.max {
		b.data = append([]byte(nil), b.data[len(b.data)-s.max:]...)
	}
	b.seq++
	s.dirty[id] = true
	select {
	case s.saveCh <- struct{}{}:
	default:
	}
	return b.seq
}

func (s *Store) Snapshot(id string) (data []byte, seq uint64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	b := s.bufs[id]
	if b == nil || len(b.data) == 0 {
		return nil, 0
	}
	out := make([]byte, len(b.data))
	copy(out, b.data)
	return out, b.seq
}

// Load reads a session's scrollback from disk into memory (before PTY restore).
func (s *Store) Load(id string) {
	data, err := os.ReadFile(s.path(id))
	if err != nil || len(data) == 0 {
		return
	}
	if len(data) > s.max {
		data = data[len(data)-s.max:]
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	s.bufs[id] = &buffer{data: append([]byte(nil), data...), seq: 1}
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
			snapshots[id] = append([]byte(nil), b.data...)
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
