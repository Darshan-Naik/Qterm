import { FEATURES } from "@/lib/site";
import { FeatureCard } from "./FeatureCard";
import { SectionHeading } from "./SectionHeading";

export function FeatureGrid() {
  return (
    <section id="features" className="border-t border-white/6 py-20">
      <div className="mx-auto max-w-6xl px-5">
        <SectionHeading
          kicker="Why Qterm"
          title="A quieter workspace"
          body="Keep projects, terminals, and splits in one calm window so you spend less time managing tabs and more time shipping."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {FEATURES.map((feature) => (
            <FeatureCard
              key={feature.title}
              title={feature.title}
              body={feature.body}
              visual={feature.visual}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
