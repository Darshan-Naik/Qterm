import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Pin, Trash2, X } from "lucide-react";
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
import { uiStore, useUI, type SessionInfo } from "@/store/ui";
import { RenameSession } from "../../../wailsjs/go/main/App";
import { cn } from "@/lib/utils";
import { focusSession } from "@/lib/sessions";
import { closeSessionPanes, requestDeleteSession } from "@/lib/panes";
import { toggleSessionPin } from "@/lib/sessionPin";
import { TerminalShortcuts } from "@/lib/menuShortcuts";
import { GitChip, isSessionWorktree } from "@/features/git";
import { RENAME_SESSION_EVENT } from "@/features/panes/PaneTitle";
import { dismissExclusiveMenus, useExclusiveMenu } from "@/hooks/useExclusiveMenu";
import { useMenuTooltipGate } from "@/hooks/useMenuTooltipGate";
import { AgentIcon, agentLabel } from "@/features/sidebar/AgentIcon";

/** Compact session tile for the open-workspace grid (sidebar menu + agent states). */
export function OpenSessionTile({ session }: { session: SessionInfo }) {
  const anim = useUI((s) => s.paneAnimations[session.id] || "none");
  const agent = useUI((s) => s.sessionAgents[session.id] || "");
  const projects = useUI((s) => s.projects);
  const pinned = !!session.pinned;
  const project = projects.find((p) => p.id === session.projectId);
  const showWorktreeChip = !!project && isSessionWorktree(session.cwd, project.path);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.name);
  const [menuOpen, setMenuOpen] = useExclusiveMenu(`open-session:${session.id}`);
  const { suppressTip, suppressTipAfterMenuClose, tipTriggerProps } = useMenuTooltipGate();
  const pendingRename = useRef(false);

  const needsInput = anim === "action_required";
  const thinking = anim === "thinking";
  const complete = anim === "task_complete";

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

  const onMenuOpenChange = (next: boolean) => {
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

  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (open) dismissExclusiveMenus();
      }}
    >
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            "group relative flex min-h-10 w-full min-w-0 items-center rounded-lg border border-transparent bg-accent/20 px-2.5 py-2 text-left",
            "transition-colors hover:border-border hover:bg-accent/45",
            menuOpen && "border-border bg-accent/45",
            needsInput && "session-needs-input",
            thinking && "session-thinking",
            complete && "session-complete"
          )}
        >
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
            onClick={() => {
              if (!editing) void focusSession(session.id);
            }}
          >
            <span className="relative flex size-4 shrink-0 items-center justify-center">
              {agent ? (
                <WithTooltip label={agentLabel(agent)}>
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
                className="box-border h-5 min-w-0 flex-1 bg-transparent px-0 text-[13px] font-medium leading-5 text-muted-foreground outline-none"
              />
            ) : (
              <span
                className="min-w-0 flex-1 truncate text-[13px] font-medium text-muted-foreground"
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
          </button>

          <div className="relative ml-auto flex shrink-0 items-center">
            <div
              className={cn(
                "pointer-events-none absolute right-full top-1/2 z-10 flex -translate-y-1/2 items-center opacity-0 group-hover:pointer-events-auto group-hover:opacity-100",
                menuOpen && "pointer-events-auto opacity-100"
              )}
            >
              <DropdownMenu modal={false} open={menuOpen} onOpenChange={onMenuOpenChange}>
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
                      <MoreHorizontal className="size-3.5" />
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
                paneId={`open-session:${session.id}`}
                listenToShortcut={false}
                variant="session"
              />
            ) : null}
          </div>
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
