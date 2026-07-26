import { CreateSession, GetLayout, SaveActiveScope, SaveLayout, SetFocusedSession } from "../../wailsjs/go/main/App";
import {
  DEFAULT_SCOPE,
  findFirstLeaf,
  findLeafBySession,
  leaf,
  listLeaves,
  replaceLeafSession,
  uiStore,
  type SessionInfo,
  type SplitNode,
} from "@/store/ui";
import { randomTerminalName } from "@/lib/terminalNames";

export { DEFAULT_SCOPE };

export function isUnbound(projectId: string) {
  return !projectId || projectId === "home" || projectId === "quick" || projectId === DEFAULT_SCOPE;
}

export function scopeKey(projectId: string) {
  return isUnbound(projectId) ? DEFAULT_SCOPE : projectId;
}

/** Active project/scope, always resolved (never empty). */
export function currentScope() {
  return uiStore.get().activeScope || DEFAULT_SCOPE;
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
    const focused = first && first.type === "leaf" ? first.sessionId : null;
    uiStore.set({
      splitTree: layout,
      focusedPaneId: first?.id ?? null,
      focusedSessionId: focused,
    });
    if (focused) void SetFocusedSession(focused);
    return;
  }

  const sessions = uiStore.get().sessions.filter((s) =>
    scope === DEFAULT_SCOPE ? isUnbound(s.projectId) : s.projectId === scope
  );
  if (sessions[0]) {
    const n = leaf(sessions[0].id);
    uiStore.set({ splitTree: n, focusedPaneId: n.id, focusedSessionId: sessions[0].id });
    void SetFocusedSession(sessions[0].id);
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
  void SetFocusedSession(info.id);
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

  // Same scope: focus existing pane, or swap the clicked session into the focused pane.
  if (state.activeScope === scope && state.splitTree) {
    const existing = findLeafBySession(state.splitTree, sessionId);
    if (existing) {
      uiStore.set({ focusedPaneId: existing.id, focusedSessionId: sessionId });
      void SetFocusedSession(sessionId);
      return;
    }

    const targetId =
      state.focusedPaneId && listLeaves(state.splitTree).some((l) => l.id === state.focusedPaneId)
        ? state.focusedPaneId
        : findFirstLeaf(state.splitTree)?.id;
    if (targetId) {
      const next = replaceLeafSession(state.splitTree, targetId, sessionId);
      uiStore.set({
        splitTree: next,
        focusedPaneId: targetId,
        focusedSessionId: sessionId,
      });
      void SetFocusedSession(sessionId);
      void SaveLayout(scope, next as any);
      return;
    }
  }

  await focusScope(scope);
  const tree = uiStore.get().splitTree;
  const pane = findLeafBySession(tree, sessionId);
  if (pane) {
    uiStore.set({ focusedPaneId: pane.id, focusedSessionId: sessionId });
    void SetFocusedSession(sessionId);
    return;
  }

  const n = leaf(sessionId);
  uiStore.set({
    activeScope: scope,
    splitTree: n,
    focusedPaneId: n.id,
    focusedSessionId: sessionId,
  });
  void SetFocusedSession(sessionId);
  void SaveActiveScope(scope);
  void SaveLayout(scope, n as any);
}
