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
  WriteSession,
} from "../../../wailsjs/go/main/App";
import { asStatus, type GitResult } from "./types";

export function projectById(id: string): ProjectInfo | undefined {
  return uiStore.get().projects.find((p) => p.id === id);
}

export function gitProjectForSession(sessionId: string | null): ProjectInfo | null {
  if (!sessionId) return null;
  const session = uiStore.get().sessions.find((s) => s.id === sessionId);
  if (!session || isUnbound(session.projectId)) return null;
  return projectById(session.projectId) ?? null;
}

export function resolveGitTarget(view: GitPanelView = "main"): GitPanelTarget | null {
  const { focusedSessionId, focusedPaneId } = uiStore.get();
  const fromSession = gitProjectForSession(focusedSessionId);
  if (fromSession) {
    return { projectId: fromSession.id, paneId: focusedPaneId, view };
  }
  const scope = currentScope();
  if (!isUnbound(scope) && projectById(scope)) {
    return { projectId: scope, paneId: null, view };
  }
  return null;
}

export async function openGitToolkit(view: GitPanelView = "main"): Promise<GitPanelTarget | null> {
  const target = resolveGitTarget(view);
  if (!target) {
    toast.error("No git project");
    return null;
  }
  const project = projectById(target.projectId);
  if (!project?.path) {
    toast.error("No git project");
    return null;
  }
  const st = asStatus(await GetGitStatus(project.path));
  if (!st?.isRepo) {
    toast.error("Not a git repository");
    return null;
  }
  uiStore.set({
    gitPanel: target,
    paletteOpen: false,
    quickOpen: false,
    agentSessionsOpen: false,
    terminalFindOpen: false,
  });
  return target;
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

export async function runScopedGit(kind: "fetch" | "pull" | "push") {
  const target = resolveGitTarget();
  if (!target) {
    toast.error("No git project");
    return;
  }
  const project = projectById(target.projectId);
  if (!project?.path) {
    toast.error("No git project");
    return;
  }
  const st = asStatus(await GetGitStatus(project.path));
  if (!st?.isRepo) {
    toast.error("Not a git repository");
    return;
  }
  const fn = kind === "fetch" ? GitFetch : kind === "pull" ? GitPull : GitPush;
  const result = (await fn(project.path)) as GitResult;
  invalidateGit(project.path);
  if (result?.ok) toast.success(`git ${kind}`);
  else toast.error(result?.stderr || `git ${kind} failed`);
}
