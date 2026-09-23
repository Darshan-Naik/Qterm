import type { Metadata } from "next";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";
import { ContributorCard } from "@/components/ContributorCard";
import { ContributorStats } from "@/components/ContributorStats";
import { contributorData } from "@/lib/contributors";
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

export default function ContributorsPage() {
  const data = contributorData();
  const people = data.contributors;

  return (
    <main>
      <header className="mx-auto max-w-6xl px-5 pb-8 pt-16 sm:pt-20">
        <BreadcrumbNav items={crumbs} />
        <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Community</p>
        <h1 className="max-w-3xl text-[36px] font-semibold leading-[1.08] tracking-tight sm:text-[48px]">Qterm Contributors</h1>
        <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-muted-foreground sm:text-[18px]">{description}</p>
      </header>
      <section className="mx-auto max-w-6xl px-5 pb-20">
        {people.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-card/80 px-6 py-10">
            <p className="text-[16px] text-foreground">No merged contributions are recorded yet.</p>
            <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
              The list updates when pull requests land. It is a welcome board, not a ranking.
            </p>
            <p className="mt-6 text-[14px]">
              <a className="underline-offset-4 hover:underline" href={`${SITE.github}/blob/main/CONTRIBUTING.md`}>
                Read the contributing guide
              </a>
            </p>
          </div>
        ) : (
          <>
            <ContributorStats stats={data.stats} />
            <p className="mt-4 text-[13px] text-muted-foreground">Most recent contribution first. This is not a ranking.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {people.map((person) => (
                <ContributorCard key={person.username.toLowerCase()} person={person} />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
