package git

import (
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type Status struct {
	Path   string `json:"path"`
	IsRepo bool   `json:"isRepo"`
	Branch string `json:"branch"`
	Dirty  bool   `json:"dirty"`
	Ahead  int    `json:"ahead"`
	Behind int    `json:"behind"`
}

type File struct {
	Path     string `json:"path"`
	Code     string `json:"code"`
	Staged   bool   `json:"staged"`
	Unstaged bool   `json:"unstaged"`
}

type Snapshot struct {
	Status
	Upstream   string `json:"upstream"`
	InProgress string `json:"inProgress"`
	Files      []File `json:"files"`
}

type Branch struct {
	Name    string `json:"name"`
	Current bool   `json:"current"`
	Date    int64  `json:"date"`
}

type Result struct {
	OK     bool   `json:"ok"`
	Stdout string `json:"stdout"`
	Stderr string `json:"stderr"`
	Cmd    string `json:"cmd"`
}

func Probe(path string) Status {
	st, _, _ := inspect(path)
	return st
}

func LoadSnapshot(path string) Snapshot {
	st, br, files := inspect(path)
	if files == nil {
		files = []File{}
	}
	snap := Snapshot{
		Status:     st,
		Upstream:   br.Upstream,
		InProgress: "",
		Files:      files,
	}
	if st.IsRepo {
		snap.InProgress = inProgress(st.Path)
	}
	return snap
}

func ListBranches(path string) []Branch {
	root, err := findRoot(path)
	if err != nil || root == "" {
		return []Branch{}
	}
	out, _, err := run(root, timeoutQuick, "for-each-ref",
		"--sort=-committerdate",
		"--format=%(refname:short)%00%(HEAD)%00%(committerdate:unix)",
		"refs/heads")
	if err != nil {
		return []Branch{}
	}
	list := make([]Branch, 0)
	for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
		if line == "" {
			continue
		}
		parts := strings.Split(line, "\x00")
		if len(parts) < 3 {
			continue
		}
		unix, _ := strconv.ParseInt(parts[2], 10, 64)
		list = append(list, Branch{
			Name:    parts[0],
			Current: strings.TrimSpace(parts[1]) == "*",
			Date:    unix,
		})
	}
	return list
}

func inspect(path string) (Status, branchInfo, []File) {
	st := Status{Path: path}
	if path == "" {
		return st, branchInfo{}, nil
	}
	root, err := findRoot(path)
	if err != nil || root == "" {
		return st, branchInfo{}, nil
	}
	st.IsRepo = true
	st.Path = root

	out, _, err := run(root, timeoutQuick, "status", "--porcelain", "-b")
	if err != nil {
		return st, branchInfo{}, nil
	}
	br, files := parseStatus(out)
	st.Branch = br.Name
	st.Ahead = br.Ahead
	st.Behind = br.Behind
	st.Dirty = len(files) > 0
	return st, br, files
}

func findRoot(path string) (string, error) {
	info, err := os.Stat(path)
	if err != nil {
		return "", err
	}
	dir := path
	if !info.IsDir() {
		dir = filepath.Dir(path)
	}
	for {
		if _, err := os.Stat(filepath.Join(dir, ".git")); err == nil {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", os.ErrNotExist
		}
		dir = parent
	}
}

func inProgress(root string) string {
	gitDir := filepath.Join(root, ".git")
	info, err := os.Stat(gitDir)
	if err != nil {
		return ""
	}
	dir := gitDir
	if !info.IsDir() {
		// Worktree: .git is a file pointing at the real git dir.
		return ""
	}
	switch {
	case exists(filepath.Join(dir, "MERGE_HEAD")):
		return "merge"
	case exists(filepath.Join(dir, "rebase-merge")) || exists(filepath.Join(dir, "rebase-apply")):
		return "rebase"
	case exists(filepath.Join(dir, "CHERRY_PICK_HEAD")):
		return "cherry-pick"
	}
	return ""
}

func exists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
