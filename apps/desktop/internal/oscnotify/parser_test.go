package oscnotify

import "testing"

func TestParseOSC9(t *testing.T) {
	var p Parser
	events := p.Feed([]byte("\x1b]9;Claude needs input\x07"))
	if len(events) != 1 || events[0].Body != "Claude needs input" {
		t.Fatalf("got %#v", events)
	}
}

func TestParseOSC777(t *testing.T) {
	var p Parser
	events := p.Feed([]byte("\x1b]777;notify;Build;done\x1b\\"))
	if len(events) != 1 || events[0].Title != "Build" || events[0].Body != "done" {
		t.Fatalf("got %#v", events)
	}
}

func TestParseOSC99(t *testing.T) {
	var p Parser
	events := p.Feed([]byte("\x1b]99;i=1:d=0;notify;Waiting;Approve tool\x07"))
	if len(events) != 1 || events[0].Title != "Waiting" || events[0].Body != "Approve tool" {
		t.Fatalf("got %#v", events)
	}
}

func TestIgnoresOtherOSC(t *testing.T) {
	var p Parser
	events := p.Feed([]byte("\x1b]0;title\x07hello\x1b]133;A\x07"))
	if len(events) != 0 {
		t.Fatalf("expected none, got %#v", events)
	}
}

func TestSplitAcrossChunks(t *testing.T) {
	var p Parser
	if ev := p.Feed([]byte("\x1b]9;partial")); len(ev) != 0 {
		t.Fatalf("premature %#v", ev)
	}
	events := p.Feed([]byte(" message\x07"))
	if len(events) != 1 || events[0].Body != "partial message" {
		t.Fatalf("got %#v", events)
	}
}
