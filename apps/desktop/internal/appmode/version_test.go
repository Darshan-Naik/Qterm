package appmode

import "testing"

func TestLoadVersion(t *testing.T) {
	prev := AppVersion
	t.Cleanup(func() { AppVersion = prev })

	if err := LoadVersion([]byte(`{"info":{"productVersion":"1.6.5"}}`)); err != nil {
		t.Fatal(err)
	}
	if AppVersion != "1.6.5" {
		t.Fatalf("AppVersion = %q", AppVersion)
	}
}

func TestLoadVersionRejectsEmpty(t *testing.T) {
	if err := LoadVersion([]byte(`{"info":{}}`)); err == nil {
		t.Fatal("expected error")
	}
}
