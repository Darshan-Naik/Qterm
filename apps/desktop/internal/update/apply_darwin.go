//go:build darwin

package update

import (
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"syscall"
)

// ApplyAndRelaunch starts a detached helper that replaces this .app after we quit.
func ApplyAndRelaunch(dmgPath string) error {
	if dmgPath == "" {
		return fmt.Errorf("update: installer missing")
	}
	if st, err := os.Stat(dmgPath); err != nil || st.Size() == 0 {
		return fmt.Errorf("update: installer missing")
	}
	app, ok := RunningAppBundle()
	if !ok {
		return fmt.Errorf("Restart to update is available in the installed Mac app")
	}
	dir, err := CacheDir()
	if err != nil {
		return err
	}
	script, err := writeApplyScript(dir)
	if err != nil {
		return err
	}
	cmd := exec.Command("/bin/bash", script, strconv.Itoa(os.Getpid()), dmgPath, app)
	cmd.SysProcAttr = &syscall.SysProcAttr{Setsid: true}
	cmd.Stdout = nil
	cmd.Stderr = nil
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("update helper: %w", err)
	}
	_ = cmd.Process.Release()
	return nil
}
