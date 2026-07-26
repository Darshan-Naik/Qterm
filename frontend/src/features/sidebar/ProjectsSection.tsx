import { useMemo } from "react";
import { FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WithTooltip } from "@/components/ui/tooltip";
import { uiStore, useUI } from "@/store/ui";
import { AddProject, PickFolder } from "../../../wailsjs/go/main/App";
import { cn } from "@/lib/utils";
import { createTerminal, isUnbound } from "@/lib/sessions";
import { ProjectRow } from "./ProjectRow";

export function ProjectsSection() {
  const projects = useUI((s) => s.projects);
  const sessions = useUI((s) => s.sessions);
  const unboundSessions = useMemo(
    () => sessions.filter((s) => isUnbound(s.projectId)),
    [sessions]
  );

  return (
    <div className={cn(unboundSessions.length > 0 ? "mt-5" : "mt-3")}>
      <div className="mb-1.5 flex items-center gap-1 px-1">
        <div className="min-w-0 flex-1 px-1.5 text-[12px] leading-none text-muted-foreground">
          Projects
        </div>
        <WithTooltip label="Add project">
          <Button
            size="icon"
            variant="ghost"
            className="size-7 shrink-0 text-muted-foreground"
            onClick={async () => {
              const path = await PickFolder();
              if (!path) return;
              const p = await AddProject(path, "");
              uiStore.set({ projects: [...uiStore.get().projects, p] });
              await createTerminal(p.id);
            }}
          >
            <FolderPlus className="size-4" />
          </Button>
        </WithTooltip>
      </div>
      {projects.length > 0 && (
        <div className="space-y-1">
          {projects.map((p) => (
            <ProjectRow key={p.id} id={p.id} name={p.name} path={p.path} />
          ))}
        </div>
      )}
    </div>
  );
}
