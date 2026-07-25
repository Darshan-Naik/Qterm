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
	if a.adoptSessionTitle(sess.ID, "Agent Auto Title") {
		t.Fatal("auto sync should not overwrite manual name")
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
