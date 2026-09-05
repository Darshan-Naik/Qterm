import { BreadcrumbNav } from "./BreadcrumbNav";

export function PageHero({
  kicker,
  title,
  body,
  crumbs,
}: {
  kicker?: string;
  title: string;
  body: string;
  crumbs: readonly { href: string; label: string }[];
}) {
  return (
    <header className="mx-auto max-w-3xl px-5 pb-10 pt-16 sm:pt-20">
      <BreadcrumbNav items={crumbs} />
      {kicker ? (
        <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {kicker}
        </p>
      ) : null}
      <h1 className="text-[36px] font-semibold leading-[1.08] tracking-tight sm:text-[48px]">
        {title}
      </h1>
      <p className="mt-5 text-[16px] leading-relaxed text-muted-foreground sm:text-[18px]">{body}</p>
    </header>
  );
}
