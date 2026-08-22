import { useMemo, useState } from "react";
import { Command } from "cmdk";
import { Check, ChevronLeft, Loader2, Plus } from "lucide-react";
import { confirm } from "@/lib/confirm";
import { cn } from "@/lib/utils";
import type { GitBranch } from "./types";

export function GitBranchSwitcher({
  branches,
  current,
  dirty,
  busy,
  onBack,
  onCheckout,
  onCreate,
}: {
  branches: GitBranch[];
  current: string;
  dirty: boolean;
  busy: string | null;
  onBack: () => void;
  onCheckout: (name: string) => void;
  onCreate: (name: string) => void;
}) {
  const [q, setQ] = useState("");
  const query = q.trim();
  const exact = useMemo(
    () => branches.some((b) => b.name === query),
    [branches, query]
  );

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
    if (!query || exact) return;
    if (dirty) {
      const ok = await confirm({
        title: "Create branch?",
        description: "Uncommitted changes will come along to the new branch.",
        confirmLabel: "Create",
      });
      if (!ok) return;
    }
    onCreate(query);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-1 border-b border-border/60 px-1.5 py-1.5">
        <button
          type="button"
          className="flex size-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={onBack}
        >
          <ChevronLeft className="size-3.5" />
        </button>
        <span className="text-[12px] font-medium">Switch branch</span>
      </div>
      <Command className="flex min-h-0 flex-1 flex-col" shouldFilter>
        <Command.Input
          value={q}
          onValueChange={setQ}
          placeholder="Find or create…"
          className="h-8 w-full shrink-0 bg-transparent px-3 text-[12px] outline-none placeholder:text-muted-foreground"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              onBack();
            }
          }}
        />
        <Command.List className="min-h-0 flex-1 overflow-auto px-1 pb-2">
          <Command.Empty className="px-2 py-3 text-[12px] text-muted-foreground">
            No branches.
          </Command.Empty>
          {query && !exact ? (
            <Command.Item
              value={`create ${query}`}
              onSelect={() => void create()}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12px] aria-selected:bg-accent"
            >
              {busy === "create" ? (
                <Loader2 className="size-3.5 animate-spin opacity-70" />
              ) : (
                <Plus className="size-3.5 opacity-70" />
              )}
              Create “{query}”
            </Command.Item>
          ) : null}
          {branches.map((b) => (
            <Command.Item
              key={b.name}
              value={b.name}
              onSelect={() => void switchTo(b.name)}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12px] aria-selected:bg-accent",
                b.current && "text-foreground"
              )}
            >
              <span className="flex size-3.5 shrink-0 items-center justify-center">
                {busy === `checkout:${b.name}` ? (
                  <Loader2 className="size-3 animate-spin opacity-70" />
                ) : b.current ? (
                  <Check className="size-3 opacity-70" />
                ) : null}
              </span>
              <span className="min-w-0 truncate">{b.name}</span>
            </Command.Item>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}
