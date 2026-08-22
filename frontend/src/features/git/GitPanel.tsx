import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { invalidateGit, useGitBranches, useGitSnapshot } from "@/queries";
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
  GitUnstage,
} from "../../../wailsjs/go/main/App";
import { GitActionRow } from "./GitActionRow";
import { GitBranchSwitcher } from "./GitBranchSwitcher";
import { GitCommitBox } from "./GitCommitBox";
import { GitFileList } from "./GitFileList";
import { runGitInTerminal } from "./gitScope";
import { asSnapshot, trackingLabel, type GitFile, type GitResult } from "./types";

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
  const [view, setView] = useState<"main" | "branches">(requestedView);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<GitResult | null>(null);
  const [message, setMessage] = useState("");

  const snapQuery = useGitSnapshot(path, open);
  const branchQuery = useGitBranches(path, open && view === "branches");
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
    if (!open) return;
    const t = window.setInterval(() => {
      void snapQuery.refetch();
    }, 2000);
    return () => window.clearInterval(t);
  }, [open, snapQuery.refetch]);

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
        onBack={() => setView("main")}
        onCheckout={async (name) => {
          const ok = await run(`checkout:${name}`, () => GitCheckout(path, name));
          if (ok) setView("main");
        }}
        onCreate={async (name) => {
          const ok = await run("create", () => GitCreateBranch(path, name));
          if (ok) setView("main");
        }}
      />
    );
  }

  const track = snap ? trackingLabel(snap.ahead, snap.behind) : "";
  const canPush = !!snap && (snap.ahead > 0 || !snap.upstream);
  const stagedCount = snap?.files.filter((f) => f.staged).length ?? 0;

  return (
    <div className="flex max-h-[min(70vh,32rem)] min-h-0 flex-col">
      <div className="flex items-center gap-2 px-3 pb-1.5 pt-2.5">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-muted-foreground">Git</div>
          <div className="truncate text-[13px] font-medium">{projectName}</div>
        </div>
        <button
          type="button"
          className="flex min-w-0 max-w-[45%] cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={() => setView("branches")}
        >
          <span className="min-w-0 truncate">{snap?.branch || "—"}</span>
          {track ? <span className="shrink-0 tabular-nums">{track}</span> : null}
          <ChevronDown className="size-3 shrink-0 opacity-70" />
        </button>
      </div>

      <GitActionRow
        canPush={canPush}
        busy={busy}
        onFetch={() => void run("fetch", () => GitFetch(path))}
        onPull={() => void run("pull", () => GitPull(path))}
        onPush={() => void run("push", () => GitPush(path))}
      />

      {conflict ? (
        <div className="mx-2.5 mb-2 rounded-md bg-destructive/10 px-2.5 py-1.5 text-[11px] text-destructive">
          Conflicts — resolve in the terminal
        </div>
      ) : null}

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

      {error && !error.ok ? (
        <div className="border-t border-border/60 px-2.5 py-2">
          <p className="max-h-16 overflow-auto whitespace-pre-wrap text-[11px] text-destructive">
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
    </div>
  );
}
