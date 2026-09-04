import { useEffect } from "react";
import { uiStore } from "@/store/ui";
import { dismissExclusiveMenus } from "@/hooks/useExclusiveMenu";

/** Close exclusive dropdowns when app overlays (palette, about, …) open. */
export function ExclusiveMenuDismiss() {
  useEffect(() => {
    return uiStore.subscribe((s, prev) => {
      if (
        (s.paletteOpen && !prev.paletteOpen) ||
        (s.quickOpen && !prev.quickOpen) ||
        (s.aboutOpen && !prev.aboutOpen) ||
        (s.agentSessionsOpen && !prev.agentSessionsOpen) ||
        (s.pendingIntent && !prev.pendingIntent)
      ) {
        dismissExclusiveMenus();
      }
    });
  }, []);
  return null;
}
