package update

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type releaseSnapshot struct {
	SavedAt time.Time `json:"savedAt"`
	Rel     Release   `json:"release"`
}

func defaultCacheFile() string {
	dir, err := CacheDir()
	if err != nil {
		return ""
	}
	return filepath.Join(dir, "latest.json")
}

func (c *Client) cacheFile() string {
	if c == nil || c.Cache == "" {
		return ""
	}
	return c.Cache
}

func (c *Client) loadCachedRelease() (Release, bool) {
	path := c.cacheFile()
	if path == "" {
		return Release{}, false
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return Release{}, false
	}
	var snap releaseSnapshot
	if err := json.Unmarshal(data, &snap); err != nil {
		return Release{}, false
	}
	if snap.SavedAt.IsZero() || time.Since(snap.SavedAt) > cacheMaxAge {
		return Release{}, false
	}
	if strings.TrimSpace(snap.Rel.TagName) == "" {
		return Release{}, false
	}
	return snap.Rel, true
}

func (c *Client) saveCachedRelease(rel Release) {
	path := c.cacheFile()
	if path == "" || strings.TrimSpace(rel.TagName) == "" {
		return
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return
	}
	data, err := json.Marshal(releaseSnapshot{SavedAt: time.Now().UTC(), Rel: rel})
	if err != nil {
		return
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return
	}
	_ = os.Rename(tmp, path)
}
