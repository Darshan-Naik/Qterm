package update

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	GitHubOwner = "Darshan-Naik"
	GitHubRepo  = "Qterm"

	AssetARM64 = "Qterm-macos-arm64.dmg"
	AssetAMD64 = "Qterm-macos-amd64.dmg"

	defaultAPI  = "https://api.github.com/repos/" + GitHubOwner + "/" + GitHubRepo + "/releases/latest"
	httpTimeout = 8 * time.Second
	maxBody     = 1 << 20
)

// Status is the in-app update check result.
type Status struct {
	Available      bool   `json:"available"`
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	DownloadURL    string `json:"downloadUrl"`
	ReleaseURL     string `json:"releaseUrl"`
	Skipped        bool   `json:"skipped"`
}

// Release is the GitHub latest-release payload we care about.
type Release struct {
	TagName    string  `json:"tag_name"`
	HTMLURL    string  `json:"html_url"`
	Draft      bool    `json:"draft"`
	Prerelease bool    `json:"prerelease"`
	Assets     []Asset `json:"assets"`
}

// Asset is a GitHub release file.
type Asset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

// Client fetches GitHub Releases. HTTP and API are overridable in tests.
type Client struct {
	HTTP *http.Client
	API  string
	UA   string
}

func Default() *Client {
	return &Client{
		HTTP: &http.Client{Timeout: httpTimeout},
		API:  defaultAPI,
		UA:   "Qterm",
	}
}

// Check compares current to the latest GitHub Release for this Mac arch.
func (c *Client) Check(ctx context.Context, current, skipped, arch string) (Status, error) {
	current = Normalize(current)
	st := Status{CurrentVersion: current}
	rel, err := c.Latest(ctx)
	if err != nil {
		if errors.Is(err, errNotFound) {
			return st, nil
		}
		return st, err
	}
	return Evaluate(current, skipped, arch, rel), nil
}

func (c *Client) Latest(ctx context.Context) (Release, error) {
	httpClient := c.HTTP
	if httpClient == nil {
		httpClient = &http.Client{Timeout: httpTimeout}
	}
	api := c.API
	if api == "" {
		api = defaultAPI
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, api, nil)
	if err != nil {
		return Release{}, err
	}
	ua := c.UA
	if ua == "" {
		ua = "Qterm"
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", ua)
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	res, err := httpClient.Do(req)
	if err != nil {
		return Release{}, err
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, maxBody))
	if err != nil {
		return Release{}, err
	}
	if res.StatusCode == http.StatusNotFound {
		return Release{}, errNotFound
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return Release{}, fmt.Errorf("github releases: HTTP %d", res.StatusCode)
	}
	var rel Release
	if err := json.Unmarshal(body, &rel); err != nil {
		return Release{}, err
	}
	return rel, nil
}

var errNotFound = errors.New("github releases: not found")

// AssetName is the DMG filename published by the Release workflow for arch.
func AssetName(arch string) string {
	switch arch {
	case "amd64", "x86_64":
		return AssetAMD64
	default:
		return AssetARM64
	}
}

// PickAsset returns the browser download URL for this Mac arch, or "".
func PickAsset(assets []Asset, arch string) string {
	want := AssetName(arch)
	for _, a := range assets {
		if a.Name == want {
			return a.BrowserDownloadURL
		}
	}
	suffix := "-arm64.dmg"
	if arch == "amd64" || arch == "x86_64" {
		suffix = "-amd64.dmg"
	}
	for _, a := range assets {
		if strings.HasSuffix(strings.ToLower(a.Name), suffix) {
			return a.BrowserDownloadURL
		}
	}
	return ""
}

// Evaluate maps a GitHub release onto an in-app update status.
func Evaluate(current, skipped, arch string, rel Release) Status {
	current = Normalize(current)
	st := Status{CurrentVersion: current}
	if rel.Draft || rel.Prerelease {
		return st
	}
	latest := Normalize(rel.TagName)
	if latest == "" {
		return st
	}
	st.LatestVersion = latest
	st.ReleaseURL = rel.HTMLURL
	if url := PickAsset(rel.Assets, arch); url != "" {
		st.DownloadURL = url
	} else {
		st.DownloadURL = rel.HTMLURL
	}
	if Compare(current, latest) >= 0 {
		return st
	}
	st.Available = true
	st.Skipped = Normalize(skipped) != "" && Compare(Normalize(skipped), latest) >= 0
	return st
}
