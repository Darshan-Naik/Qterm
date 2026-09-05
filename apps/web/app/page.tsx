import { Hero } from "@/components/Hero";
import { FeatureGrid } from "@/components/FeatureGrid";
import { QuietList } from "@/components/QuietList";
import { AgentSection } from "@/components/AgentSection";
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
        <FaqSection
          items={HOME_FAQ}
          title="Agent terminal, answered"
          body="Short answers on what an agent terminal is, and how Qterm runs Claude Code, Codex, and Gemini CLI on Mac."
        />
        <DownloadSection />
      </main>
    </>
  );
}
