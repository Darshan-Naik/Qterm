import type { Metadata } from "next";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";
import { ContributorCard } from "@/components/ContributorCard";
import { MaintainerCard } from "@/components/MaintainerCard";
import { visibleContributors } from "@/lib/contributor-present.mjs";
import { CONTRIBUTOR_CACHE_SECONDS, getContributorData } from "@/lib/contributor-data";
import type { Contributor, ContributorData } from "@/lib/contributors";
import { pageMeta } from "@/lib/seo";
import { SITE } from "@/lib/site";

const title = "Contributors";
const description =
  "Qterm is built by people who care about making the terminal better. Every contribution matters: code, documentation, testing, ideas, feedback, and more.";
const path = "/contributors";
const crumbs = [
  { href: "/", label: "Qterm" },
  { href: path, label: "Contributors" },
];

export const metadata: Metadata = pageMeta({ title, description, path });
export const revalidate = CONTRIBUTOR_CACHE_SECONDS;

export default async function ContributorsPage() {
  let data: ContributorData | null = null;
  try {
    data = await getContributorData();
  } catch {
    data = null;
  }
  const maintainers = data?.maintainers ?? [];
  const people = (data ? visibleContributors(data) : []) as Contributor[];
  const unavailable = data == null;

  return (
    <main>
      <header className="mx-auto max-w-6xl px-5 pb-8 pt-16 sm:pt-20">
        <BreadcrumbNav items={crumbs} />
        <h1 className="max-w-3xl text-[36px] font-semibold leading-[1.08] tracking-tight sm:text-[48px]">The people behind Qterm</h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-muted-foreground sm:text-[18px]">{description}</p>
      </header>
      <section className="mx-auto max-w-6xl px-5 pb-20">
        {maintainers.length > 0 ? (
          <div className="mb-8 flex flex-col gap-4">
            {maintainers.map((person) => (
              <MaintainerCard key={person.username.toLowerCase()} person={person} />
            ))}
          </div>
        ) : null}
        {unavailable ? (
          <div className="rounded-2xl border border-white/8 bg-card/80 px-6 py-10">
            <p className="text-[16px] text-foreground">The list is taking a break.</p>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
              GitHub did not answer just now. The people will show up here when it does.
            </p>
          </div>
        ) : people.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-card/80 px-6 py-10">
            <p className="text-[16px] text-foreground">No one has landed here yet.</p>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
              When a pull request merges, that person shows up on this page.
            </p>
            <p className="mt-6 text-[14px]">
              <a className="underline-offset-4 hover:underline" href={`${SITE.github}/blob/main/CONTRIBUTING.md`}>
                Come build with us
              </a>
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {people.map((person) => (
              <ContributorCard key={person.username.toLowerCase()} person={person} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
