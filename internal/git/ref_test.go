package git

import "testing"

func TestNormalizeBranchName(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"test branch create", "test-branch-create"},
		{"  feature/foo  ", "feature/foo"},
		{"foo..bar", "foo-bar"},
		{"foo@{bar", "foo-bar"},
		{"weird~name^here", "weird-name-here"},
		{"", ""},
		{"---", ""},
		{"foo lock.lock", "foo-lock"},
	}
	for _, c := range cases {
		got := NormalizeBranchName(c.in)
		if got != c.want {
			t.Errorf("NormalizeBranchName(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestValidBranchName(t *testing.T) {
	ok := []string{"main", "feature/foo", "test-branch-create", "v1.2.3"}
	bad := []string{"", "@", "has space", "foo..bar", "foo@{bar", ".hidden", "ends.", "foo.lock", "a~b", "a:b"}
	for _, n := range ok {
		if !ValidBranchName(n) {
			t.Errorf("%q should be valid", n)
		}
	}
	for _, n := range bad {
		if ValidBranchName(n) {
			t.Errorf("%q should be invalid", n)
		}
	}
}

func TestCreateBranchRejectsInvalid(t *testing.T) {
	r := CreateBranch("/tmp", "   ")
	if r.OK || r.Stderr != invalidBranchMsg {
		t.Fatalf("%+v", r)
	}
	r = CreateBranch("/tmp", "@")
	if r.OK || r.Stderr != invalidBranchMsg {
		t.Fatalf("%+v", r)
	}
}
