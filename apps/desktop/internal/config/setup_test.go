package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNeedsSetupFreshConfig(t *testing.T) {
	cfg := DefaultConfig()
	if !cfg.NeedsSetup() {
		t.Fatal("fresh default config should need first-run setup")
	}
}

func TestNeedsSetupCompleteFlag(t *testing.T) {
	cfg := DefaultConfig()
	cfg.SetupComplete = true
	if cfg.NeedsSetup() {
		t.Fatal("setupComplete should skip first-run setup")
	}
}

func TestNeedsSetupPriorUseSignals(t *testing.T) {
	cases := []struct {
		name string
		mut  func(*AppConfig)
	}{
		{"projects", func(c *AppConfig) { c.Projects = []ProjectMeta{{ID: "p", Name: "App", Path: "/tmp"}} }},
		{"sessions", func(c *AppConfig) { c.Sessions = []SessionMeta{{ID: "s", Name: "zsh"}} }},
		{"agents", func(c *AppConfig) { c.AgentCLIs = map[string]string{"claude": "1"} }},
		{"theme", func(c *AppConfig) { c.Theme = "dark" }},
		{"shell", func(c *AppConfig) { c.Shell = "/bin/zsh" }},
		{"font", func(c *AppConfig) { c.FontSize = DefaultFontSize + 1 }},
		{"ide", func(c *AppConfig) { c.DefaultIDE = "cursor" }},
		{"snippets", func(c *AppConfig) { c.Snippets = []Snippet{{ID: "1", Name: "ls", Body: "ls"}} }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := DefaultConfig()
			tc.mut(&cfg)
			if cfg.NeedsSetup() {
				t.Fatalf("expected prior use to skip setup: %+v", cfg)
			}
		})
	}
}

func TestLoadMigratesPriorUse(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.json")
	raw := []byte(`{"projects":[{"id":"p","name":"App","path":"/tmp"}],"theme":"system","fontSize":12,"activeScope":"_default"}`)
	if err := os.WriteFile(path, raw, 0o644); err != nil {
		t.Fatal(err)
	}
	s := &Store{path: path, cfg: DefaultConfig(), saveCh: make(chan struct{}, 1)}
	if err := s.Load(); err != nil {
		t.Fatal(err)
	}
	if !s.Get().SetupComplete {
		t.Fatal("existing used config should mark setup complete")
	}
	if s.Get().NeedsSetup() {
		t.Fatal("migrated config should not need setup")
	}
}

func TestLoadEmptyFileStillNeedsSetup(t *testing.T) {
	path := filepath.Join(t.TempDir(), "config.json")
	raw := []byte(`{"theme":"system","fontSize":12,"activeScope":"_default"}`)
	if err := os.WriteFile(path, raw, 0o644); err != nil {
		t.Fatal(err)
	}
	s := &Store{path: path, cfg: DefaultConfig(), saveCh: make(chan struct{}, 1)}
	if err := s.Load(); err != nil {
		t.Fatal(err)
	}
	if s.Get().SetupComplete {
		t.Fatal("unused config should not mark setup complete")
	}
	if !s.Get().NeedsSetup() {
		t.Fatal("unused config should still need setup")
	}
}

func TestLoadMissingFileNeedsSetup(t *testing.T) {
	s := &Store{
		path:   filepath.Join(t.TempDir(), "config.json"),
		cfg:    DefaultConfig(),
		saveCh: make(chan struct{}, 1),
	}
	if err := s.Load(); err != nil {
		t.Fatal(err)
	}
	if !s.Get().NeedsSetup() {
		t.Fatal("missing config file should need setup")
	}
}
