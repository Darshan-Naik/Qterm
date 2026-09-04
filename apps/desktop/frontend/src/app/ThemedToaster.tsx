import { useEffect, useState } from "react";
import { Toaster } from "sonner";
import { useUI } from "@/store/ui";
import type { ThemeMode } from "@/store/types";

function resolveSonnerTheme(theme: ThemeMode): "light" | "dark" {
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  // Match applyTheme: .dark on <html> is the source of truth for system.
  if (typeof document !== "undefined" && document.documentElement.classList.contains("dark")) {
    return "dark";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Sonner toaster that follows uiStore theme (and system `.dark`). */
export function ThemedToaster() {
  const theme = useUI((s) => s.theme);
  const [sonnerTheme, setSonnerTheme] = useState<"light" | "dark">(() =>
    resolveSonnerTheme(theme),
  );

  useEffect(() => {
    const sync = () => setSonnerTheme(resolveSonnerTheme(theme));
    sync();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [theme]);

  return <Toaster theme={sonnerTheme} richColors position="bottom-right" style={{ zoom: "var(--ui-zoom, 1)" }} />;
}
