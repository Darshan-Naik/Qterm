import { useEffect } from "react";
import { EventsOn } from "../../../wailsjs/runtime/runtime";
import { uiStore } from "@/store/ui";
import { asStatus, mergeUpdateProgress, rememberAppUpdate, runManualUpdateCheck, showInstalledUpdateToast, showPluginRefreshFromLaunch, showPluginRefreshToast } from "./checkAppUpdate";
import { applyUpdateStatus } from "./updateStatus";

type Off = (() => void) | undefined;

function on(event: string, handler: (...args: any[]) => void): Off {
  return (EventsOn as any)(event, handler) as Off;
}

/** Launch check + app menu "Check for Updates". Off the PTY path. */
export function UpdateListener() {
  useEffect(() => {
    const offAvail = on("app:update-available", (raw) => {
      const status = asStatus(raw);
      if (!status) return;
      rememberAppUpdate(applyUpdateStatus(uiStore.get().appUpdate, status));
    });
    const offProg = on("app:update-progress", (raw) => {
      mergeUpdateProgress(raw);
    });
    const offCheck = on("app:check-updates", () => {
      void runManualUpdateCheck();
    });
    const offPlugins = on("app:plugins-refreshed", (raw) => {
      showPluginRefreshToast(raw);
    });
    void showInstalledUpdateToast();
    void showPluginRefreshFromLaunch();
    return () => {
      if (typeof offAvail === "function") offAvail();
      if (typeof offProg === "function") offProg();
      if (typeof offCheck === "function") offCheck();
      if (typeof offPlugins === "function") offPlugins();
    };
  }, []);

  return null;
}
