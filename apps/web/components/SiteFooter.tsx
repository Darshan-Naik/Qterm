import { SITE } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/6">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          {SITE.name} — {SITE.tagline}
        </p>
        <p>
          Powered by{" "}
          <a href={SITE.qortex} className="text-foreground/80 underline-offset-4 hover:underline">
            Qortex
          </a>
          <span className="mx-2 text-white/20">·</span>
          <a href={SITE.github} className="text-foreground/80 underline-offset-4 hover:underline">
            GitHub
          </a>
        </p>
      </div>
    </footer>
  );
}
