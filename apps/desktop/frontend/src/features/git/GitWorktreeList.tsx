import { ChevronLeft, FolderTree, Loader2, Trash2 } from "lucide-react";
import { confirm } from "@/lib/confirm";
import { cn } from "@/lib/utils";
import type { GitWorktree } from "./types";

export function GitWorktreeList({
  worktrees,
  busy,
  error,
  onBack,
  onRemove,
  onPrune,
}: {
  worktrees: GitWorktree[];
  busy: string | null;
  error?: string;
  onBack: () => void;
  onRemove: (path: string) => void;
  onPrune: () => void;
}) {
  const extras = worktrees.filter((w) => !w.main);

  const remove = async (wt: GitWorktree) => {
    const ok = await confirm({
      title: "Remove worktree?",
      description: `${wt.branch} at ${wt.path} will be deleted from disk.`,
      confirmLabel: "Remove",
      destructive: true,
    });
    if (ok) onRemove(wt.path);
  };

  return (
    <div className="flex max-h-[min(70vh,34rem)] min-h-[12rem] flex-col">
      <div className="flex items-center gap-1 border-b border-border/70 px-1.5 py-1.5">
        <button
          type="button"
          className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={onBack}
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <span className="min-w-0 flex-1 text-[13px] font-medium">Worktrees</span>
        <button
          type="button"
          disabled={!!busy}
          className="cursor-pointer rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
          onClick={onPrune}
        >
          {busy === "prune" ? <Loader2 className="inline size-3 animate-spin" /> : "Prune"}
        </button>
      </div>
      {error ? (
        <p className="border-b border-border/70 px-3 py-1.5 text-[11px] text-destructive">{error}</p>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto p-1.5">
        {extras.length === 0 ? (
          <p className="px-2 py-8 text-center text-[12px] text-muted-foreground">No extra worktrees.</p>
        ) : (
          extras.map((w) => {
            const spinning = busy === `worktree-remove:${w.path}`;
            return (
              <div
                key={w.path}
                className="group/wt flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/60"
              >
                <FolderTree className="size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] text-foreground" title={w.path}>
                    {w.branch || "HEAD"}
                  </div>
                </div>
                {spinning ? (
                  <Loader2 className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
                ) : (
                  <button
                    type="button"
                    disabled={!!busy}
                    title="Remove"
                    className={cn(
                      "flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground",
                      "opacity-0 hover:bg-accent hover:text-destructive group-hover/wt:opacity-100",
                      "disabled:opacity-0"
                    )}
                    onClick={() => void remove(w)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
