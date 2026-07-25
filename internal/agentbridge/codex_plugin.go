package agentbridge

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

const (
	// Official personal layout: plugin under ~/.codex/plugins/, catalog at ~/.agents/plugins/marketplace.json
	// (marketplace root = $HOME, source.path = ./.codex/plugins/qterm).
	codexPersonalMarketplaceName = "home"
)

func codexHome() string {
	return filepath.Join(userHomeDir(), ".codex")
}

func codexPluginRoot() string {
	return filepath.Join(codexHome(), "plugins", qtermPluginName)
}

func codexConfigToml() string {
	return filepath.Join(codexHome(), "config.toml")
}

func codexUserHooksJSON() string {
	return filepath.Join(codexHome(), "hooks.json")
}

func personalMarketplaceJSON() string {
	return filepath.Join(userHomeDir(), ".agents", "plugins", "marketplace.json")
}

func legacyCodexMarketplaceRoot() string {
	return filepath.Join(codexHome(), "qterm-marketplace")
}

// installCodexPlugin writes ~/.codex/plugins/qterm (hooks + MCP + skill),
// upserts the personal marketplace catalog, enables the plugin, and cleans legacy installs.
func installCodexPlugin(ctx InstallCtx) (InstallResult, error) {
	root := codexPluginRoot()
	if err := os.MkdirAll(filepath.Join(root, ".codex-plugin"), 0o755); err != nil {
		return InstallResult{CLI: "codex"}, err
	}
	if err := os.MkdirAll(filepath.Join(root, "hooks"), 0o755); err != nil {
		return InstallResult{CLI: "codex"}, err
	}

	if err := writePluginRelay(filepath.Join(root, "hooks", "relay.sh"), ctx.DataDir, ctx.Token, "codex"); err != nil {
		return InstallResult{CLI: "codex"}, err
	}
	if err := writeCodexPluginManifest(root); err != nil {
		return InstallResult{CLI: "codex"}, err
	}
	if err := writeCodexPluginHooks(root); err != nil {
		return InstallResult{CLI: "codex"}, err
	}
	if err := writeCodexPluginMCP(root, ctx.MCPCommand, ctx.DataDir, ctx.Token); err != nil {
		return InstallResult{CLI: "codex"}, err
	}
	if err := writeQtermSkill(filepath.Join(root, "skills", "qterm-terminal")); err != nil {
		return InstallResult{CLI: "codex"}, err
	}
	marketName, err := upsertPersonalMarketplaceEntry()
	if err != nil {
		return InstallResult{CLI: "codex"}, err
	}
	if err := ensurePersonalMarketplaceRegistered(marketName); err != nil {
		return InstallResult{CLI: "codex"}, err
	}
	if err := ensureCodexQtermMCPApproval(marketName); err != nil {
		return InstallResult{CLI: "codex"}, err
	}

	_ = exec.Command("codex", "plugin", "marketplace", "add", userHomeDir()).Run()
	_ = exec.Command("codex", "plugin", "add", qtermPluginName+"@"+marketName).Run()

	// Clean legacy installs (root hooks.json + nested qterm-marketplace + top-level mcp).
	_ = stripQtermFromUserHooksJSON(codexUserHooksJSON())
	_ = removeCodexMCPToml(codexConfigToml())
	_ = os.RemoveAll(legacyCodexMarketplaceRoot())

	return InstallResult{
		CLI:       "codex",
		Installed: true,
		Message:   "Installed ~/.codex/plugins/qterm (hooks + MCP, auto-approved). Restart Codex.",
	}, nil
}

func uninstallCodexPlugin() error {
	marketName := readPersonalMarketplaceName()
	_ = disableCodexPlugin(marketName)
	_ = exec.Command("codex", "plugin", "remove", qtermPluginName+"@"+marketName).Run()
	_ = removeQtermFromPersonalMarketplace()
	_ = stripQtermFromUserHooksJSON(codexUserHooksJSON())
	_ = removeCodexMCPToml(codexConfigToml())
	_ = os.RemoveAll(codexPluginRoot())
	_ = os.RemoveAll(legacyCodexMarketplaceRoot())
	return nil
}

func codexPluginInstalled() bool {
	if _, err := os.Stat(filepath.Join(codexPluginRoot(), ".codex-plugin", "plugin.json")); err != nil {
		return false
	}
	b, err := os.ReadFile(codexConfigToml())
	if err != nil {
		return false
	}
	s := string(b)
	// Accept either home or legacy qterm marketplace key.
	return (strings.Contains(s, `plugins."qterm@home"`) || strings.Contains(s, `plugins."qterm@qterm"`)) &&
		strings.Contains(s, "enabled = true")
}

func writeCodexPluginManifest(root string) error {
	manifest := map[string]any{
		"name":        qtermPluginName,
		"version":     qtermPluginVersion,
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
	return writeConfigJSON(filepath.Join(root, ".codex-plugin", "plugin.json"), manifest)
}

func writeCodexPluginHooks(root string) error {
	events := []string{
		"SessionStart", "SessionEnd", "UserPromptSubmit", "Stop",
		"Notification", "PermissionRequest", "PreToolUse", "PostToolUse",
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
	return writeConfigJSON(filepath.Join(root, "hooks", "hooks.json"), map[string]any{
		"description": "Qterm agent bridge (" + HookMarker + ")",
		"hooks":       hooks,
	})
}

func writeCodexPluginMCP(root, mcpCommand, dataDir, token string) error {
	return writeConfigJSON(filepath.Join(root, ".mcp.json"), map[string]any{
		"mcpServers": map[string]any{"qterm": qtermMCPServer(mcpCommand, dataDir, token)},
	})
}

func qtermMarketplacePluginEntry() map[string]any {
	return map[string]any{
		"name": qtermPluginName,
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
	marketName = codexPersonalMarketplaceName
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
		if name, _ := pm["name"].(string); name == qtermPluginName {
			continue // replace
		}
		out = append(out, p)
	}
	out = append(out, qtermMarketplacePluginEntry())
	root["plugins"] = out
	return marketName, writeConfigJSON(path, root)
}

func readPersonalMarketplaceName() string {
	b, err := os.ReadFile(personalMarketplaceJSON())
	if err != nil {
		return codexPersonalMarketplaceName
	}
	var root map[string]any
	if json.Unmarshal(b, &root) != nil {
		return codexPersonalMarketplaceName
	}
	if n, ok := root["name"].(string); ok && n != "" {
		return n
	}
	return codexPersonalMarketplaceName
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
			if name, _ := pm["name"].(string); name == qtermPluginName {
				continue
			}
		}
		out = append(out, p)
	}
	root["plugins"] = out
	return writeConfigJSON(path, root)
}

func ensurePersonalMarketplaceRegistered(marketName string) error {
	path := codexConfigToml()
	b, err := os.ReadFile(path)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	text := string(b)
	text = ensureCodexHooksFeature(text)
	// Drop legacy nested marketplace key if present.
	text = regexp.MustCompile(`(?s)\n?\[marketplaces\.qterm\][^\[]*`).ReplaceAllString(text, "\n")

	blockKey := "[marketplaces." + marketName + "]"
	if !strings.Contains(text, blockKey) {
		block := fmt.Sprintf(`
%s
last_updated = %q
source_type = "local"
source = %q
`, blockKey, time.Now().UTC().Format(time.RFC3339), userHomeDir())
		if !strings.HasSuffix(text, "\n") && text != "" {
			text += "\n"
		}
		text += block
	}
	return os.WriteFile(path, []byte(text), 0o644)
}

func enableCodexPlugin(marketName string) error {
	return ensureCodexQtermMCPApproval(marketName)
}

func disableCodexPlugin(marketName string) error {
	path := codexConfigToml()
	b, err := os.ReadFile(path)
	if err != nil {
		return nil
	}
	text := stripCodexPluginTables(string(b), marketName)
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
