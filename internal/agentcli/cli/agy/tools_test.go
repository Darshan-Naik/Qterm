package agy

import (
	"testing"
)

func TestParsePluginJSON(t *testing.T) {
	raw := `{
  "imports": [
    {
      "name": "qterm",
      "source": "antigravity",
      "importedAt": "2026-08-23T07:37:54Z",
      "components": ["skills", "mcpServers", "hooks"]
    }
  ]
}`
	items := parsePluginList(raw)
	if len(items) != 1 {
		t.Fatalf("got %d items: %+v", len(items), items)
	}
	if items[0].ID != "qterm" || items[0].Name != "qterm" {
		t.Fatalf("unexpected item: %+v", items[0])
	}
	if !items[0].Enabled {
		t.Fatal("expected enabled")
	}
	if !items[0].System {
		t.Fatal("expected system qterm")
	}
}

func TestParsePluginLinesSkipsJSON(t *testing.T) {
	raw := "{\n  \"imports\":\n  \"name\":\n  qterm enabled\n}"
	items := parsePluginLines(raw)
	if len(items) != 1 || items[0].ID != "qterm" {
		t.Fatalf("got %+v", items)
	}
}
