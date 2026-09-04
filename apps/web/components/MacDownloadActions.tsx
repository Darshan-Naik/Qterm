import { getMacDownloads } from "@/lib/releases";
import { cn } from "@/lib/cn";
import { DownloadButton } from "./DownloadButton";
import { IntelMacLink } from "./IntelMacLink";

export async function MacDownloadActions({
  className,
  buttonClassName,
  showIntel = true,
}: {
  className?: string;
  buttonClassName?: string;
  showIntel?: boolean;
}) {
  const downloads = await getMacDownloads();
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <DownloadButton href={downloads.arm64} className={buttonClassName} />
      {showIntel && downloads.amd64 ? <IntelMacLink href={downloads.amd64} /> : null}
    </div>
  );
}
