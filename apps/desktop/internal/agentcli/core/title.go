package core

import (
	"fmt"
	"strings"
	"unicode"
)

const (
	autoTitleMaxWords = 6
	autoTitleMaxRunes = 42
)

// promptFromRaw extracts the user prompt text from CLI hook payloads.
func promptFromRaw(raw map[string]any) string {
	if raw == nil {
		return ""
	}
	if p := FirstString(raw, "prompt", "user_prompt", "userPrompt", "text", "message", "content"); p != "" {
		return strings.TrimSpace(p)
	}
	if p := NestedString(raw, "input", "prompt"); p != "" {
		return strings.TrimSpace(p)
	}
	if p := NestedString(raw, "prompt", "text"); p != "" {
		return strings.TrimSpace(p)
	}
	return ""
}

// TitleFromPrompt derives a short sidebar label from the first user prompt
// (Orca/cmux-style: deterministic, no model call).
func TitleFromPrompt(prompt string) string {
	prompt = strings.TrimSpace(prompt)
	if prompt == "" {
		return ""
	}
	// Skip slash-commands and harness noise. `/rename` is handled separately.
	if strings.HasPrefix(prompt, "/") {
		return ""
	}
	if strings.HasPrefix(prompt, "<") && strings.Contains(prompt, ">") {
		// Task-callback XML etc.
		return ""
	}
	// Collapse whitespace.
	var b strings.Builder
	prevSpace := false
	for _, r := range prompt {
		if unicode.IsSpace(r) {
			if !prevSpace && b.Len() > 0 {
				b.WriteByte(' ')
				prevSpace = true
			}
			continue
		}
		prevSpace = false
		b.WriteRune(r)
	}
	clean := strings.TrimSpace(b.String())
	if clean == "" {
		return ""
	}

	words := strings.Fields(clean)
	if len(words) > autoTitleMaxWords {
		words = words[:autoTitleMaxWords]
	}
	title := strings.Join(words, " ")
	runes := []rune(title)
	if len(runes) > autoTitleMaxRunes {
		title = strings.TrimSpace(string(runes[:autoTitleMaxRunes]))
		title = strings.TrimRight(title, ".,;:!-—")
		if title != "" {
			title += "…"
		}
	} else {
		title = strings.TrimRight(title, ".,;:!")
	}
	if len([]rune(title)) < 2 {
		return ""
	}
	return title
}

// TitleFromRenameSlash extracts the name from `/rename <title>` or `/title <title>`.
// Bare `/rename` (Claude generates a name from session context) returns "".
func TitleFromRenameSlash(prompt string) string {
	_, name, ok := parseRenameSlash(prompt)
	if !ok {
		return ""
	}
	return name
}

// IsBareRenameSlash is true for `/rename` / `/title` with no name — Claude then
// writes a generated custom-title into the session transcript.
func IsBareRenameSlash(prompt string) bool {
	_, name, ok := parseRenameSlash(prompt)
	return ok && name == ""
}

func parseRenameSlash(prompt string) (cmd, name string, ok bool) {
	prompt = strings.TrimSpace(prompt)
	if prompt == "" || prompt[0] != '/' {
		return "", "", false
	}
	body := strings.TrimSpace(prompt[1:])
	cmd, name, found := strings.Cut(body, " ")
	if !found {
		cmd, name, found = strings.Cut(body, "\t")
	}
	if !found {
		cmd, name = body, ""
	}
	switch strings.ToLower(strings.TrimSpace(cmd)) {
	case "rename", "title":
	default:
		return "", "", false
	}
	name = strings.TrimSpace(name)
	name = strings.Trim(name, `"'`)
	return strings.ToLower(strings.TrimSpace(cmd)), strings.TrimSpace(name), true
}

func autoTitleIntent(hookID, sessionID, name, cwd string) Intent {
	intent := Intent{
		ID:        fmt.Sprintf("%s-auto-title-%s", hookID, name),
		HookID:    hookID,
		SessionID: sessionID,
		Type:      IntentAutoTitle,
		Payload: map[string]any{
			"name":   name,
			"agent":  hookID,
			"source": "first_prompt",
		},
	}
	if cwd != "" {
		intent.Payload["cwd"] = cwd
	}
	return intent
}
