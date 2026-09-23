/**
 * Rebuild apps/web/data/contributors.json from merged pull requests.
 * Writes the file only when contributor data changed.
 */
import fs from "node:fs";
import path from "node:path";
import { contributorDataPath, loadConfig } from "./config.mjs";
import { fetchMaintainerProfiles, listMergedPulls } from "./github.mjs";
import { aggregateContributors, comparablePayload } from "./model.mjs";

export async function syncContributors({
  repo,
  config = loadConfig(),
  dryRun = false,
  listPulls = listMergedPulls,
  fetchMaintainers = fetchMaintainerProfiles,
  now = new Date(),
  outputPath = contributorDataPath,
} = {}) {
  const history = await listPulls(repo);
  if (!history.complete) {
    throw new Error("GitHub returned a partial pull request history. Refusing to publish incomplete contributor data.");
  }
  const maintainers = await fetchMaintainers(repo, config);
  const next = aggregateContributors(history.pulls, config, { generatedAt: now.toISOString() });
  next.maintainers = maintainers;
  const previous = readExisting(outputPath);
  if (previous && comparablePayload(previous) === comparablePayload(next)) {
    return { changed: false, data: previous };
  }
  if (!dryRun) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, `${JSON.stringify(next, null, 2)}\n`);
  }
  return { changed: true, data: next };
}

function readExisting(outputPath) {
  if (!fs.existsSync(outputPath)) return null;
  return JSON.parse(fs.readFileSync(outputPath, "utf8"));
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY || loadConfig().repo;
  const result = await syncContributors({ repo, dryRun: process.env.DRY_RUN === "1" });
  if (result.changed) console.log(`Updated contributor data for ${result.data.stats.contributors} people.`);
  else console.log("Contributor data is already up to date.");
}

const invoked = process.argv[1] && process.argv[1].endsWith("sync.mjs");
if (invoked) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}
