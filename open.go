package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

// IDEInfo is an installed editor from the Open in IDE catalog.
type IDEInfo struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}

type ide struct {
	id    string
	label string
	app   string
	clis  []string
}

// First installed in this order wins when DefaultIDE is empty.
var ideCatalog = []ide{
	{id: "cursor", label: "Cursor", app: "Cursor", clis: []string{"cursor"}},
	{id: "trae", label: "Trae", app: "Trae", clis: []string{"trae"}},
	{id: "vscode", label: "VS Code", app: "Visual Studio Code", clis: []string{"code"}},
	{id: "vscode-insiders", label: "VS Code Insiders", app: "Visual Studio Code - Insiders", clis: []string{"code-insiders"}},
	{id: "zed", label: "Zed", app: "Zed", clis: []string{"zed", "zeditor"}},
	{id: "antigravity", label: "Antigravity", app: "Antigravity IDE", clis: []string{"agy"}},
	{id: "windsurf", label: "Windsurf", app: "Windsurf", clis: []string{"windsurf"}},
	{id: "xcode", label: "Xcode", app: "Xcode", clis: []string{"xed"}},
}

func (a *App) OpenInFinder(path string) error {
	return exec.Command("open", path).Start()
}

func (a *App) ListIDEs() []IDEInfo {
	out := make([]IDEInfo, 0, len(ideCatalog))
	for _, e := range ideCatalog {
		if e.installed() {
			out = append(out, IDEInfo{ID: e.id, Label: e.label})
		}
	}
	return out
}

func (a *App) OpenInIDE(path string) error {
	if strings.TrimSpace(path) == "" {
		return fmt.Errorf("no folder to open")
	}
	id := ""
	if a.store != nil {
		id = strings.TrimSpace(a.store.Get().DefaultIDE)
	}
	e := resolveIDE(id)
	if e == nil {
		return fmt.Errorf("no IDE found")
	}
	return e.open(path)
}

func resolveIDE(id string) *ide {
	if id != "" {
		for i := range ideCatalog {
			if ideCatalog[i].matches(id) && ideCatalog[i].installed() {
				return &ideCatalog[i]
			}
		}
	}
	for i := range ideCatalog {
		if ideCatalog[i].installed() {
			return &ideCatalog[i]
		}
	}
	return nil
}

func (e ide) matches(id string) bool {
	return strings.EqualFold(e.id, id) || strings.EqualFold(e.app, id) || strings.EqualFold(e.label, id)
}

func (e ide) installed() bool {
	if e.appPath() != "" {
		return true
	}
	return e.cliPath() != ""
}

func (e ide) appPath() string {
	dirs := []string{"/Applications"}
	if home, err := os.UserHomeDir(); err == nil {
		dirs = append(dirs, filepath.Join(home, "Applications"))
	}
	for _, dir := range dirs {
		p := filepath.Join(dir, e.app+".app")
		if st, err := os.Stat(p); err == nil && st.IsDir() {
			return p
		}
	}
	return ""
}

func (e ide) cliPath() string {
	for _, name := range e.clis {
		if p, err := exec.LookPath(name); err == nil {
			return p
		}
	}
	return ""
}

func (e ide) open(path string) error {
	if e.appPath() != "" {
		return exec.Command("open", "-a", e.app, path).Start()
	}
	if p := e.cliPath(); p != "" {
		return exec.Command(p, path).Start()
	}
	if e.app != "" {
		return exec.Command("open", "-a", e.app, path).Start()
	}
	return fmt.Errorf("couldn't open %s", e.label)
}
