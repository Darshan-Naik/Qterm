package cursor

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"qterm/internal/agentcli/core"
)

// Cursor agent transcripts often prefix user turns with an absolute timestamp.
var leadingStampRe = regexp.MustCompile(`(?i)^(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday),\s+[a-z]{3}\s+\d{1,2},\s+\d{4},\s+\d{1,2}:\d{2}\s*(?:am|pm)\s*(?:\([^)]*\))?\s*`)

func (adapter) ListSessions(q core.SessionQuery) ([]core.Session, error) {
	root := filepath.Join(core.UserHomeDir(), ".cursor", "projects")
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil, nil
	}

	query := strings.TrimSpace(q.Query)
	byID := map[string]core.Session{}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		slug := e.Name()
		if slug == "empty-window" {
			continue // Cursor copies transcripts here; prefer real project folders
		}
		cwd := decodeProjectSlug(slug)
		base := filepath.Join(root, slug, "agent-transcripts")
		_ = filepath.WalkDir(base, func(path string, d os.DirEntry, err error) error {
			if err != nil {
				return nil
			}
			if d.IsDir() {
				if d.Name() == "subagents" {
					return filepath.SkipDir
				}
				return nil
			}
			if !strings.HasSuffix(d.Name(), ".jsonl") {
				return nil
			}
			id := strings.TrimSuffix(d.Name(), ".jsonl")
			// Canonical layout: agent-transcripts/<id>/<id>.jsonl
			if filepath.Base(filepath.Dir(path)) != id {
				return nil
			}
			title, body := transcriptText(path)
			if title == "" {
				title = "Cursor agent"
			}
			preview := ""
			if query != "" {
				if !core.ContainsFold(title, query) && !core.ContainsFold(cwd, query) && core.ContainsFold(body, query) {
					preview = core.SnippetAround(body, query, 40)
				}
			}
			s := core.Session{
				ID:        id,
				CLI:       "cursor",
				CLIName:   "Cursor Agent",
				Title:     core.Clip(title, 80),
				Cwd:       cwd,
				Preview:   core.Clip(preview, 120),
				UpdatedAt: core.MtimeMS(path),
			}
			if prev, ok := byID[id]; ok {
				if !preferSession(s, prev) {
					return nil
				}
			}
			byID[id] = s
			return nil
		})
	}

	out := make([]core.Session, 0, len(byID))
	for _, s := range byID {
		out = append(out, s)
	}
	return core.FilterRank(out, q), nil
}

// preferSession picks the better of two copies of the same transcript id.
func preferSession(a, b core.Session) bool {
	aOK, bOK := a.Cwd != "", b.Cwd != ""
	if aOK != bOK {
		return aOK
	}
	return a.UpdatedAt >= b.UpdatedAt
}

// decodeProjectSlug reverses Cursor's "/" → "-" project folder encoding.
// Path segments may themselves contain hyphens, so we greedily match existing dirs.
func decodeProjectSlug(slug string) string {
	if slug == "" || slug == "empty-window" {
		return ""
	}
	parts := strings.Split(slug, "-")
	if len(parts) == 0 {
		return ""
	}
	cur := ""
	i := 0
	for i < len(parts) {
		built := parts[i]
		j := i + 1
		found := false
		for {
			trial := cur + "/" + built
			if st, err := os.Stat(trial); err == nil && st.IsDir() {
				cur = trial
				i = j
				found = true
				break
			}
			if j >= len(parts) {
				break
			}
			built = built + "-" + parts[j]
			j++
		}
		if !found {
			// Accept unresolved remainder so callers still get a hint.
			if cur == "" {
				return "/" + strings.Join(parts, "/")
			}
			return cur + "/" + strings.Join(parts[i:], "-")
		}
	}
	if st, err := os.Stat(cur); err == nil && st.IsDir() {
		return cur
	}
	return ""
}

func transcriptText(path string) (title, body string) {
	f, err := os.Open(path)
	if err != nil {
		return "", ""
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	var parts []string
	for sc.Scan() {
		var row struct {
			Role    string `json:"role"`
			Message struct {
				Content []struct {
					Type string `json:"type"`
					Text string `json:"text"`
				} `json:"content"`
			} `json:"message"`
		}
		if json.Unmarshal(sc.Bytes(), &row) != nil {
			continue
		}
		var text string
		for _, c := range row.Message.Content {
			if c.Type == "text" && strings.TrimSpace(c.Text) != "" {
				text = cleanTranscriptText(c.Text)
				break
			}
		}
		text = strings.TrimSpace(text)
		if text == "" {
			continue
		}
		if row.Role == "user" && title == "" {
			title = text
		}
		parts = append(parts, text)
		if len(parts) > 40 {
			break
		}
	}
	return title, strings.Join(parts, "\n")
}

// cleanTranscriptText pulls <user_query> when present and drops transcript chrome.
func cleanTranscriptText(s string) string {
	s = strings.TrimSpace(s)
	if q := tagInner(s, "user_query"); q != "" {
		return strings.TrimSpace(q)
	}
	s = stripTags(s)
	return stripLeadingStamp(strings.TrimSpace(s))
}

func tagInner(s, name string) string {
	open := "<" + name + ">"
	close := "</" + name + ">"
	start := strings.Index(s, open)
	if start < 0 {
		return ""
	}
	start += len(open)
	end := strings.Index(s[start:], close)
	if end < 0 {
		return ""
	}
	return s[start : start+end]
}

func stripLeadingStamp(s string) string {
	return strings.TrimSpace(leadingStampRe.ReplaceAllString(s, ""))
}

func stripTags(s string) string {
	for {
		start := strings.Index(s, "<")
		if start < 0 {
			break
		}
		end := strings.Index(s[start:], ">")
		if end < 0 {
			break
		}
		s = s[:start] + s[start+end+1:]
	}
	return s
}

func (a adapter) Resume(sessionID string) (core.ResumeSpec, error) {
	if sessionID == "" {
		return core.ResumeSpec{}, core.ErrResumeUnsupported
	}
	sessions, _ := a.ListSessions(core.SessionQuery{Limit: 200})
	for _, s := range sessions {
		if s.ID == sessionID {
			return core.ResumeSpec{
				CLI:       "cursor",
				SessionID: s.ID,
				Title:     s.Title,
				Cwd:       s.Cwd,
				Command:   "cursor-agent --resume " + core.ShellQuote(s.ID),
			}, nil
		}
	}
	return core.ResumeSpec{
		CLI:       "cursor",
		SessionID: sessionID,
		Title:     "Cursor agent",
		Command:   "cursor-agent --resume " + core.ShellQuote(sessionID),
	}, nil
}
