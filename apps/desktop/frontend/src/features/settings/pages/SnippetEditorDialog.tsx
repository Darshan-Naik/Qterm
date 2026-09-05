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
import { Switch } from "@/components/ui/switch";
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
          <DialogDescription>
            {isNew ? "Add a command to insert later." : "Update this saved command."}
          </DialogDescription>
        </DialogHeader>

        {draft ? (
          <>
            <Input
              aria-label="Snippet name"
              value={draft.name}
              placeholder="Name"
              autoFocus
              className="mt-4"
              onChange={(e) => patch({ name: e.target.value })}
              onKeyDown={onFieldKeyDown}
            />

            <textarea
              aria-label="Snippet command"
              value={draft.body}
              placeholder="git status"
              spellCheck={false}
              rows={4}
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
            <p className="mt-1.5 text-[11.5px] text-muted-foreground">{"{cwd} becomes the terminal folder."}</p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="min-w-0">
                <span className="block text-[12px] font-medium">Keyword</span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">
                  Type it in a terminal, then Return.
                </span>
                <Input
                  aria-label="Snippet keyword"
                  value={draft.keyword ?? ""}
                  placeholder="gs"
                  className="mt-1.5 h-8 max-w-[160px]"
                  onChange={(e) => patch({ keyword: e.target.value })}
                  onKeyDown={onFieldKeyDown}
                />
              </label>
              <div className="min-w-0">
                <span className="block text-[12px] font-medium">Shortcut</span>
                <div className="mt-1.5">
                  <SnippetShortcutButton
                    snippetId={draft.id}
                    chord={draft.chord}
                    onChange={(chord: KeyChord | undefined) => patch({ chord })}
                  />
                </div>
              </div>
            </div>

            <label className="mt-4 flex items-center justify-between gap-3 rounded-lg bg-secondary/35 px-3 py-2.5">
              <span>
                <span className="block text-[12.5px] font-medium">Run the command</span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-muted-foreground">
                  Sends Return after insert.
                </span>
              </span>
              <Switch checked={draft.send === true} onCheckedChange={(send) => patch({ send })} />
            </label>

            <div className="mt-5 flex items-center justify-end gap-2">
              {!canSave ? (
                <span className="mr-auto text-[12px] text-muted-foreground">Add a command to save</span>
              ) : null}
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={!canSave || saving} onClick={() => void save()}>
                {saving ? "Saving…" : isNew ? "Add snippet" : "Save"}
              </Button>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
