import { focusSession } from "@/lib/sessions";
import { uiStore } from "@/store/ui";

export type UnreadHit = { id: string; at: number };

/** Rank needs-input sessions newest-first for jump-unread. */
export function listUnreadSessions(): UnreadHit[] {
  const { paneAnimations, sessions, sessionNoticeAt } = uiStore.get();
  return sessions
    .filter((s) => paneAnimations[s.id] === "action_required")
    .map((s) => ({
      id: s.id,
      at: sessionNoticeAt[s.id] || Date.parse(s.createdAt || "") || 0,
    }))
    .sort((a, b) => {
      if (a.at !== b.at) return b.at - a.at;
      return b.id.localeCompare(a.id);
    });
}

/** Focus the most recently marked needs-input / notify terminal. */
export function jumpToUnread(): boolean {
  const unread = listUnreadSessions();
  if (unread.length === 0) return false;
  const focusedSessionId = uiStore.get().focusedSessionId;
  let next = unread[0];
  if (focusedSessionId && unread.length > 1 && unread[0].id === focusedSessionId) {
    next = unread[1];
  }
  void focusSession(next.id);
  return true;
}

export function setSessionNotice(sessionId: string, text: string) {
  if (!sessionId) return;
  const notices = { ...uiStore.get().sessionNotices };
  const at = { ...uiStore.get().sessionNoticeAt };
  const trimmed = text.trim();
  if (!trimmed) {
    delete notices[sessionId];
    delete at[sessionId];
  } else {
    notices[sessionId] = trimmed;
    at[sessionId] = Date.now();
  }
  uiStore.set({ sessionNotices: notices, sessionNoticeAt: at });
}

export function clearSessionNotice(sessionId: string) {
  setSessionNotice(sessionId, "");
}
