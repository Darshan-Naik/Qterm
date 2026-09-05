import { useState } from "react";
import { toast } from "sonner";
import { InstallAgentCLI } from "../../../wailsjs/go/main/App";
import { invalidateAgentCLIs, useAgentCLIs } from "@/queries";
import { SettingCard } from "@/features/settings/ui/SettingCard";
import { OnboardingAgentRow } from "./OnboardingAgentRow";

export function OnboardingAgents() {
  const { data, isLoading } = useAgentCLIs();
  const clis = data ?? [];
  const [busy, setBusy] = useState<string | null>(null);

  const connect = async (id: string) => {
    setBusy(id);
    try {
      await InstallAgentCLI(id);
      invalidateAgentCLIs();
    } catch (e: unknown) {
      const err = e as { message?: string };
      toast.error(String(err?.message || e || "Connect failed"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="w-full">
      <h1 className="text-[22px] font-semibold tracking-tight">Connect an agent</h1>
      <p className="mt-1.5 mb-6 text-[13px] leading-relaxed text-muted-foreground">
        Link a CLI for live status and hooks. You can skip and connect later from Settings.
      </p>
      <SettingCard>
        {isLoading && clis.length === 0 ? (
          <div className="px-3 py-5 text-[12.5px] text-muted-foreground">Looking for agent CLIs…</div>
        ) : null}
        {clis.map((cli) => (
          <OnboardingAgentRow
            key={cli.id}
            cli={cli}
            busy={busy === cli.id}
            onConnect={(id) => void connect(id)}
          />
        ))}
        {!isLoading && clis.length === 0 ? (
          <div className="px-3 py-5 text-[12.5px] text-muted-foreground">No agent CLIs registered.</div>
        ) : null}
      </SettingCard>
    </div>
  );
}
