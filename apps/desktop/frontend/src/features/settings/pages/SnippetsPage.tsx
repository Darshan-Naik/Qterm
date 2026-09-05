import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { shortcutLabelFor } from "@/lib/shortcuts";
import { MAX_SNIPPETS } from "@/lib/snippets";
import { addSnippet, removeSnippet, updateSnippet, useUI } from "@/store/ui";
import { SnippetCard } from "./SnippetCard";

export function SnippetsPage() {
  const snippets = useUI((s) => s.snippets);
  const keybindings = useUI((s) => s.keybindings);
  const paletteLabel = shortcutLabelFor("snippetPalette", keybindings);
  const atCap = snippets.length >= MAX_SNIPPETS;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[18px] font-medium tracking-tight">Snippets</h1>
          <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
            Save commands you type often. Insert them from the snippet palette ({paletteLabel}) or a
            per-snippet shortcut.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className="mt-1 shrink-0"
          disabled={atCap}
          onClick={() => void addSnippet()}
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>

      {snippets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/70 px-5 py-10 text-center">
          <p className="text-[13px] text-muted-foreground">No snippets yet.</p>
          <Button type="button" variant="secondary" className="mt-4" onClick={() => void addSnippet()}>
            Create a snippet
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {snippets.map((snippet) => (
            <SnippetCard
              key={snippet.id}
              snippet={snippet}
              onChange={(patch) => void updateSnippet(snippet.id, patch)}
              onRemove={() => void removeSnippet(snippet.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
