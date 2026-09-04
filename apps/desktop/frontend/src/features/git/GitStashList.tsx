import { ChevronLeft, Loader2, Trash2 } from "lucide-react";
import { confirm } from "@/lib/confirm";
import { cn } from "@/lib/utils";
import type { GitStash } from "./types";

export function GitStashList({
  stashes,
  busy,
  onBack,
  onPop,
  onApply,
  onDrop,
}: {
  stashes: GitStash[];
  busy: string | null;
  onBack: () => void;
  onPop: (ref: string) => void;
  onApply: (ref: string) => void;
  onDrop: (ref: string) => void;
}) {
  const drop = async (ref: string) => {
    const ok = await confirm({
      title: "Drop stash?",
      description: `${ref} will be deleted.`,
      confirmLabel: "Drop",
      destructive: true,
    });
    if (ok) onDrop(ref);
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
        <span className="text-[13px] font-medium">Stashes</span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-1.5">
        {stashes.length === 0 ? (
          <p className="px-2 py-8 text-center text-[12px] text-muted-foreground">No stashes.</p>
        ) : (
          stashes.map((s) => {
            const spinning = busy?.startsWith(`stash:`) && busy.endsWith(s.ref);
            return (
              <div
                key={s.ref}
                className="group/stash flex min-w-0 items-start gap-2 rounded-md px-2 py-1.5 hover:bg-accent/60"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] text-foreground">
                    {s.message || s.ref}
                  </div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {s.ref}
                    {s.age ? ` · ${s.age}` : ""}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {spinning ? (
                    <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={!!busy}
                        className="cursor-pointer rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                        onClick={() => onPop(s.ref)}
                      >
                        Pop
                      </button>
                      <button
                        type="button"
                        disabled={!!busy}
                        className="cursor-pointer rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                        onClick={() => onApply(s.ref)}
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        disabled={!!busy}
                        title="Drop"
                        className={cn(
                          "flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground",
                          "hover:bg-accent hover:text-destructive disabled:opacity-50"
                        )}
                        onClick={() => void drop(s.ref)}
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
