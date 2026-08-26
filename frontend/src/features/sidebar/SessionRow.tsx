import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { FolderTree, MoreHorizontal, Pin, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WithTooltip } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { collectSessionIds, uiStore, useUI, type SessionInfo } from "@/store/ui";
import { RenameSession } from "../../../wailsjs/go/main/App";
import { cn } from "@/lib/utils";
import { focusSession } from "@/lib/sessions";
import { closeSessionPanes, requestDeleteSession } from "@/lib/panes";
import { toggleSessionPin } from "@/lib/sessionPin";
import { SESSION_DRAG_MIME, beginSessionDrag, finishSessionDragFromPoint } from "@/lib/sessionDrag";
import { ProjectShortcuts, TerminalShortcuts } from "@/lib/menuShortcuts";
import { GitDirtyDot, GitMenuLabel, GitToolkitPopover, isSessionWorktree, openGitToolkitAt } from "@/features/git";
import { useGitStatus } from "@/queries";
import { RENAME_SESSION_EVENT } from "@/features/panes/PaneTitle";
import { dismissExclusiveMenus, useExclusiveMenu } from "@/hooks/useExclusiveMenu";
import { useMenuTooltipGate } from "@/hooks/useMenuTooltipGate";
import { AgentIcon, agentLabel } from "./AgentIcon";
import { SessionFlowTitle } from "./SessionFlowTitle";
import { SessionStatusDot } from "./SessionStatusDot";

export function SessionRow({
  session,
  openInPane: openInPaneProp,
}: {
  session: SessionInfo;
  /** When set by parent (project row). Unbound rows compute this themselves. */
  openInPane?: boolean;
}) {
  const focusedSessionId = useUI((s) => s.focusedSessionId);
  const splitTree = useUI((s) => s.splitTree);
  const projects = useUI((s) => s.projects);
  const anim = useUI((s) => s.paneAnimations[session.id] || "none");
  const agent = useUI((s) => s.sessionAgents[session.id] || "");
  const focused = focusedSessionId === session.id;
  const pinned = !!session.pinned;
  const project = projects.find((p) => p.id === session.projectId);
  const showWorktree = !!project && isSessionWorktree(session.cwd, project.path);
  const { data: gitData } = useGitStatus(showWorktree ? session.cwd : "");
  const git = gitData as { isRepo?: boolean; dirty?: boolean; branch?: string } | undefined;

  const openInPane = useMemo(() => {
    if (openInPaneProp != null) return openInPaneProp;
    return collectSessionIds(splitTree).includes(session.id);
  }, [openInPaneProp, session.id, splitTree]);

  const canDrag = !openInPane;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.name);
  const [dragging, setDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useExclusiveMenu(`session:${session.id}`);
  const gitOpen = useUI((s) => s.gitPanel?.paneId === `session:${session.id}`);
  const rowActive = menuOpen || gitOpen;
  const { suppressTip, suppressTipAfterMenuClose, tipTriggerProps } = useMenuTooltipGate();
  const draggedRef = useRef(false);
  const pendingRename = useRef(false);

  useEffect(() => {
    if (!editing) setDraft(session.name);
  }, [session.name, editing]);

  useEffect(() => {
    const onRename = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== session.id) return;
      setDraft(session.name);
      setEditing(true);
    };
    window.addEventListener(RENAME_SESSION_EVENT, onRename);
    return () => window.removeEventListener(RENAME_SESSION_EVENT, onRename);
  }, [session.id, session.name]);

  /** Mark rename; actual edit mode starts in onCloseAutoFocus so autoFocus wins. */
  const queueRename = () => {
    pendingRename.current = true;
  };

  const onMenuCloseAutoFocus = (e: Event) => {
    if (pendingRename.current) {
      e.preventDefault();
      pendingRename.current = false;
      setDraft(session.name);
      setEditing(true);
      return;
    }
    e.preventDefault();
  };

  const onSessionMenuOpenChange = (next: boolean) => {
    setMenuOpen(next);
    if (!next) suppressTipAfterMenuClose();
  };

  const commit = async () => {
    const next = draft.trim();
    setEditing(false);
    if (!next || next === session.name) {
      setDraft(session.name);
      return;
    }
    await RenameSession(session.id, next);
    uiStore.set({
      sessions: uiStore.get().sessions.map((s) => (s.id === session.id ? { ...s, name: next } : s)),
    });
  };

  const needsInput = anim === "action_required";
  const thinking = anim === "thinking";
  const complete = anim === "task_complete";

  const onDragStart = (e: DragEvent) => {
    if (editing || !canDrag) {
      e.preventDefault();
      return;
    }
    draggedRef.current = true;
    beginSessionDrag(session.id);
    e.dataTransfer.setData(SESSION_DRAG_MIME, session.id);
    e.dataTransfer.setData("text/plain", `qterm-session:${session.id}`);
    e.dataTransfer.effectAllowed = "move";
    setDragging(true);
  };

  const onDragEnd = () => {
    if (!canDrag) return;
    finishSessionDragFromPoint(session.id);
    setDragging(false);
    window.setTimeout(() => {
      draggedRef.current = false;
    }, 0);
  };

  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (open) dismissExclusiveMenus();
      }}
    >
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "group relative flex w-full items-center rounded-lg pr-1 text-[13px] leading-snug text-muted-foreground hover:bg-sidebar-accent/35 hover:text-sidebar-foreground",
            openInPane &&
              !focused &&
              "bg-sidebar-accent/80 text-sidebar-foreground before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-full before:bg-primary/55",
            focused &&
              "bg-sidebar-accent font-medium text-sidebar-foreground before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-full before:bg-primary",
            rowActive && !focused && "bg-sidebar-accent/35 text-sidebar-foreground",
            dragging && "opacity-50",
            needsInput && "session-needs-input",
            complete && "session-complete"
          )}
        >
          <div
            role="button"
            tabIndex={0}
            draggable={canDrag && !editing}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-1.5 text-left",
              !showWorktree && "group-hover:pr-8",
              !showWorktree && rowActive && "pr-8",
              canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
            )}
            onClick={() => {
              if (!editing && !draggedRef.current) void focusSession(session.id);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (!editing && !draggedRef.current) void focusSession(session.id);
              }
            }}
          >
            <span className="relative flex size-4 shrink-0 items-center justify-center">
              {agent ? (
                <WithTooltip label={agentLabel(agent)} side="right">
                  <span className="inline-flex">
                    <AgentIcon agent={agent} thinking={thinking} />
                  </span>
                </WithTooltip>
              ) : (
                <AgentIcon />
              )}
              {needsInput || complete ? <SessionStatusDot /> : null}
            </span>
            <span className="flex h-5 min-w-0 flex-1 items-center gap-1.5">
              {pinned ? (
                <Pin className="size-3 shrink-0 fill-current opacity-60" aria-hidden />
              ) : null}
              {editing ? (
                <input
                  autoFocus
                  value={draft}
                  onFocus={(e) => e.currentTarget.select()}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => void commit()}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void commit();
                    }
                    if (e.key === "Escape") {
                      e.preventDefault();
                      setDraft(session.name);
                      setEditing(false);
                    }
                  }}
                  className="box-border h-5 min-w-0 flex-1 bg-transparent px-0 text-[13px] leading-5 text-sidebar-foreground outline-none"
                />
              ) : (
                <SessionFlowTitle
                  name={session.name}
                  thinking={thinking}
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDraft(session.name);
                    setEditing(true);
                  }}
                />
              )}
              {git?.dirty ? <GitDirtyDot /> : null}
            </span>
          </div>

          {showWorktree ? (
            <WithTooltip label="Worktree">
              <button
                type="button"
                className={cn(
                  "mr-1 flex size-7 shrink-0 items-center justify-center text-muted-foreground group-hover:pointer-events-none group-hover:opacity-0",
                  rowActive && "pointer-events-none opacity-0"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!project) return;
                  void openGitToolkitAt(
                    { projectId: project.id, paneId: `session:${session.id}`, view: "main" },
                    session.id
                  );
                }}
                aria-label="Worktree"
              >
                <FolderTree className="size-3.5 opacity-70" />
              </button>
            </WithTooltip>
          ) : null}

          <div
            className={cn(
              "absolute right-1 top-1/2 z-10 flex -translate-y-1/2 items-center rounded-md bg-sidebar opacity-0 group-hover:bg-sidebar-accent/35 group-hover:opacity-100",
              rowActive && "bg-sidebar-accent/35 opacity-100",
              focused && "bg-sidebar-accent",
              openInPane && !focused && "bg-sidebar-accent/80"
            )}
          >
            <DropdownMenu modal={false} open={menuOpen} onOpenChange={onSessionMenuOpenChange}>
              <WithTooltip label="Session menu" disabled={menuOpen || suppressTip}>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className={cn("size-7 shrink-0", menuOpen && "bg-accent text-foreground")}
                    onClick={(e) => e.stopPropagation()}
                    {...tipTriggerProps}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
              </WithTooltip>
              <DropdownMenuContent
                side="bottom"
                align="start"
                collisionPadding={8}
                className="min-w-[16rem]"
                onCloseAutoFocus={onMenuCloseAutoFocus}
              >
                <DropdownMenuItem shortcut={TerminalShortcuts.rename.label} onSelect={queueRename}>
                  Rename…
                </DropdownMenuItem>
                {showWorktree && project ? (
                  <DropdownMenuItem
                    shortcut={ProjectShortcuts.gitToolkit.label}
                    onClick={() =>
                      void openGitToolkitAt(
                        { projectId: project.id, paneId: `session:${session.id}`, view: "main" },
                        session.id
                      )
                    }
                    >
                    <GitMenuLabel branch={git?.branch} />
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onClick={() => void toggleSessionPin(session.id)}>
                  <Pin className={cn("size-3.5 opacity-70", pinned && "fill-current")} />
                  {pinned ? "Unpin terminal" : "Pin terminal"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  shortcut={TerminalShortcuts.close.label}
                  onClick={() => void closeSessionPanes(session.id)}
                >
                  <X className="size-3.5 opacity-70" />
                  Close
                </DropdownMenuItem>
                <DropdownMenuItem
                  shortcut={TerminalShortcuts.delete.label}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                  onClick={() => requestDeleteSession(session.id)}
                >
                  <Trash2 className="size-3.5 opacity-70" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {showWorktree && project ? (
            <GitToolkitPopover
              projectId={project.id}
              path={session.cwd}
              projectName={project.name}
              paneId={`session:${session.id}`}
              side="right"
            />
          ) : null}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-[16rem]" onCloseAutoFocus={onMenuCloseAutoFocus}>
        <ContextMenuItem shortcut={TerminalShortcuts.rename.label} onSelect={queueRename}>
          Rename…
        </ContextMenuItem>
        {showWorktree && project ? (
          <ContextMenuItem
            shortcut={ProjectShortcuts.gitToolkit.label}
            onClick={() =>
              void openGitToolkitAt(
                { projectId: project.id, paneId: `session:${session.id}`, view: "main" },
                session.id
              )
            }
          >
            <GitMenuLabel branch={git?.branch} />
          </ContextMenuItem>
        ) : null}
        <ContextMenuItem onClick={() => void toggleSessionPin(session.id)}>
          {pinned ? "Unpin terminal" : "Pin terminal"}
        </ContextMenuItem>
        <ContextMenuItem
          shortcut={TerminalShortcuts.close.label}
          onClick={() => void closeSessionPanes(session.id)}
        >
          Close
        </ContextMenuItem>
        <ContextMenuItem
          shortcut={TerminalShortcuts.delete.label}
          onClick={() => requestDeleteSession(session.id)}
        >
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
