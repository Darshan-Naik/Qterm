import { useEffect } from "react";
import { createDefaultTerminal, DEFAULT_SCOPE, focusScope, focusSession } from "@/lib/sessions";
import { randomTerminalName } from "@/lib/terminalNames";
import {
  applyConfigChrome,
  applyTheme,
  openSettings,
  persistUIPrefs,
  sanitizeKeybindings,
  uiStore,
  useUI,
  type ThemeMode,
} from "@/store/ui";
import { GetConfig, ListProjects, ListSessions, SetSessionName } from "../../wailsjs/go/main/App";
import { EventsOn } from "../../wailsjs/runtime/runtime";
import { splitFocused } from "./splitActions";

function looksLikeShellTitle(name: string) {
  // Shell OSC titles: user@host or user@host:path — not Qterm session labels.
  return /^[^\s@]+@[^\s@]+/.test(name);
}

export function useAppBootstrap() {
  const theme = useUI((s) => s.theme);

  useEffect(() => {
    const onSplit = (e: Event) => {
      const dir = (e as CustomEvent).detail as "horizontal" | "vertical";
      void splitFocused(dir);
    };
    window.addEventListener("qterm:split", onSplit);
    return () => window.removeEventListener("qterm:split", onSplit);
  }, []);

  useEffect(() => {
    void (async () => {
      const cfg = await GetConfig();
      const themeMode = ((cfg.theme as ThemeMode) || "system") as ThemeMode;
      applyTheme(themeMode);
      applyConfigChrome(cfg);
      uiStore.set({
        theme: themeMode,
        fontSize: cfg.fontSize || 13,
        shell: cfg.shell || "",
        activeScope: cfg.activeScope || DEFAULT_SCOPE,
        projects: cfg.projects || [],
        keybindings: sanitizeKeybindings(cfg.keybindings),
      });
      // Ensure chrome fields exist on disk for older config.json files.
      void persistUIPrefs();
      const [projects, sessions] = await Promise.all([ListProjects(), ListSessions()]);
      const usedNames: string[] = [];
      const mapped = await Promise.all(
        (sessions || []).map(async (s: { id: string; name: string; projectId: string; cwd: string; pinned?: boolean }) => {
          let name = s.name;
          if (looksLikeShellTitle(name)) {
            name = randomTerminalName(usedNames);
            usedNames.push(name);
            void SetSessionName(s.id, name);
          } else {
            usedNames.push(name);
          }
          return {
            id: s.id,
            name,
            projectId: s.projectId || "",
            cwd: s.cwd,
            pinned: s.pinned,
          };
        })
      );
      uiStore.set({
        projects: projects || [],
        sessions: mapped,
      });
      const scope = cfg.activeScope || DEFAULT_SCOPE;
      if ((sessions || []).length) {
        await focusScope(scope);
        if (!uiStore.get().splitTree && sessions?.[0]) {
          const first = sessions[0];
          const fallback =
            !first.projectId || first.projectId === "home" ? DEFAULT_SCOPE : first.projectId;
          await focusScope(fallback);
        }
      } else {
        await createDefaultTerminal();
      }
    })();

    const offRenamed = (EventsOn as any)("session:renamed", (payload?: { id?: string; name?: string }) => {
      const id = payload?.id;
      const name = String(payload?.name || "").trim();
      if (!id || !name) return;
      uiStore.set({
        sessions: uiStore.get().sessions.map((s) => (s.id === id ? { ...s, name } : s)),
      });
    });
    const offSessions = (EventsOn as any)("sessions:changed", async () => {
      const sessions = await ListSessions();
      const mapped = (sessions || []).map((s: { id: string; name: string; projectId: string; cwd: string; pinned?: boolean }) => ({
        id: s.id,
        name: s.name,
        projectId: s.projectId || "",
        cwd: s.cwd,
        pinned: s.pinned,
      }));
      const alive = new Set(mapped.map((s) => s.id));
      const agents = Object.fromEntries(
        Object.entries(uiStore.get().sessionAgents).filter(([id]) => alive.has(id))
      );
      const anims = Object.fromEntries(
        Object.entries(uiStore.get().paneAnimations).filter(([id]) => alive.has(id))
      );
      // Merge names into existing order when possible so a rename never reshuffles.
      const prev = uiStore.get().sessions;
      const byId = new Map(mapped.map((s) => [s.id, s]));
      const merged: typeof mapped = [];
      const used = new Set<string>();
      const usedNames = prev.map((s) => s.name);
      for (const s of prev) {
        const next = byId.get(s.id);
        if (!next) continue;
        // Keep a good local name if the backend still has a shell OSC title.
        let name = next.name;
        if (looksLikeShellTitle(name)) {
          name = looksLikeShellTitle(s.name) ? randomTerminalName(usedNames) : s.name;
          if (name !== next.name) void SetSessionName(s.id, name);
          usedNames.push(name);
        }
        merged.push({ ...next, name });
        used.add(next.id);
      }
      for (const s of mapped) {
        if (!used.has(s.id)) {
          let name = s.name;
          if (looksLikeShellTitle(name)) {
            name = randomTerminalName(usedNames);
            usedNames.push(name);
            void SetSessionName(s.id, name);
          }
          merged.push({ ...s, name });
        }
      }
      uiStore.set({ sessions: merged, sessionAgents: agents, paneAnimations: anims });
    });
    const offSettings = (EventsOn as any)("app:open-settings", (page?: string) => {
      const p =
        page === "terminal" || page === "agent" || page === "appearance" || page === "shortcuts"
          ? page
          : "appearance";
      openSettings(p);
    });
    const offInspector = (EventsOn as any)("app:open-inspector", () => {
      const invoke = (window as unknown as { WailsInvoke?: (msg: string) => void }).WailsInvoke;
      invoke?.("wails:openInspector");
    });
    const offTheme = (EventsOn as any)("app:theme", (theme?: string) => {
      if (theme === "dark" || theme === "light" || theme === "system") {
        applyTheme(theme);
        uiStore.set({ theme });
      }
    });
    const offFocus = (EventsOn as any)("app:focus-session", (sessionId?: string) => {
      if (sessionId) void focusSession(sessionId);
    });
    return () => {
      if (typeof offRenamed === "function") offRenamed();
      if (typeof offSessions === "function") offSessions();
      if (typeof offSettings === "function") offSettings();
      if (typeof offInspector === "function") offInspector();
      if (typeof offTheme === "function") offTheme();
      if (typeof offFocus === "function") offFocus();
    };
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
}
