import type { Maintainer } from "@/lib/contributors";

function siteLabel(blog: string) {
  try {
    return new URL(blog).host.replace(/^www\./, "");
  } catch {
    return blog;
  }
}

export function MaintainerCard({ person }: { person: Maintainer }) {
  const name = person.name || person.username;
  const company = person.company?.trim() || "";
  const companyName = company.replace(/^@/, "");
  const companyHref = company.startsWith("@") && companyName ? `https://github.com/${companyName}` : "";
  const twitter = person.twitter?.replace(/^@/, "") || "";

  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-card">
      <div className="h-1 bg-primary" />
      <div className="flex flex-col gap-6 px-6 py-8 sm:flex-row sm:items-center sm:gap-8 sm:px-10 sm:py-10">
        <a href={person.profileUrl} className="shrink-0">
          <img
            src={person.avatarUrl}
            alt=""
            width={112}
            height={112}
            className="h-28 w-28 rounded-full bg-white/5 object-cover ring-2 ring-white/15"
          />
        </a>
        <div className="min-w-0">
          <a href={person.profileUrl} className="text-[28px] font-semibold tracking-tight hover:underline sm:text-[36px]">
            {name}
          </a>
          <p className="mt-1 text-[14px] text-muted-foreground">@{person.username}</p>
          {person.bio ? <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-foreground/90">{person.bio}</p> : null}
          {company || person.location || person.blog || twitter ? (
            <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
              {person.location ? <span>{person.location}</span> : null}
              {company ? (
                companyHref ? (
                  <a className="underline-offset-4 hover:underline" href={companyHref}>
                    {companyName}
                  </a>
                ) : (
                  <span>{company}</span>
                )
              ) : null}
              {person.blog ? (
                <a className="underline-offset-4 hover:underline" href={person.blog}>
                  {siteLabel(person.blog)}
                </a>
              ) : null}
              {twitter ? (
                <a className="underline-offset-4 hover:underline" href={`https://x.com/${twitter}`}>
                  @{twitter}
                </a>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
