package gemini

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"qterm/internal/agentcli/core"
)

func (adapter) ListSessions(q core.SessionQuery) ([]core.Session, error) {
	root := filepath.Join(core.UserHomeDir(), ".gemini", "tmp")
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil, nil
	}
	projects := projectsByPath()
	query := strings.TrimSpace(q.Query)

	out := make([]core.Session, 0, 64)
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		projectKey := e.Name()
		cwd := ""
		for path, name := range projects {
			if name == projectKey {
				cwd = path
				break
			}
		}
		chats := filepath.Join(root, projectKey, "chats")
		_ = filepath.WalkDir(chats, func(path string, d os.DirEntry, err error) error {
			if err != nil || d.IsDir() {
				return nil
			}
			if !strings.HasSuffix(d.Name(), ".jsonl") {
				return nil
			}
			id, title, body, updated := sessionMeta(path)
			if id == "" {
				id = strings.TrimSuffix(d.Name(), ".jsonl")
			}
			if title == "" {
				title = "Gemini session"
			}
			if updated == 0 {
				updated = core.MtimeMS(path)
			}
			preview := ""
			if query != "" {
				if !core.ContainsFold(title, query) && !core.ContainsFold(cwd, query) && core.ContainsFold(body, query) {
					preview = core.SnippetAround(body, query, 40)
				}
			}
			out = append(out, core.Session{
				ID:        id,
				CLI:       "gemini",
				CLIName:   "Gemini CLI",
				Title:     core.Clip(title, 80),
				Cwd:       cwd,
				Preview:   core.Clip(preview, 120),
				UpdatedAt: updated,
			})
			return nil
		})
	}
	return core.FilterRank(out, q), nil
}

func projectsByPath() map[string]string {
	path := filepath.Join(core.UserHomeDir(), ".gemini", "projects.json")
	b, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var root struct {
		Projects map[string]string `json:"projects"`
	}
	if json.Unmarshal(b, &root) != nil {
		return nil
	}
	return root.Projects
}

func sessionMeta(path string) (id, title, body string, updated int64) {
	f, err := os.Open(path)
	if err != nil {
		return "", "", "", 0
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	if sc.Scan() {
		var header struct {
			SessionID   string `json:"sessionId"`
			StartTime   string `json:"startTime"`
			LastUpdated string `json:"lastUpdated"`
		}
		if json.Unmarshal(sc.Bytes(), &header) == nil {
			id = header.SessionID
			updated = core.ParseTimeMS(header.LastUpdated)
			if updated == 0 {
				updated = core.ParseTimeMS(header.StartTime)
			}
		}
	}
	var parts []string
	for sc.Scan() {
		var row map[string]any
		if json.Unmarshal(sc.Bytes(), &row) != nil {
			continue
		}
		text := core.FirstString(row, "content", "text", "message")
		if text == "" {
			if msg, ok := row["message"].(map[string]any); ok {
				text = core.FirstString(msg, "content", "text")
			}
		}
		text = strings.TrimSpace(text)
		if text == "" {
			continue
		}
		if title == "" {
			title = text
		}
		parts = append(parts, text)
		if len(parts) > 30 {
			break
		}
	}
	return id, title, strings.Join(parts, "\n"), updated
}

func (a adapter) Resume(sessionID string) (core.ResumeSpec, error) {
	if sessionID == "" {
		return core.ResumeSpec{}, core.ErrResumeUnsupported
	}
	sessions, _ := a.ListSessions(core.SessionQuery{Limit: 200})
	for _, s := range sessions {
		if s.ID == sessionID {
			return core.ResumeSpec{
				CLI:       "gemini",
				SessionID: s.ID,
				Title:     s.Title,
				Cwd:       s.Cwd,
				Command:   "gemini --resume " + core.ShellQuote(s.ID),
			}, nil
		}
	}
	return core.ResumeSpec{
		CLI:       "gemini",
		SessionID: sessionID,
		Title:     "Gemini session",
		Command:   "gemini --resume " + core.ShellQuote(sessionID),
	}, nil
}
