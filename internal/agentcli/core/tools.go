package core

import (
	"bytes"
	"context"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// ToolKind classifies a managed agent tool entry.
type ToolKind string

const (
	ToolKindPlugin      ToolKind = "plugin"
	ToolKindSkill       ToolKind = "skill"
	ToolKindMarketplace ToolKind = "marketplace"
	ToolKindMCP         ToolKind = "mcp"
	ToolKindExtension   ToolKind = "extension"
)

// ToolItem is one installed (or registered) tool/plugin/skill/marketplace/MCP entry.
type ToolItem struct {
	ID           string     `json:"id"`
	Name         string     `json:"name"`
	Kind         ToolKind   `json:"kind"`
	Version      string     `json:"version,omitempty"`
	Source       string     `json:"source,omitempty"`
	Description  string     `json:"description,omitempty"`
	Enabled      bool       `json:"enabled"`
	Scope        string     `json:"scope,omitempty"`
	System       bool       `json:"system,omitempty"`    // qterm bridge — manage via Connect/Disconnect
	Available    bool       `json:"available,omitempty"` // marketplace catalog entry (not installed)
	InstallCount int        `json:"installCount,omitempty"`
	ManagedBy    string     `json:"managedBy,omitempty"` // parent plugin id when owned by a plugin
	Skills       []ToolPart `json:"skills,omitempty"`
	Hooks        []ToolPart `json:"hooks,omitempty"`
	Agents       []ToolPart `json:"agents,omitempty"`
	MCPServers   []ToolPart `json:"mcpServers,omitempty"`
}

// ToolPart is a nested skill / hook / agent / MCP entry under a plugin.
type ToolPart struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
}

// ToolsCaps describes what management ops a CLI supports.
type ToolsCaps struct {
	List               bool       `json:"list"`
	Install            bool       `json:"install"`
	Uninstall          bool       `json:"uninstall"`
	Enable             bool       `json:"enable"`
	Update             bool       `json:"update"`
	Browse             bool       `json:"browse"` // marketplace catalog of available plugins
	Kinds              []ToolKind `json:"kinds"`
	InstallPlaceholder string     `json:"installPlaceholder,omitempty"`
	Hint               string     `json:"hint,omitempty"`
}

// Tooling is an optional adapter surface for third-party plugin/skill management.
// Adapters that do not implement it are treated as unsupported in Settings.
type Tooling interface {
	ToolsCaps() ToolsCaps
	ListTools() ([]ToolItem, error)
	InstallTool(kind ToolKind, source string) error
	UninstallTool(kind ToolKind, id string) error
	SetToolEnabled(kind ToolKind, id string, enabled bool) error
	UpdateTool(kind ToolKind, id string) error
}

// DefaultToolsTimeout is the max wait for CLI plugin/skill subprocesses.
const DefaultToolsTimeout = 30 * time.Second

// ErrToolsUnsupported is returned when an adapter does not implement Tooling
// or does not support a specific kind/op.
var ErrToolsUnsupported = fmt.Errorf("agent tools management not supported")

// ErrQtermSystemTool is returned when mutating the qterm bridge plugin via Tools UI.
var ErrQtermSystemTool = fmt.Errorf("manage the Qterm bridge via Connect / Disconnect, not Tools")

// IsQtermToolID reports whether id refers to the qterm bridge plugin (any naming form).
func IsQtermToolID(id string) bool {
	s := strings.ToLower(strings.TrimSpace(id))
	if s == "" {
		return false
	}
	if s == PluginName || s == "qterm-terminal" {
		return true
	}
	// name@marketplace forms
	if before, _, ok := strings.Cut(s, "@"); ok && before == PluginName {
		return true
	}
	return strings.HasPrefix(s, PluginName+"/") || strings.Contains(s, "/"+PluginName)
}

// GuardQtermSystem blocks uninstall/disable/update of the qterm bridge plugin.
func GuardQtermSystem(id string) error {
	if IsQtermToolID(id) {
		return ErrQtermSystemTool
	}
	return nil
}

// RunCLI runs binary with args. On success it returns trimmed stdout (stderr is
// ignored unless stdout is empty, so CLI warnings don't corrupt JSON payloads).
// On failure it returns combined stdout+stderr for diagnostics.
func RunCLI(timeout time.Duration, binary string, args ...string) (string, error) {
	if timeout <= 0 {
		timeout = DefaultToolsTimeout
	}
	EnsureUserPath()
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, binary, args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	err := cmd.Run()
	out := strings.TrimSpace(stdout.String())
	errOut := strings.TrimSpace(stderr.String())
	combined := out
	if errOut != "" {
		if combined != "" {
			combined += "\n" + errOut
		} else {
			combined = errOut
		}
	}
	if ctx.Err() == context.DeadlineExceeded {
		return combined, fmt.Errorf("%s timed out after %s", binary, timeout)
	}
	if err != nil {
		if combined != "" {
			return combined, fmt.Errorf("%s: %w\n%s", binary, err, combined)
		}
		return combined, fmt.Errorf("%s: %w", binary, err)
	}
	if out != "" {
		return out, nil
	}
	return errOut, nil
}

// ExtractJSON returns the first JSON object/array payload in s.
// Useful when CLIs print warnings before JSON.
func ExtractJSON(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return s
	}
	if s[0] == '{' || s[0] == '[' {
		return s
	}
	obj := strings.IndexByte(s, '{')
	arr := strings.IndexByte(s, '[')
	i := -1
	switch {
	case obj >= 0 && arr >= 0:
		if obj < arr {
			i = obj
		} else {
			i = arr
		}
	case obj >= 0:
		i = obj
	case arr >= 0:
		i = arr
	}
	if i < 0 {
		return s
	}
	return strings.TrimSpace(s[i:])
}

// FirstBinary returns the first of names found on PATH.
func FirstBinary(names ...string) (string, error) {
	path, ok := LookPath(names)
	if !ok {
		return "", fmt.Errorf("%s not found on PATH", strings.Join(names, "/"))
	}
	return path, nil
}
