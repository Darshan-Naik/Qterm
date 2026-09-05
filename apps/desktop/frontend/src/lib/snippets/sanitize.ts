import type { KeyChord } from "@/lib/shortcuts/types";
import { MAX_SNIPPET_BODY, MAX_SNIPPET_KEYWORD, MAX_SNIPPET_NAME, MAX_SNIPPETS, type Snippet } from "./types";

function clamp(s: string, max: number): string {
  if (s.length <= max) return s;
  return [...s].slice(0, max).join("");
}

function cleanChord(raw: unknown): KeyChord | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as KeyChord;
  if (typeof c.key !== "string" || !c.key.trim()) return undefined;
  if (!c.metaOrCtrl && !c.ctrlOnly) return undefined;
  const out: KeyChord = {
    key: c.key.trim(),
    ...(c.metaOrCtrl && !c.ctrlOnly ? { metaOrCtrl: true } : {}),
    ...(c.ctrlOnly ? { ctrlOnly: true } : {}),
    ...(c.shift ? { shift: true } : {}),
    ...(c.alt ? { alt: true } : {}),
  };
  if (Array.isArray(c.codes)) {
    const codes = c.codes.filter((x): x is string => typeof x === "string" && x.length > 0).slice(0, 4);
    if (codes.length) out.codes = codes;
  }
  return out;
}

function cleanKeyword(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const next = raw.replace(/[^A-Za-z0-9_-]/g, "").slice(0, MAX_SNIPPET_KEYWORD);
  return next || undefined;
}

function chordKey(c: KeyChord): string {
  return [
    c.ctrlOnly ? "ctrlOnly" : c.metaOrCtrl ? "mod" : "",
    c.alt ? "alt" : "",
    c.shift ? "shift" : "",
    c.key.toLowerCase(),
  ]
    .filter(Boolean)
    .join("+");
}

/** Drop junk, cap the list, and keep keywords/chords unique. */
export function sanitizeSnippets(raw: unknown): Snippet[] {
  if (!Array.isArray(raw)) return [];
  const out: Snippet[] = [];
  const seenId = new Set<string>();
  const seenKw = new Set<string>();
  const seenChord = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const id = typeof rec.id === "string" ? rec.id.trim() : "";
    if (!id || seenId.has(id)) continue;
    const name = clamp(typeof rec.name === "string" ? rec.name.trim() : "", MAX_SNIPPET_NAME);
    const body = clamp(typeof rec.body === "string" ? rec.body : "", MAX_SNIPPET_BODY);
    if (!name && !body.trim()) continue;
    let keyword = cleanKeyword(rec.keyword);
    if (keyword) {
      const k = keyword.toLowerCase();
      if (seenKw.has(k)) keyword = undefined;
      else seenKw.add(k);
    }
    let chord = cleanChord(rec.chord);
    if (chord) {
      const ck = chordKey(chord);
      if (seenChord.has(ck)) chord = undefined;
      else seenChord.add(ck);
    }
    seenId.add(id);
    const snippet: Snippet = {
      id,
      name: name || "Untitled snippet",
      body,
      send: rec.send === true,
    };
    if (keyword) snippet.keyword = keyword;
    if (chord) snippet.chord = chord;
    out.push(snippet);
    if (out.length >= MAX_SNIPPETS) break;
  }
  return out;
}
