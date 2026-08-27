package core

import (
	"bufio"
	"encoding/json"
	"os"
	"strings"
)

// LastCustomTitleFromJSONL returns the last Claude `custom-title` record in a
// session transcript. Bare `/rename` writes this after generating a name from
// conversation context — it is not in the UserPromptSubmit payload.
func LastCustomTitleFromJSONL(path string) string {
	path = strings.TrimSpace(path)
	if path == "" {
		return ""
	}
	f, err := os.Open(path)
	if err != nil {
		return ""
	}
	defer f.Close()

	var title string
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for sc.Scan() {
		line := sc.Bytes()
		if len(line) == 0 {
			continue
		}
		var row struct {
			Type        string `json:"type"`
			CustomTitle string `json:"customTitle"`
		}
		if json.Unmarshal(line, &row) != nil {
			continue
		}
		if row.Type != "custom-title" {
			continue
		}
		if t := strings.TrimSpace(row.CustomTitle); t != "" {
			title = t
		}
	}
	return title
}
