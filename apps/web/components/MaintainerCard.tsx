import type { Maintainer } from "@/lib/contributors";
import { ProfileLinks } from "./ProfileLinks";

export function MaintainerCard({ person }: { person: Maintainer }) {
  const name = person.name || person.username;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-card">
      <div className="flex flex-1 flex-col gap-6 px-6 py-8 sm:flex-row sm:items-center sm:gap-8 sm:px-10 sm:py-10">
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
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-primary">Maintainer</p>
          <a href={person.profileUrl} className="mt-2 block text-[28px] font-semibold tracking-tight hover:underline sm:text-[36px]">
            {name}
          </a>
          <p className="mt-1 text-[14px] text-muted-foreground">@{person.username}</p>
          <ProfileLinks blog={person.blog} twitter={person.twitter} />
        </div>
      </div>
    </article>
  );
}
