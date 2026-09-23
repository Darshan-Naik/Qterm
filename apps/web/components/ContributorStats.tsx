import type { ContributorData } from "@/lib/contributors";

export function ContributorStats({ stats }: { stats: ContributorData["stats"] }) {
  const items = [
    { label: "Contributors", value: stats.contributors },
    { label: "Contributions", value: stats.contributions },
    ...stats.categories.filter((category) => category.count > 0).map((category) => ({
      label: category.label,
      value: category.count,
    })),
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="rounded-2xl border border-white/8 bg-card/80 px-4 py-4">
          <dt className="text-[12px] text-muted-foreground">{item.label}</dt>
          <dd className="mt-1 font-mono text-[28px] tracking-tight text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
