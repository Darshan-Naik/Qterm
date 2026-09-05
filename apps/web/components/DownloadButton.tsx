"use client";

import { MAC_ASSET, SITE } from "@/lib/site";
import { cn } from "@/lib/cn";
import { trackCTA } from "@/lib/analytics";
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
      target="_blank"
      rel="noreferrer"
      onClick={() => {
        trackCTA("download_click");
        guide?.beginDownload();
      }}
      className={cn(
        "inline-flex items-center justify-center rounded-lg bg-foreground px-4 py-2.5 text-[14px] font-medium text-background transition hover:bg-white",
        className,
      )}
    >
      {children}
    </a>
  );
}
