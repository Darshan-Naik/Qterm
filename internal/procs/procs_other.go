//go:build !darwin && !linux

package procs

func listOS() ([]Proc, error) {
	return nil, nil
}
