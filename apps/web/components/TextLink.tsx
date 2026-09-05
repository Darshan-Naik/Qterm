import Link from "next/link";

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-foreground underline-offset-4 hover:underline">
      {children}
    </Link>
  );
}
