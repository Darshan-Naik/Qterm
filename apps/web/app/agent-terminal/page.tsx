import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { PageHero } from "@/components/PageHero";
import { PageCta } from "@/components/PageCta";
import { FaqSection } from "@/components/FaqSection";
import { RelatedLinks } from "@/components/RelatedLinks";
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
          An <strong className="font-medium text-foreground">agent terminal</strong> is a window that hosts
          coding agents next to your shells. Qterm is that window: a fast, light Mac agent terminal where
          Claude Code, Codex, Gemini CLI, and Cursor Agent stay in the shell.
        </p>
        <p>
          An <strong className="font-medium text-foreground">agentic terminal</strong> is the same idea with
          a product-category name. Qterm uses it for a quiet job: your CLI agents, your projects, your
          splits. Nothing extra on screen.
        </p>
        <h2 className="pt-4 text-[22px] font-semibold tracking-tight text-foreground">
          Fast, light, and built for agents
        </h2>
        <p>
          Qterm is fast and light in the workflow sense: a small Mac window for agents, projects, and named
          splits, not a heavy chat app. Open a folder, split a pane, and keep working.
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
            href: "/agents/claude-code",
            label: "Claude Code terminal",
            body: "Run Claude Code in a Qterm project pane.",
          },
          {
            href: "/agents/codex",
            label: "Codex CLI terminal",
            body: "Keep Codex in the terminal next to your shells.",
          },
          {
            href: "/agents/gemini-cli",
            label: "Gemini CLI terminal",
            body: "Host Gemini CLI in the same quiet window.",
          },
        ]}
      />
    </main>
  );
}
