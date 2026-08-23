import { Archive, GitBranch, Loader2, MoreHorizontal, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { GitToolkitScope } from "./gitScope";

export function GitOverflowMenu({
  scope,
  branch,
  dirty,
  stashCount,
  busy,
  onSwitchBranch,
  onFetch,
  onStash,
  onPop,
  onOpenStashes,
  onOpenWorktrees,
}: {
  scope: GitToolkitScope;
  branch: string;
  dirty: boolean;
  stashCount: number;
  busy: string | null;
  onSwitchBranch: () => void;
  onFetch: () => void;
  onStash: () => void;
  onPop: () => void;
  onOpenStashes: () => void;
  onOpenWorktrees: () => void;
}) {
  const spinning = busy === "fetch" || busy === "stash" || busy === "stash-pop";
  const root = scope === "root";

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={!!busy}
          aria-label="More git actions"
          className="relative size-7 shrink-0 text-muted-foreground"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {spinning ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <MoreHorizontal className="size-3.5" />
          )}
          {stashCount > 0 ? (
            <span className="absolute right-1 top-1 size-1.5 rounded-full bg-foreground/50" />
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="min-w-[12rem]"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {root ? (
          <>
            <DropdownMenuItem disabled={!!busy} onClick={onSwitchBranch} shortcut={branch || undefined}>
              <GitBranch className="size-3.5 opacity-70" />
              Switch branch
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!!busy} onClick={onFetch}>
              <RefreshCw className="size-3.5 opacity-70" />
              Fetch
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem disabled={!!busy || !dirty} onClick={onStash}>
          <Archive className="size-3.5 opacity-70" />
          Stash changes
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!!busy || stashCount === 0}
          onClick={onPop}
          shortcut={stashCount > 0 ? String(stashCount) : undefined}
        >
          Pop latest stash
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!!busy} onClick={onOpenStashes}>
          Stashes…
        </DropdownMenuItem>
        {root ? (
          <DropdownMenuItem disabled={!!busy} onClick={onOpenWorktrees}>
            Worktrees…
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
