package agentbridge

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
)

// Claude Code plugin at ~/.claude/plugins/qterm/
// Thin local marketplace catalog: ~/.claude/plugins/.claude-plugin/marketplace.json
// Installs as qterm@local → copied into ~/.claude/plugins/cache/
// https://code.claude.com/docs/en/plugins-reference
// https://code.claude.com/docs/en/plugin-marketplaces

const claudeLocalMarketplaceName = "local"

func claudePluginsDir() string {
	return filepath.Join(userHomeDir(), ".claude", "plugins")
}

func claudePluginRoot() string {
	return filepath.Join(claudePluginsDir(), qtermPluginName)
}

func claudeLegacySkillsPluginRoot() string {
	return filepath.Join(userHomeDir(), ".claude", "skills", qtermPluginName)
}

func claudeSettingsJSON() string {
	return filepath.Join(userHomeDir(), ".claude", "settings.json")
}

func claudeUserMCPJSON() string {
	return filepath.Join(userHomeDir(), ".claude.json")
}

func claudeMarketplaceJSON() string {
	return filepath.Join(claudePluginsDir(), ".claude-plugin", "marketplace.json")
}

func installClaudePlugin(ctx InstallCtx) (InstallResult, error) {
	root := claudePluginRoot()
	if err := os.MkdirAll(filepath.Join(root, ".claude-plugin"), 0o755); err != nil {
		return InstallResult{CLI: "claude"}, err
	}
	if err := writePluginRelay(filepath.Join(root, "hooks", "relay.sh"), ctx.DataDir, ctx.Token, "claude"); err != nil {
		return InstallResult{CLI: "claude"}, err
	}
	if err := writeConfigJSON(filepath.Join(root, ".claude-plugin", "plugin.json"), map[string]any{
		"name":        qtermPluginName,
		"version":     qtermPluginVersion,
		"description": "Connect Claude Code to the Qterm macOS terminal — live status, rename, and app control.",
		"author":      map[string]any{"name": "Qterm", "url": "https://github.com/Darshan-Naik/Qterm"},
		"keywords":    []string{"terminal", "hooks", "mcp"},
		"hooks":       "./hooks/hooks.json",
		"mcpServers":  "./.mcp.json",
	}); err != nil {
		return InstallResult{CLI: "claude"}, err
	}

	events := []string{
		"SessionStart", "SessionEnd", "UserPromptSubmit", "Stop", "StopFailure",
		"Notification", "PermissionRequest", "PreToolUse", "PostToolUse", "Elicitation",
	}
	hooks := nestedCommandHooks(events, "bash", []any{
		"${CLAUDE_PLUGIN_ROOT}/hooks/relay.sh", "claude",
	}, map[string]any{
		"timeout":       5,
		"statusMessage": "Qterm",
	})
	if err := writeConfigJSON(filepath.Join(root, "hooks", "hooks.json"), map[string]any{
		"description": "Qterm agent bridge (" + HookMarker + ")",
		"hooks":       hooks,
	}); err != nil {
		return InstallResult{CLI: "claude"}, err
	}
	if err := writeConfigJSON(filepath.Join(root, ".mcp.json"), map[string]any{
		"mcpServers": map[string]any{"qterm": qtermMCPServer(ctx.MCPCommand, ctx.DataDir, ctx.Token)},
	}); err != nil {
		return InstallResult{CLI: "claude"}, err
	}
	if err := writeQtermSkill(filepath.Join(root, "skills", "qterm-terminal")); err != nil {
		return InstallResult{CLI: "claude"}, err
	}
	if err := upsertClaudeLocalMarketplace(); err != nil {
		return InstallResult{CLI: "claude"}, err
	}

	_ = exec.Command("claude", "plugin", "marketplace", "add", claudePluginsDir()).Run()
	_ = exec.Command("claude", "plugin", "install", "qterm@"+claudeLocalMarketplaceName, "--scope", "user").Run()
	_ = exec.Command("claude", "plugin", "enable", "qterm@"+claudeLocalMarketplaceName).Run()
	if err := enableClaudePluginKey("qterm@" + claudeLocalMarketplaceName); err != nil {
		return InstallResult{CLI: "claude"}, err
	}
	if err := ensureClaudeQtermPermissions(); err != nil {
		return InstallResult{CLI: "claude"}, err
	}

	// Clean legacy installs (root hooks, user MCP, skills-dir shortcut).
	_ = removeQtermHooks(claudeSettingsJSON())
	_ = removeMCP(claudeUserMCPJSON())
	_ = disableClaudePluginKey("qterm@skills-dir")
	_ = os.RemoveAll(claudeLegacySkillsPluginRoot())

	return InstallResult{
		CLI:       "claude",
		Installed: true,
		Message:   "Installed ~/.claude/plugins/qterm (hooks + MCP, auto-allowed). Restart Claude Code, then /reload-plugins if needed.",
	}, nil
}

func uninstallClaudePlugin() error {
	_ = exec.Command("claude", "plugin", "uninstall", "qterm@"+claudeLocalMarketplaceName).Run()
	_ = exec.Command("claude", "plugin", "disable", "qterm@"+claudeLocalMarketplaceName).Run()
	_ = disableClaudePluginKey("qterm@" + claudeLocalMarketplaceName)
	_ = disableClaudePluginKey("qterm@skills-dir")
	_ = removeQtermHooks(claudeSettingsJSON())
	_ = removeMCP(claudeUserMCPJSON())
	_ = os.RemoveAll(claudePluginRoot())
	_ = os.RemoveAll(claudeLegacySkillsPluginRoot())
	_ = removeQtermFromClaudeMarketplace()
	return nil
}

func claudePluginInstalled() bool {
	if _, err := os.Stat(filepath.Join(claudePluginRoot(), ".claude-plugin", "plugin.json")); err != nil {
		return false
	}
	b, err := os.ReadFile(claudeSettingsJSON())
	if err != nil {
		return true
	}
	var root map[string]any
	if json.Unmarshal(b, &root) != nil {
		return true
	}
	ep, _ := root["enabledPlugins"].(map[string]any)
	if ep == nil {
		return true
	}
	if v, ok := ep["qterm@"+claudeLocalMarketplaceName].(bool); ok {
		return v
	}
	if v, ok := ep["qterm@skills-dir"].(bool); ok {
		return v
	}
	return true
}

func upsertClaudeLocalMarketplace() error {
	path := claudeMarketplaceJSON()
	root := map[string]any{}
	if b, err := os.ReadFile(path); err == nil && len(b) > 0 {
		_ = json.Unmarshal(b, &root)
	}
	root["name"] = claudeLocalMarketplaceName
	if _, ok := root["owner"]; !ok {
		root["owner"] = map[string]any{"name": "Qterm"}
	}
	plugins, _ := root["plugins"].([]any)
	out := make([]any, 0, len(plugins)+1)
	for _, p := range plugins {
		pm, ok := p.(map[string]any)
		if ok {
			if name, _ := pm["name"].(string); name == qtermPluginName {
				continue
			}
		}
		out = append(out, p)
	}
	out = append(out, map[string]any{
		"name":        qtermPluginName,
		"source":      "./" + qtermPluginName,
		"description": "Connect Claude Code to the Qterm macOS terminal",
		"version":     qtermPluginVersion,
	})
	root["plugins"] = out
	return writeConfigJSON(path, root)
}

func removeQtermFromClaudeMarketplace() error {
	path := claudeMarketplaceJSON()
	b, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var root map[string]any
	if json.Unmarshal(b, &root) != nil {
		return nil
	}
	plugins, _ := root["plugins"].([]any)
	out := make([]any, 0, len(plugins))
	for _, p := range plugins {
		pm, ok := p.(map[string]any)
		if ok {
			if name, _ := pm["name"].(string); name == qtermPluginName {
				continue
			}
		}
		out = append(out, p)
	}
	root["plugins"] = out
	if len(out) == 0 {
		_ = os.Remove(path)
		return nil
	}
	return writeConfigJSON(path, root)
}

func enableClaudePluginKey(key string) error {
	path := claudeSettingsJSON()
	root := map[string]any{}
	if b, err := os.ReadFile(path); err == nil && len(b) > 0 {
		_ = json.Unmarshal(b, &root)
	}
	ep, _ := root["enabledPlugins"].(map[string]any)
	if ep == nil {
		ep = map[string]any{}
	}
	ep[key] = true
	if key != "qterm@skills-dir" {
		delete(ep, "qterm@skills-dir")
	}
	root["enabledPlugins"] = ep
	return writeConfigJSON(path, root)
}

func disableClaudePluginKey(key string) error {
	path := claudeSettingsJSON()
	b, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	var root map[string]any
	if json.Unmarshal(b, &root) != nil {
		return nil
	}
	if ep, ok := root["enabledPlugins"].(map[string]any); ok {
		delete(ep, key)
		root["enabledPlugins"] = ep
		return writeConfigJSON(path, root)
	}
	return nil
}
