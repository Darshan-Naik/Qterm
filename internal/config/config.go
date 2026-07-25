package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
)

type SplitNode struct {
	Type      string     `json:"type"` // "leaf" | "split"
	ID        string     `json:"id,omitempty"`
	SessionID string     `json:"sessionId,omitempty"`
	Direction string     `json:"direction,omitempty"` // "horizontal" | "vertical"
	Size      float64    `json:"size,omitempty"`
	Children  []SplitNode `json:"children,omitempty"`
}

type SessionMeta struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	ProjectID string `json:"projectId"` // "" = home, "quick" = quick
	Cwd       string `json:"cwd"`
	Pinned    bool   `json:"pinned"`
}

type ProjectMeta struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Path string `json:"path"`
}

type LayoutStore map[string]SplitNode // keyed by project id or "home" / "quick"

type AppConfig struct {
	Projects []ProjectMeta `json:"projects"`
	Sessions []SessionMeta `json:"sessions"`
	Layouts  LayoutStore   `json:"layouts"`
	Theme    string        `json:"theme"` // system | dark | light
	Shell    string        `json:"shell"`
	FontSize int           `json:"fontSize"`
}

type Store struct {
	mu   sync.RWMutex
	path string
	cfg  AppConfig
}

func DefaultConfig() AppConfig {
	return AppConfig{
		Projects: []ProjectMeta{},
		Sessions: []SessionMeta{},
		Layouts:  LayoutStore{},
		Theme:    "system",
		Shell:    "",
		FontSize: 13,
	}
}

func NewStore() (*Store, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}
	base := filepath.Join(dir, "q-term")
	if err := os.MkdirAll(base, 0o755); err != nil {
		return nil, err
	}
	path := filepath.Join(base, "config.json")
	s := &Store{path: path, cfg: DefaultConfig()}
	_ = s.Load()
	return s, nil
}

func (s *Store) Path() string {
	return s.path
}

func (s *Store) DataDir() string {
	return filepath.Dir(s.path)
}

func (s *Store) HooksDir() string {
	dir := filepath.Join(s.DataDir(), "hooks")
	_ = os.MkdirAll(dir, 0o755)
	return dir
}

func (s *Store) Load() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	data, err := os.ReadFile(s.path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	var cfg AppConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return err
	}
	if cfg.Layouts == nil {
		cfg.Layouts = LayoutStore{}
	}
	if cfg.Theme == "" {
		cfg.Theme = "system"
	}
	if cfg.FontSize == 0 {
		cfg.FontSize = 13
	}
	s.cfg = cfg
	return nil
}

func (s *Store) Save() error {
	s.mu.RLock()
	defer s.mu.RUnlock()
	data, err := json.MarshalIndent(s.cfg, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(s.path, data, 0o644)
}

func (s *Store) Get() AppConfig {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.cfg
}

func (s *Store) Update(fn func(cfg *AppConfig)) error {
	s.mu.Lock()
	fn(&s.cfg)
	s.mu.Unlock()
	return s.Save()
}
