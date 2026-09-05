package appmode

import (
	"encoding/json"
	"fmt"
	"strings"
)

// AppVersion is info.productVersion from wails.json, loaded at process start.
var AppVersion = "dev"

// AppDescription is the short tagline shown in About dialogs.
const AppDescription = "A fast terminal with project groups and agent hooks."

// AppAuthor is shown in About dialogs.
const AppAuthor = "Darshan Naik"

// AboutInfo is exposed to the frontend About dialog.
type AboutInfo struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Version     string `json:"version"`
	Author      string `json:"author"`
}

func About() AboutInfo {
	return AboutInfo{
		Title:       AppTitle,
		Description: AppDescription,
		Version:     AppVersion,
		Author:      AppAuthor,
	}
}

func AboutMessage() string {
	return AppDescription + "\n\nVersion " + AppVersion + "\nDesigned by " + AppAuthor
}

// LoadVersion sets AppVersion from a wails.json document.
func LoadVersion(wailsJSON []byte) error {
	var cfg struct {
		Info struct {
			ProductVersion string `json:"productVersion"`
		} `json:"info"`
	}
	if err := json.Unmarshal(wailsJSON, &cfg); err != nil {
		return fmt.Errorf("wails.json: %w", err)
	}
	v := strings.TrimSpace(cfg.Info.ProductVersion)
	if v == "" {
		return fmt.Errorf("wails.json info.productVersion is empty")
	}
	AppVersion = v
	return nil
}
