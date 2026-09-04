package procs

import (
	"bufio"
	"bytes"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

// Proc is one OS process row.
type Proc struct {
	PID  int
	PPID int
	Comm string // executable name (basename)
	Args string // full command line when available
}

// List returns pid/ppid/comm for running processes (best-effort).
func List() ([]Proc, error) {
	return listOS()
}

// Descendants returns PIDs under root (not including root), BFS.
func Descendants(root int, all []Proc) []Proc {
	byParent := make(map[int][]Proc, len(all))
	for _, p := range all {
		byParent[p.PPID] = append(byParent[p.PPID], p)
	}
	out := make([]Proc, 0, 8)
	queue := []int{root}
	seen := map[int]struct{}{root: {}}
	for len(queue) > 0 {
		pid := queue[0]
		queue = queue[1:]
		for _, child := range byParent[pid] {
			if _, ok := seen[child.PID]; ok {
				continue
			}
			seen[child.PID] = struct{}{}
			out = append(out, child)
			queue = append(queue, child.PID)
		}
	}
	return out
}

// MatchBinary reports whether a process looks like one of the given binaries.
func MatchBinary(p Proc, binaries []string) bool {
	base := strings.ToLower(filepath.Base(strings.TrimSpace(p.Comm)))
	args := strings.ToLower(p.Args)
	for _, b := range binaries {
		want := strings.ToLower(filepath.Base(strings.TrimSpace(b)))
		if want == "" {
			continue
		}
		if base == want {
			return true
		}
		// npm/node wrappers often show comm=node; args still contain …/bin/claude.
		if args != "" {
			if strings.Contains(args, "/"+want+" ") || strings.HasSuffix(args, "/"+want) {
				return true
			}
			// Bare first argv token.
			fields := strings.Fields(args)
			if len(fields) > 0 && filepath.Base(fields[0]) == want {
				return true
			}
		}
	}
	return false
}

func shellName(comm string) string {
	b := strings.ToLower(filepath.Base(strings.TrimSpace(comm)))
	return strings.TrimPrefix(b, "-")
}

// IsShellName reports login/interactive shells that are not a "running task".
func IsShellName(comm string) bool {
	switch shellName(comm) {
	case "zsh", "bash", "sh", "fish", "nu", "pwsh", "powershell", "powershell.exe", "ksh", "dash", "login":
		return true
	default:
		return false
	}
}

// CommandLabel is a short name for a process (claude from node …/bin/claude).
func CommandLabel(p Proc) string {
	base := strings.TrimPrefix(filepath.Base(strings.TrimSpace(p.Comm)), "-")
	low := strings.ToLower(base)
	switch low {
	case "node", "nodejs", "python", "python3", "ruby", "perl":
		fields := strings.Fields(p.Args)
		for i := 1; i < len(fields); i++ {
			f := fields[i]
			if strings.HasPrefix(f, "-") {
				continue
			}
			return filepath.Base(f)
		}
	}
	return base
}

const maxActiveCommands = 5

// ActiveCommands lists non-shell descendant commands under a terminal shell.
func ActiveCommands(shellPID int, all []Proc) []string {
	if shellPID <= 0 {
		return nil
	}
	seen := make(map[string]struct{}, 4)
	out := make([]string, 0, 4)
	for _, k := range Descendants(shellPID, all) {
		if IsShellName(k.Comm) && IsShellName(CommandLabel(k)) {
			continue
		}
		name := CommandLabel(k)
		if name == "" || IsShellName(name) {
			continue
		}
		key := strings.ToLower(name)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, name)
		if len(out) >= maxActiveCommands {
			break
		}
	}
	return out
}

func parsePS(out []byte) []Proc {
	sc := bufio.NewScanner(bytes.NewReader(out))
	// Long command lines
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	procs := make([]Proc, 0, 256)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" {
			continue
		}
		// pid ppid rest…
		fields := strings.Fields(line)
		if len(fields) < 3 {
			continue
		}
		pid, err1 := strconv.Atoi(fields[0])
		ppid, err2 := strconv.Atoi(fields[1])
		if err1 != nil || err2 != nil {
			continue
		}
		rest := strings.TrimSpace(line[len(fields[0])+1:])
		// strip ppid from rest start
		rest = strings.TrimSpace(rest[len(fields[1]):])
		comm := fields[2]
		args := rest
		procs = append(procs, Proc{PID: pid, PPID: ppid, Comm: comm, Args: args})
	}
	return procs
}

func runPS(args ...string) ([]Proc, error) {
	cmd := exec.Command("ps", args...)
	out, err := cmd.Output()
	if err != nil {
		return nil, err
	}
	return parsePS(out), nil
}
