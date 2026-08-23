package codex

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
		Enable:             false,
		Update:             true, // marketplace upgrade refreshes catalogs; plugins re-add
		Browse:             true,
		Kinds:              []core.ToolKind{core.ToolKindPlugin, core.ToolKindMarketplace, core.ToolKindSkill, core.ToolKindMCP},
		InstallPlaceholder: "name@marketplace",
	}
}

func (adapter) ListTools() ([]core.ToolItem, error) {
	var out []core.ToolItem
	if items, err := listPluginsCLI(); err == nil && len(items) > 0 {
		out = append(out, items...)
	} else {
		out = append(out, listPluginsFS()...)
	}
	out = append(out, listMarketplaces()...)
	out = append(out, listSkills()...)
	out = append(out, listMCP()...)
	return out, nil
}

func (adapter) InstallTool(kind core.ToolKind, source string) error {
	bin, err := core.FirstBinary("codex")
	if err != nil {
		return err
	}
	switch kind {
	case core.ToolKindMarketplace:
		_, err = core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "marketplace", "add", source)
		return err
	case core.ToolKindPlugin:
		_, err = core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "add", source)
		return err
	case core.ToolKindSkill:
		return installSkillPath(source)
	default:
		return fmt.Errorf("codex: install kind %q not supported", kind)
	}
}

func (adapter) UninstallTool(kind core.ToolKind, id string) error {
	if err := core.GuardQtermSystem(id); err != nil {
		return err
	}
	bin, err := core.FirstBinary("codex")
	if err != nil {
		return err
	}
	switch kind {
	case core.ToolKindMarketplace:
		_, err = core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "marketplace", "remove", id)
		return err
	case core.ToolKindPlugin:
		_, err = core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "remove", id)
		return err
	case core.ToolKindSkill:
		_ = os.RemoveAll(filepath.Join(core.UserHomeDir(), ".agents", "skills", id))
		_ = os.RemoveAll(filepath.Join(home(), "skills", id))
		return nil
	default:
		return fmt.Errorf("codex: uninstall kind %q not supported", kind)
	}
}

func (adapter) SetToolEnabled(core.ToolKind, string, bool) error {
	return fmt.Errorf("codex: enable/disable not supported via CLI")
}

func (adapter) UpdateTool(kind core.ToolKind, id string) error {
	if err := core.GuardQtermSystem(id); err != nil {
		return err
	}
	bin, err := core.FirstBinary("codex")
	if err != nil {
		return err
	}
	switch kind {
	case core.ToolKindMarketplace:
		_, err = core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "marketplace", "upgrade", id)
		return err
	case core.ToolKindPlugin:
		// Official surface has no plugin-update; re-add from marketplace id.
		_, err = core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "add", id)
		return err
	default:
		return fmt.Errorf("codex: update kind %q not supported", kind)
	}
}

func listPluginsCLI() ([]core.ToolItem, error) {
	bin, err := core.FirstBinary("codex")
	if err != nil {
		return nil, err
	}
	out, err := core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "list", "--json")
	if err != nil {
		text, err2 := core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "list")
		if err2 != nil {
			return nil, err
		}
		return parsePluginLines(text), nil
	}
	return parsePluginJSON(out)
}

func parsePluginJSON(raw string) ([]core.ToolItem, error) {
	raw = core.ExtractJSON(raw)
	if raw == "" {
		return nil, nil
	}
	// Official: { "installed": [...], "available": [...] }
	// https://developers.openai.com/codex/cli/reference
	var wrap struct {
		Installed []map[string]any `json:"installed"`
		Available []map[string]any `json:"available"`
		Plugins   []map[string]any `json:"plugins"`
	}
	var arr []map[string]any
	avail := []map[string]any{}
	if err := json.Unmarshal([]byte(raw), &wrap); err == nil && (len(wrap.Installed) > 0 || len(wrap.Plugins) > 0 || len(wrap.Available) > 0) {
		arr = wrap.Installed
		if len(arr) == 0 {
			arr = wrap.Plugins
		}
		avail = wrap.Available
	} else if err := json.Unmarshal([]byte(raw), &arr); err != nil {
		return parsePluginLines(raw), nil
	}
	installedIDs := map[string]bool{}
	var out []core.ToolItem
	for _, p := range arr {
		id := pickString(p, "pluginId", "id")
		name := pickString(p, "name", "plugin")
		mp := pickString(p, "marketplaceName", "marketplace")
		if id == "" {
			id = name
			if mp != "" && name != "" && !strings.Contains(name, "@") {
				id = name + "@" + mp
			}
		}
		if name == "" {
			name = id
			if before, _, ok := strings.Cut(id, "@"); ok {
				name = before
			}
		}
		if id == "" {
			continue
		}
		installedIDs[strings.ToLower(id)] = true
		if before, _, ok := strings.Cut(strings.ToLower(id), "@"); ok {
			installedIDs[before] = true
		}
		en := true
		if v, ok := p["enabled"].(bool); ok {
			en = v
		}
		installPath := ""
		if srcMap, ok := p["source"].(map[string]any); ok {
			installPath = pickString(srcMap, "path")
		}
		item := core.ToolItem{
			ID:          id,
			Name:        name,
			Kind:        core.ToolKindPlugin,
			Version:     pickString(p, "version"),
			Description: pickString(p, "description"),
			Source:      mp,
			Enabled:     en,
			System:      core.IsQtermToolID(id),
		}
		if installPath != "" {
			enrichPluginFromDisk(&item, installPath)
		} else {
			enrichPluginFromDisk(&item, filepath.Join(home(), "plugins", name))
		}
		out = append(out, item)
	}
	for _, p := range avail {
		id := pickString(p, "pluginId", "id")
		name := pickString(p, "name", "plugin")
		mp := pickString(p, "marketplaceName", "marketplace")
		if id == "" {
			id = name
			if mp != "" && name != "" && !strings.Contains(name, "@") {
				id = name + "@" + mp
			}
		}
		if id == "" {
			continue
		}
		low := strings.ToLower(id)
		if installedIDs[low] {
			continue
		}
		if before, _, ok := strings.Cut(low, "@"); ok && installedIDs[before] {
			continue
		}
		if name == "" {
			name = id
			if before, _, ok := strings.Cut(id, "@"); ok {
				name = before
			}
		}
		count := 0
		if v, ok := p["installCount"].(float64); ok {
			count = int(v)
		}
		out = append(out, core.ToolItem{
			ID:           id,
			Name:         name,
			Kind:         core.ToolKindPlugin,
			Description:  pickString(p, "description"),
			Source:       mp,
			Enabled:      false,
			Available:    true,
			InstallCount: count,
		})
	}
	return out, nil
}
func parsePluginLines(raw string) []core.ToolItem {
	var out []core.ToolItem
	seen := map[string]bool{}
	for _, line := range strings.Split(raw, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		// Skip JSON / warning dumps that aren't table rows.
		if strings.HasPrefix(line, "{") || strings.HasPrefix(line, "}") ||
			strings.HasPrefix(line, "[") || strings.HasPrefix(line, "]") ||
			strings.HasPrefix(line, `"`) || strings.HasPrefix(strings.ToUpper(line), "WARNING") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) == 0 {
			continue
		}
		id := fields[0]
		if strings.EqualFold(id, "name") || strings.EqualFold(id, "plugin") ||
			strings.EqualFold(id, "pluginid") || seen[id] {
			continue
		}
		seen[id] = true
		name := id
		if before, _, ok := strings.Cut(id, "@"); ok {
			name = before
		}
		item := core.ToolItem{
			ID: id, Name: name, Kind: core.ToolKindPlugin,
			Enabled: true, System: core.IsQtermToolID(id),
		}
		enrichPluginFromDisk(&item, filepath.Join(home(), "plugins", name))
		out = append(out, item)
	}
	return out
}

func listPluginsFS() []core.ToolItem {
	var out []core.ToolItem
	root := filepath.Join(home(), "plugins")
	entries, _ := os.ReadDir(root)
	for _, e := range entries {
		if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		name := e.Name()
		path := filepath.Join(root, name)
		item := core.ToolItem{
			ID: name, Name: name, Kind: core.ToolKindPlugin,
			Version: readPluginVersion(path),
			Source:  path,
			Enabled: true, System: core.IsQtermToolID(name),
		}
		enrichPluginFromDisk(&item, path)
		out = append(out, item)
	}
	return out
}

func listMarketplaces() []core.ToolItem {
	var out []core.ToolItem
	if bin, err := core.FirstBinary("codex"); err == nil {
		if text, err := core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "marketplace", "list"); err == nil {
			for _, line := range strings.Split(text, "\n") {
				line = strings.TrimSpace(line)
				if line == "" {
					continue
				}
				fields := strings.Fields(line)
				if len(fields) == 0 {
					continue
				}
				out = append(out, core.ToolItem{
					ID: fields[0], Name: fields[0], Kind: core.ToolKindMarketplace, Enabled: true,
				})
			}
		}
	}
	if len(out) > 0 {
		return out
	}
	if b, err := os.ReadFile(personalMarketplaceJSON()); err == nil {
		var root map[string]any
		if json.Unmarshal(b, &root) == nil {
			name, _ := root["name"].(string)
			if name == "" {
				name = personalMarketplaceName
			}
			out = append(out, core.ToolItem{
				ID: name, Name: name, Kind: core.ToolKindMarketplace,
				Source: personalMarketplaceJSON(), Enabled: true,
			})
		}
	}
	return out
}

func listSkills() []core.ToolItem {
	var out []core.ToolItem
	seen := map[string]bool{}
	for _, root := range []string{
		filepath.Join(core.UserHomeDir(), ".agents", "skills"),
		filepath.Join(home(), "skills"),
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

func listMCP() []core.ToolItem {
	// Plugin MCP servers are nested under plugins via enrichPluginFromDisk.
	// Only surface top-level user MCP entries from config.toml.
	var out []core.ToolItem
	b, err := os.ReadFile(filepath.Join(home(), "config.toml"))
	if err != nil {
		return out
	}
	seen := map[string]bool{}
	for _, line := range strings.Split(string(b), "\n") {
		line = strings.TrimSpace(line)
		const prefix = "[mcp_servers."
		if !strings.HasPrefix(line, prefix) || !strings.HasSuffix(line, "]") {
			continue
		}
		name := strings.TrimSuffix(strings.TrimPrefix(line, prefix), "]")
		if name == "" || strings.Contains(name, ".") || seen[name] {
			continue
		}
		seen[name] = true
		out = append(out, core.ToolItem{
			ID: name, Name: name, Kind: core.ToolKindMCP,
			Source: filepath.Join(home(), "config.toml"), Enabled: true,
			System: name == core.PluginName,
		})
	}
	return out
}

func installSkillPath(source string) error {
	info, err := os.Stat(source)
	if err != nil {
		return fmt.Errorf("codex skill install expects a local path: %w", err)
	}
	name := filepath.Base(source)
	if !info.IsDir() {
		name = strings.TrimSuffix(name, filepath.Ext(name))
	}
	dest := filepath.Join(core.UserHomeDir(), ".agents", "skills", name)
	if info.IsDir() {
		return copyTree(source, dest)
	}
	if err := os.MkdirAll(dest, 0o755); err != nil {
		return err
	}
	b, err := os.ReadFile(source)
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(dest, "SKILL.md"), b, 0o644)
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
		filepath.Join(".codex-plugin", "plugin.json"),
		"plugin.json",
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
			if iface, ok := meta["interface"].(map[string]any); ok {
				if s, ok := iface["shortDescription"].(string); ok {
					item.Description = strings.TrimSpace(s)
				}
				if item.Description == "" {
					if s, ok := iface["longDescription"].(string); ok {
						item.Description = strings.TrimSpace(s)
					}
				}
			}
			if item.Description == "" {
				if s, ok := meta["description"].(string); ok {
					item.Description = strings.TrimSpace(s)
				}
			}
		}
		if item.Version == "" {
			if s, ok := meta["version"].(string); ok {
				item.Version = strings.TrimSpace(s)
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
				if desc == "" {
					desc = skillFrontmatter(filepath.Join(installPath, "skills", name, "skill.md"), "description")
				}
				item.Skills = append(item.Skills, core.ToolPart{Name: name, Description: desc})
			}
		}
	}

	if len(item.Agents) == 0 {
		if entries, err := os.ReadDir(filepath.Join(installPath, "agents")); err == nil {
			for _, e := range entries {
				if strings.HasPrefix(e.Name(), ".") {
					continue
				}
				name := e.Name()
				agentPath := filepath.Join(installPath, "agents", name)
				if !e.IsDir() {
					name = strings.TrimSuffix(name, filepath.Ext(name))
				} else {
					agentPath = filepath.Join(agentPath, "AGENT.md")
					if _, err := os.Stat(agentPath); err != nil {
						agentPath = filepath.Join(installPath, "agents", e.Name(), "agent.md")
					}
				}
				desc := ""
				if b, err := os.ReadFile(agentPath); err == nil {
					desc = skillFrontmatterFrom(string(b), "description")
				}
				if name != "" {
					item.Agents = append(item.Agents, core.ToolPart{Name: name, Description: desc})
				}
			}
		}
	}

	if len(item.Hooks) == 0 {
		for _, rel := range []string{
			filepath.Join("hooks", "hooks.json"),
			"hooks.json",
		} {
			b, err := os.ReadFile(filepath.Join(installPath, rel))
			if err != nil {
				continue
			}
			var doc struct {
				Hooks map[string]any `json:"hooks"`
			}
			if json.Unmarshal(b, &doc) != nil || len(doc.Hooks) == 0 {
				continue
			}
			for name := range doc.Hooks {
				item.Hooks = append(item.Hooks, core.ToolPart{
					Name:        name,
					Description: codexHookDescription(name),
				})
			}
			break
		}
	}

	if len(item.MCPServers) == 0 {
		for _, rel := range []string{".mcp.json", "mcp.json"} {
			b, err := os.ReadFile(filepath.Join(installPath, rel))
			if err != nil {
				continue
			}
			var doc struct {
				MCPServers map[string]any `json:"mcpServers"`
			}
			if json.Unmarshal(b, &doc) != nil {
				continue
			}
			for name := range doc.MCPServers {
				item.MCPServers = append(item.MCPServers, core.ToolPart{
					Name:        name,
					Description: "MCP server provided by this plugin",
				})
			}
			break
		}
	}
}

func readPluginVersion(root string) string {
	for _, p := range []string{
		filepath.Join(root, ".codex-plugin", "plugin.json"),
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

func codexHookDescription(name string) string {
	switch name {
	case "PreToolUse":
		return "Runs before a tool call is executed"
	case "PostToolUse":
		return "Runs after a tool call completes"
	case "PermissionRequest":
		return "Runs when Codex requests permission for an action"
	case "Notification":
		return "Runs when Codex emits a notification"
	case "SessionStart":
		return "Runs when a session starts"
	case "SessionEnd":
		return "Runs when a session ends"
	case "Stop":
		return "Runs when Codex finishes responding"
	case "UserPromptSubmit":
		return "Runs when the user submits a prompt"
	default:
		return "Plugin hook"
	}
}

func pickString(m map[string]any, keys ...string) string {
	for _, k := range keys {
		if s, ok := m[k].(string); ok && s != "" {
			return s
		}
	}
	return ""
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
		return os.WriteFile(target, b, info.Mode())
	})
}
