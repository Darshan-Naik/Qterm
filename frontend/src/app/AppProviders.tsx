import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CommandPalette } from "@/features/palette";
import { HookIntentListener } from "@/features/hooks";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider>
      {children}
      <CommandPalette />
      <HookIntentListener />
      <Toaster richColors position="bottom-right" />
    </TooltipProvider>
  );
}
