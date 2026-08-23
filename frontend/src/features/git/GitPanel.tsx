import { useEffect, useState } from "react";
import { GitBranch, Loader2 } from "lucide-react";
import { confirm } from "@/lib/confirm";
import { invalidateGit, useGitBranches, useGitSnapshot, useGitStashes, useGitWorktrees } from "@/queries";
import { useUI, type GitPanelView } from "@/store/ui";
import {
  GitCheckout,
  GitCommit,
  GitCreateBranch,
  GitDeleteBranch,
  GitDiscard,
  GitDiscardAll,
  GitFetch,
  GitPull,
  GitPush,
  GitPruneWorktrees,
  GitRemoveWorktree,
  GitStage,
  GitStageAll,
  GitStash,
  GitStashApply,
  GitStashDrop,
  GitStashPop,
  GitUnstage,
  GitUnstageAll,
} from "../../../wailsjs/go/main/App";
import { GitActionRow } from "./GitActionRow";
import { GitBranchSwitcher } from "./GitBranchSwitcher";
import { GitCommitBox } from "./GitCommitBox";
import { GitEmptyState } from "./GitEmptyState";
import { GitFileList } from "./GitFileList";
import { GitOverflowMenu } from "./GitOverflowMenu";
import { GitStashList } from "./GitStashList";
import { GitWorktreeList } from "./GitWorktreeList";
import { runGitInTerminal, type GitToolkitScope } from "./gitScope";
import { asSnapshot, asWorktrees, type GitFile, type GitResult } from "./types";

function asResult(raw: unknown): GitResult {
  const r = (raw || {}) as Partial<GitResult>;
  return {
    ok: !!r.ok,
    stdout: r.stdout || "",
    stderr: r.stderr || "",
    cmd: r.cmd || "",
  };
}

export function GitPanel({
  path,
  rootPath,
  projectName,
  open,
  scope = "root",
}: {
  path: string;
  rootPath?: string;
  projectName: string;
  open: boolean;
  scope?: GitToolkitScope;
}) {
  const requestedView = useUI((s) => s.gitPanel?.view ?? "main");
  const [view, setView] = useState<GitPanelView>(requestedView);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<GitResult | null>(null);
  const [message, setMessage] = useState("");

  const snapQuery = useGitSnapshot(path, open);
  const branchQuery = useGitBranches(path, open && view === "branches");
  const stashQuery = useGitStashes(path, open && view === "stashes");
  const worktreeQuery = useGitWorktrees(path, open && view === "worktrees");
  const snap = asSnapshot(snapQuery.data);
  const branches = (branchQuery.data || []) as Array<{
    name?: string;
    current?: boolean;
    date?: number;
  }>;

  const linked = scope === "worktree";

  useEffect(() => {
    if (!open) return;
    if (linked && (requestedView === "branches" || requestedView === "worktrees")) {
      setView("main");
    } else {
      setView(requestedView);
    }
  }, [open, requestedView, linked]);

  useEffect(() => {
    if (!open || busy) return;
    const t = window.setInterval(() => {
      void snapQuery.refetch();
    }, 2000);
    return () => window.clearInterval(t);
  }, [open, busy, snapQuery.refetch]);

  const run = async (op: string, fn: () => Promise<unknown>): Promise<boolean> => {
    setBusy(op);
    setError(null);
    try {
      const result = asResult(await fn());
      if (!result.ok) {
        setError(result);
        return false;
      }
      invalidateGit(path);
      if (rootPath && rootPath !== path) invalidateGit(rootPath);
      return true;
    } catch (err) {
      setError({
        ok: false,
        stdout: "",
        stderr: err instanceof Error ? err.message : String(err),
        cmd: "",
      });
      return false;
    } finally {
      setBusy(null);
    }
  };

  const toggleFile = (file: GitFile) => {
    const next = file.unstaged ? GitStage : GitUnstage;
    void run(`file:${file.path}`, () => next(path, file.path));
  };

  const commit = async (andPush: boolean) => {
    const ok = await run(andPush ? "commit-push" : "commit", () => GitCommit(path, message));
    if (!ok) return;
    setMessage("");
    if (andPush) await run("push", () => GitPush(path));
  };

  const conflict =
    snap?.inProgress === "merge" ||
    snap?.inProgress === "rebase" ||
    (error?.stderr || "").toLowerCase().includes("conflict");

  if (view === "branches" && !linked) {
    return (
      <GitBranchSwitcher
        branches={branches.map((b) => ({
          name: b.name || "",
          current: !!b.current,
          date: Number(b.date) || 0,
        }))}
        current={snap?.branch || ""}
        dirty={!!snap?.dirty}
        busy={busy}
        error={!error?.ok ? error?.stderr : undefined}
        onBack={() => setView("main")}
        onCheckout={async (name) => {
          const ok = await run(`checkout:${name}`, () => GitCheckout(path, name));
          if (ok) setView("main");
        }}
        onCreate={async (name) => {
          const ok = await run("create", () => GitCreateBranch(path, name));
          if (ok) setView("main");
        }}
        onDelete={async (name) => {
          setBusy(`delete:${name}`);
          setError(null);
          try {
            let result = asResult(await GitDeleteBranch(path, name, false));
            if (!result.ok && result.stderr.toLowerCase().includes("not fully merged")) {
              setBusy(null);
              const force = await confirm({
                title: "Not fully merged",
                description: `${name} has commits that aren’t on this branch. Delete anyway?`,
                confirmLabel: "Delete anyway",
                destructive: true,
              });
              if (!force) {
                setError(result);
                return;
              }
              setBusy(`delete:${name}`);
              result = asResult(await GitDeleteBranch(path, name, true));
            }
            if (!result.ok) {
              setError(result);
              return;
            }
            invalidateGit(path);
          } catch (err) {
            setError({
              ok: false,
              stdout: "",
              stderr: err instanceof Error ? err.message : String(err),
              cmd: "",
            });
          } finally {
            setBusy(null);
          }
        }}
        onClearError={() => setError(null)}
      />
    );
  }

  if (view === "stashes") {
    const stashes = ((stashQuery.data || []) as Array<{ ref?: string; message?: string; age?: string }>).map(
      (s) => ({
        ref: s.ref || "",
        message: s.message || "",
        age: s.age || "",
      })
    );
    return (
      <GitStashList
        stashes={stashes}
        busy={busy}
        onBack={() => setView("main")}
        onPop={async (ref) => {
          const ok = await run(`stash-pop:${ref}`, () => GitStashPop(path, ref));
          if (ok) setView("main");
        }}
        onApply={(ref) => void run(`stash-apply:${ref}`, () => GitStashApply(path, ref))}
        onDrop={async (ref) => {
          const ok = await run(`stash-drop:${ref}`, () => GitStashDrop(path, ref));
          if (ok) void stashQuery.refetch();
        }}
      />
    );
  }

  if (view === "worktrees" && !linked) {
    const worktrees = asWorktrees(worktreeQuery.data);
    return (
      <GitWorktreeList
        worktrees={worktrees}
        busy={busy}
        error={!error?.ok ? error?.stderr : undefined}
        onBack={() => setView("main")}
        onRemove={async (wtPath) => {
          setBusy(`worktree-remove:${wtPath}`);
          setError(null);
          try {
            let result = asResult(await GitRemoveWorktree(path, wtPath, false));
            if (!result.ok && result.stderr.toLowerCase().includes("local changes")) {
              setBusy(null);
              const force = await confirm({
                title: "Worktree has local changes",
                description: "Remove it anyway? Uncommitted work in that folder will be lost.",
                confirmLabel: "Remove anyway",
                destructive: true,
              });
              if (!force) {
                setError(result);
                return;
              }
              setBusy(`worktree-remove:${wtPath}`);
              result = asResult(await GitRemoveWorktree(path, wtPath, true));
            }
            if (!result.ok) {
              setError(result);
              return;
            }
            invalidateGit(path);
            void worktreeQuery.refetch();
          } catch (err) {
            setError({
              ok: false,
              stdout: "",
              stderr: err instanceof Error ? err.message : String(err),
              cmd: "",
            });
          } finally {
            setBusy(null);
          }
        }}
        onPrune={() => void run("prune", () => GitPruneWorktrees(path))}
      />
    );
  }

  const canPush = !!snap && (snap.ahead > 0 || !snap.upstream);
  const stagedCount = snap?.files.filter((f) => f.staged).length ?? 0;
  const dirty = !!snap?.dirty;
  const loading = snapQuery.isLoading && !snap;

  return (
    <div className="flex max-h-[min(70vh,34rem)] min-h-0 flex-col overflow-hidden">
      <div className="relative z-20 flex min-w-0 shrink-0 items-center gap-1 border-b border-border/70 bg-popover px-2 py-1.5">
        {linked ? (
          <div className="flex min-w-0 flex-1 items-center gap-1.5 px-1.5 py-0.5">
            {loading ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="max-w-[9rem] shrink-0 truncate text-[13px] font-medium">
              {snap?.branch || "—"}
            </span>
            <span className="min-w-0 truncate text-[12px] text-muted-foreground">
              · {projectName} · worktree
            </span>
          </div>
        ) : (
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left hover:bg-accent/50"
            onClick={() => setView("branches")}
          >
            {loading ? (
              <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
            ) : (
              <GitBranch className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="max-w-[9rem] shrink-0 truncate text-[13px] font-medium">
              {snap?.branch || "—"}
            </span>
            <span className="min-w-0 truncate text-[12px] text-muted-foreground">
              · {projectName}
            </span>
          </button>
        )}
        <GitActionRow
          ahead={snap?.ahead ?? 0}
          behind={snap?.behind ?? 0}
          canPush={canPush}
          busy={busy}
          onPull={() => void run("pull", () => GitPull(path))}
          onPush={() => void run("push", () => GitPush(path))}
        />
        <GitOverflowMenu
          scope={scope}
          branch={snap?.branch || ""}
          dirty={dirty}
          stashCount={snap?.stashCount ?? 0}
          busy={busy}
          onSwitchBranch={() => setView("branches")}
          onFetch={() => void run("fetch", () => GitFetch(path))}
          onStash={async () => {
            const ok = await run("stash", () => GitStash(path, message.trim()));
            if (ok) setMessage("");
          }}
          onPop={async () => {
            const ok = await run("stash-pop", () => GitStashPop(path, ""));
            if (ok) setMessage("");
          }}
          onOpenStashes={() => setView("stashes")}
          onOpenWorktrees={() => setView("worktrees")}
        />
      </div>

      {conflict ? (
        <div className="mx-3 mb-2 rounded-md bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive">
          Conflicts — resolve in the terminal
        </div>
      ) : null}

      {error && !error.ok ? (
        <div className="mx-3 mb-2 rounded-md bg-destructive/10 px-2.5 py-1.5">
          <p className="max-h-14 overflow-auto whitespace-pre-wrap text-[11px] text-destructive">
            {error.stderr || "git command failed"}
          </p>
          {error.cmd ? (
            <button
              type="button"
              className="mt-1 cursor-pointer text-[11px] text-muted-foreground hover:text-foreground"
              onClick={() => runGitInTerminal(error.cmd)}
            >
              Run in terminal
            </button>
          ) : null}
        </div>
      ) : null}

      {dirty ? (
        <div className="flex min-h-0 flex-auto flex-col overflow-hidden">
          <GitFileList
            files={snap?.files ?? []}
            busy={busy}
            onToggle={toggleFile}
            onStageAll={() => void run("stage-all", () => GitStageAll(path))}
            onUnstageAll={() => void run("unstage-all", () => GitUnstageAll(path))}
            onDiscard={(file) => void run(`discard:${file.path}`, () => GitDiscard(path, file.path))}
            onDiscardAll={() => void run("discard-all", () => GitDiscardAll(path))}
          />
          <GitCommitBox
            message={message}
            onMessage={setMessage}
            canCommit={stagedCount > 0}
            busy={busy}
            onCommit={() => void commit(false)}
            onCommitPush={() => void commit(true)}
          />
        </div>
      ) : (
        <GitEmptyState
          loading={loading}
          ahead={snap?.ahead ?? 0}
          behind={snap?.behind ?? 0}
        />
      )}
    </div>
  );
}
