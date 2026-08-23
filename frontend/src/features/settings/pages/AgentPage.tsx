import { useCallback, useEffect, useMemo, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { InstallAgentCLI, ListAgentCLIs, UninstallAgentCLI } from "../../../../wailsjs/go/main/App";
import { connectSuccessToast } from "@/lib/agentConnect";
import { invalidateAgentCLIs } from "@/queries";
import { PageTitle } from "../ui/PageTitle";
import { SectionLabel } from "../ui/SectionLabel";
import { SettingCard } from "../ui/SettingCard";
import { AgentToolsPanel } from "../ui/AgentToolsPanel";

type CLIInfo = {
  id: string;
  name: string;
  available: boolean;
  path: string;
  installed: boolean;
  version?: string;
  expectedVersion?: string;
  outdated?: boolean;
};

function statusFor(cli: CLIInfo): {
  label: string;
  tone: "ok" | "warn" | "muted";
  hint?: string;
} | null {
  if (cli.installed && cli.outdated) {
    return {
      label: "Update available",
      tone: "warn",
      hint: cli.expectedVersion
        ? `Installed ${cli.version || "unknown"} · app wants ${cli.expectedVersion}`
        : undefined,
    };
  }
  if (cli.installed) {
    return { label: "Connected", tone: "ok" };
  }
  if (cli.available) {
    return null;
  }
  return {
    label: "CLI not found",
    tone: "muted",
    hint: "Install this agent CLI on your Mac, then connect here.",
  };
}

function sameList(a: CLIInfo[], b: CLIInfo[]) {
  return (
    a.length === b.length &&
    a.every(
      (p, i) =>
        p.id === b[i].id &&
        p.available === b[i].available &&
        p.installed === b[i].installed &&
        p.outdated === b[i].outdated &&
        p.version === b[i].version &&
        p.expectedVersion === b[i].expectedVersion,
    )
  );
}

export function AgentPage() {
  const [clis, setClis] = useState<CLIInfo[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [toolsOpen, setToolsOpen] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = ((await ListAgentCLIs()) as CLIInfo[]) || [];
      setClis((prev) => (sameList(prev, list) ? prev : list));
      setToolsOpen((open) => {
        if (!open) return open;
        return list.some((c) => c.id === open && c.installed) ? open : null;
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();

    const onFocus = () => void refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const poll = window.setInterval(() => void refresh(), 4000);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(poll);
    };
  }, [refresh]);

  const connect = async (id: string) => {
    setBusy(id);
    try {
      await InstallAgentCLI(id);
      invalidateAgentCLIs();
      await refresh();
      const name = clis.find((c) => c.id === id)?.name || id;
      const msg = connectSuccessToast(name);
      toast.success(msg.title, { description: msg.description, duration: 10000 });
    } catch (e: any) {
      toast.error(String(e?.message || e || "Connect failed"));
    } finally {
      setBusy(null);
    }
  };

  const update = async (id: string) => {
    setBusy(id);
    try {
      await InstallAgentCLI(id);
      invalidateAgentCLIs();
      toast.success("Plugin updated");
      await refresh();
    } catch (e: any) {
      toast.error(String(e?.message || e || "Update failed"));
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async (id: string) => {
    setBusy(id);
    try {
      await UninstallAgentCLI(id);
      invalidateAgentCLIs();
      if (toolsOpen === id) setToolsOpen(null);
      await refresh();
    } catch (e: any) {
      toast.error(String(e?.message || e || "Disconnect failed"));
    } finally {
      setBusy(null);
    }
  };

  const toolsCLI = useMemo(
    () => (toolsOpen ? clis.find((c) => c.id === toolsOpen) : undefined),
    [clis, toolsOpen],
  );

  return (
    <div>
      <PageTitle>Agent</PageTitle>

      <p className="mb-6 max-w-xl text-[12.5px] leading-relaxed text-muted-foreground">
        Connect your agent CLI to see live status in Qterm, get notified when it needs input, and
        drive terminals, projects, and theme from the agent.
      </p>

      <SectionLabel>CLI</SectionLabel>
      <SettingCard>
        {loading && clis.length === 0 ? (
          <div className="px-4 py-5 text-[12.5px] text-muted-foreground">Loading…</div>
        ) : null}

        {clis.map((cli) => {
          const status = statusFor(cli);
          const working = busy === cli.id;

          return (
            <div key={cli.id} className="border-b border-border/40 last:border-b-0">
              <div className="flex items-center gap-4 px-4 py-3.5">
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <div className="truncate text-[13px] font-medium leading-snug">{cli.name}</div>
                    {status ? (
                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium tracking-wide",
                          status.tone === "ok" && "bg-emerald-500/12 text-emerald-400",
                          status.tone === "warn" && "bg-amber-500/12 text-amber-400",
                          status.tone === "muted" && "bg-secondary text-muted-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "size-1.5 rounded-full",
                            status.tone === "ok" && "bg-emerald-400",
                            status.tone === "warn" && "bg-amber-400",
                            status.tone === "muted" && "bg-muted-foreground/50",
                          )}
                        />
                        {status.label}
                      </span>
                    ) : null}
                  </div>
                  {status?.hint ? (
                    <div className="mt-1 text-[11px] text-muted-foreground">{status.hint}</div>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {cli.installed ? (
                    <>
                      {cli.outdated ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 min-w-[5.5rem] rounded-lg text-[12.5px]"
                          disabled={working}
                          onClick={() => void update(cli.id)}
                        >
                          {working ? "Updating…" : "Update"}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2.5 text-[12.5px] text-muted-foreground"
                          disabled={working}
                          onClick={() => setToolsOpen(cli.id)}
                        >
                          Tools
                        </Button>
                      )}
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8 text-muted-foreground"
                            disabled={working}
                            aria-label={`${cli.name} actions`}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="min-w-[9.5rem]">
                          {cli.outdated ? (
                            <DropdownMenuItem
                              disabled={working}
                              onSelect={() => setToolsOpen(cli.id)}
                            >
                              Tools
                            </DropdownMenuItem>
                          ) : null}
                          {cli.outdated ? <DropdownMenuSeparator /> : null}
                          <DropdownMenuItem
                            disabled={working}
                            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                            onSelect={() => void disconnect(cli.id)}
                          >
                            Disconnect
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 min-w-[5.5rem] rounded-lg text-[12.5px]"
                      disabled={!cli.available || working}
                      title={!cli.available ? "Install the agent CLI first" : "Connect this CLI to Qterm"}
                      onClick={() => void connect(cli.id)}
                    >
                      {working ? "Connecting…" : "Connect"}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {!loading && clis.length === 0 ? (
          <div className="px-4 py-5 text-[12.5px] text-muted-foreground">
            No agent CLIs registered.
          </div>
        ) : null}
      </SettingCard>

      {toolsCLI ? (
        <AgentToolsPanel
          cliID={toolsCLI.id}
          cliName={toolsCLI.name}
          open={!!toolsOpen}
          onOpenChange={(next) => setToolsOpen(next ? toolsCLI.id : null)}
        />
      ) : null}
    </div>
  );
}
