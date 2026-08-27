package core

import "testing"

func TestParseHookRequestUserInputEvent(t *testing.T) {
	for _, event := range []string{"request_user_input", "RequestUserInput", "UserInputRequest"} {
		out := ParseHook(ParseInput{Source: "codex", Event: event, SessionID: "s1"})
		if len(out) != 1 || payloadState(out[0]) != "action_required" {
			t.Fatalf("event %q: got %#v", event, out)
		}
	}
}

func TestParseHookPreToolUseRequestUserInput(t *testing.T) {
	out := ParseHook(ParseInput{
		Source:    "codex",
		Event:     "PreToolUse",
		SessionID: "s1",
		Raw:       map[string]any{"tool_name": "request_user_input"},
	})
	if len(out) != 1 || payloadState(out[0]) != "action_required" {
		t.Fatalf("got %#v", out)
	}

	other := ParseHook(ParseInput{
		Source:    "codex",
		Event:     "PreToolUse",
		SessionID: "s1",
		Raw:       map[string]any{"tool_name": "Bash"},
	})
	if len(other) != 1 || payloadState(other[0]) != "thinking" {
		t.Fatalf("bash pre_tool: %#v", other)
	}
}

func TestParseHookPostToolUseRequestUserInputStaysThinking(t *testing.T) {
	out := ParseHook(ParseInput{
		Source:    "codex",
		Event:     "PostToolUse",
		SessionID: "s1",
		Raw:       map[string]any{"tool_name": "request_user_input"},
	})
	if len(out) != 1 || payloadState(out[0]) != "thinking" {
		t.Fatalf("got %#v", out)
	}
}

func TestParseHookAskUserQuestionClaude(t *testing.T) {
	out := ParseHook(ParseInput{
		Source:    "claude",
		Event:     "PreToolUse",
		SessionID: "s1",
		Raw:       map[string]any{"tool_name": "AskUserQuestion"},
	})
	if len(out) != 1 || payloadState(out[0]) != "action_required" {
		t.Fatalf("got %#v", out)
	}
}

func TestParseHookAskQuestionCursor(t *testing.T) {
	out := ParseHook(ParseInput{
		Source:    "cursor",
		Event:     "preToolUse",
		SessionID: "s1",
		Raw:       map[string]any{"tool_name": "AskQuestion"},
	})
	if len(out) != 1 || payloadState(out[0]) != "action_required" {
		t.Fatalf("got %#v", out)
	}
}

func TestParseHookGeminiToolPermissionNotification(t *testing.T) {
	out := ParseHook(ParseInput{
		Source:    "gemini",
		Event:     "Notification",
		SessionID: "s1",
		Raw:       map[string]any{"notification_type": "ToolPermission"},
	})
	if len(out) != 1 || payloadState(out[0]) != "action_required" {
		t.Fatalf("got %#v", out)
	}
}

func TestParseHookClaudeElicitationAndPermission(t *testing.T) {
	for _, event := range []string{"Elicitation", "PermissionRequest"} {
		out := ParseHook(ParseInput{Source: "claude", Event: event, SessionID: "s1"})
		if len(out) != 1 || payloadState(out[0]) != "action_required" {
			t.Fatalf("event %q: got %#v", event, out)
		}
	}
}

func TestParseHookGeminiBeforeToolAskUser(t *testing.T) {
	out := ParseHook(ParseInput{
		Source:    "gemini",
		Event:     "BeforeTool",
		SessionID: "s1",
		Raw:       map[string]any{"tool_name": "ask_user_question"},
	})
	if len(out) != 1 || payloadState(out[0]) != "action_required" {
		t.Fatalf("got %#v", out)
	}
}

func TestParseHookSessionStartIsIdle(t *testing.T) {
	out := ParseHook(ParseInput{Source: "codex", Event: "SessionStart", SessionID: "s1"})
	if len(out) != 1 || payloadState(out[0]) != "idle" {
		t.Fatalf("got %#v", out)
	}
}

func TestParseHookIdlePromptIsNotNeedsInput(t *testing.T) {
	out := ParseHook(ParseInput{
		Source:    "claude",
		Event:     "Notification",
		SessionID: "s1",
		Raw:       map[string]any{"notification_type": "idle_prompt"},
	})
	if len(out) != 1 || payloadState(out[0]) != "idle" {
		t.Fatalf("got %#v", out)
	}
}

func TestParseHookStopFailureIsCompleteNotNeedsInput(t *testing.T) {
	out := ParseHook(ParseInput{Source: "claude", Event: "StopFailure", SessionID: "s1"})
	if len(out) != 1 || payloadState(out[0]) != "task_complete" {
		t.Fatalf("got %#v", out)
	}
}

func TestParseHookUnknownNotificationSilent(t *testing.T) {
	out := ParseHook(ParseInput{
		Source:    "claude",
		Event:     "Notification",
		SessionID: "s1",
		Raw:       map[string]any{"notification_type": "session_init"},
	})
	if len(out) != 0 {
		t.Fatalf("got %#v", out)
	}
}

func payloadState(in Intent) string {
	s, _ := in.Payload["state"].(string)
	return s
}

func payloadName(in Intent) string {
	s, _ := in.Payload["name"].(string)
	return s
}

func TestParseHookClaudeRenameSlash(t *testing.T) {
	out := ParseHook(ParseInput{
		Source:    "claude",
		Event:     "UserPromptSubmit",
		SessionID: "s1",
		Raw:       map[string]any{"prompt": "/rename Fix login redirect"},
	})
	var renamed, source string
	for _, in := range out {
		if in.Type == IntentRename {
			renamed = payloadName(in)
			source, _ = in.Payload["source"].(string)
		}
	}
	if renamed != "Fix login redirect" || source != "rename_slash" {
		t.Fatalf("rename want Fix login redirect/rename_slash got %#v", out)
	}
}

func TestParseHookClaudeRenameQuoted(t *testing.T) {
	out := ParseHook(ParseInput{
		Source:    "claude",
		Event:     "UserPromptSubmit",
		SessionID: "s1",
		Raw:       map[string]any{"prompt": `/rename "auth"`},
	})
	var renamed string
	for _, in := range out {
		if in.Type == IntentRename {
			renamed = payloadName(in)
		}
	}
	if renamed != "auth" {
		t.Fatalf("got %#v", out)
	}
}

func TestParseHookRenameSlashWinsOverStaleCustomTitle(t *testing.T) {
	out := ParseHook(ParseInput{
		Source:    "claude",
		Event:     "UserPromptSubmit",
		SessionID: "s1",
		Raw: map[string]any{
			"prompt":       "/rename Auth flow",
			"customTitle":  "Quasar",
			"sessionTitle": "Quasar",
		},
	})
	var renamed, source string
	for _, in := range out {
		if in.Type == IntentRename {
			renamed = payloadName(in)
			source, _ = in.Payload["source"].(string)
		}
	}
	if renamed != "Auth flow" || source != "rename_slash" {
		t.Fatalf("slash rename should win over stale customTitle, got %#v", out)
	}
}

func TestTitleFromRenameSlashIgnoresBareAndOtherCommands(t *testing.T) {
	if TitleFromRenameSlash("/rename") != "" {
		t.Fatal("bare /rename should not rename")
	}
	if TitleFromRenameSlash("/compact") != "" {
		t.Fatal("other slash commands should not rename")
	}
	if TitleFromRenameSlash("rename this tab") != "" {
		t.Fatal("plain text should not parse as slash rename")
	}
}
