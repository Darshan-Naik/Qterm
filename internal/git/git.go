package git

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

type Status struct {
	Path      string `json:"path"`
	IsRepo    bool   `json:"isRepo"`
	Branch    string `json:"branch"`
	Dirty     bool   `json:"dirty"`
	Ahead     int    `json:"ahead"`
	Behind    int    `json:"behind"`
}

func Probe(path string) Status {
	st := Status{Path: path}
	if path == "" {
		return st
	}
	root, err := findRoot(path)
	if err != nil || root == "" {
		return st
	}
	st.IsRepo = true
	st.Path = root

	branch, err := run(root, "rev-parse", "--abbrev-ref", "HEAD")
	if err == nil {
		st.Branch = strings.TrimSpace(branch)
	}

	porcelain, err := run(root, "status", "--porcelain")
	if err == nil {
		st.Dirty = strings.TrimSpace(porcelain) != ""
	}
	return st
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

func run(dir string, args ...string) (string, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	out, err := cmd.Output()
	return string(out), err
}
