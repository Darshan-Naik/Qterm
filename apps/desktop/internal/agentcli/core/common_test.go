package core

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestWriteQtermSkillMentionsNewTools(t *testing.T) {
	dir := t.TempDir()
	if err := WriteQtermSkill(dir); err != nil {
		t.Fatal(err)
	}
	b, err := os.ReadFile(filepath.Join(dir, "SKILL.md"))
	if err != nil {
		t.Fatal(err)
	}
	text := string(b)
	for _, needle := range []string{"split_terminal", "write_terminal", "notify_user", "jump_unread", "open_in_ide", "q-term notify"} {
		if !strings.Contains(text, needle) {
			t.Fatalf("missing %s in skill", needle)
		}
	}
}

func TestPluginVersionBumped(t *testing.T) {
	if PluginVersion() != "1.4.0" {
		t.Fatalf("version %s", PluginVersion())
	}
}
