package claude

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"qterm/internal/agentcli/core"
)

func TestForceClaudePluginReinstallReplacesCachedCopy(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	source := pluginRoot()
	if err := os.MkdirAll(filepath.Join(source, ".claude-plugin"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(source, ".claude-plugin", "plugin.json"), []byte(`{"name":"qterm","version":"`+core.Version+`"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := core.WriteQtermSkill(filepath.Join(source, "skills", "qterm-terminal")); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(source, "hooks"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(source, "hooks", "hooks.json"), []byte(`{"hooks":{"Stop":[]}}`), 0o644); err != nil {
		t.Fatal(err)
	}

	old := filepath.Join(home, ".claude", "plugins", "cache", "local", "qterm", "1.0.0")
	if err := os.MkdirAll(filepath.Join(old, ".claude-plugin"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(old, ".claude-plugin", "plugin.json"), []byte(`{"name":"qterm","version":"1.0.0"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(old, "skills", "qterm-terminal"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(old, "skills", "qterm-terminal", "SKILL.md"), []byte("---\nname: qterm-terminal\ndescription: old\n---\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	installed := installedPluginsJSON()
	if err := os.MkdirAll(filepath.Dir(installed), 0o755); err != nil {
		t.Fatal(err)
	}
	body := `{
	  "version": 2,
	  "plugins": {
	    "qterm@local": [{
	      "scope": "user",
	      "installPath": "` + old + `",
	      "version": "1.0.0",
	      "installedAt": "2026-01-01T00:00:00Z"
	    }],
	    "other@local": [{"scope": "user", "installPath": "/tmp/other", "version": "9.0.0"}]
	  }
	}`
	if err := os.WriteFile(installed, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}

	if err := forceClaudePluginReinstall(source); err != nil {
		t.Fatal(err)
	}

	if _, err := os.Stat(old); !os.IsNotExist(err) {
		t.Fatalf("old cache still present: %v", err)
	}
	dest := filepath.Join(home, ".claude", "plugins", "cache", "local", "qterm", core.Version)
	skill, err := os.ReadFile(filepath.Join(dest, "skills", "qterm-terminal", "SKILL.md"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(skill), "jump_unread") {
		t.Fatalf("cache skill: %s", skill)
	}
	hooks, err := os.ReadFile(filepath.Join(dest, "hooks", "hooks.json"))
	if err != nil || !strings.Contains(string(hooks), "Stop") {
		t.Fatalf("cache hooks: %s %v", hooks, err)
	}
	raw, err := os.ReadFile(installed)
	if err != nil {
		t.Fatal(err)
	}
	var doc struct {
		Plugins map[string][]struct {
			InstallPath string `json:"installPath"`
			Version     string `json:"version"`
			InstalledAt string `json:"installedAt"`
		} `json:"plugins"`
	}
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatal(err)
	}
	got := doc.Plugins["qterm@local"]
	if len(got) != 1 || got[0].Version != core.Version || got[0].InstallPath != dest {
		t.Fatalf("installed plugin: %+v", got)
	}
	if got[0].InstalledAt != "2026-01-01T00:00:00Z" {
		t.Fatalf("installedAt = %q", got[0].InstalledAt)
	}
	if len(doc.Plugins["other@local"]) != 1 || doc.Plugins["other@local"][0].Version != "9.0.0" {
		t.Fatalf("other plugin changed: %+v", doc.Plugins["other@local"])
	}
	srcSkill, err := os.ReadFile(filepath.Join(source, "skills", "qterm-terminal", "SKILL.md"))
	if err != nil || !strings.Contains(string(srcSkill), "jump_unread") {
		t.Fatalf("source removed: %s %v", srcSkill, err)
	}
}
