package pty

import (
	"io"
	"os"
	"os/exec"
	"runtime"
	"sync"
	"time"

	"github.com/creack/pty"
	"github.com/google/uuid"
)

type Session struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	ProjectID string    `json:"projectId"`
	Cwd       string    `json:"cwd"`
	Pinned    bool      `json:"pinned"`
	CreatedAt time.Time `json:"createdAt"`

	cmd    *exec.Cmd
	ptmx   *os.File
	mu     sync.Mutex
	closed bool
}

type DataHandler func(sessionID string, data []byte)
type ExitHandler func(sessionID string, code int)

type Manager struct {
	mu       sync.RWMutex
	sessions map[string]*Session
	shell    string
	onData   DataHandler
	onExit   ExitHandler
}

func NewManager(shell string, onData DataHandler, onExit ExitHandler) *Manager {
	if shell == "" {
		shell = defaultShell()
	}
	return &Manager{
		sessions: make(map[string]*Session),
		shell:    shell,
		onData:   onData,
		onExit:   onExit,
	}
}

func defaultShell() string {
	if sh := os.Getenv("SHELL"); sh != "" {
		return sh
	}
	if runtime.GOOS == "windows" {
		return "powershell.exe"
	}
	return "/bin/zsh"
}

func (m *Manager) SetShell(shell string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if shell != "" {
		m.shell = shell
	}
}

type CreateOpts struct {
	ID        string
	Name      string
	ProjectID string
	Cwd       string
	Pinned    bool
}

func (m *Manager) Create(opts CreateOpts) (*Session, error) {
	id := opts.ID
	if id == "" {
		id = uuid.NewString()
	}
	name := opts.Name
	if name == "" {
		name = "Terminal"
	}
	cwd := opts.Cwd
	if cwd == "" {
		home, err := os.UserHomeDir()
		if err == nil {
			cwd = home
		}
	}

	m.mu.RLock()
	shell := m.shell
	m.mu.RUnlock()

	cmd := exec.Command(shell)
	cmd.Dir = cwd
	cmd.Env = append(os.Environ(), "TERM=xterm-256color", "COLORTERM=truecolor")

	ptmx, err := pty.Start(cmd)
	if err != nil {
		return nil, err
	}
	_ = pty.Setsize(ptmx, &pty.Winsize{Rows: 24, Cols: 80})

	sess := &Session{
		ID:        id,
		Name:      name,
		ProjectID: opts.ProjectID,
		Cwd:       cwd,
		Pinned:    opts.Pinned,
		CreatedAt: time.Now(),
		cmd:       cmd,
		ptmx:      ptmx,
	}

	m.mu.Lock()
	m.sessions[id] = sess
	m.mu.Unlock()

	go m.readLoop(sess)
	go m.waitLoop(sess)

	return sess, nil
}

func (m *Manager) readLoop(sess *Session) {
	buf := make([]byte, 4096)
	for {
		n, err := sess.ptmx.Read(buf)
		if n > 0 && m.onData != nil {
			chunk := make([]byte, n)
			copy(chunk, buf[:n])
			m.onData(sess.ID, chunk)
		}
		if err != nil {
			return
		}
	}
}

func (m *Manager) waitLoop(sess *Session) {
	err := sess.cmd.Wait()
	code := 0
	if err != nil {
		if ee, ok := err.(*exec.ExitError); ok {
			code = ee.ExitCode()
		} else {
			code = 1
		}
	}
	sess.mu.Lock()
	sess.closed = true
	sess.mu.Unlock()
	_ = sess.ptmx.Close()
	m.mu.Lock()
	delete(m.sessions, sess.ID)
	m.mu.Unlock()
	if m.onExit != nil {
		m.onExit(sess.ID, code)
	}
}

func (m *Manager) Write(id string, data []byte) error {
	m.mu.RLock()
	sess, ok := m.sessions[id]
	m.mu.RUnlock()
	if !ok {
		return io.ErrClosedPipe
	}
	_, err := sess.ptmx.Write(data)
	return err
}

func (m *Manager) Resize(id string, cols, rows uint16) error {
	m.mu.RLock()
	sess, ok := m.sessions[id]
	m.mu.RUnlock()
	if !ok {
		return io.ErrClosedPipe
	}
	return pty.Setsize(sess.ptmx, &pty.Winsize{Rows: rows, Cols: cols})
}

func (m *Manager) Kill(id string) error {
	m.mu.RLock()
	sess, ok := m.sessions[id]
	m.mu.RUnlock()
	if !ok {
		return nil
	}
	if sess.cmd.Process != nil {
		_ = sess.cmd.Process.Kill()
	}
	return nil
}

func (m *Manager) Rename(id, name string) bool {
	m.mu.RLock()
	sess, ok := m.sessions[id]
	m.mu.RUnlock()
	if !ok {
		return false
	}
	sess.Name = name
	return true
}

func (m *Manager) Get(id string) (*Session, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	s, ok := m.sessions[id]
	return s, ok
}

func (m *Manager) List() []*Session {
	m.mu.RLock()
	defer m.mu.RUnlock()
	out := make([]*Session, 0, len(m.sessions))
	for _, s := range m.sessions {
		out = append(out, s)
	}
	return out
}

func (m *Manager) CloseAll() {
	m.mu.RLock()
	ids := make([]string, 0, len(m.sessions))
	for id := range m.sessions {
		ids = append(ids, id)
	}
	m.mu.RUnlock()
	for _, id := range ids {
		_ = m.Kill(id)
	}
}
