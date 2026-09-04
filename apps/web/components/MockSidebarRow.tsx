export function MockSidebarRow({
  label,
  active,
  indent = false,
  pulse = false,
}: {
  label: string;
  active?: boolean;
  indent?: boolean;
  pulse?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-md px-2 py-1 text-[12px] ${
        active ? "bg-white/8 text-foreground" : "text-muted-foreground"
      } ${indent ? "ml-3" : ""}`}
    >
      <span
        className={`size-1.5 rounded-full ${pulse ? "bg-amber-400" : active ? "bg-emerald-400" : "bg-white/25"}`}
      />
      {label}
    </div>
  );
}
