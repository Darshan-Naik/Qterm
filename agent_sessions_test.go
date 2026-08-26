package main

import (
	"testing"

	"qterm/internal/config"
	ptymgr "qterm/internal/pty"
)

func TestMatchSessionByCwd(t *testing.T) {
	live := []*ptymgr.Session{
		{ID: "home", Cwd: "/Users/me"},
		{ID: "proj", Cwd: "/Users/me/Projects/q-term"},
		{ID: "other", Cwd: "/Users/me/Projects/other"},
	}
	if got := matchSessionByCwd(live, "/Users/me/Projects/q-term/internal", ""); got != "proj" {
		t.Fatalf("nested cwd → proj, got %q", got)
	}
	if got := matchSessionByCwd(live, "/Users/me/Projects/q-term", ""); got != "proj" {
		t.Fatalf("exact → proj, got %q", got)
	}
	if got := matchSessionByCwd(live, "/tmp/nowhere", ""); got != "" {
		t.Fatalf("no match → empty, got %q", got)
	}
}

func TestMatchSessionByCwdPrefersFocused(t *testing.T) {
	live := []*ptymgr.Session{
		{ID: "t1", Cwd: "/Users/me/proj"},
		{ID: "t2", Cwd: "/Users/me/proj"},
	}
	if got := matchSessionByCwd(live, "/Users/me/proj/src", "t2"); got != "t2" {
		t.Fatalf("prefer focused among same cwd, got %q", got)
	}
}

func TestResolveSessionStickyAcrossFocus(t *testing.T) {
	a := &App{
		pty:       ptymgr.NewManager("/bin/zsh", nil, nil),
		agentBind: map[string]string{},
	}
	s1, err := a.pty.Create(ptymgr.CreateOpts{ID: "t1", Name: "One", Cwd: t.TempDir(), ProjectID: "p1"})
	if err != nil {
		t.Fatal(err)
	}
	s2, err := a.pty.Create(ptymgr.CreateOpts{ID: "t2", Name: "Two", Cwd: t.TempDir(), ProjectID: "p2"})
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = a.pty.Kill(s1.ID); _ = a.pty.Kill(s2.ID) }()

	a.focusedSessionID = s1.ID
	cli := "codex-session-abc"
	got := a.resolveSessionForAgent(cli, s1.Cwd, "")
	if got != s1.ID {
		t.Fatalf("first resolve want %s got %s", s1.ID, got)
	}

	a.focusedSessionID = s2.ID
	got = a.resolveSessionForAgent(cli, s1.Cwd, "")
	if got != s1.ID {
		t.Fatalf("sticky bind want %s got %s (focus moved)", s1.ID, got)
	}

	got = a.resolveSessionForAgent("focused", "", "")
	if got != s1.ID {
		t.Fatalf("mcp focused want last agent %s got %s", s1.ID, got)
	}

	// Explicit QTERM_SESSION_ID wins even with wrong focus / other cli id.
	got = a.resolveSessionForAgent("other-cli", s2.Cwd, s1.ID)
	if got != s1.ID {
		t.Fatalf("explicit qterm id want %s got %s", s1.ID, got)
	}
}

func TestSessionContainsPath(t *testing.T) {
	if !sessionContainsPath("/a/b", "/a/b/c") {
		t.Fatal("expected prefix match")
	}
	if sessionContainsPath("/a/b", "/a/be") {
		t.Fatal("should not match partial segment")
	}
}

func TestPersistSessionAgent(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	a := &App{store: store}
	_ = store.Update(func(cfg *config.AppConfig) {
		cfg.Sessions = []config.SessionMeta{{ID: "t1", Name: "One"}}
	})

	a.syncPersistedAgent("t1", "codex", "cli-abc", "animate", map[string]any{"state": "thinking"})
	got := store.Get().Sessions[0]
	if got.AgentCLI != "codex" || got.AgentSessionID != "cli-abc" {
		t.Fatalf("persist %+v", got)
	}

	a.syncPersistedAgent("t1", "codex", "cli-abc", "animate", map[string]any{"state": "none"})
	got = store.Get().Sessions[0]
	if got.AgentCLI != "" || got.AgentSessionID != "" {
		t.Fatalf("session_end should clear %+v", got)
	}
}
