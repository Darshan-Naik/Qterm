package core

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestMergePATHDedupesAndKeepsOrder(t *testing.T) {
	got := mergePATH("/a:/b", "/b:/c", "/a", "/d")
	want := strings.Join([]string{"/a", "/b", "/c", "/d"}, string(os.PathListSeparator))
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestCommonUserBinDirsIncludesHomeLocal(t *testing.T) {
	home, err := os.UserHomeDir()
	if err != nil {
		t.Skip(err)
	}
	dirs := commonUserBinDirs()
	want := filepath.Join(home, ".local", "bin")
	found := false
	for _, d := range dirs {
		if d == want {
			found = true
			break
		}
	}
	if !found {
		t.Fatalf("expected %s in %v", want, dirs)
	}
}

func TestEnsureUserPathIdempotent(t *testing.T) {
	before := os.Getenv("PATH")
	t.Cleanup(func() { _ = os.Setenv("PATH", before) })

	EnsureUserPath()
	once := os.Getenv("PATH")
	EnsureUserPath()
	twice := os.Getenv("PATH")
	if once != twice {
		t.Fatalf("PATH changed on second EnsureUserPath")
	}
	if !strings.Contains(once, string(os.PathListSeparator)) && once == "" {
		t.Fatalf("empty PATH after EnsureUserPath")
	}
}
