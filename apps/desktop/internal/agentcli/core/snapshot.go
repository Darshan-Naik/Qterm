package core

import (
	"bytes"
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

const snapshotWalkDepth = 8

var pluginManifestRels = []string{
	filepath.Join(".claude-plugin", "plugin.json"),
	filepath.Join(".codex-plugin", "plugin.json"),
	filepath.Join(".cursor-plugin", "plugin.json"),
	filepath.Join(".grok-plugin", "plugin.json"),
	"plugin.json",
	"gemini-extension.json",
}

// UserSkillRoots are standalone skill folders agents load outside a plugin package.
func UserSkillRoots() []string {
	home := UserHomeDir()
	return []string{
		filepath.Join(home, ".claude", "skills"),
		filepath.Join(home, ".codex", "skills"),
		filepath.Join(home, ".gemini", "skills"),
		filepath.Join(home, ".grok", "skills"),
		filepath.Join(home, ".agents", "skills"),
		filepath.Join(home, ".cursor", "skills"),
	}
}

// PublishRoots is the set of directories to scan for Qterm plugin and skill copies.
func PublishRoots(pluginRoots []string) []string {
	roots := make([]string, 0, len(pluginRoots)+6)
	roots = append(roots, pluginRoots...)
	roots = append(roots, UserSkillRoots()...)
	return roots
}

// PublishQtermPlugin copies the canonical plugin onto every other Qterm snapshot
// under pluginRoots (and onto standalone qterm-terminal skills). CLIs that cache
// a plugin at install time keep loading that copy until it is overwritten.
func PublishQtermPlugin(canonical string, pluginRoots []string) error {
	return SyncQtermSnapshots(canonical, PublishRoots(pluginRoots))
}

// SnapshotsCurrent reports whether the canonical plugin and every other Qterm
// copy under roots already match this build. Missing roots count as current.
func SnapshotsCurrent(canonical string, roots []string) bool {
	if canonical != "" {
		if st, err := os.Stat(canonical); err == nil && st.IsDir() && !pluginDirCurrent(canonical) {
			return false
		}
	}
	current := true
	_ = eachSnapshot(canonical, roots, func(path string, plugin bool) error {
		ok := skillDirCurrent(path)
		if plugin {
			ok = pluginDirCurrent(path)
		}
		if !ok {
			current = false
		}
		return nil
	})
	return current
}

// SyncQtermSnapshots copies canonical onto each Qterm plugin snapshot under roots
// and rewrites standalone qterm-terminal skills. The canonical directory is skipped.
func SyncQtermSnapshots(canonical string, roots []string) error {
	return eachSnapshot(canonical, roots, func(path string, plugin bool) error {
		if plugin {
			return MirrorTree(canonical, path)
		}
		return WriteQtermSkill(path)
	})
}

type snapshotFn func(path string, plugin bool) error

func eachSnapshot(canonical string, roots []string, fn snapshotFn) error {
	var first error
	for _, root := range roots {
		if root == "" {
			continue
		}
		st, err := os.Stat(root)
		if err != nil || !st.IsDir() {
			continue
		}
		err = filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
			if err != nil || !d.IsDir() {
				return nil
			}
			if SameDir(path, canonical) {
				return filepath.SkipDir
			}
			if relDepth(root, path) > snapshotWalkDepth {
				return filepath.SkipDir
			}
			name, ok := pluginManifestName(path)
			if ok {
				if name == PluginName {
					if callErr := fn(path, true); callErr != nil && first == nil {
						first = callErr
					}
				}
				return filepath.SkipDir
			}
			if d.Name() == "qterm-terminal" && isQtermSkillDir(path) {
				if callErr := fn(path, false); callErr != nil && first == nil {
					first = callErr
				}
				return filepath.SkipDir
			}
			return nil
		})
		if err != nil && first == nil {
			first = err
		}
	}
	return first
}

func relDepth(root, path string) int {
	rel, err := filepath.Rel(root, path)
	if err != nil || rel == "." || rel == "" {
		return 0
	}
	return strings.Count(rel, string(filepath.Separator)) + 1
}

func pluginManifestName(dir string) (string, bool) {
	for _, rel := range pluginManifestRels {
		b, err := os.ReadFile(filepath.Join(dir, rel))
		if err != nil {
			continue
		}
		var meta struct {
			Name string `json:"name"`
		}
		if json.Unmarshal(b, &meta) != nil {
			continue
		}
		name := strings.TrimSpace(meta.Name)
		if name == "" {
			continue
		}
		return name, true
	}
	return "", false
}

func pluginDirCurrent(dir string) bool {
	if manifestVersion(dir) != Version {
		return false
	}
	b, err := os.ReadFile(filepath.Join(dir, "skills", "qterm-terminal", "SKILL.md"))
	if err != nil {
		return false
	}
	return skillTextCurrent(b)
}

func skillDirCurrent(dir string) bool {
	b, err := os.ReadFile(filepath.Join(dir, "SKILL.md"))
	if err != nil {
		return false
	}
	return skillTextCurrent(b)
}

// skillTextCurrent accepts the shipped skill or a CLI that reflowed whitespace
// but still has this build's tools. Exact bytes are not required, so a rewrite
// on the agent side does not refresh the plugin on every launch.
func skillTextCurrent(b []byte) bool {
	if bytes.Equal(b, []byte(QtermSkillMarkdown())) {
		return true
	}
	text := string(b)
	for _, marker := range []string{"jump_unread", "split_terminal", "notify_user", "open_in_ide"} {
		if !strings.Contains(text, marker) {
			return false
		}
	}
	return true
}

func manifestVersion(dir string) string {
	for _, rel := range pluginManifestRels {
		b, err := os.ReadFile(filepath.Join(dir, rel))
		if err != nil {
			continue
		}
		var meta struct {
			Version string `json:"version"`
		}
		if json.Unmarshal(b, &meta) != nil {
			continue
		}
		if v := strings.TrimSpace(meta.Version); v != "" {
			return v
		}
	}
	return ""
}

func isQtermSkillDir(dir string) bool {
	b, err := os.ReadFile(filepath.Join(dir, "SKILL.md"))
	if err != nil {
		return false
	}
	text := string(b)
	return strings.Contains(text, "name: qterm-terminal") || strings.Contains(text, "name:qterm-terminal")
}

// MirrorTree copies files from src onto dst. dst must not be src or a child of src.
func MirrorTree(src, dst string) error {
	if SameDir(src, dst) {
		return nil
	}
	rel, err := filepath.Rel(src, dst)
	if err == nil && rel != "." && !strings.HasPrefix(rel, "..") {
		return os.ErrInvalid
	}
	return filepath.WalkDir(src, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		relPath, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		target := filepath.Join(dst, relPath)
		if d.IsDir() {
			return os.MkdirAll(target, 0o755)
		}
		if d.Type()&os.ModeSymlink != 0 {
			return nil
		}
		info, err := d.Info()
		if err != nil {
			return err
		}
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		mode := info.Mode().Perm()
		if mode == 0 {
			mode = 0o644
		}
		return os.WriteFile(target, data, mode)
	})
}

// SameDir reports whether a and b are the same directory.
func SameDir(a, b string) bool {
	if a == "" || b == "" {
		return false
	}
	aa, err1 := filepath.Abs(a)
	bb, err2 := filepath.Abs(b)
	if err1 != nil || err2 != nil {
		return filepath.Clean(a) == filepath.Clean(b)
	}
	if ea, err := filepath.EvalSymlinks(aa); err == nil {
		aa = ea
	}
	if eb, err := filepath.EvalSymlinks(bb); err == nil {
		bb = eb
	}
	return aa == bb
}
