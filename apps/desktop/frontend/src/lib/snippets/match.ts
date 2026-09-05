import { eventMatchesChord } from "@/lib/shortcuts";
import type { Snippet } from "./types";

/** First snippet whose optional hotkey matches this keydown. */
export function matchSnippetChord(e: KeyboardEvent, snippets: Snippet[]): Snippet | null {
  for (const snippet of snippets) {
    if (snippet.chord && eventMatchesChord(e, snippet.chord)) return snippet;
  }
  return null;
}
