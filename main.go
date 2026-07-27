package main

import (
	"embed"
	"os"

	"qterm/internal/agentcli/bridge"
	"qterm/internal/appmode"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

//go:embed all:frontend/dist
var assets embed.FS

//go:embed build/appicon.png
var appIcon []byte

func main() {
	if len(os.Args) > 1 && os.Args[1] == "mcp" {
		bridge.RunMCP()
		return
	}

	app := NewApp()

	err := wails.Run(&options.App{
		Title:     appmode.AppTitle,
		Width:     1280,
		Height:    800,
		MinWidth:  900,
		MinHeight: 560,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 37, G: 37, B: 37, A: 1},
		OnStartup:  app.startup,
		OnDomReady: app.domReady,
		OnShutdown: app.shutdown,
		DragAndDrop: &options.DragAndDrop{
			EnableFileDrop:     true,
			DisableWebViewDrop: true, // don't let WKWebView navigate to file://
		},
		Bind: []interface{}{
			app,
		},
		Mac: &mac.Options{
			TitleBar:             mac.TitleBarHidden(),
			Appearance:           mac.NSAppearanceNameDarkAqua,
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
			About: &mac.AboutInfo{
				Title:   appmode.AppTitle,
				Message: "A fast terminal with project groups and agent hooks.",
				Icon:    appIcon,
			},
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
