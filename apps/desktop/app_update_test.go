package main

import (
	"testing"

	"qterm/internal/appmode"
	"qterm/internal/config"
	"qterm/internal/update"
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

func TestNoteLaunchVersionAnnouncesUpgrade(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	prev := appmode.AppVersion
	t.Cleanup(func() { appmode.AppVersion = prev })
	appmode.AppVersion = "1.7.0"

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	if err := store.Update(func(cfg *config.AppConfig) {
		cfg.LastLaunchedAppVersion = "1.6.1"
	}); err != nil {
		t.Fatal(err)
	}
	a := &App{store: store}
	a.noteLaunchVersion()
	got := a.ConsumeAppUpdated()
	if got.From != "1.6.1" || got.To != "1.7.0" {
		t.Fatalf("applied = %+v", got)
	}
	if store.Get().PendingUpdateFrom != "" {
		t.Fatal("consume should clear pending")
	}
	if store.Get().LastLaunchedAppVersion != "1.7.0" {
		t.Fatalf("last launched = %q", store.Get().LastLaunchedAppVersion)
	}
	if second := a.ConsumeAppUpdated(); second.To != "" {
		t.Fatalf("second consume = %+v", second)
	}
}

func TestNoteLaunchVersionFirstRunSilent(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	prev := appmode.AppVersion
	t.Cleanup(func() { appmode.AppVersion = prev })
	appmode.AppVersion = "1.7.0"

	store, err := config.NewStore()
	if err != nil {
		t.Fatal(err)
	}
	a := &App{store: store}
	a.noteLaunchVersion()
	if got := a.ConsumeAppUpdated(); got.To != "" {
		t.Fatalf("first launch should be silent: %+v", got)
	}
	if store.Get().LastLaunchedAppVersion != "1.7.0" {
		t.Fatalf("last launched = %q", store.Get().LastLaunchedAppVersion)
	}
}

func TestDropStaleDownload(t *testing.T) {
	a := &App{upd: &appUpdateDL{
		prog: update.Progress{Version: "1.6.2", State: update.StateReady},
	}}
	a.dropStaleDownload("1.7.0")
	if a.upd.prog.Version != "" || a.upd.prog.State != "" {
		t.Fatalf("stale download kept: %+v", a.upd.prog)
	}
}

func TestDropStaleDownloadKeepsCurrent(t *testing.T) {
	a := &App{upd: &appUpdateDL{
		prog: update.Progress{Version: "1.7.0", State: update.StateDownloading},
	}}
	a.dropStaleDownload("1.7.0")
	if a.upd.prog.State != update.StateDownloading {
		t.Fatalf("%+v", a.upd.prog)
	}
}

func TestListUpdateRiskEmpty(t *testing.T) {
	a := &App{}
	r := a.ListUpdateRisk()
	if r.SessionCount != 0 {
		t.Fatalf("sessionCount = %d", r.SessionCount)
	}
	if r.Busy == nil || len(r.Busy) != 0 {
		t.Fatalf("busy = %#v", r.Busy)
	}
}
