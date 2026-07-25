package agentbridge

import "testing"

func TestApplyConnectionVersion(t *testing.T) {
	t.Parallel()

	t.Run("not installed", func(t *testing.T) {
		info := CLIInfo{Installed: false, Version: "1.0.0"}
		info.ApplyConnectionVersion("1.0.0")
		if info.Outdated || info.Version != "" {
			t.Fatalf("expected clean uninstalled state, got %+v", info)
		}
		if info.ExpectedVersion != qtermPluginVersion {
			t.Fatalf("expected version %s, got %s", qtermPluginVersion, info.ExpectedVersion)
		}
	})

	t.Run("current", func(t *testing.T) {
		info := CLIInfo{Installed: true}
		info.ApplyConnectionVersion(qtermPluginVersion)
		if info.Outdated || info.Version != qtermPluginVersion {
			t.Fatalf("expected current connection, got %+v", info)
		}
	})

	t.Run("stale recorded version", func(t *testing.T) {
		info := CLIInfo{Installed: true}
		info.ApplyConnectionVersion("1.0.0")
		if !info.Outdated || info.Version != "1.0.0" {
			t.Fatalf("expected outdated, got %+v", info)
		}
	})

	t.Run("pre-versioning connect", func(t *testing.T) {
		info := CLIInfo{Installed: true}
		info.ApplyConnectionVersion("")
		if !info.Outdated {
			t.Fatal("empty recorded version must be outdated")
		}
	})
}
