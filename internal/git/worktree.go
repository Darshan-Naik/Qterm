package git

import (
	"os"
	"path/filepath"
	"strings"
)

type Worktree struct {
	Path   string `json:"path"`
	Branch string `json:"branch"`
	Bare   bool   `json:"bare"`
	Locked bool   `json:"locked"`
	Main   bool   `json:"main"`
}

type WorktreeAddResult struct {
	OK     bool   `json:"ok"`
	Path   string `json:"path"`
	Stdout string `json:"stdout"`
	Stderr string `json:"stderr"`
	Cmd    string `json:"cmd"`
}

func ListWorktrees(path string) []Worktree {
	root, err := findRoot(path)
	if err != nil || root == "" {
		return []Worktree{}
	}
	out, _, err := runRead(root, timeoutQuick, "worktree", "list", "--porcelain")
	if err != nil {
		return []Worktree{}
	}
	return parseWorktreeList(out)
}

func AddWorktree(path, branch string) WorktreeAddResult {
	branch = NormalizeBranchName(branch)
	if !ValidBranchName(branch) {
		return WorktreeAddResult{Stderr: invalidBranchMsg, Cmd: "git worktree add"}
	}
	root, err := findRoot(path)
	if err != nil || root == "" {
		return WorktreeAddResult{Stderr: "not a git repository"}
	}
	dest := worktreeSiblingPath(root, branch)
	if existing := worktreeAt(root, dest); existing != nil {
		return WorktreeAddResult{OK: true, Path: existing.Path, Cmd: "git worktree add"}
	}
	if _, err := os.Stat(dest); err == nil {
		return WorktreeAddResult{
			Stderr: dest + " already exists and isn’t a worktree of this repo",
			Cmd:    "git worktree add",
		}
	}
	args := []string{"worktree", "add", "-b", branch, dest}
	out, errb, err := run(root, timeoutMutate, args...)
	r := resultFrom(err, out, errb, args...)
	res := WorktreeAddResult{OK: r.OK, Stdout: r.Stdout, Stderr: r.Stderr, Cmd: r.Cmd}
	if res.OK {
		res.Path = dest
	}
	return res
}

func RemoveWorktree(path, worktreePath string, force bool) Result {
	worktreePath = strings.TrimSpace(worktreePath)
	if worktreePath == "" {
		return Result{Stderr: "empty worktree path", Cmd: "git worktree remove"}
	}
	return withRoot(path, func(root string) Result {
		trees := ListWorktrees(root)
		var target *Worktree
		for i := range trees {
			if samePath(trees[i].Path, worktreePath) {
				target = &trees[i]
				break
			}
		}
		if target == nil {
			return Result{Stderr: "not a worktree of this repository", Cmd: "git worktree remove"}
		}
		if target.Main {
			return Result{Stderr: "Cannot remove the main worktree", Cmd: "git worktree remove"}
		}
		args := []string{"worktree", "remove"}
		if force {
			args = append(args, "--force")
		}
		args = append(args, target.Path)
		out, errb, err := run(root, timeoutMutate, args...)
		r := resultFrom(err, out, errb, args...)
		if !r.OK && isDirtyWorktree(r.Stderr) {
			r.Stderr = "Worktree has local changes"
		}
		return r
	})
}

func PruneWorktrees(path string) Result {
	return withRoot(path, func(root string) Result {
		args := []string{"worktree", "prune"}
		out, errb, err := run(root, timeoutMutate, args...)
		return resultFrom(err, out, errb, args...)
	})
}

func worktreeSiblingPath(root, branch string) string {
	safe := strings.ReplaceAll(branch, "/", "-")
	return filepath.Join(filepath.Dir(root), filepath.Base(root)+"-"+safe)
}

func worktreeAt(root, dest string) *Worktree {
	for _, wt := range ListWorktrees(root) {
		if samePath(wt.Path, dest) {
			w := wt
			return &w
		}
	}
	return nil
}

func samePath(a, b string) bool {
	aa, errA := filepath.Abs(a)
	bb, errB := filepath.Abs(b)
	if errA == nil && errB == nil {
		a, b = filepath.Clean(aa), filepath.Clean(bb)
	} else {
		a, b = filepath.Clean(a), filepath.Clean(b)
	}
	if a == b {
		return true
	}
	ia, errA := os.Stat(a)
	ib, errB := os.Stat(b)
	if errA != nil || errB != nil {
		return false
	}
	return os.SameFile(ia, ib)
}

func isDirtyWorktree(stderr string) bool {
	s := strings.ToLower(stderr)
	return strings.Contains(s, "contains modified") ||
		strings.Contains(s, "not a valid path") && strings.Contains(s, "dirty") ||
		strings.Contains(s, "use --force")
}
