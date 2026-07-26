import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CommandPalette, QuickOpen } from "@/features/palette";
import { HookIntentListener } from "@/features/hooks";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={350} skipDelayDuration={200}>
      {children}
      <CommandPalette />
      <QuickOpen />
      <HookIntentListener />
      <Toaster richColors position="bottom-right" />
    </TooltipProvider>
  );
}
