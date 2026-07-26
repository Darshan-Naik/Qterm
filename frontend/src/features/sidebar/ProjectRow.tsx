import { useMemo } from "react";
import {
  Folder,
  FolderGit2,
  MoreHorizontal,
  Circle,
  ChevronRight,
  Plus,
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
import { toggleProjectCollapsed, useUI } from "@/store/ui";
import { OpenInFinder } from "../../../wailsjs/go/main/App";
import { cn } from "@/lib/utils";
import { useGitStatus } from "@/queries";
import { createTerminal, focusScope } from "@/lib/sessions";
import { removeProjectById, renameProjectById } from "@/lib/menuActions";
import { ProjectShortcuts } from "@/lib/menuShortcuts";
import { SessionRow } from "./SessionRow";

export function ProjectRow({ id, name, path }: { id: string; name: string; path: string }) {
  const allSessions = useUI((s) => s.sessions);
  const sessions = useMemo(() => allSessions.filter((s) => s.projectId === id), [allSessions, id]);
  const collapsed = useUI((s) => !!s.collapsedProjects[id]);
  const { data: gitData } = useGitStatus(path);
  const git = gitData as { isRepo?: boolean; branch?: string; dirty?: boolean } | undefined;
  const ProjectIcon = git?.isRepo ? FolderGit2 : Folder;

  return (
    <div>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div className="group flex w-full items-center gap-0.5">
            <WithTooltip label={collapsed ? "Expand" : "Collapse"} side="right">
              <button
                type="button"
                className="relative flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleProjectCollapsed(id);
                }}
              >
                <ProjectIcon className="size-4 opacity-70 group-hover:opacity-0" />
                <ChevronRight
                  className={cn(
                    "absolute size-4 opacity-0 transition-transform group-hover:opacity-100",
                    !collapsed && "rotate-90"
                  )}
                />
              </button>
            </WithTooltip>
            <button
              type="button"
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left text-[13px] leading-snug text-sidebar-foreground hover:bg-sidebar-accent/50"
              onClick={() => {
                if (collapsed) toggleProjectCollapsed(id);
                void focusScope(id);
              }}
              onDoubleClick={() => toggleProjectCollapsed(id)}
            >
              <span className="max-w-[42%] shrink-0 truncate font-normal">{name}</span>
              {git?.isRepo && (
                <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-[12px] text-muted-foreground group-hover:hidden">
                  <span className="min-w-0 truncate">{git.branch}</span>
                  {git.dirty && <Circle className="size-1.5 shrink-0 fill-amber-400 text-amber-400" />}
                </span>
              )}
            </button>
            <WithTooltip label={`New terminal (${ProjectShortcuts.newTerminal.label})`}>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7 shrink-0 opacity-0 group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  void createTerminal(id);
                }}
              >
                <Plus className="size-4" />
              </Button>
            </WithTooltip>
            <DropdownMenu>
              <WithTooltip label="Project menu">
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7 shrink-0 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
              </WithTooltip>
              <DropdownMenuContent align="end" side="bottom" sideOffset={4} className="min-w-[14rem]">
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
                  shortcut={ProjectShortcuts.remove.label}
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                  onClick={() => void removeProjectById(id)}
                >
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
            shortcut={ProjectShortcuts.remove.label}
            onClick={() => void removeProjectById(id)}
          >
            Remove project
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      {!collapsed && sessions.length > 0 && (
        <div className="ml-4 mt-0.5 space-y-0.5">
          {sessions.map((s) => (
            <SessionRow key={s.id} session={s} />
          ))}
        </div>
      )}
    </div>
  );
}
