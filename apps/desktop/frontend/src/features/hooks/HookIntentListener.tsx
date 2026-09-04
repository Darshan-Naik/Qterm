import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { uiStore, useUI, type AnimateState, type HookIntent } from "@/store/ui";
import { dismissSessionComplete, dismissSessionFeedback, nextAnimateState } from "@/lib/sessionAnim";
import { ResolveHookIntent } from "../../../wailsjs/go/main/App";
import { EventsOn } from "../../../wailsjs/runtime/runtime";

function isPromptKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return false;
  if (e.key === "Enter" || e.key === "Backspace") return true;
  return e.key.length === 1;
}

export function HookIntentListener() {
  const pending = useUI((s) => s.pendingIntent);
  const focusedSessionId = useUI((s) => s.focusedSessionId);
  const prevFocused = useRef<string | null>(null);

  // Visit / leave → drop the green done highlight. Needs-input stays until they type.
  useEffect(() => {
    const prev = prevFocused.current;
    if (prev && prev !== focusedSessionId) dismissSessionComplete(prev);
    prevFocused.current = focusedSessionId;
    if (focusedSessionId) dismissSessionComplete(focusedSessionId);
  }, [focusedSessionId]);

  useEffect(() => {
    const clearAnim = (sessionId: string) => {
      const cur = { ...uiStore.get().paneAnimations };
      if (cur[sessionId] && cur[sessionId] !== "none") {
        cur[sessionId] = "none";
        uiStore.set({ paneAnimations: cur });
      }
    };

    uiStore.set({ paneAnimations: {} });

    const onWindowBlur = () => {
      const id = uiStore.get().focusedSessionId;
      if (id) dismissSessionComplete(id);
    };
    const onPromptKey = (e: KeyboardEvent) => {
      if (!isPromptKey(e)) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, [contenteditable]") && !t.closest(".xterm")) return;
      const id = uiStore.get().focusedSessionId;
      if (id) dismissSessionFeedback(id);
    };
    window.addEventListener("blur", onWindowBlur);
    window.addEventListener("keydown", onPromptKey);

    const offIntent = (EventsOn as any)("hook:intent", (intent: HookIntent) => {
      // Never fall back to focused pane — that jumps status/rename when switching tabs.
      const sessionId = intent.sessionId || "";
      const agent = String(intent.payload?.agent || intent.hookId || "");

      if (intent.type === "animate") {
        const state = (intent.payload?.state as AnimateState) || "none";
        if (!sessionId) return;

        if (agent && state !== "none") {
          const agents = { ...uiStore.get().sessionAgents };
          agents[sessionId] = agent;
          uiStore.set({ sessionAgents: agents });
        }

        if (state === "none") {
          clearAnim(sessionId);
          // SessionEnd hook → back to terminal icon.
          const agents = { ...uiStore.get().sessionAgents };
          if (agents[sessionId]) {
            delete agents[sessionId];
            uiStore.set({ sessionAgents: agents });
          }
          return;
        }
        const current = uiStore.get().paneAnimations[sessionId];
        const focused = uiStore.get().focusedSessionId === sessionId;
        const next = nextAnimateState(current, state, focused);
        if (!next) return;
        const map = { ...uiStore.get().paneAnimations, [sessionId]: next };
        uiStore.set({ paneAnimations: map });
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
      window.removeEventListener("blur", onWindowBlur);
      window.removeEventListener("keydown", onPromptKey);
      if (typeof offIntent === "function") offIntent();
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
