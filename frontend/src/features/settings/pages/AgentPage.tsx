import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { InstallAgentCLI, ListAgentCLIs, UninstallAgentCLI } from "../../../../wailsjs/go/main/App";
import { PageTitle } from "../ui/PageTitle";
import { SectionLabel } from "../ui/SectionLabel";
import { SettingCard } from "../ui/SettingCard";

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

function statusFor(cli: CLIInfo): { label: string; tone: "ok" | "warn" | "ready" | "muted" } {
  if (cli.installed && cli.outdated) return { label: "Update available", tone: "warn" };
  if (cli.installed) return { label: "Connected", tone: "ok" };
  if (cli.available) return { label: "Ready", tone: "ready" };
  return { label: "Not installed", tone: "muted" };
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

  const refresh = useCallback(async () => {
    try {
      const list = ((await ListAgentCLIs()) as CLIInfo[]) || [];
      setClis((prev) => (sameList(prev, list) ? prev : list));
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
      await refresh();
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
      await refresh();
    } catch (e: any) {
      toast.error(String(e?.message || e || "Disconnect failed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <PageTitle>Agent</PageTitle>

      <p className="mb-6 max-w-xl text-[12.5px] leading-relaxed text-muted-foreground">
        Connect your agent CLI to see live status in Qterm, get notified when it needs input, and
        drive terminals, projects, and theme from the agent. Connected plugins update automatically
        when Qterm ships a newer bridge version.
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
            <div key={cli.id} className="flex items-center gap-4 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="truncate text-[13px] font-medium leading-snug">{cli.name}</div>
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium tracking-wide",
                      status.tone === "ok" && "bg-emerald-500/12 text-emerald-400",
                      status.tone === "warn" && "bg-amber-500/12 text-amber-400",
                      status.tone === "ready" && "bg-sky-500/12 text-sky-400",
                      status.tone === "muted" && "bg-secondary text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        status.tone === "ok" && "bg-emerald-400",
                        status.tone === "warn" && "bg-amber-400",
                        status.tone === "ready" && "bg-sky-400",
                        status.tone === "muted" && "bg-muted-foreground/50",
                      )}
                    />
                    {status.label}
                  </span>
                </div>
                {cli.installed && cli.outdated && cli.expectedVersion ? (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Installed {cli.version || "unknown"} · app wants {cli.expectedVersion}
                  </div>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
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
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 text-[12.5px] text-muted-foreground"
                      disabled={working}
                      onClick={() => void disconnect(cli.id)}
                    >
                      {working && !cli.outdated ? "…" : "Disconnect"}
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 min-w-[5.5rem] rounded-lg text-[12.5px]"
                    disabled={!cli.available || working}
                    title={!cli.available ? "CLI not installed" : undefined}
                    onClick={() => void connect(cli.id)}
                  >
                    {working ? "Connecting…" : "Connect"}
                  </Button>
                )}
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
    </div>
  );
}
