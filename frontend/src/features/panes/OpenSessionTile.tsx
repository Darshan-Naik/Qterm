import { useEffect, useRef, useState } from "react";
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
import { uiStore, useUI, type SessionInfo } from "@/store/ui";
import { RenameSession } from "../../../wailsjs/go/main/App";
import { cn } from "@/lib/utils";
import { focusSession } from "@/lib/sessions";
import { closeSessionPanes, requestDeleteSession } from "@/lib/panes";
import { toggleSessionPin } from "@/lib/sessionPin";
import { GitDirtyDot, GitMenuLabel, GitToolkitPopover, isSessionWorktree, openGitToolkitAt } from "@/features/git";
import { useGitStatus } from "@/queries";
import { ProjectShortcuts, TerminalShortcuts } from "@/lib/menuShortcuts";
import { RENAME_SESSION_EVENT } from "@/features/panes/PaneTitle";
import { dismissExclusiveMenus, useExclusiveMenu } from "@/hooks/useExclusiveMenu";
import { useMenuTooltipGate } from "@/hooks/useMenuTooltipGate";
import { AgentIcon, agentLabel } from "@/features/sidebar/AgentIcon";
import { SessionFlowTitle } from "@/features/sidebar/SessionFlowTitle";
import { SessionStatusDot } from "@/features/sidebar/SessionStatusDot";

/** Compact session tile for the open-workspace grid (sidebar menu + agent states). */
export function OpenSessionTile({ session }: { session: SessionInfo }) {
  const anim = useUI((s) => s.paneAnimations[session.id] || "none");
  const agent = useUI((s) => s.sessionAgents[session.id] || "");
  const projects = useUI((s) => s.projects);
  const pinned = !!session.pinned;
  const project = projects.find((p) => p.id === session.projectId);
  const showWorktree = !!project && isSessionWorktree(session.cwd, project.path);
  const { data: gitData } = useGitStatus(showWorktree ? session.cwd : "");
  const git = gitData as { isRepo?: boolean; dirty?: boolean; branch?: string } | undefined;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.name);
  const [menuOpen, setMenuOpen] = useExclusiveMenu(`open-session:${session.id}`);
  const gitOpen = useUI((s) => s.gitPanel?.paneId === `open-session:${session.id}`);
  const rowActive = menuOpen || gitOpen;
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
            "group relative flex min-h-10 w-full min-w-0 items-center rounded-lg bg-accent/20 px-2.5 py-2 text-left",
            "transition-colors hover:bg-accent/45",
            rowActive && "bg-accent/45",
            needsInput && "session-needs-input",
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
                    <AgentIcon agent={agent} thinking={thinking} />
                  </span>
                </WithTooltip>
              ) : (
                <AgentIcon />
              )}
              {needsInput || complete ? <SessionStatusDot /> : null}
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
              <SessionFlowTitle
                name={session.name}
                thinking={thinking}
                className="text-[13px] font-medium text-muted-foreground"
                onDoubleClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDraft(session.name);
                  setEditing(true);
                }}
              />
            )}
            {git?.dirty ? <GitDirtyDot /> : null}
          </button>

          {showWorktree ? (
            <WithTooltip label="Worktree">
              <button
                type="button"
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center text-muted-foreground group-hover:pointer-events-none group-hover:opacity-0",
                  rowActive && "pointer-events-none opacity-0"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!project) return;
                  void openGitToolkitAt(
                    { projectId: project.id, paneId: `open-session:${session.id}`, view: "main" },
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
              "pointer-events-none absolute right-2.5 top-1/2 z-10 flex -translate-y-1/2 items-center opacity-0 group-hover:pointer-events-auto group-hover:opacity-100",
              rowActive && "pointer-events-auto opacity-100"
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
                          { projectId: project.id, paneId: `open-session:${session.id}`, view: "main" },
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
              paneId={`open-session:${session.id}`}
              side="bottom"
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
                { projectId: project.id, paneId: `open-session:${session.id}`, view: "main" },
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
