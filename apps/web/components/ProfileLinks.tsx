function siteLabel(blog: string) {
  try {
    return new URL(blog).host.replace(/^www\./, "");
  } catch {
    return blog;
  }
}

export function ProfileLinks({ blog, twitter }: { blog?: string; twitter?: string }) {
  const handle = twitter?.replace(/^@/, "") || "";
  if (!blog && !handle) return null;
  return (
    <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
      {blog ? (
        <a className="underline-offset-4 hover:underline" href={blog}>
          {siteLabel(blog)}
        </a>
      ) : null}
      {handle ? (
        <a className="underline-offset-4 hover:underline" href={`https://x.com/${handle}`}>
          @{handle}
        </a>
      ) : null}
    </p>
  );
}
