package agentbridge

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const qtermPluginName = "qterm"
const qtermPluginVersion = "1.2.4"

func userHomeDir() string {
	home, _ := os.UserHomeDir()
	return home
}

// relayScriptBody is the shared hook relay used by plugins and the legacy shared script.
// It only posts when QTERM_SESSION_ID is set (injected into Qterm PTYs). Outside Qterm
// the same global CLI hooks fire but no-op — cmux CMUX_SURFACE_ID pattern.
//
// Usage: relay.sh <source> [event]
// Optional event (e.g. PreInvocation) is injected as hook_event_name when the CLI
// payload omits it (Antigravity).
func relayScriptBody(dataDir, token, sourceDefault string) string {
	if sourceDefault == "" {
		sourceDefault = "claude"
	}
	return fmt.Sprintf(`#!/bin/bash
# %s — plugin hook relay (Qterm panes only)
SOURCE="${1:-%s}"
EVENT="${2:-}"
# Always emit JSON for CLIs that require stdout (Antigravity PostToolUse/Stop).
emit_ok() { echo '{}'; }
# Outside Qterm: CLI plugins stay installed globally but must not talk to the bridge.
if [[ -z "${QTERM_SESSION_ID:-}" ]]; then
  emit_ok
  exit 0
fi
BRIDGE=%q
TOKEN=%q
BASE="http://127.0.0.1:%d"
if [[ -f "$BRIDGE" ]]; then
  BASE=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["url"])' "$BRIDGE" 2>/dev/null || echo "$BASE")
  TOKEN=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["token"])' "$BRIDGE" 2>/dev/null || echo "$TOKEN")
fi
BODY=$(cat)
if [[ -n "$EVENT" ]]; then
  BODY=$(printf '%%s' "$BODY" | python3 -c '
import json,sys
event=sys.argv[1]
raw=sys.stdin.read()
try:
  d=json.loads(raw) if raw.strip() else {}
except Exception:
  d={}
if not isinstance(d, dict):
  d={}
if event and "hook_event_name" not in d and "hookEventName" not in d and "event" not in d:
  d["hook_event_name"]=event
print(json.dumps(d))
' "$EVENT" 2>/dev/null || printf '%%s' "$BODY")
fi
HDRS=(-H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -H "X-Qterm-Hook: %s")
HDRS+=(-H "X-Qterm-Terminal-Id: $QTERM_SESSION_ID")
if [[ -n "${QTERM_PROJECT_ID:-}" ]]; then
  HDRS+=(-H "X-Qterm-Project-Id: $QTERM_PROJECT_ID")
fi
curl -sS -m 3 -X POST "$BASE/v1/hooks/$SOURCE" "${HDRS[@]}" -d "$BODY" >/dev/null 2>&1 || true
emit_ok
exit 0
`, HookMarker, sourceDefault, EndpointPath(dataDir), token, DefaultPort, HookMarker)
}

// writePluginRelay writes a stdin→bridge hook script. sourceDefault is used when argv[1] is empty.
func writePluginRelay(path, dataDir, token, sourceDefault string) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(relayScriptBody(dataDir, token, sourceDefault)), 0o755)
}

func writeQtermSkill(dir string) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	skill := strings.Join([]string{
		"---",
		"name: qterm-terminal",
		"description: Control Qterm terminals via MCP. Use get_terminal_id, rename_terminal, create_terminal.",
		"allowed-tools: mcp__plugin_qterm_qterm mcp__plugin_qterm_qterm__* mcp__qterm mcp__qterm__*",
		"---",
		"",
		"# Qterm terminal control",
		"",
		"## Scope",
		"",
		"Only use these tools when this agent is running inside a Qterm terminal pane.",
		"Outside Qterm, tools refuse and hooks no-op.",
		"",
		"## Identity (important)",
		"",
		"1. Call get_terminal_id once at the start of a task that touches Qterm.",
		"2. It returns {\"id\":\"...\",\"name\":\"...\",\"projectId\":\"...\",\"cwd\":\"...\"}.",
		"3. Pass that id as terminalId (or id) on rename_terminal / create_terminal / focus_terminal.",
		"4. Never assume the focused UI tab is your terminal.",
		"",
		"## Rename (keep the tab in sync)",
		"",
		"When you name or rename this session from the first user prompt or task context,",
		"also call rename_terminal with that same short name so the Qterm tab matches.",
		"Qterm already auto-names once from the first user prompt — only rename if the user asks or /rename.",
		"rename_terminal always works for agents (even if the user renamed earlier).",
		"Call rename_terminal with {\"name\":\"<new name>\", \"id\":\"<id from get_terminal_id>\"}.",
		"Do not use printf/OSC title hacks.",
		"",
		"## Create terminal in this project",
		"",
		"Call create_terminal with {\"name\":\"...\"} and omit projectId to inherit this agent's project,",
		"or pass projectId from list_projects / get_terminal_id.",
		"",
		"Other tools: list_terminals, list_projects, set_theme.",
		"",
	}, "\n")
	return os.WriteFile(filepath.Join(dir, "SKILL.md"), []byte(skill), 0o644)
}

func qtermMCPServer(mcpCommand, dataDir, token string) map[string]any {
	if mcpCommand == "" {
		mcpCommand = os.Args[0]
	}
	return map[string]any{
		"command": mcpCommand,
		"args":    []any{"mcp"},
		"env": map[string]any{
			"QTERM_BRIDGE_URL":   fmt.Sprintf("http://127.0.0.1:%d", DefaultPort),
			"QTERM_BRIDGE_TOKEN": token,
			"QTERM_DATA_DIR":     dataDir,
		},
	}
}

func nestedCommandHooks(events []string, command string, args []any, opts map[string]any) map[string]any {
	hooks := map[string]any{}
	for _, event := range events {
		inner := map[string]any{
			"type":    "command",
			"command": command,
		}
		if len(args) > 0 {
			inner["args"] = args
		}
		for k, v := range opts {
			inner[k] = v
		}
		// SessionEnd often has a short timeout ceiling on agent CLIs.
		if event == "SessionEnd" || event == "sessionEnd" {
			if t, ok := inner["timeout"].(int); ok && t >= 1000 {
				inner["timeout"] = 3000
			} else {
				inner["timeout"] = 3
			}
		}
		hooks[event] = []any{
			map[string]any{"hooks": []any{inner}},
		}
	}
	return hooks
}
