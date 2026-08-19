/** Resize handle is `w-1` (4px). Keep shell width math in one place. */
export const SIDEBAR_RESIZE_HANDLE_PX = 4;

export function sidebarShellWidth(sidebarWidth: number) {
  return sidebarWidth + SIDEBAR_RESIZE_HANDLE_PX;
}
