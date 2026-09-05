import { chordId, conflictLabel, findConflict, type KeyChord, type KeybindingOverrides, type ShortcutId } from "@/lib/shortcuts";
import type { Snippet } from "./types";

/** Human label if this chord is already used by an app shortcut or snippet. */
export function describeChordConflict(
  chord: KeyChord,
  opts: {
    keybindings: KeybindingOverrides;
    snippets: Snippet[];
    exceptShortcutId?: ShortcutId;
    exceptSnippetId?: string;
  },
): string | null {
  const app = findConflict(chord, opts.keybindings, opts.exceptShortcutId);
  if (app) return conflictLabel(app);
  const id = chordId(chord);
  for (const snippet of opts.snippets) {
    if (snippet.id === opts.exceptSnippetId) continue;
    if (snippet.chord && chordId(snippet.chord) === id) {
      return `Snippet: ${snippet.name || "untitled"}`;
    }
  }
  return null;
}
