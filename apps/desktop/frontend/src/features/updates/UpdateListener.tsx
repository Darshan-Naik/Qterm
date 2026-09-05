import { useEffect, useRef } from "react";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import {
  asStatus,
  mergeUpdateProgress,
  rememberAppUpdate,
  runManualUpdateCheck,
  showUpdateReadyToast,
} from "./checkAppUpdate";
import { uiStore } from "@/store/ui";

type Off = (() => void) | undefined;

function on(event: string, handler: (...args: any[]) => void): Off {
  return (EventsOn as any)(event, handler) as Off;
}

/** Launch prompt + app menu "Check for Updates". Off the PTY path. */
export function UpdateListener() {
  const readyToast = useRef(false);

  useEffect(() => {
    const offAvail = on("app:update-available", (raw) => {
      const status = asStatus(raw);
      if (!status) return;
      rememberAppUpdate(status);
      if (status.state === "ready" && !status.skipped && !readyToast.current) {
        readyToast.current = true;
        showUpdateReadyToast(status);
      }
    });
    const offProg = on("app:update-progress", (raw) => {
      const before = uiStore.get().appUpdate?.state;
      mergeUpdateProgress(raw);
      const after = uiStore.get().appUpdate;
      if (after && !after.skipped && before !== "ready" && after.state === "ready" && !readyToast.current) {
        readyToast.current = true;
        showUpdateReadyToast(after);
      }
    });
    const offCheck = on("app:check-updates", () => {
      void runManualUpdateCheck();
    });
    return () => {
      if (typeof offAvail === "function") offAvail();
      if (typeof offProg === "function") offProg();
      if (typeof offCheck === "function") offCheck();
    };
  }, []);

  return null;
}
