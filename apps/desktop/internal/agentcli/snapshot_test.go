package agentcli

import (
	"os"
	"path/filepath"
	"testing"

	"qterm/internal/agentcli/core"
)

func TestPluginSnapshotsStaleUntilCacheMatchesBuild(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	root := filepath.Join(home, ".claude", "plugins", "qterm")
	if err := os.MkdirAll(filepath.Join(root, ".claude-plugin"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, ".claude-plugin", "plugin.json"), []byte(`{"name":"qterm","version":"`+core.PluginVersion()+`"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := core.WriteQtermSkill(filepath.Join(root, "skills", "qterm-terminal")); err != nil {
		t.Fatal(err)
	}

	cache := filepath.Join(home, ".claude", "plugins", "cache", "local", "qterm", "1.0.0")
	if err := os.MkdirAll(filepath.Join(cache, ".claude-plugin"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(cache, ".claude-plugin", "plugin.json"), []byte(`{"name":"qterm","version":"1.0.0"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(cache, "skills", "qterm-terminal"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(cache, "skills", "qterm-terminal", "SKILL.md"), []byte("---\nname: qterm-terminal\ndescription: old\n---\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	if !PluginSnapshotsStale("claude") {
		t.Fatal("cached plugin should be stale")
	}
	if err := core.PublishQtermPlugin(root, []string{filepath.Join(home, ".claude", "plugins")}); err != nil {
		t.Fatal(err)
	}
	if PluginSnapshotsStale("claude") {
		t.Fatal("cache should match this build after publish")
	}
	if PluginSnapshotsStale("missing") {
		t.Fatal("unknown CLI is not stale")
	}
}
