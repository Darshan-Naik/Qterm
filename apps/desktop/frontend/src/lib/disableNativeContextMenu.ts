/**
 * Block the WebKit/WKWebView default "Inspect Element" menu in specific areas,
 * while allowing Radix UI context menus to work everywhere else.
 *
 * Radix ContextMenu components call preventDefault() when they handle the event,
 * which automatically blocks the native menu. We only need to block the native
 * menu in areas that don't have a Radix context menu (like the terminal canvas).
 */
export function disableNativeContextMenu() {
  document.addEventListener(
    "contextmenu",
    (e) => {
      const target = e.target as Element | null;
      if (!target) return;

      // Block native menu only on terminal canvas and other non-interactive areas
      // that don't have their own context menu
      const isTerminalCanvas = target.closest(".xterm-screen, .xterm-viewport, canvas");
      if (isTerminalCanvas) {
        e.preventDefault();
        return;
      }

      // For all other areas, let the event propagate normally.
      // If there's a Radix ContextMenu, it will handle it and call preventDefault.
      // If not, the native menu will appear (which is acceptable for most UI areas).
    },
    false,
  );
}
