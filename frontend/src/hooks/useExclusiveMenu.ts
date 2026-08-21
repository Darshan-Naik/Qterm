import { useCallback, useEffect, useState } from "react";

type Listener = (id: string | null) => void;

let openId: string | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(openId);
}

/** Close every exclusive dropdown (e.g. when a dialog / context menu opens). */
export function dismissExclusiveMenus() {
  if (openId == null) return;
  openId = null;
  emit();
}

function subscribe(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * App-wide single-open dropdown state. Opening one id closes any other.
 * Use a stable id per menu instance (e.g. `session:${id}`).
 */
export function useExclusiveMenu(id: string): [boolean, (open: boolean) => void] {
  const [open, setOpen] = useState(false);

  useEffect(() => subscribe((next) => {
    if (next !== id) setOpen(false);
  }), [id]);

  const onOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        openId = id;
        emit();
        setOpen(true);
        return;
      }
      setOpen(false);
      if (openId === id) {
        openId = null;
        emit();
      }
    },
    [id]
  );

  return [open, onOpenChange];
}
