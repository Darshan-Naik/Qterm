export function PickList({
  title,
  items,
}: {
  title: string;
  items: readonly string[];
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-card/60 p-5">
      <h3 className="text-[15px] font-medium tracking-tight">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-[14px] leading-snug text-muted-foreground">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--brand-ink)]/70" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
