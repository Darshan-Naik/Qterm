import { useEffect } from "react";
import { applyTheme, useUI } from "@/store/ui";
import { hydrateWorkspace } from "./hydrateWorkspace";
import { splitFocused } from "./splitActions";
import { subscribeAppEvents } from "./subscribeAppEvents";
import { subscribeFileDrop } from "./subscribeFileDrop";

/** App shell bootstrap: hydrate store, subscribe to backend events, keep theme in sync. */
export function useAppBootstrap() {
  const theme = useUI((s) => s.theme);

  useEffect(() => {
    const onSplit = (e: Event) => {
      const dir = (e as CustomEvent).detail as "horizontal" | "vertical";
      void splitFocused(dir);
    };
    window.addEventListener("qterm:split", onSplit);
    return () => window.removeEventListener("qterm:split", onSplit);
  }, []);

  useEffect(() => {
    void hydrateWorkspace();
    const offEvents = subscribeAppEvents();
    const offDrop = subscribeFileDrop();
    return () => {
      offEvents();
      offDrop();
    };
  }, []);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
}
