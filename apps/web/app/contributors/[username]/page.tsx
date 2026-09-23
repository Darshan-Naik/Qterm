import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BreadcrumbNav } from "@/components/BreadcrumbNav";
import { CopyShareText } from "@/components/CopyShareText";
import {
  contributorDisplayName,
  firstContributionShareText,
  monthYear,
  tweetIntentUrl,
} from "@/lib/contributor-present.mjs";
import { getContributorData } from "@/lib/contributor-data";
import { contributorCardPath, findContributor, repoUrl } from "@/lib/contributors";
import { pageMeta } from "@/lib/seo";

type Params = { username: string };

export const revalidate = 43200;

export async function generateStaticParams() {
  try {
    const data = await getContributorData();
    return data.contributors.map((person) => ({ username: person.username }));
  } catch {
    return [];
  }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { username } = await params;
  const data = await getContributorData().catch(() => null);
  const person = data ? findContributor(data, username) : null;
  if (!person) return {};
  const first = person.mergedPRs <= 1;
  const label = contributorDisplayName(person);
  return pageMeta({
    title: label,
    description: first
      ? `${label} made a first contribution to Qterm in ${monthYear(person.firstContribution)}.`
      : `${label} is a Qterm contributor since ${monthYear(person.firstContribution)}.`,
    path: `/contributors/${person.username}`,
  });
}

export default async function ContributorSharePage({ params }: { params: Promise<Params> }) {
  const { username } = await params;
  const data = await getContributorData().catch(() => null);
  const person = data ? findContributor(data, username) : null;
  if (!data || !person) notFound();
  const share = firstContributionShareText({ maintainer: data.maintainer, repoUrl: repoUrl(data) });
  const first = person.mergedPRs <= 1;
  const label = contributorDisplayName(person);
  const cardSrc = `${contributorCardPath(person.username)}?v=${encodeURIComponent(data.generatedAt || person.lastContribution)}`;
  const downloadName = `qterm-${person.username}.png`;
  const crumbs = [
    { href: "/", label: "Qterm" },
    { href: "/contributors", label: "Contributors" },
    { href: `/contributors/${person.username}`, label },
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
          <a className="text-foreground underline-offset-4 hover:underline" href={person.profileUrl} target="_blank" rel="noreferrer">
            {label}
          </a>
          {first ? " made a first contribution" : " is part of the Qterm family"}
          {person.firstContribution ? ` · ${monthYear(person.firstContribution)}` : ""}
        </p>
        <img
          src={cardSrc}
          alt={`Qterm contributor card for ${label}`}
          width={1200}
          height={630}
          className="mt-8 w-full rounded-2xl border border-white/10"
        />
        <div className="mt-4 flex flex-wrap gap-4 text-[13px]">
          <a
            className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            href={`${cardSrc}&download=1`}
            download={downloadName}
          >
            Save this
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
            See everyone
          </Link>
        </div>
        {first ? (
          <section className="mt-10">
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              If you feel like telling people, copy this and post it wherever you like.
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
