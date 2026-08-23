package codex

import (
	"testing"

	"qterm/internal/agentcli/core"
)

func TestExtractJSON(t *testing.T) {
	got := core.ExtractJSON("WARNING: nope\n{\"installed\":[]}")
	if got != `{"installed":[]}` {
		t.Fatalf("got %q", got)
	}
}
