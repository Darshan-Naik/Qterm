package agentbridge

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
)

// RunMCP serves a minimal stdio MCP server that proxies tools to the Qterm bridge HTTP API.
// Invoke the Qterm binary with: qterm mcp
//
// When the MCP process inherits QTERM_SESSION_ID from the PTY (agent launched in that pane),
// every tool call forwards it as X-Qterm-Terminal-Id so the bridge can bind authoritatively.
// Outside Qterm (no QTERM_SESSION_ID), tools are hidden and calls refuse — cmux pattern.
func RunMCP() {
	url := os.Getenv("QTERM_BRIDGE_URL")
	token := os.Getenv("QTERM_BRIDGE_TOKEN")
	if dataDir := os.Getenv("QTERM_DATA_DIR"); dataDir != "" {
		if ep, err := ReadEndpoint(dataDir); err == nil {
			if url == "" {
				url = ep.URL
			}
			if token == "" {
				token = ep.Token
			}
		}
	}
	if url == "" {
		url = fmt.Sprintf("http://127.0.0.1:%d", DefaultPort)
	}
	terminalHint := strings.TrimSpace(os.Getenv("QTERM_SESSION_ID"))
	inQterm := terminalHint != ""

	br := bufio.NewReader(os.Stdin)
	for {
		line, err := br.ReadBytes('\n')
		if err != nil {
			return
		}
		line = bytes.TrimSpace(line)
		if len(line) == 0 {
			continue
		}
		var req map[string]any
		if err := json.Unmarshal(line, &req); err != nil {
			continue
		}
		id := req["id"]
		method, _ := req["method"].(string)
		switch method {
		case "initialize":
			writeMCPResult(id, map[string]any{
				"protocolVersion": "2024-11-05",
				"capabilities":    map[string]any{"tools": map[string]any{}},
				"serverInfo":      map[string]any{"name": "qterm", "version": "1.2.3"},
			})
		case "notifications/initialized", "initialized":
			// no-op
		case "tools/list":
			tools := []map[string]any{}
			if inQterm {
				tools = mcpTools()
			}
			writeMCPResult(id, map[string]any{"tools": tools})
		case "tools/call":
			if !inQterm {
				writeMCPResult(id, map[string]any{
					"content": []any{map[string]any{
						"type": "text",
						"text": "Qterm MCP only works inside a Qterm terminal pane (QTERM_SESSION_ID missing).",
					}},
					"isError": true,
				})
				break
			}
			params, _ := req["params"].(map[string]any)
			name, _ := params["name"].(string)
			args, _ := params["arguments"].(map[string]any)
			text, callErr := callTool(url, token, terminalHint, name, args)
			if callErr != nil {
				writeMCPResult(id, map[string]any{
					"content": []any{map[string]any{"type": "text", "text": callErr.Error()}},
					"isError": true,
				})
			} else {
				writeMCPResult(id, map[string]any{
					"content": []any{map[string]any{"type": "text", "text": text}},
				})
			}
		case "ping":
			writeMCPResult(id, map[string]any{})
		default:
			if id != nil {
				writeMCPErr(id, -32601, "method not found: "+method)
			}
		}
	}
}

func writeMCPResult(id any, result any) {
	msg := map[string]any{"jsonrpc": "2.0", "id": id, "result": result}
	b, _ := json.Marshal(msg)
	fmt.Printf("%s\n", b)
}

func writeMCPErr(id any, code int, message string) {
	msg := map[string]any{
		"jsonrpc": "2.0",
		"id":      id,
		"error":   map[string]any{"code": code, "message": message},
	}
	b, _ := json.Marshal(msg)
	fmt.Printf("%s\n", b)
}

func mcpTools() []map[string]any {
	return []map[string]any{
		tool("get_terminal_id", "Return the Qterm terminal id for THIS agent pane (id, name, projectId, cwd). Call this first, then pass id on rename/create/focus. Do not guess from UI focus.", map[string]any{
			"type":       "object",
			"properties": map[string]any{},
		}),
		tool("create_terminal", "Create a new terminal in Qterm. Omit projectId/cwd to create in the same project as this agent.", map[string]any{
			"type": "object",
			"properties": map[string]any{
				"projectId": map[string]any{"type": "string", "description": "Qterm project id from list_projects / get_terminal_id"},
				"name":      map[string]any{"type": "string"},
				"cwd":       map[string]any{"type": "string"},
			},
		}),
		tool("rename_terminal", "Rename a Qterm terminal. Prefer id from get_terminal_id. NEVER use printf/OSC.", map[string]any{
			"type":     "object",
			"required": []any{"name"},
			"properties": map[string]any{
				"id":         map[string]any{"type": "string", "description": "Terminal id from get_terminal_id"},
				"terminalId": map[string]any{"type": "string", "description": "Alias for id"},
				"name":       map[string]any{"type": "string"},
			},
		}),
		tool("list_terminals", "List Qterm terminals", map[string]any{"type": "object", "properties": map[string]any{}}),
		tool("focus_terminal", "Focus a Qterm terminal pane", map[string]any{
			"type":     "object",
			"required": []any{"id"},
			"properties": map[string]any{
				"id":         map[string]any{"type": "string"},
				"terminalId": map[string]any{"type": "string"},
			},
		}),
		tool("create_project", "Add a project folder to Qterm", map[string]any{
			"type":     "object",
			"required": []any{"path"},
			"properties": map[string]any{
				"path": map[string]any{"type": "string"},
				"name": map[string]any{"type": "string"},
			},
		}),
		tool("rename_project", "Rename a Qterm project", map[string]any{
			"type":     "object",
			"required": []any{"id", "name"},
			"properties": map[string]any{
				"id":   map[string]any{"type": "string"},
				"name": map[string]any{"type": "string"},
			},
		}),
		tool("list_projects", "List Qterm projects", map[string]any{"type": "object", "properties": map[string]any{}}),
		tool("set_theme", "Change Qterm theme (system|dark|light)", map[string]any{
			"type":     "object",
			"required": []any{"theme"},
			"properties": map[string]any{
				"theme": map[string]any{"type": "string"},
			},
		}),
		tool("get_theme", "Get current Qterm theme", map[string]any{"type": "object", "properties": map[string]any{}}),
	}
}

func tool(name, desc string, schema map[string]any) map[string]any {
	return map[string]any{
		"name":        name,
		"description": desc,
		"inputSchema": schema,
	}
}

func argString(args map[string]any, keys ...string) string {
	for _, k := range keys {
		if v, ok := args[k].(string); ok && strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

func callTool(base, token, terminalHint, name string, args map[string]any) (string, error) {
	if args == nil {
		args = map[string]any{}
	}
	var method, path string
	var body any
	switch name {
	case "get_terminal_id":
		method, path = http.MethodGet, "/v1/tools/terminals/self"
	case "list_terminals":
		method, path = http.MethodGet, "/v1/tools/terminals"
	case "create_terminal":
		method, path, body = http.MethodPost, "/v1/tools/terminals", args
	case "rename_terminal":
		id := argString(args, "id", "terminalId")
		if id == "" {
			id = "focused"
		}
		method, path, body = http.MethodPost, "/v1/tools/terminals/"+id+"/rename", map[string]any{"name": args["name"]}
	case "focus_terminal":
		id := argString(args, "id", "terminalId")
		method, path = http.MethodPost, "/v1/tools/terminals/"+id+"/focus"
		body = map[string]any{}
	case "list_projects":
		method, path = http.MethodGet, "/v1/tools/projects"
	case "create_project":
		method, path, body = http.MethodPost, "/v1/tools/projects", args
	case "rename_project":
		id := argString(args, "id")
		method, path, body = http.MethodPost, "/v1/tools/projects/"+id+"/rename", map[string]any{"name": args["name"]}
	case "get_theme":
		method, path = http.MethodGet, "/v1/tools/theme"
	case "set_theme":
		method, path, body = http.MethodPost, "/v1/tools/theme", args
	default:
		return "", fmt.Errorf("unknown tool %s", name)
	}

	var rdr io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		rdr = bytes.NewReader(b)
	}
	req, err := http.NewRequest(method, strings.TrimRight(base, "/")+path, rdr)
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	// Prefer explicit arg, else PTY-inherited QTERM_SESSION_ID.
	hint := argString(args, "id", "terminalId")
	if hint == "" || hint == "focused" {
		hint = terminalHint
	}
	if hint != "" && hint != "focused" {
		req.Header.Set("X-Qterm-Terminal-Id", hint)
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("Qterm is not running or bridge unreachable: %w", err)
	}
	defer res.Body.Close()
	out, _ := io.ReadAll(res.Body)
	if res.StatusCode >= 300 {
		return "", fmt.Errorf("bridge error: %s", string(out))
	}
	return string(out), nil
}
