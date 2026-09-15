package config

import "testing"

func TestClampNotifyCommandMinSec(t *testing.T) {
	if ClampNotifyCommandMinSec(0) != DefaultNotifyCommandMinSec {
		t.Fatal("0 means default")
	}
	if ClampNotifyCommandMinSec(1) != MinNotifyCommandMinSec {
		t.Fatal("below min")
	}
	if ClampNotifyCommandMinSec(999) != MaxNotifyCommandMinSec {
		t.Fatal("above max")
	}
	if ClampNotifyCommandMinSec(12) != 12 {
		t.Fatal("in range")
	}
}

func TestNotifyDefaultsOn(t *testing.T) {
	cfg := DefaultConfig()
	if !NotifyAgentEnabled(cfg) || !NotifyCommandEnabled(cfg) {
		t.Fatal("nil pointers mean on")
	}
	off := false
	cfg.NotifyAgent = &off
	if NotifyAgentEnabled(cfg) {
		t.Fatal("explicit off")
	}
}
