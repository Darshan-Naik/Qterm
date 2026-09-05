import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shortcutLabelFor } from "@/lib/shortcuts";
import { MAX_SNIPPETS } from "@/lib/snippets";
import { newSnippet, removeSnippet, saveSnippet, useUI } from "@/store/ui";
import type { Snippet } from "@/lib/snippets";
import { SnippetCard } from "./SnippetCard";

export function SnippetsPage() {
  const snippets = useUI((s) => s.snippets);
  const keybindings = useUI((s) => s.keybindings);
  const paletteLabel = shortcutLabelFor("snippetPalette", keybindings);
  const [draft, setDraft] = useState<Snippet | null>(null);
  const atCap = snippets.length >= MAX_SNIPPETS && !draft;

  const startDraft = () => {
    if (draft || snippets.length >= MAX_SNIPPETS) return;
    setDraft(newSnippet());
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[18px] font-medium tracking-tight">Snippets</h1>
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
            Save a command, then click Save snippet. Insert it from the snippet palette ({paletteLabel}),
            a keyboard shortcut, or by typing its keyword and pressing Return in a terminal.
          </p>
        </div>
        <Button type="button" size="sm" className="mt-1 shrink-0" disabled={atCap} onClick={startDraft}>
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      {snippets.length === 0 && !draft ? (
        <div className="rounded-xl border border-dashed border-border/70 px-5 py-10 text-center">
          <p className="text-[13px] text-muted-foreground">No snippets yet.</p>
          <Button type="button" variant="secondary" className="mt-4" onClick={startDraft}>
            Create a snippet
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {draft ? (
            <SnippetCard
              snippet={draft}
              persisted={false}
              onSave={async (next) => {
                await saveSnippet(next);
                setDraft(null);
              }}
              onRemove={() => setDraft(null)}
              onCancel={() => setDraft(null)}
            />
          ) : null}
          {snippets.map((snippet) => (
            <SnippetCard
              key={snippet.id}
              snippet={snippet}
              persisted
              onSave={(next) => saveSnippet(next)}
              onRemove={() => void removeSnippet(snippet.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
