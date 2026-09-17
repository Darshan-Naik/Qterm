package grok

import (
	"bufio"
	"encoding/json"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"qterm/internal/agentcli/core"
)

func (adapter) ListSessions(q core.SessionQuery) ([]core.Session, error) {
	root := filepath.Join(grokHome(), "sessions")
	groups, err := os.ReadDir(root)
	if err != nil {
		return nil, nil
	}
	query := strings.TrimSpace(q.Query)
	out := make([]core.Session, 0, 64)
	for _, g := range groups {
		if !g.IsDir() {
			continue
		}
		groupDir := filepath.Join(root, g.Name())
		cwd := decodeCwd(groupDir, g.Name())
		entries, err := os.ReadDir(groupDir)
		if err != nil {
			continue
		}
		for _, e := range entries {
			if !e.IsDir() {
				continue
			}
			dir := filepath.Join(groupDir, e.Name())
			summaryPath := filepath.Join(dir, "summary.json")
			if _, err := os.Stat(summaryPath); err != nil {
				continue
			}
			id, title, cwdFromInfo, updated := readSummary(summaryPath)
			if id == "" {
				id = e.Name()
			}
			if cwdFromInfo != "" {
				cwd = cwdFromInfo
			}
			if title == "" {
				title = "Grok session"
			}
			if updated == 0 {
				updated = core.MtimeMS(summaryPath)
			}
			preview := ""
			if query != "" {
				if !core.ContainsFold(title, query) && !core.ContainsFold(cwd, query) && !core.ContainsFold(id, query) {
					body := sessionBody(filepath.Join(dir, "chat_history.jsonl"))
					if core.ContainsFold(body, query) {
						preview = core.SnippetAround(body, query, 40)
					}
				}
			}
			out = append(out, core.Session{
				ID:        id,
				CLI:       "grok",
				CLIName:   "Grok Build",
				Title:     core.Clip(title, 80),
				Cwd:       cwd,
				Preview:   core.Clip(preview, 120),
				UpdatedAt: updated,
			})
		}
	}
	return core.FilterRank(out, q), nil
}

func decodeCwd(groupDir, slug string) string {
	if b, err := os.ReadFile(filepath.Join(groupDir, ".cwd")); err == nil {
		if p := strings.TrimSpace(string(b)); p != "" {
			return p
		}
	}
	for _, unescape := range []func(string) (string, error){url.PathUnescape, url.QueryUnescape} {
		if u, err := unescape(slug); err == nil && strings.HasPrefix(u, "/") {
			return u
		}
	}
	return ""
}

type grokSummary struct {
	Info struct {
		ID  string `json:"id"`
		Cwd string `json:"cwd"`
	} `json:"info"`
	Title           string `json:"title"`
	GeneratedTitle  string `json:"generated_title"`
	SessionSummary  string `json:"session_summary"`
	CreatedAt       string `json:"created_at"`
	UpdatedAt       string `json:"updated_at"`
	LastActiveAt    string `json:"last_active_at"`
	LastTurnSummary string `json:"last_turn_summary"`
}

func readSummary(path string) (id, title, cwd string, updated int64) {
	b, err := os.ReadFile(path)
	if err != nil {
		return "", "", "", 0
	}
	var s grokSummary
	if json.Unmarshal(b, &s) != nil {
		return "", "", "", 0
	}
	id = strings.TrimSpace(s.Info.ID)
	cwd = strings.TrimSpace(s.Info.Cwd)
	title = firstNonEmpty(s.Title, s.GeneratedTitle, s.SessionSummary)
	updated = core.ParseTimeMS(s.LastActiveAt)
	if updated == 0 {
		updated = core.ParseTimeMS(s.UpdatedAt)
	}
	if updated == 0 {
		updated = core.ParseTimeMS(s.CreatedAt)
	}
	return id, title, cwd, updated
}

func sessionBody(path string) string {
	f, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	var parts []string
	for sc.Scan() {
		line := sc.Bytes()
		if len(line) == 0 {
			continue
		}
		var row struct {
			Type            string `json:"type"`
			SyntheticReason string `json:"synthetic_reason"`
			Content         any    `json:"content"`
		}
		if json.Unmarshal(line, &row) != nil {
			continue
		}
		if row.Type != "user" || row.SyntheticReason != "" {
			continue
		}
		text := extractUserQuery(contentText(row.Content))
		if text == "" {
			continue
		}
		parts = append(parts, text)
		if len(parts) > 30 {
			break
		}
	}
	return strings.Join(parts, "\n")
}

func contentText(content any) string {
	switch v := content.(type) {
	case string:
		return v
	case []any:
		var parts []string
		for _, item := range v {
			m, _ := item.(map[string]any)
			if m == nil {
				continue
			}
			if s, ok := m["text"].(string); ok && strings.TrimSpace(s) != "" {
				parts = append(parts, s)
			}
		}
		return strings.Join(parts, "\n")
	default:
		return ""
	}
}

func extractUserQuery(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return ""
	}
	const open, close = "<user_query>", "</user_query>"
	start := strings.Index(s, open)
	if start < 0 {
		if strings.Contains(s, "<user_info>") || strings.Contains(s, "<system-reminder>") {
			return ""
		}
		return s
	}
	start += len(open)
	end := strings.Index(s[start:], close)
	if end < 0 {
		return strings.TrimSpace(s[start:])
	}
	return strings.TrimSpace(s[start : start+end])
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if s := strings.TrimSpace(v); s != "" {
			return s
		}
	}
	return ""
}

func (a adapter) Resume(sessionID string) (core.ResumeSpec, error) {
	if sessionID == "" {
		return core.ResumeSpec{}, core.ErrResumeUnsupported
	}
	sessions, _ := a.ListSessions(core.SessionQuery{Query: sessionID, Limit: 50})
	for _, s := range sessions {
		if s.ID == sessionID {
			return core.ResumeSpec{
				CLI:       "grok",
				SessionID: s.ID,
				Title:     s.Title,
				Cwd:       s.Cwd,
				Command:   "grok --resume " + core.ShellQuote(s.ID),
			}, nil
		}
	}
	return core.ResumeSpec{
		CLI:       "grok",
		SessionID: sessionID,
		Title:     "Grok session",
		Command:   "grok --resume " + core.ShellQuote(sessionID),
	}, nil
}
