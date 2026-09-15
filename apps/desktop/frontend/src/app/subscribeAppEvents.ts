import { focusSession } from "@/lib/sessions";
import { agentsFromLiveSessions, mapLiveSessions, sortSessionsByStart } from "@/lib/sessionTitles";
import { applyTheme, openAbout, openSettings, splitPane, uiStore, isThemeMode, findLeafBySession, listLeaves, leaf } from "@/store/ui";
import { ListSessions, SaveLayout } from "../../wailsjs/go/main/App";
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
        page === "terminal" ||
        page === "agent" ||
        page === "appearance" ||
        page === "shortcuts" ||
        page === "snippets" ||
        page === "updates"
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
      if (theme && isThemeMode(theme)) {
        applyTheme(theme);
        uiStore.set({ theme });
      }
    }),

    on("app:focus-session", (sessionId?: string) => {
      if (sessionId) void focusSession(sessionId);
    }),

    on("app:split-session", (payload?: {
      besideId?: string;
      newId?: string;
      name?: string;
      projectId?: string;
      cwd?: string;
      direction?: string;
    }) => {
      const besideId = payload?.besideId;
      const newId = payload?.newId;
      if (!besideId || !newId) return;
      const state = uiStore.get();
      const info = {
        id: newId,
        name: String(payload?.name || "Terminal"),
        projectId: String(payload?.projectId || ""),
        cwd: String(payload?.cwd || ""),
      };
      const sessions = [...state.sessions.filter((s) => s.id !== newId), info];
      let tree = state.splitTree;
      const direction = payload?.direction === "down" ? "vertical" : "horizontal";
      const beside = tree ? findLeafBySession(tree, besideId) : null;
      if (tree && beside) {
        tree = splitPane(tree, beside.id, direction, newId);
      } else if (tree) {
        const paneId = state.focusedPaneId || listLeaves(tree)[0]?.id;
        tree = paneId ? splitPane(tree, paneId, direction, newId) : leaf(newId);
      } else {
        tree = leaf(newId);
      }
      const shown = findLeafBySession(tree, newId);
      uiStore.set({
        sessions,
        splitTree: tree,
        focusedPaneId: shown?.id ?? null,
        focusedSessionId: newId,
      });
      void SaveLayout(state.activeScope, tree as never);
      void focusSession(newId);
    }),
  ];

  return () => {
    for (const off of offs) {
      if (typeof off === "function") off();
    }
  };
}
