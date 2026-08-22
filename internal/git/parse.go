package git

import (
	"strconv"
	"strings"
)

type branchInfo struct {
	Name     string
	Upstream string
	Ahead    int
	Behind   int
}

func parseStatus(out string) (branchInfo, []File) {
	var br branchInfo
	files := make([]File, 0)
	for _, line := range strings.Split(out, "\n") {
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "## ") {
			br = parseBranchLine(line)
			continue
		}
		if f, ok := parseFileLine(line); ok {
			files = append(files, f)
		}
	}
	return br, files
}

func parseBranchLine(line string) branchInfo {
	line = strings.TrimPrefix(line, "## ")
	var br branchInfo
	if strings.HasPrefix(line, "HEAD (no branch)") {
		br.Name = "HEAD"
		return br
	}
	line = strings.TrimPrefix(line, "No commits yet on ")
	line = strings.TrimPrefix(line, "Initial commit on ")

	rest := line
	if i := strings.Index(line, " ["); i >= 0 {
		rest = line[:i]
		inner := strings.TrimSuffix(line[i+2:], "]")
		br.Ahead, br.Behind = parseAheadBehind(inner)
	}
	name, upstream, ok := strings.Cut(rest, "...")
	br.Name = strings.TrimSpace(name)
	if ok {
		br.Upstream = strings.TrimSpace(upstream)
	}
	return br
}

func parseAheadBehind(s string) (ahead, behind int) {
	for _, part := range strings.Split(s, ",") {
		part = strings.TrimSpace(part)
		switch {
		case strings.HasPrefix(part, "ahead "):
			ahead, _ = strconv.Atoi(strings.TrimSpace(strings.TrimPrefix(part, "ahead ")))
		case strings.HasPrefix(part, "behind "):
			behind, _ = strconv.Atoi(strings.TrimSpace(strings.TrimPrefix(part, "behind ")))
		}
	}
	return
}

func parseFileLine(line string) (File, bool) {
	if len(line) < 2 {
		return File{}, false
	}
	code := line[:2]
	path := ""
	if len(line) > 3 && line[2] == ' ' {
		path = line[3:]
	} else if len(line) > 2 {
		path = strings.TrimSpace(line[2:])
	}
	if path == "" {
		return File{}, false
	}
	if i := strings.LastIndex(path, " -> "); i >= 0 {
		path = path[i+4:]
	}
	path = unquoteGit(path)
	return File{
		Path:     path,
		Code:     code,
		Staged:   code[0] != ' ' && code[0] != '?',
		Unstaged: code[1] != ' ' || code == "??",
	}, true
}

func unquoteGit(s string) string {
	if len(s) < 2 || s[0] != '"' || s[len(s)-1] != '"' {
		return s
	}
	inner := s[1 : len(s)-1]
	inner = strings.ReplaceAll(inner, `\\`, `\`)
	inner = strings.ReplaceAll(inner, `\"`, `"`)
	return inner
}
