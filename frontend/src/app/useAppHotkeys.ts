import { useEffect } from "react";
import { handleAppShortcut, isAppShortcut } from "./appShortcuts";

/**
 * Global shortcuts in capture phase so they win over xterm.js when a
 * terminal pane has focus (⌘K / ⌘P / splits / etc.).
 */
export function useAppHotkeys() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!isAppShortcut(e)) return;
      handleAppShortcut(e);
    };
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true });
  }, []);
}
