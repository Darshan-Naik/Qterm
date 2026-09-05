import { DEFAULT_SCOPE, loadScopeLayout, isUnbound } from "@/lib/sessions";
import { agentsFromLiveSessions, mapLiveSessions, sortProjectsByAdded, sortSessionsByStart } from "@/lib/sessionTitles";
import {
  applyConfigChrome,
  applyTheme,
  clampFontSize,
  DEFAULT_IDE,
  persistUIPrefs,
  sanitizeKeybindings,
  uiStore,
  type ThemeMode,
} from "@/store/ui";
import { sanitizeSnippets } from "@/lib/snippets";
import { GetConfig, ListProjects, ListSessions } from "../../wailsjs/go/main/App";
import { whenAppReady } from "./whenAppReady";

/** Load config → seed UI → sync live PTYs → restore layout (or leave empty start screen). */
export async function hydrateWorkspace() {
  let cfg: Awaited<ReturnType<typeof GetConfig>>;
  try {
    await whenAppReady();
    cfg = await GetConfig();
  } catch {
    uiStore.set({ uiReady: true });
    return;
  }

  const themeMode = ((cfg.theme as ThemeMode) || "system") as ThemeMode;
  applyTheme(themeMode);
  applyConfigChrome(cfg);

  const rawProjects = Array.isArray(cfg.projects) ? cfg.projects : [];
  const cfgProjects = sortProjectsByAdded(rawProjects);
  const needsSetup = !cfg.setupComplete;
  uiStore.set({
    uiReady: true,
    appMode: needsSetup ? "setup" : "workspace",
    theme: themeMode,
    fontSize: clampFontSize(cfg.fontSize),
    shell: cfg.shell || "",
    defaultIDE: typeof cfg.defaultIDE === "string" ? cfg.defaultIDE : DEFAULT_IDE,
    activeScope: cfg.activeScope || DEFAULT_SCOPE,
    projects: cfgProjects,
    sessions: [],
    keybindings: sanitizeKeybindings(cfg.keybindings),
    snippets: sanitizeSnippets(cfg.snippets),
  });
  // Persist chrome after seed — never before, and never block listing.
  void persistUIPrefs();

  const [projects, sessions] = await Promise.all([ListProjects(), ListSessions()]);
  // Only live PTYs. Go restoreSessions() already recreated them before Ready().
  // Never fall back to config-only ghosts (that forced a pane open on reload).
  const live = sortSessionsByStart(
    mapLiveSessions(Array.isArray(sessions) ? sessions : [], [])
  );
  const nextProjects =
    Array.isArray(projects) && projects.length ? sortProjectsByAdded(projects) : cfgProjects;
  uiStore.set({
    projects: nextProjects,
    sessions: live,
    sessionAgents: agentsFromLiveSessions(Array.isArray(sessions) ? sessions : []),
  });

  const scope = cfg.activeScope || DEFAULT_SCOPE;
  if (live.length) {
    await loadScopeLayout(scope);
    if (!uiStore.get().splitTree) {
      const first = live[0];
      if (first) {
        const fallback = isUnbound(first.projectId) ? DEFAULT_SCOPE : first.projectId;
        if (fallback !== scope) await loadScopeLayout(fallback);
      }
    }
    return;
  }

  // No live sessions — centered Get started. Do not CreateSession.
  uiStore.set({
    splitTree: null,
    focusedPaneId: null,
    focusedSessionId: null,
    activeScope: DEFAULT_SCOPE,
  });
}
