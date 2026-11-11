import { cn } from "@/lib/utils";

export function SessionFlowTitle({
  name,
  className,
  onDoubleClick,
}: {
  name: string;
  className?: string;
  onDoubleClick?: (e: React.MouseEvent<HTMLSpanElement>) => void;
}) {
  return (
    <span className={cn("min-w-0 flex-1 truncate leading-5", className)} onDoubleClick={onDoubleClick}>
      {name}
    </span>
  );
}
