import { cn } from "@/lib/utils";

export function SessionFlowTitle({
  name,
  thinking,
  className,
  onDoubleClick,
}: {
  name: string;
  thinking?: boolean;
  className?: string;
  onDoubleClick?: (e: React.MouseEvent<HTMLSpanElement>) => void;
}) {
  return (
    <span
      className={cn("min-w-0 flex-1 truncate leading-5", thinking && "session-flow-title", className)}
      onDoubleClick={onDoubleClick}
    >
      {name}
    </span>
  );
}
