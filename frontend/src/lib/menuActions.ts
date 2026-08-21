import { toast } from "sonner";
import {
  DEFAULT_SCOPE,
  createTerminal,
  createDefaultTerminal,
  currentScope,
  isUnbound,
  setActiveScope,
} from "@/lib/sessions";
import { closeSessionPanes, requestDeleteSession } from "@/lib/panes";
import { confirm } from "@/lib/confirm";
import { requestSessionRename } from "@/features/panes/PaneTitle";
import { findLeafBySession, listLeaves, removePane, uiStore } from "@/store/ui";
import { OpenInFinder, RemoveProject, RenameProject, SaveLayout } from "../../wailsjs/go/main/App";

function focusedSessionId() {
  return uiStore.get().focusedSessionId;
}

function activeProject() {
  const scope = currentScope();
  if (scope === DEFAULT_SCOPE || isUnbound(scope)) return null;
  return uiStore.get().projects.find((p) => p.id === scope) || null;
}

/** Terminal — rename focused (pane title / sidebar row). */
export function renameFocusedTerminal() {
  const id = focusedSessionId();
  if (!id) {
    toast.message("No terminal focused");
    return;
  }
  requestSessionRename(id);
}

/** Terminal — close panes showing focused session (PTY kept). */
export async function closeFocusedTerminalPanes() {
  const id = focusedSessionId();
  if (!id) return;
  await closeSessionPanes(id);
}

/** Terminal — delete focused session (opens confirmation). */
export async function deleteFocusedTerminal() {
  const id = focusedSessionId();
  if (!id) return;
  await requestDeleteSession(id);
}

/** Project — new terminal in the active project (or home). */
export async function newTerminalInActiveProject() {
  const project = activeProject();
  if (project) await createTerminal(project.id);
  else await createDefaultTerminal();
}

/** Project — rename active project. */
export async function renameActiveProject() {
  const project = activeProject();
  if (!project) {
    toast.message("No project selected");
    return;
  }
  await renameProjectById(project.id, project.name);
}

/** Project — reveal folder in Finder. */
export async function revealActiveProject() {
  const project = activeProject();
  if (!project) {
    toast.message("No project selected");
    return;
  }
  await OpenInFinder(project.path);
}

/** Project — remove active project from sidebar. */
export async function removeActiveProject() {
  const project = activeProject();
  if (!project) {
    toast.message("No project selected");
    return;
  }
  await removeProjectById(project.id);
}

/** Project — rename by id (menu on a specific row). */
export async function renameProjectById(id: string, currentName: string) {
  const next = prompt("Rename project", currentName);
  if (!next?.trim() || next.trim() === currentName) return;
  await RenameProject(id, next.trim());
  uiStore.set({
    projects: uiStore.get().projects.map((p) => (p.id === id ? { ...p, name: next.trim() } : p)),
  });
}

/** Project — remove by id (menu on a specific row). */
export async function removeProjectById(id: string) {
  const state = uiStore.get();
  const project = state.projects.find((p) => p.id === id);
  const name = project?.name || "this project";
  const sessionCount = state.sessions.filter((s) => s.projectId === id).length;
  const ok = await confirm({
    title: "Remove project?",
    description:
      sessionCount > 0
        ? `Remove “${name}” from the sidebar? Its ${sessionCount} terminal${sessionCount === 1 ? "" : "s"} will also be removed. The folder on disk is kept.`
        : `Remove “${name}” from the sidebar? The folder on disk is kept.`,
    confirmLabel: "Remove",
    destructive: true,
  });
  if (!ok) return;

  await RemoveProject(id);
  const nextState = uiStore.get();
  const removedIds = new Set(nextState.sessions.filter((s) => s.projectId === id).map((s) => s.id));
  let tree = nextState.splitTree;
  if (tree && removedIds.size) {
    for (const sid of removedIds) {
      const pane = findLeafBySession(tree, sid);
      if (pane) {
        tree = removePane(tree, pane.id);
        if (!tree) break;
      }
    }
  }
  const leaves = listLeaves(tree);
  uiStore.set({
    projects: nextState.projects.filter((p) => p.id !== id),
    sessions: nextState.sessions.filter((s) => s.projectId !== id),
    splitTree: tree,
    focusedPaneId: leaves[0]?.id ?? null,
    focusedSessionId: leaves[0]?.sessionId ?? null,
  });
  await setActiveScope(DEFAULT_SCOPE);
  await SaveLayout(DEFAULT_SCOPE, (tree || { type: "" }) as any);
}
