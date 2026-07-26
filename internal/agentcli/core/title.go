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
	// Skip slash-commands and harness noise.
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
