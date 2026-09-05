import Link from "next/link";
import { FOOTER_LINKS, SITE } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-white/6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-8 text-[13px] text-muted-foreground sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-foreground/80">
            {SITE.name}: {SITE.tagline}
          </p>
          <p className="mt-1 max-w-sm">Fast, light Mac agent terminal for Claude Code, Codex, and Gemini CLI.</p>
        </div>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          {FOOTER_LINKS.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-foreground">
              {item.label}
            </Link>
          ))}
          <a href={SITE.website} className="text-foreground/80 underline-offset-4 hover:underline">
            darshannaik.com
          </a>
        </nav>
      </div>
    </footer>
  );
}
