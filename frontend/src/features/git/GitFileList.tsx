import type { ReactNode } from "react";
import { Loader2, Minus, Plus, Undo2 } from "lucide-react";
import { confirm } from "@/lib/confirm";
import { cn } from "@/lib/utils";
import { fileParts, statusLetter, statusTone, type GitFile } from "./types";

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

  if (files.length === 0) return null;

  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
      {split ? (
        <>
          <FileGroup
            label="Changes"
            files={unstaged}
            busy={busy}
            action="stage"
            actionLabel="Stage all"
            onAction={onStageAll}
            actionBusy={busy === "stage-all"}
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
          label={unstaged.length > 0 ? "Changes" : "Staged"}
          files={files}
          busy={busy}
          action={unstaged.length > 0 ? "stage" : "unstage"}
          actionLabel={unstaged.length > 0 ? "Stage all" : undefined}
          onAction={unstaged.length > 0 ? onStageAll : undefined}
          actionBusy={busy === "stage-all"}
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
  actionLabel,
  onAction,
  actionBusy,
  onToggle,
  onDiscard,
}: {
  label: string;
  files: GitFile[];
  busy: string | null;
  action: "stage" | "unstage";
  actionLabel?: string;
  onAction?: () => void;
  actionBusy?: boolean;
  onToggle: (file: GitFile) => void;
  onDiscard: (file: GitFile) => void;
}) {
  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-popover px-3 py-2">
        <span className="text-[11px] text-muted-foreground">
          {label}
          <span className="tabular-nums"> {files.length}</span>
        </span>
        {onAction && actionLabel ? (
          <button
            type="button"
            disabled={!!busy}
            className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
            onClick={onAction}
          >
            {actionBusy ? <Loader2 className="inline size-3 animate-spin" /> : actionLabel}
          </button>
        ) : null}
      </div>
      {files.map((file) => {
        const spinning = busy === `file:${file.path}` || busy === `discard:${file.path}`;
        const letter = statusLetter(file.code);
        const { dir, name } = fileParts(file.path);
        const toggle = () => {
          if (action === "stage") onToggle({ ...file, unstaged: true, staged: false });
          else onToggle({ ...file, unstaged: false, staged: true });
        };
        return (
          <div
            key={`${label}:${file.path}`}
            className="group/file relative flex min-w-0 items-center gap-2 px-3 py-2 hover:bg-accent/60"
          >
            <span
              className={cn(
                "w-4 shrink-0 text-center font-mono text-[11px] font-medium",
                statusTone(letter)
              )}
            >
              {letter}
            </span>
            <span className="min-w-0 flex-1 truncate text-[12px] leading-tight">
              <span className="text-foreground">{name}</span>
              {dir ? <span className="text-muted-foreground"> {dir}</span> : null}
            </span>
            <div
              className={cn(
                "absolute inset-y-0 right-1 flex items-center bg-gradient-to-l from-popover from-60% to-transparent pl-5 group-hover/file:from-accent",
                spinning
                  ? "opacity-100"
                  : "pointer-events-none opacity-0 group-hover/file:pointer-events-auto group-hover/file:opacity-100"
              )}
            >
              {spinning ? (
                <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <IconButton
                    label={action === "stage" ? "Stage" : "Unstage"}
                    disabled={!!busy}
                    onClick={toggle}
                  >
                    {action === "stage" ? <Plus className="size-3.5" /> : <Minus className="size-3.5" />}
                  </IconButton>
                  <IconButton
                    label="Discard"
                    disabled={!!busy}
                    danger
                    onClick={() => void onDiscard(file)}
                  >
                    <Undo2 className="size-3.5" />
                  </IconButton>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function IconButton({
  label,
  disabled,
  danger,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  danger?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      title={label}
      className={cn(
        "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground",
        "hover:bg-accent hover:text-foreground",
        danger && "hover:text-destructive",
        "disabled:opacity-40"
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
