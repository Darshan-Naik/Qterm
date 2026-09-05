import Link from "next/link";
import { SectionHeading } from "./SectionHeading";

export function CompareTeaser() {
  return (
    <section className="border-t border-white/6 py-20">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          kicker="Compare"
          title="Best terminal for agents, by job"
          body="Warp is the AI terminal. Ghostty and Alacritty are the fast, small emulators. Qterm is the fast, light Mac agent terminal for Claude Code, Codex, and Gemini CLI."
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
