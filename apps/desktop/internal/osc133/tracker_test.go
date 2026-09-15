package osc133

import (
	"strings"
	"testing"
	"time"
)

func TestTrackerLastOutput(t *testing.T) {
	var got []Result
	tr := NewTracker(func(_ string, res Result) { got = append(got, res) })
	tr.Feed("s", []byte("\x1b]133;A\x07prompt$ \x1b]133;C\x07hello\nworld\n\x1b]133;D;0\x07"))
	res, ok := tr.Last("s")
	if !ok {
		t.Fatal("missing last")
	}
	if !strings.Contains(res.Output, "hello") || !strings.Contains(res.Output, "world") {
		t.Fatalf("output %q", res.Output)
	}
	if res.ExitCode != 0 {
		t.Fatalf("exit %d", res.ExitCode)
	}
	if len(got) != 1 {
		t.Fatalf("callback %d", len(got))
	}
}

func TestTrackerIgnoresOutputWithoutC(t *testing.T) {
	tr := NewTracker(nil)
	tr.Feed("s", []byte("noise\x1b]133;D;1\x07"))
	if _, ok := tr.Last("s"); ok {
		t.Fatal("D without C should not record")
	}
}

func TestTrackerRemove(t *testing.T) {
	tr := NewTracker(nil)
	tr.Feed("s", []byte("\x1b]133;C\x07x\x1b]133;D;0\x07"))
	tr.Remove("s")
	if _, ok := tr.Last("s"); ok {
		t.Fatal("removed")
	}
}

func TestCommandLongDurationRecorded(t *testing.T) {
	tr := NewTracker(nil)
	tr.Feed("s", []byte("\x1b]133;C\x07"))
	time.Sleep(20 * time.Millisecond)
	tr.Feed("s", []byte("\x1b]133;D;0\x07"))
	res, ok := tr.Last("s")
	if !ok || res.Duration < 15*time.Millisecond {
		t.Fatalf("duration %#v ok=%v", res, ok)
	}
}

func TestTrackerSplitChunkNoDup(t *testing.T) {
	tr := NewTracker(nil)
	tr.Feed("s", []byte("\x1b]133;C\x07hello"))
	tr.Feed("s", []byte("\x1b]133;D;"))
	tr.Feed("s", []byte("0\x07"))
	res, ok := tr.Last("s")
	if !ok {
		t.Fatal("missing last")
	}
	if strings.Count(res.Output, "hello") != 1 || strings.Contains(res.Output, "]133") {
		t.Fatalf("output %q", res.Output)
	}
}
