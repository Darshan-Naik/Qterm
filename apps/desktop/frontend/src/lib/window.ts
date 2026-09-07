import { WindowToggleMaximise } from "../../wailsjs/runtime/runtime";

/** Handle titlebar double-click to toggle window maximize (Mac native behavior). */
export function handleTitlebarDoubleClick(e: React.MouseEvent) {
  if ((e.target as HTMLElement).closest(".titlebar-no-drag")) return;
  WindowToggleMaximise();
}
