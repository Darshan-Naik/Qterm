import { useUI } from "@/store/ui";
import { cn } from "@/lib/utils";
import { AgentMark } from "@/features/sidebar/AgentMark";

export const RENAME_SESSION_EVENT = "qterm:rename-session";

export function requestSessionRename(sessionId: string) {
  window.dispatchEvent(new CustomEvent(RENAME_SESSION_EVENT, { detail: sessionId }));
}

/** Display-only pane title. Rename is edited in the sidebar session list. */
export function PaneTitle({ sessionId, active = false }: { sessionId: string; active?: boolean }) {
  // Select sessions (not a prop-dependent slice). qortex-store-react caches by store
  // state only — putting sessionId inside the selector leaves a stale title when the
  // pane swaps sessions without a further store write (e.g. until you re-focus).
  const sessions = useUI((s) => s.sessions);
  const agent = useUI((s) => s.sessionAgents[sessionId] || "");
  const anim = useUI((s) => s.paneAnimations[sessionId] || "none");
  const name = sessions.find((x) => x.id === sessionId)?.name || "Terminal";

  return (
    <span
      className={cn(
        "flex min-w-0 flex-1 items-center gap-1.5 px-1 py-0.5 text-left text-[12.5px] leading-5 text-foreground opacity-45 transition-opacity group-hover/chrome:opacity-100",
        active && "opacity-100"
      )}
    >
      <span className="flex size-5 shrink-0 items-center justify-center">
        <AgentMark agent={agent} state={anim} iconClassName="size-3.5" side="bottom" />
      </span>
      <span className="min-w-0 truncate leading-5">{name}</span>
    </span>
  );
}
