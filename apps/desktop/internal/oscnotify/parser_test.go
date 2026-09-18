package oscnotify

import (
	"bytes"
	"testing"
)

func TestParseOSC9(t *testing.T) {
	var p Parser
	forward, events := p.Feed([]byte("\x1b]9;Claude needs input\x07"))
	if len(events) != 1 || events[0].Body != "Claude needs input" {
		t.Fatalf("got %#v", events)
	}
	if len(forward) != 0 {
		t.Fatalf("expected stripped forward, got %q", forward)
	}
}

func TestParseOSC777(t *testing.T) {
	var p Parser
	forward, events := p.Feed([]byte("\x1b]777;notify;Build;done\x1b\\"))
	if len(events) != 1 || events[0].Title != "Build" || events[0].Body != "done" {
		t.Fatalf("got %#v", events)
	}
	if len(forward) != 0 {
		t.Fatalf("expected stripped, got %q", forward)
	}
}

func TestParseOSC99(t *testing.T) {
	var p Parser
	forward, events := p.Feed([]byte("\x1b]99;i=1:d=0;notify;Waiting;Approve tool\x07"))
	if len(events) != 1 || events[0].Title != "Waiting" || events[0].Body != "Approve tool" {
		t.Fatalf("got %#v", events)
	}
	if len(forward) != 0 {
		t.Fatalf("expected stripped, got %q", forward)
	}
}

func TestKeepsOtherOSCAndText(t *testing.T) {
	var p Parser
	in := []byte("hi\x1b]0;title\x07there\x1b]133;A\x07")
	forward, events := p.Feed(in)
	if len(events) != 0 {
		t.Fatalf("expected none, got %#v", events)
	}
	if !bytes.Equal(forward, in) {
		t.Fatalf("forward changed: %q", forward)
	}
}

func TestStripsNotifyKeepsNeighbors(t *testing.T) {
	var p Parser
	forward, events := p.Feed([]byte("before\x1b]9;ping\x07after"))
	if len(events) != 1 || events[0].Body != "ping" {
		t.Fatalf("got %#v", events)
	}
	if string(forward) != "beforeafter" {
		t.Fatalf("forward=%q", forward)
	}
}

func TestSplitAcrossChunks(t *testing.T) {
	var p Parser
	fwd, ev := p.Feed([]byte("pre\x1b]9;partial"))
	if len(ev) != 0 {
		t.Fatalf("premature %#v", ev)
	}
	if string(fwd) != "pre" {
		t.Fatalf("held incomplete poorly: %q", fwd)
	}
	forward, events := p.Feed([]byte(" message\x07post"))
	if len(events) != 1 || events[0].Body != "partial message" {
		t.Fatalf("got %#v", events)
	}
	if string(forward) != "post" {
		t.Fatalf("forward=%q", forward)
	}
}
