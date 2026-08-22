import { useEffect, useRef, type MouseEvent } from "react";
import { Circle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { WithTooltip } from "@/components/ui/tooltip";
import { useExclusiveMenu } from "@/hooks/useExclusiveMenu";
import { shortcutLabelFor } from "@/lib/shortcuts";
import { cn } from "@/lib/utils";
import { asStatus, chipTooltip, trackingLabel } from "./types";
import { closeGitToolkit } from "./gitScope";
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
}: {
  projectId: string;
  path: string;
  projectName: string;
  paneId?: string | null;
  listenToShortcut?: boolean;
  variant: "sidebar" | "open" | "pane";
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

  const track = trackingLabel(git.ahead, git.behind);
  const label = chipTooltip(git);

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
      <WithTooltip label={`${label} (${shortcut})`} disabled={menuOpen} side={variant === "pane" ? "bottom" : "right"}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex min-w-0 shrink items-center gap-1 titlebar-no-drag",
              variant === "sidebar" &&
                "max-w-[46%] justify-end pl-1 text-[12px] text-muted-foreground hover:text-sidebar-foreground",
              variant === "open" &&
                "max-w-[40%] text-[12px] text-muted-foreground hover:text-foreground",
              variant === "pane" &&
                cn(
                  "max-w-[8.5rem] rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground",
                  "opacity-45 hover:bg-accent hover:text-foreground hover:opacity-100",
                  "group-hover/chrome:opacity-100",
                  menuOpen && "bg-accent text-foreground opacity-100"
                )
            )}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span className="min-w-0 truncate">{git.branch || "HEAD"}</span>
            {track ? <span className="shrink-0 tabular-nums">{track}</span> : null}
            {git.dirty ? (
              <Circle className="size-1.5 shrink-0 fill-amber-400 text-amber-400" />
            ) : null}
          </button>
        </PopoverTrigger>
      </WithTooltip>
      <PopoverContent
        align={variant === "pane" ? "end" : "start"}
        side={variant === "sidebar" ? "right" : "bottom"}
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
        <GitPanel path={path} projectName={projectName} open={menuOpen} />
      </PopoverContent>
    </Popover>
  );
}
