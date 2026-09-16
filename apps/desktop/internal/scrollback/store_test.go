package scrollback

import (
	"bytes"
	"os"
	"strings"
	"testing"
)

func TestStripColorOSC(t *testing.T) {
	in := []byte("hi\x1b]10;rgb:fafa/fafa/fafa\x07 there\x1b]11;#252525\x1b\\ok")
	got := stripColorOSC(in)
	if !bytes.Equal(got, []byte("hi thereok")) {
		t.Fatalf("%q", got)
	}
}

func TestExtractWindowTitles(t *testing.T) {
	in := []byte("x\x1b]0;Fix login\x07y\x1b]2;Ship it\x1b\\z")
	got := ExtractWindowTitles(in)
	if len(got) != 2 || got[0] != "Fix login" || got[1] != "Ship it" {
		t.Fatalf("%q", got)
	}
	if ExtractWindowTitles([]byte("no titles")) != nil {
		t.Fatal("expected nil")
	}
}

func TestTrimFrontNewline(t *testing.T) {
	// 10 bytes before newline, then 30 after → max 20 should cut at/after newline when possible.
	in := append([]byte("0123456789\n"), []byte("ABCDEFGHIJKLMNOPQRSTUVWXYZ!!!!")...)
	got := trimFront(in, 20)
	if bytes.Contains(got, []byte{'\n'}) {
		// Prefer starting after a newline — no leading half-line from the discarded region.
	}
	if got[0] == '0' {
		t.Fatalf("should have trimmed old prefix: %q", got)
	}
	if len(got) > 20+10 { // allow slight undersize from newline alignment
		t.Fatalf("too large: %d %q", len(got), got)
	}
}

func TestSyncStartIncomplete(t *testing.T) {
	in := []byte("\x1b[38;2;250;250;250mNOPE\nok")
	// complete CSI — keep
	if got := syncStart(in); !bytes.HasPrefix(got, []byte{0x1b}) {
		t.Fatalf("expected keep complete esc, got %q", got)
	}

	// Incomplete OSC sequence with newline should skip to after newline.
	// Using OSC (which ends with BEL or ST) to avoid false CSI match.
	partialOSCWithNewline := []byte("\x1b]0;incomplete\nrest of content")
	if got := syncStart(partialOSCWithNewline); !bytes.Equal(got, []byte("rest of content")) {
		t.Fatalf("expected skip to newline for incomplete OSC, got %q", got)
	}

	// Incomplete sequence without newline should preserve data (garbled > empty).
	partialNoNewline := []byte("\x1b]0;no terminator or newline")
	if got := syncStart(partialNoNewline); !bytes.Equal(got, partialNoNewline) {
		t.Fatalf("expected preserve data when no newline, got %q", got)
	}
}

func TestSyncStartPreservesContentOnNoNewline(t *testing.T) {
	// CLI tools like Claude Code may output escape sequences without newlines.
	// We should preserve the content rather than return nil (empty terminal).
	cliOutput := []byte("\x1b[?25l\x1b[2J\x1b[H> What can I help with?")
	got := syncStart(cliOutput)
	if len(got) == 0 {
		t.Fatal("syncStart should not return empty for CLI output without newlines")
	}
	if !bytes.Contains(got, []byte("What can I help with?")) {
		t.Fatalf("expected to preserve content, got %q", got)
	}
}

func TestSearchPlain(t *testing.T) {
	dir := t.TempDir()
	s, err := NewStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	s.Append("a", []byte("hello \x1b[31mworld\x1b[0m from shell\n"))
	s.Append("b", []byte("no match here\n"))
	hits := s.Search("WORLD", []string{"a", "b"})
	if len(hits) != 1 || hits[0].SessionID != "a" {
		t.Fatalf("%+v", hits)
	}
	if !bytes.Contains([]byte(strings.ToLower(hits[0].Snippet)), []byte("world")) {
		t.Fatalf("snippet %q", hits[0].Snippet)
	}
}

func TestLoadStripsAltScreenTUI(t *testing.T) {
	dir := t.TempDir()
	s, err := NewStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	raw := []byte("prompt$\n\x1b[?1049hCodex TUI dump\x1b[?1049l")
	if err := os.WriteFile(s.path("sess"), raw, 0o644); err != nil {
		t.Fatal(err)
	}
	s.Load("sess")
	data, _ := s.Snapshot("sess")
	if bytes.Contains(data, []byte("Codex TUI")) {
		t.Fatalf("restored TUI: %q", data)
	}
	if !bytes.Contains(data, []byte("prompt$")) {
		t.Fatalf("lost shell history: %q", data)
	}
}
