package agentbridge

import "testing"

func TestTitleFromPrompt(t *testing.T) {
	cases := map[string]string{
		"refactor the auth module please and add tests": "refactor the auth module please and",
		"Fix login bug": "Fix login bug",
		"/rename foo":   "",
		"<task>noise</task>": "",
		"   hello   world   ": "hello world",
		"a": "",
		"Implement selectable options in the Codex chat UI for this project now": "Implement selectable options in the Codex",
	}
	for in, want := range cases {
		got := TitleFromPrompt(in)
		if got != want {
			t.Fatalf("%q: got %q want %q", in, got, want)
		}
	}
}

func TestParseHookFirstPromptAutoTitle(t *testing.T) {
	intents := ParseHook(ParseInput{
		Source:    "claude",
		Event:     "UserPromptSubmit",
		SessionID: "s1",
		Raw:       map[string]any{"prompt": "Fix the login redirect loop"},
	})
	found := false
	for _, in := range intents {
		if in.Type == "auto_title" {
			found = true
			if in.Payload["name"] != "Fix the login redirect loop" {
				t.Fatalf("payload %#v", in.Payload)
			}
		}
	}
	if !found {
		t.Fatalf("expected auto_title, got %#v", intents)
	}
}

func TestPromptFromRaw(t *testing.T) {
	if got := promptFromRaw(map[string]any{"prompt": "hello"}); got != "hello" {
		t.Fatalf("got %q", got)
	}
}
