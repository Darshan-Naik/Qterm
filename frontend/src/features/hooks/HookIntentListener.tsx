import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { uiStore, useUI, type AnimateState, type HookIntent } from "@/store/ui";
import { ResolveHookIntent } from "../../../wailsjs/go/main/App";
import { EventsOn } from "../../../wailsjs/runtime/runtime";

export function HookIntentListener() {
  const pending = useUI((s) => s.pendingIntent);

  useEffect(() => {
    const clearTimers = new Map<string, number>();

    const clearAnim = (sessionId: string) => {
      const cur = { ...uiStore.get().paneAnimations };
      if (cur[sessionId] && cur[sessionId] !== "none") {
        cur[sessionId] = "none";
        uiStore.set({ paneAnimations: cur });
      }
    };

    const scheduleClear = (sessionId: string, state: AnimateState) => {
      const prev = clearTimers.get(sessionId);
      if (prev) window.clearTimeout(prev);
      const ms =
        state === "thinking" ? 1200 : state === "task_complete" ? 2800 : state === "action_required" ? 6000 : 0;
      if (!ms) {
        clearAnim(sessionId);
        return;
      }
      clearTimers.set(
        sessionId,
        window.setTimeout(() => {
          clearTimers.delete(sessionId);
          const still = uiStore.get().paneAnimations[sessionId];
          if (still === state) clearAnim(sessionId);
        }, ms)
      );
    };

    // Drop any stuck infinite pulses from earlier sessions.
    uiStore.set({ paneAnimations: {} });

    const offIntent = (EventsOn as any)("hook:intent", (intent: HookIntent) => {
      if (intent.type === "notify") {
        const title = String(intent.payload?.title || "Hook");
        const message = String(intent.payload?.message || "");
        const level = String(intent.payload?.level || "info");
        if (level === "success") toast.success(message, { description: title });
        else if (level === "warning") toast.warning(message, { description: title });
        else toast(message, { description: title });
      }
      if (intent.type === "animate") {
        const state = (intent.payload?.state as AnimateState) || "none";
        if (!intent.sessionId || state === "none") {
          if (intent.sessionId) clearAnim(intent.sessionId);
          return;
        }
        const map = { ...uiStore.get().paneAnimations, [intent.sessionId]: state };
        uiStore.set({ paneAnimations: map });
        scheduleClear(intent.sessionId, state);
      }
      if (intent.type === "suggest") {
        uiStore.set({ suggestText: String(intent.payload?.text || "") });
      }
      if (intent.type === "request_approval") {
        uiStore.set({ pendingIntent: intent });
      }
    });
    return () => {
      if (typeof offIntent === "function") offIntent();
      for (const t of clearTimers.values()) window.clearTimeout(t);
    };
  }, []);

  if (!pending) return null;

  return (
    <Dialog open onOpenChange={(v) => !v && uiStore.set({ pendingIntent: null })}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{String(pending.payload?.title || "Approve hook action")}</DialogTitle>
          <DialogDescription>{String(pending.payload?.message || "")}</DialogDescription>
        </DialogHeader>
        {pending.payload?.command ? (
          <pre className="overflow-auto rounded-md bg-muted p-3 text-xs">{String(pending.payload.command)}</pre>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={async () => {
              await ResolveHookIntent(pending.id, false);
              uiStore.set({ pendingIntent: null });
            }}
          >
            Dismiss
          </Button>
          <Button
            onClick={async () => {
              await ResolveHookIntent(pending.id, true);
              uiStore.set({ pendingIntent: null });
              toast.success("Approved");
            }}
          >
            Approve
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
