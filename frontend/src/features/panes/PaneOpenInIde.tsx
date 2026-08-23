import { Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WithTooltip } from "@/components/ui/tooltip";
import { openPathInIDE } from "@/lib/menuActions";
import { ProjectShortcuts } from "@/lib/menuShortcuts";
import { cn } from "@/lib/utils";
import { chromeReveal } from "./chromeReveal";

export function PaneOpenInIde({ path, always = false }: { path: string; always?: boolean }) {
  if (!path) return null;
  const shortcut = ProjectShortcuts.openInIDE.label;

  return (
    <WithTooltip label={`Open in IDE (${shortcut})`}>
      <Button
        size="icon"
        variant="ghost"
        className={cn(
          "size-6 shrink-0 text-muted-foreground titlebar-no-drag transition-[opacity,background-color,color] hover:bg-accent hover:text-foreground",
          chromeReveal(always),
        )}
        onClick={() => void openPathInIDE(path)}
      >
        <Code2 className="size-3.5" />
      </Button>
    </WithTooltip>
  );
}
