import { uiStore, type AnimateState } from "@/store/ui";

export function isAckableAnim(state: AnimateState | undefined) {
  return state === "action_required" || state === "task_complete";
}

/** Clear needs-input + done after the user types in that terminal. */
export function dismissSessionFeedback(sessionId: string) {
  if (!sessionId) return;
  const cur = uiStore.get().paneAnimations[sessionId];
  if (!isAckableAnim(cur)) return;
  uiStore.set({
    paneAnimations: { ...uiStore.get().paneAnimations, [sessionId]: "none" },
  });
}

/** Done highlight only — needs-input stays until the user actually types. */
export function dismissSessionComplete(sessionId: string) {
  if (!sessionId) return;
  if (uiStore.get().paneAnimations[sessionId] !== "task_complete") return;
  uiStore.set({
    paneAnimations: { ...uiStore.get().paneAnimations, [sessionId]: "none" },
  });
}

/**
 * Resolve the next sidebar animation.
 * - Complete still shows on the session you're using; it clears on prompt / leave / blur.
 * - Needs-input stays until the user types or the agent continues after they answer.
 * - Duplicate states are no-ops so a repeating complete hook cannot stick the highlight.
 */
export function nextAnimateState(
  current: AnimateState | undefined,
  incoming: AnimateState,
  focused: boolean
): AnimateState | null {
  // Unread needs-input: ignore thinking pulses until they visit and answer.
  if (current === "action_required" && incoming === "thinking" && !focused) return null;
  // Idle (session start / back at prompt) must not wipe needs-input or the done flash.
  if (incoming === "idle" && (current === "action_required" || current === "task_complete")) return null;
  if (current === incoming) return null;
  return incoming;
}
