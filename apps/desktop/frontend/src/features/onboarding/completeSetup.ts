import { CompleteSetup } from "../../../wailsjs/go/main/App";
import { uiStore } from "@/store/ui";

/** Persist first-run completion and enter the workspace. */
export async function completeSetup() {
  try {
    await CompleteSetup();
  } catch {
    // Still leave setup so a save failure cannot trap the user.
  }
  uiStore.set({ appMode: "workspace" });
}
