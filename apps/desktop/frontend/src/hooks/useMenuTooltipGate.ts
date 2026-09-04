import { useCallback, useState } from "react";

/**
 * Hide tooltips after a menu closes until the pointer leaves/re-enters the trigger.
 * (Timeout-based suppress still flashes while the cursor stays on the button.)
 */
export function useMenuTooltipGate() {
  const [suppressTip, setSuppressTip] = useState(false);

  const suppressTipAfterMenuClose = useCallback(() => {
    setSuppressTip(true);
  }, []);

  const tipTriggerProps = {
    onPointerEnter: () => setSuppressTip(false),
    onPointerLeave: () => setSuppressTip(false),
  };

  return { suppressTip, suppressTipAfterMenuClose, tipTriggerProps };
}
