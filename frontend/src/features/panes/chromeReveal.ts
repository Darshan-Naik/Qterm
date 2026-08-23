/** Always-visible on the active/sole pane; hover-only on other split panes. */
export function chromeReveal(always: boolean) {
  return always
    ? "opacity-45 group-hover/chrome:opacity-100"
    : "opacity-0 group-hover/pane:opacity-45 group-hover/chrome:!opacity-100";
}
