package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Files that use //export must not define C symbols in the import "C" preamble.
// cgo copies that preamble into two translation units; definitions then fail
// `wails build` with duplicate symbols (Release 1.7.0 on macOS).
func TestCgoExportPreambleHasNoDefinitions(t *testing.T) {
	var files []string
	err := filepath.Walk(".", func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			base := info.Name()
			if path != "." && (base == "vendor" || base == "frontend" || base == "build" || strings.HasPrefix(base, ".")) {
				return filepath.SkipDir
			}
			return nil
		}
		if strings.HasSuffix(path, ".go") && !strings.HasSuffix(path, "_test.go") {
			files = append(files, path)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}

	foundExport := 0
	for _, path := range files {
		src, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		text := string(src)
		if !hasLinePrefix(text, "import \"C\"") || !hasLinePrefix(text, "//export ") {
			continue
		}
		foundExport++
		preamble, ok := cgoPreamble(text)
		if !ok {
			t.Errorf("%s: //export file missing import \"C\" preamble", path)
			continue
		}
		if cgoPreambleDefines(preamble) {
			t.Errorf("%s: //export preamble must only declare C symbols; move definitions to a .c/.m file", path)
		}
		if goCommentStuckToCgoPreamble(text) {
			t.Errorf("%s: Go comments next to import \"C\" are compiled as C; leave a blank line", path)
		}
	}
	if foundExport == 0 {
		t.Fatal("expected at least one //export cgo file")
	}
}

func hasLinePrefix(src, prefix string) bool {
	for _, line := range strings.Split(src, "\n") {
		if strings.HasPrefix(strings.TrimSpace(line), prefix) {
			return true
		}
	}
	return false
}

func cgoPreamble(src string) (string, bool) {
	idx := strings.LastIndex(src, "import \"C\"")
	if idx < 0 {
		return "", false
	}
	before := strings.TrimSpace(src[:idx])
	start := strings.LastIndex(before, "/*")
	end := strings.LastIndex(before, "*/")
	if start < 0 || end < start {
		return "", false
	}
	return before[start+2 : end], true
}

func goCommentStuckToCgoPreamble(src string) bool {
	idx := strings.LastIndex(src, "import \"C\"")
	if idx < 0 {
		return false
	}
	before := strings.TrimRight(src[:idx], " \t\n")
	start := strings.LastIndex(before, "/*")
	if start < 0 {
		return false
	}
	head := strings.TrimRight(before[:start], " \t\n")
	nl := strings.LastIndex(head, "\n")
	line := head
	if nl >= 0 {
		line = head[nl+1:]
	}
	line = strings.TrimSpace(line)
	return strings.HasPrefix(line, "//") && !strings.HasPrefix(line, "//go:")
}

func cgoPreambleDefines(preamble string) bool {
	var b strings.Builder
	for _, line := range strings.Split(preamble, "\n") {
		trim := strings.TrimSpace(line)
		if strings.HasPrefix(trim, "#") {
			continue
		}
		if i := strings.Index(trim, "//"); i >= 0 {
			trim = strings.TrimSpace(trim[:i])
		}
		if trim == "" {
			continue
		}
		b.WriteString(trim)
		b.WriteByte('\n')
	}
	return strings.Contains(b.String(), "{")
}

func TestCgoPreambleDefines(t *testing.T) {
	if !cgoPreambleDefines("void QtermSetDockBadge(int count) {\n\treturn;\n}\n") {
		t.Fatal("function body must count as a definition")
	}
	if cgoPreambleDefines("#cgo LDFLAGS: -framework Cocoa\nvoid QtermSetDockBadge(int count);\nint QtermAppIsActive(void);\n") {
		t.Fatal("declarations must be allowed")
	}
}

func TestGoCommentStuckToCgoPreamble(t *testing.T) {
	bad := "package p\n\n// Declarations only.\n/*\nvoid foo(void);\n*/\nimport \"C\"\n"
	if !goCommentStuckToCgoPreamble(bad) {
		t.Fatal("adjacent Go comments must be flagged")
	}
	ok := "// C lives in foo.c.\npackage p\n\n/*\nvoid foo(void);\n*/\nimport \"C\"\n"
	if goCommentStuckToCgoPreamble(ok) {
		t.Fatal("package comments separated by a blank line are fine")
	}
}
