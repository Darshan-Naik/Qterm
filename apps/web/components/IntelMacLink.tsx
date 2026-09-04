export function IntelMacLink({ href }: { href: string }) {
  return (
    <a
      href={href}
      className="text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      Intel Mac
    </a>
  );
}
