import { Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { KeyChord } from "@/lib/shortcuts";
import type { Snippet } from "@/lib/snippets";
import { SnippetShortcutButton } from "./SnippetShortcutButton";

export function SnippetCard({
  snippet,
  onChange,
  onRemove,
}: {
  snippet: Snippet;
  onChange: (patch: Partial<Omit<Snippet, "id">>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="flex items-start gap-3">
        <Input
          aria-label="Snippet name"
          value={snippet.name}
          placeholder="Name"
          className="h-8 min-w-0 flex-1 bg-secondary/50 shadow-none"
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <button
          type="button"
          title="Delete snippet"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <textarea
        aria-label="Snippet command"
        value={snippet.body}
        placeholder="Command to insert. Use {cwd} for the terminal folder."
        spellCheck={false}
        rows={3}
        className={cn(
          "mt-3 w-full resize-y rounded-md bg-secondary/60 px-3 py-2 font-mono text-[12.5px] leading-relaxed",
          "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        )}
        onChange={(e) => onChange({ body: e.target.value })}
      />

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <span className="shrink-0 text-[12px] text-muted-foreground">Keyword</span>
          <Input
            aria-label="Snippet keyword"
            value={snippet.keyword ?? ""}
            placeholder="gs"
            className="h-8 max-w-[140px] bg-secondary/50 shadow-none"
            onChange={(e) => onChange({ keyword: e.target.value })}
          />
        </label>
        <SnippetShortcutButton
          snippetId={snippet.id}
          chord={snippet.chord}
          onChange={(chord: KeyChord | undefined) => onChange({ chord })}
        />
      </div>

      <label className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[12.5px] text-muted-foreground">Press Return after insert</span>
        <Switch checked={snippet.send === true} onCheckedChange={(send) => onChange({ send })} />
      </label>
    </div>
  );
}
