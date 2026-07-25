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
import { toggleProjectCollapsed, uiStore, useUI } from "@/store/ui";
import {
  RemoveProject,
  RenameProject,
  OpenInFinder,
} from "../../../wailsjs/go/main/App";
import { cn } from "@/lib/utils";
import { useGitStatus } from "@/queries";
import { DEFAULT_SCOPE, createTerminal, focusScope } from "@/lib/sessions";
import { SessionRow } from "./SessionRow";

export function ProjectRow({ id, name, path }: { id: string; name: string; path: string }) {
  const sessions = useUI((s) => s.sessions.filter((s) => s.projectId === id));
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
            <WithTooltip label="New terminal">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="hidden size-7 shrink-0 group-hover:inline-flex"
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
                    className="hidden size-7 shrink-0 group-hover:inline-flex"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
              </WithTooltip>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void createTerminal(id)}>New terminal</DropdownMenuItem>
                <DropdownMenuItem
                  onClick={async () => {
                    const next = prompt("Rename project", name);
                    if (!next) return;
                    await RenameProject(id, next);
                    uiStore.set({
                      projects: uiStore.get().projects.map((p) => (p.id === id ? { ...p, name: next } : p)),
                    });
                  }}
                >
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void OpenInFinder(path)}>Reveal in Finder</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={async () => {
                    await RemoveProject(id);
                    uiStore.set({
                      projects: uiStore.get().projects.filter((p) => p.id !== id),
                      sessions: uiStore.get().sessions.filter((s) => s.projectId !== id),
                    });
                    await focusScope(DEFAULT_SCOPE);
                  }}
                >
                  Remove
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => void createTerminal(id)}>New terminal</ContextMenuItem>
          <ContextMenuItem onClick={() => void OpenInFinder(path)}>Reveal in Finder</ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={async () => {
              await RemoveProject(id);
              uiStore.set({
                projects: uiStore.get().projects.filter((p) => p.id !== id),
              });
            }}
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
