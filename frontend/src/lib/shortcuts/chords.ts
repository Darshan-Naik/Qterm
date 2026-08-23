import { formatShortcutKey, shortcutLabel } from "@/lib/shortcutLabel";
import type { KeyChord } from "./types";

const MODIFIER_KEYS = new Set(["Meta", "Control", "Alt", "Shift", "Hyper", "Super"]);

/** Stable string for equality / conflict checks. */
export function chordId(c: KeyChord): string {
  const parts = [
    c.ctrlOnly ? "ctrlOnly" : c.metaOrCtrl ? "mod" : "",
    c.alt ? "alt" : "",
    c.shift ? "shift" : "",
    c.key.toLowerCase(),
  ];
  if (c.codes?.length) {
    parts.push(...[...c.codes].sort());
  }
  return parts.filter(Boolean).join("+");
}

export function chordsEqual(a: KeyChord[], b: KeyChord[]): boolean {
  if (a.length !== b.length) return false;
  const sa = a.map(chordId).sort().join("|");
  const sb = b.map(chordId).sort().join("|");
  return sa === sb;
}

function eventKey(e: KeyboardEvent): string {
  return e.key.length === 1 ? e.key.toLowerCase() : e.key;
}

export function eventMatchesChord(e: KeyboardEvent, c: KeyChord): boolean {
  if (c.ctrlOnly) {
    if (!e.ctrlKey || e.metaKey) return false;
    if (!!e.altKey !== !!c.alt) return false;
  } else if (c.metaOrCtrl) {
    if (!(e.metaKey || e.ctrlKey)) return false;
    if (!!e.altKey !== !!c.alt) return false;
  } else if (e.metaKey || e.ctrlKey || e.altKey) {
    return false;
  }

  if (!!e.shiftKey !== !!c.shift) return false;

  if (c.codes?.length && c.codes.includes(e.code)) return true;
  const key = eventKey(e);
  return key === c.key || e.key === c.key;
}

/** Codes that should be grouped when capturing (physical key variants). */
function codesForEvent(e: KeyboardEvent): string[] | undefined {
  switch (e.code) {
    case "Equal":
    case "NumpadAdd":
      return ["Equal", "NumpadAdd"];
    case "Minus":
    case "NumpadSubtract":
      return ["Minus", "NumpadSubtract"];
    case "Digit0":
    case "Numpad0":
      return ["Digit0", "Numpad0"];
    case "BracketLeft":
    case "BracketRight":
    case "Tab":
    case "Backspace":
    case "Comma":
      return [e.code];
    default:
      return undefined;
  }
}

function keyFromEvent(e: KeyboardEvent): string {
  switch (e.code) {
    case "Equal":
    case "NumpadAdd":
      return "=";
    case "Minus":
    case "NumpadSubtract":
      return "-";
    case "Digit0":
    case "Numpad0":
      return "0";
    case "BracketLeft":
      return "[";
    case "BracketRight":
      return "]";
    case "Comma":
      return ",";
    case "Tab":
      return "Tab";
    case "Backspace":
      return "Backspace";
    default:
      return eventKey(e);
  }
}

/**
 * Build a KeyChord from a keydown event.
 * Returns null for bare modifiers or chords with no modifier (not used for app shortcuts).
 */
export function chordFromEvent(e: KeyboardEvent): KeyChord | null {
  if (MODIFIER_KEYS.has(e.key)) return null;

  const hasMod = e.metaKey || e.ctrlKey || e.altKey || e.shiftKey;
  // Require at least meta/ctrl (or ctrl-only Tab family). Plain Shift+letter is not an app shortcut.
  if (!e.metaKey && !e.ctrlKey) return null;
  if (!hasMod) return null;

  const key = keyFromEvent(e);
  const codes = codesForEvent(e);

  // Ctrl+Tab (no meta) is a distinct chord family.
  const ctrlOnly = e.ctrlKey && !e.metaKey && (key === "Tab" || e.code === "Tab");

  return {
    key,
    ...(codes ? { codes } : {}),
    ...(ctrlOnly ? { ctrlOnly: true } : { metaOrCtrl: true }),
    ...(e.shiftKey ? { shift: true } : {}),
    ...(e.altKey ? { alt: true } : {}),
  };
}

function displayKey(key: string): string {
  switch (key.toLowerCase()) {
    case "backspace":
      return "backspace";
    case "tab":
      return "Tab";
    case ",":
      return ",";
    case "=":
      return "=";
    case "-":
      return "−";
    default:
      return key.length === 1 ? key.toUpperCase() : key;
  }
}

function chordTokens(c: KeyChord): string[] {
  const parts: string[] = [];
  if (c.ctrlOnly) parts.push("ctrl");
  else if (c.metaOrCtrl) parts.push("mod");
  if (c.alt) parts.push("alt");
  if (c.shift) parts.push("shift");
  parts.push(displayKey(c.key));
  return parts;
}

/** Display labels for each key in a chord, in modifier → key order. */
export function chordKeys(c: KeyChord): string[] {
  return chordTokens(c).map(formatShortcutKey);
}

export function formatChord(c: KeyChord): string {
  return shortcutLabel(...chordTokens(c));
}

export function formatChords(chords: KeyChord[]): string {
  return chords.map(formatChord).join(" · ");
}
