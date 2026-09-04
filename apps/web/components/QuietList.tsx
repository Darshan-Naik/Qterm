import { QUIET_POINTS } from "@/lib/site";

export function QuietList() {
  return (
    <section className="border-t border-white/6 py-16">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 sm:grid-cols-2 sm:items-center">
        <div>
          <h2 className="text-[28px] font-semibold tracking-tight sm:text-[32px]">
            Built to stay out of the way
          </h2>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Traffic lights, menus, and a window that feels at home next to the tools you already use.
            Designed for Mac.
          </p>
        </div>
        <ul className="space-y-3">
          {QUIET_POINTS.map((point) => (
            <li
              key={point}
              className="flex items-start gap-3 rounded-xl border border-white/8 bg-card/60 px-4 py-3 text-[14px] leading-snug"
            >
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[var(--brand-green)]" />
              {point}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
