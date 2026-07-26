package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"

	"qterm/internal/appmode"
)

const (
	DefaultFontSize = 12
	MinFontSize     = 10
	MaxFontSize     = 24

	DefaultScope = "_default"

	DefaultSidebarWidth = 240
	MinSidebarWidth     = 180
	MaxSidebarWidth     = 480

	DefaultUiZoom = 100
	MinUiZoom     = 80
	MaxUiZoom     = 150
	UiZoomStep    = 10
)

func ClampSidebarWidth(width int) int {
	if width < MinSidebarWidth {
		return MinSidebarWidth
	}
	if width > MaxSidebarWidth {
		return MaxSidebarWidth
	}
	return width
}

func ClampUiZoom(zoom int) int {
	if zoom < MinUiZoom {
		zoom = MinUiZoom
	}
	if zoom > MaxUiZoom {
		zoom = MaxUiZoom
	}
	return ((zoom + UiZoomStep/2) / UiZoomStep) * UiZoomStep
}

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

// KeyChord is a single keyboard shortcut chord (mirrors frontend KeyChord).
type KeyChord struct {
	Key        string   `json:"key"`
	Codes      []string `json:"codes,omitempty"`
	MetaOrCtrl bool     `json:"metaOrCtrl,omitempty"`
	CtrlOnly   bool     `json:"ctrlOnly,omitempty"`
	Shift      bool     `json:"shift,omitempty"`
	Alt        bool     `json:"alt,omitempty"`
}

// KeybindingOverrides maps shortcut id → override chords (defaults live in the app).
type KeybindingOverrides map[string][]KeyChord

type AppConfig struct {
	Projects    []ProjectMeta `json:"projects"`
	Sessions    []SessionMeta `json:"sessions"`
	Layouts     LayoutStore   `json:"layouts"`
	ActiveScope string        `json:"activeScope"`
	Theme       string        `json:"theme"` // system | dark | light
	Shell       string        `json:"shell"`
	FontSize    int           `json:"fontSize"`
	// UI chrome (sidebar / zoom) — app-level, not browser storage.
	SidebarOpen       *bool           `json:"sidebarOpen,omitempty"`
	SidebarWidth      int             `json:"sidebarWidth,omitempty"`
	UiZoom            int             `json:"uiZoom,omitempty"`
	CollapsedProjects map[string]bool `json:"collapsedProjects,omitempty"`
	// AgentCLIs maps connected CLI plugin id → qterm plugin version at connect/update time.
	// Compared to the app's current plugin version to detect stale installs.
	AgentCLIs map[string]string `json:"agentCLIs,omitempty"`
	// Keybindings stores only user overrides of keyboard shortcuts.
	Keybindings KeybindingOverrides `json:"keybindings,omitempty"`
}

// UIPrefs is the subset of config written by the frontend chrome (sidebar/zoom/collapse).
type UIPrefs struct {
	SidebarOpen       bool            `json:"sidebarOpen"`
	SidebarWidth      int             `json:"sidebarWidth"`
	UiZoom            int             `json:"uiZoom"`
	CollapsedProjects map[string]bool `json:"collapsedProjects"`
}

type Store struct {
	mu      sync.RWMutex
	path    string
	cfg     AppConfig
	saveCh  chan struct{}
	stopped bool
}

func DefaultConfig() AppConfig {
	open := true
	return AppConfig{
		Projects:          []ProjectMeta{},
		Sessions:          []SessionMeta{},
		Layouts:           LayoutStore{},
		ActiveScope:       DefaultScope,
		Theme:             "system",
		Shell:             "",
		FontSize:          DefaultFontSize,
		SidebarOpen:       &open,
		SidebarWidth:      DefaultSidebarWidth,
		UiZoom:            DefaultUiZoom,
		CollapsedProjects: map[string]bool{},
		AgentCLIs:         map[string]string{},
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
	s := &Store{
		path:   path,
		cfg:    DefaultConfig(),
		saveCh: make(chan struct{}, 1),
	}
	_ = s.Load()
	// Persist migrations (legacy quick/home → _default) if any.
	_ = s.SaveNow()
	go s.persistLoop()
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
		cfg.FontSize = DefaultFontSize
	}
	if cfg.ActiveScope == "" {
		cfg.ActiveScope = DefaultScope
	}
	if cfg.SidebarWidth <= 0 {
		cfg.SidebarWidth = DefaultSidebarWidth
	}
	if cfg.UiZoom <= 0 {
		cfg.UiZoom = DefaultUiZoom
	}
	if cfg.SidebarOpen == nil {
		open := true
		cfg.SidebarOpen = &open
	}
	if cfg.CollapsedProjects == nil {
		cfg.CollapsedProjects = map[string]bool{}
	}
	// Migrate legacy "quick"/"home" unbound ids to empty projectId.
	for i := range cfg.Sessions {
		if cfg.Sessions[i].ProjectID == "quick" || cfg.Sessions[i].ProjectID == "home" {
			cfg.Sessions[i].ProjectID = ""
		}
	}
	if layout, ok := cfg.Layouts["quick"]; ok {
		cfg.Layouts[DefaultScope] = layout
		delete(cfg.Layouts, "quick")
	}
	if layout, ok := cfg.Layouts["home"]; ok {
		if _, exists := cfg.Layouts[DefaultScope]; !exists {
			cfg.Layouts[DefaultScope] = layout
		}
		delete(cfg.Layouts, "home")
	}
	if cfg.ActiveScope == "quick" || cfg.ActiveScope == "home" {
		cfg.ActiveScope = DefaultScope
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

func (s *Store) SaveNow() error {
	s.mu.RLock()
	data, err := json.MarshalIndent(s.cfg, "", "  ")
	path := s.path
	s.mu.RUnlock()
	if err != nil {
		return err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// Save schedules a debounced flush (non-blocking). Prefer this on hot paths.
func (s *Store) Save() error {
	s.scheduleSave()
	return nil
}

func (s *Store) scheduleSave() {
	select {
	case s.saveCh <- struct{}{}:
	default:
	}
}

func (s *Store) persistLoop() {
	for range s.saveCh {
		s.mu.RLock()
		stopped := s.stopped
		s.mu.RUnlock()
		if stopped {
			return
		}
		// Coalesce rapid Updates (sidebar drag end + theme + layout…).
		time.Sleep(250 * time.Millisecond)
	drain:
		for {
			select {
			case <-s.saveCh:
			default:
				break drain
			}
		}
		_ = s.SaveNow()
	}
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
	s.scheduleSave()
	return nil
}

// Close flushes pending writes. Call on app shutdown.
func (s *Store) Close() {
	s.mu.Lock()
	s.stopped = true
	s.mu.Unlock()
	_ = s.SaveNow()
}
