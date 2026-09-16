import { Columns2, Rows2, X, Trash2, Pencil, Pin, ClipboardCopy, PanelLeft } from "lucide-react";
import { toast } from "sonner";
import { listLeaves, persistUIPrefs, uiStore, useUI } from "@/store/ui";
import { isUnbound } from "@/lib/sessions";
import { handleTitlebarDoubleClick } from "@/lib/window";
import { Button } from "@/components/ui/button";
import { WithTooltip } from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { useExclusiveMenu, dismissExclusiveMenus } from "@/hooks/useExclusiveMenu";
import { GitChip, isSessionWorktree } from "@/features/git";
import { closePane, requestDeleteSession } from "@/lib/panes";
import { toggleSessionPin } from "@/lib/sessionPin";
import { TerminalShortcuts } from "@/lib/menuShortcuts";
import { splitFocused } from "@/app/splitActions";
import { cn } from "@/lib/utils";
import { CopyLastCommandOutput } from "../../../wailsjs/go/main/App";
import { PaneMenu } from "./PaneMenu";
import { PaneOpenInIde } from "./PaneOpenInIde";
import { PaneTitle, requestSessionRename } from "./PaneTitle";

export function PaneChrome({
  paneId,
  sessionId,
  showSidebarToggle = false,
  trafficInset = false,
}: {
  paneId: string;
  sessionId: string;
  showSidebarToggle?: boolean;
  trafficInset?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useExclusiveMenu(`pane:${paneId}`);
  const sessions = useUI((s) => s.sessions);
  const projects = useUI((s) => s.projects);
  const focusedPaneId = useUI((s) => s.focusedPaneId);
  const splitTree = useUI((s) => s.splitTree);
  const session = sessions.find((x) => x.id === sessionId);
  const project =
    session && !isUnbound(session.projectId)
      ? projects.find((p) => p.id === session.projectId)
      : undefined;
  const focused = focusedPaneId === paneId;
  const split = listLeaves(splitTree).length > 1;
  const worktree = !!project && !!session && isSessionWorktree(session.cwd, project.path);
  const actionsAlways = !split || focused;
  const gitAlways = actionsAlways || worktree;
  const idePath = session?.cwd || project?.path || "";
  const pinned = !!session?.pinned;

  const renameInSidebar = () => {
    if (!uiStore.get().sidebarOpen) {
      uiStore.set({ sidebarOpen: true });
      void persistUIPrefs();
    }
    window.setTimeout(() => requestSessionRename(sessionId), 60);
  };

  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (open) dismissExclusiveMenus();
      }}
    >
      <ContextMenuTrigger asChild>
        <div
          className="group/chrome flex h-[var(--titlebar-height)] shrink-0 select-none items-center gap-1.5 pr-3 titlebar-drag"
          style={{ paddingLeft: trafficInset ? "var(--traffic-inset)" : "10px" }}
          onDoubleClick={handleTitlebarDoubleClick}
        >
          {showSidebarToggle && (
            <WithTooltip label="Show sidebar">
              <Button
                size="icon"
                variant="ghost"
                className="size-6 shrink-0 text-muted-foreground titlebar-no-drag"
                onClick={() => {
                  uiStore.set({ sidebarOpen: true });
                  void persistUIPrefs();
                }}
              >
                <PanelLeft className="size-3.5" />
              </Button>
            </WithTooltip>
          )}

          <PaneTitle key={sessionId} sessionId={sessionId} active={menuOpen} />
          {project ? (
            <GitChip
              projectId={project.id}
              path={session?.cwd || project.path}
              projectName={project.name}
              paneId={paneId}
              variant="pane"
              always={gitAlways}
              worktree={worktree}
            />
          ) : null}
          <PaneOpenInIde path={idePath} always={actionsAlways} />
          <PaneMenu
            paneId={paneId}
            sessionId={sessionId}
            open={menuOpen}
            onOpenChange={setMenuOpen}
            always={actionsAlways}
          />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent
        className="min-w-[13rem]"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <ContextMenuItem
          shortcut={TerminalShortcuts.rename.label}
          onClick={renameInSidebar}
        >
          <Pencil className="size-3.5 opacity-70" />
          Rename…
        </ContextMenuItem>
        <ContextMenuItem onClick={() => void toggleSessionPin(sessionId)}>
          <Pin className={cn("size-3.5 opacity-70", pinned && "fill-current")} />
          {pinned ? "Unpin terminal" : "Pin terminal"}
        </ContextMenuItem>
        <ContextMenuItem
          shortcut={TerminalShortcuts.copyLastOutput.label}
          onClick={() => {
            void CopyLastCommandOutput(sessionId).then(
              () => toast.message("Copied last command output"),
              (e) => toast.error(String((e as { message?: string })?.message || e || "No command output yet")),
            );
          }}
        >
          <ClipboardCopy className="size-3.5 opacity-70" />
          Copy last output
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          shortcut={TerminalShortcuts.splitRight.label}
          onClick={() => {
            uiStore.set({ focusedPaneId: paneId, focusedSessionId: sessionId });
            void splitFocused("horizontal");
          }}
        >
          <Columns2 className="size-3.5 opacity-70" />
          Split right
        </ContextMenuItem>
        <ContextMenuItem
          shortcut={TerminalShortcuts.splitDown.label}
          onClick={() => {
            uiStore.set({ focusedPaneId: paneId, focusedSessionId: sessionId });
            void splitFocused("vertical");
          }}
        >
          <Rows2 className="size-3.5 opacity-70" />
          Split down
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          shortcut={TerminalShortcuts.close.label}
          onClick={() => void closePane(paneId)}
        >
          <X className="size-3.5 opacity-70" />
          Close
        </ContextMenuItem>
        <ContextMenuItem
          shortcut={TerminalShortcuts.delete.label}
          className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          onClick={() => requestDeleteSession(sessionId)}
        >
          <Trash2 className="size-3.5 opacity-70" />
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
