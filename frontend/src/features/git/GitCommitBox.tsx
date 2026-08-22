import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function GitCommitBox({
  message,
  onMessage,
  canCommit,
  busy,
  onCommit,
  onCommitPush,
}: {
  message: string;
  onMessage: (next: string) => void;
  canCommit: boolean;
  busy: string | null;
  onCommit: () => void;
  onCommitPush: () => void;
}) {
  const empty = !message.trim();
  const blocked = empty || !!busy || !canCommit;

  return (
    <div className="shrink-0 bg-popover px-2.5 pb-2.5 pt-1.5">
      <textarea
        value={message}
        onChange={(e) => onMessage(e.target.value)}
        placeholder={canCommit ? "Commit message" : "Stage files to commit"}
        rows={2}
        disabled={!!busy}
        className="w-full resize-none rounded-md bg-secondary/70 px-2.5 py-1.5 text-[12px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-70"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            if (!blocked) onCommit();
          }
        }}
      />
      <div className="mt-1.5 flex items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          className="h-7 min-w-0 flex-1 text-[12px]"
          disabled={blocked}
          onClick={onCommit}
        >
          {busy === "commit" ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Commit
          <span className="text-[10px] font-normal tracking-wide text-primary-foreground/70">
            ⌘↵
          </span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 shrink-0 px-2.5 text-[12px]"
          disabled={blocked}
          onClick={onCommitPush}
        >
          {busy === "commit-push" ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Commit & push
        </Button>
      </div>
    </div>
  );
}
