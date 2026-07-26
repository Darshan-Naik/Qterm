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
	case "session_start", "before_agent", "pre_invocation":
		out = []Intent{anim("thinking")}
		// Some CLIs put the prompt on agent-start events.
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
		nType := FirstString(in.Raw, "notification_type", "notificationType")
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
	case "post_tool", "after_tool", "post_invocation":
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
