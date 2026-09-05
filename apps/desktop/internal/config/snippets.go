package config

import (
	"strings"
	"unicode"
)

const (
	MaxSnippets        = 100
	MaxSnippetName     = 80
	MaxSnippetBody     = 8 << 10
	MaxSnippetKeyword  = 32
	MaxSnippetKeyRunes = 24
)

// Snippet is a reusable command the user can insert into a terminal.
type Snippet struct {
	ID      string    `json:"id"`
	Name    string    `json:"name"`
	Body    string    `json:"body"`
	Keyword string    `json:"keyword,omitempty"`
	Chord   *KeyChord `json:"chord,omitempty"`
	Send    bool      `json:"send,omitempty"`
}

// SanitizeSnippets keeps a bounded, de-duplicated list safe to persist.
func SanitizeSnippets(in []Snippet) []Snippet {
	if len(in) == 0 {
		return nil
	}
	out := make([]Snippet, 0, len(in))
	seenID := make(map[string]struct{}, len(in))
	seenKeyword := make(map[string]struct{}, len(in))
	seenChord := make(map[string]struct{}, len(in))
	for _, s := range in {
		s.ID = strings.TrimSpace(s.ID)
		if s.ID == "" {
			continue
		}
		if _, dup := seenID[s.ID]; dup {
			continue
		}
		s.Name = clampRunes(strings.TrimSpace(s.Name), MaxSnippetName)
		s.Body = clampRunes(s.Body, MaxSnippetBody)
		if s.Name == "" && strings.TrimSpace(s.Body) == "" {
			continue
		}
		if s.Name == "" {
			s.Name = "Untitled snippet"
		}
		s.Keyword = sanitizeKeyword(s.Keyword)
		if s.Keyword != "" {
			key := strings.ToLower(s.Keyword)
			if _, dup := seenKeyword[key]; dup {
				s.Keyword = ""
			} else {
				seenKeyword[key] = struct{}{}
			}
		}
		s.Chord = sanitizeChord(s.Chord)
		if s.Chord != nil {
			cid := chordID(*s.Chord)
			if _, dup := seenChord[cid]; dup {
				s.Chord = nil
			} else {
				seenChord[cid] = struct{}{}
			}
		}
		seenID[s.ID] = struct{}{}
		out = append(out, s)
		if len(out) >= MaxSnippets {
			break
		}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func sanitizeKeyword(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	var b strings.Builder
	for _, r := range raw {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '-' || r == '_' {
			b.WriteRune(r)
		}
		if b.Len() >= MaxSnippetKeyword {
			break
		}
	}
	return b.String()
}

func sanitizeChord(c *KeyChord) *KeyChord {
	if c == nil {
		return nil
	}
	key := strings.TrimSpace(c.Key)
	if key == "" || len([]rune(key)) > MaxSnippetKeyRunes {
		return nil
	}
	if !c.MetaOrCtrl && !c.CtrlOnly {
		return nil
	}
	out := &KeyChord{
		Key:        key,
		MetaOrCtrl: c.MetaOrCtrl && !c.CtrlOnly,
		CtrlOnly:   c.CtrlOnly,
		Shift:      c.Shift,
		Alt:        c.Alt,
	}
	if len(c.Codes) > 0 {
		codes := make([]string, 0, len(c.Codes))
		seen := map[string]struct{}{}
		for _, code := range c.Codes {
			code = strings.TrimSpace(code)
			if code == "" {
				continue
			}
			if _, ok := seen[code]; ok {
				continue
			}
			seen[code] = struct{}{}
			codes = append(codes, code)
			if len(codes) >= 4 {
				break
			}
		}
		if len(codes) > 0 {
			out.Codes = codes
		}
	}
	return out
}

func chordID(c KeyChord) string {
	parts := make([]string, 0, 6)
	if c.CtrlOnly {
		parts = append(parts, "ctrlOnly")
	} else if c.MetaOrCtrl {
		parts = append(parts, "mod")
	}
	if c.Alt {
		parts = append(parts, "alt")
	}
	if c.Shift {
		parts = append(parts, "shift")
	}
	parts = append(parts, strings.ToLower(c.Key))
	return strings.Join(parts, "+")
}

func clampRunes(s string, max int) string {
	if max <= 0 || s == "" {
		return s
	}
	n := 0
	for i := range s {
		if n == max {
			return s[:i]
		}
		n++
	}
	return s
}
