import type { Metadata } from "next";
import { SITE, siteUrl } from "./site";
import { SITE_KEYWORDS } from "./keywords";

export function absUrl(path = "/") {
  const base = siteUrl();
  if (path === "/") return base;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function pageMeta({
  title,
  description,
  path,
  type = "website",
}: {
  title: string;
  description: string;
  path: string;
  type?: "website" | "article";
}): Metadata {
  const url = absUrl(path);
  const branded = `${title} | ${SITE.name}`;
  return {
    title,
    description,
    keywords: [...SITE_KEYWORDS],
    alternates: { canonical: url },
    openGraph: {
      title: branded,
      description,
      url,
      siteName: SITE.name,
      type,
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: branded,
      description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
  };
}

export type JsonLd = Record<string, unknown>;

export function softwareApplicationLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE.name,
    alternateName: ["Qterm Agent Terminal", "Qterm Agentic Terminal"],
    applicationCategory: "DeveloperApplication",
    applicationSubCategory: "Terminal emulator",
    operatingSystem: "macOS",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    description: SITE.seoDescription,
    url: absUrl("/"),
    downloadUrl: SITE.releases,
    softwareRequirements: "macOS on Apple Silicon",
    author: { "@type": "Person", name: SITE.author, url: SITE.website },
    featureList: [
      "Agent terminal for Mac",
      "Claude Code",
      "Codex CLI",
      "Gemini CLI",
      "Cursor Agent",
      "Antigravity",
      "Projects",
      "Split panes",
      "Fast and light window",
    ],
  };
}

export function websiteLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: absUrl("/"),
    description: SITE.seoDescription,
    inLanguage: "en-US",
  };
}

export function faqPageLd(items: { question: string; answer: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

export function breadcrumbLd(crumbs: { name: string; path: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absUrl(crumb.path),
    })),
  };
}

export function articleLd({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description,
    url: absUrl(path),
    author: { "@type": "Person", name: SITE.author, url: SITE.website },
    publisher: { "@type": "Organization", name: SITE.name, url: absUrl("/") },
    mainEntityOfPage: absUrl(path),
  };
}

export const SITEMAP_PATHS = [
  "/",
  "/agent-terminal",
  "/best-terminal-for-ai-agents",
  "/best-terminal-for-claude-code",
  "/compare",
  "/agents/claude-code",
  "/agents/codex",
  "/agents/gemini-cli",
  "/agents/cursor-agent",
  "/agents/antigravity",
  "/vs/warp",
  "/vs/ghostty",
  "/vs/iterm2",
  "/vs/wave",
  "/vs/cmux",
] as const;
