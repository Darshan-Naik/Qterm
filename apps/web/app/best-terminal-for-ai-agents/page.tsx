import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { PageHero } from "@/components/PageHero";
import { PageCta } from "@/components/PageCta";
import { FaqSection } from "@/components/FaqSection";
import { RelatedLinks } from "@/components/RelatedLinks";
import { CompareTable } from "@/components/CompareTable";
import { GuidePickCard } from "@/components/GuidePickCard";
import { TextLink } from "@/components/TextLink";
import { BEST_AI_AGENTS_FAQ } from "@/lib/faq";
import { BEST_AI_AGENTS_PICKS } from "@/lib/guides";
import { articleLd, breadcrumbLd, faqPageLd, pageMeta } from "@/lib/seo";

const title = "Best Terminal for AI Agents in 2026";
const description =
  "Best terminal for AI agents in 2026: Qterm for a fast, light Mac agent terminal; Ghostty and Alacritty for raw speed; Warp for a built-in AI agent; cmux for notification rings.";
const path = "/best-terminal-for-ai-agents";
const crumbs = [
  { href: "/", label: "Qterm" },
  { href: path, label: "Best terminal for AI agents" },
];

export const metadata: Metadata = pageMeta({ title, description, path, type: "article" });

export default function BestTerminalForAiAgentsPage() {
  return (
    <main>
      <JsonLd data={breadcrumbLd(crumbs.map((c) => ({ name: c.label, path: c.href })))} />
      <JsonLd data={faqPageLd(BEST_AI_AGENTS_FAQ)} />
      <JsonLd data={articleLd({ title, description, path })} />
      <PageHero
        kicker="Guide"
        title="Best terminal for AI agents in 2026"
        body="Quick answer: Qterm if you want a fast, light Mac agent terminal for Claude Code, Codex, and Gemini CLI. Ghostty or Alacritty if you only need a fast or small emulator. Warp if you want a built-in AI terminal."
        crumbs={crumbs}
      />
      <article className="mx-auto max-w-3xl space-y-6 px-5 pb-10 text-[15px] leading-relaxed text-muted-foreground">
        <p>
          Ranked pages for this query are comparison guides, not generic &quot;best terminal&quot; lists.
          Those lists still crown Ghostty and Alacritty for speed. Agent searches are a different job: who
          holds Claude Code, Codex, and Gemini CLI without turning into a chat app.
        </p>
        <h2 className="pt-2 text-[22px] font-semibold tracking-tight text-foreground">The short list</h2>
      </article>
      <div className="mx-auto grid max-w-6xl gap-4 px-5 sm:grid-cols-2">
        {BEST_AI_AGENTS_PICKS.map((pick) => (
          <GuidePickCard key={pick.name} pick={pick} />
        ))}
      </div>
      <div className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="mb-5 text-[22px] font-semibold tracking-tight">Side by side</h2>
        <CompareTable />
        <p className="mt-5 max-w-3xl text-[14px] leading-relaxed text-muted-foreground">
          Full notes: <TextLink href="/compare">Qterm vs Warp, Ghostty, iTerm2, and cmux</TextLink>. Fast
          terminal and small terminal still belong to Ghostty and Alacritty. Agent terminal belongs to the
          tools that host CLIs on purpose.
        </p>
      </div>
      <PageCta />
      <FaqSection items={BEST_AI_AGENTS_FAQ} title="Best terminal for AI agents FAQ" />
      <RelatedLinks
        items={[
          {
            href: "/best-terminal-for-claude-code",
            label: "Best terminal for Claude Code",
            body: "Same question, narrowed to Anthropic's CLI.",
          },
          { href: "/agent-terminal", label: "What is an agent terminal", body: "Definition, not a roundup." },
          { href: "/vs/warp", label: "Qterm vs Warp", body: "Built-in agent versus bring-your-own CLI." },
        ]}
      />
    </main>
  );
}
