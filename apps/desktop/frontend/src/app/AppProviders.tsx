import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AboutDialog } from "@/features/about";
import { UpdateDialog, UpdateListener } from "@/features/updates";
import { CommandPalette, QuickOpen, AgentSessions, SnippetPalette } from "@/features/palette";
import { ConnectNudgeListener, HookIntentListener } from "@/features/hooks";
import { ConfirmHost } from "@/lib/confirm";
import { ExclusiveMenuDismiss } from "@/hooks/ExclusiveMenuDismiss";
import { ThemedToaster } from "./ThemedToaster";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={500} skipDelayDuration={0}>
      {children}
      <CommandPalette />
      <QuickOpen />
      <AgentSessions />
      <SnippetPalette />
      <HookIntentListener />
      <ConnectNudgeListener />
      <AboutDialog />
      <UpdateListener />
      <UpdateDialog />
      <ConfirmHost />
      <ExclusiveMenuDismiss />
      <ThemedToaster />
    </TooltipProvider>
  );
}
