import { Ready } from "../../wailsjs/go/main/App";

/**
 * Wait until Go OnStartup finished (a.ready).
 *
 * Don't rely only on EventsEmit("app:ready"): in wails dev, DomReady can fire
 * once and HMR remounts later — the event is already gone. Poll Ready() instead.
 */
export async function whenAppReady(): Promise<void> {
  for (;;) {
    try {
      if (await Ready()) return;
    } catch {
      /* bindings not up yet */
    }
    await new Promise((r) => setTimeout(r, 16));
  }
}
