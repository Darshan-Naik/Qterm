package appmode

// AppVersion matches wails.json info.productVersion.
const AppVersion = "1.6.3"

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
