import Link from "next/link";
import { SectionHeading } from "./SectionHeading";

export function CompareTeaser() {
  return (
    <section className="border-t border-white/6 py-20">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          kicker="Compare"
          title="Best terminal for agents, by job"
          body="Live search still sends 'best terminal' and 'fast terminal' to Ghostty, Alacritty, and iTerm2. Agent searches go to Warp, cmux, and comparison guides. Qterm sits in the gap: a fast, light Mac agent terminal."
        />
        <div className="mx-auto mt-8 flex max-w-xl flex-wrap justify-center gap-3 text-[13px]">
          <Link
            href="/best-terminal-for-ai-agents"
            className="rounded-full border border-white/10 bg-white/4 px-4 py-2 transition hover:border-white/20"
          >
            Best terminal for AI agents
          </Link>
          <Link
            href="/best-terminal-for-claude-code"
            className="rounded-full border border-white/10 bg-white/4 px-4 py-2 transition hover:border-white/20"
          >
            Best terminal for Claude Code
          </Link>
          <Link
            href="/compare"
            className="rounded-full border border-white/10 bg-white/4 px-4 py-2 transition hover:border-white/20"
          >
            Qterm vs Warp, Ghostty, cmux
          </Link>
        </div>
      </div>
    </section>
  );
}
