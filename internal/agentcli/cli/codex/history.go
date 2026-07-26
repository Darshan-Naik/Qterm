package codex

import (
	"bufio"
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"qterm/internal/agentcli/core"
)

type sessionAgg struct {
	title   string
	cwd     string
	updated int64
	body    string
	named   bool // title from session_index (preferred)
}

var rolloutIDRe = regexp.MustCompile(`([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})`)

func (adapter) ListSessions(q core.SessionQuery) ([]core.Session, error) {
	byID := map[string]*sessionAgg{}

	loadSessionIndex(byID)
	loadRollouts(byID)
	enrichFromHistory(byID)

	query := strings.TrimSpace(q.Query)
	out := make([]core.Session, 0, len(byID))
	for id, a := range byID {
		title := strings.TrimSpace(a.title)
		if title == "" {
			title = "Codex session"
		}
		preview := ""
		if query != "" {
			if !core.ContainsFold(title, query) && !core.ContainsFold(a.cwd, query) && !core.ContainsFold(id, query) {
				if a.body != "" && core.ContainsFold(a.body, query) {
					preview = core.SnippetAround(a.body, query, 40)
				}
			}
		}
		out = append(out, core.Session{
			ID:        id,
			CLI:       "codex",
			CLIName:   "Codex",
			Title:     core.Clip(title, 80),
			Cwd:       a.cwd,
			Preview:   core.Clip(preview, 120),
			UpdatedAt: a.updated,
		})
	}
	return core.FilterRank(out, q), nil
}

func loadSessionIndex(byID map[string]*sessionAgg) {
	indexPath := filepath.Join(core.UserHomeDir(), ".codex", "session_index.jsonl")
	f, err := os.Open(indexPath)
	if err != nil {
		return
	}
	defer f.Close()

	type row struct {
		ID         string `json:"id"`
		ThreadName string `json:"thread_name"`
		UpdatedAt  string `json:"updated_at"`
	}

	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 0, 64*1024), 256*1024)
	for sc.Scan() {
		line := sc.Bytes()
		if len(line) == 0 {
			continue
		}
		var r row
		if json.Unmarshal(line, &r) != nil || r.ID == "" {
			continue
		}
		a := byID[r.ID]
		if a == nil {
			a = &sessionAgg{}
			byID[r.ID] = a
		}
		if name := strings.TrimSpace(r.ThreadName); name != "" {
			a.title = name
			a.named = true
		}
		if ms := core.ParseTimeMS(r.UpdatedAt); ms > a.updated {
			a.updated = ms
		}
	}
}

func loadRollouts(byID map[string]*sessionAgg) {
	root := filepath.Join(core.UserHomeDir(), ".codex", "sessions")
	_ = filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		base := d.Name()
		if !strings.HasPrefix(base, "rollout-") || !strings.HasSuffix(base, ".jsonl") {
			return nil
		}
		id := ""
		if m := rolloutIDRe.FindStringSubmatch(base); len(m) > 1 {
			id = m[1]
		}
		meta := scanRollout(path)
		if meta.id != "" {
			id = meta.id
		}
		if id == "" {
			return nil
		}
		a := byID[id]
		if a == nil {
			a = &sessionAgg{}
			byID[id] = a
		}
		if meta.cwd != "" {
			a.cwd = meta.cwd
		}
		if !a.named && meta.title != "" {
			a.title = meta.title
		}
		if a.body == "" && meta.title != "" {
			a.body = meta.title
		}
		updated := meta.updated
		if updated == 0 {
			if info, err := d.Info(); err == nil {
				updated = info.ModTime().UnixMilli()
			}
		}
		if updated > a.updated {
			a.updated = updated
		}
		return nil
	})
}

type rolloutMeta struct {
	id, cwd, title string
	updated        int64
}

func scanRollout(path string) rolloutMeta {
	f, err := os.Open(path)
	if err != nil {
		return rolloutMeta{}
	}
	defer f.Close()

	var out rolloutMeta
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for i := 0; sc.Scan() && i < 80; i++ {
		line := sc.Bytes()
		if len(line) == 0 {
			continue
		}
		var row struct {
			Timestamp string `json:"timestamp"`
			Type      string `json:"type"`
			Payload   struct {
				Type      string `json:"type"`
				SessionID string `json:"session_id"`
				ID        string `json:"id"`
				Cwd       string `json:"cwd"`
				Message   string `json:"message"`
				Role      string `json:"role"`
				Content   []struct {
					Type string `json:"type"`
					Text string `json:"text"`
				} `json:"content"`
			} `json:"payload"`
		}
		if json.Unmarshal(line, &row) != nil {
			continue
		}
		if ms := core.ParseTimeMS(row.Timestamp); ms > out.updated {
			out.updated = ms
		}
		switch row.Type {
		case "session_meta":
			if row.Payload.SessionID != "" {
				out.id = row.Payload.SessionID
			} else if row.Payload.ID != "" {
				out.id = row.Payload.ID
			}
			if row.Payload.Cwd != "" {
				out.cwd = row.Payload.Cwd
			}
		case "event_msg":
			if row.Payload.Type == "user_message" {
				msg := strings.TrimSpace(row.Payload.Message)
				if msg != "" && out.title == "" && !isNoiseUserText(msg) {
					out.title = msg
				}
			}
		case "response_item":
			if row.Payload.Role == "user" && out.title == "" {
				for _, c := range row.Payload.Content {
					if c.Type != "input_text" && c.Type != "text" {
						continue
					}
					t := strings.TrimSpace(c.Text)
					if t == "" || isNoiseUserText(t) {
						continue
					}
					out.title = t
					break
				}
			}
		}
		if out.id != "" && out.title != "" && out.cwd != "" {
			break
		}
	}
	// Prefer file mtime when the scanned prefix is older than the full transcript.
	if info, err := os.Stat(path); err == nil {
		if ms := info.ModTime().UnixMilli(); ms > out.updated {
			out.updated = ms
		}
	}
	return out
}

func isNoiseUserText(s string) bool {
	if strings.HasPrefix(s, "<environment_context") || strings.HasPrefix(s, "<permissions") {
		return true
	}
	if strings.HasPrefix(s, "<") && strings.Contains(s, "</") && len(s) > 200 {
		return true
	}
	return false
}

func enrichFromHistory(byID map[string]*sessionAgg) {
	path := filepath.Join(core.UserHomeDir(), ".codex", "history.jsonl")
	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()

	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for sc.Scan() {
		var r struct {
			SessionID string `json:"session_id"`
			Text      string `json:"text"`
			Timestamp int64  `json:"timestamp"`
		}
		if json.Unmarshal(sc.Bytes(), &r) != nil || r.SessionID == "" {
			continue
		}
		t := strings.TrimSpace(r.Text)
		if t == "" {
			continue
		}
		a := byID[r.SessionID]
		if a == nil {
			a = &sessionAgg{}
			byID[r.SessionID] = a
		}
		if !a.named && a.title == "" {
			a.title = t
		}
		if a.body == "" {
			a.body = t
		} else if len(a.body) < 4000 {
			a.body = a.body + "\n" + t
		}
		// history timestamps are sometimes unix seconds
		ms := r.Timestamp
		if ms > 0 && ms < 1e12 {
			ms *= 1000
		}
		if ms > a.updated {
			a.updated = ms
		}
	}
}

func (a adapter) Resume(sessionID string) (core.ResumeSpec, error) {
	if sessionID == "" {
		return core.ResumeSpec{}, core.ErrResumeUnsupported
	}
	sessions, _ := a.ListSessions(core.SessionQuery{Limit: 200})
	for _, s := range sessions {
		if s.ID == sessionID {
			return core.ResumeSpec{
				CLI:       "codex",
				SessionID: s.ID,
				Title:     s.Title,
				Cwd:       s.Cwd,
				Command:   "codex resume " + core.ShellQuote(s.ID),
			}, nil
		}
	}
	return core.ResumeSpec{
		CLI:       "codex",
		SessionID: sessionID,
		Title:     "Codex session",
		Command:   "codex resume " + core.ShellQuote(sessionID),
	}, nil
}
