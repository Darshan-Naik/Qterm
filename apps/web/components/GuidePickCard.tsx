import Link from "next/link";
import type { GuidePick } from "@/lib/guides";

export function GuidePickCard({ pick }: { pick: GuidePick }) {
  const title = pick.href ? (
    <Link href={pick.href} className="underline-offset-4 hover:underline">
      {pick.name}
    </Link>
  ) : (
    pick.name
  );

  return (
    <article className="rounded-2xl border border-white/8 bg-card/60 p-5">
      <h3 className="text-[16px] font-medium tracking-tight">{title}</h3>
      <p className="mt-1 text-[12px] uppercase tracking-[0.12em] text-muted-foreground">{pick.bestFor}</p>
      <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">{pick.body}</p>
    </article>
  );
}
