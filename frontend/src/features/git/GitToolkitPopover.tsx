import { useEffect, useRef, type MouseEvent } from "react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useExclusiveMenu } from "@/hooks/useExclusiveMenu";
import { useGitStatus } from "@/queries";
import { uiStore, useUI } from "@/store/ui";
import { closeGitToolkit, gitToolkitScope, projectById } from "./gitScope";
import { GitPanel } from "./GitPanel";
import { asStatus } from "./types";

export function GitToolkitPopover({
  projectId,
  path,
  projectName,
  paneId,
  side = "right",
}: {
  projectId: string;
  path: string;
  projectName: string;
  paneId: string | null;
  side?: "right" | "bottom";
}) {
  const { data } = useGitStatus(path);
  const git = asStatus(data);
  const menuId = `git:host:${projectId}:${paneId ?? "sidebar"}`;
  const [menuOpen, setMenuOpen] = useExclusiveMenu(menuId);
  const storeTarget = useUI((s) => s.gitPanel);
  const storeOpen =
    storeTarget?.projectId === projectId && (storeTarget.paneId ?? null) === (paneId ?? null);
  const wasOpen = useRef(false);

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

  // Keep the anchor mounted even before status resolves so Radix can measure the row.
  const rootPath = projectById(projectId)?.path || "";
  const scope = gitToolkitScope(path, rootPath);

  const onOpenChange = (next: boolean) => {
    setMenuOpen(next);
    if (next) {
      uiStore.set({
        gitPanel: {
          projectId,
          paneId,
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
    <Popover modal={false} open={menuOpen && !!git?.isRepo} onOpenChange={onOpenChange}>
      <PopoverAnchor asChild>
        <span aria-hidden className="pointer-events-none absolute inset-0" />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        side={side}
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
