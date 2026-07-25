package agentbridge

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
)

// ParseInput is the normalized hook trigger after CLI-specific field extraction.
type ParseInput struct {
	Source    string
	Title     string
	Event     string
	SessionID string
	Cwd       string
	Raw       map[string]any
}

// ParseHook maps CLI hook events → Qterm UI intents.
// Routine lifecycle stays silent (sidebar animation only).
func ParseHook(in ParseInput) []Intent {
	anim := func(state string) Intent {
		return animateIntentWithCwd(in.Source, in.SessionID, state, in.Cwd)
	}
	var out []Intent
	switch normalizeEvent(in.Event) {
	case "session_start", "before_agent":
		out = []Intent{anim("thinking")}
		// Some CLIs (Gemini) put the prompt on BeforeAgent instead of UserPromptSubmit.
		if prompt := promptFromRaw(in.Raw); prompt != "" {
			if title := TitleFromPrompt(prompt); title != "" {
				out = append(out, autoTitleIntent(in.Source, in.SessionID, title, in.Cwd))
			}
		}
	case "session_end":
		out = []Intent{anim("none")}
	case "user_prompt", "before_model":
		out = []Intent{anim("thinking")}
		// First-prompt → tab name (once). Prefer explicit sessionTitle/customTitle below.
		if prompt := promptFromRaw(in.Raw); prompt != "" {
			if title := TitleFromPrompt(prompt); title != "" {
				out = append(out, autoTitleIntent(in.Source, in.SessionID, title, in.Cwd))
			}
		}
	case "stop", "after_agent":
		out = []Intent{anim("task_complete")}
	case "stop_failure":
		out = []Intent{anim("action_required")}
	case "notification":
		nType := firstString(in.Raw, "notification_type", "notificationType")
		switch nType {
		case "permission_prompt", "agent_needs_input", "elicitation_dialog", "idle_prompt":
			out = []Intent{anim("action_required")}
		case "agent_completed", "elicitation_complete":
			out = []Intent{anim("task_complete")}
		default:
			out = []Intent{anim("thinking")}
		}
	case "permission", "elicitation":
		out = []Intent{anim("action_required")}
	case "pre_tool", "before_tool":
		out = []Intent{anim("thinking")}
	case "post_tool", "after_tool":
		out = []Intent{anim("thinking")}
		// Do not adopt OSC titles from shell printf — those are process/cwd noise.
	default:
		if strings.TrimSpace(in.Event) == "" {
			out = nil
		} else {
			out = []Intent{anim("thinking")}
		}
	}
	// Explicit CLI session title (/rename, customTitle) — not raw OSC process names.
	if title := sessionTitleFromRaw(in.Raw); title != "" {
		ri := renameIntentWithCwd(in.Source, in.SessionID, title, in.Cwd)
		ri.Payload["source"] = "session_title"
		out = append(out, ri)
	}
	return out
}

func sessionTitleFromRaw(raw map[string]any) string {
	if raw == nil {
		return ""
	}
	if t := firstString(raw,
		"session_title", "sessionTitle",
		"custom_title", "customTitle",
	); t != "" {
		return strings.TrimSpace(t)
	}
	if t := nestedString(raw, "session", "title"); t != "" {
		return strings.TrimSpace(t)
	}
	if t := nestedString(raw, "session", "customTitle"); t != "" {
		return strings.TrimSpace(t)
	}
	if t := nestedString(raw, "session", "custom_title"); t != "" {
		return strings.TrimSpace(t)
	}
	return ""
}

func normalizeEvent(event string) string {
	e := strings.ToLower(strings.TrimSpace(event))
	e = strings.ReplaceAll(e, "-", "_")
	switch e {
	case "sessionstart":
		return "session_start"
	case "sessionend":
		return "session_end"
	case "userpromptsubmit", "beforesubmitprompt":
		return "user_prompt"
	case "stopfailure":
		return "stop_failure"
	case "permissionrequest":
		return "permission"
	case "pretooluse", "beforetool", "beforeshellexecution", "beforemcpexecution":
		return "pre_tool"
	case "posttooluse", "aftertool", "aftershellexecution", "aftermcpexecution", "afterfileedit":
		return "post_tool"
	case "beforeagent":
		return "before_agent"
	case "afteragent", "afteragentresponse":
		return "after_agent"
	case "beforemodel":
		return "before_model"
	case "notification", "elicitation", "stop":
		return e
	default:
		return e
	}
}

func animateIntent(hookID, sessionID, state string) Intent {
	return Intent{
		ID:        fmt.Sprintf("%s-anim-%s", hookID, state),
		HookID:    hookID,
		SessionID: sessionID,
		Type:      "animate",
		Payload: map[string]any{
			"state": state,
			"agent": hookID,
		},
	}
}

func animateIntentWithCwd(hookID, sessionID, state, cwd string) Intent {
	intent := animateIntent(hookID, sessionID, state)
	if cwd != "" {
		intent.Payload["cwd"] = cwd
	}
	return intent
}

func renameIntent(hookID, sessionID, name string) Intent {
	return Intent{
		ID:        fmt.Sprintf("%s-rename-%s", hookID, name),
		HookID:    hookID,
		SessionID: sessionID,
		Type:      "rename",
		Payload: map[string]any{
			"name":  name,
			"agent": hookID,
		},
	}
}

func renameIntentWithCwd(hookID, sessionID, name, cwd string) Intent {
	intent := renameIntent(hookID, sessionID, name)
	if cwd != "" {
		intent.Payload["cwd"] = cwd
	}
	return intent
}

func firstString(m map[string]any, keys ...string) string {
	if m == nil {
		return ""
	}
	for _, k := range keys {
		if v, ok := m[k].(string); ok && v != "" {
			return v
		}
	}
	return ""
}

func nestedString(m map[string]any, path ...string) string {
	var cur any = m
	for _, p := range path {
		obj, ok := cur.(map[string]any)
		if !ok {
			return ""
		}
		cur = obj[p]
	}
	s, _ := cur.(string)
	return s
}

func titleFromToolPayload(raw map[string]any) string {
	candidates := []string{
		firstString(raw, "command", "cmd"),
		nestedString(raw, "tool_input", "command"),
		nestedString(raw, "tool_input", "cmd"),
		nestedString(raw, "input", "command"),
		nestedString(raw, "toolInput", "command"),
		nestedString(raw, "parameters", "command"),
	}
	if ti, ok := raw["tool_input"].(map[string]any); ok {
		for _, v := range ti {
			if s, ok := v.(string); ok && (strings.Contains(s, "]0;") || strings.Contains(s, "]2;")) {
				candidates = append(candidates, s)
			}
		}
	}
	for _, c := range candidates {
		if title := extractOSCTitleFromCommand(c); title != "" {
			return title
		}
	}
	// Last resort: scan the whole payload JSON (Codex nests fields differently).
	if b, err := json.Marshal(raw); err == nil {
		if title := extractOSCTitleFromCommand(string(b)); title != "" {
			return title
		}
	}
	return ""
}

var (
	rePrintfPercent = regexp.MustCompile(`(?i)printf\s+['"](?:\\033|\\e|\\x1b)\][02];%s(?:\\007|\\a|\\x07)['"]\s+['"]([^'"]+)['"]`)
	rePrintfLiteral = regexp.MustCompile(`(?i)(?:printf|echo)\s+.*?['"](?:\\033|\\e|\\x1b)\][02];([^'"\\]+)(?:\\007|\\a|\\x07)['"]`)
	reOSCBare       = regexp.MustCompile(`\][02];([^\x07\x1b\\]{1,120})`)
)

func extractOSCTitleFromCommand(cmd string) string {
	cmd = strings.TrimSpace(cmd)
	if cmd == "" {
		return ""
	}
	if m := rePrintfPercent.FindStringSubmatch(cmd); len(m) > 1 {
		return strings.TrimSpace(m[1])
	}
	if m := rePrintfLiteral.FindStringSubmatch(cmd); len(m) > 1 {
		return strings.TrimSpace(m[1])
	}
	if strings.Contains(cmd, "printf") || strings.Contains(cmd, "\\033]") || strings.Contains(cmd, "\\e]") || strings.Contains(cmd, "]0;") || strings.Contains(cmd, "]2;") {
		if m := reOSCBare.FindStringSubmatch(cmd); len(m) > 1 {
			return strings.TrimSpace(m[1])
		}
	}
	return ""
}

// Intent is emitted to the Qterm UI.
type Intent struct {
	ID         string         `json:"id"`
	HookID     string         `json:"hookId"`
	SessionID  string         `json:"sessionId"`            // CLI session id (or resolved Qterm id after bridge)
	TerminalID string         `json:"terminalId,omitempty"` // Qterm pane id when known (from QTERM_SESSION_ID)
	Type       string         `json:"type"`
	Payload    map[string]any `json:"payload"`
}
