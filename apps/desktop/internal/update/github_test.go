package update

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestCompare(t *testing.T) {
	cases := []struct {
		a, b string
		want int
	}{
		{"1.6.2", "1.6.2", 0},
		{"v1.6.2", "1.6.2", 0},
		{"1.6.2", "1.6.3", -1},
		{"1.7.0", "1.6.9", 1},
		{"1.6.2-beta", "1.6.2", 0},
		{"", "1.0.0", -1},
	}
	for _, tc := range cases {
		if got := Compare(tc.a, tc.b); got != tc.want {
			t.Errorf("Compare(%q, %q) = %d, want %d", tc.a, tc.b, got, tc.want)
		}
	}
}

func TestPickAsset(t *testing.T) {
	assets := []Asset{
		{Name: "Qterm-macos-arm64.dmg", BrowserDownloadURL: "https://ex/arm"},
		{Name: "Qterm-macos-amd64.dmg", BrowserDownloadURL: "https://ex/amd"},
	}
	if got := PickAsset(assets); got != "https://ex/arm" {
		t.Fatalf("arm64: %s", got)
	}
	if got := PickAsset(nil); got != "" {
		t.Fatalf("empty: %s", got)
	}
	if got := PickAsset([]Asset{{Name: "Qterm-1.6.3-arm64.dmg", BrowserDownloadURL: "https://ex/ver"}}); got != "https://ex/ver" {
		t.Fatalf("versioned arm64: %s", got)
	}
}

func TestEvaluate(t *testing.T) {
	rel := Release{
		TagName: "v1.6.3",
		HTMLURL: "https://github.com/Darshan-Naik/Qterm/releases/tag/v1.6.3",
		Assets: []Asset{
			{Name: AssetARM64, BrowserDownloadURL: "https://ex/Qterm-macos-arm64.dmg"},
		},
	}

	newer := Evaluate("1.6.2", "", rel)
	if !newer.Available || newer.LatestVersion != "1.6.3" || newer.DownloadURL != "https://ex/Qterm-macos-arm64.dmg" {
		t.Fatalf("newer: %+v", newer)
	}
	if newer.Skipped {
		t.Fatal("not skipped")
	}

	same := Evaluate("1.6.3", "", rel)
	if same.Available {
		t.Fatalf("same should not be available: %+v", same)
	}

	olderSkip := Evaluate("1.6.2", "1.6.1", rel)
	if !olderSkip.Available || olderSkip.Skipped {
		t.Fatalf("older skip should not suppress a newer release: %+v", olderSkip)
	}

	skipped := Evaluate("1.6.2", "1.6.3", rel)
	if !skipped.Available || !skipped.Skipped {
		t.Fatalf("skipped: %+v", skipped)
	}

	noAsset := Evaluate("1.6.2", "", Release{TagName: "v1.6.3", HTMLURL: rel.HTMLURL})
	if !noAsset.Available || noAsset.DownloadURL != rel.HTMLURL {
		t.Fatalf("fallback download should be release page: %+v", noAsset)
	}

	draft := Evaluate("1.6.2", "", Release{TagName: "v1.6.3", Draft: true})
	if draft.Available {
		t.Fatalf("draft: %+v", draft)
	}
}

func TestClientCheck(t *testing.T) {
	payload, _ := json.Marshal(Release{
		TagName: "v1.7.0",
		HTMLURL: "https://github.com/Darshan-Naik/Qterm/releases/tag/v1.7.0",
		Assets: []Asset{
			{Name: AssetARM64, BrowserDownloadURL: "https://ex/arm.dmg"},
		},
	})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("User-Agent") == "" {
			t.Error("missing User-Agent")
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(payload)
	}))
	t.Cleanup(srv.Close)

	c := &Client{HTTP: srv.Client(), API: srv.URL, UA: "Qterm-test"}
	st, err := c.Check(context.Background(), "1.6.2", "")
	if err != nil {
		t.Fatal(err)
	}
	if !st.Available || st.LatestVersion != "1.7.0" || st.DownloadURL != "https://ex/arm.dmg" {
		t.Fatalf("%+v", st)
	}
}

func TestClientCheckHTTPError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "nope", http.StatusInternalServerError)
	}))
	t.Cleanup(srv.Close)

	c := &Client{HTTP: srv.Client(), API: srv.URL}
	_, err := c.Check(context.Background(), "1.6.2", "")
	if err == nil {
		t.Fatal("expected HTTP error")
	}
}

func TestClientCheckFallsBackOn403(t *testing.T) {
	apiHits := 0
	mux := http.NewServeMux()
	mux.HandleFunc("/api", func(w http.ResponseWriter, r *http.Request) {
		apiHits++
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`{"message":"API rate limit exceeded"}`))
	})
	mux.HandleFunc("/web", func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Accept"); got != webAccept {
			t.Errorf("web Accept = %q", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"tag_name":"v1.8.1"}`))
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	c := &Client{HTTP: srv.Client(), API: srv.URL + "/api", Web: srv.URL + "/web", UA: "Qterm-test"}
	st, err := c.Check(context.Background(), "1.8.0", "")
	if err != nil {
		t.Fatal(err)
	}
	if !st.Available || st.LatestVersion != "1.8.1" {
		t.Fatalf("%+v", st)
	}
	if st.DownloadURL != latestDMG {
		t.Fatalf("download: %s", st.DownloadURL)
	}
	if apiHits != 0 {
		t.Fatalf("web success should not touch the rate-limited API: hits=%d", apiHits)
	}
}

func TestClientCheckAPIWhenWebForbidden(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"tag_name":"v1.8.1","html_url":"https://github.com/Darshan-Naik/Qterm/releases/tag/v1.8.1","assets":[{"name":"Qterm-macos-arm64.dmg","browser_download_url":"https://ex/arm.dmg"}]}`))
	})
	mux.HandleFunc("/web", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	c := &Client{HTTP: srv.Client(), API: srv.URL + "/api", Web: srv.URL + "/web"}
	st, err := c.Check(context.Background(), "1.8.0", "")
	if err != nil {
		t.Fatal(err)
	}
	if !st.Available || st.LatestVersion != "1.8.1" || st.DownloadURL != "https://ex/arm.dmg" {
		t.Fatalf("%+v", st)
	}
}

func TestClientCheckRetriesThenSucceeds(t *testing.T) {
	hits := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits++
		if hits < 2 {
			http.Error(w, "try again", http.StatusBadGateway)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"tag_name":"v1.8.1","html_url":"https://github.com/Darshan-Naik/Qterm/releases/tag/v1.8.1","assets":[{"name":"Qterm-macos-arm64.dmg","browser_download_url":"https://ex/arm.dmg"}]}`))
	}))
	t.Cleanup(srv.Close)

	c := &Client{HTTP: srv.Client(), API: srv.URL}
	st, err := c.Check(context.Background(), "1.8.0", "")
	if err != nil {
		t.Fatal(err)
	}
	if hits != 2 || !st.Available || st.LatestVersion != "1.8.1" {
		t.Fatalf("hits=%d status=%+v", hits, st)
	}
}

func TestClientCheckUsesCacheWhenRemoteFails(t *testing.T) {
	ok := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"tag_name":"v1.8.1","html_url":"https://github.com/Darshan-Naik/Qterm/releases/tag/v1.8.1","assets":[{"name":"Qterm-macos-arm64.dmg","browser_download_url":"https://ex/arm.dmg"}]}`))
	}))
	t.Cleanup(ok.Close)
	cache := t.TempDir() + "/latest.json"
	c := &Client{HTTP: ok.Client(), API: ok.URL, Cache: cache}
	if _, err := c.Check(context.Background(), "1.8.0", ""); err != nil {
		t.Fatal(err)
	}

	fail := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "nope", http.StatusInternalServerError)
	}))
	t.Cleanup(fail.Close)
	c.HTTP = fail.Client()
	c.API = fail.URL
	st, err := c.Check(context.Background(), "1.8.0", "")
	if err != nil {
		t.Fatal(err)
	}
	if !st.Available || st.LatestVersion != "1.8.1" {
		t.Fatalf("cached: %+v", st)
	}
}

func TestClientCheckWeb404SkipsAPI(t *testing.T) {
	apiHits := 0
	mux := http.NewServeMux()
	mux.HandleFunc("/api", func(w http.ResponseWriter, r *http.Request) {
		apiHits++
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"tag_name":"v9.9.9"}`))
	})
	mux.HandleFunc("/web", func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	c := &Client{HTTP: srv.Client(), API: srv.URL + "/api", Web: srv.URL + "/web"}
	st, err := c.Check(context.Background(), "1.8.0", "")
	if err != nil {
		t.Fatal(err)
	}
	if st.Available || apiHits != 0 {
		t.Fatalf("web 404 means no releases: %+v hits=%d", st, apiHits)
	}
}

func TestClientCheckNotFound(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	}))
	t.Cleanup(srv.Close)

	c := &Client{HTTP: srv.Client(), API: srv.URL}
	st, err := c.Check(context.Background(), "1.6.2", "")
	if err != nil {
		t.Fatal(err)
	}
	if st.Available || st.CurrentVersion != "1.6.2" {
		t.Fatalf("%+v", st)
	}
}

func TestDefaultCheckNetwork(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	st, err := Default().Check(ctx, "0.0.1", "")
	if err != nil {
		t.Fatal(err)
	}
	if !st.Available || Normalize(st.LatestVersion) == "" {
		t.Fatalf("expected a published release: %+v", st)
	}
	if !strings.HasSuffix(strings.ToLower(st.DownloadURL), ".dmg") {
		t.Fatalf("download: %s", st.DownloadURL)
	}
}
