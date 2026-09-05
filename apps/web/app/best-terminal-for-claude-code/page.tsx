import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { PageHero } from "@/components/PageHero";
import { PageCta } from "@/components/PageCta";
import { FaqSection } from "@/components/FaqSection";
import { RelatedLinks } from "@/components/RelatedLinks";
import { GuidePickCard } from "@/components/GuidePickCard";
import { TextLink } from "@/components/TextLink";
import { CLAUDE_CODE_FAQ } from "@/lib/faq";
import { CLAUDE_CODE_PICKS } from "@/lib/guides";
import { articleLd, breadcrumbLd, faqPageLd, pageMeta } from "@/lib/seo";

const title = "Best Terminal for Claude Code";
const description =
  "Best terminal for Claude Code on Mac: Qterm as a fast, light agent terminal; Ghostty as a fast emulator; cmux when you need notification rings; Warp if you want a built-in AI environment.";
const path = "/best-terminal-for-claude-code";
const crumbs = [
  { href: "/", label: "Qterm" },
  { href: path, label: "Best terminal for Claude Code" },
];

export const metadata: Metadata = pageMeta({ title, description, path, type: "article" });

export default function BestTerminalForClaudeCodePage() {
  return (
    <main>
      <JsonLd data={breadcrumbLd(crumbs.map((c) => ({ name: c.label, path: c.href })))} />
      <JsonLd data={faqPageLd(CLAUDE_CODE_FAQ)} />
      <JsonLd data={articleLd({ title, description, path })} />
      <PageHero
        kicker="Claude Code"
        title="Best terminal for Claude Code"
        body="Claude Code is a CLI. The best terminal for it is the one that stays out of the way, stays fast, and lets you run more than one session. Qterm is that agent terminal on Mac."
        crumbs={crumbs}
      />
      <article className="mx-auto max-w-3xl space-y-6 px-5 pb-10 text-[15px] leading-relaxed text-muted-foreground">
        <p>
          Guides that rank for this query usually pick Ghostty for speed, cmux for attention rings, or Warp
          for an all-in-one AI terminal. Those are real answers. They are not the only ones. If you want
          Claude Code in a project pane, next to a shell, in a small Mac window, that is{" "}
          <TextLink href="/agents/claude-code">Qterm as a Claude Code terminal</TextLink>.
        </p>
        <h2 className="pt-2 text-[22px] font-semibold tracking-tight text-foreground">Picks</h2>
      </article>
      <div className="mx-auto grid max-w-6xl gap-4 px-5 sm:grid-cols-2">
        {CLAUDE_CODE_PICKS.map((pick) => (
          <GuidePickCard key={pick.name} pick={pick} />
        ))}
      </div>
      <article className="mx-auto max-w-3xl space-y-6 px-5 py-12 text-[15px] leading-relaxed text-muted-foreground">
        <h2 className="text-[22px] font-semibold tracking-tight text-foreground">How to run Claude in Qterm</h2>
        <p>
          Download Qterm for Mac, add your repo as a project, open a terminal in that folder, and run{" "}
          <code className="font-mono text-[13px] text-foreground">claude</code>. Split down or right if you
          want Codex or a plain shell beside it. Agents stay in the terminal.
        </p>
      </article>
      <PageCta />
      <FaqSection items={CLAUDE_CODE_FAQ} title="Claude Code terminal FAQ" />
      <RelatedLinks
        items={[
          {
            href: "/best-terminal-for-ai-agents",
            label: "Best terminal for AI agents",
            body: "Claude Code plus Codex, Gemini CLI, and the rest.",
          },
          { href: "/agents/claude-code", label: "Claude Code terminal", body: "Product page for this agent." },
          { href: "/vs/cmux", label: "Qterm vs cmux", body: "Two Mac agent terminals, different bets." },
        ]}
      />
    </main>
  );
}
