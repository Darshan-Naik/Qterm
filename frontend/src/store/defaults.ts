import type { SidebarFooterId } from "./types";

/**
 * App-level UI defaults. Keep numeric values in sync with `internal/config`
 * (DefaultFontSize, DefaultSidebarWidth, DefaultUiZoom, DefaultScope, …).
 */
export const DEFAULT_SCOPE = "_default";

export const SIDEBAR_MIN = 180;
export const SIDEBAR_MAX = 480;
export const SIDEBAR_DEFAULT = 240;

/** Catalog order: left cluster then right cluster. */
export const SIDEBAR_FOOTER_IDS: SidebarFooterId[] = ["palette", "agent", "theme", "settings"];

/** Current footer: agent (if a CLI is connected) + settings. */
export const SIDEBAR_FOOTER_DEFAULT: SidebarFooterId[] = ["agent", "settings"];

export const FONT_SIZE_MIN = 10;
export const FONT_SIZE_MAX = 24;
export const FONT_SIZE_DEFAULT = 12;

export const UI_ZOOM_MIN = 80;
export const UI_ZOOM_MAX = 150;
export const UI_ZOOM_DEFAULT = 100;
export const UI_ZOOM_STEP = 10;

export function clampFontSize(n: number) {
  const v = Math.round(Number(n) || FONT_SIZE_DEFAULT);
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, v));
}

export function clampUiZoom(zoom: number) {
  const n = Math.round(Number(zoom) || UI_ZOOM_DEFAULT);
  const stepped = Math.round(n / UI_ZOOM_STEP) * UI_ZOOM_STEP;
  return Math.min(UI_ZOOM_MAX, Math.max(UI_ZOOM_MIN, stepped));
}

export function clampSidebarWidth(width: number) {
  const n = Math.round(Number(width) || SIDEBAR_DEFAULT);
  return Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, n));
}

const FOOTER_IDS = new Set<string>(SIDEBAR_FOOTER_IDS);

/** Missing / invalid → defaults. Empty array is valid (hide footer). */
export function sanitizeSidebarFooter(raw: unknown): SidebarFooterId[] {
  if (!Array.isArray(raw)) return [...SIDEBAR_FOOTER_DEFAULT];
  const seen = new Set<SidebarFooterId>();
  for (const id of raw) {
    if (typeof id !== "string" || !FOOTER_IDS.has(id)) continue;
    seen.add(id as SidebarFooterId);
  }
  return SIDEBAR_FOOTER_IDS.filter((id) => seen.has(id));
}
