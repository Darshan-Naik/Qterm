package termquery

import (
	"bytes"
	"testing"
)

func TestProcessDA(t *testing.T) {
	in := []byte("hello\x1b[c\x1b[0cworld\x1b[>c")
	fwd, replies, urgent := Process(in, DefaultColors)
	if urgent {
		t.Fatalf("DA should not be urgent (answered in-process)")
	}
	if !bytes.Equal(fwd, []byte("helloworld")) {
		t.Fatalf("forward=%q", fwd)
	}
	want := append(append(append([]byte{}, replyPrimaryDA...), replyPrimaryDA...), replySecondaryDA...)
	if !bytes.Equal(replies, want) {
		t.Fatalf("replies=%q want=%q", replies, want)
	}
}

func TestProcessCPRUrgent(t *testing.T) {
	in := []byte("x\x1b[6n\x1b[?6ny")
	fwd, replies, urgent := Process(in, DefaultColors)
	if !urgent {
		t.Fatal("CPR must flush urgently")
	}
	if len(replies) != 0 {
		t.Fatalf("CPR must not be answered on Go side, got %q", replies)
	}
	if !bytes.Equal(fwd, in) {
		t.Fatalf("forward=%q", fwd)
	}
}

func TestProcessStatusDSR(t *testing.T) {
	in := []byte("\x1b[5n")
	fwd, replies, urgent := Process(in, DefaultColors)
	if urgent {
		t.Fatal("status DSR is answered in-process")
	}
	if len(fwd) != 0 {
		t.Fatalf("forward=%q", fwd)
	}
	if !bytes.Equal(replies, []byte("\x1b[0n")) {
		t.Fatalf("replies=%q", replies)
	}
}

func TestProcessOSCColorQuery(t *testing.T) {
	in := []byte("pre\x1b]11;?\x07\x1b]10;?\x1b\\\x1b]12;?\x07post")
	fwd, replies, urgent := Process(in, DefaultColors)
	if urgent {
		t.Fatal("OSC color answered in-process — not urgent for forward")
	}
	if !bytes.Equal(fwd, []byte("prepost")) {
		t.Fatalf("forward=%q", fwd)
	}
	if !bytes.Contains(replies, []byte("\x1b]11;rgb:")) {
		t.Fatalf("missing bg reply: %q", replies)
	}
	if !bytes.Contains(replies, []byte("\x1b]10;rgb:")) {
		t.Fatalf("missing fg reply: %q", replies)
	}
	if !bytes.Contains(replies, []byte("\x1b]12;rgb:")) {
		t.Fatalf("missing cursor reply: %q", replies)
	}
	// ST terminator on replies
	if !bytes.Contains(replies, []byte("\x1b\\")) {
		t.Fatalf("expected ST on replies: %q", replies)
	}
}

func TestProcessMixedPromptQueries(t *testing.T) {
	// Typical p10k burst: color queries + DA + CPR among prompt text.
	in := []byte("\x1b]11;?\x07\x1b[c\x1b[6n")
	fwd, replies, urgent := Process(in, DefaultColors)
	if !urgent {
		t.Fatal("CPR remaining → urgent")
	}
	if !bytes.Equal(fwd, []byte("\x1b[6n")) {
		t.Fatalf("forward=%q", fwd)
	}
	if !bytes.Contains(replies, replyPrimaryDA) {
		t.Fatalf("DA reply missing: %q", replies)
	}
	if !bytes.Contains(replies, []byte("\x1b]11;rgb:")) {
		t.Fatalf("OSC reply missing: %q", replies)
	}
}

func TestContainsUrgentQuery(t *testing.T) {
	if ContainsUrgentQuery([]byte("hello")) {
		t.Fatal("plain text")
	}
	if !ContainsUrgentQuery([]byte("\x1b[6n")) {
		t.Fatal("CPR")
	}
	if !ContainsUrgentQuery([]byte("\x1b]11;?\x07")) {
		t.Fatal("OSC query should flush when detected raw")
	}
	if ContainsUrgentQuery([]byte("\x1b[A")) {
		t.Fatal("cursor up is not a query")
	}
}

func TestHexToXRGB(t *testing.T) {
	got, err := hexToXRGB("#0a0a0a")
	if err != nil {
		t.Fatal(err)
	}
	if got != "rgb:0a0a/0a0a/0a0a" {
		t.Fatalf("got %s", got)
	}
	got, err = hexToXRGB("#fafafa")
	if err != nil {
		t.Fatal(err)
	}
	if got != "rgb:fafa/fafa/fafa" {
		t.Fatalf("got %s", got)
	}
}
