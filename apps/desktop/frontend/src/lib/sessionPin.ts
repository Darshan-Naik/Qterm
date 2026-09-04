import { sortSessionsByStart } from "@/lib/sessionTitles";
import { uiStore } from "@/store/ui";
import { SetSessionPinned } from "../../wailsjs/go/main/App";

export async function toggleSessionPin(sessionId: string) {
  const session = uiStore.get().sessions.find((s) => s.id === sessionId);
  if (!session) return;
  const pinned = !session.pinned;
  const ok = await SetSessionPinned(sessionId, pinned);
  if (!ok) return;
  uiStore.set({
    sessions: sortSessionsByStart(
      uiStore.get().sessions.map((s) => (s.id === sessionId ? { ...s, pinned } : s)),
    ),
  });
}
