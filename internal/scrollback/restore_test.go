package scrollback

import (
	"bytes"
	"testing"
)

func TestStripAltScreenKeepsPrimary(t *testing.T) {
	in := []byte("hello\n\x1b[?1049hTUI FRAME\x1b[?1049lworld\n")
	got := stripAltScreen(in)
	if !bytes.Equal(got, []byte("hello\nworld\n")) {
		t.Fatalf("got %q", got)
	}
}

func TestStripAltScreenUnmatchedDropsTail(t *testing.T) {
	in := []byte("prompt$\n\x1b[?1049hCodex conversation")
	got := stripAltScreen(in)
	if !bytes.Equal(got, []byte("prompt$\n")) {
		t.Fatalf("got %q", got)
	}
}

func TestStripAltScreenCombinedModes(t *testing.T) {
	in := []byte("a\x1b[?1;1049hINSIDE\x1b[?1;1049lb")
	got := stripAltScreen(in)
	if !bytes.Equal(got, []byte("ab")) {
		t.Fatalf("got %q", got)
	}
}

func TestClearCommandIsNotTUI(t *testing.T) {
	in := []byte("before\n\x1b[H\x1b[2Jafter\n")
	got := restoreFilter(in)
	if !bytes.Equal(got, in) {
		t.Fatalf("clear should stay in history, got %q", got)
	}
}

func TestFullscreenTUIDroppedFromErase(t *testing.T) {
	var in []byte
	in = append(in, []byte("zsh% ls\nfile.txt\n")...)
	in = append(in, []byte("\x1b[?25l\x1b[2J")...)
	for i := 0; i < 10; i++ {
		in = append(in, []byte("\x1b[HCodex TUI frame\n")...)
	}
	got := restoreFilter(in)
	if bytes.Contains(got, []byte("Codex TUI")) {
		t.Fatalf("TUI leaked: %q", got)
	}
	if !bytes.Contains(got, []byte("file.txt")) {
		t.Fatalf("lost shell history: %q", got)
	}
}

func TestRestoreFilterAltThenShell(t *testing.T) {
	in := []byte("ready\n\x1b[?1049hUI\x1b[?1049l$ ")
	got := restoreFilter(in)
	if !bytes.Equal(got, []byte("ready\n$ ")) {
		t.Fatalf("got %q", got)
	}
}
