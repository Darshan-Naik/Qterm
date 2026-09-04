import { SITE } from "@/lib/site";
import { cn } from "@/lib/cn";

export function DownloadButton({
  className,
  children = "Download for Mac",
}: {
  className?: string;
  children?: string;
}) {
  return (
    <a
      href={SITE.releases}
      className={cn(
        "inline-flex items-center justify-center rounded-lg bg-foreground px-4 py-2.5 text-[14px] font-medium text-background transition hover:bg-white",
        className,
      )}
    >
      {children}
    </a>
  );
}
