/**
 * Release helpers.
 *
 *   node .github/scripts/contributors/release.mjs
 *     Appends a contributor section for pull requests merged since the previous release.
 */
import { loadConfig } from "./config.mjs";
import { ghJson, listMergedPulls } from "./github.mjs";
import { formatReleaseSection, pullsInRelease } from "./model.mjs";

export async function contributorReleaseNotes({
  repo,
  config = loadConfig(),
  now = Date.now(),
  listPulls = listMergedPulls,
  previousPublishedAt = null,
  currentTag = process.env.TAG || "",
} = {}) {
  const since = previousPublishedAt == null ? await previousReleaseTime(repo, currentTag) : previousPublishedAt;
  const history = await listPulls(repo);
  if (!history.complete) {
    throw new Error("Incomplete pull request history. Refusing to guess at release credits.");
  }
  const included = pullsInRelease(history.pulls, { since, until: now });
  return formatReleaseSection(included, config);
}

async function previousReleaseTime(repo, currentTag) {
  const releases = await ghJson(["api", `repos/${repo}/releases?per_page=20`]);
  if (!Array.isArray(releases)) return null;
  const published = releases.find(
    (release) =>
      !release.draft &&
      !release.prerelease &&
      release.published_at &&
      release.tag_name !== currentTag,
  );
  if (!published) return null;
  const time = Date.parse(published.published_at);
  return Number.isNaN(time) ? null : time;
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY || loadConfig().repo;
  const notes = await contributorReleaseNotes({ repo });
  if (notes) process.stdout.write(`\n${notes}`);
}

const invoked = process.argv[1] && process.argv[1].endsWith("release.mjs");
if (invoked) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}
