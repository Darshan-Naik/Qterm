import { SITE } from "@/lib/site";
import { DownloadButton } from "./DownloadButton";
import { GithubLink } from "./GithubLink";

export function DownloadSection() {
  return (
    <section id="download" className="border-t border-white/6 py-20">
      <div className="mx-auto max-w-6xl px-5">
        <div className="relative overflow-hidden rounded-3xl border border-white/8 px-6 py-16 sm:px-10">
          <div className="brand-glow pointer-events-none absolute inset-0 opacity-80" />
          <div className="relative mx-auto max-w-xl text-center">
            <h2 className="text-[32px] font-semibold tracking-tight sm:text-[40px]">
              Get {SITE.name}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
              Download the latest release, open {SITE.name}, and create a terminal, or add a project folder and
              go.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <DownloadButton />
              <GithubLink />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
