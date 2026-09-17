package grok

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"qterm/internal/agentcli/core"
)

func (adapter) ToolsCaps() core.ToolsCaps {
	return core.ToolsCaps{
		List:               true,
		Install:            true,
		Uninstall:          true,
		Enable:             true,
		Update:             true,
		Browse:             true,
		Kinds:              []core.ToolKind{core.ToolKindPlugin, core.ToolKindMarketplace, core.ToolKindSkill, core.ToolKindMCP},
		InstallPlaceholder: "Git URL, owner/repo, or local path",
	}
}

func (adapter) ListTools() ([]core.ToolItem, error) {
	var out []core.ToolItem
	if items := listPluginsCLI(); len(items) > 0 {
		out = append(out, items...)
	} else {
		out = append(out, listPluginsFS()...)
	}
	out = append(out, listMarketplacesCLI()...)
	out = append(out, listStandaloneSkills()...)
	out = append(out, listUserMCP()...)
	return out, nil
}

func (adapter) InstallTool(kind core.ToolKind, source string) error {
	bin, err := core.FirstBinary("grok")
	if err != nil {
		return err
	}
	switch kind {
	case core.ToolKindMarketplace:
		_, err = core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "marketplace", "add", source)
		return err
	case core.ToolKindPlugin:
		_, err = core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "install", source, "--trust")
		return err
	case core.ToolKindSkill:
		return installSkillPath(source)
	default:
		return fmt.Errorf("grok: install kind %q not supported", kind)
	}
}

func (adapter) UninstallTool(kind core.ToolKind, id string) error {
	if err := core.GuardQtermSystem(id); err != nil {
		return err
	}
	bin, err := core.FirstBinary("grok")
	if err != nil {
		return err
	}
	switch kind {
	case core.ToolKindMarketplace:
		_, err = core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "marketplace", "remove", id)
		return err
	case core.ToolKindPlugin:
		_, err = core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "uninstall", id, "--confirm")
		return err
	case core.ToolKindSkill:
		_ = os.RemoveAll(filepath.Join(grokHome(), "skills", id))
		_ = os.RemoveAll(filepath.Join(core.UserHomeDir(), ".agents", "skills", id))
		return nil
	default:
		return fmt.Errorf("grok: uninstall kind %q not supported", kind)
	}
}

func (adapter) SetToolEnabled(kind core.ToolKind, id string, enabled bool) error {
	if !enabled {
		if err := core.GuardQtermSystem(id); err != nil {
			return err
		}
	}
	if kind != core.ToolKindPlugin {
		return fmt.Errorf("grok: enable/disable only supports plugins")
	}
	bin, err := core.FirstBinary("grok")
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

func (adapter) UpdateTool(kind core.ToolKind, id string) error {
	if err := core.GuardQtermSystem(id); err != nil {
		return err
	}
	bin, err := core.FirstBinary("grok")
	if err != nil {
		return err
	}
	switch kind {
	case core.ToolKindPlugin:
		_, err = core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "update", id)
		return err
	case core.ToolKindMarketplace:
		_, err = core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "marketplace", "update", id)
		return err
	default:
		return fmt.Errorf("grok: update kind %q not supported", kind)
	}
}

func listPluginsCLI() []core.ToolItem {
	bin, err := core.FirstBinary("grok")
	if err != nil {
		return nil
	}
	raw, err := core.RunCLI(60*time.Second, bin, "plugin", "list", "--json", "--available")
	if err != nil || raw == "" {
		raw, err = core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "list", "--json")
		if err != nil || raw == "" {
			return nil
		}
	}
	return parsePluginJSON(raw)
}

func parsePluginJSON(raw string) []core.ToolItem {
	raw = core.ExtractJSON(raw)
	if raw == "" {
		return nil
	}
	var wrap struct {
		Installed []map[string]any `json:"installed"`
		Available []map[string]any `json:"available"`
		Plugins   []map[string]any `json:"plugins"`
	}
	var arr []map[string]any
	if json.Unmarshal([]byte(raw), &wrap) == nil && (len(wrap.Installed) > 0 || len(wrap.Available) > 0 || len(wrap.Plugins) > 0) {
		arr = wrap.Installed
		if len(arr) == 0 {
			arr = wrap.Plugins
		}
	} else if json.Unmarshal([]byte(raw), &arr) != nil {
		return nil
	}

	installedIDs := map[string]bool{}
	var out []core.ToolItem
	for _, p := range arr {
		item := pluginItemFromMap(p, false)
		if item.ID == "" {
			continue
		}
		installedIDs[strings.ToLower(item.ID)] = true
		installedIDs[strings.ToLower(item.Name)] = true
		out = append(out, item)
	}
	for _, p := range wrap.Available {
		item := pluginItemFromMap(p, true)
		if item.ID == "" {
			continue
		}
		if installedIDs[strings.ToLower(item.ID)] || installedIDs[strings.ToLower(item.Name)] {
			continue
		}
		out = append(out, item)
	}
	return out
}

func pluginItemFromMap(p map[string]any, availableOnly bool) core.ToolItem {
	id := pickString(p, "id", "pluginId", "name")
	name := pickString(p, "name", "plugin", "id")
	if id == "" {
		id = name
	}
	en := !availableOnly
	if v, ok := p["enabled"].(bool); ok {
		en = v
	}
	path := pickString(p, "path", "installPath", "source")
	item := core.ToolItem{
		ID:          id,
		Name:        name,
		Kind:        core.ToolKindPlugin,
		Version:     pickString(p, "version"),
		Description: pickString(p, "description"),
		Source:      path,
		Enabled:     en,
		Scope:       pickString(p, "scope"),
		Available:   availableOnly,
		System:      core.IsQtermToolID(id) || core.IsQtermToolID(name),
	}
	if path == "" {
		path = filepath.Join(pluginRootDir(), item.Name)
		if item.Name == "" {
			path = filepath.Join(pluginRootDir(), item.ID)
		}
	}
	enrichPluginFromDisk(&item, path)
	return item
}

func listPluginsFS() []core.ToolItem {
	var out []core.ToolItem
	seen := map[string]bool{}
	roots := []string{
		pluginRootDir(),
		filepath.Join(grokHome(), "installed-plugins"),
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
			if seen[e.Name()] {
				continue
			}
			seen[e.Name()] = true
			dir := filepath.Join(root, e.Name())
			item := core.ToolItem{
				ID: e.Name(), Name: e.Name(), Kind: core.ToolKindPlugin,
				Source: dir, Enabled: true, System: core.IsQtermToolID(e.Name()),
			}
			enrichPluginFromDisk(&item, dir)
			out = append(out, item)
		}
	}
	return out
}

func listMarketplacesCLI() []core.ToolItem {
	bin, err := core.FirstBinary("grok")
	if err != nil {
		return nil
	}
	raw, err := core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "marketplace", "list", "--json")
	if err != nil || raw == "" {
		return listMarketplacesTOML()
	}
	raw = core.ExtractJSON(raw)
	var arr []map[string]any
	var wrap struct {
		Sources      []map[string]any `json:"sources"`
		Marketplaces []map[string]any `json:"marketplaces"`
	}
	if json.Unmarshal([]byte(raw), &wrap) == nil && (len(wrap.Sources) > 0 || len(wrap.Marketplaces) > 0) {
		arr = wrap.Sources
		if len(arr) == 0 {
			arr = wrap.Marketplaces
		}
	} else if json.Unmarshal([]byte(raw), &arr) != nil {
		return listMarketplacesTOML()
	}
	var out []core.ToolItem
	for _, m := range arr {
		name := pickString(m, "name", "id")
		if name == "" {
			continue
		}
		out = append(out, core.ToolItem{
			ID: name, Name: name, Kind: core.ToolKindMarketplace,
			Source:  pickString(m, "git", "url", "path", "source"),
			Enabled: true,
		})
	}
	if len(out) == 0 {
		return listMarketplacesTOML()
	}
	return out
}

var reMarketplaceName = regexp.MustCompile(`(?m)^name\s*=\s*"([^"]+)"`)

func listMarketplacesTOML() []core.ToolItem {
	b, err := os.ReadFile(configToml())
	if err != nil {
		return nil
	}
	var out []core.ToolItem
	seen := map[string]bool{}
	for _, block := range strings.Split(string(b), "[[marketplace.sources]]") {
		m := reMarketplaceName.FindStringSubmatch(block)
		if len(m) < 2 {
			continue
		}
		name := m[1]
		if seen[name] {
			continue
		}
		seen[name] = true
		out = append(out, core.ToolItem{
			ID: name, Name: name, Kind: core.ToolKindMarketplace, Enabled: true,
		})
	}
	return out
}

func listStandaloneSkills() []core.ToolItem {
	var out []core.ToolItem
	seen := map[string]bool{}
	for _, root := range []string{
		filepath.Join(grokHome(), "skills"),
		filepath.Join(core.UserHomeDir(), ".agents", "skills"),
	} {
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

var reMCPServer = regexp.MustCompile(`(?m)^\[mcp_servers\.([^\]]+)\]`)

func listUserMCP() []core.ToolItem {
	var out []core.ToolItem
	seen := map[string]bool{}
	b, err := os.ReadFile(configToml())
	if err == nil {
		for _, m := range reMCPServer.FindAllStringSubmatch(string(b), -1) {
			name := strings.TrimSpace(m[1])
			if name == "" || seen[name] {
				continue
			}
			seen[name] = true
			out = append(out, core.ToolItem{
				ID: name, Name: name, Kind: core.ToolKindMCP, Source: configToml(),
				Enabled: true, System: name == core.PluginName,
			})
		}
	}
	for _, rel := range []string{filepath.Join(pluginRoot(), ".mcp.json")} {
		b, err := os.ReadFile(rel)
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
				ID: name, Name: name, Kind: core.ToolKindMCP, Source: rel,
				Enabled: true, System: name == core.PluginName,
			})
		}
	}
	return out
}

func pluginRootDir() string {
	return filepath.Join(grokHome(), "plugins")
}

func enrichPluginFromDisk(item *core.ToolItem, installPath string) {
	if item == nil || installPath == "" {
		return
	}
	st, err := os.Stat(installPath)
	if err != nil || !st.IsDir() {
		return
	}
	for _, rel := range []string{
		filepath.Join(".grok-plugin", "plugin.json"),
		"plugin.json",
		filepath.Join(".claude-plugin", "plugin.json"),
	} {
		b, err := os.ReadFile(filepath.Join(installPath, rel))
		if err != nil {
			continue
		}
		var meta map[string]any
		if json.Unmarshal(b, &meta) != nil {
			continue
		}
		if item.Description == "" {
			item.Description = strings.TrimSpace(pickString(meta, "description"))
		}
		if item.Version == "" {
			item.Version = strings.TrimSpace(pickString(meta, "version"))
		}
		if item.Name == "" || item.Name == item.ID {
			if s := strings.TrimSpace(pickString(meta, "name")); s != "" {
				item.Name = s
			}
		}
		break
	}
	if len(item.Skills) == 0 {
		if entries, err := os.ReadDir(filepath.Join(installPath, "skills")); err == nil {
			for _, e := range entries {
				if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
					continue
				}
				name := e.Name()
				desc := skillFrontmatter(filepath.Join(installPath, "skills", name, "SKILL.md"), "description")
				item.Skills = append(item.Skills, core.ToolPart{Name: name, Description: desc})
			}
		}
	}
	if len(item.Hooks) == 0 {
		b, err := os.ReadFile(filepath.Join(installPath, "hooks", "hooks.json"))
		if err == nil {
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
		b, err := os.ReadFile(filepath.Join(installPath, ".mcp.json"))
		if err == nil {
			var root map[string]any
			if json.Unmarshal(b, &root) == nil {
				if servers, ok := root["mcpServers"].(map[string]any); ok {
					for n := range servers {
						item.MCPServers = append(item.MCPServers, core.ToolPart{Name: n})
					}
				}
			}
		}
	}
}

func installSkillPath(source string) error {
	st, err := os.Stat(source)
	if err != nil || !st.IsDir() {
		return fmt.Errorf("grok skill install expects a local path: %w", err)
	}
	name := filepath.Base(source)
	dest := filepath.Join(grokHome(), "skills", name)
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return err
	}
	return copyTree(source, dest)
}

func copyTree(src, dst string) error {
	if err := os.MkdirAll(dst, 0o755); err != nil {
		return err
	}
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		target := filepath.Join(dst, rel)
		if info.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		b, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		return os.WriteFile(target, b, info.Mode().Perm())
	})
}

func skillFrontmatter(path, key string) string {
	b, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	md := string(b)
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

func pickString(m map[string]any, keys ...string) string {
	for _, k := range keys {
		if s, ok := m[k].(string); ok && s != "" {
			return s
		}
	}
	return ""
}
