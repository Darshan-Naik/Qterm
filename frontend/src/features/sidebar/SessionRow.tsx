import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { MoreHorizontal, X, Trash2, Pin } from "lucide-react";
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
import { TerminalShortcuts } from "@/lib/menuShortcuts";
import { GitChip } from "@/features/git";
import { isSessionWorktree } from "@/features/git/gitScope";
import { RENAME_SESSION_EVENT } from "@/features/panes/PaneTitle";
import { dismissExclusiveMenus, useExclusiveMenu } from "@/hooks/useExclusiveMenu";
import { useMenuTooltipGate } from "@/hooks/useMenuTooltipGate";
import { AgentIcon, agentLabel } from "./AgentIcon";

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
  const showWorktreeChip = !!project && isSessionWorktree(session.cwd, project.path);

  const openInPane = useMemo(() => {
    if (openInPaneProp != null) return openInPaneProp;
    return collectSessionIds(splitTree).includes(session.id);
  }, [openInPaneProp, session.id, splitTree]);

  const canDrag = !openInPane;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.name);
  const [dragging, setDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useExclusiveMenu(`session:${session.id}`);
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
            "group relative flex w-full items-center gap-0.5 rounded-lg pr-1 text-[13px] leading-snug text-muted-foreground hover:bg-sidebar-accent/35 hover:text-sidebar-foreground",
            openInPane &&
              !focused &&
              "bg-sidebar-accent/80 text-sidebar-foreground before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-full before:bg-primary/55",
            focused &&
              "bg-sidebar-accent font-medium text-sidebar-foreground before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:rounded-full before:bg-primary",
            dragging && "opacity-50",
            needsInput && "session-needs-input",
            thinking && "session-thinking",
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
                    <AgentIcon
                      agent={agent}
                      thinking={thinking}
                      needsInput={needsInput}
                      complete={complete}
                    />
                  </span>
                </WithTooltip>
              ) : (
                <AgentIcon />
              )}
              {needsInput ? (
                <span className="pointer-events-none absolute -right-0.5 -top-0.5 flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-amber-400" />
                </span>
              ) : null}
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
                <span
                  className="min-w-0 flex-1 truncate leading-5"
                  onDoubleClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDraft(session.name);
                    setEditing(true);
                  }}
                >
                  {session.name}
                </span>
              )}
            </span>
          </div>

          <div
            className={cn(
              "hidden shrink-0 items-center justify-end group-hover:flex",
              menuOpen && "flex"
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
                align="end"
                className="min-w-[12rem]"
                onCloseAutoFocus={onMenuCloseAutoFocus}
              >
                <DropdownMenuItem shortcut={TerminalShortcuts.rename.label} onSelect={queueRename}>
                  Rename…
                </DropdownMenuItem>
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

          {showWorktreeChip && project ? (
            <GitChip
              projectId={session.projectId}
              path={session.cwd}
              projectName={project.name}
              paneId={`session:${session.id}`}
              listenToShortcut={false}
              variant="session"
            />
          ) : null}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="min-w-[12rem]" onCloseAutoFocus={onMenuCloseAutoFocus}>
        <ContextMenuItem shortcut={TerminalShortcuts.rename.label} onSelect={queueRename}>
          Rename…
        </ContextMenuItem>
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
