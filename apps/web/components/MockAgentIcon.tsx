import { AGENTS } from "@/lib/site";
import { MockTerminalGlyph } from "./MockTerminalGlyph";

export function MockAgentIcon({ agent, size = 16 }: { agent?: string; size?: number }) {
  const src = AGENTS.find((item) => item.id === agent)?.src;
  if (!src) {
    return (
      <span className="inline-flex">
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
      className="shrink-0 rounded-[3px] object-contain"
      style={{ width: size, height: size }}
    />
  );
}
