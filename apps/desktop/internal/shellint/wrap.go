package shellint

import (
	"os"
	"path/filepath"
	"strings"
)

const osc133Sh = `# Qterm OSC 133 marks (prompt / command / done). Sourced from the wrapper rc.
__qterm_precmd() {
  local __qterm_status=$?
  printf '\033]133;D;%s\007' "$__qterm_status"
  printf '\033]133;A\007'
}
__qterm_preexec() {
  printf '\033]133;C\007'
}
`

const bashRc = `if [ -f "$HOME/.bashrc" ]; then
  . "$HOME/.bashrc"
fi
` + osc133Sh + `
__qterm_in_cmd=
__qterm_bash_preexec() {
  [ -n "$COMP_LINE" ] && return
  [ -n "$__qterm_in_cmd" ] && return
  __qterm_in_cmd=1
  __qterm_preexec
}
__qterm_bash_precmd() {
  __qterm_in_cmd=
  __qterm_precmd
}
case ";${PROMPT_COMMAND-};" in
  *__qterm_bash_precmd*) ;;
  *) PROMPT_COMMAND="__qterm_bash_precmd${PROMPT_COMMAND:+;}$PROMPT_COMMAND" ;;
esac
trap '__qterm_bash_preexec' DEBUG
printf '\033]133;A\007'
`

const zshInt = osc133Sh + `
__qterm_zsh_precmd() { __qterm_precmd; }
__qterm_zsh_preexec() { __qterm_preexec; }
autoload -Uz add-zsh-hook 2>/dev/null || true
add-zsh-hook precmd __qterm_zsh_precmd 2>/dev/null || true
add-zsh-hook preexec __qterm_zsh_preexec 2>/dev/null || true
printf '\033]133;A\007'
`

const zshenv = `if [ -f "${QTERM_USER_ZDOTDIR:-$HOME}/.zshenv" ]; then
  . "${QTERM_USER_ZDOTDIR:-$HOME}/.zshenv"
fi
`

const zprofile = `if [ -f "${QTERM_USER_ZDOTDIR:-$HOME}/.zprofile" ]; then
  . "${QTERM_USER_ZDOTDIR:-$HOME}/.zprofile"
fi
`

const zshrc = `if [ -f "${QTERM_USER_ZDOTDIR:-$HOME}/.zshrc" ]; then
  . "${QTERM_USER_ZDOTDIR:-$HOME}/.zshrc"
fi
. "${QTERM_SHELLINT}/zsh.zsh"
export ZDOTDIR="${QTERM_USER_ZDOTDIR:-$HOME}"
`

const zlogin = `if [ -f "${QTERM_USER_ZDOTDIR:-$HOME}/.zlogin" ]; then
  . "${QTERM_USER_ZDOTDIR:-$HOME}/.zlogin"
fi
`

// Install writes wrapper rc files under dir (typically <datadir>/shellint).
func Install(dir string) error {
	if err := os.MkdirAll(filepath.Join(dir, "zdot"), 0o755); err != nil {
		return err
	}
	files := map[string]string{
		filepath.Join(dir, "bash.rc"):           bashRc,
		filepath.Join(dir, "zsh.zsh"):           zshInt,
		filepath.Join(dir, "zdot", ".zshenv"):   zshenv,
		filepath.Join(dir, "zdot", ".zprofile"): zprofile,
		filepath.Join(dir, "zdot", ".zshrc"):    zshrc,
		filepath.Join(dir, "zdot", ".zlogin"):   zlogin,
	}
	for path, body := range files {
		if err := os.WriteFile(path, []byte(body), 0o644); err != nil {
			return err
		}
	}
	return nil
}

// Wrap returns argv/env additions so the login shell sources OSC 133 hooks.
func Wrap(shell, integDir, home string) (args, extraEnv []string) {
	if integDir == "" || shell == "" {
		return nil, nil
	}
	base := strings.ToLower(filepath.Base(shell))
	if home == "" {
		home, _ = os.UserHomeDir()
	}
	userZdot := os.Getenv("ZDOTDIR")
	if userZdot == "" {
		userZdot = home
	}
	switch {
	case strings.Contains(base, "zsh"):
		return nil, []string{
			"QTERM_SHELLINT=" + integDir,
			"QTERM_USER_ZDOTDIR=" + userZdot,
			"ZDOTDIR=" + filepath.Join(integDir, "zdot"),
		}
	case strings.Contains(base, "bash"):
		return []string{"--rcfile", filepath.Join(integDir, "bash.rc")}, []string{
			"QTERM_SHELLINT=" + integDir,
		}
	default:
		return nil, nil
	}
}
