package claude

import (
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"

	"qterm/internal/agentcli/core"
)

// Claude Code plugin at ~/.claude/plugins/qterm/
// Thin local marketplace catalog: ~/.claude/plugins/.claude-plugin/marketplace.json
// Installs as qterm@local → copied into ~/.claude/plugins/cache/
// https://code.claude.com/docs/en/plugins-reference
// https://code.claude.com/docs/en/plugin-marketplaces

const localMarketplaceName = "local"

type adapter struct{}

// New returns the Claude Code CLI adapter.
func New() core.Adapter { return adapter{} }

func (adapter) ID() string          { return "claude" }
func (adapter) Name() string        { return "Claude Code" }
func (adapter) Binaries() []string  { return []string{"claude"} }
func (a adapter) Available() (string, bool) {
	return core.LookPath(a.Binaries())
}
func (adapter) Installed() bool { return pluginInstalled() }
func (adapter) RelayPath() string {
	return filepath.Join(pluginRoot(), "hooks", "relay.sh")
}
func (adapter) MapHook(raw map[string]any) []core.Intent {
	return core.MapHookDefault("claude", "Claude Code", raw)
}

func (a adapter) Install(ctx core.InstallCtx) (core.InstallResult, error) {
	if err := core.RequireCLI(a); err != nil {
		return core.InstallResult{CLI: a.ID()}, err
	}
	return install(ctx)
}

func (adapter) Uninstall(core.InstallCtx) error {
	return uninstall()
}

func pluginsDir() string {
	return filepath.Join(core.UserHomeDir(), ".claude", "plugins")
}

func pluginRoot() string {
	return filepath.Join(pluginsDir(), core.PluginName)
}

func legacySkillsPluginRoot() string {
	return filepath.Join(core.UserHomeDir(), ".claude", "skills", core.PluginName)
}

func settingsJSON() string {
	return filepath.Join(core.UserHomeDir(), ".claude", "settings.json")
}

func userMCPJSON() string {
	return filepath.Join(core.UserHomeDir(), ".claude.json")
}

func marketplaceJSON() string {
	return filepath.Join(pluginsDir(), ".claude-plugin", "marketplace.json")
}

func install(ctx core.InstallCtx) (core.InstallResult, error) {
	root := pluginRoot()
	if err := os.MkdirAll(filepath.Join(root, ".claude-plugin"), 0o755); err != nil {
		return core.InstallResult{CLI: "claude"}, err
	}
	if err := core.WritePluginRelay(filepath.Join(root, "hooks", "relay.sh"), ctx.DataDir, ctx.Token, "claude"); err != nil {
		return core.InstallResult{CLI: "claude"}, err
	}
	if err := core.WriteConfigJSON(filepath.Join(root, ".claude-plugin", "plugin.json"), map[string]any{
		"name":        core.PluginName,
		"version":     core.Version,
		"description": "Connect Claude Code to the Qterm macOS terminal — live status, rename, and app control.",
		"author":      map[string]any{"name": "Qterm", "url": "https://github.com/Darshan-Naik/Qterm"},
		"keywords":    []string{"terminal", "hooks", "mcp"},
		"hooks":       "./hooks/hooks.json",
		"mcpServers":  "./.mcp.json",
	}); err != nil {
		return core.InstallResult{CLI: "claude"}, err
	}

	events := []string{
		"SessionStart", "SessionEnd", "UserPromptSubmit", "Stop", "StopFailure",
		"Notification", "PermissionRequest", "PreToolUse", "PostToolUse", "Elicitation",
	}
	hooks := core.NestedCommandHooks(events, "bash", []any{
		"${CLAUDE_PLUGIN_ROOT}/hooks/relay.sh", "claude",
	}, map[string]any{
		"timeout":       5,
		"statusMessage": "Qterm",
	})
	if err := core.WriteConfigJSON(filepath.Join(root, "hooks", "hooks.json"), map[string]any{
		"description": "Qterm agent bridge (" + core.HookMarker + ")",
		"hooks":       hooks,
	}); err != nil {
		return core.InstallResult{CLI: "claude"}, err
	}
	if err := core.WriteConfigJSON(filepath.Join(root, ".mcp.json"), map[string]any{
		"mcpServers": map[string]any{"qterm": core.QtermMCPServer(ctx.MCPCommand, ctx.DataDir, ctx.Token)},
	}); err != nil {
		return core.InstallResult{CLI: "claude"}, err
	}
	if err := core.WriteQtermSkill(filepath.Join(root, "skills", "qterm-terminal")); err != nil {
		return core.InstallResult{CLI: "claude"}, err
	}
	if err := upsertLocalMarketplace(); err != nil {
		return core.InstallResult{CLI: "claude"}, err
	}

	_ = exec.Command("claude", "plugin", "marketplace", "add", pluginsDir()).Run()
	_ = exec.Command("claude", "plugin", "install", "qterm@"+localMarketplaceName, "--scope", "user").Run()
	_ = exec.Command("claude", "plugin", "enable", "qterm@"+localMarketplaceName).Run()
	if err := enablePluginKey("qterm@" + localMarketplaceName); err != nil {
		return core.InstallResult{CLI: "claude"}, err
	}
	if err := ensureQtermPermissions(); err != nil {
		return core.InstallResult{CLI: "claude"}, err
	}

	// Clean legacy installs (root hooks, user MCP, skills-dir shortcut).
	_ = core.RemoveQtermHooks(settingsJSON())
	_ = core.RemoveMCP(userMCPJSON())
	_ = disablePluginKey("qterm@skills-dir")
	_ = os.RemoveAll(legacySkillsPluginRoot())

	return core.InstallResult{
		CLI:       "claude",
		Installed: true,
		Message:   "Installed ~/.claude/plugins/qterm (hooks + MCP, auto-allowed). Restart Claude Code, then /reload-plugins if needed.",
	}, nil
}

func uninstall() error {
	_ = exec.Command("claude", "plugin", "uninstall", "qterm@"+localMarketplaceName).Run()
	_ = exec.Command("claude", "plugin", "disable", "qterm@"+localMarketplaceName).Run()
	_ = disablePluginKey("qterm@" + localMarketplaceName)
	_ = disablePluginKey("qterm@skills-dir")
	_ = core.RemoveQtermHooks(settingsJSON())
	_ = core.RemoveMCP(userMCPJSON())
	_ = os.RemoveAll(pluginRoot())
	_ = os.RemoveAll(legacySkillsPluginRoot())
	_ = removeQtermFromMarketplace()
	return nil
}

func pluginInstalled() bool {
	if _, err := os.Stat(filepath.Join(pluginRoot(), ".claude-plugin", "plugin.json")); err != nil {
		return false
	}
	b, err := os.ReadFile(settingsJSON())
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
	if v, ok := ep["qterm@"+localMarketplaceName].(bool); ok {
		return v
	}
	if v, ok := ep["qterm@skills-dir"].(bool); ok {
		return v
	}
	return true
}

func upsertLocalMarketplace() error {
	path := marketplaceJSON()
	root := map[string]any{}
	if b, err := os.ReadFile(path); err == nil && len(b) > 0 {
		_ = json.Unmarshal(b, &root)
	}
	root["name"] = localMarketplaceName
	if _, ok := root["owner"]; !ok {
		root["owner"] = map[string]any{"name": "Qterm"}
	}
	plugins, _ := root["plugins"].([]any)
	out := make([]any, 0, len(plugins)+1)
	for _, p := range plugins {
		pm, ok := p.(map[string]any)
		if ok {
			if name, _ := pm["name"].(string); name == core.PluginName {
				continue
			}
		}
		out = append(out, p)
	}
	out = append(out, map[string]any{
		"name":        core.PluginName,
		"source":      "./" + core.PluginName,
		"description": "Connect Claude Code to the Qterm macOS terminal",
		"version":     core.Version,
	})
	root["plugins"] = out
	return core.WriteConfigJSON(path, root)
}

func removeQtermFromMarketplace() error {
	path := marketplaceJSON()
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
			if name, _ := pm["name"].(string); name == core.PluginName {
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
	return core.WriteConfigJSON(path, root)
}

func enablePluginKey(key string) error {
	path := settingsJSON()
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
	return core.WriteConfigJSON(path, root)
}

func disablePluginKey(key string) error {
	path := settingsJSON()
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
		return core.WriteConfigJSON(path, root)
	}
	return nil
}

// Claude plugin MCP tools are named mcp__plugin_<plugin>_<server>__<tool>.
// https://code.claude.com/docs/en/mcp#plugin-provided-mcp-servers
func qtermAllowRules() []string {
	return []string{
		"mcp__plugin_qterm_qterm",
		"mcp__plugin_qterm_qterm__*",
		"mcp__qterm",
		"mcp__qterm__*",
		"Skill(qterm-terminal)",
	}
}

// ensureQtermPermissions pre-allows Qterm MCP + skill so Connect doesn't
// spam per-tool trust prompts for app-bridge internals.
func ensureQtermPermissions() error {
	path := settingsJSON()
	root := map[string]any{}
	if b, err := os.ReadFile(path); err == nil && len(b) > 0 {
		_ = json.Unmarshal(b, &root)
	}
	perms, _ := root["permissions"].(map[string]any)
	if perms == nil {
		perms = map[string]any{}
	}
	allow := core.AsStringSlice(perms["allow"])
	ask := core.AsStringSlice(perms["ask"])
	deny := core.AsStringSlice(perms["deny"])
	for _, rule := range qtermAllowRules() {
		allow = core.AddUniqueString(allow, rule)
		ask = core.RemoveStringExact(ask, rule)
		deny = core.RemoveStringExact(deny, rule)
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
	return core.WriteConfigJSON(path, root)
}
