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
		out = []Intent{anim(toolActivity(in))}
	case "post_tool", "after_tool", "post_invocation":
		// A background task keeps running after the hook returns.
		// A file-edit hook is the edit itself, so keep the editing orb until the next event.
		switch {
		case isBackgroundTool(in.Raw):
			out = []Intent{anim("background")}
		case isFileEditEvent(in.Event):
			out = []Intent{anim("editing")}
		default:
			out = []Intent{anim("thinking")}
		}
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

// toolActivity picks the sidebar orb for a tool hook.
// thinking stays the model turn; these are the other live statuses.
func toolActivity(in ParseInput) string {
	if isRequestUserInputTool(in.Raw) {
		return "action_required"
	}
	if isBackgroundTool(in.Raw) {
		return "background"
	}
	name := compactHookName(toolNameFromRaw(in.Raw))
	if name == "" && isShellEvent(in.Event) {
		return "running"
	}
	if name == "" && isMcpEvent(in.Event) {
		return "connecting"
	}
	return classifyToolName(name)
}

func toolInput(raw map[string]any) map[string]any {
	if raw == nil {
		return nil
	}
	for _, key := range []string{"tool_input", "toolInput", "input", "arguments", "args"} {
		if m, ok := raw[key].(map[string]any); ok {
			return m
		}
	}
	tool, ok := raw["tool"].(map[string]any)
	if !ok {
		return nil
	}
	if m, ok := tool["input"].(map[string]any); ok {
		return m
	}
	return tool
}

func truthy(m map[string]any, keys ...string) bool {
	if m == nil {
		return false
	}
	for _, key := range keys {
		switch v := m[key].(type) {
		case bool:
			if v {
				return true
			}
		case string:
			if v == "true" || v == "1" {
				return true
			}
		case float64:
			if v != 0 {
				return true
			}
		}
	}
	return false
}

func isBackgroundTool(raw map[string]any) bool {
	if truthy(raw, "run_in_background", "is_background", "background") {
		return true
	}
	input := toolInput(raw)
	if truthy(input, "run_in_background", "is_background", "background") {
		return true
	}
	if FirstString(input, "subagent_type", "subagentType") != "" || FirstString(raw, "subagent_type", "subagentType") != "" {
		return true
	}
	switch compactHookName(toolNameFromRaw(raw)) {
	case "subagent", "background", "background_shell", "run_background":
		return true
	default:
		return false
	}
}

func compactEvent(event string) string {
	e := strings.ToLower(strings.TrimSpace(event))
	return strings.ReplaceAll(e, "-", "_")
}

func isShellEvent(event string) bool {
	switch compactEvent(event) {
	case "beforeshellexecution", "before_shell_execution", "aftershellexecution", "after_shell_execution":
		return true
	default:
		return false
	}
}

func isMcpEvent(event string) bool {
	switch compactEvent(event) {
	case "beforemcpexecution", "before_mcp_execution", "aftermcpexecution", "after_mcp_execution":
		return true
	default:
		return false
	}
}

func isFileEditEvent(event string) bool {
	switch compactEvent(event) {
	case "afterfileedit", "after_file_edit":
		return true
	default:
		return false
	}
}

func classifyToolName(name string) string {
	switch {
	case name == "":
		return "tool_use"
	case isEditTool(name):
		return "editing"
	case isSearchTool(name):
		return "searching"
	case isShellTool(name):
		return "running"
	case strings.Contains(name, "mcp"):
		return "connecting"
	default:
		return "tool_use"
	}
}

func isSearchTool(name string) bool {
	switch name {
	case "grep", "glob", "rg", "search", "read", "read_file", "webfetch", "web_fetch",
		"websearch", "web_search", "codebase_search", "semantic_search", "find_files", "list_dir", "ls":
		return true
	default:
		return strings.Contains(name, "search") || strings.Contains(name, "grep")
	}
}

func isEditTool(name string) bool {
	switch name {
	case "edit", "write", "strreplace", "str_replace", "apply_patch", "multiedit", "notebookedit",
		"search_replace", "edit_file", "write_file", "create_file":
		return true
	default:
		return strings.Contains(name, "edit") || strings.HasPrefix(name, "write") || strings.Contains(name, "patch")
	}
}

func isShellTool(name string) bool {
	switch name {
	case "bash", "shell", "powershell", "zsh", "run_terminal_cmd", "run_command", "execute_command", "shell_command":
		return true
	default:
		return strings.Contains(name, "shell") || strings.Contains(name, "bash")
	}
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
	case "stopcancelled", "stop_cancelled":
		return "stop"
	case "permissionrequest", "permissiondenied", "permission_denied":
		return "permission"
	case "requestuserinput", "request_user_input", "userinputrequest", "user_input_request":
		return "request_user_input"
	case "pretooluse", "beforetool", "beforeshellexecution", "beforemcpexecution":
		return "pre_tool"
	case "posttooluse", "posttoolusefailure", "aftertool", "aftershellexecution", "aftermcpexecution", "afterfileedit":
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
