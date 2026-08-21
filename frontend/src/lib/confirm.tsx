import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { dismissExclusiveMenus } from "@/hooks/useExclusiveMenu";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive confirm button (default false). */
  destructive?: boolean;
};

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

let pending: Pending | null = null;
const listeners = new Set<(p: Pending | null) => void>();

function emit() {
  for (const listener of listeners) listener(pending);
}

/**
 * Imperative confirm — same idea as `toast()`: call from anywhere, await the result.
 * Requires `<ConfirmHost />` mounted once (next to the toaster).
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  dismissExclusiveMenus();
  if (pending) pending.resolve(false);
  return new Promise((resolve) => {
    pending = { ...options, resolve };
    emit();
  });
}

function settle(ok: boolean) {
  const current = pending;
  pending = null;
  emit();
  current?.resolve(ok);
}

/** One-shot host for `confirm()` — mount beside `<ThemedToaster />`. */
export function ConfirmHost() {
  const [state, setState] = useState<Pending | null>(null);

  useEffect(() => {
    listeners.add(setState);
    setState(pending);
    return () => {
      listeners.delete(setState);
    };
  }, []);

  if (!state) return null;

  return (
    <Dialog open onOpenChange={(open) => !open && settle(false)}>
      <DialogContent showClose={false}>
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
          {state.description ? (
            <DialogDescription>{state.description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => settle(false)}>
            {state.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            variant={state.destructive ? "destructive" : "default"}
            autoFocus
            onClick={() => settle(true)}
          >
            {state.confirmLabel ?? "Confirm"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
