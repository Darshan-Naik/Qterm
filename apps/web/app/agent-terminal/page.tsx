import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { PageHero } from "@/components/PageHero";
import { PageCta } from "@/components/PageCta";
import { FaqSection } from "@/components/FaqSection";
import { RelatedLinks } from "@/components/RelatedLinks";
import { TextLink } from "@/components/TextLink";
import { AGENT_TERMINAL_FAQ } from "@/lib/faq";
import { articleLd, breadcrumbLd, faqPageLd, pageMeta } from "@/lib/seo";

const title = "Agent Terminal for Mac";
const description =
  "Qterm is a fast, light agent terminal for Mac. Run Claude Code, Codex, Gemini CLI, and Cursor Agent in one quiet window with projects and splits.";
const path = "/agent-terminal";
const crumbs = [
  { href: "/", label: "Qterm" },
  { href: path, label: "Agent terminal" },
];

export const metadata: Metadata = pageMeta({ title, description, path, type: "article" });

export default function AgentTerminalPage() {
  return (
    <main>
      <JsonLd data={breadcrumbLd(crumbs.map((c) => ({ name: c.label, path: c.href })))} />
      <JsonLd data={faqPageLd(AGENT_TERMINAL_FAQ)} />
      <JsonLd data={articleLd({ title, description, path })} />
      <PageHero
        kicker="Agent terminal"
        title="Agent terminal"
        body={description}
        crumbs={crumbs}
      />
      <article className="mx-auto max-w-3xl space-y-6 px-5 pb-8 text-[15px] leading-relaxed text-muted-foreground">
        <p>
          Search for <strong className="font-medium text-foreground">agent terminal</strong> and you are
          not looking for Apple Terminal or a CIA briefing. You want a window that can host coding agents.
          Qterm is that window: a fast, light Mac agent terminal where Claude Code, Codex, Gemini CLI, and
          Cursor Agent stay in the shell.
        </p>
        <p>
          An <strong className="font-medium text-foreground">agentic terminal</strong> is the same idea with
          a product-category name. Warp uses it for an all-in-one AI environment. Qterm uses it for a quieter
          job: your CLI agents, your projects, your splits. Nothing extra on screen.
        </p>
        <h2 className="pt-4 text-[22px] font-semibold tracking-tight text-foreground">
          Fast terminal, small terminal, agent terminal
        </h2>
        <p>
          Live results for <strong className="font-medium text-foreground">fast terminal</strong> still go to
          Ghostty and Alacritty. Results for{" "}
          <strong className="font-medium text-foreground">small terminal</strong> and lightweight terminal go
          to tiny emulators. Those tools render text. They do not organize agent sessions. Qterm is fast and
          light in the workflow sense: a small Mac window for agents, not a 2 MB framebuffer toy and not a
          heavy AI IDE.
        </p>
        <p>
          If you want the fastest emulator, read Ghostty. If you want the smallest emulator, read Alacritty.
          If you want an agent terminal,{" "}
          <TextLink href="/best-terminal-for-ai-agents">compare the field</TextLink> or download Qterm.
        </p>
        <h2 className="pt-4 text-[22px] font-semibold tracking-tight text-foreground">What Qterm runs</h2>
        <p>
          Claude Code, Codex, Gemini CLI, Cursor Agent, and Antigravity. Each one is a normal terminal
          session under a project. Split right or down when you want two agents, or an agent beside git.
        </p>
      </article>
      <PageCta />
      <FaqSection items={AGENT_TERMINAL_FAQ} title="Agent terminal FAQ" />
      <RelatedLinks
        items={[
          {
            href: "/best-terminal-for-ai-agents",
            label: "Best terminal for AI agents",
            body: "How Qterm sits next to Warp, Ghostty, cmux, and Alacritty.",
          },
          {
            href: "/best-terminal-for-claude-code",
            label: "Best terminal for Claude Code",
            body: "A Claude Code terminal that stays a terminal.",
          },
          { href: "/compare", label: "Compare", body: "Side by side with Warp, Ghostty, iTerm2, and cmux." },
        ]}
      />
    </main>
  );
}
