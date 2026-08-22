package git

import (
	"bytes"
	"context"
	"os/exec"
	"strings"
	"time"
)

const (
	timeoutQuick   = 8 * time.Second
	timeoutMutate  = 15 * time.Second
	timeoutNetwork = 60 * time.Second
)

func run(dir string, timeout time.Duration, args ...string) (stdout, stderr string, err error) {
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
	return r
}

func withRoot(path string, fn func(root string) Result) Result {
	root, err := findRoot(path)
	if err != nil || root == "" {
		return Result{Stderr: "not a git repository"}
	}
	return fn(root)
}
