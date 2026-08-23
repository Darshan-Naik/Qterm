import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { WithTooltip } from "@/components/ui/tooltip";

export function SidebarFooterButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <WithTooltip label={label} side="top">
      <Button
        size="icon"
        variant="ghost"
        className="size-7 shrink-0 text-muted-foreground"
        aria-label={label}
        onClick={onClick}
      >
        {children}
      </Button>
    </WithTooltip>
  );
}
