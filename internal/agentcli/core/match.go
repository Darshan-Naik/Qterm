package core

import (
	"os"
	"sort"
	"strings"
	"time"
)

// NormalizeLimit clamps a session list limit.
func NormalizeLimit(n int) int {
	if n <= 0 {
		return 80
	}
	if n > 200 {
		return 200
	}
	return n
}

// Clip collapses whitespace and truncates to max runes-ish bytes.
func Clip(s string, max int) string {
	s = strings.Join(strings.Fields(strings.TrimSpace(s)), " ")
	if max <= 0 || len(s) <= max {
		return s
	}
	return s[:max-1] + "…"
}

// ShellQuote safely quotes s for a shell command argument.
func ShellQuote(s string) string {
	if s == "" {
		return "''"
	}
	if strings.IndexFunc(s, func(r rune) bool {
		return !(r == '-' || r == '_' || r == '.' || r == '/' ||
			(r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9'))
	}) < 0 {
		return s
	}
	return "'" + strings.ReplaceAll(s, "'", `'"'"'`) + "'"
}

// MtimeMS returns file mtime in unix milliseconds.
func MtimeMS(path string) int64 {
	st, err := os.Stat(path)
	if err != nil {
		return 0
	}
	return st.ModTime().UnixMilli()
}

// ParseTimeMS parses RFC3339 timestamps to unix ms.
func ParseTimeMS(s string) int64 {
	if s == "" {
		return 0
	}
	if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
		return t.UnixMilli()
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t.UnixMilli()
	}
	return 0
}

// ContainsFold is a case-insensitive substring check.
func ContainsFold(hay, needle string) bool {
	if needle == "" {
		return true
	}
	return strings.Contains(strings.ToLower(hay), strings.ToLower(needle))
}

// RankSession scores a session against query.
// Title (or cwd) match ranks above prompt-body match.
func RankSession(s *Session, query string) bool {
	q := strings.TrimSpace(query)
	if q == "" {
		s.Match = ""
		s.Score = int(s.UpdatedAt / 1000) // recency only
		return true
	}
	if ContainsFold(s.Title, q) || ContainsFold(s.Cwd, q) || ContainsFold(s.ID, q) {
		s.Match = "title"
		s.Score = 2_000_000_000 + int(s.UpdatedAt/1000)
		return true
	}
	if ContainsFold(s.Preview, q) {
		s.Match = "body"
		s.Score = 1_000_000_000 + int(s.UpdatedAt/1000)
		return true
	}
	return false
}

// FilterRank applies query ranking and sorts best-first.
func FilterRank(sessions []Session, q SessionQuery) []Session {
	limit := NormalizeLimit(q.Limit)
	out := make([]Session, 0, len(sessions))
	for i := range sessions {
		s := sessions[i]
		if RankSession(&s, q.Query) {
			out = append(out, s)
		}
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].Score != out[j].Score {
			return out[i].Score > out[j].Score
		}
		return out[i].UpdatedAt > out[j].UpdatedAt
	})
	if len(out) > limit {
		out = out[:limit]
	}
	return out
}

// SnippetAround returns a clipped window around the first case-insensitive match.
func SnippetAround(text, query string, pad int) string {
	if text == "" {
		return ""
	}
	lower := strings.ToLower(text)
	needle := strings.ToLower(strings.TrimSpace(query))
	idx := 0
	if needle != "" {
		idx = strings.Index(lower, needle)
		if idx < 0 {
			return Clip(text, pad*2)
		}
	}
	start := idx - pad
	if start < 0 {
		start = 0
	}
	end := idx + len(needle) + pad
	if end > len(text) {
		end = len(text)
	}
	snip := Clip(text[start:end], pad*2+len(needle))
	if start > 0 {
		snip = "…" + snip
	}
	if end < len(text) {
		snip = snip + "…"
	}
	return snip
}
