import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createTerminal } from "@/lib/sessions";
import { invalidateGit, useGitStatus, useGitWorktrees } from "@/queries";
import { GitAddWorktree } from "../../../wailsjs/go/main/App";
import { normalizeBranchName, sanitizeBranchInput, validBranchName } from "./branchName";
import { asStatus, asWorktrees } from "./types";

export function GitWorktreePicker({
  open,
  onOpenChange,
  projectId,
  path,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  path: string;
}) {
  const query = useGitWorktrees(path, open);
  const { data: statusData } = useGitStatus(path);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const candidate = normalizeBranchName(name);
  const valid = validBranchName(candidate);
  const extras = asWorktrees(query.data).filter((w) => !w.main);
  const branch = asStatus(statusData)?.branch || "HEAD";

  useEffect(() => {
    if (!open) {
      setName("");
      setError("");
      setBusy(false);
    }
  }, [open]);

  const openAt = async (cwd: string) => {
    onOpenChange(false);
    await createTerminal(projectId, undefined, cwd);
  };

  const create = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = (await GitAddWorktree(path, candidate)) as {
        ok?: boolean;
        path?: string;
        stderr?: string;
      };
      if (!res?.ok || !res.path) {
        setError(res?.stderr || "Could not create worktree");
        return;
      }
      invalidateGit(path);
      invalidateGit(res.path);
      onOpenChange(false);
      await createTerminal(projectId, undefined, res.path);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[22.5rem] p-4" showClose>
        <DialogHeader>
          <DialogTitle>New worktree terminal</DialogTitle>
          <DialogDescription>From {branch}</DialogDescription>
        </DialogHeader>
        <div className="mt-3 flex gap-1.5">
          <input
            value={name}
            onChange={(e) => {
              setName(sanitizeBranchInput(e.target.value));
              setError("");
            }}
            placeholder="New branch name"
            disabled={busy}
            className="h-8 min-w-0 flex-1 rounded-md bg-secondary/70 px-2.5 text-[13px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void create();
              }
            }}
          />
          <Button
            type="button"
            size="sm"
            className="h-8 shrink-0"
            disabled={!valid || busy}
            onClick={() => void create()}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Create
          </Button>
        </div>
        {error ? <p className="mt-2 text-[11px] text-destructive">{error}</p> : null}
        <div className="mt-3 max-h-48 overflow-auto">
          <p className="mb-1 text-[11px] text-muted-foreground">Worktrees</p>
          {query.isLoading ? (
            <p className="flex items-center gap-1.5 px-0.5 py-3 text-[12px] text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Loading…
            </p>
          ) : extras.length === 0 ? (
            <p className="px-0.5 py-3 text-[12px] text-muted-foreground">No other worktrees.</p>
          ) : (
            extras.map((w) => (
              <button
                key={w.path}
                type="button"
                title={w.path}
                disabled={busy}
                className="flex w-full min-w-0 cursor-pointer items-center rounded-md px-2 py-1.5 text-left hover:bg-accent disabled:opacity-50"
                onClick={() => void openAt(w.path)}
              >
                <span className="min-w-0 truncate text-[13px]">{w.branch || "HEAD"}</span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
