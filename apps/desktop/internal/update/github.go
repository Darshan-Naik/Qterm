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

	defaultAPI = "https://api.github.com/repos/" + GitHubOwner + "/" + GitHubRepo + "/releases/latest"
	defaultWeb = "https://github.com/" + GitHubOwner + "/" + GitHubRepo + "/releases/latest"
	defaultUA  = "Qterm (+https://github.com/" + GitHubOwner + "/" + GitHubRepo + ")"
	latestDMG  = "https://github.com/" + GitHubOwner + "/" + GitHubRepo + "/releases/latest/download/" + AssetARM64

	githubAccept = "application/vnd.github+json"
	webAccept    = "application/json"
	githubAPIVer = "2022-11-28"

	httpTimeout   = 8 * time.Second
	maxBody       = 1 << 20
	fetchAttempts = 3
	fetchRetry    = 80 * time.Millisecond
	cacheMaxAge   = 24 * time.Hour
)

// Status is the in-app update check result.
type Status struct {
	Available      bool   `json:"available"`
	CurrentVersion string `json:"currentVersion"`
	LatestVersion  string `json:"latestVersion"`
	DownloadURL    string `json:"downloadUrl"`
	ReleaseURL     string `json:"releaseUrl"`
	Skipped        bool   `json:"skipped"`
	State          string `json:"state,omitempty"`
	Bytes          int64  `json:"bytes,omitempty"`
	Total          int64  `json:"total,omitempty"`
	Error          string `json:"error,omitempty"`
}

// Applied is a just-installed upgrade, shown once after restart.
type Applied struct {
	From string `json:"from"`
	To   string `json:"to"`
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
	HTTP  *http.Client
	API   string
	Web   string
	UA    string
	Cache string
}

func Default() *Client {
	return &Client{
		HTTP:  &http.Client{Timeout: 2 * httpTimeout},
		API:   defaultAPI,
		Web:   defaultWeb,
		UA:    defaultUA,
		Cache: defaultCacheFile(),
	}
}

// Check compares current to the latest GitHub Release (Apple Silicon DMG).
func (c *Client) Check(ctx context.Context, current, skipped string) (Status, error) {
	current = Normalize(current)
	st := Status{CurrentVersion: current}
	rel, err := c.Latest(ctx)
	if err != nil {
		if errors.Is(err, errNotFound) {
			return st, nil
		}
		if cached, ok := c.loadCachedRelease(); ok {
			return Evaluate(current, skipped, cached), nil
		}
		return st, err
	}
	c.saveCachedRelease(rel)
	return Evaluate(current, skipped, rel), nil
}

func (c *Client) Latest(ctx context.Context) (Release, error) {
	// Prefer github.com (no REST quota). api.github.com is 60/hour per IP and
	// returns 403 when Cursor or the site has already used that budget.
	var first error
	if c.webURL() != "" {
		rel, err := c.latestFromWeb(ctx)
		if err == nil {
			return rel, nil
		}
		first = err
		if !shouldFallback(err) {
			return Release{}, err
		}
	}
	rel, err := c.latestWithRetry(ctx, func() (Release, error) {
		return c.latestJSON(ctx, c.apiURL(), githubAccept, true)
	})
	if err == nil {
		return rel, nil
	}
	if first != nil {
		return Release{}, first
	}
	return Release{}, err
}

func (c *Client) latestFromWeb(ctx context.Context) (Release, error) {
	rel, err := c.latestWithRetry(ctx, func() (Release, error) {
		return c.latestJSON(ctx, c.webURL(), webAccept, false)
	})
	if err != nil {
		return Release{}, err
	}
	return webRelease(rel.TagName), nil
}

func (c *Client) latestWithRetry(ctx context.Context, fn func() (Release, error)) (Release, error) {
	var last error
	for i := 0; i < fetchAttempts; i++ {
		if i > 0 {
			timer := time.NewTimer(time.Duration(i) * fetchRetry)
			select {
			case <-ctx.Done():
				timer.Stop()
				return Release{}, ctx.Err()
			case <-timer.C:
			}
		}
		rel, err := fn()
		if err == nil {
			return rel, nil
		}
		last = err
		if !retryable(err) {
			return Release{}, err
		}
	}
	return Release{}, last
}

func webRelease(tag string) Release {
	tag = strings.TrimSpace(tag)
	if tag == "" {
		return Release{}
	}
	html := "https://github.com/" + GitHubOwner + "/" + GitHubRepo + "/releases/tag/" + tag
	return Release{
		TagName: tag,
		HTMLURL: html,
		Assets: []Asset{{
			Name:               AssetARM64,
			BrowserDownloadURL: latestDMG,
		}},
	}
}

func (c *Client) latestJSON(ctx context.Context, url, accept string, restAPI bool) (Release, error) {
	body, status, err := c.get(ctx, url, accept, restAPI)
	if err != nil {
		return Release{}, err
	}
	if status == http.StatusNotFound {
		return Release{}, errNotFound
	}
	if status < 200 || status >= 300 {
		return Release{}, httpError{status: status, body: body}
	}
	var rel Release
	if err := json.Unmarshal(body, &rel); err != nil {
		return Release{}, err
	}
	if strings.TrimSpace(rel.TagName) == "" {
		return Release{}, errNotFound
	}
	return rel, nil
}

func (c *Client) get(ctx context.Context, url, accept string, restAPI bool) ([]byte, int, error) {
	httpClient := c.HTTP
	if httpClient == nil {
		httpClient = &http.Client{Timeout: 2 * httpTimeout}
	}
	reqCtx, cancel := context.WithTimeout(ctx, httpTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(reqCtx, http.MethodGet, url, nil)
	if err != nil {
		return nil, 0, err
	}
	req.Header.Set("Accept", accept)
	req.Header.Set("User-Agent", c.userAgent())
	if restAPI {
		req.Header.Set("X-GitHub-Api-Version", githubAPIVer)
	}
	res, err := httpClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, maxBody))
	if err != nil {
		return nil, 0, err
	}
	return body, res.StatusCode, nil
}

func (c *Client) apiURL() string {
	if c != nil && c.API != "" {
		return c.API
	}
	return defaultAPI
}

func (c *Client) webURL() string {
	if c == nil {
		return ""
	}
	return c.Web
}

func (c *Client) userAgent() string {
	if c != nil && c.UA != "" {
		return c.UA
	}
	return defaultUA
}

func shouldFallback(err error) bool {
	if err == nil || errors.Is(err, errNotFound) || errors.Is(err, context.Canceled) {
		return false
	}
	var he httpError
	if errors.As(err, &he) {
		return he.status == http.StatusUnauthorized ||
			he.status == http.StatusForbidden ||
			he.status == http.StatusTooManyRequests ||
			he.status >= 500
	}
	return true
}

func retryable(err error) bool {
	if err == nil || errors.Is(err, errNotFound) || errors.Is(err, context.Canceled) {
		return false
	}
	var he httpError
	if errors.As(err, &he) {
		return he.status == http.StatusTooManyRequests || he.status >= 500
	}
	return true
}

type httpError struct {
	status int
	body   []byte
}

func (e httpError) Error() string {
	if e.status == http.StatusForbidden || e.status == http.StatusTooManyRequests {
		return fmt.Sprintf("github releases: HTTP %d (rate limited). Try again in a few minutes.", e.status)
	}
	return fmt.Sprintf("github releases: HTTP %d", e.status)
}

var errNotFound = errors.New("github releases: not found")

// PickAsset returns the Apple Silicon DMG download URL, or "".
func PickAsset(assets []Asset) string {
	for _, a := range assets {
		if a.Name == AssetARM64 {
			return a.BrowserDownloadURL
		}
	}
	for _, a := range assets {
		lower := strings.ToLower(a.Name)
		if strings.HasSuffix(lower, "-arm64.dmg") {
			return a.BrowserDownloadURL
		}
	}
	return ""
}

// Evaluate maps a GitHub release onto an in-app update status.
func Evaluate(current, skipped string, rel Release) Status {
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
	if url := PickAsset(rel.Assets); url != "" {
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
