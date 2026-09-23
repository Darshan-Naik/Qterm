import { renderContributorCard } from "@/lib/contributor-present.mjs";
import { CONTRIBUTOR_CACHE_SECONDS, getContributorData } from "@/lib/contributor-data";
import { findContributor } from "@/lib/contributors";

export const revalidate = 43200;

export async function GET(_request: Request, context: { params: Promise<{ username: string }> }) {
  const { username } = await context.params;
  if (!/^[A-Za-z0-9-]+$/.test(username)) {
    return new Response("Not found", { status: 404 });
  }
  const data = await getContributorData().catch(() => null);
  const person = data ? findContributor(data, username) : null;
  if (!data || !person) return new Response("Not found", { status: 404 });
  const svg = renderContributorCard({
    username: person.username,
    name: person.name,
    mergedPRs: person.mergedPRs,
    firstContribution: person.firstContribution,
    repoPath: data.repo,
  });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": `public, max-age=${CONTRIBUTOR_CACHE_SECONDS}`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
