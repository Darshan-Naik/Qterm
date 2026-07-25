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
  const unboundSessions = useUI((s) => s.sessions.filter((s) => isUnbound(s.projectId)));

  return (
    <div className={cn(unboundSessions.length > 0 && "mt-3")}>
      <div className="flex items-center gap-0.5 px-0.5 pb-1">
        <div className="min-w-0 flex-1 px-2 text-[11px] text-muted-foreground">Projects</div>
        <WithTooltip label="Add project">
          <Button
            size="icon"
            variant="ghost"
            className="size-6 shrink-0 text-muted-foreground"
            onClick={async () => {
              const path = await PickFolder();
              if (!path) return;
              const p = await AddProject(path, "");
              uiStore.set({ projects: [...uiStore.get().projects, p] });
              await createTerminal(p.id);
            }}
          >
            <FolderPlus className="size-3.5" />
          </Button>
        </WithTooltip>
      </div>
      {projects.length > 0 && (
        <div className="space-y-2">
          {projects.map((p) => (
            <ProjectRow key={p.id} id={p.id} name={p.name} path={p.path} />
          ))}
        </div>
      )}
    </div>
  );
}
