import { createDB } from "qortex-db";
import { uiStore, SIDEBAR_MAX, SIDEBAR_MIN } from "./store";
import type { ThemeMode } from "./types";

const db = createDB("q-term");

export async function hydrateUIPrefs() {
  const theme = await db.get<ThemeMode>("theme");
  const sidebarOpen = await db.get<boolean>("sidebarOpen");
  const sidebarWidth = await db.get<number>("sidebarWidth");
  const fontSize = await db.get<number>("fontSize");
  const activeScope = await db.get<string>("activeScope");
  const collapsedProjects = await db.get<Record<string, boolean>>("collapsedProjects");

  uiStore.set({
    ...(theme ? { theme } : {}),
    ...(typeof sidebarOpen === "boolean" ? { sidebarOpen } : {}),
    ...(typeof sidebarWidth === "number"
      ? { sidebarWidth: Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, sidebarWidth)) }
      : {}),
    ...(fontSize ? { fontSize } : {}),
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
