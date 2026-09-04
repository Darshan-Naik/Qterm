package main

import (
	"testing"

	"qterm/internal/config"
)

func TestSkipAppUpdate(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	a := &App{store: store}
	if err := a.SkipAppUpdate("v1.8.0"); err != nil {
		t.Fatal(err)
	}
	if got := store.Get().SkippedAppUpdate; got != "1.8.0" {
		t.Fatalf("skipped = %q", got)
	}
	if err := a.SkipAppUpdate("  "); err != nil {
		t.Fatal(err)
	}
	if got := store.Get().SkippedAppUpdate; got != "" {
		t.Fatalf("cleared skipped = %q", got)
	}
}
