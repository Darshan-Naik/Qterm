package globhotkey

import (
	"testing"

	"qterm/internal/config"
)

func TestCarbonDefault(t *testing.T) {
	key, mods, ok := carbon(Default())
	if !ok {
		t.Fatal("default chord should map")
	}
	if key != 0x32 {
		t.Fatalf("grave vk got 0x%x", key)
	}
	if mods&(1<<12) == 0 {
		t.Fatalf("expected control modifier, got 0x%x", mods)
	}
}

func TestCarbonRequiresModifier(t *testing.T) {
	_, _, ok := carbon(config.KeyChord{Key: "k"})
	if ok {
		t.Fatal("bare key must be rejected")
	}
}

func TestCarbonLetterCmd(t *testing.T) {
	key, mods, ok := carbon(config.KeyChord{Key: "k", MetaOrCtrl: true, Shift: true})
	if !ok {
		t.Fatal("cmd+shift+k")
	}
	if key != 0x28 {
		t.Fatalf("K vk 0x%x", key)
	}
	if mods&(1<<8) == 0 || mods&(1<<9) == 0 {
		t.Fatalf("mods 0x%x", mods)
	}
}

func TestChordEqual(t *testing.T) {
	a := Default()
	b := Default()
	if !ChordEqual(a, b) {
		t.Fatal("equal")
	}
	b.Shift = true
	if ChordEqual(a, b) {
		t.Fatal("shift differs")
	}
}

func TestRegisterUnregister(t *testing.T) {
	if err := Register(Default(), func() {}); err != nil {
		t.Fatal(err)
	}
	Unregister()
}
