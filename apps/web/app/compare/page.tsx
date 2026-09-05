import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/JsonLd";
import { PageHero } from "@/components/PageHero";
import { PageCta } from "@/components/PageCta";
import { CompareTable } from "@/components/CompareTable";
import { RelatedLinks } from "@/components/RelatedLinks";
import { VS_PAGES } from "@/lib/compare";
import { articleLd, breadcrumbLd, pageMeta } from "@/lib/seo";

const title = "Compare Warp, Ghostty, iTerm2, and cmux";
const description =
  "Compare Qterm, the fast Mac agent terminal, with Warp, Ghostty, iTerm2, Wave, and cmux. Built for Claude Code, Codex, and Gemini CLI without a vendor chat UI.";
const path = "/compare";
const crumbs = [
  { href: "/", label: "Qterm" },
  { href: path, label: "Compare" },
];

export const metadata: Metadata = pageMeta({ title, description, path });

export default function ComparePage() {
  return (
    <main>
      <JsonLd data={breadcrumbLd(crumbs.map((c) => ({ name: c.label, path: c.href })))} />
      <JsonLd data={articleLd({ title, description, path })} />
      <PageHero
        kicker="Compare"
        title="Qterm vs the terminals that rank"
        body="Warp owns AI terminal. Ghostty and Alacritty own fast and small. iTerm2 owns classic Mac terminal. cmux owns agent notifications. Qterm is the fast, light agent terminal in the middle."
        crumbs={crumbs}
      />
      <div className="mx-auto max-w-6xl px-5 pb-12">
        <CompareTable />
      </div>
      <ul className="mx-auto grid max-w-6xl gap-3 px-5 pb-8 sm:grid-cols-2">
        {VS_PAGES.map((page) => (
          <li key={page.slug}>
            <Link
              href={`/vs/${page.slug}`}
              className="block rounded-xl border border-white/8 bg-card/60 px-4 py-4 transition hover:border-white/16"
            >
              <span className="text-[14px] font-medium">{page.heading}</span>
              <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">
                {page.summary}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <PageCta />
      <RelatedLinks
        items={[
          {
            href: "/best-terminal-for-ai-agents",
            label: "Best terminal for AI agents",
            body: "Verdict-first guide for the query that actually ranks.",
          },
          { href: "/agent-terminal", label: "Agent terminal", body: "What the category means." },
        ]}
      />
    </main>
  );
}
