package agentbridge

import "testing"

func TestExtractOSCTitleFromCommand(t *testing.T) {
	cases := map[string]string{
		`printf '\033]0;%s\007' 'codex new'`: "codex new",
		`printf "\033]0;codex session new\007"`: "codex session new",
		`printf '\e]2;%s\a' "hello"`: "hello",
		`ls -la`: "",
	}
	for in, want := range cases {
		got := extractOSCTitleFromCommand(in)
		if got != want {
			t.Fatalf("%q: got %q want %q", in, got, want)
		}
	}
}

func TestTitleFromToolPayload(t *testing.T) {
	raw := map[string]any{
		"tool_input": map[string]any{
			"command": `printf '\033]0;%s\007' 'codex new'`,
		},
	}
	if got := titleFromToolPayload(raw); got != "codex new" {
		t.Fatalf("got %q", got)
	}
}
