/** Short, evocative names for new terminals — avoids bland "Terminal 1". */
const NAMES = [
  "Nebula",
  "Quasar",
  "Cascade",
  "Ember",
  "Drift",
  "Apex",
  "Zenith",
  "Comet",
  "Harbor",
  "Loom",
  "Prism",
  "Flux",
  "Orbit",
  "Cipher",
  "Meridian",
  "Atlas",
  "Cobalt",
  "Verdant",
  "Solstice",
  "Mirage",
  "Nimbus",
  "Pulse",
  "Vector",
  "Aurora",
  "Kiln",
  "Spire",
  "Rift",
  "Tide",
  "Glyph",
  "Nova",
  "Echo",
  "Forge",
  "Lattice",
  "Monad",
  "Oxide",
  "Pinnacle",
  "Quartz",
  "Relay",
  "Sable",
  "Tempest",
  "Umbra",
  "Vesper",
  "Willow",
  "Zephyr",
  "Beacon",
  "Canyon",
  "Delta",
  "Fathom",
  "Glacier",
  "Helix",
] as const;

function shuffle<T>(items: T[]): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

/** Pick a random interesting name, preferring ones not already in use. */
export function randomTerminalName(existing: Iterable<string> = []): string {
  const taken = new Set([...existing].map((n) => n.toLowerCase()));
  for (const name of shuffle([...NAMES])) {
    if (!taken.has(name.toLowerCase())) return name;
  }
  const base = NAMES[Math.floor(Math.random() * NAMES.length)];
  let n = 2;
  while (taken.has(`${base} ${n}`.toLowerCase())) n += 1;
  return `${base} ${n}`;
}
