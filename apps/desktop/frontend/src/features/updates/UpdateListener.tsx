import { useEffect } from "react";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import { asStatus, rememberAppUpdate, runManualUpdateCheck } from "./checkAppUpdate";

type Off = (() => void) | undefined;

function on(event: string, handler: (...args: any[]) => void): Off {
  return (EventsOn as any)(event, handler) as Off;
}

/** Launch prompt + app menu "Check for Updates". Off the PTY path. */
export function UpdateListener() {
  useEffect(() => {
    const offAvail = on("app:update-available", (raw) => {
      const status = asStatus(raw);
      if (!status) return;
      rememberAppUpdate(status);
    });
    const offCheck = on("app:check-updates", () => {
      void runManualUpdateCheck();
    });
    return () => {
      if (typeof offAvail === "function") offAvail();
      if (typeof offCheck === "function") offCheck();
    };
  }, []);

  return null;
}
