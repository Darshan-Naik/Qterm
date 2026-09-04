package core

import (
	"os"
	"path/filepath"
	"testing"
)

func TestLastCustomTitleFromJSONL(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "s.jsonl")
	body := "" +
		"{\"type\":\"user\",\"message\":\"hi\"}\n" +
		"{\"type\":\"custom-title\",\"customTitle\":\"old-name\"}\n" +
		"{\"type\":\"ai-title\",\"aiTitle\":\"Ignore this sentence title\"}\n" +
		"{\"type\":\"custom-title\",\"customTitle\":\"fix-auth-token-expiry\"}\n"
	if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
	got := LastCustomTitleFromJSONL(path)
	if got != "fix-auth-token-expiry" {
		t.Fatalf("got %q", got)
	}
	if LastCustomTitleFromJSONL(filepath.Join(dir, "missing.jsonl")) != "" {
		t.Fatal("missing file should be empty")
	}
}
