export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <img
      src="/icon.svg"
      alt=""
      width={size}
      height={size}
      className="rounded-[7px] shadow-sm ring-1 ring-white/10"
    />
  );
}
