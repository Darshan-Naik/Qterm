import { useEffect, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { KeyChord } from "@/lib/shortcuts";
import { canSaveSnippet, type Snippet } from "@/lib/snippets";
import { cn } from "@/lib/utils";
import { saveSnippet, uiStore } from "@/store/ui";
import { SnippetShortcutButton } from "./SnippetShortcutButton";

export function SnippetEditorDialog({
  open,
  snippet,
  isNew,
  onOpenChange,
}: {
  open: boolean;
  snippet: Snippet | null;
  isNew: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState<Snippet | null>(snippet);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(snippet);
    setSaving(false);
  }, [snippet]);

  const patch = (next: Partial<Omit<Snippet, "id">>) => {
    setDraft((cur) => (cur ? { ...cur, ...next } : cur));
  };

  const save = async () => {
    if (!draft || !canSaveSnippet(draft) || saving) return;
    setSaving(true);
    try {
      await saveSnippet(draft);
      const saved = uiStore.get().snippets.find((s) => s.id === draft.id);
      if (saved) setDraft(saved);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const onFieldKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    void save();
  };

  const canSave = Boolean(draft && canSaveSnippet(draft));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showClose>
        <DialogHeader>
          <DialogTitle>{isNew ? "New snippet" : "Edit snippet"}</DialogTitle>
          <DialogDescription>Typed into the focused terminal.</DialogDescription>
        </DialogHeader>

        {draft ? (
          <>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-[12px] font-medium">Name</span>
              <Input
                aria-label="Snippet name"
                value={draft.name}
                placeholder="Git status"
                autoFocus
                onChange={(e) => patch({ name: e.target.value })}
                onKeyDown={onFieldKeyDown}
              />
            </label>

            <label className="mt-3 block">
              <span className="mb-1.5 block text-[12px] font-medium">Text</span>
              <textarea
                aria-label="Snippet text"
                value={draft.body}
                placeholder="git status"
                spellCheck={false}
                rows={4}
                className={cn(
                  "w-full resize-y rounded-md bg-secondary/60 px-3 py-2 font-mono text-[12.5px] leading-relaxed",
                  "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                )}
                onChange={(e) => patch({ body: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || (!e.metaKey && !e.ctrlKey) || e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  void save();
                }}
              />
            </label>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="min-w-0">
                <span className="mb-1.5 block text-[12px] font-medium">Keyword</span>
                <Input
                  aria-label="Snippet keyword"
                  value={draft.keyword ?? ""}
                  placeholder="Optional"
                  onChange={(e) => patch({ keyword: e.target.value })}
                  onKeyDown={onFieldKeyDown}
                />
              </label>
              <div className="min-w-0">
                <span className="mb-1.5 block text-[12px] font-medium">Shortcut</span>
                <SnippetShortcutButton
                  snippetId={draft.id}
                  chord={draft.chord}
                  onChange={(chord: KeyChord | undefined) => patch({ chord })}
                />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={!canSave || saving} onClick={() => void save()}>
                {saving ? "Saving…" : isNew ? "Add" : "Save"}
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
