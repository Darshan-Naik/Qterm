import { getMacDownloads } from "@/lib/releases";
import { cn } from "@/lib/cn";
import { DownloadButton } from "./DownloadButton";

export async function MacDownloadActions({
  className,
  buttonClassName,
}: {
  className?: string;
  buttonClassName?: string;
}) {
  const downloads = await getMacDownloads();
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <DownloadButton href={downloads.dmg} className={buttonClassName} />
    </div>
  );
}
