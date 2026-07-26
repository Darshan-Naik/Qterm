import { chordsEqual } from "@/lib/shortcuts/chords";
import { DEFAULT_BINDINGS } from "@/lib/shortcuts/defaults";
import type { KeyChord, KeybindingOverrides, ShortcutId } from "@/lib/shortcuts/types";
import { SaveKeybindings, SaveUIPrefs } from "../../wailsjs/go/main/App";
import { uiStore, SIDEBAR_MAX, SIDEBAR_MIN } from "./store";

/** Validate + drop unknown ids / default-equal overrides (for config.json). */
export function sanitizeKeybindings(raw: unknown): KeybindingOverrides {
  if (!raw || typeof raw !== "object") return {};
  const out: KeybindingOverrides = {};
  for (const [id, chords] of Object.entries(raw as Record<string, unknown>)) {
    if (!(id in DEFAULT_BINDINGS)) continue;
    if (!Array.isArray(chords) || chords.length === 0) continue;
    const cleaned = chords.filter(
      (c): c is KeyChord =>
        Boolean(c) &&
        typeof c === "object" &&
        typeof (c as KeyChord).key === "string" &&
        (c as KeyChord).key.length > 0
    );
    if (!cleaned.length) continue;
    const def = DEFAULT_BINDINGS[id as ShortcutId];
    if (chordsEqual(cleaned, def)) continue;
    out[id as ShortcutId] = cleaned;
  }
  return out;
}

async function persistKeybindings(overrides: KeybindingOverrides) {
  await SaveKeybindings(overrides);
}

/** Whole-app UI zoom (percent). Scales chrome, spacing, and terminal together. */
export const UI_ZOOM_MIN = 80;
export const UI_ZOOM_MAX = 150;
export const UI_ZOOM_DEFAULT = 100;
export const UI_ZOOM_STEP = 10;

export function clampUiZoom(zoom: number) {
  const n = Math.round(Number(zoom) || UI_ZOOM_DEFAULT);
  const stepped = Math.round(n / UI_ZOOM_STEP) * UI_ZOOM_STEP;
  return Math.min(UI_ZOOM_MAX, Math.max(UI_ZOOM_MIN, stepped));
}

export function clampSidebarWidth(width: number) {
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, Math.round(Number(width) || SIDEBAR_MIN)));
}

export function applyUiZoom(zoom: number) {
  const next = clampUiZoom(zoom);
  const root = document.documentElement;
  if (next === UI_ZOOM_DEFAULT) {
    root.style.removeProperty("zoom");
  } else {
    root.style.zoom = `${next}%`;
  }
  // Help xterm FitAddon / layout listeners pick up the new size.
  requestAnimationFrame(() => {
    window.dispatchEvent(new Event("resize"));
  });
  return next;
}

/** Persist sidebar / zoom / collapsed projects to config.json. */
export async function persistUIPrefs() {
  const s = uiStore.get();
  await SaveUIPrefs({
    sidebarOpen: s.sidebarOpen,
    sidebarWidth: clampSidebarWidth(s.sidebarWidth),
    uiZoom: clampUiZoom(s.uiZoom),
    collapsedProjects: s.collapsedProjects,
  });
}

export async function setUiZoom(zoom: number) {
  const next = applyUiZoom(zoom);
  if (next === uiStore.get().uiZoom) {
    await persistUIPrefs();
    return next;
  }
  uiStore.set({ uiZoom: next });
  await persistUIPrefs();
  return next;
}

export async function adjustUiZoom(deltaSteps: number) {
  return setUiZoom(uiStore.get().uiZoom + deltaSteps * UI_ZOOM_STEP);
}

/** Apply chrome prefs already loaded from GetConfig(). */
export function applyConfigChrome(cfg: {
  sidebarOpen?: boolean | null;
  sidebarWidth?: number;
  uiZoom?: number;
  collapsedProjects?: Record<string, boolean> | null;
}) {
  const zoom = clampUiZoom(typeof cfg.uiZoom === "number" ? cfg.uiZoom : UI_ZOOM_DEFAULT);
  applyUiZoom(zoom);
  uiStore.set({
    sidebarOpen: cfg.sidebarOpen !== false,
    sidebarWidth: clampSidebarWidth(cfg.sidebarWidth ?? 240),
    uiZoom: zoom,
    collapsedProjects:
      cfg.collapsedProjects && typeof cfg.collapsedProjects === "object" ? cfg.collapsedProjects : {},
  });
}

export function toggleProjectCollapsed(projectId: string) {
  const cur = uiStore.get().collapsedProjects;
  uiStore.set({
    collapsedProjects: { ...cur, [projectId]: !cur[projectId] },
  });
  void persistUIPrefs();
}

export async function setKeybinding(id: ShortcutId, chords: KeyChord[]) {
  const cur = { ...uiStore.get().keybindings };
  if (!chords.length || chordsEqual(chords, DEFAULT_BINDINGS[id])) {
    delete cur[id];
  } else {
    cur[id] = chords;
  }
  uiStore.set({ keybindings: cur });
  await persistKeybindings(cur);
}

export async function resetKeybinding(id: ShortcutId) {
  const cur = { ...uiStore.get().keybindings };
  if (!(id in cur)) return;
  delete cur[id];
  uiStore.set({ keybindings: cur });
  await persistKeybindings(cur);
}

export async function resetAllKeybindings() {
  if (!Object.keys(uiStore.get().keybindings).length) return;
  uiStore.set({ keybindings: {} });
  await persistKeybindings({});
}
