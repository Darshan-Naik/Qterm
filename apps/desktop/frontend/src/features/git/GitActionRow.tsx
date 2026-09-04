import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WithTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function GitActionRow({
  ahead,
  behind,
  canPush,
  busy,
  onPull,
  onPush,
}: {
  ahead: number;
  behind: number;
  canPush: boolean;
  busy: string | null;
  onPull: () => void;
  onPush: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center">
      <GitIconButton
        label={behind > 0 ? `Pull ${behind}` : "Pull"}
        count={behind}
        busy={busy === "pull"}
        disabled={!!busy}
        emphasized={behind > 0}
        onClick={onPull}
      >
        <ArrowDown className="size-3.5" />
      </GitIconButton>
      <GitIconButton
        label={ahead > 0 ? `Push ${ahead}` : "Push"}
        count={ahead}
        busy={busy === "push"}
        disabled={!!busy || !canPush}
        emphasized={ahead > 0 && behind === 0}
        onClick={onPush}
      >
        <ArrowUp className="size-3.5" />
      </GitIconButton>
    </div>
  );
}

function GitIconButton({
  label,
  count,
  busy,
  disabled,
  emphasized,
  onClick,
  children,
}: {
  label: string;
  count: number;
  busy: boolean;
  disabled: boolean;
  emphasized: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <WithTooltip label={label}>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        disabled={disabled}
        onClick={onClick}
        aria-label={label}
        className={cn(
          "relative size-7 text-muted-foreground [&_svg]:size-3.5",
          emphasized && "text-foreground",
          busy && "opacity-100"
        )}
      >
        {busy ? <Loader2 className="size-3.5 animate-spin" /> : children}
        {!busy && count > 0 ? (
          <span className="absolute right-0.5 top-0.5 text-[9px] tabular-nums leading-none">
            {count}
          </span>
        ) : null}
      </Button>
    </WithTooltip>
  );
}
