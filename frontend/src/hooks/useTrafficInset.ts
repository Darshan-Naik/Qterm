import { useEffect, useState } from "react";
import { WindowIsFullscreen } from "../../wailsjs/runtime/runtime";

/** True when macOS traffic lights are visible (windowed). False in fullscreen. */
export function useTrafficLightsVisible() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    let alive = true;

    const sync = async () => {
      try {
        const fs = await WindowIsFullscreen();
        if (alive) setVisible(!fs);
      } catch {
        if (alive) setVisible(true);
      }
    };

    void sync();
    window.addEventListener("resize", sync);
    window.addEventListener("focus", sync);
    const id = window.setInterval(sync, 500);
    return () => {
      alive = false;
      window.removeEventListener("resize", sync);
      window.removeEventListener("focus", sync);
      window.clearInterval(id);
    };
  }, []);

  return visible;
}

/** Keeps chrome clearance in sync with traffic lights / fullscreen. */
export function useTrafficInsetVar() {
  const lights = useTrafficLightsVisible();

  useEffect(() => {
    const root = document.documentElement;
    // Fixed values — avoid env(titlebar-area-*) which misaligns under TitleBarHidden.
    root.style.setProperty("--titlebar-height", "32px");
    root.style.setProperty("--traffic-inset", lights ? "80px" : "6px");
    root.toggleAttribute("data-fullscreen", !lights);
  }, [lights]);

  return lights;
}
