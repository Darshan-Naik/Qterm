package agentbridge

import "testing"

func TestParseHookSessionTitle(t *testing.T) {
	out := ParseHook(ParseInput{
		Source:    "codex",
		Event:     "Stop",
		SessionID: "s1",
		Raw:       map[string]any{"sessionTitle": "Auth flow"},
	})
	var found bool
	for _, in := range out {
		if in.Type == IntentRename {
			found = true
			if in.Payload["name"] != "Auth flow" {
				t.Fatalf("name=%v", in.Payload["name"])
			}
		}
	}
	if !found {
		t.Fatalf("expected rename intent, got %#v", out)
	}
}
