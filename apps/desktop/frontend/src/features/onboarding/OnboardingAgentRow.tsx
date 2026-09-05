import { Button } from "@/components/ui/button";
import { AgentIcon } from "@/features/sidebar/AgentIcon";
import { cn } from "@/lib/utils";

export type OnboardingCLI = {
  id: string;
  name: string;
  available: boolean;
  installed: boolean;
};

export function OnboardingAgentRow({
  cli,
  busy,
  onConnect,
}: {
  cli: OnboardingCLI;
  busy: boolean;
  onConnect: (id: string) => void;
}) {
  const connected = cli.installed;
  const missing = !cli.available && !cli.installed;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <AgentIcon agent={cli.id} className="size-5 rounded-[4px]" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <div className="truncate text-[13px] font-medium">{cli.name}</div>
          {connected ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-emerald-500/12 px-1.5 py-0.5 text-[10.5px] font-medium text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-400" />
              Connected
            </span>
          ) : missing ? (
            <span className="text-[11px] text-muted-foreground">CLI not found</span>
          ) : null}
        </div>
        {missing ? (
          <div className="mt-0.5 text-[11px] text-muted-foreground">
            Install this agent CLI on your Mac, then connect here.
          </div>
        ) : null}
      </div>
      {connected ? null : (
        <Button
          size="sm"
          variant="secondary"
          className={cn("h-8 min-w-[5.5rem] rounded-lg text-[12.5px]")}
          disabled={missing || busy}
          title={missing ? "Install the agent CLI first" : "Connect this CLI to Qterm"}
          onClick={() => onConnect(cli.id)}
        >
          {busy ? "Connecting…" : "Connect"}
        </Button>
      )}
    </div>
  );
}
