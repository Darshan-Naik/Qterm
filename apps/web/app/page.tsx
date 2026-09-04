import { SiteHeader } from "@/components/SiteHeader";
import { Hero } from "@/components/Hero";
import { FeatureGrid } from "@/components/FeatureGrid";
import { QuietList } from "@/components/QuietList";
import { AgentSection } from "@/components/AgentSection";
import { DownloadSection } from "@/components/DownloadSection";
import { SiteFooter } from "@/components/SiteFooter";

export default async function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <FeatureGrid />
        <QuietList />
        <AgentSection />
        <DownloadSection />
      </main>
      <SiteFooter />
    </>
  );
}
