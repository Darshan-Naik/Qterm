import { useMemo } from "react";
import {
  Folder,
  FolderGit2,
  MoreHorizontal,
  Circle,
  ChevronRight,
  Plus,
  X,
  Trash2,
} from "lucide-react";
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
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { collectSessionIds, toggleProjectCollapsed, useUI, type SessionInfo } from "@/store/ui";
import { OpenInFinder } from "../../../wailsjs/go/main/App";
import { cn } from "@/lib/utils";
import { useGitStatus } from "@/queries";
import { createTerminal, setActiveScope } from "@/lib/sessions";
import { closeProjectPanes, requestDeleteProjectSessions } from "@/lib/panes";
import { removeProjectById, renameProjectById } from "@/lib/menuActions";
import { ProjectShortcuts } from "@/lib/menuShortcuts";
import { dismissExclusiveMenus, useExclusiveMenu } from "@/hooks/useExclusiveMenu";
import { useMenuTooltipGate } from "@/hooks/useMenuTooltipGate";
import { SessionRow } from "./SessionRow";
import { SIDEBAR_PROJECT_STICKY_TOP, SIDEBAR_STICKY_SEAL } from "./sidebarLayout";

function SessionList({
  sessions,
  openIds,
}: {
  sessions: SessionInfo[];
  openIds: Set<string>;
}) {
  return (
    <div className="ml-4 mt-0.5 space-y-0.5">
      {sessions.map((s) => (
        <SessionRow key={s.id} session={s} openInPane={openIds.has(s.id)} />
      ))}
    </div>
  );
}

export function ProjectRow({ id, name, path }: { id: string; name: string; path: string }) {
  const allSessions = useUI((s) => s.sessions);
  const splitTree = useUI((s) => s.splitTree);
  const sessions = useMemo(() => allSessions.filter((s) => s.projectId === id), [allSessions, id]);
  const collapsed = useUI((s) => !!s.collapsedProjects[id]);
  // Any session in the current window layout counts as open (incl. other projects).
  const layoutIds = useMemo(() => new Set(collectSessionIds(splitTree)), [splitTree]);
  const openSessionIds = useMemo(
    () => new Set(sessions.map((s) => s.id).filter((sid) => layoutIds.has(sid))),
    [sessions, layoutIds]
  );
  // Peek stays outside the collapsible so open/pinned never animate away on collapse.
  const peekSessions = useMemo(
    () => sessions.filter((s) => openSessionIds.has(s.id) || s.pinned),
    [sessions, openSessionIds]
  );
  const peekIds = useMemo(() => new Set(peekSessions.map((s) => s.id)), [peekSessions]);
  const extraSessions = useMemo(
    () => sessions.filter((s) => !peekIds.has(s.id)),
    [sessions, peekIds]
  );

  const { data: gitData } = useGitStatus(path);
  const git = gitData as { isRepo?: boolean; branch?: string; dirty?: boolean } | undefined;
  const ProjectIcon = git?.isRepo ? FolderGit2 : Folder;
  const [menuOpen, setMenuOpen] = useExclusiveMenu(`project:${id}`);
  const { suppressTip, suppressTipAfterMenuClose, tipTriggerProps } = useMenuTooltipGate();

  const onProjectMenuOpenChange = (next: boolean) => {
    setMenuOpen(next);
    if (!next) suppressTipAfterMenuClose();
  };

  return (
    <div>
      <div
        className={cn(
          "sticky z-10 -mx-3 bg-sidebar px-3",
          SIDEBAR_PROJECT_STICKY_TOP,
          SIDEBAR_STICKY_SEAL
        )}
      >
        <ContextMenu
          onOpenChange={(open) => {
            if (open) dismissExclusiveMenus();
          }}
        >
          <ContextMenuTrigger asChild>
            <div
              className={cn(
                "group relative flex w-full min-w-0 items-center rounded-lg hover:bg-sidebar-accent/50",
                menuOpen && "bg-sidebar-accent/50"
              )}
            >
            <WithTooltip label={collapsed ? "Expand" : "Collapse"} side="right">
              <button
                type="button"
                className="relative flex size-7 shrink-0 cursor-pointer items-center justify-center text-muted-foreground hover:text-sidebar-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleProjectCollapsed(id);
                }}
              >
                <ProjectIcon className="size-4 opacity-70 transition-opacity duration-200 ease-[var(--motion-ease-out)] group-hover:opacity-0" />
                <ChevronRight
                  className={cn(
                    "absolute size-4 opacity-0 transition-[transform,opacity] duration-200 ease-[var(--motion-ease-out)] group-hover:opacity-100",
                    !collapsed && "rotate-90"
                  )}
                />
              </button>
            </WithTooltip>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-lg px-1.5 py-1.5 text-left text-[13px] leading-snug text-sidebar-foreground"
              onClick={() => {
                if (collapsed) toggleProjectCollapsed(id);
                void setActiveScope(id);
              }}
              onDoubleClick={() => toggleProjectCollapsed(id)}
            >
              <WithTooltip label={name} side="right">
                <span className="min-w-0 shrink truncate font-normal">{name}</span>
              </WithTooltip>
              {git?.isRepo && (
                <span
                  className={cn(
                    "ml-auto flex min-w-0 max-w-[58%] shrink items-center justify-end gap-1.5 pl-1 text-[12px] text-muted-foreground group-hover:invisible",
                    menuOpen && "invisible"
                  )}
                >
                  <WithTooltip label={git.branch ?? ""} side="right">
                    <span className="min-w-0 truncate text-right">{git.branch}</span>
                  </WithTooltip>
                  {git.dirty && <Circle className="size-1.5 shrink-0 fill-amber-400 text-amber-400" />}
                </span>
              )}
            </button>
            <div
              className={cn(
                "pointer-events-none absolute inset-y-0 right-0 flex items-center gap-0.5 opacity-0 group-hover:pointer-events-auto group-hover:opacity-100",
                menuOpen && "pointer-events-auto opacity-100"
              )}
            >
              <WithTooltip label={`New terminal (${ProjectShortcuts.newTerminal.label})`}>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    void createTerminal(id);
                  }}
                >
                  <Plus className="size-4" />
                </Button>
              </WithTooltip>
              <DropdownMenu modal={false} open={menuOpen} onOpenChange={onProjectMenuOpenChange}>
                <WithTooltip label="Project menu" disabled={menuOpen || suppressTip}>
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
                  className="min-w-[14rem]"
                  onCloseAutoFocus={(e) => e.preventDefault()}
                >
                  <DropdownMenuItem
                    shortcut={ProjectShortcuts.newTerminal.label}
                    onClick={() => void createTerminal(id)}
                  >
                    New terminal
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    shortcut={ProjectShortcuts.rename.label}
                    onClick={() => void renameProjectById(id, name)}
                  >
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    shortcut={ProjectShortcuts.reveal.label}
                    onClick={() => void OpenInFinder(path)}
                  >
                    Reveal in Finder
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={openSessionIds.size === 0}
                    onClick={() => void closeProjectPanes(id)}
                  >
                    <X className="size-3.5 opacity-70" />
                    Close all
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={sessions.length === 0}
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                    onClick={() => void requestDeleteProjectSessions(id)}
                  >
                    <Trash2 className="size-3.5 opacity-70" />
                    Delete all
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    shortcut={ProjectShortcuts.remove.label}
                    className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                    onClick={() => void removeProjectById(id)}
                  >
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="min-w-[14rem]">
            <ContextMenuItem
              shortcut={ProjectShortcuts.newTerminal.label}
              onClick={() => void createTerminal(id)}
            >
              New terminal
            </ContextMenuItem>
            <ContextMenuItem
              shortcut={ProjectShortcuts.rename.label}
              onClick={() => void renameProjectById(id, name)}
            >
              Rename
            </ContextMenuItem>
            <ContextMenuItem
              shortcut={ProjectShortcuts.reveal.label}
              onClick={() => void OpenInFinder(path)}
            >
              Reveal in Finder
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              disabled={openSessionIds.size === 0}
              onClick={() => void closeProjectPanes(id)}
            >
              Close all
            </ContextMenuItem>
            <ContextMenuItem
              disabled={sessions.length === 0}
              onClick={() => void requestDeleteProjectSessions(id)}
            >
              Delete all
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              shortcut={ProjectShortcuts.remove.label}
              onClick={() => void removeProjectById(id)}
            >
              Remove project
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
      </div>
      {/* Peek only when collapsed — when expanded keep stable session order. */}
      {collapsed && peekSessions.length > 0 && (
        <SessionList sessions={peekSessions} openIds={openSessionIds} />
      )}
      {!collapsed && sessions.length === 0 ? (
        <button
          type="button"
          className="ml-4 mt-0.5 flex w-[calc(100%-1rem)] cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] leading-snug text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
          onClick={() => void createTerminal(id)}
        >
          <Plus className="size-4 shrink-0 opacity-60" />
          <span>New terminal</span>
        </button>
      ) : null}
      {(!collapsed ? sessions.length > 0 : extraSessions.length > 0) && (
        <Collapsible open={!collapsed}>
          <CollapsibleContent>
            <SessionList
              sessions={collapsed ? extraSessions : sessions}
              openIds={openSessionIds}
            />
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
