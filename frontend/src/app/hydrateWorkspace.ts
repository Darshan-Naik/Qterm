import { createDefaultTerminal, DEFAULT_SCOPE, loadScopeLayout, isUnbound } from "@/lib/sessions";
import { mapLiveSessions, sortProjectsByAdded, sortSessionsByStart } from "@/lib/sessionTitles";
import {
  applyConfigChrome,
  applyTheme,
  clampFontSize,
  persistUIPrefs,
  sanitizeKeybindings,
  uiStore,
  type SessionInfo,
  type ThemeMode,
} from "@/store/ui";
import { GetConfig, ListProjects, ListSessions } from "../../wailsjs/go/main/App";
import { whenAppReady } from "./whenAppReady";

function toSessionInfo(s: {
  id: string;
  name: string;
  projectId?: string;
  cwd: string;
  pinned?: boolean;
  createdAt?: string;
}): SessionInfo {
  return {
    id: s.id,
    name: s.name,
    projectId: s.projectId || "",
    cwd: s.cwd,
    pinned: s.pinned,
    createdAt: s.createdAt,
  };
}

/** Load config → seed UI → sync live PTYs → restore focus (or create first terminal). */
export async function hydrateWorkspace() {
  await whenAppReady();

  const cfg = await GetConfig();
  const themeMode = ((cfg.theme as ThemeMode) || "system") as ThemeMode;
  applyTheme(themeMode);
  applyConfigChrome(cfg);

  const rawProjects = Array.isArray(cfg.projects) ? cfg.projects : [];
  const rawSessions = Array.isArray(cfg.sessions) ? cfg.sessions : [];
  const cfgSessions = sortSessionsByStart(rawSessions.map(toSessionInfo));
  const cfgProjects = sortProjectsByAdded(rawProjects);
  uiStore.set({
    theme: themeMode,
    fontSize: clampFontSize(cfg.fontSize),
    shell: cfg.shell || "",
    activeScope: cfg.activeScope || DEFAULT_SCOPE,
    projects: cfgProjects,
    sessions: cfgSessions,
    keybindings: sanitizeKeybindings(cfg.keybindings),
  });
  // Persist chrome after seed — never before, and never block listing.
  void persistUIPrefs();

  const [projects, sessions] = await Promise.all([ListProjects(), ListSessions()]);
  const live = sortSessionsByStart(mapLiveSessions(Array.isArray(sessions) ? sessions : [], uiStore.get().sessions));
  const nextProjects = Array.isArray(projects) && projects.length ? sortProjectsByAdded(projects) : cfgProjects;
  uiStore.set({
    projects: nextProjects,
    sessions: live.length ? live : cfgSessions,
  });

  const scope = cfg.activeScope || DEFAULT_SCOPE;
  if (live.length || cfgSessions.length) {
    await loadScopeLayout(scope);
    if (!uiStore.get().splitTree) {
      const first = (live.length ? live : cfgSessions)[0];
      if (first) {
        const fallback = isUnbound(first.projectId) ? DEFAULT_SCOPE : first.projectId;
        await loadScopeLayout(fallback);
      }
    }
    return;
  }

  await createDefaultTerminal();
}
