import {
  Folder,
  FolderGit2,
  MoreHorizontal,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useMemo } from "react";
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
import { collectSessionIds, useUI, type SessionInfo } from "@/store/ui";
import { OpenInFinder } from "../../../wailsjs/go/main/App";
import { cn } from "@/lib/utils";
import { useGitStatus } from "@/queries";
import { GitChip } from "@/features/git";
import { createTerminal } from "@/lib/sessions";
import { closeProjectPanes, requestDeleteProjectSessions } from "@/lib/panes";
import { removeProjectById, renameProjectById } from "@/lib/menuActions";
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
  const layoutOpenCount = useMemo(() => {
    const ids = new Set(sessions.map((s) => s.id));
    return collectSessionIds(splitTree).filter((sid) => ids.has(sid)).length;
  }, [sessions, splitTree]);

  const { data: gitData } = useGitStatus(path);
  const git = gitData as { isRepo?: boolean; branch?: string; dirty?: boolean } | undefined;
  const ProjectIcon = git?.isRepo ? FolderGit2 : Folder;
  const [menuOpen, setMenuOpen] = useExclusiveMenu(`open-project:${id}`);
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
                "group relative flex h-8 min-w-0 items-center gap-2 rounded-md px-1",
                "hover:bg-accent/40",
                menuOpen && "bg-accent/40"
              )}
            >
              <WithTooltip label={path || name}>
                <span className="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
                  <ProjectIcon className="size-3.5" />
                </span>
              </WithTooltip>
              <h2 className="min-w-0 shrink truncate text-[13px] font-medium text-foreground">
                {name}
              </h2>
              <GitChip
                projectId={id}
                path={path}
                projectName={name}
                listenToShortcut={false}
                variant="open"
              />
              <div
                className={cn(
                  "ml-auto flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100",
                  menuOpen && "opacity-100"
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

      {sessions.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(15.5rem,1fr))] gap-2">
          {sessions.map((s) => (
            <OpenSessionTile key={s.id} session={s} />
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void createTerminal(id)}
          className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border/50 text-[12px] text-muted-foreground transition-colors hover:border-border hover:bg-accent/40 hover:text-foreground"
        >
          <Plus className="size-3.5" />
          New terminal
        </button>
      )}
    </section>
  );
}
