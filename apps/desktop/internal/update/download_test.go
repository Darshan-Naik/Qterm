package update

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestIsInstallerURL(t *testing.T) {
	if !IsInstallerURL("https://github.com/x/Qterm-macos-arm64.dmg") {
		t.Fatal("dmg")
	}
	if !IsInstallerURL("https://ex/Qterm-macos-arm64.dmg?token=1") {
		t.Fatal("query")
	}
	if IsInstallerURL("https://github.com/Darshan-Naik/Qterm/releases/tag/v1.6.4") {
		t.Fatal("html")
	}
	if IsInstallerURL("") {
		t.Fatal("empty")
	}
}

func TestCacheFile(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	t.Setenv("XDG_CACHE_HOME", t.TempDir())
	path, err := CacheFile("v1.6.5")
	if err != nil {
		t.Fatal(err)
	}
	if filepath.Base(path) != "Qterm-1.6.5-macos-arm64.dmg" {
		t.Fatalf("base = %s", filepath.Base(path))
	}
}

func TestDownloadAndCachedReady(t *testing.T) {
	body := []byte("dmg-bytes-here")
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/octet-stream")
		_, _ = w.Write(body)
	}))
	t.Cleanup(srv.Close)

	dest := filepath.Join(t.TempDir(), "Qterm-1.8.0-macos-arm64.dmg")
	var lastB, lastT int64
	if err := Download(context.Background(), srv.URL, dest, func(b, total int64) {
		lastB, lastT = b, total
	}); err != nil {
		t.Fatal(err)
	}
	got, err := os.ReadFile(dest)
	if err != nil {
		t.Fatal(err)
	}
	if string(got) != string(body) {
		t.Fatalf("got %q", got)
	}
	if lastB != int64(len(body)) {
		t.Fatalf("progress bytes = %d", lastB)
	}
	if lastT != int64(len(body)) {
		t.Fatalf("progress total = %d", lastT)
	}

	// Second fetch with matching size should reuse the file.
	if err := Download(context.Background(), srv.URL, dest, nil); err != nil {
		t.Fatal(err)
	}
}

func TestDownloadHTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "nope", http.StatusBadGateway)
	}))
	t.Cleanup(srv.Close)
	dest := filepath.Join(t.TempDir(), "x.dmg")
	if err := Download(context.Background(), srv.URL, dest, nil); err == nil {
		t.Fatal("expected error")
	}
}

func TestDownloadCancel(t *testing.T) {
	started := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		close(started)
		<-r.Context().Done()
	}))
	t.Cleanup(srv.Close)
	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		<-started
		cancel()
	}()
	dest := filepath.Join(t.TempDir(), "x.dmg")
	err := Download(ctx, srv.URL, dest, nil)
	if err == nil {
		t.Fatal("expected cancel")
	}
}
