package cursor

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"qterm/internal/agentcli/core"
)

func (adapter) ToolsCaps() core.ToolsCaps {
	return core.ToolsCaps{
		List:               true,
		Install:            false,
		Uninstall:          false,
		Enable:             false,
		Update:             false,
		Kinds:              []core.ToolKind{core.ToolKindPlugin, core.ToolKindSkill, core.ToolKindMCP},
		InstallPlaceholder: "",
		Hint:               "Install and manage Cursor plugins in Cursor Customize / Marketplace. Qterm lists local inventory only.",
	}
}

func (adapter) ListTools() ([]core.ToolItem, error) {
	var out []core.ToolItem
	out = append(out, listPlugins()...)
	out = append(out, listSkills()...)
	out = append(out, listMCP()...)
	return out, nil
}

func (adapter) InstallTool(core.ToolKind, string) error {
	return fmt.Errorf("cursor: install from Qterm is not supported — use Cursor Customize / Marketplace")
}

func (adapter) UninstallTool(core.ToolKind, string) error {
	return fmt.Errorf("cursor: uninstall from Qterm is not supported — use Cursor Customize / Marketplace")
}

func (adapter) SetToolEnabled(core.ToolKind, string, bool) error {
	return fmt.Errorf("cursor: enable/disable from Qterm is not supported")
}

func (adapter) UpdateTool(core.ToolKind, string) error {
	return fmt.Errorf("cursor: update from Qterm is not supported — use Cursor Customize / Marketplace")
}

func listPlugins() []core.ToolItem {
	var out []core.ToolItem
	roots := []string{
		filepath.Join(core.UserHomeDir(), ".cursor", "plugins", "local"),
		filepath.Join(core.UserHomeDir(), ".cursor", "plugins"),
	}
	seen := map[string]bool{}
	for _, root := range roots {
		entries, _ := os.ReadDir(root)
		for _, e := range entries {
			if !e.IsDir() || e.Name() == "local" || e.Name() == "cache" || strings.HasPrefix(e.Name(), ".") {
				continue
			}
			if seen[e.Name()] {
				continue
			}
			seen[e.Name()] = true
			dir := filepath.Join(root, e.Name())
			ver := readPluginVersion(dir)
			out = append(out, core.ToolItem{
				ID: e.Name(), Name: e.Name(), Kind: core.ToolKindPlugin,
				Version: ver, Source: dir, Enabled: true,
				System: core.IsQtermToolID(e.Name()),
			})
		}
	}
	return out
}

func listSkills() []core.ToolItem {
	var out []core.ToolItem
	seen := map[string]bool{}
	roots := []string{
		filepath.Join(pluginRoot(), "skills"),
		filepath.Join(core.UserHomeDir(), ".cursor", "skills"),
		filepath.Join(core.UserHomeDir(), ".agents", "skills"),
	}
	for _, root := range roots {
		entries, _ := os.ReadDir(root)
		for _, e := range entries {
			if !e.IsDir() || seen[e.Name()] {
				continue
			}
			seen[e.Name()] = true
			out = append(out, core.ToolItem{
				ID: e.Name(), Name: e.Name(), Kind: core.ToolKindSkill,
				Source: filepath.Join(root, e.Name()), Enabled: true,
				System: core.IsQtermToolID(e.Name()),
			})
		}
	}
	return out
}

func listMCP() []core.ToolItem {
	var out []core.ToolItem
	seen := map[string]bool{}
	for _, path := range []string{userMCPJSON(), filepath.Join(pluginRoot(), "mcp.json")} {
		b, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		var root map[string]any
		if json.Unmarshal(b, &root) != nil {
			continue
		}
		servers, _ := root["mcpServers"].(map[string]any)
		for name := range servers {
			if seen[name] {
				continue
			}
			seen[name] = true
			out = append(out, core.ToolItem{
				ID: name, Name: name, Kind: core.ToolKindMCP, Source: path,
				Enabled: true, System: name == core.PluginName,
			})
		}
	}
	return out
}

func readPluginVersion(root string) string {
	for _, p := range []string{
		filepath.Join(root, ".cursor-plugin", "plugin.json"),
		filepath.Join(root, "plugin.json"),
	} {
		b, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		var m map[string]any
		if json.Unmarshal(b, &m) != nil {
			continue
		}
		if s, ok := m["version"].(string); ok {
			return s
		}
	}
	return ""
}
