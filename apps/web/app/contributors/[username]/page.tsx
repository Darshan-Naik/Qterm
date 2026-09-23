import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";
import { CopyShareText } from "@/components/CopyShareText";
import { firstContributionShareText, monthYear, tweetIntentUrl } from "@/lib/contributor-present.mjs";
import { contributorCardPath, contributorData, findContributor, repoUrl } from "@/lib/contributors";
import { pageMeta } from "@/lib/seo";

type Params = { username: string };

export const dynamicParams = false;

export function generateStaticParams() {
  return contributorData().contributors.map((person) => ({ username: person.username }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { username } = await params;
  const person = findContributor(username);
  if (!person) return {};
  const first = person.mergedPRs <= 1;
  return pageMeta({
    title: `@${person.username}`,
    description: first
      ? `@${person.username} made a first contribution to Qterm in ${monthYear(person.firstContribution)}.`
      : `@${person.username} is a Qterm contributor since ${monthYear(person.firstContribution)}.`,
    path: `/contributors/${person.username}`,
  });
}

export default async function ContributorSharePage({ params }: { params: Promise<Params> }) {
  const { username } = await params;
  const person = findContributor(username);
  if (!person) notFound();

  const data = contributorData();
  const share = firstContributionShareText({ maintainer: data.maintainer, repoUrl: repoUrl(data) });
  const first = person.mergedPRs <= 1;
  const crumbs = [
    { href: "/", label: "Qterm" },
    { href: "/contributors", label: "Contributors" },
    { href: `/contributors/${person.username}`, label: `@${person.username}` },
  ];

  return (
    <main>
      <article className="mx-auto max-w-3xl px-5 pb-20 pt-16 sm:pt-20">
        <BreadcrumbNav items={crumbs} />
        <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Qterm</p>
        <h1 className="text-[36px] font-semibold leading-[1.08] tracking-tight sm:text-[48px]">
          {first ? "Welcome to the family" : "Thanks for building Qterm"}
        </h1>
        <p className="mt-4 text-[16px] text-muted-foreground">
          <a className="text-foreground underline-offset-4 hover:underline" href={person.profileUrl}>
            @{person.username}
          </a>
          {first ? " made a first contribution" : ` · ${person.mergedPRs} contributions`}
          {person.firstContribution ? ` · ${monthYear(person.firstContribution)}` : ""}
        </p>
        <img
          src={contributorCardPath(person.username)}
          alt={`Qterm contributor card for @${person.username}`}
          width={1200}
          height={630}
          className="mt-8 w-full rounded-2xl border border-white/10"
        />
        <div className="mt-4 flex flex-wrap gap-4 text-[13px]">
          <a className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" href={contributorCardPath(person.username)} download>
            Download SVG
          </a>
          <a
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            href={tweetIntentUrl(share)}
            target="_blank"
            rel="noreferrer"
          >
            Post on X
          </a>
          <Link className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" href="/contributors">
            All contributors
          </Link>
        </div>
        {first ? (
          <section className="mt-10">
            <h2 className="text-[18px] font-medium tracking-tight">Share text</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              Copy this if you want to tell people. Qterm will not post it for you.
            </p>
            <div className="mt-4">
              <CopyShareText text={share} />
            </div>
          </section>
        ) : null}
      </article>
    </main>
  );
}
