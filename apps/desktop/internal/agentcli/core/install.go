package core

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
)

// WriteRelayScript writes the shared legacy relay under dataDir/agent/scripts/.
// Source must be passed as the first argv to the script; no CLI-specific default.
func WriteRelayScript(dataDir, token string) (string, error) {
	relay := filepath.Join(ScriptsDir(dataDir), "relay.sh")
	if err := os.WriteFile(relay, []byte(RelayScriptBody(dataDir, token, "")), 0o755); err != nil {
		return "", err
	}
	return relay, nil
}

// WriteMCPConfig upserts the qterm MCP server into a JSON mcpServers file.
func WriteMCPConfig(path, mcpCommand, dataDir, token string) error {
	root := map[string]any{}
	if b, err := os.ReadFile(path); err == nil && len(b) > 0 {
		_ = json.Unmarshal(b, &root)
	}
	servers, _ := root["mcpServers"].(map[string]any)
	if servers == nil {
		servers = map[string]any{}
	}
	servers["qterm"] = QtermMCPServer(mcpCommand, dataDir, token)
	root["mcpServers"] = servers
	return WriteConfigJSON(path, root)
}

// RemoveMCP removes the qterm MCP server entry from a JSON mcpServers file.
func RemoveMCP(path string) error {
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
		return WriteConfigJSON(path, root)
	}
	return nil
}

// RemoveQtermHooks strips qterm handlers from a nested-command hooks.json.
func RemoveQtermHooks(path string) error {
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
		cleaned := StripQtermGroups(groups)
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
	return WriteConfigJSON(path, root)
}

// StripQtermGroups removes qterm handlers from nested hook groups.
func StripQtermGroups(groups []any) []any {
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
			if IsQtermHandler(hm) {
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

// IsQtermHandler reports whether a hook handler belongs to qterm.
func IsQtermHandler(h map[string]any) bool {
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

// WriteConfigJSON marshals v as indented JSON to path, creating parent dirs.
func WriteConfigJSON(path string, v any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o644)
}
