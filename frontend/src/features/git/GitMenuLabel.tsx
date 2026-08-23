export function GitMenuLabel({ branch }: { branch?: string }) {
  const name = branch?.trim();
  if (!name) return "Git";
  return (
    <>
      Git
      <span className="min-w-0 truncate text-muted-foreground">{name}</span>
    </>
  );
}
