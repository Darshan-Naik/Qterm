import Link from "next/link";
import { NAV, SITE } from "@/lib/site";
import { BrandMark } from "./BrandMark";
import { MacDownloadActions } from "./MacDownloadActions";

export async function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/6 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5 text-[15px] font-medium tracking-tight">
          <BrandMark size={26} />
          {SITE.name}
        </Link>
        <nav className="hidden items-center gap-7 text-[13px] text-muted-foreground sm:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="transition hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        <MacDownloadActions buttonClassName="h-8 px-3 py-0 text-[13px]" />
      </div>
    </header>
  );
}
