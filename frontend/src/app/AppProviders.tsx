import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CommandPalette, QuickOpen, AgentSessions } from "@/features/palette";
import { ConnectNudgeListener, HookIntentListener } from "@/features/hooks";
import { ThemedToaster } from "./ThemedToaster";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={350} skipDelayDuration={200}>
      {children}
      <CommandPalette />
      <QuickOpen />
      <AgentSessions />
      <HookIntentListener />
      <ConnectNudgeListener />
      <ThemedToaster />
    </TooltipProvider>
  );
}
