/**
 * Block the WebKit/WKWebView default menu (includes Inspect Element) in all builds,
 * but allow Radix UI context menus to work.
 *
 * We use the bubble phase (not capture) so that Radix's contextmenu handlers run first.
 * If Radix handled the event (opened its menu and called preventDefault), we don't need
 * to do anything. If no handler processed it, we block the native WebKit menu.
 */
export function disableNativeContextMenu() {
  window.addEventListener(
    "contextmenu",
    (e) => {
      // If the event was already handled (e.g., by Radix ContextMenu), skip
      if (e.defaultPrevented) {
        return;
      }
      // Block the native WebKit/WKWebView context menu
      e.preventDefault();
    },
    false, // bubble phase, not capture
  );
}
