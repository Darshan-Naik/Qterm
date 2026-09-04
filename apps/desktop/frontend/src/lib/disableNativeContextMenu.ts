/** Block the WebKit/WKWebView default menu (includes Inspect Element) in all builds. */
export function disableNativeContextMenu() {
  window.addEventListener(
    "contextmenu",
    (e) => {
      e.preventDefault();
    },
    true,
  );
}
