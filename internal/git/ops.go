package git

import (
	"strings"
)

func Fetch(path string) Result {
	return withRoot(path, func(root string) Result {
		args := []string{"fetch"}
		out, errb, err := run(root, timeoutNetwork, args...)
		return resultFrom(err, out, errb, args...)
	})
}

func Pull(path string) Result {
	return withRoot(path, func(root string) Result {
		args := []string{"pull"}
		out, errb, err := run(root, timeoutNetwork, args...)
		return resultFrom(err, out, errb, args...)
	})
}

func Push(path string) Result {
	return withRoot(path, func(root string) Result {
		args := []string{"push"}
		out, errb, err := run(root, timeoutNetwork, args...)
		r := resultFrom(err, out, errb, args...)
		if r.OK || !needsUpstream(r.Stderr) {
			return r
		}
		up := []string{"push", "-u", "origin", "HEAD"}
		out, errb, err = run(root, timeoutNetwork, up...)
		return resultFrom(err, out, errb, up...)
	})
}

func Stage(path, file string) Result {
	return withRoot(path, func(root string) Result {
		args := []string{"add", "--", file}
		out, errb, err := run(root, timeoutMutate, args...)
		return resultFrom(err, out, errb, args...)
	})
}

func Unstage(path, file string) Result {
	return withRoot(path, func(root string) Result {
		args := []string{"restore", "--staged", "--", file}
		out, errb, err := run(root, timeoutMutate, args...)
		return resultFrom(err, out, errb, args...)
	})
}

func StageAll(path string) Result {
	return withRoot(path, func(root string) Result {
		args := []string{"add", "-A"}
		out, errb, err := run(root, timeoutMutate, args...)
		return resultFrom(err, out, errb, args...)
	})
}

func UnstageAll(path string) Result {
	return withRoot(path, func(root string) Result {
		args := []string{"restore", "--staged", "."}
		out, errb, err := run(root, timeoutMutate, args...)
		return resultFrom(err, out, errb, args...)
	})
}

func Commit(path, message string) Result {
	msg := strings.TrimSpace(message)
	if msg == "" {
		return Result{Stderr: "empty commit message", Cmd: "git commit"}
	}
	return withRoot(path, func(root string) Result {
		args := []string{"commit", "-m", msg}
		out, errb, err := run(root, timeoutMutate, args...)
		return resultFrom(err, out, errb, "commit", "-m", msg)
	})
}

func Checkout(path, branch string) Result {
	branch = strings.TrimSpace(branch)
	if !ValidBranchName(branch) {
		return Result{Stderr: invalidBranchMsg, Cmd: "git checkout"}
	}
	return withRoot(path, func(root string) Result {
		args := []string{"checkout", branch}
		out, errb, err := run(root, timeoutMutate, args...)
		return resultFrom(err, out, errb, args...)
	})
}

func CreateBranch(path, name string) Result {
	name = NormalizeBranchName(name)
	if !ValidBranchName(name) {
		return Result{Stderr: invalidBranchMsg, Cmd: "git checkout -b"}
	}
	return withRoot(path, func(root string) Result {
		args := []string{"checkout", "-b", name}
		out, errb, err := run(root, timeoutMutate, args...)
		r := resultFrom(err, out, errb, args...)
		if !r.OK && isInvalidBranchErr(r.Stderr) {
			r.Stderr = invalidBranchMsg
		}
		return r
	})
}

func DeleteBranch(path, name string, force bool) Result {
	name = strings.TrimSpace(name)
	if !ValidBranchName(name) {
		return Result{Stderr: invalidBranchMsg, Cmd: "git branch -d"}
	}
	return withRoot(path, func(root string) Result {
		st, _, _ := inspect(root)
		if st.Branch == name {
			return Result{Stderr: "Cannot delete the current branch", Cmd: "git branch -d " + name}
		}
		flag := "-d"
		if force {
			flag = "-D"
		}
		args := []string{"branch", flag, name}
		out, errb, err := run(root, timeoutMutate, args...)
		r := resultFrom(err, out, errb, args...)
		if !r.OK && isNotMerged(r.Stderr) {
			r.Stderr = "Branch is not fully merged"
		}
		return r
	})
}

func Discard(path, file string) Result {
	file = strings.TrimSpace(file)
	if file == "" {
		return Result{Stderr: "empty path", Cmd: "git restore"}
	}
	return withRoot(path, func(root string) Result {
		st, _, files := inspect(root)
		if !st.IsRepo {
			return Result{Stderr: "not a git repository"}
		}
		untracked := false
		for _, f := range files {
			if f.Path == file && f.Code == "??" {
				untracked = true
				break
			}
		}
		var args []string
		if untracked {
			args = []string{"clean", "-fd", "--", file}
		} else {
			args = []string{"restore", "--staged", "--worktree", "--source=HEAD", "--", file}
		}
		out, errb, err := run(root, timeoutMutate, args...)
		return resultFrom(err, out, errb, args...)
	})
}

func DiscardAll(path string) Result {
	return withRoot(path, func(root string) Result {
		args := []string{"restore", "--worktree", "--source=HEAD", "."}
		out, errb, err := run(root, timeoutMutate, args...)
		r := resultFrom(err, out, errb, args...)
		if !r.OK && !strings.Contains(strings.ToLower(r.Stderr), "did not match") {
			return r
		}
		clean := []string{"clean", "-fd"}
		out, errb, err = run(root, timeoutMutate, clean...)
		return resultFrom(err, out, errb, clean...)
	})
}

func Stash(path, message string) Result {
	return withRoot(path, func(root string) Result {
		args := []string{"stash", "push", "-u"}
		if msg := strings.TrimSpace(message); msg != "" {
			args = append(args, "-m", msg)
		}
		out, errb, err := run(root, timeoutMutate, args...)
		return resultFrom(err, out, errb, args...)
	})
}

func StashPop(path, ref string) Result {
	return stashOp(path, "pop", ref)
}

func StashApply(path, ref string) Result {
	return stashOp(path, "apply", ref)
}

func StashDrop(path, ref string) Result {
	return stashOp(path, "drop", ref)
}

func stashOp(path, op, ref string) Result {
	target, ok := stashRef(ref)
	if !ok {
		return Result{Stderr: "invalid stash ref", Cmd: "git stash " + op}
	}
	return withRoot(path, func(root string) Result {
		args := []string{"stash", op, target}
		out, errb, err := run(root, timeoutMutate, args...)
		return resultFrom(err, out, errb, args...)
	})
}

func needsUpstream(stderr string) bool {
	s := strings.ToLower(stderr)
	return strings.Contains(s, "no upstream") ||
		strings.Contains(s, "has no upstream branch") ||
		strings.Contains(s, "the current branch") && strings.Contains(s, "has no upstream")
}

func isInvalidBranchErr(stderr string) bool {
	s := strings.ToLower(stderr)
	return strings.Contains(s, "not a valid branch name") ||
		strings.Contains(s, "check-ref-format")
}

func isNotMerged(stderr string) bool {
	s := strings.ToLower(stderr)
	return strings.Contains(s, "not fully merged")
}
