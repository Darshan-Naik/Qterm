import Link from "next/link";
import { SITE } from "@/lib/site";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-5 py-24 text-center">
      <p className="text-[12px] uppercase tracking-[0.16em] text-muted-foreground">{SITE.name}</p>
      <h1 className="mt-4 text-[36px] font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
        Try the agent terminal homepage, or the guides for AI agents and Claude Code.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-4 text-[14px]">
        <Link href="/" className="underline-offset-4 hover:underline">
          Home
        </Link>
        <Link href="/agent-terminal" className="underline-offset-4 hover:underline">
          Agent terminal
        </Link>
        <Link href="/best-terminal-for-ai-agents" className="underline-offset-4 hover:underline">
          Best for AI agents
        </Link>
      </div>
    </main>
  );
}
