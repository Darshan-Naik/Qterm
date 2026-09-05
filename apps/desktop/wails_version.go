package main

import (
	_ "embed"

	"qterm/internal/appmode"
)

//go:embed wails.json
var wailsJSON []byte

func init() {
	if err := appmode.LoadVersion(wailsJSON); err != nil {
		panic(err)
	}
}
