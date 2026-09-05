package update

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const appNameInDMG = "Qterm.app"

// AppBundleFromExecutable returns the .app path that contains exe, if any.
func AppBundleFromExecutable(exe string) (string, bool) {
	const marker = ".app/Contents/MacOS/"
	i := strings.Index(exe, marker)
	if i < 0 {
		return "", false
	}
	return exe[:i+len(".app")], true
}

// RunningAppBundle is the installed Qterm.app when this process is inside one.
func RunningAppBundle() (string, bool) {
	exe, err := os.Executable()
	if err != nil {
		return "", false
	}
	if resolved, err := filepath.EvalSymlinks(exe); err == nil {
		exe = resolved
	}
	return AppBundleFromExecutable(exe)
}

// ApplyScript is the helper that waits for Qterm to quit, copies the DMG app, and relaunches.
func ApplyScript() string {
	return `#!/bin/bash
set -euo pipefail
PID="${1:?}"
DMG="${2:?}"
APP="${3:?}"
SRC_NAME="` + appNameInDMG + `"

while /bin/kill -0 "$PID" 2>/dev/null; do
  sleep 0.2
done
sleep 0.4

MNT="$(mktemp -d /tmp/qterm-update.XXXXXX)"
cleanup() {
  /usr/bin/hdiutil detach "$MNT" -quiet >/dev/null 2>&1 || true
  rmdir "$MNT" >/dev/null 2>&1 || true
}
trap cleanup EXIT

/usr/bin/hdiutil attach -nobrowse -readonly -mountpoint "$MNT" "$DMG"
SRC="$MNT/$SRC_NAME"
if [[ ! -d "$SRC" ]]; then
  SRC="$(/usr/bin/find "$MNT" -maxdepth 2 -name '*.app' -type d -print -quit)"
fi
if [[ ! -d "$SRC" ]]; then
  echo "update: Qterm.app missing in installer" >&2
  exit 1
fi

/usr/bin/ditto "$SRC" "$APP"
/usr/bin/xattr -cr "$APP" >/dev/null 2>&1 || true
trap - EXIT
/usr/bin/hdiutil detach "$MNT" -quiet >/dev/null 2>&1 || true
rmdir "$MNT" >/dev/null 2>&1 || true
/usr/bin/open "$APP"
`
}

func writeApplyScript(dir string) (string, error) {
	if dir == "" {
		dir = os.TempDir()
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	path := filepath.Join(dir, "qterm-apply.sh")
	if err := os.WriteFile(path, []byte(ApplyScript()), 0o755); err != nil {
		return "", fmt.Errorf("update helper: %w", err)
	}
	return path, nil
}
