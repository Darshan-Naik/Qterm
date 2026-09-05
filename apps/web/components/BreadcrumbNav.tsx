import Link from "next/link";

export function BreadcrumbNav({
  items,
}: {
  items: readonly { href: string; label: string }[];
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6 text-[12px] text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => (
          <li key={item.href} className="flex items-center gap-2">
            {index > 0 ? <span aria-hidden="true">/</span> : null}
            {index === items.length - 1 ? (
              <span className="text-foreground/80">{item.label}</span>
            ) : (
              <Link href={item.href} className="transition hover:text-foreground">
                {item.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
