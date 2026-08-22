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
  const committing = busy === "commit" || busy === "commit-push";
  const empty = !message.trim();

  return (
    <div className="border-t border-border/60 p-2.5">
      <textarea
        value={message}
        onChange={(e) => onMessage(e.target.value)}
        placeholder="Commit message"
        rows={2}
        className="w-full resize-none rounded-md bg-secondary/60 px-2.5 py-1.5 text-[12px] outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/30"
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            if (!empty && !busy) onCommit();
          }
        }}
      />
      <div className="mt-1.5 flex items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          className="h-7 flex-1 text-[12px]"
          disabled={empty || !!busy || !canCommit}
          onClick={onCommit}
        >
          {committing && busy === "commit" ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : null}
          Commit
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-7 flex-1 text-[12px]"
          disabled={empty || !!busy || !canCommit}
          onClick={onCommitPush}
        >
          {busy === "commit-push" ? <Loader2 className="size-3.5 animate-spin" /> : null}
          Commit & push
        </Button>
      </div>
    </div>
  );
}
