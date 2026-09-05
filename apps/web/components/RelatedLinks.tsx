import Link from "next/link";

export function RelatedLinks({
  title = "Keep reading",
  items,
}: {
  title?: string;
  items: readonly { href: string; label: string; body?: string }[];
}) {
  return (
    <section className="border-t border-white/6 py-16">
      <div className="mx-auto max-w-6xl px-5">
        <h2 className="text-[22px] font-semibold tracking-tight">{title}</h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className="block rounded-xl border border-white/8 bg-card/60 px-4 py-4 transition hover:border-white/16"
              >
                <span className="text-[14px] font-medium">{item.label}</span>
                {item.body ? (
                  <span className="mt-1 block text-[13px] leading-relaxed text-muted-foreground">
                    {item.body}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
