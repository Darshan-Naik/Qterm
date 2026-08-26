import { focusSession } from "@/lib/sessions";
import { agentsFromLiveSessions, mapLiveSessions, sortSessionsByStart } from "@/lib/sessionTitles";
import { applyTheme, openAbout, openSettings, uiStore, type ThemeMode } from "@/store/ui";
import { ListSessions } from "../../wailsjs/go/main/App";
import { EventsOn } from "../../wailsjs/runtime/runtime";

type Off = (() => void) | undefined;

function on(event: string, handler: (...args: any[]) => void): Off {
  return (EventsOn as any)(event, handler) as Off;
}

/** Wails / menu events that keep the UI in sync after bootstrap. */
export function subscribeAppEvents(): () => void {
  const offs: Off[] = [
    on("session:renamed", (payload?: { id?: string; name?: string }) => {
      const id = payload?.id;
      const name = String(payload?.name || "").trim();
      if (!id || !name) return;
      uiStore.set({
        sessions: uiStore.get().sessions.map((s) => (s.id === id ? { ...s, name } : s)),
      });
    }),

    on("sessions:changed", async () => {
      const sessions = await ListSessions();
      const raw = sessions || [];
      const live = mapLiveSessions(raw, uiStore.get().sessions);
      const alive = new Set(live.map((s) => s.id));
      const agents = agentsFromLiveSessions(raw);
      for (const [id, v] of Object.entries(uiStore.get().sessionAgents)) {
        if (alive.has(id)) agents[id] = v;
      }
      const anims = Object.fromEntries(
        Object.entries(uiStore.get().paneAnimations).filter(([id]) => alive.has(id)),
      );
      uiStore.set({
        sessions: sortSessionsByStart(live),
        sessionAgents: agents,
        paneAnimations: anims,
      });
    }),

    on("app:open-settings", (page?: string) => {
      const p =
        page === "terminal" || page === "agent" || page === "appearance" || page === "shortcuts"
          ? page
          : "appearance";
      openSettings(p);
    }),

    on("app:open-about", () => {
      openAbout();
    }),

    on("app:open-inspector", () => {
      const invoke = (window as unknown as { WailsInvoke?: (msg: string) => void }).WailsInvoke;
      invoke?.("wails:openInspector");
    }),

    on("app:theme", (theme?: string) => {
      if (theme === "dark" || theme === "light" || theme === "system") {
        applyTheme(theme);
        uiStore.set({ theme: theme as ThemeMode });
      }
    }),

    on("app:focus-session", (sessionId?: string) => {
      if (sessionId) void focusSession(sessionId);
    }),
  ];

  return () => {
    for (const off of offs) {
      if (typeof off === "function") off();
    }
  };
}
