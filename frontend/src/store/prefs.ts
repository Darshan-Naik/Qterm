import { createDB } from "qortex-db";
import { uiStore, SIDEBAR_MAX, SIDEBAR_MIN } from "./store";
import type { ThemeMode } from "./types";

const db = createDB("q-term");

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

export async function hydrateUIPrefs() {
  const theme = await db.get<ThemeMode>("theme");
  const sidebarOpen = await db.get<boolean>("sidebarOpen");
  const sidebarWidth = await db.get<number>("sidebarWidth");
  const fontSize = await db.get<number>("fontSize");
  const uiZoom = await db.get<number>("uiZoom");
  const activeScope = await db.get<string>("activeScope");
  const collapsedProjects = await db.get<Record<string, boolean>>("collapsedProjects");

  const zoom = typeof uiZoom === "number" ? clampUiZoom(uiZoom) : UI_ZOOM_DEFAULT;
  applyUiZoom(zoom);

  uiStore.set({
    ...(theme ? { theme } : {}),
    ...(typeof sidebarOpen === "boolean" ? { sidebarOpen } : {}),
    ...(typeof sidebarWidth === "number"
      ? { sidebarWidth: Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, sidebarWidth)) }
      : {}),
    ...(fontSize ? { fontSize } : {}),
    uiZoom: zoom,
    ...(activeScope ? { activeScope } : {}),
    ...(collapsedProjects && typeof collapsedProjects === "object" ? { collapsedProjects } : {}),
  });
}

export async function persistUIPrefs() {
  const s = uiStore.get();
  await db.set("theme", s.theme);
  await db.set("sidebarOpen", s.sidebarOpen);
  await db.set("sidebarWidth", s.sidebarWidth);
  await db.set("fontSize", s.fontSize);
  await db.set("uiZoom", s.uiZoom);
  await db.set("activeScope", s.activeScope);
  await db.set("collapsedProjects", s.collapsedProjects);
}

export function toggleProjectCollapsed(projectId: string) {
  const cur = uiStore.get().collapsedProjects;
  uiStore.set({
    collapsedProjects: { ...cur, [projectId]: !cur[projectId] },
  });
  void persistUIPrefs();
}
