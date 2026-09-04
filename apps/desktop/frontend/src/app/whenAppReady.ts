import { Ready } from "../../wailsjs/go/main/App";
import { EventsOn } from "../../wailsjs/runtime/runtime";

const POLL_MS = 16;

async function isAppReady(): Promise<boolean> {
  try {
    return Boolean(await Ready());
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function waitForReadyEvent(): Promise<void> {
  return new Promise((resolve) => {
    const off = (EventsOn as any)("app:ready", () => {
      if (typeof off === "function") off();
      resolve();
    }) as (() => void) | undefined;
  });
}

async function pollUntilReady(): Promise<void> {
  while (!(await isAppReady())) {
    await sleep(POLL_MS);
  }
}

/**
 * Wait until Go OnStartup finished (`Ready()`).
 * Prefers `app:ready` from OnDomReady; polls as fallback for wails-dev HMR
 * (event can fire before the listener is registered).
 */
export async function whenAppReady(): Promise<void> {
  if (await isAppReady()) return;

  await Promise.race([waitForReadyEvent(), pollUntilReady()]);
}
