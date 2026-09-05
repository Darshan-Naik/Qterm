package update

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	StateDownloading = "downloading"
	StateReady       = "ready"
	StateError       = "error"

	downloadTimeout = 10 * time.Minute
)

// Progress is a download/install snapshot for the UI. Emitted off the PTY path.
type Progress struct {
	Version string `json:"version"`
	State   string `json:"state"`
	Bytes   int64  `json:"bytes"`
	Total   int64  `json:"total"`
	Error   string `json:"error,omitempty"`
}

// IsInstallerURL reports a GitHub DMG we can apply, not a release HTML page.
func IsInstallerURL(raw string) bool {
	u := strings.ToLower(strings.TrimSpace(raw))
	if i := strings.IndexByte(u, '?'); i >= 0 {
		u = u[:i]
	}
	return strings.HasSuffix(u, ".dmg")
}

// CacheDir is ~/Library/Caches/Qterm/updates (or the OS cache equivalent).
func CacheDir() (string, error) {
	root, err := os.UserCacheDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(root, "Qterm", "updates"), nil
}

// CacheFile is the local DMG path for a version.
func CacheFile(version string) (string, error) {
	dir, err := CacheDir()
	if err != nil {
		return "", err
	}
	v := Normalize(version)
	if v == "" {
		v = "latest"
	}
	return filepath.Join(dir, "Qterm-"+v+"-macos-arm64.dmg"), nil
}

// CachedReady reports a non-empty cached installer for version.
func CachedReady(version string) (string, bool) {
	path, err := CacheFile(version)
	if err != nil {
		return "", false
	}
	st, err := os.Stat(path)
	if err != nil || st.Size() == 0 {
		return "", false
	}
	return path, true
}

func downloadClient() *http.Client {
	return &http.Client{Timeout: downloadTimeout}
}

type countWriter struct {
	n    int64
	fn   func(int64)
	last time.Time
}

func (w *countWriter) Write(p []byte) (int, error) {
	n, err := len(p), error(nil)
	w.n += int64(n)
	if w.fn != nil {
		now := time.Now()
		if w.last.IsZero() || now.Sub(w.last) >= 200*time.Millisecond {
			w.last = now
			w.fn(w.n)
		}
	}
	return n, err
}

// Download fetches url into dest (tmp + rename). progress may be nil.
func Download(ctx context.Context, url, dest string, progress func(bytes, total int64)) error {
	if strings.TrimSpace(url) == "" {
		return fmt.Errorf("update: empty download URL")
	}
	if dest == "" {
		return fmt.Errorf("update: empty destination")
	}
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "Qterm")
	req.Header.Set("Accept", "application/octet-stream")

	res, err := downloadClient().Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("update download: HTTP %d", res.StatusCode)
	}
	total := res.ContentLength
	if st, err := os.Stat(dest); err == nil && total > 0 && st.Size() == total {
		if progress != nil {
			progress(total, total)
		}
		return nil
	}

	part := dest + ".part"
	f, err := os.Create(part)
	if err != nil {
		return err
	}
	cw := &countWriter{fn: func(n int64) {
		if progress != nil {
			progress(n, total)
		}
	}}
	_, copyErr := io.Copy(f, io.TeeReader(res.Body, cw))
	closeErr := f.Close()
	if copyErr != nil {
		_ = os.Remove(part)
		return copyErr
	}
	if closeErr != nil {
		_ = os.Remove(part)
		return closeErr
	}
	if progress != nil {
		progress(cw.n, total)
	}
	if err := os.Rename(part, dest); err != nil {
		_ = os.Remove(part)
		return err
	}
	return nil
}
