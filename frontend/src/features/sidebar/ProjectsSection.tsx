import { useMemo } from "react";
import { FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WithTooltip } from "@/components/ui/tooltip";
import { uiStore, useUI } from "@/store/ui";
import { AddProject, PickFolder } from "../../../wailsjs/go/main/App";
import { cn } from "@/lib/utils";
import { createTerminal, isUnbound } from "@/lib/sessions";
import { sortProjectsByAdded } from "@/lib/sessionTitles";
import { ProjectRow } from "./ProjectRow";
import {
  SIDEBAR_PROJECTS_STICKY_H,
  SIDEBAR_STICKY_SEAL,
} from "./sidebarLayout";

export function ProjectsSection() {
  const projects = useUI((s) => s.projects);
  const sessions = useUI((s) => s.sessions);
  const unboundSessions = useMemo(
    () => sessions.filter((s) => isUnbound(s.projectId)),
    [sessions]
  );

  return (
    <div className={cn(unboundSessions.length > 0 ? "mt-4" : "mt-2")}>
      <div
        className={cn(
          "sticky top-0 z-20 -mx-3 flex items-center bg-sidebar px-3",
          SIDEBAR_PROJECTS_STICKY_H,
          SIDEBAR_STICKY_SEAL
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-1 px-1">
          <div className="min-w-0 flex-1 px-1.5 text-[12px] leading-none text-muted-foreground">
            Projects
          </div>
          <WithTooltip label="Add project">
            <Button
              size="icon"
              variant="ghost"
              className="size-7 shrink-0 text-muted-foreground opacity-75"
              onClick={async () => {
                const path = await PickFolder();
                if (!path) return;
                const p = await AddProject(path, "");
                uiStore.set({
                  projects: sortProjectsByAdded([...uiStore.get().projects, p]),
                });
                await createTerminal(p.id);
              }}
            >
              <FolderPlus className="size-4" />
            </Button>
          </WithTooltip>
        </div>
      </div>
      {projects.length > 0 && (
        <div>
          {projects.map((p) => (
            <ProjectRow key={p.id} id={p.id} name={p.name} path={p.path} />
          ))}
        </div>
      )}
    </div>
  );
}
