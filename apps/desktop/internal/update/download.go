package update

import (
	"context"
	"crypto/tls"
	"errors"
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

	downloadTimeout       = 10 * time.Minute
	downloadHeaderTimeout = 30 * time.Second
	downloadTLSTimeout    = 15 * time.Second
)

var (
	downloadAttempts = 4
	downloadRetry    = 200 * time.Millisecond
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

func cacheVersion(name string) string {
	name = strings.TrimSuffix(name, ".part")
	name = strings.TrimSuffix(name, ".dmg")
	const prefix = "Qterm-"
	const suffix = "-macos-arm64"
	if !strings.HasPrefix(name, prefix) || !strings.HasSuffix(name, suffix) {
		return ""
	}
	return Normalize(strings.TrimSuffix(strings.TrimPrefix(name, prefix), suffix))
}

// RemoveStaleCache deletes cached installers older than latest so a ready 1.6.2
// DMG cannot hide 1.7.0 after a newer GitHub Release is published.
func RemoveStaleCache(latest string) error {
	latest = Normalize(latest)
	if latest == "" {
		return nil
	}
	dir, err := CacheDir()
	if err != nil {
		return err
	}
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		ver := cacheVersion(e.Name())
		if ver == "" || Compare(ver, latest) >= 0 {
			continue
		}
		_ = os.Remove(filepath.Join(dir, e.Name()))
	}
	return nil
}

func downloadClient(forceHTTP1 bool) *http.Client {
	tr, _ := http.DefaultTransport.(*http.Transport)
	if tr != nil {
		tr = tr.Clone()
	} else {
		tr = &http.Transport{}
	}
	tr.ResponseHeaderTimeout = downloadHeaderTimeout
	tr.TLSHandshakeTimeout = downloadTLSTimeout
	if forceHTTP1 {
		// GitHub's asset CDN sometimes closes HTTP/2 streams with unexpected EOF.
		tr.ForceAttemptHTTP2 = false
		tr.TLSNextProto = map[string]func(authority string, c *tls.Conn) http.RoundTripper{}
	}
	return &http.Client{Timeout: downloadTimeout, Transport: tr}
}

type downloadHTTPError struct{ status int }

func (e downloadHTTPError) Error() string {
	return fmt.Sprintf("update download: HTTP %d", e.status)
}

func isUnexpectedEOF(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, io.ErrUnexpectedEOF) {
		return true
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "unexpected eof") ||
		strings.Contains(msg, "connection reset") ||
		strings.Contains(msg, "broken pipe") ||
		strings.Contains(msg, "server closed idle connection")
}

func downloadRetryable(err error) bool {
	if err == nil || errors.Is(err, context.Canceled) {
		return false
	}
	var he downloadHTTPError
	if errors.As(err, &he) {
		return he.status == http.StatusTooManyRequests || he.status >= 500
	}
	if errors.Is(err, io.ErrUnexpectedEOF) {
		return true
	}
	msg := strings.ToLower(err.Error())
	if strings.Contains(msg, "http 4") {
		return false
	}
	return true
}

// UserDownloadError is a short message for the update dialog. Never include URLs.
func UserDownloadError(err error) string {
	if err == nil {
		return ""
	}
	if errors.Is(err, context.Canceled) {
		return ""
	}
	msg := strings.ToLower(err.Error())
	switch {
	case strings.Contains(msg, "unexpected eof"),
		strings.Contains(msg, "connection reset"),
		strings.Contains(msg, "broken pipe"),
		strings.Contains(msg, "i/o timeout"),
		strings.Contains(msg, "timeout"),
		strings.Contains(msg, "incomplete"):
		return "The download was interrupted. Check your network, then try again."
	case strings.Contains(msg, "no such host"),
		strings.Contains(msg, "network is unreachable"),
		strings.Contains(msg, "connection refused"):
		return "Could not reach GitHub. Check your network, then try again."
	}
	var he downloadHTTPError
	if errors.As(err, &he) || strings.Contains(msg, "http ") {
		return "GitHub did not send the installer. Try again in a bit."
	}
	return "Could not download the update. Try again."
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
// Transient GitHub CDN drops (unexpected EOF) are retried, then HTTP/1.1.
func Download(ctx context.Context, url, dest string, progress func(bytes, total int64)) error {
	if strings.TrimSpace(url) == "" {
		return fmt.Errorf("%s", UserDownloadError(fmt.Errorf("empty download URL")))
	}
	if dest == "" {
		return fmt.Errorf("%s", UserDownloadError(fmt.Errorf("empty destination")))
	}
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return fmt.Errorf("%s", UserDownloadError(err))
	}

	var last error
	http1 := false
	for i := 0; i < downloadAttempts; i++ {
		if err := ctx.Err(); err != nil {
			return err
		}
		if i > 0 {
			timer := time.NewTimer(time.Duration(i) * downloadRetry)
			select {
			case <-ctx.Done():
				timer.Stop()
				return ctx.Err()
			case <-timer.C:
			}
		}
		err := downloadOnce(ctx, url, dest, progress, http1)
		if err == nil {
			return nil
		}
		last = err
		if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
			return err
		}
		if !downloadRetryable(err) {
			return fmt.Errorf("%s", UserDownloadError(err))
		}
		if isUnexpectedEOF(err) {
			http1 = true
		}
	}
	return fmt.Errorf("%s", UserDownloadError(last))
}

func downloadOnce(ctx context.Context, url, dest string, progress func(bytes, total int64), forceHTTP1 bool) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", "Qterm")
	req.Header.Set("Accept", "application/octet-stream")

	res, err := downloadClient(forceHTTP1).Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return downloadHTTPError{status: res.StatusCode}
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
	if total > 0 && cw.n != total {
		_ = os.Remove(part)
		return fmt.Errorf("update download: incomplete (%d of %d bytes)", cw.n, total)
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
