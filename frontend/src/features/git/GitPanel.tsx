import { useEffect, useState } from "react";
import { GitBranch, Loader2 } from "lucide-react";
import { invalidateGit, useGitBranches, useGitSnapshot, useGitStashes } from "@/queries";
import { useUI } from "@/store/ui";
import {
  GitCheckout,
  GitCommit,
  GitCreateBranch,
  GitDiscard,
  GitFetch,
  GitPull,
  GitPush,
  GitStage,
  GitStageAll,
  GitStash,
  GitStashApply,
  GitStashDrop,
  GitStashPop,
  GitUnstage,
} from "../../../wailsjs/go/main/App";
import { GitActionRow } from "./GitActionRow";
import { GitBranchSwitcher } from "./GitBranchSwitcher";
import { GitCommitBox } from "./GitCommitBox";
import { GitEmptyState } from "./GitEmptyState";
import { GitFileList } from "./GitFileList";
import { GitOverflowMenu } from "./GitOverflowMenu";
import { GitStashList } from "./GitStashList";
import { runGitInTerminal } from "./gitScope";
import { asSnapshot, type GitFile, type GitResult } from "./types";

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
  projectName,
  open,
}: {
  path: string;
  projectName: string;
  open: boolean;
}) {
  const requestedView = useUI((s) => s.gitPanel?.view ?? "main");
  const [view, setView] = useState<"main" | "branches" | "stashes">(requestedView);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<GitResult | null>(null);
  const [message, setMessage] = useState("");

  const snapQuery = useGitSnapshot(path, open);
  const branchQuery = useGitBranches(path, open && view === "branches");
  const stashQuery = useGitStashes(path, open && view === "stashes");
  const snap = asSnapshot(snapQuery.data);
  const branches = (branchQuery.data || []) as Array<{
    name?: string;
    current?: boolean;
    date?: number;
  }>;

  useEffect(() => {
    if (open) setView(requestedView);
  }, [open, requestedView]);

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

  if (view === "branches") {
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

  const canPush = !!snap && (snap.ahead > 0 || !snap.upstream);
  const stagedCount = snap?.files.filter((f) => f.staged).length ?? 0;
  const dirty = !!snap?.dirty;
  const loading = snapQuery.isLoading && !snap;

  return (
    <div className="flex max-h-[min(70vh,34rem)] min-h-0 flex-col">
      <div className="flex min-w-0 shrink-0 items-center gap-1 border-b border-border/70 px-2 py-1.5">
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
        <GitActionRow
          ahead={snap?.ahead ?? 0}
          behind={snap?.behind ?? 0}
          canPush={canPush}
          busy={busy}
          onPull={() => void run("pull", () => GitPull(path))}
          onPush={() => void run("push", () => GitPush(path))}
        />
        <GitOverflowMenu
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
        <>
          <GitFileList
            files={snap?.files ?? []}
            busy={busy}
            onToggle={toggleFile}
            onStageAll={() => void run("stage-all", () => GitStageAll(path))}
            onDiscard={(file) => void run(`discard:${file.path}`, () => GitDiscard(path, file.path))}
          />
          <GitCommitBox
            message={message}
            onMessage={setMessage}
            canCommit={stagedCount > 0}
            busy={busy}
            onCommit={() => void commit(false)}
            onCommitPush={() => void commit(true)}
          />
        </>
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
