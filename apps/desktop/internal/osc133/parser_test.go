package osc133

import "testing"

func TestParserBasicBEL(t *testing.T) {
	var p Parser
	_, ev := p.Feed([]byte("hello\x1b]133;A\x07world\x1b]133;C\x07out\x1b]133;D;0\x07"))
	if len(ev) != 3 {
		t.Fatalf("got %d events: %#v", len(ev), ev)
	}
	if ev[0].Kind != KindPromptStart || ev[1].Kind != KindOutputStart {
		t.Fatalf("kinds: %#v", ev)
	}
	if ev[2].Kind != KindCommandEnd || ev[2].ExitCode != 0 {
		t.Fatalf("end: %#v", ev[2])
	}
}

func TestParserST(t *testing.T) {
	var p Parser
	_, ev := p.Feed([]byte("\x1b]133;B\x1b\\"))
	if len(ev) != 1 || ev[0].Kind != KindPromptEnd {
		t.Fatalf("got %#v", ev)
	}
}

func TestParserSplitChunk(t *testing.T) {
	var p Parser
	_, ev := p.Feed([]byte("\x1b]133;D;"))
	if len(ev) != 0 {
		t.Fatalf("partial should hold, got %#v", ev)
	}
	_, ev = p.Feed([]byte("12\x07next"))
	if len(ev) != 1 || ev[0].ExitCode != 12 {
		t.Fatalf("got %#v", ev)
	}
}

func TestParserIgnoresOtherOSC(t *testing.T) {
	var p Parser
	_, ev := p.Feed([]byte("\x1b]0;title\x07\x1b]133;A\x07"))
	if len(ev) != 1 || ev[0].Kind != KindPromptStart {
		t.Fatalf("got %#v", ev)
	}
}

func TestParserEmpty(t *testing.T) {
	var p Parser
	data, ev := p.Feed(nil)
	if len(data) != 0 || len(ev) != 0 {
		t.Fatal("empty")
	}
}

func TestParserHeldTailExcludedFromData(t *testing.T) {
	var p Parser
	data, ev := p.Feed([]byte("out\x1b]133;D;"))
	if len(ev) != 0 {
		t.Fatalf("partial should hold, got %#v", ev)
	}
	if string(data) != "out" {
		t.Fatalf("held tail leaked into data: %q", data)
	}
	_, ev = p.Feed([]byte("3\x07"))
	if len(ev) != 1 || ev[0].ExitCode != 3 {
		t.Fatalf("got %#v", ev)
	}
}
