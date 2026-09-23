import { getContributorData } from "@/lib/contributor-data";
import { rankedContributors, visibleContributors } from "@/lib/contributor-present.mjs";
import type { Contributor } from "@/lib/contributors";
import { ContributorGlance } from "./ContributorGlance";

async function glancePeople() {
  try {
    const data = await getContributorData();
    const maintainers = data.maintainers ?? [];
    const people = rankedContributors(visibleContributors(data)) as Contributor[];
    return [...maintainers, ...people].map((person) => ({
      username: person.username,
      name: person.name,
      avatarUrl: person.avatarUrl,
      profileUrl: person.profileUrl,
    }));
  } catch {
    return [];
  }
}

export async function ContributorGlanceSection() {
  const people = await glancePeople();
  if (people.length === 0) return null;
  return (
    <section className="border-t border-white/6 py-16">
      <div className="mx-auto max-w-6xl px-5">
        <ContributorGlance people={people} />
      </div>
    </section>
  );
}
