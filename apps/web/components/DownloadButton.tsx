"use client";

import { MAC_ASSET, SITE } from "@/lib/site";
import { cn } from "@/lib/cn";
import { useDownloadGuide } from "./DownloadGuide";

export function DownloadButton({
  href,
  className,
  children = "Download for Mac",
}: {
  href?: string;
  className?: string;
  children?: string;
}) {
  const guide = useDownloadGuide();
  return (
    <a
      href={href || SITE.releases}
      download={MAC_ASSET}
      onClick={() => guide?.beginDownload()}
      className={cn(
        "inline-flex items-center justify-center rounded-lg bg-foreground px-4 py-2.5 text-[14px] font-medium text-background transition hover:bg-white",
        className,
      )}
    >
      {children}
    </a>
  );
}
