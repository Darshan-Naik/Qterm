import sharp from "sharp";
import { renderContributorCard } from "@/lib/contributor-present.mjs";
import { CONTRIBUTOR_CACHE_SECONDS, getContributorData } from "@/lib/contributor-data";
import { findContributor } from "@/lib/contributors";

export const revalidate = 43200;
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ username: string }> }) {
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
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const download = new URL(request.url).searchParams.get("download") === "1";
  const filename = `qterm-${person.username}.png`;
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": `public, max-age=${CONTRIBUTOR_CACHE_SECONDS}`,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
