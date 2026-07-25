import { useEffect } from "react";
import { createDefaultTerminal, DEFAULT_SCOPE, focusScope } from "@/lib/sessions";
import {
  applyTheme,
  hydrateUIPrefs,
  openSettings,
  persistUIPrefs,
  uiStore,
  useUI,
  type ThemeMode,
} from "@/store/ui";
import { GetConfig, ListProjects, ListSessions } from "../../wailsjs/go/main/App";
import { EventsOn } from "../../wailsjs/runtime/runtime";
import { splitFocused } from "./splitActions";

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
      await hydrateUIPrefs();
      const cfg = await GetConfig();
      const themeMode = ((cfg.theme as ThemeMode) || uiStore.get().theme) as ThemeMode;
      applyTheme(themeMode);
      uiStore.set({
        theme: themeMode,
        fontSize: cfg.fontSize || 13,
        shell: cfg.shell || "",
        activeScope: cfg.activeScope || DEFAULT_SCOPE,
        projects: cfg.projects || [],
      });
      const [projects, sessions] = await Promise.all([ListProjects(), ListSessions()]);
      uiStore.set({
        projects: projects || [],
        sessions: (sessions || []).map((s: { id: string; name: string; projectId: string; cwd: string; pinned?: boolean }) => ({
          id: s.id,
          name: s.name,
          projectId: s.projectId || "",
          cwd: s.cwd,
          pinned: s.pinned,
        })),
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
      void persistUIPrefs();
    })();

    const offSessions = (EventsOn as any)("sessions:changed", async () => {
      const sessions = await ListSessions();
      uiStore.set({
        sessions: (sessions || []).map((s: { id: string; name: string; projectId: string; cwd: string; pinned?: boolean }) => ({
          id: s.id,
          name: s.name,
          projectId: s.projectId || "",
          cwd: s.cwd,
          pinned: s.pinned,
        })),
      });
    });
    const offSettings = (EventsOn as any)("app:open-settings", (page?: string) => {
      const p = page === "terminal" || page === "plugins" || page === "appearance" ? page : "appearance";
      openSettings(p);
    });
    const offInspector = (EventsOn as any)("app:open-inspector", () => {
      const invoke = (window as unknown as { WailsInvoke?: (msg: string) => void }).WailsInvoke;
      invoke?.("wails:openInspector");
    });
    return () => {
      if (typeof offSessions === "function") offSessions();
      if (typeof offSettings === "function") offSettings();
      if (typeof offInspector === "function") offInspector();
    };
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
}
