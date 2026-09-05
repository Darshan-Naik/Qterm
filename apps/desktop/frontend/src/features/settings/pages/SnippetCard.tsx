import { Pencil, Trash2 } from "lucide-react";
import { snippetCardPreview, snippetCardTitle, type Snippet } from "@/lib/snippets";
import { ShortcutKeys } from "../ui/ShortcutKeys";

export function SnippetCard({
  snippet,
  onEdit,
  onDelete,
}: {
  snippet: Snippet;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const title = snippetCardTitle(snippet);
  const preview = snippetCardPreview(snippet);
  const keyword = snippet.keyword?.trim();
  const chords = snippet.chord ? [snippet.chord] : [];

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 px-3.5 py-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium">{title}</div>
          {preview ? (
            <p className="mt-1 truncate font-mono text-[12px] text-muted-foreground">{preview}</p>
          ) : null}
          {keyword || chords.length > 0 || snippet.send !== true ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {keyword ? (
                <span className="rounded-md bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-foreground/90">
                  {keyword}
                </span>
              ) : null}
              {chords.length > 0 ? <ShortcutKeys chords={chords} /> : null}
              {snippet.send !== true ? (
                <span className="text-[11px] text-muted-foreground">Inserts only</span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            title="Edit snippet"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
            onClick={onEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            title="Delete snippet"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
