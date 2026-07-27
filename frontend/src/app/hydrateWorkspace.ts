import { createDefaultTerminal, DEFAULT_SCOPE, focusScope, isUnbound } from "@/lib/sessions";
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
  const cfg = await GetConfig();
  const themeMode = ((cfg.theme as ThemeMode) || "system") as ThemeMode;
  applyTheme(themeMode);
  applyConfigChrome(cfg);

  const cfgSessions = sortSessionsByStart((cfg.sessions || []).map(toSessionInfo));
  const cfgProjects = sortProjectsByAdded(cfg.projects || []);
  // Seed from config first so the sidebar isn't empty if ListSessions races restore.
  uiStore.set({
    theme: themeMode,
    fontSize: clampFontSize(cfg.fontSize),
    shell: cfg.shell || "",
    activeScope: cfg.activeScope || DEFAULT_SCOPE,
    projects: cfgProjects,
    sessions: cfgSessions,
    keybindings: sanitizeKeybindings(cfg.keybindings),
  });
  void persistUIPrefs();

  let [projects, sessions] = await Promise.all([ListProjects(), ListSessions()]);
  if (!(sessions || []).length && cfgSessions.length) {
    await new Promise((r) => setTimeout(r, 150));
    sessions = await ListSessions();
  }

  const live = mapLiveSessions(sessions || [], uiStore.get().sessions);
  uiStore.set({
    projects: sortProjectsByAdded(projects || []),
    sessions: live.length ? live : cfgSessions,
  });

  const scope = cfg.activeScope || DEFAULT_SCOPE;
  if (live.length || cfgSessions.length) {
    await focusScope(scope);
    if (!uiStore.get().splitTree) {
      const first = (live.length ? live : cfgSessions)[0];
      if (first) {
        const fallback = isUnbound(first.projectId) ? DEFAULT_SCOPE : first.projectId;
        await focusScope(fallback);
      }
    }
    return;
  }

  await createDefaultTerminal();
}
