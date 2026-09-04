package procs

import "testing"

func TestParsePSAndDescendants(t *testing.T) {
	in := []byte("" +
		"  1  0 /sbin/launchd\n" +
		"100  1 /bin/zsh\n" +
		"101 100 /Users/x/.local/bin/codex\n" +
		"102 101 codex-worker\n" +
		"200  1 /bin/zsh\n" +
		"201 200 node /Users/x/.nvm/versions/node/v22/bin/claude\n")
	all := parsePS(in)
	if len(all) != 6 {
		t.Fatalf("got %d procs", len(all))
	}
	kids := Descendants(100, all)
	if len(kids) != 2 {
		t.Fatalf("descendants of 100: %v", kids)
	}
	if !MatchBinary(Proc{Comm: "codex"}, []string{"codex"}) {
		t.Fatal("codex should match")
	}
	if !MatchBinary(all[5], []string{"claude"}) {
		t.Fatalf("node …/claude should match: %+v", all[5])
	}
	if MatchBinary(Proc{Comm: "node", Args: "node server.js"}, []string{"claude"}) {
		t.Fatal("unrelated node should not match claude")
	}
}

func TestActiveCommands(t *testing.T) {
	in := []byte("" +
		"100  1 /bin/zsh\n" +
		"101 100 /Users/x/.local/bin/codex\n" +
		"102 101 codex-worker\n" +
		"200  1 /bin/zsh\n" +
		"201 200 node /Users/x/.nvm/versions/node/v22/bin/claude\n" +
		"300  1 /bin/zsh\n" +
		"301 300 -zsh\n")
	all := parsePS(in)

	got := ActiveCommands(100, all)
	if len(got) != 2 || got[0] != "codex" || got[1] != "codex-worker" {
		t.Fatalf("codex tree: %v", got)
	}
	got = ActiveCommands(200, all)
	if len(got) != 1 || got[0] != "claude" {
		t.Fatalf("node claude: %v", got)
	}
	if kids := ActiveCommands(300, all); len(kids) != 0 {
		t.Fatalf("nested zsh should be idle: %v", kids)
	}
	if kids := ActiveCommands(0, all); kids != nil {
		t.Fatalf("pid 0: %v", kids)
	}
}
