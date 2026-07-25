package main

import (
	"testing"

	"qterm/internal/config"
	ptymgr "qterm/internal/pty"
)

func TestManualRenameBlocksAutoSync(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	a := &App{
		store: store,
		pty:   ptymgr.NewManager("/bin/zsh", nil, nil),
	}
	sess, err := a.pty.Create(ptymgr.CreateOpts{ID: "t1", Name: "Alpha", Cwd: t.TempDir()})
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = a.pty.Kill(sess.ID) }()
	_ = store.Update(func(cfg *config.AppConfig) {
		cfg.Sessions = []config.SessionMeta{{ID: sess.ID, Name: sess.Name, Cwd: sess.Cwd}}
	})

	if !a.RenameSession(sess.ID, "My Tab") {
		t.Fatal("user rename failed")
	}
	if !a.isNameLocked(sess.ID) {
		t.Fatal("expected nameLocked after manual rename")
	}
	if a.applyHookSessionTitle(sess.ID, "Agent Auto Title") {
		t.Fatal("hook session title should not overwrite manual name")
	}
	got, ok := a.pty.Get(sess.ID)
	if !ok || got.Name != "My Tab" {
		t.Fatalf("name want My Tab got %q", got.Name)
	}

	// System fix still applies and does not clear the lock.
	if !a.SetSessionName(sess.ID, "System Fix") {
		t.Fatal("system rename failed")
	}
	if !a.isNameLocked(sess.ID) {
		t.Fatal("system rename should preserve lock")
	}
}

func TestApplyFirstPromptTitleOnce(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	a := &App{
		store: store,
		pty:   ptymgr.NewManager("/bin/zsh", nil, nil),
	}
	sess, err := a.pty.Create(ptymgr.CreateOpts{ID: "t1", Name: "Nebula", Cwd: t.TempDir()})
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = a.pty.Kill(sess.ID) }()
	_ = store.Update(func(cfg *config.AppConfig) {
		cfg.Sessions = []config.SessionMeta{{ID: sess.ID, Name: sess.Name, Cwd: sess.Cwd}}
	})

	if !a.applyFirstPromptTitle(sess.ID, "Fix login redirect") {
		t.Fatal("first prompt title failed")
	}
	if !a.isAutoTitled(sess.ID) {
		t.Fatal("expected autoTitled")
	}
	if a.applyFirstPromptTitle(sess.ID, "Something else entirely") {
		t.Fatal("second prompt should not rename")
	}
	got, _ := a.pty.Get(sess.ID)
	if got.Name != "Fix login redirect" {
		t.Fatalf("got %q", got.Name)
	}

	// Manual lock blocks first-prompt.
	s2, err := a.pty.Create(ptymgr.CreateOpts{ID: "t2", Name: "Comet", Cwd: t.TempDir()})
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = a.pty.Kill(s2.ID) }()
	_ = store.Update(func(cfg *config.AppConfig) {
		cfg.Sessions = append(cfg.Sessions, config.SessionMeta{ID: s2.ID, Name: s2.Name, Cwd: s2.Cwd})
	})
	_ = a.RenameSession(s2.ID, "Keep Me")
	if a.applyFirstPromptTitle(s2.ID, "Should not apply") {
		t.Fatal("locked name should block first prompt")
	}
}

func TestAgentRenameOverridesUserLock(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	a := &App{
		store: store,
		pty:   ptymgr.NewManager("/bin/zsh", nil, nil),
	}
	sess, err := a.pty.Create(ptymgr.CreateOpts{ID: "t1", Name: "Willow", Cwd: t.TempDir()})
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = a.pty.Kill(sess.ID) }()
	_ = store.Update(func(cfg *config.AppConfig) {
		cfg.Sessions = []config.SessionMeta{{ID: sess.ID, Name: sess.Name, Cwd: sess.Cwd}}
	})
	if !a.RenameSession(sess.ID, "Qortex 1") {
		t.Fatal("user rename failed")
	}
	if !a.isNameLocked(sess.ID) {
		t.Fatal("expected lock")
	}
	if !a.renameSession(sess.ID, "Qortex Monorepo", renameAgent) {
		t.Fatal("agent rename should override user lock")
	}
	if a.isNameLocked(sess.ID) {
		t.Fatal("agent rename should clear lock")
	}
	if !a.isAutoTitled(sess.ID) {
		t.Fatal("expected autoTitled after agent rename")
	}
	got, _ := a.pty.Get(sess.ID)
	if got.Name != "Qortex Monorepo" {
		t.Fatalf("got %q", got.Name)
	}
	// First-prompt still blocked after agent title.
	if a.applyFirstPromptTitle(sess.ID, "Should not apply") {
		t.Fatal("autoTitled should block first prompt")
	}
}

func TestRejectAgentStatusTitles(t *testing.T) {
	cases := []string{
		"Action Required | qortex",
		"[.] Action Required | qortex",
		"Needs input",
		"Waiting for input",
		"codex",
		"qortex",
		"claude",
	}
	for _, name := range cases {
		if shouldAdoptAutoTitle(name) {
			t.Fatalf("should reject auto title %q", name)
		}
	}
	if !shouldAdoptAutoTitle("Fix login bug") {
		t.Fatal("should allow descriptive session titles")
	}
	if !shouldAdoptAutoTitle("fix-auth-flow") {
		t.Fatal("should allow hyphenated task slugs")
	}
	if got := stripAgentStatusTitle("Action Required | qortex"); got != "qortex" {
		t.Fatalf("strip got %q", got)
	}
}
