// Package qtcli is the `q-term` subcommand surface for scripting and agent hooks.
// It talks to the running app over the local HTTP bridge (same auth as MCP).
package qtcli

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"qterm/internal/agentcli/core"
	"qterm/internal/appmode"
)

// Run dispatches CLI subcommands. argv is os.Args[1:] (first is the command).
// Returns a process exit code.
func Run(argv []string) int {
	if len(argv) == 0 {
		printUsage(os.Stderr)
		return 2
	}
	cmd := strings.ToLower(argv[0])
	args := argv[1:]
	switch cmd {
	case "help", "-h", "--help":
		printUsage(os.Stdout)
		return 0
	case "mcp":
		// Handled by main before Run; keep listed in help.
		fmt.Fprintln(os.Stderr, "mcp is handled by the app entrypoint")
		return 2
	case "notify":
		return cmdNotify(args)
	case "list", "list-terminals":
		return cmdList(args)
	case "focus":
		return cmdFocus(args)
	case "split":
		return cmdSplit(args)
	case "jump-unread", "unread":
		return cmdJumpUnread(args)
	case "create":
		return cmdCreate(args)
	case "write":
		return cmdWrite(args)
	default:
		fmt.Fprintf(os.Stderr, "unknown command %q\n\n", cmd)
		printUsage(os.Stderr)
		return 2
	}
}

func printUsage(w io.Writer) {
	fmt.Fprintf(w, `q-term: control a running Qterm window

Usage:
  q-term <command> [flags]

Commands:
  notify [message]     Ring attention on a pane (OSC-style notify for hooks)
  list                 List terminals
  focus <id>           Focus a terminal
  split [right|down]   Split beside this / a pane and create a sibling
  jump-unread          Jump to the most recent needs-input / notify pane
  create               Create a terminal (--name, --cwd, --project)
  write <text>         Type into a terminal (--id, --submit)
  mcp                  Stdio MCP server (agents inside Qterm panes)

Environment:
  QTERM_SESSION_ID     Bound pane id (set automatically inside Qterm PTYs)
  QTERM_DATA_DIR       Override Application Support data dir
  QTERM_BRIDGE_URL     Override bridge URL
  QTERM_BRIDGE_TOKEN   Override bridge token

Examples:
  q-term notify "Claude is waiting for input"
  q-term notify --title Build --body "tests green"
  q-term jump-unread
  q-term split right
  q-term focus <id>
`)
}

type client struct {
	url    string
	token  string
	termID string
}

func newClient() (*client, error) {
	c := &client{
		url:    strings.TrimSpace(os.Getenv("QTERM_BRIDGE_URL")),
		token:  strings.TrimSpace(os.Getenv("QTERM_BRIDGE_TOKEN")),
		termID: strings.TrimSpace(os.Getenv("QTERM_SESSION_ID")),
	}
	dataDir := strings.TrimSpace(os.Getenv("QTERM_DATA_DIR"))
	if dataDir == "" {
		cfg, err := os.UserConfigDir()
		if err != nil {
			return nil, err
		}
		dataDir = filepath.Join(cfg, appmode.DataDir)
	}
	if ep, err := core.ReadEndpoint(dataDir); err == nil {
		if c.url == "" {
			c.url = ep.URL
		}
		if c.token == "" {
			c.token = ep.Token
		}
	}
	if c.url == "" {
		c.url = fmt.Sprintf("http://127.0.0.1:%d", core.DefaultPort)
	}
	if c.token == "" {
		return nil, fmt.Errorf("no bridge token (is Qterm running? tried %s)", core.EndpointPath(dataDir))
	}
	return c, nil
}

func (c *client) do(method, path string, body any) (string, error) {
	var rdr io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return "", err
		}
		rdr = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, strings.TrimRight(c.url, "/")+path, rdr)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if c.termID != "" {
		req.Header.Set("X-Qterm-Terminal-Id", c.termID)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("Qterm is not running or bridge unreachable: %w", err)
	}
	defer res.Body.Close()
	out, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 300 {
		return "", fmt.Errorf("bridge error (%d): %s", res.StatusCode, strings.TrimSpace(string(out)))
	}
	return string(out), nil
}

func flagValue(args []string, names ...string) (string, []string) {
	out := make([]string, 0, len(args))
	var val string
	for i := 0; i < len(args); i++ {
		a := args[i]
		matched := false
		for _, name := range names {
			if a == name && i+1 < len(args) {
				val = args[i+1]
				i++
				matched = true
				break
			}
			if strings.HasPrefix(a, name+"=") {
				val = strings.TrimPrefix(a, name+"=")
				matched = true
				break
			}
		}
		if !matched {
			out = append(out, a)
		}
	}
	return val, out
}

func hasFlag(args []string, names ...string) ([]string, bool) {
	out := make([]string, 0, len(args))
	found := false
	for _, a := range args {
		hit := false
		for _, name := range names {
			if a == name {
				found = true
				hit = true
				break
			}
		}
		if !hit {
			out = append(out, a)
		}
	}
	return out, found
}

func cmdNotify(args []string) int {
	title, args := flagValue(args, "--title", "-t")
	body, args := flagValue(args, "--body", "-b", "--message", "-m")
	id, args := flagValue(args, "--id", "--session")
	args, focus := hasFlag(args, "--focus")
	if body == "" && len(args) > 0 {
		body = strings.Join(args, " ")
		args = nil
	}
	if body == "" && title == "" {
		fmt.Fprintln(os.Stderr, "usage: q-term notify [--title T] [--body B] [--id ID] [--focus] [message]")
		return 2
	}
	if body == "" {
		body = title
		title = ""
	}
	c, err := newClient()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	if id != "" {
		c.termID = id
	}
	payload := map[string]any{
		"title": title,
		"body":  body,
		"id":    c.termID,
		"focus": focus,
	}
	out, err := c.do(http.MethodPost, "/v1/tools/notify", payload)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	fmt.Println(strings.TrimSpace(out))
	return 0
}

func cmdList(args []string) int {
	c, err := newClient()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	out, err := c.do(http.MethodGet, "/v1/tools/terminals", nil)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	fmt.Println(strings.TrimSpace(out))
	return 0
}

func cmdFocus(args []string) int {
	id := ""
	if len(args) > 0 {
		id = args[0]
	}
	c, err := newClient()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	if id == "" {
		id = c.termID
	}
	if id == "" {
		fmt.Fprintln(os.Stderr, "usage: q-term focus <id>")
		return 2
	}
	out, err := c.do(http.MethodPost, "/v1/tools/terminals/"+id+"/focus", map[string]any{})
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	fmt.Println(strings.TrimSpace(out))
	return 0
}

func cmdSplit(args []string) int {
	dir := "right"
	id, args := flagValue(args, "--id")
	name, args := flagValue(args, "--name")
	if len(args) > 0 {
		dir = args[0]
	}
	c, err := newClient()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	if id == "" {
		id = c.termID
	}
	if id == "" {
		id = "focused"
	}
	payload := map[string]any{"direction": dir, "name": name}
	out, err := c.do(http.MethodPost, "/v1/tools/terminals/"+id+"/split", payload)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	fmt.Println(strings.TrimSpace(out))
	return 0
}

func cmdJumpUnread(args []string) int {
	c, err := newClient()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	out, err := c.do(http.MethodPost, "/v1/tools/jump-unread", map[string]any{})
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	fmt.Println(strings.TrimSpace(out))
	return 0
}

func cmdCreate(args []string) int {
	name, args := flagValue(args, "--name", "-n")
	cwd, args := flagValue(args, "--cwd", "-C")
	project, args := flagValue(args, "--project", "-p")
	c, err := newClient()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	payload := map[string]any{"name": name, "cwd": cwd, "projectId": project}
	out, err := c.do(http.MethodPost, "/v1/tools/terminals", payload)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	fmt.Println(strings.TrimSpace(out))
	return 0
}

func cmdWrite(args []string) int {
	id, args := flagValue(args, "--id")
	args, submit := hasFlag(args, "--submit", "-s")
	text := strings.Join(args, " ")
	if text == "" {
		fmt.Fprintln(os.Stderr, "usage: q-term write [--id ID] [--submit] <text>")
		return 2
	}
	c, err := newClient()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	if id == "" {
		id = c.termID
	}
	if id == "" {
		id = "focused"
	}
	payload := map[string]any{"data": text, "submit": submit}
	out, err := c.do(http.MethodPost, "/v1/tools/terminals/"+id+"/write", payload)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	fmt.Println(strings.TrimSpace(out))
	return 0
}
