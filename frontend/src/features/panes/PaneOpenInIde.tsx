import { Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WithTooltip } from "@/components/ui/tooltip";
import { openPathInIDE } from "@/lib/menuActions";
import { ProjectShortcuts } from "@/lib/menuShortcuts";

export function PaneOpenInIde({ path }: { path: string }) {
  if (!path) return null;
  const shortcut = ProjectShortcuts.openInIDE.label;

  return (
    <WithTooltip label={`Open in IDE (${shortcut})`}>
      <Button
        size="icon"
        variant="ghost"
        className="size-6 shrink-0 text-muted-foreground titlebar-no-drag opacity-0 transition-[opacity,background-color,color] group-hover/pane:opacity-45 group-hover/chrome:!opacity-100 hover:bg-accent hover:text-foreground"
        onClick={() => void openPathInIDE(path)}
      >
        <Code2 className="size-3.5" />
      </Button>
    </WithTooltip>
  );
}
