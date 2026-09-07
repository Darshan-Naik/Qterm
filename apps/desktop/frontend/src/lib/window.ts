import { WindowToggleMaximise } from "../../wailsjs/runtime/runtime";

/** Handle titlebar double-click to toggle window maximize (Mac native behavior). */
export function handleTitlebarDoubleClick(e: React.MouseEvent) {
  const target = e.target as HTMLElement;
  const titlebar = e.currentTarget as HTMLElement;
  // Only block if target is inside a titlebar-no-drag element WITHIN this titlebar
  // (not ancestor no-drag elements like the sidebar container)
  let el: HTMLElement | null = target;
  while (el && el !== titlebar) {
    if (el.classList.contains("titlebar-no-drag")) return;
    el = el.parentElement;
  }
  WindowToggleMaximise();
}
