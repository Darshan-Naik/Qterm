import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { insertSnippet } from "@/lib/snippets";
import { formatChords } from "@/lib/shortcuts";
import { openSettings, uiStore, useUI } from "@/store/ui";

export function SnippetPalette() {
  const open = useUI((s) => s.snippetsOpen);
  const snippets = useUI((s) => s.snippets);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) =>
        uiStore.set({ snippetsOpen: v, paletteOpen: v ? false : uiStore.get().paletteOpen })
      }
    >
      <DialogContent
        position="top"
        showClose={false}
        className="flex max-w-2xl flex-col overflow-hidden rounded-lg p-0 shadow-xl"
        aria-describedby={undefined}
      >
        <Command className="flex min-h-0 max-h-full flex-col overflow-hidden bg-popover" label="Snippets">
          <Command.Input
            value={q}
            onValueChange={setQ}
            placeholder="Insert a snippet…"
            className="h-11 w-full shrink-0 bg-transparent px-4 text-[13px] outline-none placeholder:text-muted-foreground"
          />
          <div className="mx-3 h-px shrink-0 bg-secondary" />
          <Command.List className="min-h-0 flex-1 overflow-auto p-2">
            <Command.Empty className="px-2 py-4 text-[13px] text-muted-foreground">
              {snippets.length === 0 ? "No snippets yet. Add one in Settings." : "No matching snippets."}
            </Command.Empty>
            {snippets.map((snippet) => {
              const preview = snippet.body.trim().split("\n")[0] || "Empty";
              const search = [snippet.name, snippet.keyword, snippet.body].filter(Boolean).join(" ");
              return (
                <Command.Item
                  key={snippet.id}
                  value={search}
                  onSelect={() => {
                    uiStore.set({ snippetsOpen: false });
                    void insertSnippet(snippet);
                  }}
                  className="cursor-pointer rounded-md px-2.5 py-2 text-[13px] aria-selected:bg-accent"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate font-medium">{snippet.name}</span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {snippet.keyword ? snippet.keyword : snippet.chord ? formatChords([snippet.chord]) : ""}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[12px] text-muted-foreground">{preview}</div>
                </Command.Item>
              );
            })}
            <Command.Item
              value="manage snippets settings"
              onSelect={() => {
                uiStore.set({ snippetsOpen: false });
                openSettings("snippets");
              }}
              className="cursor-pointer rounded-md px-2.5 py-2 text-[13px] text-muted-foreground aria-selected:bg-accent aria-selected:text-foreground"
            >
              Manage snippets…
            </Command.Item>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
