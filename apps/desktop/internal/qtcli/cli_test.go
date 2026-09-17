package qtcli

import (
	"strings"
	"testing"
)

func TestFlagValue(t *testing.T) {
	title, rest := flagValue([]string{"--title", "Hi", "body text"}, "--title", "-t")
	if title != "Hi" || strings.Join(rest, " ") != "body text" {
		t.Fatalf("title=%q rest=%v", title, rest)
	}
	body, rest := flagValue([]string{"--body=done", "x"}, "--body", "-b")
	if body != "done" || len(rest) != 1 || rest[0] != "x" {
		t.Fatalf("body=%q rest=%v", body, rest)
	}
}

func TestHasFlag(t *testing.T) {
	rest, ok := hasFlag([]string{"--focus", "msg"}, "--focus")
	if !ok || len(rest) != 1 || rest[0] != "msg" {
		t.Fatalf("rest=%v ok=%v", rest, ok)
	}
}
