/**
 * Create contributor labels that do not exist yet.
 * Never edits a label a maintainer already created or renamed.
 */
import { loadConfig } from "./config.mjs";
import { createLabel, listLabels } from "./github.mjs";

export async function ensureLabels({ repo, config = loadConfig(), list = listLabels, create = createLabel } = {}) {
  const existing = await list(repo);
  const names = new Set(existing.map((label) => String(label.name || "").toLowerCase()));
  const created = [];
  for (const label of config.labels) {
    if (names.has(label.name.toLowerCase())) {
      console.log(`Keeping label ${label.name}`);
      continue;
    }
    await create(repo, label);
    created.push(label.name);
    console.log(`Created label ${label.name}`);
  }
  return created;
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY || loadConfig().repo;
  const created = await ensureLabels({ repo });
  console.log(created.length ? `Created ${created.length} label(s).` : "Labels already exist.");
}

const invoked = process.argv[1] && process.argv[1].endsWith("labels.mjs");
if (invoked) {
  main().catch((error) => {
    console.error(error.message || error);
    process.exit(1);
  });
}
