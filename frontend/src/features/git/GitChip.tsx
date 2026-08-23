import { useEffect, useRef, type MouseEvent } from "react";
import { Circle, FolderTree, GitBranch } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WithTooltip } from "@/components/ui/tooltip";
import { useExclusiveMenu } from "@/hooks/useExclusiveMenu";
import { shortcutLabelFor } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { asStatus, chipTooltip, trackingLabel } from "./types";
import { closeGitToolkit, gitToolkitScope, projectById } from "./gitScope";
import { GitPanel } from "./GitPanel";
import { useGitStatus } from "@/queries";
import { uiStore, useUI } from "@/store/ui";

export function GitChip({
  projectId,
  path,
  projectName,
  paneId = null,
  listenToShortcut = true,
  variant,
  always = true,
  worktree = false,
  side,
}: {
  projectId: string;
  path: string;
  projectName: string;
  paneId?: string | null;
  listenToShortcut?: boolean;
  variant: "sidebar" | "open" | "pane" | "session" | "meta";
  always?: boolean;
  worktree?: boolean;
  side?: "right" | "bottom";
}) {
  const { data } = useGitStatus(path);
  const git = asStatus(data);
  const menuId = `git:${variant}:${projectId}:${paneId ?? "sidebar"}`;
  const [menuOpen, setMenuOpen] = useExclusiveMenu(menuId);
  const storeTarget = useUI((s) => s.gitPanel);
  const storeOpen =
    listenToShortcut &&
    storeTarget?.projectId === projectId &&
    (storeTarget.paneId ?? null) === (paneId ?? null);
  const wasOpen = useRef(false);
  const shortcut = shortcutLabelFor("gitToolkit", uiStore.get().keybindings);

  useEffect(() => {
    if (storeOpen) setMenuOpen(true);
  }, [storeOpen, setMenuOpen]);

  useEffect(() => {
    if (menuOpen) {
      wasOpen.current = true;
      return;
    }
    if (!wasOpen.current) return;
    wasOpen.current = false;
    const cur = uiStore.get().gitPanel;
    if (cur?.projectId === projectId && (cur.paneId ?? null) === (paneId ?? null)) {
      closeGitToolkit();
    }
  }, [menuOpen, projectId, paneId]);

  if (!git?.isRepo) return null;

  const rootPath = projectById(projectId)?.path || "";
  const scope = gitToolkitScope(path, rootPath);
  const track = trackingLabel(git.ahead, git.behind);
  const label = listenToShortcut ? `${chipTooltip(git)} (${shortcut})` : chipTooltip(git);
  const popoverSide =
    side ?? (variant === "pane" || variant === "open" || variant === "meta" ? "bottom" : "right");

  const onOpenChange = (next: boolean) => {
    setMenuOpen(next);
    if (next) {
      uiStore.set({
        gitPanel: {
          projectId,
          paneId: paneId ?? null,
          view: uiStore.get().gitPanel?.view ?? "main",
        },
      });
      return;
    }
    const cur = uiStore.get().gitPanel;
    if (cur?.projectId === projectId && (cur.paneId ?? null) === (paneId ?? null)) {
      closeGitToolkit();
    }
  };

  return (
    <Popover modal={false} open={menuOpen} onOpenChange={onOpenChange}>
      <WithTooltip
        label={label}
        disabled={menuOpen}
        side={variant === "pane" ? "bottom" : "right"}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex min-w-0 items-center gap-1 titlebar-no-drag",
              variant === "sidebar" &&
                "max-w-[8rem] shrink-0 rounded-md px-1.5 py-0.5 text-[12px] text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
              variant === "open" &&
                "max-w-[8rem] shrink-0 px-1.5 text-[12px] text-muted-foreground hover:text-foreground",
              variant === "session" &&
                "max-w-[7rem] shrink-0 rounded-md px-1 py-0.5 text-[11px] text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
              variant === "meta" &&
                "w-max max-w-full min-w-0 justify-start rounded-md px-1 py-0.5 text-left text-[11px] leading-4 text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              variant === "pane" &&
                cn(
                  "shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground",
                  "hover:bg-accent hover:text-foreground",
                  always
                    ? "opacity-45 group-hover/chrome:opacity-100"
                    : "opacity-0 group-hover/pane:opacity-45 group-hover/chrome:!opacity-100",
                  menuOpen && "!opacity-100 bg-accent text-foreground"
                )
            )}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {variant === "pane" || variant === "meta" ? (
              worktree || scope === "worktree" ? (
                <FolderTree className="size-3 shrink-0 opacity-70" />
              ) : (
                <GitBranch className="size-3 shrink-0 opacity-70" />
              )
            ) : null}
            <span className={cn(variant === "pane" ? "whitespace-nowrap" : "min-w-0 truncate")}>
              {git.branch || "HEAD"}
            </span>
            {track ? <span className="shrink-0 tabular-nums">{track}</span> : null}
            {git.dirty ? (
              <Circle className="size-1.5 shrink-0 fill-amber-400 text-amber-400" />
            ) : null}
          </button>
        </PopoverTrigger>
      </WithTooltip>
      <PopoverContent
        align={variant === "pane" ? "end" : "start"}
        side={popoverSide}
        sideOffset={6}
        onOpenAutoFocus={(e: Event) => e.preventDefault()}
        onCloseAutoFocus={(e: Event) => e.preventDefault()}
        onMouseDown={(e: MouseEvent) => e.stopPropagation()}
        onInteractOutside={(e) => {
          const t = e.target;
          if (
            t instanceof Element &&
            (t.closest('[role="dialog"]') || t.closest('[role="menu"]'))
          ) {
            e.preventDefault();
          }
        }}
        onFocusOutside={(e) => {
          const t = e.target;
          if (
            t instanceof Element &&
            (t.closest('[role="dialog"]') || t.closest('[role="menu"]'))
          ) {
            e.preventDefault();
          }
        }}
      >
        <GitPanel
          path={path}
          rootPath={rootPath || undefined}
          projectName={projectName}
          open={menuOpen}
          scope={scope}
        />
      </PopoverContent>
    </Popover>
  );
}
