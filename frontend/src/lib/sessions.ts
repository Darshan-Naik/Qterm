import { CreateSession, GetLayout, SaveActiveScope, SaveLayout } from "../../wailsjs/go/main/App";
import {
  findFirstLeaf,
  findLeafBySession,
  leaf,
  uiStore,
  type SessionInfo,
  type SplitNode,
} from "@/store/ui";
import { randomTerminalName } from "@/lib/terminalNames";

/** Scope key for terminals not tied to a project (default path). */
export const DEFAULT_SCOPE = "_default";

export function isUnbound(projectId: string) {
  return !projectId || projectId === "home" || projectId === "quick" || projectId === DEFAULT_SCOPE;
}

export function scopeKey(projectId: string) {
  return isUnbound(projectId) ? DEFAULT_SCOPE : projectId;
}

function layoutHasSessions(node: SplitNode, sessionIds: Set<string>): boolean {
  if (node.type === "leaf") return sessionIds.has(node.sessionId);
  return layoutHasSessions(node.children[0], sessionIds) && layoutHasSessions(node.children[1], sessionIds);
}

export async function focusScope(scope: string) {
  uiStore.set({ activeScope: scope });
  void SaveActiveScope(scope);
  const layout = (await GetLayout(scope)) as SplitNode | null;
  const sessionIds = new Set(uiStore.get().sessions.map((s) => s.id));
  if (layout && layout.type && layoutHasSessions(layout, sessionIds)) {
    const first = findFirstLeaf(layout);
    uiStore.set({
      splitTree: layout,
      focusedPaneId: first?.id ?? null,
      focusedSessionId: first && first.type === "leaf" ? first.sessionId : null,
    });
    return;
  }

  const sessions = uiStore.get().sessions.filter((s) =>
    scope === DEFAULT_SCOPE ? isUnbound(s.projectId) : s.projectId === scope
  );
  if (sessions[0]) {
    const n = leaf(sessions[0].id);
    uiStore.set({ splitTree: n, focusedPaneId: n.id, focusedSessionId: sessions[0].id });
    await SaveLayout(scope, n as any);
  } else {
    uiStore.set({ splitTree: null, focusedPaneId: null, focusedSessionId: null });
  }
}

export async function createTerminal(projectId: string, name?: string) {
  const unbound = isUnbound(projectId);
  const project = uiStore.get().projects.find((p) => p.id === projectId);
  const cwd = unbound ? "" : project?.path || "";
  const pid = unbound ? "" : projectId;
  const scope = unbound ? DEFAULT_SCOPE : projectId;
  const label = name || randomTerminalName(uiStore.get().sessions.map((s) => s.name));
  const sess = await CreateSession(pid, label, cwd);
  const info: SessionInfo = {
    id: sess.id,
    name: sess.name,
    projectId: sess.projectId || "",
    cwd: sess.cwd,
    pinned: sess.pinned,
  };
  const sessions = [...uiStore.get().sessions.filter((s) => s.id !== info.id), info];
  const n = leaf(info.id);
  uiStore.set({
    sessions,
    activeScope: scope,
    splitTree: n,
    focusedPaneId: n.id,
    focusedSessionId: info.id,
  });
  void SaveActiveScope(scope);
  await SaveLayout(scope, n as any);
  return info;
}

/** New terminal on the default (user home) path. */
export async function createDefaultTerminal() {
  return createTerminal("");
}

/** Focus an existing session in the current or matching scope layout. */
export async function focusSession(sessionId: string) {
  const state = uiStore.get();
  const session = state.sessions.find((s) => s.id === sessionId);
  if (!session) return;

  const scope = scopeKey(session.projectId);
  if (state.activeScope === scope && state.splitTree) {
    const pane = findLeafBySession(state.splitTree, sessionId);
    if (pane) {
      uiStore.set({ focusedPaneId: pane.id, focusedSessionId: sessionId });
      return;
    }
  }

  await focusScope(scope);
  const tree = uiStore.get().splitTree;
  const pane = findLeafBySession(tree, sessionId);
  if (pane) {
    uiStore.set({ focusedPaneId: pane.id, focusedSessionId: sessionId });
    return;
  }

  const n = leaf(sessionId);
  uiStore.set({
    activeScope: scope,
    splitTree: n,
    focusedPaneId: n.id,
    focusedSessionId: sessionId,
  });
  void SaveActiveScope(scope);
  void SaveLayout(scope, n as any);
}
