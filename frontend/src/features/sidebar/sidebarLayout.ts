/** Resize handle is `w-1` (4px). Keep shell width math in one place. */
export const SIDEBAR_RESIZE_HANDLE_PX = 4;

export function sidebarShellWidth(sidebarWidth: number) {
  return sidebarWidth + SIDEBAR_RESIZE_HANDLE_PX;
}

/** Projects label sticky bar — keep in sync with `SIDEBAR_PROJECT_STICKY_TOP`. */
export const SIDEBAR_PROJECTS_STICKY_H = "h-9";

/** Project rows stick just under the Projects label (`h-9` → `top-9`). */
export const SIDEBAR_PROJECT_STICKY_TOP = "top-9";

/** Covers sub-pixel gaps so scrolled rows don’t flash between sticky layers. */
export const SIDEBAR_STICKY_SEAL =
  "shadow-[0_-1px_0_0_var(--sidebar),0_1px_0_0_var(--sidebar)]";
