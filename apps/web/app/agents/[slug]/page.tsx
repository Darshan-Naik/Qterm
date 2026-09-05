import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { PageHero } from "@/components/PageHero";
import { PageCta } from "@/components/PageCta";
import { RelatedLinks } from "@/components/RelatedLinks";
import { AGENT_PAGES, agentPage } from "@/lib/agent-pages";
import { articleLd, breadcrumbLd, pageMeta } from "@/lib/seo";

type Params = { slug: string };

export const dynamicParams = false;

export function generateStaticParams() {
  return AGENT_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const page = agentPage(slug);
  if (!page) return {};
  return pageMeta({
    title: page.title,
    description: page.description,
    path: `/agents/${page.slug}`,
    type: "article",
  });
}

export default async function AgentLandingPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const page = agentPage(slug);
  if (!page) notFound();
  const path = `/agents/${page.slug}`;
  const crumbs = [
    { href: "/", label: "Qterm" },
    { href: "/#agents", label: "Agents" },
    { href: path, label: page.name },
  ];

  return (
    <main>
      <JsonLd data={breadcrumbLd(crumbs.map((c) => ({ name: c.label, path: c.href })))} />
      <JsonLd data={articleLd({ title: page.title, description: page.description, path })} />
      <PageHero kicker="Agent terminal" title={page.heading} body={page.intro} crumbs={crumbs} />
      <article className="mx-auto max-w-3xl px-5 pb-10">
        <ul className="space-y-3">
          {page.points.map((point) => (
            <li
              key={point}
              className="flex items-start gap-3 rounded-xl border border-white/8 bg-card/60 px-4 py-3 text-[14px] leading-snug"
            >
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--brand-ink)]/70" />
              {point}
            </li>
          ))}
        </ul>
        <p className="mt-8 text-[15px] leading-relaxed text-muted-foreground">{page.closing}</p>
      </article>
      <PageCta />
      <RelatedLinks
        items={[
          {
            href: "/best-terminal-for-claude-code",
            label: "Best terminal for Claude Code",
            body: "How this agent fits the Mac terminal landscape.",
          },
          { href: "/agent-terminal", label: "Agent terminal", body: "The category Qterm is built for." },
          { href: "/compare", label: "Compare", body: "Qterm next to Warp, Ghostty, and cmux." },
        ]}
      />
    </main>
  );
}
