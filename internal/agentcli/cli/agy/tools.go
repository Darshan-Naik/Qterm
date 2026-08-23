package agy

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
		Install:            true,
		Uninstall:          true,
		Enable:             true,
		Update:             false, // agy has no plugin update; `agy update` upgrades the CLI
		Kinds:              []core.ToolKind{core.ToolKindPlugin, core.ToolKindSkill, core.ToolKindMCP},
		InstallPlaceholder: "Git URL or local plugin path",
	}
}

func (adapter) ListTools() ([]core.ToolItem, error) {
	var out []core.ToolItem
	out = append(out, listPlugins()...)
	out = append(out, listStandaloneSkills()...)
	return out, nil
}

func (adapter) InstallTool(kind core.ToolKind, source string) error {
	bin, err := core.FirstBinary("agy", "antigravity")
	if err != nil {
		return err
	}
	if kind != core.ToolKindPlugin {
		return fmt.Errorf("agy: install kind %q not supported (use plugin packages)", kind)
	}
	_, err = core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "install", source)
	return err
}

func (adapter) UninstallTool(kind core.ToolKind, id string) error {
	if err := core.GuardQtermSystem(id); err != nil {
		return err
	}
	bin, err := core.FirstBinary("agy", "antigravity")
	if err != nil {
		return err
	}
	if kind != core.ToolKindPlugin {
		return fmt.Errorf("agy: uninstall kind %q not supported", kind)
	}
	_, err = core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "uninstall", id)
	return err
}

func (adapter) SetToolEnabled(kind core.ToolKind, id string, enabled bool) error {
	if !enabled {
		if err := core.GuardQtermSystem(id); err != nil {
			return err
		}
	}
	if kind != core.ToolKindPlugin {
		return fmt.Errorf("agy: enable/disable only supports plugins")
	}
	bin, err := core.FirstBinary("agy", "antigravity")
	if err != nil {
		return err
	}
	sub := "enable"
	if !enabled {
		sub = "disable"
	}
	_, err = core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", sub, id)
	return err
}

func (adapter) UpdateTool(core.ToolKind, string) error {
	return fmt.Errorf("agy: plugin update not supported — reinstall from source to refresh")
}

func pluginsRoot() string {
	return filepath.Join(core.UserHomeDir(), ".gemini", "antigravity-cli", "plugins")
}

func listPlugins() []core.ToolItem {
	byID := map[string]*core.ToolItem{}

	bin, err := core.FirstBinary("agy", "antigravity")
	if err == nil {
		if text, err := core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "list"); err == nil {
			for _, item := range parsePluginList(text) {
				cp := item
				byID[strings.ToLower(cp.ID)] = &cp
			}
		}
	}

	roots := []string{
		pluginsRoot(),
		filepath.Join(core.UserHomeDir(), ".gemini", "config", "plugins"),
	}
	for _, root := range roots {
		entries, err := os.ReadDir(root)
		if err != nil {
			continue
		}
		for _, e := range entries {
			if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
				continue
			}
			id := e.Name()
			key := strings.ToLower(id)
			item, ok := byID[key]
			if !ok {
				item = &core.ToolItem{
					ID: id, Name: id, Kind: core.ToolKindPlugin,
					Enabled: true, System: core.IsQtermToolID(id),
				}
				byID[key] = item
			}
			if item.Source == "" {
				item.Source = filepath.Join(root, id)
			}
			enrichPluginFromDisk(item, filepath.Join(root, id))
		}
	}

	out := make([]core.ToolItem, 0, len(byID))
	for _, item := range byID {
		if item.Source != "" && !filepath.IsAbs(item.Source) {
			// CLI source may be a label like "antigravity"; prefer install path when known.
			disk := filepath.Join(pluginsRoot(), item.ID)
			if st, err := os.Stat(disk); err == nil && st.IsDir() {
				enrichPluginFromDisk(item, disk)
			}
		}
		out = append(out, *item)
	}
	return out
}

func listStandaloneSkills() []core.ToolItem {
	var out []core.ToolItem
	seen := map[string]bool{}
	root := filepath.Join(core.UserHomeDir(), ".agents", "skills")
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
	return out
}

type agyPluginList struct {
	Imports []agyPluginImport `json:"imports"`
}

type agyPluginImport struct {
	Name       string   `json:"name"`
	Source     string   `json:"source"`
	ImportedAt string   `json:"importedAt"`
	Components []string `json:"components"`
	Enabled    *bool    `json:"enabled"`
	Disabled   *bool    `json:"disabled"`
}

func parsePluginList(text string) []core.ToolItem {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil
	}
	if strings.HasPrefix(text, "{") || strings.HasPrefix(text, "[") {
		return parsePluginJSON(text)
	}
	return parsePluginLines(text)
}

func parsePluginJSON(text string) []core.ToolItem {
	var doc agyPluginList
	if err := json.Unmarshal([]byte(text), &doc); err != nil || len(doc.Imports) == 0 {
		// Older / alternate shapes: bare array of imports.
		var imports []agyPluginImport
		if err := json.Unmarshal([]byte(text), &imports); err != nil {
			return nil
		}
		doc.Imports = imports
	}
	var out []core.ToolItem
	for _, p := range doc.Imports {
		name := strings.TrimSpace(p.Name)
		if name == "" {
			continue
		}
		enabled := true
		if p.Enabled != nil {
			enabled = *p.Enabled
		} else if p.Disabled != nil {
			enabled = !*p.Disabled
		}
		out = append(out, core.ToolItem{
			ID: name, Name: name, Kind: core.ToolKindPlugin,
			Source: strings.TrimSpace(p.Source), Enabled: enabled,
			System: core.IsQtermToolID(name),
		})
	}
	return out
}

func parsePluginLines(text string) []core.ToolItem {
	var out []core.ToolItem
	seen := map[string]bool{}
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		// Skip JSON / structured dumps that aren't table rows.
		if strings.HasPrefix(line, "{") || strings.HasPrefix(line, "}") ||
			strings.HasPrefix(line, "[") || strings.HasPrefix(line, "]") ||
			strings.HasPrefix(line, `"`) {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) == 0 {
			continue
		}
		name := fields[0]
		if strings.EqualFold(name, "name") || strings.EqualFold(name, "plugin") || seen[name] {
			continue
		}
		seen[name] = true
		out = append(out, core.ToolItem{
			ID: name, Name: name, Kind: core.ToolKindPlugin,
			Enabled: !strings.Contains(strings.ToLower(line), "disabled"),
			System:  core.IsQtermToolID(name),
		})
	}
	return out
}

func enrichPluginFromDisk(item *core.ToolItem, installPath string) {
	if item == nil || installPath == "" {
		return
	}
	st, err := os.Stat(installPath)
	if err != nil || !st.IsDir() {
		return
	}
	if b, err := os.ReadFile(filepath.Join(installPath, "plugin.json")); err == nil {
		var meta map[string]any
		if json.Unmarshal(b, &meta) == nil {
			if item.Description == "" {
				if s, ok := meta["description"].(string); ok {
					item.Description = strings.TrimSpace(s)
				}
			}
			if item.Version == "" {
				if s, ok := meta["version"].(string); ok {
					item.Version = strings.TrimSpace(s)
				}
			}
			if item.Name == "" || item.Name == item.ID {
				if s, ok := meta["name"].(string); ok && strings.TrimSpace(s) != "" {
					item.Name = strings.TrimSpace(s)
				}
			}
		}
	}

	if len(item.Skills) == 0 {
		if entries, err := os.ReadDir(filepath.Join(installPath, "skills")); err == nil {
			for _, e := range entries {
				if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
					continue
				}
				name := e.Name()
				desc := skillFrontmatter(filepath.Join(installPath, "skills", name, "SKILL.md"), "description")
				if desc == "" {
					desc = skillFrontmatter(filepath.Join(installPath, "skills", name, "skill.md"), "description")
				}
				item.Skills = append(item.Skills, core.ToolPart{Name: name, Description: desc})
			}
		}
	}

	if len(item.Hooks) == 0 {
		if b, err := os.ReadFile(filepath.Join(installPath, "hooks.json")); err == nil {
			var doc struct {
				Hooks map[string]any `json:"hooks"`
			}
			if json.Unmarshal(b, &doc) == nil {
				for name := range doc.Hooks {
					item.Hooks = append(item.Hooks, core.ToolPart{Name: name})
				}
			}
		}
	}

	if len(item.MCPServers) == 0 {
		for _, rel := range []string{"mcp_config.json", "mcp.json", ".mcp.json"} {
			b, err := os.ReadFile(filepath.Join(installPath, rel))
			if err != nil {
				continue
			}
			var root map[string]any
			if json.Unmarshal(b, &root) != nil {
				continue
			}
			servers, _ := root["mcpServers"].(map[string]any)
			if servers == nil {
				continue
			}
			for name := range servers {
				item.MCPServers = append(item.MCPServers, core.ToolPart{Name: name})
			}
			break
		}
	}
}

func skillFrontmatter(path, key string) string {
	b, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return skillFrontmatterFrom(string(b), key)
}

func skillFrontmatterFrom(md, key string) string {
	if !strings.HasPrefix(md, "---") {
		return ""
	}
	rest := strings.TrimPrefix(md, "---")
	end := strings.Index(rest, "\n---")
	if end < 0 {
		return ""
	}
	for _, line := range strings.Split(rest[:end], "\n") {
		line = strings.TrimSpace(line)
		if before, after, ok := strings.Cut(line, ":"); ok && strings.TrimSpace(before) == key {
			return strings.Trim(strings.TrimSpace(after), `"'`)
		}
	}
	return ""
}
