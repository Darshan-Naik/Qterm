//go:build !dev && !debug && !devtools

package appmode

// Production build (wails build).
const (
	IsDev      = false
	DataDir    = "q-term"
	BridgePort = 19527
	AppTitle   = "Qterm"
)
