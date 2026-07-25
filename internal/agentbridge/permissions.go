package agentbridge

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// Claude plugin MCP tools are named mcp__plugin_<plugin>_<server>__<tool>.
// https://code.claude.com/docs/en/mcp#plugin-provided-mcp-servers
func qtermClaudeAllowRules() []string {
	return []string{
		"mcp__plugin_qterm_qterm",
		"mcp__plugin_qterm_qterm__*",
		"mcp__qterm",
		"mcp__qterm__*",
		"Skill(qterm-terminal)",
	}
}

// ensureClaudeQtermPermissions pre-allows Qterm MCP + skill so Connect doesn't
// spam per-tool trust prompts for app-bridge internals.
func ensureClaudeQtermPermissions() error {
	path := claudeSettingsJSON()
	root := map[string]any{}
	if b, err := os.ReadFile(path); err == nil && len(b) > 0 {
		_ = json.Unmarshal(b, &root)
	}
	perms, _ := root["permissions"].(map[string]any)
	if perms == nil {
		perms = map[string]any{}
	}
	allow := asStringSlice(perms["allow"])
	ask := asStringSlice(perms["ask"])
	deny := asStringSlice(perms["deny"])
	for _, rule := range qtermClaudeAllowRules() {
		allow = addUniqueString(allow, rule)
		ask = removeStringExact(ask, rule)
		deny = removeStringExact(deny, rule)
	}
	perms["allow"] = allow
	if len(ask) > 0 {
		perms["ask"] = ask
	} else {
		delete(perms, "ask")
	}
	if len(deny) > 0 {
		perms["deny"] = deny
	} else {
		delete(perms, "deny")
	}
	root["permissions"] = perms
	return writeConfigJSON(path, root)
}

// ensureCodexQtermMCPApproval sets plugin MCP tools to approve (no prompt).
// https://developers.openai.com/codex/mcp#plugin-provided-mcp-servers
func ensureCodexQtermMCPApproval(marketName string) error {
	if marketName == "" {
		marketName = codexPersonalMarketplaceName
	}
	path := codexConfigToml()
	b, err := os.ReadFile(path)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	text := string(b)
	text = stripCodexPluginTables(text, marketName)
	if !strings.HasSuffix(text, "\n") && text != "" {
		text += "\n"
	}
	text += fmt.Sprintf(`
[plugins."qterm@%s"]
enabled = true

[plugins."qterm@%s".mcp_servers.qterm]
enabled = true
default_tools_approval_mode = "approve"
`, marketName, marketName)
	return os.WriteFile(path, []byte(text), 0o644)
}

func stripCodexPluginTables(text, marketName string) string {
	if marketName == "" {
		return text
	}
	re := regexp.MustCompile(`(?s)\n?\[plugins\."qterm@` + regexp.QuoteMeta(marketName) + `"(?:\.[^\]]*)?\][^\[]*`)
	text = re.ReplaceAllString(text, "\n")
	text = regexp.MustCompile(`(?s)\n?\[plugins\."qterm@qterm"(?:\.[^\]]*)?\][^\[]*`).ReplaceAllString(text, "\n")
	return text
}

func cursorPermissionsJSON() string {
	return filepath.Join(userHomeDir(), ".cursor", "permissions.json")
}

// ensureCursorQtermPermissions adds qterm:* to ~/.cursor/permissions.json mcpAllowlist.
// https://cursor.com/docs/reference/permissions
func ensureCursorQtermPermissions() error {
	path := cursorPermissionsJSON()
	root := map[string]any{}
	if b, err := os.ReadFile(path); err == nil && len(b) > 0 {
		_ = json.Unmarshal(b, &root)
	}
	list := asStringSlice(root["mcpAllowlist"])
	list = addUniqueString(list, "qterm:*")
	root["mcpAllowlist"] = list
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return writeConfigJSON(path, root)
}

func asStringSlice(v any) []string {
	switch t := v.(type) {
	case []string:
		return append([]string(nil), t...)
	case []any:
		out := make([]string, 0, len(t))
		for _, e := range t {
			if s, ok := e.(string); ok && s != "" {
				out = append(out, s)
			}
		}
		return out
	default:
		return nil
	}
}

func addUniqueString(list []string, s string) []string {
	for _, e := range list {
		if e == s {
			return list
		}
	}
	return append(list, s)
}

func removeStringExact(list []string, s string) []string {
	out := list[:0]
	for _, e := range list {
		if e != s {
			out = append(out, e)
		}
	}
	return out
}
