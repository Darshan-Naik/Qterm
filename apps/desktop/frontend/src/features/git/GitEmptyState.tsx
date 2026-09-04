import { Check, Loader2 } from "lucide-react";

export function GitEmptyState({
  loading,
  ahead,
  behind,
}: {
  loading: boolean;
  ahead: number;
  behind: number;
}) {
  const sync =
    ahead > 0 && behind > 0
      ? `${behind} to pull · ${ahead} to push`
      : ahead > 0
        ? `${ahead} to push`
        : behind > 0
          ? `${behind} to pull`
          : "Up to date";

  return (
    <div className="flex min-h-[9.5rem] flex-1 flex-col items-center justify-center gap-1 px-4 py-6 text-center">
      {loading ? (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      ) : (
        <>
          <Check className="mb-1 size-4 text-muted-foreground/80" />
          <p className="text-[13px] text-foreground">No local changes</p>
          <p className="text-[12px] text-muted-foreground">{sync}</p>
        </>
      )}
    </div>
  );
}
