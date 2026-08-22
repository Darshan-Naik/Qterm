import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function GitActionRow({
  canPush,
  busy,
  onFetch,
  onPull,
  onPush,
}: {
  canPush: boolean;
  busy: string | null;
  onFetch: () => void;
  onPull: () => void;
  onPush: () => void;
}) {
  return (
    <div className="flex items-center gap-1 px-2.5 pb-2">
      <GitOpButton label="Fetch" busy={busy === "fetch"} disabled={!!busy} onClick={onFetch}>
        <RefreshCw className="size-3.5 opacity-70" />
      </GitOpButton>
      <GitOpButton label="Pull" busy={busy === "pull"} disabled={!!busy} onClick={onPull}>
        <ArrowDown className="size-3.5 opacity-70" />
      </GitOpButton>
      <GitOpButton
        label="Push"
        busy={busy === "push"}
        disabled={!!busy || !canPush}
        onClick={onPush}
      >
        <ArrowUp className="size-3.5 opacity-70" />
      </GitOpButton>
    </div>
  );
}

function GitOpButton({
  label,
  busy,
  disabled,
  onClick,
  children,
}: {
  label: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      disabled={disabled}
      onClick={onClick}
      className={cn("h-7 flex-1 gap-1.5 px-2 text-[12px]", busy && "opacity-100")}
    >
      {busy ? <Loader2 className="size-3.5 animate-spin opacity-70" /> : children}
      {label}
    </Button>
  );
}
