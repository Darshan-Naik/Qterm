package grok

import (
	"strings"
	"testing"
)

func TestSetPluginEnabled(t *testing.T) {
	got := setPluginEnabled("", "qterm", true)
	if !strings.Contains(got, `enabled = ["qterm"]`) {
		t.Fatalf("empty file: %q", got)
	}

	base := "[cli]\ninstaller = \"internal\"\n"
	got = setPluginEnabled(base, "qterm", true)
	if !strings.Contains(got, `enabled = ["qterm"]`) || !strings.Contains(got, "[cli]") {
		t.Fatalf("append plugins: %q", got)
	}

	withPlugins := base + "\n[plugins]\npaths = [\"~/extra\"]\n"
	got = setPluginEnabled(withPlugins, "qterm", true)
	if !strings.Contains(got, `"qterm"`) || !strings.Contains(got, "paths") {
		t.Fatalf("insert enabled: %q", got)
	}

	already := "[plugins]\nenabled = [\"foo\"]\n"
	got = setPluginEnabled(already, "qterm", true)
	if !strings.Contains(got, `"foo"`) || !strings.Contains(got, `"qterm"`) {
		t.Fatalf("add to list: %q", got)
	}
	if strings.Count(setPluginEnabled(got, "qterm", true), `"qterm"`) != 1 {
		t.Fatalf("duplicate: %q", got)
	}

	off := setPluginEnabled(got, "qterm", false)
	if strings.Contains(off, `"qterm"`) || !strings.Contains(off, `"foo"`) {
		t.Fatalf("disable: %q", off)
	}

	if got := setPluginEnabled(base, "qterm", false); got != base {
		t.Fatalf("disable missing section mutated file: %q", got)
	}
}
