import { toast } from "sonner";
import { dismissExclusiveMenus } from "@/hooks/useExclusiveMenu";
import { currentScope, isUnbound } from "@/lib/sessions";
import { invalidateGit } from "@/queries";
import { uiStore, type GitPanelTarget, type GitPanelView, type ProjectInfo } from "@/store/ui";
import {
  GetGitStatus,
  GitFetch,
  GitPull,
  GitPush,
  GitStash,
  GitStashPop,
  WriteSession,
} from "../../../wailsjs/go/main/App";
import { asStatus, type GitResult } from "./types";

export function projectById(id: string): ProjectInfo | undefined {
  return uiStore.get().projects.find((p) => p.id === id);
}

export function gitWorkingPath(projectId: string, sessionId: string | null): string | null {
  const project = projectById(projectId);
  if (!project?.path) return null;
  if (!sessionId) return project.path;
  const session = uiStore.get().sessions.find((s) => s.id === sessionId);
  if (!session || session.projectId !== projectId) return project.path;
  const cwd = (session.cwd || "").replace(/\/+$/, "");
  return cwd || project.path;
}

export function isSessionWorktree(cwd: string, projectPath: string): boolean {
  const a = (cwd || "").replace(/\/+$/, "");
  const b = (projectPath || "").replace(/\/+$/, "");
  return !!a && !!b && a !== b;
}

/** Main checkout vs a linked worktree folder. */
export type GitToolkitScope = "root" | "worktree";

export function gitToolkitScope(cwd: string, projectPath: string): GitToolkitScope {
  return isSessionWorktree(cwd, projectPath) ? "worktree" : "root";
}

/** Branch switch + worktree admin always run on the main checkout. */
export function isRootGitView(view: GitPanelView) {
  return view === "branches" || view === "worktrees";
}

export function gitProjectForSession(sessionId: string | null): ProjectInfo | null {
  if (!sessionId) return null;
  const session = uiStore.get().sessions.find((s) => s.id === sessionId);
  if (!session || isUnbound(session.projectId)) return null;
  return projectById(session.projectId) ?? null;
}

export function resolveGitTarget(view: GitPanelView = "main"): GitPanelTarget | null {
  const { focusedSessionId, focusedPaneId, splitTree } = uiStore.get();
  const fromSession = gitProjectForSession(focusedSessionId);
  if (fromSession && focusedPaneId) {
    return { projectId: fromSession.id, paneId: focusedPaneId, view };
  }
  const scope = currentScope();
  if (!isUnbound(scope) && projectById(scope)) {
    return {
      projectId: scope,
      paneId: splitTree ? `project:${scope}` : `open-project:${scope}`,
      view,
    };
  }
  return null;
}

export async function openGitToolkitAt(
  target: GitPanelTarget,
  sessionId: string | null = uiStore.get().focusedSessionId
): Promise<GitPanelTarget | null> {
  const project = projectById(target.projectId);
  const working = gitWorkingPath(target.projectId, sessionId);
  if (!project?.path || !working) {
    toast.error("No git project");
    return null;
  }
  const linked = isSessionWorktree(working, project.path);
  const path = linked && isRootGitView(target.view) ? project.path : working;
  const st = asStatus(await GetGitStatus(path));
  if (!st?.isRepo) {
    toast.error("Not a git repository");
    return null;
  }
  const next: GitPanelTarget = {
    projectId: target.projectId,
    paneId: target.paneId,
    view: target.view,
  };
  uiStore.set({
    gitPanel: next,
    paletteOpen: false,
    quickOpen: false,
    agentSessionsOpen: false,
    terminalFindOpen: false,
  });
  return next;
}

export async function openGitToolkit(view: GitPanelView = "main"): Promise<GitPanelTarget | null> {
  const target = resolveGitTarget(view);
  if (!target) {
    toast.error("No git project");
    return null;
  }
  return openGitToolkitAt(target);
}

export function closeGitToolkit() {
  if (uiStore.get().gitPanel) uiStore.set({ gitPanel: null });
}

export function toggleGitToolkit() {
  if (uiStore.get().gitPanel) {
    closeGitToolkit();
    dismissExclusiveMenus();
    return;
  }
  void openGitToolkit();
}

export function runGitInTerminal(cmd: string) {
  const id = uiStore.get().focusedSessionId;
  if (!id) {
    toast.error("No terminal to run in");
    return;
  }
  const line = cmd.endsWith("\n") ? cmd : `${cmd}\n`;
  void WriteSession(id, line);
}

export async function runScopedGit(kind: "fetch" | "pull" | "push" | "stash" | "stash-pop") {
  const target = resolveGitTarget();
  if (!target) {
    toast.error("No git project");
    return;
  }
  const project = projectById(target.projectId);
  const path = gitWorkingPath(target.projectId, uiStore.get().focusedSessionId);
  if (!project?.path || !path) {
    toast.error("No git project");
    return;
  }
  const st = asStatus(await GetGitStatus(path));
  if (!st?.isRepo) {
    toast.error("Not a git repository");
    return;
  }
  const fn =
    kind === "fetch"
      ? GitFetch
      : kind === "pull"
        ? GitPull
        : kind === "push"
          ? GitPush
          : kind === "stash"
            ? (p: string) => GitStash(p, "")
            : (p: string) => GitStashPop(p, "");
  const result = (await fn(path)) as GitResult;
  invalidateGit(path);
  invalidateGit(project.path);
  if (result?.ok) toast.success(`git ${kind.replace("-", " ")}`);
  else toast.error(result?.stderr || `git ${kind} failed`);
}
