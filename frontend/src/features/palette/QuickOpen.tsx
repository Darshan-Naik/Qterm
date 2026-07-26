import { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import { TerminalSquare } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { uiStore, useUI, type SessionInfo } from "@/store/ui";
import { focusSession, isUnbound } from "@/lib/sessions";
import { AgentIcon } from "@/features/sidebar/AgentIcon";
import { cn } from "@/lib/utils";
import { SearchScrollback } from "../../../wailsjs/go/main/App";

type TerminalItem = {
  id: string;
  label: string;
  projectId: string;
  projectLabel: string;
  keywords: string;
  agent: string;
  snippet?: string;
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
  const [contentHits, setContentHits] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) {
      setQ("");
      setContentHits({});
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const query = q.trim();
    if (query.length < 2) {
      setContentHits({});
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const hits = (await SearchScrollback(
            query,
            sessions.map((s) => s.id)
          )) as Array<{ sessionId?: string; snippet?: string }> | null;
          if (cancelled) return;
          const next: Record<string, string> = {};
          for (const h of hits || []) {
            if (h?.sessionId && h.snippet) next[h.sessionId] = h.snippet;
          }
          setContentHits(next);
        } catch {
          if (!cancelled) setContentHits({});
        }
      })();
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q, open, sessions]);

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
      const snippet = contentHits[s.id];
      group.terminals.push({
        id: s.id,
        label: s.name,
        projectId,
        projectLabel,
        agent: sessionAgents[s.id] || "",
        snippet,
        keywords: `${s.name} ${projectLabel} ${s.cwd} terminal ${snippet || ""}`,
      });
    }

    return [...byProject.values()].filter((g) => g.terminals.length > 0);
  }, [projects, sessions, sessionAgents, contentHits]);

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
        position="top"
        className="flex max-w-lg flex-col overflow-hidden rounded-lg p-0 shadow-xl [&>button]:hidden"
        aria-describedby={undefined}
      >
        <Command className="flex min-h-0 max-h-full flex-col overflow-hidden bg-popover" label="Quick open" shouldFilter>
          <Command.Input
            value={q}
            onValueChange={setQ}
            placeholder="Search terminals or output…"
            className="h-11 w-full shrink-0 bg-transparent px-4 text-[13px] outline-none placeholder:text-muted-foreground"
          />
          <div className="mx-3 h-px shrink-0 bg-secondary" />
          <Command.List className="min-h-0 flex-1 overflow-auto p-2">
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
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{item.label}</span>
                      {item.snippet ? (
                        <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                          {item.snippet}
                        </span>
                      ) : null}
                    </span>
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
