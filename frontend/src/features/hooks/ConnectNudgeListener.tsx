import { useEffect } from "react";
import { toast } from "sonner";
import { InstallAgentCLI } from "../../../wailsjs/go/main/App";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import { agentLabel } from "@/features/sidebar/AgentIcon";
import { connectSuccessToast, isCliNudgeSnoozed, snoozeCliNudge } from "@/lib/agentConnect";
import { invalidateAgentCLIs } from "@/queries";

type Nudge = {
  cli: string;
  cliName?: string;
  sessionId?: string;
};

/**
 * Unconnected agent CLI running in a new terminal → Connect toast.
 * Icons stay hook-only; this listener does not touch sessionAgents.
 */
export function ConnectNudgeListener() {
  useEffect(() => {
    const off = (EventsOn as any)("agent:connect-nudge", (raw: Nudge) => {
      const cli = String(raw?.cli || "").trim();
      if (!cli) return;
      if (isCliNudgeSnoozed(cli)) return;

      const name = (raw.cliName || "").trim() || agentLabel(cli);

      toast.message(`${name} is running`, {
        id: `connect-nudge-${cli}`,
        description: "Connect it to Qterm for live status, rename, and hooks.",
        duration: 14000,
        action: {
          label: "Connect",
          onClick: () => {
            void (async () => {
              try {
                await InstallAgentCLI(cli);
                invalidateAgentCLIs();
                const msg = connectSuccessToast(name);
                toast.success(msg.title, {
                  description: msg.description,
                  duration: 10000,
                });
              } catch (e: unknown) {
                const err = e as { message?: string };
                toast.error(String(err?.message || e || "Connect failed"));
              }
            })();
          },
        },
        cancel: {
          label: "Not now",
          onClick: () => snoozeCliNudge(cli),
        },
      });
    });

    return () => {
      if (typeof off === "function") off();
    };
  }, []);

  return null;
}
