/**
 * Block the WebKit/WKWebView default menu (includes Inspect Element) in all builds,
 * but allow Radix UI context menus to work.
 */
export function disableNativeContextMenu() {
  window.addEventListener(
    "contextmenu",
    (e) => {
      const target = e.target as Element | null;
      if (!target) {
        e.preventDefault();
        return;
      }
      // Allow Radix context menus to work by checking for trigger elements
      const inContextMenuTrigger = target.closest("[data-radix-context-menu-trigger]");
      if (inContextMenuTrigger) {
        return;
      }
      e.preventDefault();
    },
    true,
  );
}
