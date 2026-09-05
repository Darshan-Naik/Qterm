package config

// NeedsSetup is true for a fresh install that has not finished (or skipped) first-run setup.
func (cfg AppConfig) NeedsSetup() bool {
	return !cfg.SetupComplete && !cfg.hasPriorUse()
}

// hasPriorUse is true when config already looks like a used app (upgrade, not a first open).
func (cfg AppConfig) hasPriorUse() bool {
	if len(cfg.Projects) > 0 || len(cfg.Sessions) > 0 {
		return true
	}
	if len(cfg.AgentCLIs) > 0 || len(cfg.Keybindings) > 0 || len(cfg.Snippets) > 0 {
		return true
	}
	if cfg.Shell != "" || cfg.DefaultIDE != "" || cfg.SkippedAppUpdate != "" {
		return true
	}
	if cfg.Theme != "" && cfg.Theme != "system" {
		return true
	}
	if cfg.FontSize != 0 && cfg.FontSize != DefaultFontSize {
		return true
	}
	return false
}
