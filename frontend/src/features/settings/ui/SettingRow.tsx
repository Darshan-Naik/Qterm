import type { ReactNode } from "react";

export function SettingRow({
  title,
  description,
  control,
}: {
  title: ReactNode;
  description?: ReactNode;
  control: ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium leading-snug">{title}</div>
        {description && (
          <div className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{description}</div>
        )}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
