import Link from "next/link";
import { contributorPath, type Contributor } from "@/lib/contributors";
import { shortMonth } from "@/lib/contributor-present.mjs";

export function ContributorCard({ person }: { person: Contributor }) {
  const since = shortMonth(person.firstContribution);
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
          <span className="block text-[16px] font-medium tracking-tight group-hover:underline">@{person.username}</span>
          <span className="mt-1 block text-[13px] text-muted-foreground">
            Qterm family{since ? ` since ${since}` : ""}
          </span>
        </span>
      </a>
      {person.badges.length > 0 ? (
        <ul className="mt-5 flex flex-wrap gap-2">
          {person.badges.map((badge) => (
            <li
              key={badge.id}
              className="rounded-full border border-white/10 bg-white/4 px-2.5 py-1 text-[12px] text-foreground/90"
            >
              {badge.emoji} {badge.label}
            </li>
          ))}
        </ul>
      ) : null}
      <Link
        href={contributorPath(person.username)}
        className="mt-5 text-[13px] text-muted-foreground transition hover:text-foreground"
      >
        Contribution card
      </Link>
    </article>
  );
}
