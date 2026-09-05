package update

import (
	"os"
	"strings"
	"testing"
)

func TestAppBundleFromExecutable(t *testing.T) {
	path, ok := AppBundleFromExecutable("/Applications/Qterm.app/Contents/MacOS/q-term")
	if !ok || path != "/Applications/Qterm.app" {
		t.Fatalf("got %q %v", path, ok)
	}
	if _, ok := AppBundleFromExecutable("/usr/local/bin/q-term"); ok {
		t.Fatal("bare binary should not look like an app bundle")
	}
	nested, ok := AppBundleFromExecutable("/Users/me/Qterm.app/Contents/MacOS/q-term")
	if !ok || nested != "/Users/me/Qterm.app" {
		t.Fatalf("nested: %q %v", nested, ok)
	}
}

func TestApplyScript(t *testing.T) {
	s := ApplyScript()
	for _, need := range []string{"hdiutil attach", "ditto", "open", "Qterm.app", "kill -0"} {
		if !strings.Contains(s, need) {
			t.Fatalf("script missing %q", need)
		}
	}
}

func TestApplyAndRelaunchWithoutInstaller(t *testing.T) {
	err := ApplyAndRelaunch("")
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "missing") && !strings.Contains(err.Error(), "Mac app") {
		t.Fatalf("err = %v", err)
	}
}

func TestWriteApplyScript(t *testing.T) {
	dir := t.TempDir()
	path, err := writeApplyScript(dir)
	if err != nil {
		t.Fatal(err)
	}
	body, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(string(body), "#!/bin/bash") {
		t.Fatalf("prefix: %q", body[:12])
	}
}
