package claude

import (
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"

	"qterm/internal/agentcli/core"
)

// forceClaudePluginReinstall drops Claude's cached qterm plugin and installs it
// again. `claude plugin install` does not refresh an existing cache entry, and
// `claude plugin update` leaves that cache in place, so Claude keeps the skills
// and hooks from the first connect until the cache is removed.
func forceClaudePluginReinstall(source string) error {
	installedAt := readQtermInstalledAt()
	if err := clearClaudePluginCache(); err != nil {
		return err
	}
	// Drop the registry entry first. While it exists, `claude plugin install`
	// leaves the old cache in place.
	if err := dropInstalledQtermEntries(); err != nil {
		return err
	}
	if bin, err := core.FirstBinary("claude"); err == nil {
		id := core.PluginName + "@" + localMarketplaceName
		core.RefreshCLI(bin, "plugin", "install", id, "--scope", "user")
		core.RefreshCLI(bin, "plugin", "enable", id)
	}
	return ensureClaudeCacheCopy(source, installedAt)
}

func clearClaudePluginCache() error {
	cache := filepath.Join(pluginsDir(), "cache")
	return filepath.WalkDir(cache, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			if os.IsNotExist(err) {
				return nil
			}
			return err
		}
		if !d.IsDir() || d.Name() != core.PluginName {
			return nil
		}
		if err := os.RemoveAll(path); err != nil {
			return err
		}
		return fs.SkipDir
	})
}

func installedPluginsJSON() string {
	return filepath.Join(pluginsDir(), "installed_plugins.json")
}

func dropInstalledQtermEntries() error {
	path := installedPluginsJSON()
	b, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	var root map[string]any
	if json.Unmarshal(b, &root) != nil {
		return nil
	}
	plugins, _ := root["plugins"].(map[string]any)
	if len(plugins) == 0 {
		return nil
	}
	changed := false
	for key := range plugins {
		if isQtermPluginKey(key) {
			delete(plugins, key)
			changed = true
		}
	}
	if !changed {
		return nil
	}
	root["plugins"] = plugins
	return core.WriteConfigJSON(path, root)
}

func readQtermInstalledAt() string {
	b, err := os.ReadFile(installedPluginsJSON())
	if err != nil {
		return ""
	}
	var root map[string]any
	if json.Unmarshal(b, &root) != nil {
		return ""
	}
	return qtermInstalledAt(root)
}

func ensureClaudeCacheCopy(source, installedAt string) error {
	dest := filepath.Join(pluginsDir(), "cache", localMarketplaceName, core.PluginName, core.Version)
	if err := os.RemoveAll(dest); err != nil {
		return err
	}
	if err := core.MirrorTree(source, dest); err != nil {
		return err
	}
	return pointInstalledPlugin(dest, installedAt)
}

func pointInstalledPlugin(installPath, installedAt string) error {
	path := installedPluginsJSON()
	root := map[string]any{}
	if b, err := os.ReadFile(path); err == nil && len(b) > 0 {
		_ = json.Unmarshal(b, &root)
	}
	if _, ok := root["version"]; !ok {
		root["version"] = 2
	}
	plugins, _ := root["plugins"].(map[string]any)
	if plugins == nil {
		plugins = map[string]any{}
	}
	for key := range plugins {
		if isQtermPluginKey(key) {
			delete(plugins, key)
		}
	}
	now := time.Now().UTC().Format(time.RFC3339)
	if installedAt == "" {
		installedAt = now
	}
	plugins[core.PluginName+"@"+localMarketplaceName] = []any{
		map[string]any{
			"scope":       "user",
			"installPath": installPath,
			"version":     core.Version,
			"installedAt": installedAt,
			"lastUpdated": now,
		},
	}
	root["plugins"] = plugins
	return core.WriteConfigJSON(path, root)
}

func qtermInstalledAt(root map[string]any) string {
	plugins, _ := root["plugins"].(map[string]any)
	for key, raw := range plugins {
		if !isQtermPluginKey(key) {
			continue
		}
		for _, entry := range pluginEntries(raw) {
			if at, _ := entry["installedAt"].(string); at != "" {
				return at
			}
		}
	}
	return ""
}

func pluginEntries(raw any) []map[string]any {
	switch v := raw.(type) {
	case []any:
		out := make([]map[string]any, 0, len(v))
		for _, item := range v {
			if m, ok := item.(map[string]any); ok {
				out = append(out, m)
			}
		}
		return out
	case map[string]any:
		return []map[string]any{v}
	default:
		return nil
	}
}

func isQtermPluginKey(key string) bool {
	k := strings.ToLower(strings.TrimSpace(key))
	if k == core.PluginName {
		return true
	}
	name, _, ok := strings.Cut(k, "@")
	return ok && name == core.PluginName
}
