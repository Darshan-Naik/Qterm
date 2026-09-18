package main

import (
	"testing"

	"qterm/internal/notify"
)

type badgePoster struct {
	active bool
	badge  int
}

func (p *badgePoster) RequestAuth()                         {}
func (p *badgePoster) Post(notify.Note)                     {}
func (p *badgePoster) SetBadge(n int)                       { p.badge = n }
func (p *badgePoster) SetOnActivate(notify.ActivateHandler) {}
func (p *badgePoster) SetOnActiveChange(func())             {}
func (p *badgePoster) AppActive() bool                      { return p.active }
func (p *badgePoster) BringToFront()                        {}

func TestMarkWaitingBadgesBackgroundFocus(t *testing.T) {
	p := &badgePoster{active: false}
	a := &App{poster: p, focusedSessionID: "s1"}
	a.markWaiting("s1", true)
	if p.badge != 1 {
		t.Fatalf("background badge = %d, want 1", p.badge)
	}
	p.active = true
	a.refreshBadge()
	if p.badge != 0 {
		t.Fatalf("front badge = %d, want 0", p.badge)
	}
}

func TestMarkWaitingHiddenWindowBadges(t *testing.T) {
	p := &badgePoster{active: true}
	a := &App{poster: p, focusedSessionID: "s1", windowHidden: true}
	a.markWaiting("s1", true)
	if p.badge != 1 {
		t.Fatalf("hidden badge = %d, want 1", p.badge)
	}
}

func TestAckSessionAttentionClearsWaiting(t *testing.T) {
	p := &badgePoster{active: false}
	a := &App{poster: p}
	a.markWaiting("s1", true)
	a.setAttentionText("s1", "needs you")
	if p.badge != 1 {
		t.Fatalf("badge = %d, want 1", p.badge)
	}
	a.AckSessionAttention("s1")
	if p.badge != 0 {
		t.Fatalf("badge after ack = %d, want 0", p.badge)
	}
	if len(a.listUnread()) != 0 {
		t.Fatalf("unread after ack: %#v", a.listUnread())
	}
}
