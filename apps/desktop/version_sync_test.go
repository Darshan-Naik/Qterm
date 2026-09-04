package main

import (
	"encoding/json"
	"os"
	"testing"

	"qterm/internal/appmode"
)

func TestAppVersionMatchesWails(t *testing.T) {
	data, err := os.ReadFile("wails.json")
	if err != nil {
		t.Fatal(err)
	}
	var cfg struct {
		Info struct {
			ProductVersion string `json:"productVersion"`
		} `json:"info"`
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		t.Fatal(err)
	}
	if cfg.Info.ProductVersion == "" {
		t.Fatal("wails.json info.productVersion is empty")
	}
	if appmode.AppVersion != cfg.Info.ProductVersion {
		t.Fatalf("appmode.AppVersion %q != wails.json productVersion %q", appmode.AppVersion, cfg.Info.ProductVersion)
	}
}
