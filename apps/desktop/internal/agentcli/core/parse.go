package core

import (
	"fmt"
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
	case "session_start":
		// CLI launched — show the agent icon, not “running”. Running starts on a prompt.
		out = []Intent{anim("idle")}
	case "before_agent", "pre_invocation":
		out = []Intent{anim("thinking")}
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
		// Failed turn (rate limit, billing, …) — done, not waiting for a question.
		out = []Intent{anim("task_complete")}
	case "request_user_input":
		out = []Intent{anim("action_required")}
	case "notification":
		nType := FirstString(in.Raw, "notification_type", "notificationType")
		if isNeedsInputNotification(nType) {
			out = []Intent{anim("action_required")}
		} else {
			switch compactHookName(nType) {
			case "agent_completed", "elicitation_complete":
				out = []Intent{anim("task_complete")}
			case "idle_prompt", "idle":
				out = []Intent{anim("idle")}
			default:
				out = nil
			}
		}
	case "permission", "elicitation":
		out = []Intent{anim("action_required")}
	case "pre_tool", "before_tool":
		if isRequestUserInputTool(in.Raw) {
			out = []Intent{anim("action_required")}
		} else {
			out = []Intent{anim("thinking")}
		}
	case "post_tool", "after_tool", "post_invocation":
		out = []Intent{anim("thinking")}
		// Do not adopt OSC titles from shell printf — those are process/cwd noise.
	default:
		out = nil
	}
	// Explicit CLI session title from this hook payload — never PTY OSC scraping.
	// `/rename` in the prompt wins over a stale customTitle echoed on the same event.
	prompt := promptFromRaw(in.Raw)
	if title := TitleFromRenameSlash(prompt); title != "" {
		ri := renameIntentWithCwd(in.Source, in.SessionID, title, in.Cwd)
		ri.Payload["source"] = "rename_slash"
		out = append(out, ri)
	} else if IsBareRenameSlash(prompt) {
		// Claude `/rename` with no args: Haiku names the session from context and
		// appends a custom-title record to transcript_path (not present on this event).
		ri := renameIntentWithCwd(in.Source, in.SessionID, "", in.Cwd)
		ri.Payload["source"] = "rename_slash_auto"
		if path := FirstString(in.Raw, "transcript_path", "transcriptPath"); path != "" {
			ri.Payload["transcriptPath"] = path
		}
		out = append(out, ri)
	} else if title := sessionTitleFromRaw(in.Raw); title != "" {
		ri := renameIntentWithCwd(in.Source, in.SessionID, title, in.Cwd)
		ri.Payload["source"] = "session_title"
		out = append(out, ri)
	}
	return out
}

func toolNameFromRaw(raw map[string]any) string {
	n := FirstString(raw, "tool_name", "toolName", "tool")
	if n != "" {
		return n
	}
	return NestedString(raw, "tool", "name")
}

func compactHookName(s string) string {
	s = strings.ToLower(strings.TrimSpace(s))
	return strings.ReplaceAll(s, "-", "_")
}

func isNeedsInputNotification(nType string) bool {
	n := compactHookName(nType)
	switch n {
	case "permission_prompt", "agent_needs_input", "elicitation_dialog",
		"request_user_input", "tool_permission", "toolpermission":
		return true
	default:
		return false
	}
}

// isRequestUserInputTool is true for CLI tools that block on a human answer
// (Codex request_user_input, Claude AskUserQuestion, Cursor AskQuestion).
func isRequestUserInputTool(raw map[string]any) bool {
	n := compactHookName(toolNameFromRaw(raw))
	if n == "" {
		return false
	}
	keys := []string{
		"request_user_input", "requestuserinput",
		"ask_user_question", "askuserquestion",
		"ask_question", "askquestion",
	}
	for _, key := range keys {
		if n == key || strings.Contains(n, key) {
			return true
		}
	}
	return false
}

func sessionTitleFromRaw(raw map[string]any) string {
	if raw == nil {
		return ""
	}
	if t := FirstString(raw,
		"session_title", "sessionTitle",
		"custom_title", "customTitle",
	); t != "" {
		return strings.TrimSpace(t)
	}
	if t := NestedString(raw, "session", "title"); t != "" {
		return strings.TrimSpace(t)
	}
	if t := NestedString(raw, "session", "customTitle"); t != "" {
		return strings.TrimSpace(t)
	}
	if t := NestedString(raw, "session", "custom_title"); t != "" {
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
	case "requestuserinput", "request_user_input", "userinputrequest", "user_input_request":
		return "request_user_input"
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
	case "preinvocation":
		return "pre_invocation"
	case "postinvocation":
		return "post_invocation"
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
		Type:      IntentAnimate,
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
		Type:      IntentRename,
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

// FirstString returns the first non-empty string value for any of the keys.
func FirstString(m map[string]any, keys ...string) string {
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

// NestedString walks nested map keys and returns a string leaf.
func NestedString(m map[string]any, path ...string) string {
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

// Intent kinds emitted to the Qterm UI / bridge.
const (
	IntentAnimate   = "animate"
	IntentRename    = "rename"
	IntentAutoTitle = "auto_title"
)

// Intent is emitted to the Qterm UI.
type Intent struct {
	ID         string         `json:"id"`
	HookID     string         `json:"hookId"`
	SessionID  string         `json:"sessionId"`            // CLI session id (or resolved Qterm id after bridge)
	TerminalID string         `json:"terminalId,omitempty"` // Qterm pane id when known (from QTERM_SESSION_ID)
	Type       string         `json:"type"`
	Payload    map[string]any `json:"payload"`
}
