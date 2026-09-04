//go:build darwin || linux

package procs

func listOS() ([]Proc, error) {
	// args= catches npm/node wrappers (comm may be "node").
	return runPS("-axo", "pid=,ppid=,args=")
}
