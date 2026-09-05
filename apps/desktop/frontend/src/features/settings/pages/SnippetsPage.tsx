import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirm } from "@/lib/confirm";
import { shortcutLabelFor } from "@/lib/shortcuts";
import { MAX_SNIPPETS, snippetCardTitle, type Snippet } from "@/lib/snippets";
import { newSnippet, removeSnippet, useUI } from "@/store/ui";
import { SnippetCard } from "./SnippetCard";
import { SnippetEditorDialog } from "./SnippetEditorDialog";

export function SnippetsPage() {
  const snippets = useUI((s) => s.snippets);
  const keybindings = useUI((s) => s.keybindings);
  const paletteLabel = shortcutLabelFor("snippetPalette", keybindings);
  const [editor, setEditor] = useState<{ snippet: Snippet; isNew: boolean } | null>(null);
  const atCap = snippets.length >= MAX_SNIPPETS;

  const startNew = () => {
    if (atCap) return;
    setEditor({ snippet: newSnippet(), isNew: true });
  };

  const remove = async (snippet: Snippet) => {
    const ok = await confirm({
      title: "Delete snippet?",
      description: `${snippetCardTitle(snippet)} will be removed.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;
    if (editor?.snippet.id === snippet.id) setEditor(null);
    await removeSnippet(snippet.id);
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[18px] font-medium tracking-tight">Snippets</h1>
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
            Insert from the palette ({paletteLabel}), a shortcut, or a keyword.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="mt-1 shrink-0"
          disabled={atCap}
          title={atCap ? "Snippet limit reached" : "Add snippet"}
          onClick={startNew}
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      {snippets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 px-5 py-10 text-center">
          <p className="text-[13px] text-muted-foreground">No snippets yet.</p>
          <Button type="button" variant="secondary" className="mt-4" onClick={startNew}>
            Add snippet
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {snippets.map((snippet) => (
            <SnippetCard
              key={snippet.id}
              snippet={snippet}
              onEdit={() => setEditor({ snippet, isNew: false })}
              onDelete={() => void remove(snippet)}
            />
          ))}
        </div>
      )}

      <SnippetEditorDialog
        open={editor != null}
        snippet={editor?.snippet ?? null}
        isNew={editor?.isNew ?? true}
        onOpenChange={(open) => {
          if (!open) setEditor(null);
        }}
      />
    </div>
  );
}
