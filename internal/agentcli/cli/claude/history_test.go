package claude

import (
	"os"
	"path/filepath"
	"testing"

	"qterm/internal/agentcli/core"
)

func TestListSessionsTitleAndBody(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	dir := filepath.Join(home, ".claude")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	body := `{"display":"fix login bug","timestamp":1700000000000,"project":"/tmp/app","sessionId":"aaa-1"}
{"display":"also check oauth token refresh path","timestamp":1700000001000,"project":"/tmp/app","sessionId":"aaa-1"}
{"display":"unrelated","timestamp":1700000002000,"project":"/tmp/other","sessionId":"bbb-2"}
`
	if err := os.WriteFile(filepath.Join(dir, "history.jsonl"), []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}

	a := New()
	titleHits, err := a.ListSessions(core.SessionQuery{Query: "login", Limit: 10})
	if err != nil {
		t.Fatal(err)
	}
	if len(titleHits) != 1 || titleHits[0].ID != "aaa-1" || titleHits[0].Match != "title" {
		t.Fatalf("title hits: %+v", titleHits)
	}

	bodyHits, err := a.ListSessions(core.SessionQuery{Query: "oauth token", Limit: 10})
	if err != nil {
		t.Fatal(err)
	}
	if len(bodyHits) != 1 || bodyHits[0].ID != "aaa-1" || bodyHits[0].Match != "body" {
		t.Fatalf("body hits: %+v", bodyHits)
	}

	spec, err := a.Resume("aaa-1")
	if err != nil {
		t.Fatal(err)
	}
	if spec.Command != "claude --resume aaa-1" {
		t.Fatalf("cmd %q", spec.Command)
	}
}
