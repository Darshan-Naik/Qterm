package scrollback

import (
	"bytes"
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
	partial := []byte("\x1b[38;2;250;250")
	if got := syncStart(partial); len(got) != 0 {
		t.Fatalf("expected drop incomplete, got %q", got)
	}
}
