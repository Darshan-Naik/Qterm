package agentcli

import (
	"testing"

	"qterm/internal/agentcli/core"
)

func TestAllAdaptersImplementTooling(t *testing.T) {
	for _, a := range All() {
		t.Run(a.ID(), func(t *testing.T) {
			tooling, ok := a.(core.Tooling)
			if !ok {
				t.Fatalf("%s does not implement core.Tooling", a.ID())
			}
			caps := tooling.ToolsCaps()
			if !caps.List {
				t.Fatalf("%s ToolsCaps.List = false", a.ID())
			}
			if len(caps.Kinds) == 0 {
				t.Fatalf("%s ToolsCaps.Kinds empty", a.ID())
			}
		})
	}
}
