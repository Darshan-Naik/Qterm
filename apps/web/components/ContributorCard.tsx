import type { Contributor } from "@/lib/contributors";
import { shortMonth } from "@/lib/contributor-present.mjs";

export function ContributorCard({ person }: { person: Contributor }) {
  const since = shortMonth(person.firstContribution);
  const name = person.name || person.username;
  return (
    <article className="flex h-full flex-col rounded-2xl border border-white/8 bg-card/80 p-6">
      <a href={person.profileUrl} className="group flex items-center gap-4">
        <img
          src={person.avatarUrl}
          alt=""
          width={64}
          height={64}
          loading="lazy"
          className="h-16 w-16 rounded-full bg-white/5 object-cover ring-1 ring-white/10"
        />
        <span>
          <span className="block text-[16px] font-medium tracking-tight group-hover:underline">{name}</span>
          <span className="mt-1 block text-[13px] text-muted-foreground">@{person.username}</span>
          <span className="mt-1 block text-[13px] text-muted-foreground">
            {since ? `With us since ${since}` : "With us"}
          </span>
        </span>
      </a>
      {person.badges.length > 0 ? (
        <p className="mt-5 flex flex-wrap gap-x-3 gap-y-1 text-[14px] leading-relaxed text-foreground/90">
          {person.badges.map((badge) => (
            <span key={badge.id}>
              {badge.emoji} {badge.label}
            </span>
          ))}
        </p>
      ) : null}
    </article>
  );
}
