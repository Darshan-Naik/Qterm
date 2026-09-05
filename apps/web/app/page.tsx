import { Hero } from "@/components/Hero";
import { FeatureGrid } from "@/components/FeatureGrid";
import { QuietList } from "@/components/QuietList";
import { AgentSection } from "@/components/AgentSection";
import { CompareTeaser } from "@/components/CompareTeaser";
import { FaqSection } from "@/components/FaqSection";
import { DownloadSection } from "@/components/DownloadSection";
import { JsonLd } from "@/components/JsonLd";
import { HOME_FAQ } from "@/lib/faq";
import { faqPageLd } from "@/lib/seo";

export default async function HomePage() {
  return (
    <>
      <JsonLd data={faqPageLd(HOME_FAQ)} />
      <main>
        <Hero />
        <FeatureGrid />
        <QuietList />
        <AgentSection />
        <CompareTeaser />
        <FaqSection
          items={HOME_FAQ}
          title="Fast agent terminal, answered"
          body="Short answers on agent terminal, fast terminal, small terminal, and the best terminal for Claude Code."
        />
        <DownloadSection />
      </main>
    </>
  );
}
