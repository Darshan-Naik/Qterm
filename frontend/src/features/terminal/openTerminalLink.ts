import { OpenInFinder, OpenInIDE } from "../../../wailsjs/go/main/App";
import { BrowserOpenURL } from "../../../wailsjs/runtime/runtime";
import { resolveTerminalLink } from "./terminalLink";

/** OSC 8 + regex web-link handler. Wails webviews ignore window.open. */
export function openTerminalLink(event: MouseEvent, uri: string): void {
  event.preventDefault();
  const link = resolveTerminalLink(uri);
  if (!link) return;
  if (link.kind === "file") {
    void openFileInEditor(link.path);
    return;
  }
  BrowserOpenURL(link.href);
}

/** Prefer Settings → Default IDE; fall back to the OS default app for that file. */
async function openFileInEditor(path: string): Promise<void> {
  try {
    await OpenInIDE(path);
  } catch {
    await OpenInFinder(path);
  }
}
