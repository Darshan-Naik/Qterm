import { DEFAULT_BINDINGS, SHORTCUT_META, metaFor } from "./defaults";
import { chordId, eventMatchesChord, formatChords } from "./chords";
import type { KeyChord, KeybindingOverrides, ShortcutId } from "./types";

/** Effective bindings = defaults with user overrides applied. */
export function resolveBindings(overrides: KeybindingOverrides = {}): Record<ShortcutId, KeyChord[]> {
  const out = { ...DEFAULT_BINDINGS };
  for (const id of Object.keys(overrides) as ShortcutId[]) {
    const chords = overrides[id];
    if (chords && chords.length > 0) out[id] = chords;
  }
  return out;
}

export function effectiveChords(id: ShortcutId, overrides: KeybindingOverrides = {}): KeyChord[] {
  const custom = overrides[id];
  if (custom && custom.length > 0) return custom;
  return DEFAULT_BINDINGS[id];
}

export function isCustomized(id: ShortcutId, overrides: KeybindingOverrides = {}): boolean {
  return Boolean(overrides[id]?.length);
}

export function shortcutLabelFor(id: ShortcutId, overrides: KeybindingOverrides = {}): string {
  return formatChords(effectiveChords(id, overrides));
}

/** Find which shortcut (if any) matches this key event. */
export function matchShortcut(
  e: KeyboardEvent,
  overrides: KeybindingOverrides = {}
): ShortcutId | null {
  const bindings = resolveBindings(overrides);
  for (const meta of SHORTCUT_META) {
    const chords = bindings[meta.id];
    if (chords.some((c) => eventMatchesChord(e, c))) return meta.id;
  }
  return null;
}

/** Whether any effective binding matches (for xterm gate). */
export function isBoundShortcut(e: KeyboardEvent, overrides: KeybindingOverrides = {}): boolean {
  return matchShortcut(e, overrides) !== null;
}

/** Another command already using this chord (excluding `exceptId`). */
export function findConflict(
  chord: KeyChord,
  overrides: KeybindingOverrides,
  exceptId?: ShortcutId
): ShortcutId | null {
  const id = chordId(chord);
  const bindings = resolveBindings(overrides);
  for (const meta of SHORTCUT_META) {
    if (meta.id === exceptId) continue;
    if (bindings[meta.id].some((c) => chordId(c) === id)) return meta.id;
  }
  return null;
}

export function conflictLabel(id: ShortcutId): string {
  return metaFor(id).label;
}
