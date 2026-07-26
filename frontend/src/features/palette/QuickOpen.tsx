import { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import { TerminalSquare } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { uiStore, useUI, type SessionInfo } from "@/store/ui";
import { focusSession, isUnbound } from "@/lib/sessions";
import { AgentIcon } from "@/features/sidebar/AgentIcon";
import { cn } from "@/lib/utils";

type TerminalItem = {
  id: string;
  label: string;
  projectId: string;
  projectLabel: string;
  keywords: string;
  agent: string;
};

type ProjectGroup = {
  projectId: string;
  projectLabel: string;
  terminals: TerminalItem[];
};

export function QuickOpen() {
  const open = useUI((s) => s.quickOpen);
  const projects = useUI((s) => s.projects);
  const sessions = useUI((s) => s.sessions);
  const sessionAgents = useUI((s) => s.sessionAgents);
  const focusedSessionId = useUI((s) => s.focusedSessionId);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  const groups = useMemo(() => {
    const byProject = new Map<string, ProjectGroup>();

    const ensure = (projectId: string, projectLabel: string) => {
      let g = byProject.get(projectId);
      if (!g) {
        g = { projectId, projectLabel, terminals: [] };
        byProject.set(projectId, g);
      }
      return g;
    };

    // Preserve project order from the sidebar, then home.
    for (const p of projects) {
      ensure(p.id, p.name);
    }
    ensure("", "Home");

    for (const s of sessions as SessionInfo[]) {
      const unbound = isUnbound(s.projectId);
      const project = !unbound ? projects.find((p) => p.id === s.projectId) : undefined;
      const projectId = unbound ? "" : s.projectId;
      const projectLabel = project?.name || "Home";
      const group = ensure(projectId, projectLabel);
      group.terminals.push({
        id: s.id,
        label: s.name,
        projectId,
        projectLabel,
        agent: sessionAgents[s.id] || "",
        keywords: `${s.name} ${projectLabel} ${s.cwd} terminal`,
      });
    }

    return [...byProject.values()].filter((g) => g.terminals.length > 0);
  }, [projects, sessions, sessionAgents]);

  const close = () => uiStore.set({ quickOpen: false });

  const run = async (id: string) => {
    close();
    await focusSession(id);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => uiStore.set({ quickOpen: v, paletteOpen: v ? false : uiStore.get().paletteOpen })}
    >
      <DialogContent
        className="max-w-lg overflow-hidden rounded-lg p-0 shadow-xl [&>button]:hidden"
        aria-describedby={undefined}
      >
        <Command className="bg-popover" label="Quick open" shouldFilter>
          <Command.Input
            value={q}
            onValueChange={setQ}
            placeholder="Search terminals…"
            className="h-11 w-full bg-transparent px-4 text-[13px] outline-none placeholder:text-muted-foreground"
          />
          <div className="mx-3 h-px bg-secondary" />
          <Command.List className="max-h-80 overflow-auto p-2">
            <Command.Empty className="px-2 py-6 text-center text-[13px] text-muted-foreground">
              No terminals.
            </Command.Empty>

            {groups.map((group) => (
              <Command.Group
                key={group.projectId || "home"}
                heading={group.projectLabel}
                className={cn(
                  "relative mt-1 first:mt-0",
                  "[&_[cmdk-group-heading]]:pointer-events-none",
                  "[&_[cmdk-group-heading]]:px-2.5",
                  "[&_[cmdk-group-heading]]:pb-1",
                  "[&_[cmdk-group-heading]]:pt-2",
                  "[&_[cmdk-group-heading]]:text-[11px]",
                  "[&_[cmdk-group-heading]]:font-medium",
                  "[&_[cmdk-group-heading]]:uppercase",
                  "[&_[cmdk-group-heading]]:tracking-[0.08em]",
                  "[&_[cmdk-group-heading]]:text-muted-foreground/55"
                )}
              >
                {group.terminals.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={`${item.label} ${item.keywords}`}
                    onSelect={() => void run(item.id)}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] aria-selected:bg-accent",
                      focusedSessionId === item.id && "text-foreground"
                    )}
                  >
                    {item.agent ? (
                      <AgentIcon agent={item.agent} />
                    ) : (
                      <TerminalSquare className="size-4 shrink-0 opacity-50" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
