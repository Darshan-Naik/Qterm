package config

import "testing"

func TestSanitizeSnippetsDropsEmptyAndCapsList(t *testing.T) {
	in := []Snippet{
		{ID: " a ", Name: "  Git status  ", Body: "git status", Keyword: "gs!"},
		{ID: "a", Name: "dup id", Body: "nope"},
		{ID: "empty", Name: "   ", Body: "   "},
		{ID: "kw2", Name: "Other", Body: "echo hi", Keyword: "GS"},
		{ID: "noshort", Name: "Plain", Body: "ls"},
	}
	got := SanitizeSnippets(in)
	if len(got) != 3 {
		t.Fatalf("len=%d want 3: %+v", len(got), got)
	}
	if got[0].ID != "a" || got[0].Name != "Git status" || got[0].Keyword != "gs" {
		t.Fatalf("first: %+v", got[0])
	}
	if got[1].Keyword != "" {
		t.Fatalf("duplicate keyword should be cleared: %+v", got[1])
	}
}

func TestSanitizeSnippetsUniqueChords(t *testing.T) {
	chord := &KeyChord{Key: "s", MetaOrCtrl: true, Shift: true}
	got := SanitizeSnippets([]Snippet{
		{ID: "1", Name: "One", Body: "a", Chord: chord},
		{ID: "2", Name: "Two", Body: "b", Chord: &KeyChord{Key: "s", MetaOrCtrl: true, Shift: true}},
		{ID: "3", Name: "Bad", Body: "c", Chord: &KeyChord{Key: "x"}},
	})
	if len(got) != 3 {
		t.Fatalf("len=%d", len(got))
	}
	if got[0].Chord == nil || got[0].Chord.Key != "s" {
		t.Fatalf("first chord: %+v", got[0].Chord)
	}
	if got[1].Chord != nil {
		t.Fatalf("duplicate chord should drop: %+v", got[1].Chord)
	}
	if got[2].Chord != nil {
		t.Fatalf("modifier-less chord should drop: %+v", got[2].Chord)
	}
}

func TestSanitizeSnippetsNilEmpty(t *testing.T) {
	if SanitizeSnippets(nil) != nil {
		t.Fatal("nil in")
	}
	if SanitizeSnippets([]Snippet{}) != nil {
		t.Fatal("empty in")
	}
}
