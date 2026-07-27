import { useEffect } from "react";
import { toast } from "sonner";
import { InstallAgentCLI } from "../../../wailsjs/go/main/App";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import { uiStore } from "@/store/ui";
import { agentLabel } from "@/features/sidebar/AgentIcon";
import { connectSuccessToast, isCliNudgeSnoozed, snoozeCliNudge } from "@/lib/agentConnect";

type Nudge = {
  cli: string;
  cliName?: string;
  sessionId?: string;
};

/**
 * When a new terminal's process tree looks agentic and the CLI isn't connected,
 * nudge once with a toast (Connect / Not now). Scans are queued in Go at 10/20/50s.
 */
export function ConnectNudgeListener() {
  useEffect(() => {
    const off = (EventsOn as any)("agent:connect-nudge", (raw: Nudge) => {
      const cli = String(raw?.cli || "").trim();
      if (!cli) return;
      if (isCliNudgeSnoozed(cli)) return;

      const name = (raw.cliName || "").trim() || agentLabel(cli);
      const sessionId = String(raw.sessionId || "");
      if (sessionId) {
        const agents = { ...uiStore.get().sessionAgents };
        if (!agents[sessionId]) {
          agents[sessionId] = cli;
          uiStore.set({ sessionAgents: agents });
        }
      }

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
