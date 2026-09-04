export function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-2xl border border-white/8 bg-card/80 p-6">
      <h3 className="text-[16px] font-medium tracking-tight">{title}</h3>
      <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{body}</p>
    </article>
  );
}
