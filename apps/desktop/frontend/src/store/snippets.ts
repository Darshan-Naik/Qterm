import { sanitizeSnippets } from "@/lib/snippets/sanitize";
import { MAX_SNIPPETS, type Snippet } from "@/lib/snippets/types";
import { SaveSnippets } from "../../wailsjs/go/main/App";
import { uiStore } from "./store";

async function persist(next: Snippet[]) {
  const cleaned = sanitizeSnippets(next);
  uiStore.set({ snippets: cleaned });
  await SaveSnippets(cleaned as Parameters<typeof SaveSnippets>[0]);
}

export async function saveSnippets(next: Snippet[]) {
  await persist(next);
}

export async function saveSnippet(snippet: Snippet) {
  const cur = uiStore.get().snippets;
  const idx = cur.findIndex((s) => s.id === snippet.id);
  const next = idx >= 0 ? cur.map((s) => (s.id === snippet.id ? snippet : s)) : [...cur, snippet];
  await persist(next);
}

export function newSnippet(): Snippet {
  const id =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `snip-${Date.now().toString(36)}`;
  return { id, name: "", body: "", send: true };
}

export async function addSnippet() {
  const cur = uiStore.get().snippets;
  if (cur.length >= MAX_SNIPPETS) return null;
  const snippet = newSnippet();
  return snippet;
}

export async function updateSnippet(id: string, patch: Partial<Omit<Snippet, "id">>) {
  const next = uiStore.get().snippets.map((s) => (s.id === id ? { ...s, ...patch, id } : s));
  await persist(next);
}

export async function removeSnippet(id: string) {
  await persist(uiStore.get().snippets.filter((s) => s.id !== id));
}
