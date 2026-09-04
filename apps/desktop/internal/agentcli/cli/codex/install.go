package codex

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"qterm/internal/agentcli/core"
)

const (
	// Official personal layout: plugin under ~/.codex/plugins/, catalog at ~/.agents/plugins/marketplace.json
	// (marketplace root = $HOME, source.path = ./.codex/plugins/qterm).
	personalMarketplaceName = "home"
)

type adapter struct{}

// New returns the Codex CLI adapter.
func New() core.Adapter { return adapter{} }

func (adapter) ID() string         { return "codex" }
func (adapter) Name() string       { return "Codex" }
func (adapter) Binaries() []string { return []string{"codex"} }
func (a adapter) Available() (string, bool) {
	return core.LookPath(a.Binaries())
}
func (adapter) Installed() bool { return pluginInstalled() }
func (adapter) RelayPath() string {
	return filepath.Join(pluginRoot(), "hooks", "relay.sh")
}
func (adapter) MapHook(raw map[string]any) []core.Intent {
	return core.MapHookDefault("codex", "Codex", raw)
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

func home() string {
	return filepath.Join(core.UserHomeDir(), ".codex")
}

func pluginRoot() string {
	return filepath.Join(home(), "plugins", core.PluginName)
}

func configToml() string {
	return filepath.Join(home(), "config.toml")
}

func userHooksJSON() string {
	return filepath.Join(home(), "hooks.json")
}

func personalMarketplaceJSON() string {
	return filepath.Join(core.UserHomeDir(), ".agents", "plugins", "marketplace.json")
}

func legacyMarketplaceRoot() string {
	return filepath.Join(home(), "qterm-marketplace")
}

// install writes ~/.codex/plugins/qterm (hooks + MCP + skill),
// upserts the personal marketplace catalog, enables the plugin, and cleans legacy installs.
func install(ctx core.InstallCtx) (core.InstallResult, error) {
	root := pluginRoot()
	if err := os.MkdirAll(filepath.Join(root, ".codex-plugin"), 0o755); err != nil {
		return core.InstallResult{CLI: "codex"}, err
	}
	if err := os.MkdirAll(filepath.Join(root, "hooks"), 0o755); err != nil {
		return core.InstallResult{CLI: "codex"}, err
	}

	if err := core.WritePluginRelay(filepath.Join(root, "hooks", "relay.sh"), ctx.DataDir, ctx.Token, "codex"); err != nil {
		return core.InstallResult{CLI: "codex"}, err
	}
	if err := writePluginManifest(root); err != nil {
		return core.InstallResult{CLI: "codex"}, err
	}
	if err := writePluginHooks(root); err != nil {
		return core.InstallResult{CLI: "codex"}, err
	}
	if err := writePluginMCP(root, ctx.MCPCommand, ctx.DataDir, ctx.Token); err != nil {
		return core.InstallResult{CLI: "codex"}, err
	}
	if err := core.WriteQtermSkill(filepath.Join(root, "skills", "qterm-terminal")); err != nil {
		return core.InstallResult{CLI: "codex"}, err
	}
	marketName, err := upsertPersonalMarketplaceEntry()
	if err != nil {
		return core.InstallResult{CLI: "codex"}, err
	}
	if err := ensurePersonalMarketplaceRegistered(marketName); err != nil {
		return core.InstallResult{CLI: "codex"}, err
	}
	if err := ensureQtermMCPApproval(marketName); err != nil {
		return core.InstallResult{CLI: "codex"}, err
	}

	_ = exec.Command("codex", "plugin", "marketplace", "add", core.UserHomeDir()).Run()
	_ = exec.Command("codex", "plugin", "add", core.PluginName+"@"+marketName).Run()

	// Clean legacy installs (root hooks.json + nested qterm-marketplace + top-level mcp).
	_ = stripQtermFromUserHooksJSON(userHooksJSON())
	_ = removeMCPToml(configToml())
	_ = os.RemoveAll(legacyMarketplaceRoot())

	return core.InstallResult{
		CLI:       "codex",
		Installed: true,
		Message:   "Installed ~/.codex/plugins/qterm (hooks + MCP, auto-approved). Restart Codex.",
	}, nil
}

func uninstall() error {
	marketName := readPersonalMarketplaceName()
	_ = disablePlugin(marketName)
	_ = exec.Command("codex", "plugin", "remove", core.PluginName+"@"+marketName).Run()
	_ = removeQtermFromPersonalMarketplace()
	_ = stripQtermFromUserHooksJSON(userHooksJSON())
	_ = removeMCPToml(configToml())
	_ = os.RemoveAll(pluginRoot())
	_ = os.RemoveAll(legacyMarketplaceRoot())
	return nil
}

func pluginInstalled() bool {
	if _, err := os.Stat(filepath.Join(pluginRoot(), ".codex-plugin", "plugin.json")); err != nil {
		return false
	}
	b, err := os.ReadFile(configToml())
	if err != nil {
		return false
	}
	s := string(b)
	// Accept either home or legacy qterm marketplace key.
	return (strings.Contains(s, `plugins."qterm@home"`) || strings.Contains(s, `plugins."qterm@qterm"`)) &&
		strings.Contains(s, "enabled = true")
}

func writePluginManifest(root string) error {
	manifest := map[string]any{
		"name":        core.PluginName,
		"version":     core.Version,
		"description": "Connect Codex to the Qterm macOS terminal — live status, rename, and app control.",
		"author": map[string]any{
			"name": "Qterm",
			"url":  "https://github.com/Darshan-Naik/Qterm",
		},
		"license":    "MIT",
		"keywords":   []string{"terminal", "hooks", "mcp"},
		"hooks":      "./hooks/hooks.json",
		"mcpServers": "./.mcp.json",
		"skills":     "./skills/",
		"interface": map[string]any{
			"displayName":      "Qterm",
			"shortDescription": "Terminal bridge for status, rename, and app control",
			"longDescription":  "Installs command hooks and an MCP server so Codex can update Qterm terminals, projects, and theme while showing live agent status in the sidebar.",
			"developerName":    "Qterm",
			"category":         "Developer Tools",
			"capabilities":     []string{"Read", "Write"},
			"defaultPrompt": []string{
				"Use the Qterm rename_terminal MCP tool to rename this terminal",
				"List Qterm terminals with list_terminals",
			},
		},
	}
	return core.WriteConfigJSON(filepath.Join(root, ".codex-plugin", "plugin.json"), manifest)
}

func writePluginHooks(root string) error {
	events := []string{
		"SessionStart", "SessionEnd", "UserPromptSubmit", "Stop",
		"Notification", "PermissionRequest", "PreToolUse", "PostToolUse",
		"RequestUserInput",
	}
	hooks := map[string]any{}
	for _, event := range events {
		timeout := 5
		if event == "SessionEnd" {
			timeout = 3
		}
		hooks[event] = []any{
			map[string]any{
				"hooks": []any{
					map[string]any{
						"type":          "command",
						"command":       `bash "${PLUGIN_ROOT}/hooks/relay.sh" codex`,
						"timeout":       timeout,
						"statusMessage": "Qterm",
					},
				},
			},
		}
	}
	return core.WriteConfigJSON(filepath.Join(root, "hooks", "hooks.json"), map[string]any{
		"description": "Qterm agent bridge (" + core.HookMarker + ")",
		"hooks":       hooks,
	})
}

func writePluginMCP(root, mcpCommand, dataDir, token string) error {
	return core.WriteConfigJSON(filepath.Join(root, ".mcp.json"), map[string]any{
		"mcpServers": map[string]any{"qterm": core.QtermMCPServer(mcpCommand, dataDir, token)},
	})
}

func qtermMarketplacePluginEntry() map[string]any {
	return map[string]any{
		"name": core.PluginName,
		"source": map[string]any{
			"source": "local",
			"path":   "./.codex/plugins/qterm",
		},
		"policy": map[string]any{
			"installation":   "AVAILABLE",
			"authentication": "ON_INSTALL",
		},
		"category": "Developer Tools",
	}
}

func upsertPersonalMarketplaceEntry() (marketName string, err error) {
	path := personalMarketplaceJSON()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return "", err
	}
	root := map[string]any{}
	if b, readErr := os.ReadFile(path); readErr == nil && len(b) > 0 {
		_ = json.Unmarshal(b, &root)
	}
	marketName = personalMarketplaceName
	if n, ok := root["name"].(string); ok && n != "" {
		marketName = n
	} else {
		root["name"] = marketName
	}
	if _, ok := root["interface"]; !ok {
		root["interface"] = map[string]any{"displayName": "Home"}
	}

	plugins, _ := root["plugins"].([]any)
	out := make([]any, 0, len(plugins)+1)
	for _, p := range plugins {
		pm, ok := p.(map[string]any)
		if !ok {
			out = append(out, p)
			continue
		}
		if name, _ := pm["name"].(string); name == core.PluginName {
			continue // replace
		}
		out = append(out, p)
	}
	out = append(out, qtermMarketplacePluginEntry())
	root["plugins"] = out
	return marketName, core.WriteConfigJSON(path, root)
}

func readPersonalMarketplaceName() string {
	b, err := os.ReadFile(personalMarketplaceJSON())
	if err != nil {
		return personalMarketplaceName
	}
	var root map[string]any
	if json.Unmarshal(b, &root) != nil {
		return personalMarketplaceName
	}
	if n, ok := root["name"].(string); ok && n != "" {
		return n
	}
	return personalMarketplaceName
}

func removeQtermFromPersonalMarketplace() error {
	path := personalMarketplaceJSON()
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
	return core.WriteConfigJSON(path, root)
}

func ensurePersonalMarketplaceRegistered(marketName string) error {
	path := configToml()
	b, err := os.ReadFile(path)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	text := string(b)
	text = ensureHooksFeature(text)
	// Drop legacy nested marketplace key if present.
	text = regexp.MustCompile(`(?s)\n?\[marketplaces\.qterm\][^\[]*`).ReplaceAllString(text, "\n")

	blockKey := "[marketplaces." + marketName + "]"
	if !strings.Contains(text, blockKey) {
		block := fmt.Sprintf(`
%s
last_updated = %q
source_type = "local"
source = %q
`, blockKey, time.Now().UTC().Format(time.RFC3339), core.UserHomeDir())
		if !strings.HasSuffix(text, "\n") && text != "" {
			text += "\n"
		}
		text += block
	}
	return os.WriteFile(path, []byte(text), 0o644)
}

func disablePlugin(marketName string) error {
	path := configToml()
	b, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	text := stripPluginTables(string(b), marketName)
	text = regexp.MustCompile(`(?s)\n?\[marketplaces\.qterm\][^\[]*`).ReplaceAllString(text, "\n")
	return os.WriteFile(path, []byte(text), 0o644)
}

func stripQtermFromUserHooksJSON(path string) error {
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
		cleaned := core.StripQtermGroups(groups)
		if len(cleaned) == 0 {
			delete(hooks, k)
		} else {
			hooks[k] = cleaned
		}
	}
	root["hooks"] = hooks
	if desc, ok := root["description"].(string); ok && strings.Contains(desc, core.HookMarker) {
		delete(root, "description")
	}
	return core.WriteConfigJSON(path, root)
}
