package git

import (
	"strings"
	"unicode"
)

const invalidBranchMsg = "Invalid branch name. Use letters, numbers, - and / — no spaces."

// NormalizeBranchName turns a typed name into a git-safe branch ref.
// Spaces and other illegal characters become hyphens.
func NormalizeBranchName(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return ""
	}
	var b strings.Builder
	b.Grow(len(name))
	for _, r := range name {
		switch {
		case unicode.IsSpace(r) || r < 32 || r == 127:
			b.WriteByte('-')
		case strings.ContainsRune("~^:?*[\\", r):
			b.WriteByte('-')
		default:
			b.WriteRune(r)
		}
	}
	s := b.String()
	s = strings.ReplaceAll(s, "..", "-")
	s = strings.ReplaceAll(s, "@{", "-")
	for strings.Contains(s, "--") {
		s = strings.ReplaceAll(s, "--", "-")
	}
	for strings.Contains(s, "//") {
		s = strings.ReplaceAll(s, "//", "/")
	}
	s = strings.Trim(s, "-/.")
	if strings.HasSuffix(strings.ToLower(s), ".lock") {
		s = s[:len(s)-5]
		s = strings.Trim(s, "-/.")
	}
	return s
}

// ValidBranchName reports whether name is a legal git branch (check-ref-format).
func ValidBranchName(name string) bool {
	if name == "" || name == "@" {
		return false
	}
	if strings.Contains(name, "..") || strings.Contains(name, "@{") || strings.Contains(name, "\\") {
		return false
	}
	if strings.HasPrefix(name, "/") || strings.HasSuffix(name, "/") || strings.Contains(name, "//") {
		return false
	}
	if strings.HasPrefix(name, ".") || strings.HasSuffix(name, ".") {
		return false
	}
	if strings.HasSuffix(strings.ToLower(name), ".lock") {
		return false
	}
	for _, part := range strings.Split(name, "/") {
		if part == "" || strings.HasPrefix(part, ".") || strings.HasSuffix(strings.ToLower(part), ".lock") {
			return false
		}
	}
	for _, r := range name {
		if r <= 32 || r == 127 || strings.ContainsRune("~^:?*[", r) {
			return false
		}
	}
	return true
}
