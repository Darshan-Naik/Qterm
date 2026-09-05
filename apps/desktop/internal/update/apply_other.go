//go:build !darwin

package update

import "fmt"

// ApplyAndRelaunch is Mac-only. The helper script is still unit-tested on all OSes.
func ApplyAndRelaunch(dmgPath string) error {
	if dmgPath == "" {
		return fmt.Errorf("update: installer missing")
	}
	return fmt.Errorf("Restart to update is available in the installed Mac app")
}
