import { useEffect, useState, type KeyboardEvent } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { KeyChord } from "@/lib/shortcuts";
import { canSaveSnippet, snippetsEqual, type Snippet } from "@/lib/snippets";
import { uiStore } from "@/store/ui";
import { SnippetShortcutButton } from "./SnippetShortcutButton";

export function SnippetCard({
  snippet,
  persisted,
  onSave,
  onRemove,
  onCancel,
}: {
  snippet: Snippet;
  persisted: boolean;
  onSave: (next: Snippet) => Promise<void>;
  onRemove: () => void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState(snippet);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setDraft(snippet);
    setSavedFlash(false);
  }, [snippet.id]);

  const dirty = !persisted || !snippetsEqual(draft, snippet);
  const canSave = dirty && canSaveSnippet(draft);

  const patch = (next: Partial<Omit<Snippet, "id">>) => {
    setDraft((cur) => ({ ...cur, ...next }));
    setSavedFlash(false);
  };

  const save = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await onSave(draft);
      const saved = uiStore.get().snippets.find((s) => s.id === draft.id);
      if (saved) setDraft(saved);
      setSavedFlash(true);
    } finally {
      setSaving(false);
    }
  };

  const onFieldKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void save();
  };

  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4">
      <div className="flex items-start gap-3">
        <Input
          aria-label="Snippet name"
          value={draft.name}
          placeholder="Name"
          autoFocus={!persisted}
          className="h-8 min-w-0 flex-1 bg-secondary/50 shadow-none"
          onChange={(e) => patch({ name: e.target.value })}
          onKeyDown={onFieldKeyDown}
        />
        <button
          type="button"
          title={persisted ? "Delete snippet" : "Discard snippet"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-destructive"
          onClick={() => (persisted ? onRemove() : onCancel?.())}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <textarea
        aria-label="Snippet command"
        value={draft.body}
        placeholder="Command to insert. Use {cwd} for the terminal folder."
        spellCheck={false}
        rows={3}
        className={cn(
          "mt-3 w-full resize-y rounded-md bg-secondary/60 px-3 py-2 font-mono text-[12.5px] leading-relaxed",
          "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
        )}
        onChange={(e) => patch({ body: e.target.value })}
        onKeyDown={(e) => {
          if (e.key !== "Enter" || (!e.metaKey && !e.ctrlKey) || e.nativeEvent.isComposing) return;
          e.preventDefault();
          void save();
        }}
      />

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="min-w-0">
          <span className="block text-[12px] font-medium text-foreground">Keyword</span>
          <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">
            Type this in a terminal, then press Return.
          </span>
          <Input
            aria-label="Snippet keyword"
            value={draft.keyword ?? ""}
            placeholder="gs"
            className="mt-1.5 h-8 max-w-[160px] bg-secondary/50 shadow-none"
            onChange={(e) => patch({ keyword: e.target.value })}
            onKeyDown={onFieldKeyDown}
          />
        </label>
        <div className="min-w-0">
          <span className="block text-[12px] font-medium text-foreground">Shortcut</span>
          <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">
            Click, then press ⌘ or Ctrl and a key. Return does not set a shortcut.
          </span>
          <div className="mt-1.5">
            <SnippetShortcutButton
              snippetId={draft.id}
              chord={draft.chord}
              onChange={(chord: KeyChord | undefined) => patch({ chord })}
            />
          </div>
        </div>
      </div>

      <label className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-secondary/35 px-3 py-2.5">
        <span>
          <span className="block text-[12.5px] font-medium">Run the command</span>
          <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">
            After inserting, press Return so the terminal runs it.
          </span>
        </span>
        <Switch checked={draft.send === true} onCheckedChange={(send) => patch({ send })} />
      </label>

      <div className="mt-3 flex items-center justify-end gap-2">
        {savedFlash && !dirty ? (
          <span className="text-[12px] text-muted-foreground">Saved</span>
        ) : dirty ? (
          <span className="text-[12px] text-muted-foreground">
            {canSaveSnippet(draft) ? "Unsaved" : "Add a command to save"}
          </span>
        ) : null}
        {!persisted && onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="button" size="sm" disabled={!canSave || saving} onClick={() => void save()}>
          {saving ? "Saving…" : persisted ? "Save" : "Save snippet"}
        </Button>
      </div>
    </div>
  );
}
