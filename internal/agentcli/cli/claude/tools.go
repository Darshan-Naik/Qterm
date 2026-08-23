package claude

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"qterm/internal/agentcli/core"
)

// Official CLI surface:
//
//	claude plugin list [--json] [--available]
//	claude plugin install|uninstall|enable|disable|update
//	claude plugin marketplace list|add|remove|update [--json]
//
// https://code.claude.com/docs/en/plugins-reference

func (adapter) ToolsCaps() core.ToolsCaps {
	return core.ToolsCaps{
		List:               true,
		Install:            true,
		Uninstall:          true,
		Enable:             true,
		Update:             true,
		Browse:             true,
		Kinds:              []core.ToolKind{core.ToolKindPlugin, core.ToolKindMarketplace, core.ToolKindSkill, core.ToolKindMCP},
		InstallPlaceholder: "name@marketplace",
	}
}

func (adapter) ListTools() ([]core.ToolItem, error) {
	var out []core.ToolItem
	out = append(out, listPluginsCLI()...)
	out = append(out, listMarketplacesCLI()...)
	out = append(out, listStandaloneSkills()...)
	out = append(out, listUserMCP()...)
	return out, nil
}

func (adapter) InstallTool(kind core.ToolKind, source string) error {
	bin, err := core.FirstBinary("claude")
	if err != nil {
		return err
	}
	switch kind {
	case core.ToolKindMarketplace:
		_, err = core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "marketplace", "add", source)
		return err
	case core.ToolKindPlugin:
		_, err = core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "install", source, "--scope", "user")
		return err
	case core.ToolKindSkill:
		return installSkillPath(source)
	default:
		return fmt.Errorf("claude: install kind %q not supported", kind)
	}
}

func (adapter) UninstallTool(kind core.ToolKind, id string) error {
	if err := core.GuardQtermSystem(id); err != nil {
		return err
	}
	bin, err := core.FirstBinary("claude")
	if err != nil {
		return err
	}
	switch kind {
	case core.ToolKindMarketplace:
		_, err = core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "marketplace", "remove", id)
		return err
	case core.ToolKindPlugin:
		_, err = core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "uninstall", id)
		return err
	case core.ToolKindSkill:
		return os.RemoveAll(filepath.Join(core.UserHomeDir(), ".claude", "skills", id))
	default:
		return fmt.Errorf("claude: uninstall kind %q not supported", kind)
	}
}

func (adapter) SetToolEnabled(kind core.ToolKind, id string, enabled bool) error {
	if !enabled {
		if err := core.GuardQtermSystem(id); err != nil {
			return err
		}
	}
	if kind != core.ToolKindPlugin {
		return fmt.Errorf("claude: enable/disable only supports plugins")
	}
	bin, err := core.FirstBinary("claude")
	if err != nil {
		return err
	}
	if enabled {
		_, err = core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "enable", id)
		return err
	}
	_, err = core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "disable", id)
	return err
}

func (adapter) UpdateTool(kind core.ToolKind, id string) error {
	if err := core.GuardQtermSystem(id); err != nil {
		return err
	}
	bin, err := core.FirstBinary("claude")
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
		return fmt.Errorf("claude: update kind %q not supported", kind)
	}
}

type claudePluginJSON struct {
	ID          string         `json:"id"`
	Name        string         `json:"name"`
	Version     string         `json:"version"`
	Scope       string         `json:"scope"`
	Enabled     *bool          `json:"enabled"`
	InstallPath string         `json:"installPath"`
	Source      string         `json:"source"`
	Marketplace string         `json:"marketplace"`
	MCPServers  map[string]any `json:"mcpServers"`
}

type claudeAvailableJSON struct {
	PluginID        string `json:"pluginId"`
	Name            string `json:"name"`
	Description     string `json:"description"`
	MarketplaceName string `json:"marketplaceName"`
	InstallCount    int    `json:"installCount"`
}

func listPluginsCLI() []core.ToolItem {
	bin, err := core.FirstBinary("claude")
	if err != nil {
		return nil
	}
	// Prefer --available so we get installed + marketplace catalog in one shot.
	raw, err := core.RunCLI(60*time.Second, bin, "plugin", "list", "--json", "--available")
	if err != nil || raw == "" {
		raw, err = core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "list", "--json")
		if err != nil || raw == "" {
			return nil
		}
	}

	var wrap struct {
		Installed []claudePluginJSON    `json:"installed"`
		Available []claudeAvailableJSON `json:"available"`
		Plugins   []claudePluginJSON    `json:"plugins"`
	}
	var flat []claudePluginJSON
	if json.Unmarshal([]byte(raw), &wrap) == nil && (len(wrap.Installed) > 0 || len(wrap.Available) > 0 || len(wrap.Plugins) > 0) {
		flat = wrap.Installed
		if len(flat) == 0 {
			flat = wrap.Plugins
		}
	} else if json.Unmarshal([]byte(raw), &flat) != nil {
		return nil
	}

	installedIDs := map[string]bool{}
	var out []core.ToolItem
	for _, p := range flat {
		id := strings.TrimSpace(p.ID)
		if id == "" {
			id = strings.TrimSpace(p.Name)
		}
		if id == "" {
			continue
		}
		installedIDs[strings.ToLower(id)] = true
		if before, _, ok := strings.Cut(strings.ToLower(id), "@"); ok {
			installedIDs[before] = true
		}
		name := strings.TrimSpace(p.Name)
		if name == "" {
			name = id
			if before, _, ok := strings.Cut(id, "@"); ok {
				name = before
			}
		}
		en := true
		if p.Enabled != nil {
			en = *p.Enabled
		}
		src := p.InstallPath
		if src == "" {
			src = p.Source
		}
		if src == "" && p.Marketplace != "" {
			src = p.Marketplace
		}
		item := core.ToolItem{
			ID:      id,
			Name:    name,
			Kind:    core.ToolKindPlugin,
			Version: normalizeVersion(p.Version),
			Source:  src,
			Enabled: en,
			Scope:   p.Scope,
			System:  core.IsQtermToolID(id),
		}
		for mcpName := range p.MCPServers {
			item.MCPServers = append(item.MCPServers, core.ToolPart{
				Name:        mcpName,
				Description: "MCP server provided by this plugin",
			})
		}
		enrichPluginFromDisk(&item, p.InstallPath)
		out = append(out, item)
	}

	for _, a := range wrap.Available {
		id := strings.TrimSpace(a.PluginID)
		if id == "" {
			id = strings.TrimSpace(a.Name)
			if a.MarketplaceName != "" && id != "" && !strings.Contains(id, "@") {
				id = id + "@" + a.MarketplaceName
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
		name := strings.TrimSpace(a.Name)
		if name == "" {
			name = id
			if before, _, ok := strings.Cut(id, "@"); ok {
				name = before
			}
		}
		out = append(out, core.ToolItem{
			ID:           id,
			Name:         name,
			Kind:         core.ToolKindPlugin,
			Description:  strings.TrimSpace(a.Description),
			Source:       a.MarketplaceName,
			Enabled:      false,
			Available:    true,
			InstallCount: a.InstallCount,
		})
	}
	return out
}

func enrichPluginFromDisk(item *core.ToolItem, installPath string) {
	if item == nil || installPath == "" {
		return
	}
	root := installPath
	st, err := os.Stat(root)
	if err != nil || !st.IsDir() {
		return
	}
	for _, rel := range []string{
		filepath.Join(".claude-plugin", "plugin.json"),
		"plugin.json",
	} {
		b, err := os.ReadFile(filepath.Join(root, rel))
		if err != nil {
			continue
		}
		var meta map[string]any
		if json.Unmarshal(b, &meta) != nil {
			continue
		}
		if item.Description == "" {
			if s, ok := meta["description"].(string); ok {
				item.Description = strings.TrimSpace(s)
			}
		}
		if item.Version == "" {
			if s, ok := meta["version"].(string); ok {
				item.Version = normalizeVersion(s)
			}
		}
		break
	}
	if entries, err := os.ReadDir(filepath.Join(root, "skills")); err == nil {
		for _, e := range entries {
			if e.IsDir() && !strings.HasPrefix(e.Name(), ".") {
				name := e.Name()
				desc := skillFrontmatter(filepath.Join(root, "skills", name, "SKILL.md"), "description")
				if desc == "" {
					desc = skillFrontmatter(filepath.Join(root, "skills", name, "skill.md"), "description")
				}
				item.Skills = append(item.Skills, core.ToolPart{Name: name, Description: desc})
			}
		}
	}
	if entries, err := os.ReadDir(filepath.Join(root, "agents")); err == nil {
		for _, e := range entries {
			if strings.HasPrefix(e.Name(), ".") {
				continue
			}
			name := e.Name()
			agentPath := filepath.Join(root, "agents", name)
			if !e.IsDir() {
				name = strings.TrimSuffix(name, filepath.Ext(name))
			} else {
				agentPath = filepath.Join(agentPath, "AGENT.md")
				if _, err := os.Stat(agentPath); err != nil {
					agentPath = filepath.Join(root, "agents", e.Name(), "agent.md")
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
	for _, rel := range []string{
		filepath.Join("hooks", "hooks.json"),
		"hooks.json",
	} {
		b, err := os.ReadFile(filepath.Join(root, rel))
		if err != nil {
			continue
		}
		var doc struct {
			Description string         `json:"description"`
			Hooks       map[string]any `json:"hooks"`
		}
		if json.Unmarshal(b, &doc) != nil || len(doc.Hooks) == 0 {
			continue
		}
		for name := range doc.Hooks {
			desc := claudeHookDescription(name)
			if desc == "" && doc.Description != "" {
				desc = doc.Description
			}
			item.Hooks = append(item.Hooks, core.ToolPart{Name: name, Description: desc})
		}
		break
	}
	// Prefer MCP names already collected from CLI JSON; fill gaps from .mcp.json.
	if len(item.MCPServers) == 0 {
		for _, rel := range []string{".mcp.json", "mcp.json"} {
			b, err := os.ReadFile(filepath.Join(root, rel))
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
	} else {
		for i := range item.MCPServers {
			if item.MCPServers[i].Description == "" {
				item.MCPServers[i].Description = "MCP server provided by this plugin"
			}
		}
	}
}

func normalizeVersion(v string) string {
	v = strings.TrimSpace(v)
	if v == "" || strings.EqualFold(v, "unknown") {
		return ""
	}
	return v
}

func claudeHookDescription(name string) string {
	switch name {
	case "PreToolUse":
		return "Runs before a tool call is executed"
	case "PostToolUse":
		return "Runs after a tool call completes"
	case "PermissionRequest":
		return "Runs when Claude requests permission for an action"
	case "Notification":
		return "Runs when Claude emits a notification"
	case "SessionStart":
		return "Runs when a session starts"
	case "SessionEnd":
		return "Runs when a session ends"
	case "Stop":
		return "Runs when Claude finishes responding"
	case "StopFailure":
		return "Runs when a response stops due to failure"
	case "UserPromptSubmit":
		return "Runs when the user submits a prompt"
	case "Elicitation":
		return "Runs when Claude needs additional input from the user"
	default:
		return "Plugin hook"
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

type claudeMarketplaceJSON struct {
	Name            string `json:"name"`
	Source          string `json:"source"`
	Repo            string `json:"repo"`
	Path            string `json:"path"`
	InstallLocation string `json:"installLocation"`
}

func listMarketplacesCLI() []core.ToolItem {
	bin, err := core.FirstBinary("claude")
	if err != nil {
		return nil
	}
	raw, err := core.RunCLI(core.DefaultToolsTimeout, bin, "plugin", "marketplace", "list", "--json")
	if err != nil || raw == "" {
		return nil
	}
	var arr []claudeMarketplaceJSON
	if json.Unmarshal([]byte(raw), &arr) != nil {
		var wrap struct {
			Marketplaces []claudeMarketplaceJSON `json:"marketplaces"`
		}
		if json.Unmarshal([]byte(raw), &wrap) != nil {
			return nil
		}
		arr = wrap.Marketplaces
	}
	var out []core.ToolItem
	for _, m := range arr {
		name := strings.TrimSpace(m.Name)
		if name == "" {
			continue
		}
		src := m.InstallLocation
		if src == "" {
			src = m.Path
		}
		if src == "" && m.Repo != "" {
			src = m.Repo
		}
		if src == "" {
			src = m.Source
		}
		out = append(out, core.ToolItem{
			ID:      name,
			Name:    name,
			Kind:    core.ToolKindMarketplace,
			Source:  src,
			Enabled: true,
		})
	}
	return out
}

// listStandaloneSkills lists ~/.claude/skills/* that are not full plugins
// (plugin list already covers skills-dir plugins).
func listStandaloneSkills() []core.ToolItem {
	var out []core.ToolItem
	root := filepath.Join(core.UserHomeDir(), ".claude", "skills")
	entries, err := os.ReadDir(root)
	if err != nil {
		return nil
	}
	for _, e := range entries {
		if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		dir := filepath.Join(root, e.Name())
		if _, err := os.Stat(filepath.Join(dir, ".claude-plugin", "plugin.json")); err == nil {
			continue
		}
		if _, err := os.Stat(filepath.Join(dir, "plugin.json")); err == nil {
			continue
		}
		ver := ""
		desc := ""
		if b, err := os.ReadFile(filepath.Join(dir, "SKILL.md")); err == nil {
			text := string(b)
			ver = skillFrontmatterFrom(text, "version")
			desc = skillFrontmatterFrom(text, "description")
		}
		out = append(out, core.ToolItem{
			ID:          e.Name(),
			Name:        e.Name(),
			Kind:        core.ToolKindSkill,
			Version:     ver,
			Description: desc,
			Source:      dir,
			Enabled:     true,
			System:      core.IsQtermToolID(e.Name()),
		})
	}
	return out
}

func listUserMCP() []core.ToolItem {
	var out []core.ToolItem
	seen := map[string]bool{}
	for _, path := range []string{userMCPJSON(), filepath.Join(core.UserHomeDir(), ".claude", "mcp.json")} {
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
				ID:      name,
				Name:    name,
				Kind:    core.ToolKindMCP,
				Source:  path,
				Enabled: true,
				System:  name == core.PluginName,
			})
		}
	}
	return out
}

func installSkillPath(source string) error {
	info, err := os.Stat(source)
	if err != nil {
		return fmt.Errorf("claude skill install expects a local path: %w", err)
	}
	name := filepath.Base(source)
	if !info.IsDir() {
		name = strings.TrimSuffix(name, filepath.Ext(name))
	}
	dest := filepath.Join(core.UserHomeDir(), ".claude", "skills", name)
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
