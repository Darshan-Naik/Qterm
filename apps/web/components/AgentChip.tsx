export function AgentChip({ name, src }: { name: string; src: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-full border border-white/10 bg-white/4 px-3.5 py-2 text-[13px] font-medium">
      <img src={src} alt="" width={18} height={18} className="size-[18px] rounded-[4px] object-contain" />
      {name}
    </div>
  );
}
