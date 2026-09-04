import { TerminalSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import claudeIcon from "@/assets/agents/claude.png";
import codexIcon from "@/assets/agents/codex.png";
import geminiIcon from "@/assets/agents/gemini.png";
import agyIcon from "@/assets/agents/agy.png";
import cursorIcon from "@/assets/agents/cursor.png";

const AGENT_ICONS: Record<string, string> = {
  claude: claudeIcon,
  codex: codexIcon,
  gemini: geminiIcon,
  agy: agyIcon,
  antigravity: agyIcon,
  cursor: cursorIcon,
};

export function agentLabel(id: string) {
  switch (normalizeAgentId(id)) {
    case "claude":
      return "Claude Code";
    case "codex":
      return "Codex";
    case "gemini":
      return "Gemini CLI";
    case "agy":
      return "Antigravity";
    case "cursor":
      return "Cursor Agent";
    default:
      return id ? "Agent" : "Terminal";
  }
}

export function normalizeAgentId(id: string) {
  const key = String(id || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-");
  if (!key) return "";
  if (key === "antigravity" || key.startsWith("agy")) return "agy";
  if (key.startsWith("claude")) return "claude";
  if (key.startsWith("codex")) return "codex";
  if (key.startsWith("gemini")) return "gemini";
  if (key.startsWith("cursor")) return "cursor";
  return key;
}

export function AgentIcon({
  agent,
  className,
  thinking,
}: {
  agent?: string;
  className?: string;
  thinking?: boolean;
}) {
  const id = normalizeAgentId(agent || "");
  const src = id ? AGENT_ICONS[id] : undefined;

  if (!src) {
    return (
      <TerminalSquare className={cn("size-4 opacity-50", thinking && "session-logo-pulse", className)} />
    );
  }

  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className={cn("size-4 shrink-0 rounded-[3px] object-contain", thinking && "session-logo-pulse", className)}
    />
  );
}
