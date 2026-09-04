//go:build dev || debug || devtools

package appmode

// Dev build (wails dev) — isolated from the production app.
const (
	IsDev      = true
	DataDir    = "q-term-dev"
	BridgePort = 19528
	AppTitle   = "Qterm (Dev)"
)
