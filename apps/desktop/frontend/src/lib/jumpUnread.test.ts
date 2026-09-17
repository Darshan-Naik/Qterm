import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Hermetic ranking contract (mirrors listUnreadSessions / jumpToUnread pick logic).
type S = {
  sessions: Array<{ id: string; createdAt?: string }>;
  paneAnimations: Record<string, string>;
  sessionNoticeAt: Record<string, number>;
  focusedSessionId: string | null;
};

function listUnread(state: S) {
  return state.sessions
    .filter((s) => state.paneAnimations[s.id] === "action_required")
    .map((s) => ({
      id: s.id,
      at: state.sessionNoticeAt[s.id] || Date.parse(s.createdAt || "") || 0,
    }))
    .sort((a, b) => {
      if (a.at !== b.at) return b.at - a.at;
      return b.id.localeCompare(a.id);
    });
}

function pickJump(state: S) {
  const unread = listUnread(state);
  if (unread.length === 0) return null;
  if (state.focusedSessionId && unread.length > 1 && unread[0].id === state.focusedSessionId) {
    return unread[1].id;
  }
  return unread[0].id;
}

describe("jump unread ranking", () => {
  it("returns empty when nothing needs attention", () => {
    const state: S = {
      sessions: [{ id: "a" }],
      paneAnimations: {},
      sessionNoticeAt: {},
      focusedSessionId: null,
    };
    assert.deepEqual(listUnread(state), []);
    assert.equal(pickJump(state), null);
  });

  it("prefers the newest notice timestamp", () => {
    const state: S = {
      sessions: [
        { id: "a", createdAt: "2026-01-01T00:00:00Z" },
        { id: "b", createdAt: "2026-01-02T00:00:00Z" },
      ],
      paneAnimations: { a: "action_required", b: "action_required" },
      sessionNoticeAt: { a: 10, b: 20 },
      focusedSessionId: null,
    };
    assert.equal(pickJump(state), "b");
  });

  it("cycles to the next unread when already focused", () => {
    const state: S = {
      sessions: [{ id: "a" }, { id: "b" }],
      paneAnimations: { a: "action_required", b: "action_required" },
      sessionNoticeAt: { a: 1, b: 2 },
      focusedSessionId: "b",
    };
    assert.equal(pickJump(state), "a");
  });
});
