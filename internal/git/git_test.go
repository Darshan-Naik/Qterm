package git

import (
	"os"
	"os/exec"
	"path/filepath"
	"testing"
)

func gitAvail(t *testing.T) {
	t.Helper()
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git not installed")
	}
}

func gitCmd(t *testing.T, dir string, args ...string) {
	t.Helper()
	cmd := exec.Command("git", args...)
	cmd.Dir = dir
	cmd.Env = append(os.Environ(), "GIT_AUTHOR_NAME=t", "GIT_AUTHOR_EMAIL=t@t", "GIT_COMMITTER_NAME=t", "GIT_COMMITTER_EMAIL=t@t")
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("git %v: %v\n%s", args, err, out)
	}
}

func TestProbeAndSnapshot(t *testing.T) {
	gitAvail(t)
	dir := t.TempDir()
	gitCmd(t, dir, "init", "-b", "main")
	gitCmd(t, dir, "config", "user.email", "t@t")
	gitCmd(t, dir, "config", "user.name", "t")

	st := Probe(dir)
	if !st.IsRepo {
		t.Fatal("expected repo")
	}
	if st.Branch != "main" {
		t.Fatalf("branch %q", st.Branch)
	}
	if st.Dirty {
		t.Fatal("empty repo should be clean")
	}

	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte("hi"), 0o644); err != nil {
		t.Fatal(err)
	}
	st = Probe(dir)
	if !st.Dirty {
		t.Fatal("expected dirty")
	}

	snap := LoadSnapshot(dir)
	if len(snap.Files) != 1 || snap.Files[0].Path != "a.txt" || snap.Files[0].Code != "??" {
		t.Fatalf("files %+v", snap.Files)
	}

	r := Stage(dir, "a.txt")
	if !r.OK {
		t.Fatalf("stage: %+v", r)
	}
	r = Commit(dir, "first")
	if !r.OK {
		t.Fatalf("commit: %+v", r)
	}
	st = Probe(dir)
	if st.Dirty {
		t.Fatal("committed should be clean")
	}

	r = CreateBranch(dir, "feature")
	if !r.OK {
		t.Fatalf("create: %+v", r)
	}
	br := ListBranches(dir)
	if len(br) != 2 {
		t.Fatalf("branches %+v", br)
	}
	r = Checkout(dir, "main")
	if !r.OK {
		t.Fatalf("checkout: %+v", r)
	}
	if Probe(dir).Branch != "main" {
		t.Fatalf("want main, got %s", Probe(dir).Branch)
	}

	r = DeleteBranch(dir, "feature", false)
	if !r.OK {
		t.Fatalf("delete: %+v", r)
	}
	if len(ListBranches(dir)) != 1 {
		t.Fatalf("branches after delete %+v", ListBranches(dir))
	}
	r = DeleteBranch(dir, "main", false)
	if r.OK {
		t.Fatal("should not delete current")
	}
}

func TestStashAndPop(t *testing.T) {
	gitAvail(t)
	dir := t.TempDir()
	gitCmd(t, dir, "init", "-b", "main")
	gitCmd(t, dir, "config", "user.email", "t@t")
	gitCmd(t, dir, "config", "user.name", "t")
	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte("hi"), 0o644); err != nil {
		t.Fatal(err)
	}
	gitCmd(t, dir, "add", "a.txt")
	gitCmd(t, dir, "commit", "-m", "first")
	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte("edit"), 0o644); err != nil {
		t.Fatal(err)
	}
	r := Stash(dir, "wip")
	if !r.OK {
		t.Fatalf("stash: %+v", r)
	}
	if Probe(dir).Dirty {
		t.Fatal("expected clean after stash")
	}
	list := ListStashes(dir)
	if len(list) != 1 || list[0].Ref != "stash@{0}" {
		t.Fatalf("stashes %+v", list)
	}
	if LoadSnapshot(dir).StashCount != 1 {
		t.Fatal("stashCount")
	}
	r = StashPop(dir, "")
	if !r.OK {
		t.Fatalf("pop: %+v", r)
	}
	if !Probe(dir).Dirty {
		t.Fatal("expected dirty after pop")
	}
}

func TestCommitEmptyMessage(t *testing.T) {
	r := Commit("/tmp", "  ")
	if r.OK || r.Stderr == "" {
		t.Fatalf("%+v", r)
	}
}

func TestProbeNonRepo(t *testing.T) {
	dir := t.TempDir()
	st := Probe(dir)
	if st.IsRepo {
		t.Fatal("not a repo")
	}
	st = Probe("")
	if st.IsRepo {
		t.Fatal("empty path")
	}
}

func TestWorktreeAddListRemove(t *testing.T) {
	gitAvail(t)
	dir := t.TempDir()
	gitCmd(t, dir, "init", "-b", "main")
	gitCmd(t, dir, "config", "user.email", "t@t")
	gitCmd(t, dir, "config", "user.name", "t")
	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte("hi"), 0o644); err != nil {
		t.Fatal(err)
	}
	gitCmd(t, dir, "add", "a.txt")
	gitCmd(t, dir, "commit", "-m", "first")

	list := ListWorktrees(dir)
	if len(list) != 1 || !list[0].Main {
		t.Fatalf("main %+v", list)
	}

	added := AddWorktree(dir, "feat wt")
	if !added.OK || added.Path == "" {
		t.Fatalf("add %+v", added)
	}
	list = ListWorktrees(dir)
	if len(list) != 2 {
		t.Fatalf("after add %+v", list)
	}
	var linked Worktree
	for _, wt := range list {
		if !wt.Main {
			linked = wt
		}
	}
	if linked.Branch != "feat-wt" {
		t.Fatalf("branch %+v", linked)
	}
	if Probe(added.Path).Branch != "feat-wt" {
		t.Fatalf("probe %s", Probe(added.Path).Branch)
	}

	r := RemoveWorktree(dir, list[0].Path, false)
	if r.OK {
		t.Fatal("should not remove main")
	}
	r = RemoveWorktree(dir, linked.Path, false)
	if !r.OK {
		t.Fatalf("remove %+v", r)
	}
	if len(ListWorktrees(dir)) != 1 {
		t.Fatalf("after remove %+v", ListWorktrees(dir))
	}

	bad := AddWorktree(dir, "@")
	if bad.OK {
		t.Fatalf("invalid %+v", bad)
	}

	cased := AddWorktree(dir, "CasePath")
	if !cased.OK {
		t.Fatalf("add case %+v", cased)
	}
	if !samePath(worktreeSiblingPath(dir, "casepath"), cased.Path) {
		return
	}
	again := AddWorktree(dir, "casepath")
	if !again.OK || !samePath(again.Path, cased.Path) {
		t.Fatalf("attach case-fold %+v vs %+v", again, cased)
	}
}

func TestUnstageAllAndDiscardAll(t *testing.T) {
	gitAvail(t)
	dir := t.TempDir()
	gitCmd(t, dir, "init", "-b", "main")
	gitCmd(t, dir, "config", "user.email", "t@t")
	gitCmd(t, dir, "config", "user.name", "t")
	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte("hi"), 0o644); err != nil {
		t.Fatal(err)
	}
	gitCmd(t, dir, "add", "a.txt")
	gitCmd(t, dir, "commit", "-m", "first")
	if err := os.WriteFile(filepath.Join(dir, "a.txt"), []byte("bye"), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "b.txt"), []byte("new"), 0o644); err != nil {
		t.Fatal(err)
	}
	if r := StageAll(dir); !r.OK {
		t.Fatalf("stage all %+v", r)
	}
	if r := UnstageAll(dir); !r.OK {
		t.Fatalf("unstage all %+v", r)
	}
	snap := LoadSnapshot(dir)
	if !snap.Dirty {
		t.Fatal("expected dirty after unstage")
	}
	if r := DiscardAll(dir); !r.OK {
		t.Fatalf("discard all %+v", r)
	}
	st := Probe(dir)
	if st.Dirty {
		t.Fatal("expected clean after discard all")
	}
}
