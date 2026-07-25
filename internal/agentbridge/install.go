package agentbridge

import (
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

type InstallResult struct {
	CLI       string `json:"cli"`
	Installed bool   `json:"installed"`
	Message   string `json:"message"`
}

type CLIInfo struct {
	ID               string `json:"id"`
	Name             string `json:"name"`
	Available        bool   `json:"available"`
	Path             string `json:"path"`
	Installed        bool   `json:"installed"`
	Version          string `json:"version,omitempty"`          // version recorded when last connected/updated
	ExpectedVersion  string `json:"expectedVersion,omitempty"`  // app's current qterm plugin version
	Outdated         bool   `json:"outdated,omitempty"`         // installed but version != expected
}

func writeRelayScript(dataDir, token string) (string, error) {
	relay := filepath.Join(ScriptsDir(dataDir), "relay.sh")
	if err := os.WriteFile(relay, []byte(relayScriptBody(dataDir, token, "claude")), 0o755); err != nil {
		return "", err
	}
	return relay, nil
}

func writeMCPConfig(path, mcpCommand, dataDir, token string) error {
	root := map[string]any{}
	if b, err := os.ReadFile(path); err == nil && len(b) > 0 {
		_ = json.Unmarshal(b, &root)
	}
	servers, _ := root["mcpServers"].(map[string]any)
	if servers == nil {
		servers = map[string]any{}
	}
	servers["qterm"] = qtermMCPServer(mcpCommand, dataDir, token)
	root["mcpServers"] = servers
	return writeConfigJSON(path, root)
}

func removeCodexMCPToml(path string) error {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	text := stripCodexQtermBlocks(string(b))
	return os.WriteFile(path, []byte(text), 0o644)
}

var reCodexQtermBlock = regexp.MustCompile(`(?m)^\[mcp_servers\.qterm(?:\.[^\]]+)?\][^\n]*\n(?:[^\[\n][^\n]*\n)*`)

func stripCodexQtermBlocks(text string) string {
	return strings.TrimRight(reCodexQtermBlock.ReplaceAllString(text, ""), "\n") + "\n"
}

func ensureCodexHooksFeature(text string) string {
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

func removeMCP(path string) error {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var root map[string]any
	if json.Unmarshal(b, &root) != nil {
		return nil
	}
	if servers, ok := root["mcpServers"].(map[string]any); ok {
		delete(servers, "qterm")
		root["mcpServers"] = servers
		return writeConfigJSON(path, root)
	}
	return nil
}

func removeQtermHooks(path string) error {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var root map[string]any
	if json.Unmarshal(b, &root) != nil {
		return nil
	}
	hooks, ok := root["hooks"].(map[string]any)
	if !ok {
		return nil
	}
	for k, v := range hooks {
		groups, _ := v.([]any)
		cleaned := stripQtermGroups(groups)
		if len(cleaned) == 0 {
			delete(hooks, k)
		} else {
			hooks[k] = cleaned
		}
	}
	root["hooks"] = hooks
	if desc, ok := root["description"].(string); ok && strings.Contains(desc, HookMarker) {
		delete(root, "description")
	}
	return writeConfigJSON(path, root)
}

func stripQtermGroups(groups []any) []any {
	out := make([]any, 0, len(groups))
	for _, g := range groups {
		gm, ok := g.(map[string]any)
		if !ok {
			out = append(out, g)
			continue
		}
		handlers, _ := gm["hooks"].([]any)
		clean := make([]any, 0, len(handlers))
		for _, h := range handlers {
			hm, ok := h.(map[string]any)
			if !ok {
				clean = append(clean, h)
				continue
			}
			if isQtermHandler(hm) {
				continue
			}
			clean = append(clean, h)
		}
		if len(clean) == 0 {
			continue
		}
		gm["hooks"] = clean
		out = append(out, gm)
	}
	return out
}

func isQtermHandler(h map[string]any) bool {
	if name, ok := h["name"].(string); ok && name == "qterm-bridge" {
		return true
	}
	if u, ok := h["url"].(string); ok && strings.Contains(u, "/v1/hooks/") {
		return true
	}
	if hdr, ok := h["headers"].(map[string]any); ok {
		if v, ok := hdr["X-Qterm-Hook"].(string); ok && v == HookMarker {
			return true
		}
	}
	if cmd, ok := h["command"].(string); ok {
		if strings.Contains(cmd, HookMarker) ||
			strings.Contains(cmd, "relay.sh") ||
			strings.Contains(cmd, "/agent/scripts/") {
			return true
		}
	}
	return false
}

func writeConfigJSON(path string, v any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}
