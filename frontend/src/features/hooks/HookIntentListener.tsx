import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { uiStore, useUI, type AnimateState, type HookIntent } from "@/store/ui";
import { ResolveHookIntent } from "../../../wailsjs/go/main/App";
import { EventsOn } from "../../../wailsjs/runtime/runtime";

export function HookIntentListener() {
  const pending = useUI((s) => s.pendingIntent);
  const focusedSessionId = useUI((s) => s.focusedSessionId);

  // Clear needs-input pulse once the user focuses that terminal.
  useEffect(() => {
    if (!focusedSessionId) return;
    const anim = uiStore.get().paneAnimations[focusedSessionId];
    if (anim === "action_required") {
      const next = { ...uiStore.get().paneAnimations, [focusedSessionId]: "none" as AnimateState };
      uiStore.set({ paneAnimations: next });
    }
  }, [focusedSessionId]);

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
      // thinking stays while the agent is working (cleared by complete / none / needs-input).
      // action_required stays until the user focuses the session.
      const ms = state === "task_complete" ? 2200 : 0;
      if (!ms) {
        if (state === "none") clearAnim(sessionId);
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

    uiStore.set({ paneAnimations: {} });

    const offIntent = (EventsOn as any)("hook:intent", (intent: HookIntent) => {
      // Never fall back to focused pane — that jumps status/rename when switching tabs.
      const sessionId = intent.sessionId || "";
      const agent = String(intent.payload?.agent || intent.hookId || "");

      if (intent.type === "animate") {
        const state = (intent.payload?.state as AnimateState) || "none";
        if (!sessionId) return;

        if (agent) {
          const agents = { ...uiStore.get().sessionAgents };
          if (state === "none") {
            delete agents[sessionId];
          } else {
            agents[sessionId] = agent;
          }
          uiStore.set({ sessionAgents: agents });
        }

        if (state === "none") {
          clearAnim(sessionId);
          return;
        }
        // Don't downgrade action_required with a fleeting thinking pulse.
        const current = uiStore.get().paneAnimations[sessionId];
        if (current === "action_required" && state === "thinking") {
          return;
        }
        const map = { ...uiStore.get().paneAnimations, [sessionId]: state };
        uiStore.set({ paneAnimations: map });
        scheduleClear(sessionId, state);
      }

      if (intent.type === "suggest") {
        uiStore.set({ suggestText: String(intent.payload?.text || "") });
      }
      if (intent.type === "request_approval") {
        uiStore.set({ pendingIntent: { ...intent, sessionId } });
      }
      // notify intents are intentionally ignored — sidebar animation only.
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
            }}
          >
            Approve
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
