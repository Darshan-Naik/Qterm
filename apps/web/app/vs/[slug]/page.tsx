import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { PageHero } from "@/components/PageHero";
import { PageCta } from "@/components/PageCta";
import { PickList } from "@/components/PickList";
import { RelatedLinks } from "@/components/RelatedLinks";
import { VS_PAGES, vsPage } from "@/lib/compare";
import { articleLd, breadcrumbLd, pageMeta } from "@/lib/seo";

type Params = { slug: string };

export const dynamicParams = false;

export function generateStaticParams() {
  return VS_PAGES.map((page) => ({ slug: page.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const page = vsPage(slug);
  if (!page) return {};
  return pageMeta({
    title: page.title,
    description: page.description,
    path: `/vs/${page.slug}`,
    type: "article",
  });
}

export default async function VsPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const page = vsPage(slug);
  if (!page) notFound();
  const path = `/vs/${page.slug}`;
  const crumbs = [
    { href: "/", label: "Qterm" },
    { href: "/compare", label: "Compare" },
    { href: path, label: page.title },
  ];

  return (
    <main>
      <JsonLd data={breadcrumbLd(crumbs.map((c) => ({ name: c.label, path: c.href })))} />
      <JsonLd data={articleLd({ title: page.title, description: page.description, path })} />
      <PageHero kicker={page.kicker} title={page.heading} body={page.intro} crumbs={crumbs} />
      <div className="mx-auto grid max-w-6xl gap-4 px-5 pb-8 sm:grid-cols-2">
        <PickList title={`Pick Qterm when`} items={page.pickQterm} />
        <PickList title={`Pick ${page.name} when`} items={page.pickOther} />
      </div>
      <p className="mx-auto max-w-3xl px-5 pb-10 text-[15px] leading-relaxed text-muted-foreground">
        {page.summary}
      </p>
      <PageCta />
      <RelatedLinks
        items={[
          { href: "/compare", label: "Full compare table", body: "Qterm next to Warp, Ghostty, iTerm2, and cmux." },
          {
            href: "/best-terminal-for-ai-agents",
            label: "Best terminal for AI agents",
            body: "The roundup that matches how people search.",
          },
        ]}
      />
    </main>
  );
}
