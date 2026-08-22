import { Loader2 } from "lucide-react";
import { confirm } from "@/lib/confirm";
import { cn } from "@/lib/utils";
import { statusLetter, type GitFile } from "./types";

export function GitFileList({
  files,
  busy,
  onToggle,
  onStageAll,
  onDiscard,
}: {
  files: GitFile[];
  busy: string | null;
  onToggle: (file: GitFile) => void;
  onStageAll: () => void;
  onDiscard: (file: GitFile) => void;
}) {
  const staged = files.filter((f) => f.staged);
  const unstaged = files.filter((f) => f.unstaged);
  const split = staged.length > 0 && unstaged.length > 0;

  const discard = async (file: GitFile) => {
    const ok = await confirm({
      title: "Discard changes?",
      description: `${file.path} will be restored. This cannot be undone.`,
      confirmLabel: "Discard",
      destructive: true,
    });
    if (ok) onDiscard(file);
  };

  if (files.length === 0) {
    return (
      <p className="px-3 py-3 text-[12px] text-muted-foreground">No local changes.</p>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex items-center justify-between gap-2 px-3 pb-1 pt-1">
        <span className="text-[11px] text-muted-foreground">
          Changes {files.length}
        </span>
        {unstaged.length > 0 ? (
          <button
            type="button"
            disabled={!!busy}
            className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
            onClick={onStageAll}
          >
            {busy === "stage-all" ? (
              <Loader2 className="inline size-3 animate-spin" />
            ) : (
              "Stage all"
            )}
          </button>
        ) : null}
      </div>
      {split ? (
        <>
          <FileGroup
            label="Unstaged"
            files={unstaged}
            busy={busy}
            action="stage"
            onToggle={onToggle}
            onDiscard={discard}
          />
          <FileGroup
            label="Staged"
            files={staged}
            busy={busy}
            action="unstage"
            onToggle={onToggle}
            onDiscard={discard}
          />
        </>
      ) : (
        <FileGroup
          files={files}
          busy={busy}
          onToggle={onToggle}
          onDiscard={discard}
        />
      )}
    </div>
  );
}

function FileGroup({
  label,
  files,
  busy,
  action,
  onToggle,
  onDiscard,
}: {
  label?: string;
  files: GitFile[];
  busy: string | null;
  action?: "stage" | "unstage";
  onToggle: (file: GitFile) => void;
  onDiscard: (file: GitFile) => void;
}) {
  return (
    <div>
      {label ? (
        <div className="px-3 pb-0.5 pt-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
      ) : null}
      {files.map((file) => {
        const id = `${label || ""}:${file.path}`;
        const spinning = busy === `file:${file.path}` || busy === `discard:${file.path}`;
        const handle = () => {
          if (action === "stage") onToggle({ ...file, unstaged: true, staged: false });
          else if (action === "unstage") onToggle({ ...file, unstaged: false, staged: true });
          else onToggle(file);
        };
        return (
          <div
            key={id}
            className="group/file flex min-w-0 items-center gap-1.5 px-2.5 py-0.5 hover:bg-accent/60"
          >
            <button
              type="button"
              disabled={!!busy}
              className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 rounded-sm py-0.5 text-left disabled:opacity-50"
              onClick={handle}
            >
              <span className="w-3.5 shrink-0 text-center font-mono text-[10px] text-muted-foreground">
                {spinning ? (
                  <Loader2 className="inline size-3 animate-spin" />
                ) : (
                  statusLetter(file.code)
                )}
              </span>
              <span className="min-w-0 truncate text-[12px]" title={file.path}>
                {file.path}
              </span>
            </button>
            <button
              type="button"
              disabled={!!busy}
              className={cn(
                "shrink-0 cursor-pointer px-1.5 text-[10px] text-muted-foreground opacity-0 hover:text-destructive group-hover/file:opacity-100",
                "disabled:opacity-0"
              )}
              onClick={() => void onDiscard(file)}
            >
              Discard
            </button>
          </div>
        );
      })}
    </div>
  );
}
