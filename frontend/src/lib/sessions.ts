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
import { dismissSessionComplete } from "@/lib/sessionAnim";

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

/** Mark which project “new terminal” / cwd context uses — does not touch the split tree. */
export async function setActiveScope(scope: string) {
  if (uiStore.get().activeScope === scope) return;
  uiStore.set({ activeScope: scope });
  void SaveActiveScope(scope);
}

/**
 * Load a saved layout for hydrate / explicit workspace restore.
 * Prefer this over setActiveScope when the window tree must change.
 */
export async function loadScopeLayout(scope: string) {
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

  // No saved panes — keep the empty workspace. Do not auto-open a session.
  uiStore.set({ splitTree: null, focusedPaneId: null, focusedSessionId: null });
}

/** @deprecated Use setActiveScope (no layout swap) or loadScopeLayout (hydrate). */
export async function focusScope(scope: string) {
  await loadScopeLayout(scope);
}

/**
 * Create a terminal in a project (or home). Replaces the focused pane’s
 * session (sidebar “New” / project +). Use split actions or drag to split.
 */
export async function createTerminal(projectId: string, name?: string, cwd?: string) {
  const unbound = isUnbound(projectId);
  const project = uiStore.get().projects.find((p) => p.id === projectId);
  const dir = unbound ? "" : (cwd?.trim() || project?.path || "");
  const pid = unbound ? "" : projectId;
  const label = name || randomTerminalName(uiStore.get().sessions.map((s) => s.name));
  const sess = await CreateSession(pid, label, dir);
  const info: SessionInfo = {
    id: sess.id,
    name: sess.name,
    projectId: sess.projectId || "",
    cwd: sess.cwd,
    pinned: sess.pinned,
    createdAt: sess.createdAt,
  };
  // Backend sorts by start time; append until sessions:changed refreshes.
  const state = uiStore.get();
  const sessions = [...state.sessions.filter((s) => s.id !== info.id), info];
  const layoutScope = currentScope();

  let tree = state.splitTree;
  const paneId = state.focusedPaneId || listLeaves(tree)[0]?.id;
  if (tree && paneId) {
    tree = replaceLeafSession(tree, paneId, info.id);
  } else {
    tree = leaf(info.id);
  }
  const shown = findLeafBySession(tree, info.id);

  uiStore.set({
    sessions,
    splitTree: tree,
    focusedPaneId: shown?.id ?? paneId ?? null,
    focusedSessionId: info.id,
  });
  void SetFocusedSession(info.id);
  await SaveLayout(layoutScope, tree as any);
  return info;
}

/** New terminal on the default (user home) path. */
export async function createDefaultTerminal() {
  return createTerminal("");
}

/**
 * Focus an existing session in the current window layout.
 * Cross-project sessions share one split tree — do not load another scope layout.
 */
export async function focusSession(sessionId: string) {
  const state = uiStore.get();
  const session = state.sessions.find((s) => s.id === sessionId);
  if (!session) return;
  // Always ack the green "done" highlight — even when this session is already focused
  // (sidebar click / already-open pane does not change focusedSessionId).
  // Needs-input stays until the user actually types in that terminal.
  dismissSessionComplete(sessionId);

  const layoutScope = currentScope();

  if (state.splitTree) {
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
      void SaveLayout(layoutScope, next as any);
      return;
    }
  }

  const n = leaf(sessionId);
  uiStore.set({
    splitTree: n,
    focusedPaneId: n.id,
    focusedSessionId: sessionId,
  });
  void SetFocusedSession(sessionId);
  void SaveLayout(layoutScope, n as any);
}
