import { useEffect, useMemo, useRef, useState } from "react";
import { Command } from "cmdk";
import { Check, ChevronLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { confirm } from "@/lib/confirm";
import { cn } from "@/lib/utils";
import { normalizeBranchName, sanitizeBranchInput, validBranchName } from "./branchName";
import type { GitBranch } from "./types";

export function GitBranchSwitcher({
  branches,
  current,
  dirty,
  busy,
  error,
  onBack,
  onCheckout,
  onCreate,
  onDelete,
  onClearError,
}: {
  branches: GitBranch[];
  current: string;
  dirty: boolean;
  busy: string | null;
  error?: string;
  onBack: () => void;
  onCheckout: (name: string) => void;
  onCreate: (name: string) => void;
  onDelete: (name: string) => void;
  onClearError?: () => void;
}) {
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const query = q.trim();
  const candidate = normalizeBranchName(query);
  const valid = validBranchName(candidate);
  const exact = useMemo(
    () => branches.some((b) => b.name === query || b.name === candidate),
    [branches, query, candidate]
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const switchTo = async (name: string) => {
    if (name === current) return;
    if (dirty) {
      const ok = await confirm({
        title: "Switch branch?",
        description: "Uncommitted changes may be overwritten.",
        confirmLabel: "Switch",
      });
      if (!ok) return;
    }
    onCheckout(name);
  };

  const create = async () => {
    if (!valid || exact) return;
    if (dirty) {
      const ok = await confirm({
        title: "Create branch?",
        description: "Uncommitted changes will come along to the new branch.",
        confirmLabel: "Create",
      });
      if (!ok) return;
    }
    onCreate(candidate);
  };

  const remove = async (name: string) => {
    if (name === current) return;
    const ok = await confirm({
      title: "Delete branch?",
      description: `${name} will be removed locally.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (ok) onDelete(name);
  };

  return (
    <div className="flex max-h-[min(70vh,34rem)] min-h-[18rem] flex-col">
      <div className="flex items-center gap-1 border-b border-border/70 px-1.5 py-1.5">
        <button
          type="button"
          className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={onBack}
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <span className="text-[13px] font-medium">Switch branch</span>
      </div>
      <Command className="flex min-h-0 flex-1 flex-col" shouldFilter>
        <Command.Input
          ref={inputRef}
          value={q}
          onValueChange={(next) => {
            setQ(sanitizeBranchInput(next));
            onClearError?.();
          }}
          placeholder="Find or create…"
          className="h-9 w-full shrink-0 border-b border-border/70 bg-transparent px-3 text-[13px] outline-none placeholder:text-muted-foreground"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              onBack();
            }
          }}
        />
        {error ? (
          <p className="border-b border-border/70 px-3 py-1.5 text-[11px] text-destructive">{error}</p>
        ) : null}
        <Command.List className="min-h-0 flex-1 overflow-auto p-1.5">
          <Command.Empty className="px-2 py-6 text-center text-[12px] text-muted-foreground">
            {query && !valid ? "Invalid branch name." : "No matching branches."}
          </Command.Empty>
          {query && !exact && valid ? (
            <Command.Item
              value={`create ${candidate}`}
              onSelect={() => void create()}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] aria-selected:bg-accent"
            >
              {busy === "create" ? (
                <Loader2 className="size-3.5 animate-spin opacity-70" />
              ) : (
                <Plus className="size-3.5 opacity-70" />
              )}
              Create “{candidate}”
            </Command.Item>
          ) : null}
          {query && !exact && !valid ? (
            <p className="px-2 py-1.5 text-[12px] text-muted-foreground">
              Invalid name — use letters, numbers, - and /
            </p>
          ) : null}
          {branches.map((b) => {
            const deleting = busy === `delete:${b.name}`;
            return (
              <Command.Item
                key={b.name}
                value={b.name}
                onSelect={() => void switchTo(b.name)}
                className={cn(
                  "group/branch relative flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] aria-selected:bg-accent",
                  b.current && "text-foreground"
                )}
              >
                <span className="flex size-3.5 shrink-0 items-center justify-center">
                  {busy === `checkout:${b.name}` || deleting ? (
                    <Loader2 className="size-3 animate-spin opacity-70" />
                  ) : b.current ? (
                    <Check className="size-3.5 opacity-80" />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1 truncate">{b.name}</span>
                {!b.current ? (
                  <button
                    type="button"
                    title="Delete branch"
                    disabled={!!busy}
                    className={cn(
                      "absolute right-1 flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground",
                      "opacity-0 hover:bg-accent hover:text-destructive group-hover/branch:opacity-100",
                      "disabled:opacity-0"
                    )}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void remove(b.name);
                    }}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                ) : null}
              </Command.Item>
            );
          })}
        </Command.List>
      </Command>
    </div>
  );
}
