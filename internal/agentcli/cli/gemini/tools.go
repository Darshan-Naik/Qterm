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
	out = append(out, listExtensions()...)
	out = append(out, listSkills()...)
	out = append(out, listMCP()...)
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
		if text, err := core.RunCLI(core.DefaultToolsTimeout, bin, "extensions", "list", "-o", "json"); err == nil {
			if parsed := parseGeminiExtensionsJSON(text); len(parsed) > 0 {
				return parsed
			}
		}
		if text, err := core.RunCLI(core.DefaultToolsTimeout, bin, "extensions", "list"); err == nil {
			if parsed := parseNameLines(text, core.ToolKindExtension); len(parsed) > 0 {
				return parsed
			}
		}
	}
	var out []core.ToolItem
	root := filepath.Join(core.UserHomeDir(), ".gemini", "extensions")
	entries, _ := os.ReadDir(root)
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		name := e.Name()
		out = append(out, core.ToolItem{
			ID: name, Name: name, Kind: core.ToolKindExtension,
			Version: readExtVersion(filepath.Join(root, name)),
			Source:  filepath.Join(root, name),
			Enabled: true, System: core.IsQtermToolID(name),
		})
	}
	return out
}

func listSkills() []core.ToolItem {
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

func listMCP() []core.ToolItem {
	var out []core.ToolItem
	seen := map[string]bool{}
	for _, path := range []string{
		filepath.Join(extensionRoot(), "gemini-extension.json"),
		settingsJSON(),
	} {
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

func parseNameLines(text string, kind core.ToolKind) []core.ToolItem {
	var out []core.ToolItem
	seen := map[string]bool{}
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if strings.HasPrefix(line, "─") || strings.HasPrefix(line, "┌") || strings.HasPrefix(line, "│") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) == 0 {
			continue
		}
		name := strings.Trim(fields[0], "│|")
		if name == "" || seen[name] {
			continue
		}
		if strings.EqualFold(name, "extension") || strings.EqualFold(name, "skill") || strings.EqualFold(name, "name") {
			continue
		}
		seen[name] = true
		ver := ""
		if len(fields) > 1 {
			ver = fields[1]
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
	raw = strings.TrimSpace(raw)
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
		}
		out = append(out, core.ToolItem{
			ID: name, Name: name, Kind: core.ToolKindExtension,
			Version: pickGeminiString(p, "version"),
			Source:  pickGeminiString(p, "path", "installPath", "source"),
			Enabled: en, System: core.IsQtermToolID(name),
		})
	}
	return out
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
