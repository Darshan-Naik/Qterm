package notify

import (
	"testing"
	"time"
)

func TestShouldSkipsFocusedActivePane(t *testing.T) {
	if Should(Decision{
		Kind: KindNeedsInput, SessionID: "a", AppActive: true, FocusedID: "a", Enabled: true,
	}) {
		t.Fatal("should not notify the focused pane")
	}
}

func TestShouldNeedsInputWhenBackground(t *testing.T) {
	if !Should(Decision{
		Kind: KindNeedsInput, SessionID: "a", AppActive: false, FocusedID: "a", Enabled: true,
	}) {
		t.Fatal("background app should notify even if that pane was last focused")
	}
	if !Should(Decision{
		Kind: KindNeedsInput, SessionID: "a", AppActive: true, FocusedID: "b", Enabled: true,
	}) {
		t.Fatal("another pane focused should notify")
	}
}

func TestShouldDisabled(t *testing.T) {
	if Should(Decision{Kind: KindNeedsInput, SessionID: "a", Enabled: false}) {
		t.Fatal("disabled")
	}
	if Should(Decision{Kind: KindNeedsInput, Enabled: true}) {
		t.Fatal("empty session")
	}
}

func TestShouldDebounceNeedsInput(t *testing.T) {
	now := time.Date(2026, 1, 1, 12, 0, 0, 0, time.UTC)
	last := now.Add(-10 * time.Second)
	if Should(Decision{
		Kind: KindNeedsInput, SessionID: "a", Enabled: true, LastSent: last, Now: now,
	}) {
		t.Fatal("10s is too soon to re-notify")
	}
	if !Should(Decision{
		Kind: KindNeedsInput, SessionID: "a", Enabled: true, LastSent: last, Now: now.Add(RepeatNeedsInputAfter),
	}) {
		t.Fatal("after debounce window should notify again")
	}
}

func TestCommandLongEnough(t *testing.T) {
	if CommandLongEnough(7*time.Second, 8) {
		t.Fatal("7s < 8s")
	}
	if !CommandLongEnough(8*time.Second, 8) {
		t.Fatal("8s should notify")
	}
}

func TestCommandLongEnoughDefaultMin(t *testing.T) {
	if CommandLongEnough(5*time.Second, 0) {
		t.Fatal("default min is 8 seconds")
	}
	if !CommandLongEnough(8*time.Second, 0) {
		t.Fatal("8s meets default")
	}
}
