import { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { uiStore, useUI, leaf, type SessionInfo } from "@/store/ui";
import { AgentIcon, agentLabel } from "@/features/sidebar/AgentIcon";
import { cn } from "@/lib/utils";
import {
  ListAgentCLIs,
  ListAgentSessions,
  ResumeAgentSession,
  SaveActiveScope,
  SaveLayout,
  SetFocusedSession,
} from "../../../wailsjs/go/main/App";
import { scopeKey } from "@/lib/sessions";

type AgentHit = {
  id: string;
  cli: string;
  cliName: string;
  title: string;
  cwd?: string;
  preview?: string;
  updatedAt: number;
  match?: string;
};

type CLIGroup = {
  cli: string;
  cliName: string;
  sessions: AgentHit[];
};

export function AgentSessions() {
  const open = useUI((s) => s.agentSessionsOpen);
  const projects = useUI((s) => s.projects);
  const [q, setQ] = useState("");
  const [cliFilter, setCliFilter] = useState("");
  const [hits, setHits] = useState<AgentHit[]>([]);
  const [installedCLIs, setInstalledCLIs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setQ("");
      setCliFilter("");
      setHits([]);
      return;
    }
    void (async () => {
      try {
        const list = ((await ListAgentCLIs()) as Array<{ id: string; installed?: boolean; available?: boolean }>) || [];
        // Show every registered CLI — sessions live on disk even when PATH/plugin checks fail in the GUI app.
        setInstalledCLIs(list.map((c) => c.id));
      } catch {
        setInstalledCLIs([]);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const list = ((await ListAgentSessions(q.trim(), cliFilter)) as AgentHit[]) || [];
          if (!cancelled) setHits(list);
        } catch {
          if (!cancelled) setHits([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, q.trim() ? 120 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, q, cliFilter]);

  const groups = useMemo(() => {
    const byCLI = new Map<string, CLIGroup>();
    for (const h of hits) {
      let g = byCLI.get(h.cli);
      if (!g) {
        g = { cli: h.cli, cliName: h.cliName || agentLabel(h.cli), sessions: [] };
        byCLI.set(h.cli, g);
      }
      g.sessions.push(h);
    }
    return [...byCLI.values()];
  }, [hits]);

  const close = () => uiStore.set({ agentSessionsOpen: false });

  const run = async (hit: AgentHit) => {
    close();
    try {
      const sess = await ResumeAgentSession(hit.cli, hit.id);
      const info: SessionInfo = {
        id: sess.id,
        name: sess.name,
        projectId: sess.projectId || "",
        cwd: sess.cwd,
        pinned: sess.pinned,
      };
      const scope = scopeKey(info.projectId);
      const sessions = [...uiStore.get().sessions.filter((s) => s.id !== info.id), info];
      const n = leaf(info.id);
      uiStore.set({
        sessions,
        activeScope: scope,
        splitTree: n,
        focusedPaneId: n.id,
        focusedSessionId: info.id,
        sessionAgents: { ...uiStore.get().sessionAgents, [info.id]: hit.cli },
      });
      void SetFocusedSession(info.id);
      void SaveActiveScope(scope);
      await SaveLayout(scope, n as any);
    } catch (e) {
      console.error(e);
    }
  };

  const projectName = (cwd?: string) => {
    if (!cwd) return "";
    const p = projects.find((x) => x.path === cwd);
    if (p) return p.name;
    return cwd.split("/").filter(Boolean).slice(-2).join("/") || cwd;
  };

  const subtitleLeft = (item: AgentHit) => {
    const bits: string[] = [];
    if (item.match === "body") bits.push("in prompts");
    const project = projectName(item.cwd) || item.cwd;
    if (project) bits.push(project);
    const preview = distinctPreview(item.title, item.preview);
    if (preview) bits.push(preview);
    return bits.join(" · ");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) =>
        uiStore.set({
          agentSessionsOpen: v,
          paletteOpen: v ? false : uiStore.get().paletteOpen,
          quickOpen: v ? false : uiStore.get().quickOpen,
        })
      }
    >
      <DialogContent
        position="top"
        className="flex max-w-2xl flex-col overflow-hidden rounded-lg p-0 shadow-xl [&>button]:hidden"
        aria-describedby={undefined}
      >
        <Command
          className="flex min-h-0 max-h-full flex-col overflow-hidden bg-popover"
          label="Agent sessions"
          shouldFilter={false}
        >
          <Command.Input
            value={q}
            onValueChange={setQ}
            placeholder="Search agent sessions…"
            className="h-11 w-full shrink-0 bg-transparent px-4 text-[13px] outline-none placeholder:text-muted-foreground"
          />
          {installedCLIs.length > 0 ? (
            <div className="mx-3 flex shrink-0 flex-wrap gap-1 pb-2">
              <FilterChip active={!cliFilter} label="All" onClick={() => setCliFilter("")} />
              {installedCLIs.map((id) => (
                <FilterChip
                  key={id}
                  active={cliFilter === id}
                  label={agentLabel(id)}
                  onClick={() => setCliFilter(cliFilter === id ? "" : id)}
                />
              ))}
            </div>
          ) : null}
          <div className="mx-3 h-px shrink-0 bg-secondary" />
          <Command.List className="min-h-0 flex-1 overflow-auto p-2">
            <Command.Empty className="px-2 py-6 text-center text-[13px] text-muted-foreground">
              {loading
                ? "Searching…"
                : "No agent sessions found. Run Claude / Codex / Gemini / Cursor in a project — history is read from those CLIs on disk."}
            </Command.Empty>

            {groups.map((group) => (
              <Command.Group
                key={group.cli}
                heading={group.cliName}
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
                {group.sessions.map((item) => {
                  const left = subtitleLeft(item);
                  const age = formatSessionAge(item.updatedAt);
                  return (
                  <Command.Item
                    key={`${item.cli}:${item.id}`}
                    value={`${item.title} ${item.cwd} ${item.preview} ${item.id}`}
                    onSelect={() => void run(item)}
                    className="my-0.5 flex cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2.5 text-[13px] aria-selected:bg-accent"
                  >
                    <AgentIcon agent={item.cli} className="mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{item.title}</span>
                      {left || age ? (
                        <span className="mt-0.5 flex items-baseline gap-3 text-[11px] text-muted-foreground">
                          <span className="min-w-0 flex-1 truncate">{left}</span>
                          {age ? <span className="shrink-0 tabular-nums">{age}</span> : null}
                        </span>
                      ) : null}
                    </span>
                  </Command.Item>
                  );
                })}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md px-2 py-0.5 text-[11px] transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

/** Relative age from unix ms — keeps “how old” without stuffing dates into titles. */
function formatSessionAge(ms?: number): string {
  if (!ms || ms <= 0) return "";
  const diff = Date.now() - ms;
  if (diff < 0) return "just now";
  const sec = Math.round(diff / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 14) return `${day}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function distinctPreview(title?: string, preview?: string): string {
  const t = (title || "").trim();
  const p = (preview || "").trim();
  if (!p || !t) return p;
  if (p === t) return "";
  if (p.startsWith(t) || t.startsWith(p)) return "";
  return p;
}
