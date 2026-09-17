package grok

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

var reEnabledLine = regexp.MustCompile(`(?m)^enabled\s*=\s*\[([^\]]*)\]`)

func setPluginEnabledInToml(path, name string, enable bool) error {
	if name == "" {
		return nil
	}
	b, err := os.ReadFile(path)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	text := setPluginEnabled(string(b), name, enable)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(text), 0o644)
}

func setPluginEnabled(text, name string, enable bool) string {
	start, end := sectionBounds(text, "[plugins]")
	if start < 0 {
		if !enable {
			return text
		}
		if text != "" && !strings.HasSuffix(text, "\n") {
			text += "\n"
		}
		return text + "\n[plugins]\nenabled = [" + tomlQuote(name) + "]\n"
	}
	section := text[start:end]
	loc := reEnabledLine.FindStringSubmatchIndex(section)
	if loc == nil {
		if !enable {
			return text
		}
		insertAt := len("[plugins]")
		if insertAt > len(section) {
			insertAt = len(section)
		}
		updated := section[:insertAt] + "\nenabled = [" + tomlQuote(name) + "]" + section[insertAt:]
		return text[:start] + updated + text[end:]
	}
	inner := section[loc[2]:loc[3]]
	list := splitTomlStrings(inner)
	if enable {
		list = addUnique(list, name)
	} else {
		list = removeExact(list, name)
	}
	replacement := "enabled = [" + joinTomlStrings(list) + "]"
	updated := section[:loc[0]] + replacement + section[loc[1]:]
	return text[:start] + updated + text[end:]
}

func sectionBounds(text, header string) (start, end int) {
	idx := strings.Index(text, header)
	if idx < 0 {
		return -1, -1
	}
	rest := text[idx+len(header):]
	next := regexp.MustCompile(`(?m)^\[`).FindStringIndex(rest)
	if next == nil {
		return idx, len(text)
	}
	return idx, idx + len(header) + next[0]
}

func splitTomlStrings(inner string) []string {
	var out []string
	for _, part := range strings.Split(inner, ",") {
		s := strings.TrimSpace(part)
		s = strings.Trim(s, `"'`)
		if s != "" {
			out = append(out, s)
		}
	}
	return out
}

func joinTomlStrings(list []string) string {
	if len(list) == 0 {
		return ""
	}
	quoted := make([]string, 0, len(list))
	for _, s := range list {
		quoted = append(quoted, tomlQuote(s))
	}
	return strings.Join(quoted, ", ")
}

func tomlQuote(s string) string {
	return `"` + strings.ReplaceAll(s, `"`, `\"`) + `"`
}

func addUnique(list []string, s string) []string {
	for _, e := range list {
		if e == s {
			return list
		}
	}
	return append(list, s)
}

func removeExact(list []string, s string) []string {
	out := list[:0]
	for _, e := range list {
		if e != s {
			out = append(out, e)
		}
	}
	return out
}
