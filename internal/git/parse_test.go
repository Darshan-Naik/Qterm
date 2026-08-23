package git

import "testing"

func TestParseBranchLine(t *testing.T) {
	cases := []struct {
		in            string
		name, up      string
		ahead, behind int
	}{
		{"## main", "main", "", 0, 0},
		{"## main...origin/main", "main", "origin/main", 0, 0},
		{"## main...origin/main [ahead 2]", "main", "origin/main", 2, 0},
		{"## main...origin/main [behind 1]", "main", "origin/main", 0, 1},
		{"## main...origin/main [ahead 2, behind 1]", "main", "origin/main", 2, 1},
		{"## feature/foo...origin/feature/foo [ahead 1]", "feature/foo", "origin/feature/foo", 1, 0},
		{"## HEAD (no branch)", "HEAD", "", 0, 0},
		{"## No commits yet on main", "main", "", 0, 0},
		{"## Initial commit on main", "main", "", 0, 0},
	}
	for _, c := range cases {
		got := parseBranchLine(c.in)
		if got.Name != c.name || got.Upstream != c.up || got.Ahead != c.ahead || got.Behind != c.behind {
			t.Errorf("%q → %+v want name=%s up=%s +%d -%d", c.in, got, c.name, c.up, c.ahead, c.behind)
		}
	}
}

func TestParseFileLine(t *testing.T) {
	cases := []struct {
		in       string
		path     string
		code     string
		staged   bool
		unstaged bool
	}{
		{" M src/app.go", "src/app.go", " M", false, true},
		{"M  src/app.go", "src/app.go", "M ", true, false},
		{"MM src/app.go", "src/app.go", "MM", true, true},
		{"?? new.tsx", "new.tsx", "??", false, true},
		{"A  added.go", "added.go", "A ", true, false},
		{"D  gone.go", "gone.go", "D ", true, false},
		{"R  old.go -> new.go", "new.go", "R ", true, false},
		{`?? "file with spaces.txt"`, "file with spaces.txt", "??", false, true},
	}
	for _, c := range cases {
		got, ok := parseFileLine(c.in)
		if !ok {
			t.Errorf("%q: parse failed", c.in)
			continue
		}
		if got.Path != c.path || got.Code != c.code || got.Staged != c.staged || got.Unstaged != c.unstaged {
			t.Errorf("%q → %+v", c.in, got)
		}
	}
}

func TestParseStatus(t *testing.T) {
	out := "## main...origin/main [ahead 1, behind 2]\n M a.go\n?? b.ts\n"
	br, files := parseStatus(out)
	if br.Name != "main" || br.Ahead != 1 || br.Behind != 2 || br.Upstream != "origin/main" {
		t.Fatalf("branch %+v", br)
	}
	if len(files) != 2 {
		t.Fatalf("files %d", len(files))
	}
	if !files[0].Unstaged || files[0].Staged {
		t.Fatalf("a.go %+v", files[0])
	}
}

func TestNeedsUpstream(t *testing.T) {
	if !needsUpstream("fatal: The current branch main has no upstream branch.") {
		t.Fatal("expected match")
	}
	if needsUpstream("rejected (non-fast-forward)") {
		t.Fatal("should not match")
	}
}

func TestIsIndexLock(t *testing.T) {
	msg := "fatal: Unable to create '/tmp/repo/.git/index.lock': File exists."
	if !isIndexLock(msg) {
		t.Fatal("expected lock")
	}
	if isIndexLock("error: failed to push some refs") {
		t.Fatal("should not match")
	}
}

func TestParseStashList(t *testing.T) {
	out := "stash@{0}\x00WIP on main: abc\x002 minutes ago\nstash@{1}\x00fix login\x001 day ago\n"
	got := parseStashList(out)
	if len(got) != 2 || got[0].Ref != "stash@{0}" || got[1].Message != "fix login" {
		t.Fatalf("%+v", got)
	}
}

func TestParseWorktreeList(t *testing.T) {
	out := "worktree /repo\nHEAD abc\nbranch refs/heads/main\n\nworktree /repo-feat\nHEAD def\nbranch refs/heads/feat\nlocked\n"
	got := parseWorktreeList(out)
	if len(got) != 2 {
		t.Fatalf("%+v", got)
	}
	if !got[0].Main || got[0].Branch != "main" || got[0].Path != "/repo" {
		t.Fatalf("main %+v", got[0])
	}
	if got[1].Main || got[1].Branch != "feat" || !got[1].Locked {
		t.Fatalf("linked %+v", got[1])
	}
}

func TestStashRef(t *testing.T) {
	r, ok := stashRef("")
	if !ok || r != "stash@{0}" {
		t.Fatalf("%s %v", r, ok)
	}
	if _, ok := stashRef("main"); ok {
		t.Fatal("rejected")
	}
}
