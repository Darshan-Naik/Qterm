import { useMemo } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WithTooltip } from "@/components/ui/tooltip";
import { useUI, type SessionInfo } from "@/store/ui";
import { createDefaultTerminal, isUnbound } from "@/lib/sessions";
import { OpenProjectSection } from "./OpenProjectSection";
import { OpenSessionTile } from "./OpenSessionTile";
import { OPEN_PROJECT_STICKY_TOP, OPEN_STICKY_SEAL } from "./openWorkspaceLayout";
import { cn } from "@/lib/utils";

/** Dense session grid when the window has no open panes. */
export function OpenSessionGrid() {
  const sessions = useUI((s) => s.sessions);
  const projects = useUI((s) => s.projects);

  const homeSessions = useMemo(
    () => sessions.filter((s) => isUnbound(s.projectId)),
    [sessions]
  );

  const sessionsByProject = useMemo(() => {
    const map = new Map<string, SessionInfo[]>();
    for (const s of sessions) {
      if (isUnbound(s.projectId)) continue;
      const list = map.get(s.projectId) || [];
      list.push(s);
      map.set(s.projectId, list);
    }
    return map;
  }, [sessions]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
      <div className="flex flex-col gap-5">
        {homeSessions.length > 0 ? (
          <section className="space-y-2">
            <div
              className={cn(
                "sticky z-10 -mx-1 flex h-8 items-center gap-2 bg-background px-1",
                OPEN_PROJECT_STICKY_TOP,
                OPEN_STICKY_SEAL
              )}
            >
              <h2 className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                Home
              </h2>
              <WithTooltip label="New terminal">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7 shrink-0"
                  onClick={() => void createDefaultTerminal()}
                >
                  <Plus className="size-3.5" />
                </Button>
              </WithTooltip>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(15.5rem,1fr))] gap-2">
              {homeSessions.map((s) => (
                <OpenSessionTile key={s.id} session={s} />
              ))}
            </div>
          </section>
        ) : null}

        {projects.map((p) => (
          <OpenProjectSection
            key={p.id}
            id={p.id}
            name={p.name}
            path={p.path}
            sessions={sessionsByProject.get(p.id) || []}
          />
        ))}
      </div>
    </div>
  );
}
