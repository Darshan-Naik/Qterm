import type { Contributor } from "@/lib/contributors";
import { ProfileLinks } from "./ProfileLinks";

export function ContributorCard({ person }: { person: Contributor }) {
  const name = person.name || person.username;
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-card">
      <div className="flex flex-1 flex-col px-6 py-8">
        <a href={person.profileUrl} target="_blank" rel="noreferrer" className="group flex items-center gap-4">
          <img
            src={person.avatarUrl}
            alt=""
            width={112}
            height={112}
            className="h-28 w-28 shrink-0 rounded-full bg-white/5 object-cover ring-2 ring-white/15"
          />
          <span className="min-w-0">
            <span className="block text-[28px] font-semibold tracking-tight group-hover:underline">{name}</span>
            <span className="mt-1 block text-[14px] text-muted-foreground">@{person.username}</span>
          </span>
        </a>
        <ProfileLinks blog={person.blog} twitter={person.twitter} />
        {person.badges.length > 0 ? (
          <p className="mt-5 flex flex-wrap gap-x-3 gap-y-1 text-[14px] leading-relaxed text-foreground/90">
            {person.badges.map((badge) => (
              <span key={badge.id}>
                {badge.emoji} {badge.label}
              </span>
            ))}
          </p>
        ) : null}
      </div>
    </article>
  );
}
