package git

import (
	"bytes"
	"context"
	"os/exec"
	"strings"
	"sync"
	"time"
)

const (
	timeoutQuick   = 8 * time.Second
	timeoutMutate  = 15 * time.Second
	timeoutNetwork = 60 * time.Second
	lockRetries    = 6
)

var (
	repoMu   sync.Mutex
	repoLock = map[string]*sync.Mutex{}
)

func lockRepo(dir string) func() {
	repoMu.Lock()
	m, ok := repoLock[dir]
	if !ok {
		m = &sync.Mutex{}
		repoLock[dir] = m
	}
	repoMu.Unlock()
	m.Lock()
	return m.Unlock
}

func run(dir string, timeout time.Duration, args ...string) (stdout, stderr string, err error) {
	return runLocked(dir, timeout, false, args...)
}

func runRead(dir string, timeout time.Duration, args ...string) (stdout, stderr string, err error) {
	return runLocked(dir, timeout, true, args...)
}

func runLocked(dir string, timeout time.Duration, readOnly bool, args ...string) (stdout, stderr string, err error) {
	unlock := lockRepo(dir)
	defer unlock()
	gitArgs := args
	if readOnly {
		gitArgs = append([]string{"--no-optional-locks"}, args...)
	}
	for i := 0; i < lockRetries; i++ {
		stdout, stderr, err = runOnce(dir, timeout, gitArgs...)
		if err == nil || !isIndexLock(stderr) {
			return stdout, stderr, err
		}
		time.Sleep(time.Duration(50*(i+1)) * time.Millisecond)
	}
	return stdout, stderr, err
}

func runOnce(dir string, timeout time.Duration, args ...string) (stdout, stderr string, err error) {
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Dir = dir
	var out, errb bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &errb
	err = cmd.Run()
	return out.String(), errb.String(), err
}

func isIndexLock(stderr string) bool {
	s := strings.ToLower(stderr)
	return strings.Contains(s, "index.lock") ||
		(strings.Contains(s, "unable to create") && strings.Contains(s, ".lock"))
}

func resultFrom(err error, stdout, stderr string, args ...string) Result {
	r := Result{
		OK:     err == nil,
		Stdout: strings.TrimSpace(stdout),
		Stderr: strings.TrimSpace(stderr),
		Cmd:    "git " + strings.Join(args, " "),
	}
	if err != nil && r.Stderr == "" {
		r.Stderr = err.Error()
	}
	if !r.OK && isIndexLock(r.Stderr) {
		r.Stderr = "Git is busy in this repo (index lock). Wait a second and try again."
	}
	return r
}

func withRoot(path string, fn func(root string) Result) Result {
	root, err := findRoot(path)
	if err != nil || root == "" {
		return Result{Stderr: "not a git repository"}
	}
	return fn(root)
}
