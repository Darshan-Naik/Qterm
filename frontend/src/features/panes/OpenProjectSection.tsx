import {
  ChevronRight,
  Folder,
  FolderGit2,
  MoreHorizontal,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
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
import { GitChip, GitWorktreePicker } from "@/features/git";
import { createTerminal, setActiveScope } from "@/lib/sessions";
import { closeProjectPanes, requestDeleteProjectSessions } from "@/lib/panes";
import { removeProjectById, renameProjectById, openPathInIDE } from "@/lib/menuActions";
import { ProjectShortcuts } from "@/lib/menuShortcuts";
import { dismissExclusiveMenus, useExclusiveMenu } from "@/hooks/useExclusiveMenu";
import { useMenuTooltipGate } from "@/hooks/useMenuTooltipGate";
import { OpenSessionTile } from "./OpenSessionTile";
import { OPEN_PROJECT_STICKY_TOP, OPEN_STICKY_SEAL } from "./openWorkspaceLayout";

export function OpenProjectSection({
  id,
  name,
  path,
  sessions,
}: {
  id: string;
  name: string;
  path: string;
  sessions: SessionInfo[];
}) {
  const splitTree = useUI((s) => s.splitTree);
  const collapsed = useUI((s) => !!s.collapsedProjects[id]);
  const layoutIds = useMemo(() => new Set(collectSessionIds(splitTree)), [splitTree]);
  const layoutOpenCount = useMemo(
    () => sessions.filter((s) => layoutIds.has(s.id)).length,
    [sessions, layoutIds]
  );
  const peekSessions = useMemo(
    () => sessions.filter((s) => layoutIds.has(s.id) || s.pinned),
    [sessions, layoutIds]
  );
  const peekIds = useMemo(() => new Set(peekSessions.map((s) => s.id)), [peekSessions]);
  const extraSessions = useMemo(
    () => sessions.filter((s) => !peekIds.has(s.id)),
    [sessions, peekIds]
  );

  const { data: gitData } = useGitStatus(path);
  const git = gitData as { isRepo?: boolean; branch?: string; dirty?: boolean } | undefined;
  const ProjectIcon = git?.isRepo ? FolderGit2 : Folder;
  const [menuOpen, setMenuOpen] = useExclusiveMenu(`open-project:${id}`);
  const [worktreeOpen, setWorktreeOpen] = useState(false);
  const { suppressTip, suppressTipAfterMenuClose, tipTriggerProps } = useMenuTooltipGate();

  const onMenuOpenChange = (next: boolean) => {
    setMenuOpen(next);
    if (!next) suppressTipAfterMenuClose();
  };

  return (
    <section className="space-y-2">
      <div
        className={cn(
          "sticky z-10 -mx-1 bg-background px-1",
          OPEN_PROJECT_STICKY_TOP,
          OPEN_STICKY_SEAL
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
                "group relative flex h-8 min-w-0 items-center rounded-md px-1",
                "hover:bg-accent/40",
                menuOpen && "bg-accent/40"
              )}
            >
              <WithTooltip label={collapsed ? "Expand" : "Collapse"}>
                <button
                  type="button"
                  className="relative flex size-7 shrink-0 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleProjectCollapsed(id);
                  }}
                >
                  <ProjectIcon className="size-3.5 opacity-70 transition-opacity duration-200 ease-[var(--motion-ease-out)] group-hover:opacity-0" />
                  <ChevronRight
                    className={cn(
                      "absolute size-3.5 opacity-0 transition-[transform,opacity] duration-200 ease-[var(--motion-ease-out)] group-hover:opacity-100",
                      !collapsed && "rotate-90"
                    )}
                  />
                </button>
              </WithTooltip>
              <button
                type="button"
                className="min-w-0 flex-1 truncate px-1.5 text-left text-[13px] font-medium text-foreground"
                onClick={() => {
                  if (collapsed) toggleProjectCollapsed(id);
                  void setActiveScope(id);
                }}
                onDoubleClick={() => toggleProjectCollapsed(id)}
              >
                {name}
              </button>
              <div
                className={cn(
                  "hidden shrink-0 items-center justify-end gap-0.5 group-hover:flex",
                  menuOpen && "flex"
                )}
              >
                <WithTooltip label={`New terminal (${ProjectShortcuts.newTerminal.label})`}>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      void createTerminal(id);
                    }}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </WithTooltip>
                <DropdownMenu modal={false} open={menuOpen} onOpenChange={onMenuOpenChange}>
                  <WithTooltip label="Project menu" disabled={menuOpen || suppressTip}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className={cn("size-7", menuOpen && "bg-accent text-foreground")}
                        onClick={(e) => e.stopPropagation()}
                        {...tipTriggerProps}
                      >
                        <MoreHorizontal className="size-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                  </WithTooltip>
                  <DropdownMenuContent align="end" className="min-w-[14rem]">
                    <DropdownMenuItem
                      shortcut={ProjectShortcuts.newTerminal.label}
                      onClick={() => void createTerminal(id)}
                    >
                      New terminal
                    </DropdownMenuItem>
                    {git?.isRepo ? (
                      <DropdownMenuItem onClick={() => setWorktreeOpen(true)}>
                        New worktree terminal…
                      </DropdownMenuItem>
                    ) : null}
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
                    <DropdownMenuItem
                      shortcut={ProjectShortcuts.openInIDE.label}
                      onClick={() => void openPathInIDE(path)}
                    >
                      Open in IDE
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      disabled={layoutOpenCount === 0}
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
              <GitChip
                projectId={id}
                path={path}
                projectName={name}
                paneId={`open-project:${id}`}
                listenToShortcut={false}
                variant="open"
              />
            </div>
          </ContextMenuTrigger>
          <ContextMenuContent className="min-w-[14rem]">
            <ContextMenuItem
              shortcut={ProjectShortcuts.newTerminal.label}
              onClick={() => void createTerminal(id)}
            >
              New terminal
            </ContextMenuItem>
            {git?.isRepo ? (
              <ContextMenuItem onClick={() => setWorktreeOpen(true)}>
                New worktree terminal…
              </ContextMenuItem>
            ) : null}
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
            <ContextMenuItem
              shortcut={ProjectShortcuts.openInIDE.label}
              onClick={() => void openPathInIDE(path)}
            >
              Open in IDE
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem
              disabled={layoutOpenCount === 0}
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

      {collapsed && peekSessions.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(15.5rem,1fr))] gap-2">
          {peekSessions.map((s) => (
            <OpenSessionTile key={s.id} session={s} />
          ))}
        </div>
      ) : null}
      {!collapsed && sessions.length === 0 ? (
        <button
          type="button"
          onClick={() => void createTerminal(id)}
          className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/50 text-[12px] text-muted-foreground transition-colors hover:border-border hover:bg-accent/40 hover:text-foreground"
        >
          <Plus className="size-3.5" />
          New terminal
        </button>
      ) : null}
      {(!collapsed ? sessions.length > 0 : extraSessions.length > 0) ? (
        <Collapsible open={!collapsed}>
          <CollapsibleContent>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(15.5rem,1fr))] gap-2">
              {(collapsed ? extraSessions : sessions).map((s) => (
                <OpenSessionTile key={s.id} session={s} />
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
      {git?.isRepo ? (
        <GitWorktreePicker
          open={worktreeOpen}
          onOpenChange={setWorktreeOpen}
          projectId={id}
          path={path}
        />
      ) : null}
    </section>
  );
}
