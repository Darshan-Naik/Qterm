package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"

	"qterm/internal/appmode"
)

type SplitNode struct {
	Type      string      `json:"type"` // "leaf" | "split"
	ID        string      `json:"id,omitempty"`
	SessionID string      `json:"sessionId,omitempty"`
	Direction string      `json:"direction,omitempty"` // "horizontal" | "vertical"
	Size      float64     `json:"size,omitempty"`
	Children  []SplitNode `json:"children,omitempty"`
}

type SessionMeta struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	ProjectID  string `json:"projectId"` // "" or "home" = unbound
	Cwd        string `json:"cwd"`
	Pinned     bool   `json:"pinned"`
	NameLocked bool   `json:"nameLocked,omitempty"` // user renamed — skip auto title sync
	AutoTitled bool   `json:"autoTitled,omitempty"` // first-prompt / agent title already applied
}

type ProjectMeta struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Path string `json:"path"`
}

type LayoutStore map[string]SplitNode // keyed by project id or "home"

type AppConfig struct {
	Projects    []ProjectMeta `json:"projects"`
	Sessions    []SessionMeta `json:"sessions"`
	Layouts     LayoutStore   `json:"layouts"`
	ActiveScope string        `json:"activeScope"`
	Theme       string        `json:"theme"` // system | dark | light
	Shell       string        `json:"shell"`
	FontSize    int           `json:"fontSize"`
	// AgentCLIs maps connected CLI plugin id → qterm plugin version at connect/update time.
	// Compared to the app's current plugin version to detect stale installs.
	AgentCLIs map[string]string `json:"agentCLIs,omitempty"`
}

type Store struct {
	mu   sync.RWMutex
	path string
	cfg  AppConfig
}

func DefaultConfig() AppConfig {
	return AppConfig{
		Projects:    []ProjectMeta{},
		Sessions:    []SessionMeta{},
		Layouts:     LayoutStore{},
		ActiveScope: "_default",
		Theme:       "system",
		Shell:       "",
		FontSize:    13,
		AgentCLIs:   map[string]string{},
	}
}

func NewStore() (*Store, error) {
	dir, err := os.UserConfigDir()
	if err != nil {
		return nil, err
	}
	// Prod: ~/Library/Application Support/q-term
	// Dev (wails dev): …/q-term-dev — avoids clobbering prod sessions/bridge.
	base := filepath.Join(dir, appmode.DataDir)
	if err := os.MkdirAll(base, 0o755); err != nil {
		return nil, err
	}
	path := filepath.Join(base, "config.json")
	s := &Store{path: path, cfg: DefaultConfig()}
	_ = s.Load()
	// Persist migrations (legacy quick/home → _default) if any.
	_ = s.Save()
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
	if cfg.ActiveScope == "" {
		cfg.ActiveScope = "_default"
	}
	// Migrate legacy "quick"/"home" unbound ids to empty projectId.
	for i := range cfg.Sessions {
		if cfg.Sessions[i].ProjectID == "quick" || cfg.Sessions[i].ProjectID == "home" {
			cfg.Sessions[i].ProjectID = ""
		}
	}
	if layout, ok := cfg.Layouts["quick"]; ok {
		cfg.Layouts["_default"] = layout
		delete(cfg.Layouts, "quick")
	}
	if layout, ok := cfg.Layouts["home"]; ok {
		if _, exists := cfg.Layouts["_default"]; !exists {
			cfg.Layouts["_default"] = layout
		}
		delete(cfg.Layouts, "home")
	}
	if cfg.ActiveScope == "quick" || cfg.ActiveScope == "home" {
		cfg.ActiveScope = "_default"
	}
	if cfg.Sessions == nil {
		cfg.Sessions = []SessionMeta{}
	}
	if cfg.Projects == nil {
		cfg.Projects = []ProjectMeta{}
	}
	if cfg.AgentCLIs == nil {
		cfg.AgentCLIs = map[string]string{}
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
