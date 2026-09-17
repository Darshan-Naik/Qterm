package grok

import (
	"os"
	"path/filepath"
	"testing"

	"qterm/internal/agentcli/core"
)

func TestListSessionsTitleAndBody(t *testing.T) {
	home := t.TempDir()
	t.Setenv("GROK_HOME", home)
	t.Setenv("HOME", home)

	cwd := "/tmp/app"
	id := "01a0ae11-1c19-71a3-bd22-c2e9f400bc92"
	dir := filepath.Join(home, "sessions", "%2Ftmp%2Fapp", id)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	summary := `{
  "info": {"id": "` + id + `", "cwd": "` + cwd + `"},
  "generated_title": "Fix login redirect",
  "session_summary": "Fix login redirect",
  "updated_at": "2026-09-17T06:32:39.018200Z",
  "last_active_at": "2026-09-17T06:32:35.641036Z"
}`
	if err := os.WriteFile(filepath.Join(dir, "summary.json"), []byte(summary), 0o644); err != nil {
		t.Fatal(err)
	}
	history := `{"type":"user","content":[{"type":"text","text":"<user_query>\nfix login bug\n</user_query>"}]}
{"type":"user","synthetic_reason":"system_reminder","content":[{"type":"text","text":"<system-reminder>\nignore\n</system-reminder>"}]}
{"type":"user","content":[{"type":"text","text":"<user_query>\nalso check oauth token refresh path\n</user_query>"}]}
`
	if err := os.WriteFile(filepath.Join(dir, "chat_history.jsonl"), []byte(history), 0o644); err != nil {
		t.Fatal(err)
	}

	a := New()
	titleHits, err := a.ListSessions(core.SessionQuery{Query: "login", Limit: 10})
	if err != nil {
		t.Fatal(err)
	}
	if len(titleHits) != 1 || titleHits[0].ID != id || titleHits[0].Match != "title" {
		t.Fatalf("title hits: %+v", titleHits)
	}
	if titleHits[0].Cwd != cwd {
		t.Fatalf("cwd %q", titleHits[0].Cwd)
	}

	bodyHits, err := a.ListSessions(core.SessionQuery{Query: "oauth token", Limit: 10})
	if err != nil {
		t.Fatal(err)
	}
	if len(bodyHits) != 1 || bodyHits[0].ID != id || bodyHits[0].Match != "body" {
		t.Fatalf("body hits: %+v", bodyHits)
	}

	spec, err := a.Resume(id)
	if err != nil {
		t.Fatal(err)
	}
	if spec.Command != "grok --resume "+id {
		t.Fatalf("cmd %q", spec.Command)
	}
	if spec.Cwd != cwd {
		t.Fatalf("resume cwd %q", spec.Cwd)
	}
}

func TestDecodeCwdFromDotFile(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, ".cwd"), []byte("/Users/me/proj\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if got := decodeCwd(dir, "slug-hash"); got != "/Users/me/proj" {
		t.Fatalf("got %q", got)
	}
}
