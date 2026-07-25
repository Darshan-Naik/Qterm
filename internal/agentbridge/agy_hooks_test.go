package agentbridge

import (
	"strings"
	"testing"
)

func TestParseHookAgyPreInvocationAndStop(t *testing.T) {
	p, ok := FindBySource("agy")
	if !ok {
		t.Fatal("agy plugin missing")
	}
	thinking := p.MapHook(map[string]any{
		"hook_event_name": "PreInvocation",
		"conversationId":  "conv-1",
		"workspacePaths":  []any{"/tmp/proj"},
	})
	if len(thinking) == 0 || thinking[0].Type != IntentAnimate {
		t.Fatalf("PreInvocation: %#v", thinking)
	}
	if thinking[0].SessionID != "conv-1" {
		t.Fatalf("sessionId=%q", thinking[0].SessionID)
	}
	if thinking[0].Payload["state"] != "thinking" {
		t.Fatalf("state=%v", thinking[0].Payload["state"])
	}
	if thinking[0].Payload["cwd"] != "/tmp/proj" {
		t.Fatalf("cwd=%v", thinking[0].Payload["cwd"])
	}

	done := p.MapHook(map[string]any{
		"hook_event_name":   "Stop",
		"conversationId":    "conv-1",
		"terminationReason": "model_stop",
	})
	if len(done) == 0 || done[0].Payload["state"] != "task_complete" {
		t.Fatalf("Stop: %#v", done)
	}
}

func TestAgyHooksConfigSchema(t *testing.T) {
	cfg := agyHooksConfig("/tmp/relay.sh")
	root, ok := cfg["qterm-bridge"].(map[string]any)
	if !ok {
		t.Fatalf("expected named qterm-bridge hook: %#v", cfg)
	}
	for _, key := range []string{"PreInvocation", "PostInvocation", "Stop", "PostToolUse"} {
		if _, ok := root[key]; !ok {
			t.Fatalf("missing %s", key)
		}
	}
	pre := root["PreInvocation"].([]any)
	h := pre[0].(map[string]any)
	if h["timeout"] != 5 {
		t.Fatalf("timeout want seconds 5, got %v", h["timeout"])
	}
	cmd, _ := h["command"].(string)
	if !strings.Contains(cmd, "agy PreInvocation") {
		t.Fatalf("command should pass event name: %s", cmd)
	}
}
