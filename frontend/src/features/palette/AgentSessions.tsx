import { useEffect, useMemo, useState } from "react";
import { Command } from "cmdk";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { uiStore, useUI, leaf, type ProjectInfo, type SessionInfo } from "@/store/ui";
import { AgentIcon, agentLabel } from "@/features/sidebar/AgentIcon";
import { cn } from "@/lib/utils";
import {
  ActiveAgentBinds,
  AddProject,
  ListAgentCLIs,
  ListAgentSessions,
  ResumeAgentSession,
  SaveActiveScope,
  SaveLayout,
  SetFocusedSession,
} from "../../../wailsjs/go/main/App";
import { focusSession, scopeKey } from "@/lib/sessions";
import { sortProjectsByAdded } from "@/lib/sessionTitles";

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
  const [pending, setPending] = useState<AgentHit | null>(null);
  const [resuming, setResuming] = useState(false);
  /** agent conversation id → live Qterm terminal id */
  const [activeBinds, setActiveBinds] = useState<Record<string, string>>({});

  const refreshBinds = async () => {
    try {
      const binds = ((await ActiveAgentBinds()) as Record<string, string>) || {};
      setActiveBinds(binds);
    } catch {
      setActiveBinds({});
    }
  };

  useEffect(() => {
    if (!open) {
      setQ("");
      setCliFilter("");
      setHits([]);
      setPending(null);
      setResuming(false);
      setActiveBinds({});
      return;
    }
    void refreshBinds();
    void (async () => {
      try {
        const list = ((await ListAgentCLIs()) as Array<{ id: string; installed?: boolean; available?: boolean }>) || [];
        // Only connected CLIs — disconnect in settings to hide from this palette.
        setInstalledCLIs(list.filter((c) => c.installed).map((c) => c.id));
      } catch {
        setInstalledCLIs([]);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (!open || pending) return;
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const [list] = await Promise.all([
            ListAgentSessions(q.trim(), cliFilter) as Promise<AgentHit[]>,
            refreshBinds(),
          ]);
          if (!cancelled) setHits(list || []);
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
  }, [open, q, cliFilter, pending]);

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

  const close = () => {
    setPending(null);
    uiStore.set({ agentSessionsOpen: false });
  };

  const focusOpen = async (terminalId: string, cli: string) => {
    close();
    uiStore.set({
      sessionAgents: { ...uiStore.get().sessionAgents, [terminalId]: cli },
    });
    await focusSession(terminalId);
  };

  const openResumed = async (hit: AgentHit, projectId: string) => {
    setResuming(true);
    try {
      const sess = await ResumeAgentSession(hit.cli, hit.id, projectId);
      const alreadyOpen = uiStore.get().sessions.some((s) => s.id === sess.id);
      if (alreadyOpen) {
        await focusOpen(sess.id, hit.cli);
        return;
      }
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
      close();
    } catch (e) {
      console.error(e);
    } finally {
      setResuming(false);
    }
  };

  const openTerminalId = (hit: AgentHit) => {
    const id = activeBinds[hit.id];
    if (!id) return "";
    return uiStore.get().sessions.some((s) => s.id === id) ? id : "";
  };

  const selectHit = (hit: AgentHit) => {
    const openId = openTerminalId(hit);
    if (openId) {
      void focusOpen(openId, hit.cli);
      return;
    }
    const project = findProjectForCwd(hit.cwd, projects);
    if (project) {
      void openResumed(hit, project.id);
      return;
    }
    if (!hit.cwd?.trim()) {
      void openResumed(hit, "");
      return;
    }
    // Known folder on disk, but not in the sidebar yet — ask.
    setPending(hit);
  };

  const addProjectAndResume = async () => {
    if (!pending?.cwd) return;
    try {
      const p = await AddProject(pending.cwd, "");
      uiStore.set({
        projects: sortProjectsByAdded([...uiStore.get().projects, p]),
      });
      await openResumed(pending, p.id);
    } catch (e) {
      console.error(e);
    }
  };

  const projectName = (cwd?: string) => {
    if (!cwd) return "";
    const p = findProjectForCwd(cwd, projects);
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
      onOpenChange={(v) => {
        if (!v) setPending(null);
        uiStore.set({
          agentSessionsOpen: v,
          paletteOpen: v ? false : uiStore.get().paletteOpen,
          quickOpen: v ? false : uiStore.get().quickOpen,
        });
      }}
    >
      <DialogContent
        position="top"
        className="flex max-w-2xl flex-col overflow-hidden rounded-lg p-0 shadow-xl [&>button]:hidden"
        aria-describedby={undefined}
      >
        {pending ? (
          <div className="flex flex-col gap-4 p-5">
            <DialogHeader>
              <DialogTitle>Open where?</DialogTitle>
              <DialogDescription>
                This session lived in{" "}
                <span className="break-all font-medium text-foreground">{pending.cwd}</span>, which
                isn’t in your project list yet.
              </DialogDescription>
            </DialogHeader>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void addProjectAndResume();
              }}
            >
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                disabled={resuming}
                onClick={() => void openResumed(pending, "")}
              >
                Open
              </Button>
              <Button type="submit" className="flex-1" disabled={resuming} autoFocus>
                Add project and open
              </Button>
            </form>
          </div>
        ) : (
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
                  : "No connected agent sessions. Connect a CLI in Settings → Agent, or run one in a project after connecting."}
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
                    const openId = openTerminalId(item);
                    return (
                      <Command.Item
                        key={`${item.cli}:${item.id}`}
                        value={`${item.title} ${item.cwd} ${item.preview} ${item.id}`}
                        onSelect={() => selectHit(item)}
                        className={cn(
                          "my-0.5 flex cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2.5 text-[13px] text-foreground aria-selected:bg-accent",
                          openId && "bg-primary/10 aria-selected:bg-primary/15"
                        )}
                      >
                        <AgentIcon agent={item.cli} className="mt-0.5" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="min-w-0 flex-1 truncate">{item.title}</span>
                            {openId ? (
                              <span className="shrink-0 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                                Open
                              </span>
                            ) : null}
                          </span>
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
        )}
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

/** Exact path or longest project prefix that contains cwd. */
function findProjectForCwd(cwd: string | undefined, projects: ProjectInfo[]): ProjectInfo | null {
  if (!cwd?.trim()) return null;
  const norm = cwd.replace(/\/+$/, "");
  let best: ProjectInfo | null = null;
  for (const p of projects) {
    const base = (p.path || "").replace(/\/+$/, "");
    if (!base) continue;
    if (norm === base || norm.startsWith(base + "/")) {
      if (!best || base.length > best.path.replace(/\/+$/, "").length) best = p;
    }
  }
  return best;
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
