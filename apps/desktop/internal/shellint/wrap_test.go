package shellint

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestInstallWritesFiles(t *testing.T) {
	dir := t.TempDir()
	if err := Install(dir); err != nil {
		t.Fatal(err)
	}
	for _, p := range []string{
		filepath.Join(dir, "bash.rc"),
		filepath.Join(dir, "zsh.zsh"),
	} {
		b, err := os.ReadFile(p)
		if err != nil {
			t.Fatal(err)
		}
		if !strings.Contains(string(b), "133;A") {
			t.Fatalf("%s missing OSC 133: %s", p, b)
		}
	}
	zshrc, err := os.ReadFile(filepath.Join(dir, "zdot", ".zshrc"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(zshrc), "zsh.zsh") {
		t.Fatalf(".zshrc should source zsh.zsh: %s", zshrc)
	}
}

func TestWrapZshSetsZdotdir(t *testing.T) {
	args, env := Wrap("/bin/zsh", "/tmp/shellint", "/Users/ada")
	if len(args) != 0 {
		t.Fatalf("zsh args %v", args)
	}
	joined := strings.Join(env, "\n")
	if !strings.Contains(joined, "ZDOTDIR=/tmp/shellint/zdot") {
		t.Fatalf("env %v", env)
	}
	if !strings.Contains(joined, "QTERM_USER_ZDOTDIR=/Users/ada") {
		t.Fatalf("user zdot %v", env)
	}
}

func TestWrapBashRcfile(t *testing.T) {
	args, env := Wrap("/bin/bash", "/tmp/shellint", "")
	if len(args) != 2 || args[0] != "--rcfile" || !strings.HasSuffix(args[1], "bash.rc") {
		t.Fatalf("args %v", args)
	}
	if len(env) == 0 {
		t.Fatal("expected env")
	}
}

func TestWrapOtherShellNoop(t *testing.T) {
	args, env := Wrap("/bin/fish", "/tmp/shellint", "")
	if args != nil || env != nil {
		t.Fatalf("fish should be untouched: %v %v", args, env)
	}
}
