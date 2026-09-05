import { AGENTS } from "@/lib/site";
import { cn } from "@/lib/cn";
import { MockTerminalGlyph } from "./MockTerminalGlyph";

export function MockAgentIcon({
  agent,
  thinking = false,
  size = 16,
}: {
  agent?: string;
  thinking?: boolean;
  size?: number;
}) {
  const src = AGENTS.find((item) => item.id === agent)?.src;
  if (!src) {
    return (
      <span className={cn("inline-flex", thinking && "session-logo-pulse")}>
        <MockTerminalGlyph size={size} />
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={cn("shrink-0 rounded-[3px] object-contain", thinking && "session-logo-pulse")}
      style={{ width: size, height: size }}
    />
  );
}
