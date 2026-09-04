package codex

import (
	"fmt"
	"os"
	"regexp"
	"strings"
)

var reQtermMCPBlock = regexp.MustCompile(`(?m)^\[mcp_servers\.qterm(?:\.[^\]]+)?\][^\n]*\n(?:[^\[\n][^\n]*\n)*`)

func removeMCPToml(path string) error {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	text := stripQtermMCPBlocks(string(b))
	return os.WriteFile(path, []byte(text), 0o644)
}

func stripQtermMCPBlocks(text string) string {
	return strings.TrimRight(reQtermMCPBlock.ReplaceAllString(text, ""), "\n") + "\n"
}

func ensureHooksFeature(text string) string {
	if strings.Contains(text, "hooks = true") {
		return text
	}
	if idx := strings.Index(text, "[features]"); idx >= 0 {
		rest := text[idx+len("[features]"):]
		end := strings.Index(rest, "\n[")
		section := rest
		if end >= 0 {
			section = rest[:end]
		}
		if strings.Contains(section, "hooks") {
			updated := regexp.MustCompile(`(?m)^hooks\s*=\s*false\s*$`).ReplaceAllString(section, "hooks = true")
			if updated == section && !strings.Contains(section, "hooks = true") {
				updated = "\nhooks = true" + section
			}
			return text[:idx+len("[features]")] + updated + rest[len(section):]
		}
		insertAt := idx + len("[features]")
		return text[:insertAt] + "\nhooks = true" + text[insertAt:]
	}
	if !strings.HasSuffix(text, "\n") && text != "" {
		text += "\n"
	}
	return text + "\n[features]\nhooks = true\n"
}

// ensureQtermMCPApproval sets plugin MCP tools to approve (no prompt).
// https://developers.openai.com/codex/mcp#plugin-provided-mcp-servers
func ensureQtermMCPApproval(marketName string) error {
	if marketName == "" {
		marketName = personalMarketplaceName
	}
	path := configToml()
	b, err := os.ReadFile(path)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	text := string(b)
	text = stripPluginTables(text, marketName)
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

func stripPluginTables(text, marketName string) string {
	if marketName == "" {
		return text
	}
	re := regexp.MustCompile(`(?s)\n?\[plugins\."qterm@` + regexp.QuoteMeta(marketName) + `"(?:\.[^\]]*)?\][^\[]*`)
	text = re.ReplaceAllString(text, "\n")
	text = regexp.MustCompile(`(?s)\n?\[plugins\."qterm@qterm"(?:\.[^\]]*)?\][^\[]*`).ReplaceAllString(text, "\n")
	return text
}
