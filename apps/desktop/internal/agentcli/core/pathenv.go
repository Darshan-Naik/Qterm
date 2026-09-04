package core

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

var ensureUserPathOnce sync.Once

// EnsureUserPath merges the GUI process PATH with the user's login-shell PATH
// and common install prefixes (Homebrew, ~/.local/bin, …).
//
// Finder/Dock-launched .apps inherit a minimal PATH (/usr/bin:/bin:…), so
// exec.LookPath misses CLIs the user installed for Terminal.app. Call once
// at process start before Available()/Install checks.
func EnsureUserPath() {
	ensureUserPathOnce.Do(func() {
		parts := append([]string{os.Getenv("PATH"), loginShellPATH()}, commonUserBinDirs()...)
		os.Setenv("PATH", mergePATH(parts...))
	})
}

func commonUserBinDirs() []string {
	home, err := os.UserHomeDir()
	if err != nil {
		home = ""
	}
	dirs := make([]string, 0, 16)
	if home != "" {
		dirs = append(dirs,
			filepath.Join(home, ".local", "bin"),
			filepath.Join(home, "bin"),
			filepath.Join(home, "go", "bin"),
			filepath.Join(home, ".cargo", "bin"),
			filepath.Join(home, ".bun", "bin"),
			filepath.Join(home, ".yarn", "bin"),
			filepath.Join(home, ".fnm", "current", "bin"),
			filepath.Join(home, ".volta", "bin"),
			filepath.Join(home, ".asdf", "shims"),
			filepath.Join(home, ".local", "share", "pnpm"),
		)
		// Active nvm default alias, if present.
		if nvm := nvmDefaultBin(home); nvm != "" {
			dirs = append(dirs, nvm)
		}
	}
	if runtime.GOOS == "darwin" {
		dirs = append(dirs,
			"/opt/homebrew/bin",
			"/opt/homebrew/sbin",
			"/usr/local/bin",
			"/usr/local/sbin",
		)
	}
	return dirs
}

func nvmDefaultBin(home string) string {
	// ~/.nvm/alias/default → version string → ~/.nvm/versions/node/<ver>/bin
	alias := filepath.Join(home, ".nvm", "alias", "default")
	b, err := os.ReadFile(alias)
	if err != nil {
		return ""
	}
	ver := strings.TrimSpace(string(b))
	if ver == "" {
		return ""
	}
	dir := filepath.Join(home, ".nvm", "versions", "node", ver, "bin")
	if st, err := os.Stat(dir); err == nil && st.IsDir() {
		return dir
	}
	return ""
}

// loginShellPATH asks the user's login shell for PATH (covers .zprofile / .zshrc exports).
func loginShellPATH() string {
	shell := os.Getenv("SHELL")
	if shell == "" {
		if runtime.GOOS == "darwin" {
			shell = "/bin/zsh"
		} else {
			shell = "/bin/bash"
		}
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2500*time.Millisecond)
	defer cancel()

	// -l: login (zprofile/profile). -i: interactive (.zshrc) — many PATH tweaks live there.
	// printf avoids trailing newlines from echo.
	cmd := exec.CommandContext(ctx, shell, "-lic", `printf '%s' "$PATH"`)
	cmd.Env = minimalEnvForShell()
	out, err := cmd.Output()
	if err != nil || len(out) == 0 {
		// Non-interactive login fallback.
		cmd = exec.CommandContext(ctx, shell, "-lc", `printf '%s' "$PATH"`)
		cmd.Env = minimalEnvForShell()
		out, err = cmd.Output()
		if err != nil || len(out) == 0 {
			return ""
		}
	}
	return strings.TrimSpace(string(out))
}

func minimalEnvForShell() []string {
	home, _ := os.UserHomeDir()
	env := []string{
		"HOME=" + home,
		"USER=" + os.Getenv("USER"),
		"LOGNAME=" + os.Getenv("LOGNAME"),
		"TMPDIR=" + os.TempDir(),
		"TERM=dumb",
		"LANG=" + firstNonEmpty(os.Getenv("LANG"), "en_US.UTF-8"),
	}
	if shell := os.Getenv("SHELL"); shell != "" {
		env = append(env, "SHELL="+shell)
	}
	return env
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}

func mergePATH(parts ...string) string {
	seen := make(map[string]struct{}, 64)
	out := make([]string, 0, 64)
	add := func(chunk string) {
		for _, p := range strings.Split(chunk, string(os.PathListSeparator)) {
			p = strings.TrimSpace(p)
			if p == "" {
				continue
			}
			if _, ok := seen[p]; ok {
				continue
			}
			seen[p] = struct{}{}
			out = append(out, p)
		}
	}
	for _, part := range parts {
		add(part)
	}
	return strings.Join(out, string(os.PathListSeparator))
}
