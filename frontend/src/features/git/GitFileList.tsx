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
  onUnstageAll,
  onDiscard,
  onDiscardAll,
}: {
  files: GitFile[];
  busy: string | null;
  onToggle: (file: GitFile) => void;
  onStageAll: () => void;
  onUnstageAll: () => void;
  onDiscard: (file: GitFile) => void;
  onDiscardAll: () => void;
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

  const discardAll = async () => {
    const ok = await confirm({
      title: "Discard all changes?",
      description: "Unstaged and untracked files will be restored or deleted. This cannot be undone.",
      confirmLabel: "Discard all",
      destructive: true,
    });
    if (ok) onDiscardAll();
  };

  if (files.length === 0) return null;

  const changeFiles = split ? unstaged : files;
  const changeAction = unstaged.length > 0 || split ? "stage" : "unstage";
  const changeLabel = unstaged.length > 0 || split ? "Changes" : "Staged";
  const changeActions: HeaderAction[] =
    changeAction === "stage"
      ? [
          { id: "stage-all", label: "Stage all", onClick: onStageAll },
          { id: "discard-all", label: "Discard all", danger: true, onClick: () => void discardAll() },
        ]
      : [{ id: "unstage-all", label: "Unstage all", onClick: onUnstageAll }];

  return (
    <div className="min-h-0 min-w-0 flex-auto overflow-y-auto">
      <div>
        <FileGroupHeader label={changeLabel} count={changeFiles.length} busy={busy} sticky actions={changeActions} />
        <FileRows
          label={changeLabel}
          files={changeFiles}
          busy={busy}
          action={changeAction}
          onToggle={onToggle}
          onDiscard={discard}
        />
      </div>
      {split ? (
        <div>
          <FileGroupHeader
            label="Staged"
            count={staged.length}
            busy={busy}
            sticky
            actions={[{ id: "unstage-all", label: "Unstage all", onClick: onUnstageAll }]}
          />
          <FileRows
            label="Staged"
            files={staged}
            busy={busy}
            action="unstage"
            onToggle={onToggle}
            onDiscard={discard}
          />
        </div>
      ) : null}
    </div>
  );
}

type HeaderAction = {
  id: string;
  label: string;
  danger?: boolean;
  onClick: () => void;
};

function FileGroupHeader({
  label,
  count,
  busy,
  actions = [],
  sticky = false,
}: {
  label: string;
  count: number;
  busy: string | null;
  actions?: HeaderAction[];
  sticky?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 bg-popover px-3 py-2",
        sticky && "sticky top-0 z-10"
      )}
    >
      <span className="text-[11px] text-muted-foreground">
        {label}
        <span className="tabular-nums"> {count}</span>
      </span>
      {actions.length > 0 ? (
        <div className="flex shrink-0 items-center gap-2.5">
          {actions.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={!!busy}
              className={cn(
                "cursor-pointer text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50",
                a.danger && "hover:text-destructive"
              )}
              onClick={a.onClick}
            >
              {busy === a.id ? <Loader2 className="inline size-3 animate-spin" /> : a.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FileRows({
  label,
  files,
  busy,
  action,
  onToggle,
  onDiscard,
}: {
  label: string;
  files: GitFile[];
  busy: string | null;
  action: "stage" | "unstage";
  onToggle: (file: GitFile) => void;
  onDiscard: (file: GitFile) => void;
}) {
  return (
    <>
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
    </>
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
