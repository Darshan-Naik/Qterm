export function SectionHeading({
  kicker,
  title,
  body,
}: {
  kicker?: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {kicker ? (
        <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {kicker}
        </p>
      ) : null}
      <h2 className="text-[28px] font-semibold tracking-tight sm:text-[34px]">{title}</h2>
      {body ? <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">{body}</p> : null}
    </div>
  );
}
