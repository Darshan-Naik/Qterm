package claude

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"qterm/internal/agentcli/core"
)

type sessionAgg struct {
	title   string
	cwd     string
	updated int64
	body    []string
}

func (adapter) ListSessions(q core.SessionQuery) ([]core.Session, error) {
	byID := map[string]*sessionAgg{}

	loadHistoryJSONL(byID)
	loadProjectTranscripts(byID)

	query := strings.TrimSpace(q.Query)
	out := make([]core.Session, 0, len(byID))
	for id, a := range byID {
		title := a.title
		if title == "" {
			title = "Claude session"
		}
		preview := title
		if query != "" {
			if !core.ContainsFold(title, query) && !core.ContainsFold(a.cwd, query) && !core.ContainsFold(id, query) {
				for _, line := range a.body {
					if core.ContainsFold(line, query) {
						preview = core.SnippetAround(line, query, 40)
						break
					}
				}
			}
		} else {
			preview = ""
		}
		out = append(out, core.Session{
			ID:        id,
			CLI:       "claude",
			CLIName:   "Claude Code",
			Title:     core.Clip(title, 80),
			Cwd:       a.cwd,
			Preview:   core.Clip(preview, 120),
			UpdatedAt: a.updated,
		})
	}
	return core.FilterRank(out, q), nil
}

func loadHistoryJSONL(byID map[string]*sessionAgg) {
	path := filepath.Join(core.UserHomeDir(), ".claude", "history.jsonl")
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()

	type row struct {
		Display   string `json:"display"`
		Timestamp int64  `json:"timestamp"`
		Project   string `json:"project"`
		SessionID string `json:"sessionId"`
	}

	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for sc.Scan() {
		line := sc.Bytes()
		if len(line) == 0 {
			continue
		}
		var r row
		if json.Unmarshal(line, &r) != nil || r.SessionID == "" {
			continue
		}
		a := byID[r.SessionID]
		if a == nil {
			a = &sessionAgg{cwd: r.Project}
			byID[r.SessionID] = a
		}
		if r.Project != "" {
			a.cwd = r.Project
		}
		disp := strings.TrimSpace(r.Display)
		if disp == "" {
			continue
		}
		a.body = append(a.body, disp)
		if a.title == "" || (!strings.HasPrefix(disp, "/") && strings.HasPrefix(a.title, "/")) {
			a.title = disp
		}
		ts := r.Timestamp
		if ts > 0 && ts < 1_000_000_000_000 {
			ts *= 1000
		}
		if ts > a.updated {
			a.updated = ts
		}
	}
}

func loadProjectTranscripts(byID map[string]*sessionAgg) {
	root := filepath.Join(core.UserHomeDir(), ".claude", "projects")
	entries, err := os.ReadDir(root)
	if err != nil {
		return
	}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		cwd := decodeClaudeProjectDir(e.Name())
		dir := filepath.Join(root, e.Name())
		files, err := os.ReadDir(dir)
		if err != nil {
			continue
		}
		for _, f := range files {
			if f.IsDir() || !strings.HasSuffix(f.Name(), ".jsonl") {
				continue
			}
			id := strings.TrimSuffix(f.Name(), ".jsonl")
			path := filepath.Join(dir, f.Name())
			a := byID[id]
			if a == nil {
				a = &sessionAgg{cwd: cwd}
				byID[id] = a
			}
			if a.cwd == "" && cwd != "" {
				a.cwd = cwd
			}
			mt := core.MtimeMS(path)
			if mt > a.updated {
				a.updated = mt
			}
			if a.title != "" && len(a.body) > 0 {
				continue
			}
			title, prompts := firstUserPrompts(path, 12)
			if a.title == "" && title != "" {
				a.title = title
			}
			if len(a.body) == 0 {
				a.body = prompts
			}
		}
	}
}

func decodeClaudeProjectDir(name string) string {
	// "-Users-foo-Documents-bar" → "/Users/foo/Documents/bar"
	if !strings.HasPrefix(name, "-") {
		return ""
	}
	path := "/" + strings.ReplaceAll(strings.TrimPrefix(name, "-"), "-", "/")
	if st, err := os.Stat(path); err == nil && st.IsDir() {
		return path
	}
	return ""
}

func firstUserPrompts(path string, limit int) (title string, prompts []string) {
	f, err := os.Open(path)
	if err != nil {
		return "", nil
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for sc.Scan() {
		var row map[string]any
		if json.Unmarshal(sc.Bytes(), &row) != nil {
			continue
		}
		typ, _ := row["type"].(string)
		if typ != "" && typ != "user" {
			continue
		}
		text := extractClaudeUserText(row)
		if text == "" {
			continue
		}
		prompts = append(prompts, text)
		if title == "" && !strings.HasPrefix(text, "/") {
			title = text
		}
		if len(prompts) >= limit {
			break
		}
	}
	if title == "" && len(prompts) > 0 {
		title = prompts[0]
	}
	return title, prompts
}

func extractClaudeUserText(row map[string]any) string {
	if s := strings.TrimSpace(core.FirstString(row, "text", "content", "message")); s != "" && !strings.HasPrefix(s, "{") {
		return s
	}
	msg, _ := row["message"].(map[string]any)
	if msg == nil {
		return ""
	}
	switch c := msg["content"].(type) {
	case string:
		return strings.TrimSpace(c)
	case []any:
		for _, part := range c {
			pm, ok := part.(map[string]any)
			if !ok {
				continue
			}
			if t, _ := pm["type"].(string); t != "" && t != "text" {
				continue
			}
			if s := strings.TrimSpace(core.FirstString(pm, "text")); s != "" {
				return s
			}
		}
	}
	return strings.TrimSpace(core.FirstString(msg, "text", "content"))
}

func (a adapter) Resume(sessionID string) (core.ResumeSpec, error) {
	if sessionID == "" {
		return core.ResumeSpec{}, core.ErrResumeUnsupported
	}
	sessions, err := a.ListSessions(core.SessionQuery{Query: sessionID, Limit: 50})
	if err != nil {
		return core.ResumeSpec{}, err
	}
	for _, s := range sessions {
		if s.ID == sessionID {
			return core.ResumeSpec{
				CLI:       "claude",
				SessionID: s.ID,
				Title:     s.Title,
				Cwd:       s.Cwd,
				Command:   "claude --resume " + core.ShellQuote(s.ID),
			}, nil
		}
	}
	return core.ResumeSpec{
		CLI:       "claude",
		SessionID: sessionID,
		Title:     "Claude session",
		Command:   "claude --resume " + core.ShellQuote(sessionID),
	}, nil
}
