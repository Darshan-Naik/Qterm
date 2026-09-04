package update

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
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
	if got := PickAsset(assets, "arm64"); got != "https://ex/arm" {
		t.Fatalf("arm64: %s", got)
	}
	if got := PickAsset(assets, "amd64"); got != "https://ex/amd" {
		t.Fatalf("amd64: %s", got)
	}
	if got := PickAsset(nil, "arm64"); got != "" {
		t.Fatalf("empty: %s", got)
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

	newer := Evaluate("1.6.2", "", "arm64", rel)
	if !newer.Available || newer.LatestVersion != "1.6.3" || newer.DownloadURL != "https://ex/Qterm-macos-arm64.dmg" {
		t.Fatalf("newer: %+v", newer)
	}
	if newer.Skipped {
		t.Fatal("not skipped")
	}

	same := Evaluate("1.6.3", "", "arm64", rel)
	if same.Available {
		t.Fatalf("same should not be available: %+v", same)
	}

	olderSkip := Evaluate("1.6.2", "1.6.1", "arm64", rel)
	if !olderSkip.Available || olderSkip.Skipped {
		t.Fatalf("older skip should not suppress a newer release: %+v", olderSkip)
	}

	skipped := Evaluate("1.6.2", "1.6.3", "arm64", rel)
	if !skipped.Available || !skipped.Skipped {
		t.Fatalf("skipped: %+v", skipped)
	}

	noAsset := Evaluate("1.6.2", "", "amd64", rel)
	if !noAsset.Available || noAsset.DownloadURL != rel.HTMLURL {
		t.Fatalf("fallback download should be release page: %+v", noAsset)
	}

	draft := Evaluate("1.6.2", "", "arm64", Release{TagName: "v1.6.3", Draft: true})
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
	st, err := c.Check(context.Background(), "1.6.2", "", "arm64")
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
	_, err := c.Check(context.Background(), "1.6.2", "", "arm64")
	if err == nil {
		t.Fatal("expected HTTP error")
	}
}

func TestClientCheckNotFound(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	}))
	t.Cleanup(srv.Close)

	c := &Client{HTTP: srv.Client(), API: srv.URL}
	st, err := c.Check(context.Background(), "1.6.2", "", "arm64")
	if err != nil {
		t.Fatal(err)
	}
	if st.Available || st.CurrentVersion != "1.6.2" {
		t.Fatalf("%+v", st)
	}
}
