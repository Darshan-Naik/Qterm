package core

import (
	"fmt"
	"os/exec"
)

// Adapter is one agent CLI integration (install, hooks, sessions).
type Adapter interface {
	ID() string
	Name() string
	Binaries() []string
	Available() (path string, ok bool)
	Installed() bool
	Install(ctx InstallCtx) (InstallResult, error)
	Uninstall(ctx InstallCtx) error
	RelayPath() string
	MapHook(raw map[string]any) []Intent
	ListSessions(q SessionQuery) ([]Session, error)
	Resume(sessionID string) (ResumeSpec, error)
}

// InstallCtx is shared state for plugin install/uninstall (relay path, token, MCP binary).
type InstallCtx struct {
	DataDir    string
	RelayPath  string
	Token      string
	MCPCommand string
}

// InstallResult is returned after connecting or updating a CLI plugin.
type InstallResult struct {
	CLI       string `json:"cli"`
	Installed bool   `json:"installed"`
	Message   string `json:"message"`
}

// CLIInfo describes one agent CLI for the settings / connect UI.
type CLIInfo struct {
	ID              string `json:"id"`
	Name            string `json:"name"`
	Available       bool   `json:"available"`
	Path            string `json:"path"`
	Installed       bool   `json:"installed"`
	Version         string `json:"version,omitempty"`         // version recorded when last connected/updated
	ExpectedVersion string `json:"expectedVersion,omitempty"` // app's current qterm plugin version
	Outdated        bool   `json:"outdated,omitempty"`        // installed but version != expected
}

// Session is one resumable conversation from an agent CLI's on-disk history.
type Session struct {
	ID        string `json:"id"`
	CLI       string `json:"cli"`
	CLIName   string `json:"cliName"`
	Title     string `json:"title"`
	Cwd       string `json:"cwd,omitempty"`
	Preview   string `json:"preview,omitempty"` // title or matching prompt body snippet
	UpdatedAt int64  `json:"updatedAt"`         // unix milliseconds
	Match     string `json:"match,omitempty"`   // "title" | "body" | ""
	Score     int    `json:"-"`                 // ranking (higher first)
}

// SessionQuery filters agent session history.
type SessionQuery struct {
	Query string // substring; empty = recent list. Matches title (preferred) or prompt body.
	CLI   string // optional plugin id filter (used by aggregator)
	Limit int    // default 80
}

// ResumeSpec describes how to resume an agent session in a PTY.
type ResumeSpec struct {
	CLI       string `json:"cli"`
	SessionID string `json:"sessionId"`
	Title     string `json:"title"`
	Cwd       string `json:"cwd,omitempty"`
	Command   string `json:"command"` // shell command, no trailing newline
}

// ApplyConnectionVersion stamps the recorded connect version onto CLIInfo and marks outdated.
// Empty recorded version while installed means a pre-versioning connect — treat as outdated.
func (info *CLIInfo) ApplyConnectionVersion(recorded string) {
	info.ExpectedVersion = PluginVersion()
	if !info.Installed {
		info.Version = ""
		info.Outdated = false
		return
	}
	info.Version = recorded
	info.Outdated = recorded != PluginVersion()
}

// LookPath finds the first binary on PATH from the given names.
// Ensures the GUI process PATH has been enriched before searching.
func LookPath(binaries []string) (path string, ok bool) {
	EnsureUserPath()
	for _, bin := range binaries {
		if path, err := exec.LookPath(bin); err == nil {
			return path, true
		}
	}
	return "", false
}

// RequireCLI returns an error if no binary for the adapter is on PATH.
func RequireCLI(a Adapter) error {
	if _, ok := a.Available(); !ok {
		return fmt.Errorf("%s CLI not found on PATH — install it first", a.Name())
	}
	return nil
}

// MapHookDefault maps a hook payload using common field names shared by most CLIs
// (hook_event_name / session_id / cwd). Adapters with different schemas should
// build ParseInput themselves and call ParseHook.
func MapHookDefault(source, name string, raw map[string]any) []Intent {
	return ParseHook(ParseInput{
		Source:    source,
		Title:     name,
		Event:     FirstString(raw, "hook_event_name", "hookEventName", "event", "name"),
		SessionID: FirstString(raw, "session_id", "sessionId"),
		Cwd:       FirstString(raw, "cwd", "Cwd"),
		Raw:       raw,
	})
}

// ErrSessionsUnsupported is returned by stub ListSessions implementations.
var ErrSessionsUnsupported = fmt.Errorf("session history not implemented")

// ErrResumeUnsupported is returned by stub Resume implementations.
var ErrResumeUnsupported = fmt.Errorf("session resume not implemented")
