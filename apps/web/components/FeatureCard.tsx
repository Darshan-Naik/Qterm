import { FeatureVisual, type FeatureVisualKind } from "./FeatureVisual";

export function FeatureCard({
  title,
  body,
  visual,
}: {
  title: string;
  body: string;
  visual: FeatureVisualKind;
}) {
  return (
    <article className="feature-card rounded-2xl border border-white/8 bg-card/80 p-6">
      <FeatureVisual kind={visual} />
      <h3 className="mt-5 text-[16px] font-medium tracking-tight">{title}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{body}</p>
    </article>
  );
}
