import { SITE } from "@/lib/site";
import { GithubLink } from "./GithubLink";
import { MacDownloadActions } from "./MacDownloadActions";
import { ProductWindow } from "./ProductWindow";

export async function Hero() {
  return (
    <section id="top" className="relative overflow-hidden">
      <div className="brand-glow pointer-events-none absolute inset-0" />
      <div className="site-grid pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-16 sm:pt-24">
        <p className="mb-5 inline-flex items-center rounded-full border border-white/10 bg-white/4 px-3 py-1 text-[12px] font-medium tracking-wide text-muted-foreground">
          Designed for Mac
        </p>
        <h1 className="max-w-3xl text-[40px] font-semibold leading-[1.05] tracking-tight sm:text-[56px]">
          {SITE.tagline}
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-muted-foreground sm:text-[18px]">
          {SITE.description}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <MacDownloadActions />
          <GithubLink />
        </div>
        <div className="mt-14">
          <ProductWindow />
          <p className="mx-auto mt-5 max-w-xl text-center text-[13px] leading-relaxed text-muted-foreground">
            Agents stay in the terminal. Running work pulses quietly. Needs input waits until you answer.
          </p>
        </div>
      </div>
    </section>
  );
}
