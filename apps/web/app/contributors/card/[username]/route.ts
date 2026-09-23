import { renderContributorCard } from "@/lib/contributor-present.mjs";
import { contributorData, findContributor } from "@/lib/contributors";

export async function GET(_request: Request, context: { params: Promise<{ username: string }> }) {
  const { username } = await context.params;
  if (!/^[A-Za-z0-9-]+$/.test(username)) {
    return new Response("Not found", { status: 404 });
  }
  const person = findContributor(username);
  if (!person) return new Response("Not found", { status: 404 });
  const svg = renderContributorCard({
    username: person.username,
    mergedPRs: person.mergedPRs,
    firstContribution: person.firstContribution,
    repoPath: contributorData().repo,
  });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
