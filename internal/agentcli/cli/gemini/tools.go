package gemini

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
		Update:             true, // gemini extensions update
		Kinds:              []core.ToolKind{core.ToolKindExtension, core.ToolKindSkill, core.ToolKindMCP},
		InstallPlaceholder: "Git URL, local path, or extension name",
	}
}

func (adapter) ListTools() ([]core.ToolItem, error) {
	var out []core.ToolItem
	exts := listExtensions()
	out = append(out, exts...)
	ownedSkills := map[string]bool{}
	ownedMCP := map[string]bool{}
	for _, e := range exts {
		for _, s := range e.Skills {
			ownedSkills[strings.ToLower(s.Name)] = true
		}
		for _, m := range e.MCPServers {
			ownedMCP[strings.ToLower(m.Name)] = true
		}
	}
	for _, s := range listStandaloneSkills() {
		if ownedSkills[strings.ToLower(s.ID)] || ownedSkills[strings.ToLower(s.Name)] {
			continue
		}
		out = append(out, s)
	}
	for _, m := range listStandaloneMCP() {
		if ownedMCP[strings.ToLower(m.ID)] || ownedMCP[strings.ToLower(m.Name)] {
			continue
		}
		out = append(out, m)
	}
	return out, nil
}

func (adapter) InstallTool(kind core.ToolKind, source string) error {
	bin, err := core.FirstBinary("gemini")
	if err != nil {
		return err
	}
	switch kind {
	case core.ToolKindExtension, core.ToolKindPlugin:
		_, err = core.RunCLI(core.DefaultToolsTimeout, bin, "extensions", "install", source, "--consent")
		return err
	case core.ToolKindSkill:
		_, err = core.RunCLI(core.DefaultToolsTimeout, bin, "skills", "install", source, "--consent")
		return err
	default:
		return fmt.Errorf("gemini: install kind %q not supported", kind)
	}
}

func (adapter) UninstallTool(kind core.ToolKind, id string) error {
	if err := core.GuardQtermSystem(id); err != nil {
		return err
	}
	bin, err := core.FirstBinary("gemini")
	if err != nil {
		return err
	}
	switch kind {
	case core.ToolKindExtension, core.ToolKindPlugin:
		_, err = core.RunCLI(core.DefaultToolsTimeout, bin, "extensions", "uninstall", id)
		return err
	case core.ToolKindSkill:
		_, err = core.RunCLI(core.DefaultToolsTimeout, bin, "skills", "uninstall", id)
		return err
	default:
		return fmt.Errorf("gemini: uninstall kind %q not supported", kind)
	}
}

func (adapter) SetToolEnabled(kind core.ToolKind, id string, enabled bool) error {
	if !enabled {
		if err := core.GuardQtermSystem(id); err != nil {
			return err
		}
	}
	if kind != core.ToolKindExtension && kind != core.ToolKindPlugin {
		return fmt.Errorf("gemini: enable/disable only supports extensions")
	}
	bin, err := core.FirstBinary("gemini")
	if err != nil {
		return err
	}
	sub := "enable"
	if !enabled {
		sub = "disable"
	}
	_, err = core.RunCLI(core.DefaultToolsTimeout, bin, "extensions", sub, id)
	return err
}

func (adapter) UpdateTool(kind core.ToolKind, id string) error {
	if err := core.GuardQtermSystem(id); err != nil {
		return err
	}
	if kind != core.ToolKindExtension && kind != core.ToolKindPlugin {
		return fmt.Errorf("gemini: update only supports extensions")
	}
	bin, err := core.FirstBinary("gemini")
	if err != nil {
		return err
	}
	_, err = core.RunCLI(core.DefaultToolsTimeout, bin, "extensions", "update", id)
	return err
}

func listExtensions() []core.ToolItem {
	if bin, err := core.FirstBinary("gemini"); err == nil {
		for _, args := range [][]string{
			{"extensions", "list", "-o", "json"},
			{"extensions", "list", "--output-format", "json"},
		} {
			if text, err := core.RunCLI(core.DefaultToolsTimeout, bin, args...); err == nil {
				if parsed := parseGeminiExtensionsJSON(text); len(parsed) > 0 {
					return parsed
				}
			}
		}
		if text, err := core.RunCLI(core.DefaultToolsTimeout, bin, "extensions", "list"); err == nil {
			if parsed := parseNameLines(text, core.ToolKindExtension); len(parsed) > 0 {
				for i := range parsed {
					enrichExtensionFromDisk(&parsed[i], filepath.Join(extensionsRoot(), parsed[i].Name))
				}
				return parsed
			}
		}
	}
	var out []core.ToolItem
	entries, _ := os.ReadDir(extensionsRoot())
	for _, e := range entries {
		if !e.IsDir() || strings.HasPrefix(e.Name(), ".") {
			continue
		}
		name := e.Name()
		path := filepath.Join(extensionsRoot(), name)
		item := core.ToolItem{
			ID: name, Name: name, Kind: core.ToolKindExtension,
			Version: readExtVersion(path),
			Source:  path,
			Enabled: true, System: core.IsQtermToolID(name),
		}
		enrichExtensionFromDisk(&item, path)
		out = append(out, item)
	}
	return out
}

func listStandaloneSkills() []core.ToolItem {
	if bin, err := core.FirstBinary("gemini"); err == nil {
		if text, err := core.RunCLI(core.DefaultToolsTimeout, bin, "skills", "list"); err == nil {
			if parsed := parseNameLines(text, core.ToolKindSkill); len(parsed) > 0 {
				return parsed
			}
		}
	}
	var out []core.ToolItem
	seen := map[string]bool{}
	for _, root := range []string{
		filepath.Join(core.UserHomeDir(), ".gemini", "skills"),
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

func listStandaloneMCP() []core.ToolItem {
	var out []core.ToolItem
	seen := map[string]bool{}
	b, err := os.ReadFile(settingsJSON())
	if err != nil {
		return out
	}
	var root map[string]any
	if json.Unmarshal(b, &root) != nil {
		return out
	}
	servers, _ := root["mcpServers"].(map[string]any)
	for name := range servers {
		if seen[name] {
			continue
		}
		seen[name] = true
		out = append(out, core.ToolItem{
			ID: name, Name: name, Kind: core.ToolKindMCP, Source: settingsJSON(),
			Enabled: true, System: name == core.PluginName,
		})
	}
	return out
}

func parseNameLines(text string, kind core.ToolKind) []core.ToolItem {
	var out []core.ToolItem
	seen := map[string]bool{}
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasPrefix(line, "─") || strings.HasPrefix(line, "┌") || strings.HasPrefix(line, "│") ||
			strings.HasPrefix(line, "✓") || strings.HasPrefix(line, "ID:") || strings.HasPrefix(line, "Path:") ||
			strings.HasPrefix(line, "Enabled") || strings.HasPrefix(line, "Context") ||
			strings.HasPrefix(line, "MCP") || strings.HasPrefix(line, "Agent") {
			continue
		}
		// "✓ qterm (1.2.5)" style
		line = strings.TrimPrefix(line, "✓")
		line = strings.TrimSpace(line)
		fields := strings.Fields(line)
		if len(fields) == 0 {
			continue
		}
		name := strings.Trim(fields[0], "│|()")
		if name == "" || seen[name] {
			continue
		}
		if strings.EqualFold(name, "extension") || strings.EqualFold(name, "skill") || strings.EqualFold(name, "name") {
			continue
		}
		seen[name] = true
		ver := ""
		if len(fields) > 1 {
			ver = strings.Trim(fields[1], "()")
		}
		out = append(out, core.ToolItem{
			ID: name, Name: name, Kind: kind, Version: ver,
			Enabled: !strings.Contains(strings.ToLower(line), "disabled"),
			System:  core.IsQtermToolID(name),
		})
	}
	return out
}

func parseGeminiExtensionsJSON(raw string) []core.ToolItem {
	raw = core.ExtractJSON(raw)
	if raw == "" {
		return nil
	}
	var arr []map[string]any
	if err := json.Unmarshal([]byte(raw), &arr); err != nil {
		var wrap struct {
			Extensions []map[string]any `json:"extensions"`
		}
		if err2 := json.Unmarshal([]byte(raw), &wrap); err2 != nil || len(wrap.Extensions) == 0 {
			return nil
		}
		arr = wrap.Extensions
	}
	var out []core.ToolItem
	for _, p := range arr {
		name := pickGeminiString(p, "name", "id", "extension")
		if name == "" {
			continue
		}
		en := true
		if v, ok := p["enabled"].(bool); ok {
			en = v
		} else if v, ok := p["isActive"].(bool); ok {
			en = v
		}
		path := pickGeminiString(p, "path", "installPath", "source")
		item := core.ToolItem{
			ID: name, Name: name, Kind: core.ToolKindExtension,
			Version:     pickGeminiString(p, "version"),
			Description: pickGeminiString(p, "description"),
			Source:      path,
			Enabled:     en,
			System:      core.IsQtermToolID(name),
		}
		// Nested parts from CLI JSON when present.
		if skills, ok := p["skills"].([]any); ok {
			for _, s := range skills {
				m, _ := s.(map[string]any)
				if m == nil {
					continue
				}
				n := pickGeminiString(m, "name")
				if n == "" {
					continue
				}
				item.Skills = append(item.Skills, core.ToolPart{
					Name:        n,
					Description: pickGeminiString(m, "description"),
				})
			}
		}
		if hooks, ok := p["hooks"].(map[string]any); ok {
			for n := range hooks {
				item.Hooks = append(item.Hooks, core.ToolPart{
					Name:        n,
					Description: geminiHookDescription(n),
				})
			}
		}
		if servers, ok := p["mcpServers"].(map[string]any); ok {
			for n := range servers {
				item.MCPServers = append(item.MCPServers, core.ToolPart{
					Name:        n,
					Description: "MCP server provided by this extension",
				})
			}
		}
		if agents, ok := p["agents"].([]any); ok {
			for _, a := range agents {
				m, _ := a.(map[string]any)
				if m == nil {
					continue
				}
				n := pickGeminiString(m, "name")
				if n == "" {
					continue
				}
				item.Agents = append(item.Agents, core.ToolPart{
					Name:        n,
					Description: pickGeminiString(m, "description"),
				})
			}
		}
		installPath := path
		if installPath == "" {
			installPath = filepath.Join(extensionsRoot(), name)
		}
		enrichExtensionFromDisk(&item, installPath)
		out = append(out, item)
	}
	return out
}

func enrichExtensionFromDisk(item *core.ToolItem, installPath string) {
	if item == nil || installPath == "" {
		return
	}
	st, err := os.Stat(installPath)
	if err != nil || !st.IsDir() {
		return
	}

	for _, rel := range []string{"gemini-extension.json", "extension.json"} {
		b, err := os.ReadFile(filepath.Join(installPath, rel))
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
				item.Version = strings.TrimSpace(s)
			}
		}
		if len(item.MCPServers) == 0 {
			if servers, ok := meta["mcpServers"].(map[string]any); ok {
				for n := range servers {
					item.MCPServers = append(item.MCPServers, core.ToolPart{
						Name:        n,
						Description: "MCP server provided by this extension",
					})
				}
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
					Description: geminiHookDescription(name),
				})
			}
			break
		}
	}
}

func extensionsRoot() string {
	return filepath.Join(core.UserHomeDir(), ".gemini", "extensions")
}

func pickGeminiString(m map[string]any, keys ...string) string {
	for _, k := range keys {
		if v, ok := m[k]; ok {
			if s, ok := v.(string); ok && s != "" {
				return s
			}
		}
	}
	return ""
}

func readExtVersion(root string) string {
	b, err := os.ReadFile(filepath.Join(root, "gemini-extension.json"))
	if err != nil {
		return ""
	}
	var m map[string]any
	if json.Unmarshal(b, &m) != nil {
		return ""
	}
	s, _ := m["version"].(string)
	return s
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

func geminiHookDescription(name string) string {
	switch name {
	case "BeforeAgent", "BeforeAgentStart":
		return "Runs before the agent starts a turn"
	case "AfterAgent", "AfterAgentEnd":
		return "Runs after the agent finishes a turn"
	case "BeforeTool", "BeforeToolUse":
		return "Runs before a tool call is executed"
	case "AfterTool", "AfterToolUse":
		return "Runs after a tool call completes"
	case "SessionStart":
		return "Runs when a session starts"
	case "SessionEnd":
		return "Runs when a session ends"
	case "Notification":
		return "Runs when Gemini emits a notification"
	default:
		return "Extension hook"
	}
}
