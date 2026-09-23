package core

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSyncQtermSnapshotsRefreshesCacheAndSkill(t *testing.T) {
	home := t.TempDir()
	canonical := filepath.Join(home, "plugins", "qterm")
	if err := os.MkdirAll(filepath.Join(canonical, ".claude-plugin"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(canonical, ".claude-plugin", "plugin.json"), []byte(`{"name":"qterm","version":"`+Version+`"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(canonical, "hooks"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(canonical, "hooks", "hooks.json"), []byte(`{"hooks":{"Stop":[]}}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := WriteQtermSkill(filepath.Join(canonical, "skills", "qterm-terminal")); err != nil {
		t.Fatal(err)
	}
	relay := filepath.Join(canonical, "hooks", "relay.sh")
	if err := os.WriteFile(relay, []byte("#!/bin/bash\necho new\n"), 0o755); err != nil {
		t.Fatal(err)
	}

	cache := filepath.Join(home, "plugins", "cache", "local", "qterm", "1.4.0")
	if err := os.MkdirAll(filepath.Join(cache, ".claude-plugin"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(cache, ".claude-plugin", "plugin.json"), []byte(`{"name":"qterm","version":"1.4.0"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(cache, "skills", "qterm-terminal"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(cache, "skills", "qterm-terminal", "SKILL.md"), []byte("---\nname: qterm-terminal\ndescription: old\n---\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(cache, "notes.txt"), []byte("keep"), 0o644); err != nil {
		t.Fatal(err)
	}

	other := filepath.Join(home, "plugins", "cache", "other", "foo", "1.0.0")
	if err := os.MkdirAll(filepath.Join(other, ".claude-plugin"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(other, ".claude-plugin", "plugin.json"), []byte(`{"name":"foo","version":"1.0.0"}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(other, "SKILL.md"), []byte("KEEP"), 0o644); err != nil {
		t.Fatal(err)
	}

	skill := filepath.Join(home, "skills", "qterm-terminal")
	if err := os.MkdirAll(skill, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(skill, "SKILL.md"), []byte("---\nname: qterm-terminal\ndescription: old\n---\n"), 0o644); err != nil {
		t.Fatal(err)
	}

	if SnapshotsCurrent(canonical, []string{filepath.Join(home, "plugins"), filepath.Join(home, "skills")}) {
		t.Fatal("expected stale snapshots")
	}
	if err := SyncQtermSnapshots(canonical, []string{filepath.Join(home, "plugins"), filepath.Join(home, "skills")}); err != nil {
		t.Fatal(err)
	}

	gotSkill, err := os.ReadFile(filepath.Join(cache, "skills", "qterm-terminal", "SKILL.md"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(gotSkill), "split_terminal") {
		t.Fatalf("cache skill not refreshed: %s", gotSkill)
	}
	manifest, err := os.ReadFile(filepath.Join(cache, ".claude-plugin", "plugin.json"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(manifest), Version) {
		t.Fatalf("cache manifest: %s", manifest)
	}
	hooks, err := os.ReadFile(filepath.Join(cache, "hooks", "hooks.json"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(hooks), "Stop") {
		t.Fatalf("cache hooks: %s", hooks)
	}
	info, err := os.Stat(filepath.Join(cache, "hooks", "relay.sh"))
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm()&0o111 == 0 {
		t.Fatalf("relay not executable: %v", info.Mode())
	}
	notes, err := os.ReadFile(filepath.Join(cache, "notes.txt"))
	if err != nil || string(notes) != "keep" {
		t.Fatalf("extra cache file: %q %v", notes, err)
	}
	otherBody, err := os.ReadFile(filepath.Join(other, "SKILL.md"))
	if err != nil || string(otherBody) != "KEEP" {
		t.Fatalf("unrelated plugin changed: %q %v", otherBody, err)
	}
	standalone, err := os.ReadFile(filepath.Join(skill, "SKILL.md"))
	if err != nil || !strings.Contains(string(standalone), "jump_unread") {
		t.Fatalf("standalone skill: %s %v", standalone, err)
	}
	if !SnapshotsCurrent(canonical, []string{filepath.Join(home, "plugins"), filepath.Join(home, "skills")}) {
		t.Fatal("expected snapshots current after sync")
	}
}

func TestMirrorTreeSkipsCanonical(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, "SKILL.md"), []byte("same"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := MirrorTree(dir, dir); err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile(filepath.Join(dir, "SKILL.md"))
	if err != nil || string(b) != "same" {
		t.Fatalf("canonical changed: %q %v", b, err)
	}
}
