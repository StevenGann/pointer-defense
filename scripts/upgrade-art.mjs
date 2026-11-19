#!/usr/bin/env node
// Copy the global-upgrade placeholder to `public/art/upgrades/<id>.svg` for every upgrade id that
// does not already have a file (docs/GLOBAL-UPGRADES.md §7). It never overwrites, so the artist can
// replace files one at a time and the next build keeps their work. Wired into `prebuild`/`predev`
// (before `art:manifest` scans the directory); `runUpgradeArt` is exported so the smoke harness can
// assert idempotency on a throwaway directory. Mirrors `ach-art.mjs`.
//
// Usage:
//   node scripts/upgrade-art.mjs

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLOBAL_UPGRADES } from '../src/core/upgrades.ts';

const ART_DIR = fileURLToPath(new URL('../public/art', import.meta.url));

/** Copy the placeholder into every missing id file under `artDir`. Never overwrites. */
export function runUpgradeArt(artDir = ART_DIR) {
  const dir = join(artDir, 'upgrades');
  const placeholder = join(dir, '_upgrade-placeholder.svg');
  if (!existsSync(placeholder)) {
    return { copied: 0, skipped: GLOBAL_UPGRADES.length, missingPlaceholder: true };
  }
  mkdirSync(dir, { recursive: true });
  const svg = readFileSync(placeholder, 'utf8');
  let copied = 0;
  let skipped = 0;
  for (const u of GLOBAL_UPGRADES) {
    const file = join(dir, `${u.id}.svg`);
    if (existsSync(file)) {
      skipped++;
      continue;
    }
    writeFileSync(file, svg);
    copied++;
  }
  return { copied, skipped, missingPlaceholder: false };
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invoked) {
  const { copied, skipped, missingPlaceholder } = runUpgradeArt();
  if (missingPlaceholder) {
    console.warn('[upgrade-art] missing upgrades/_upgrade-placeholder.svg; no copies made');
  } else {
    console.log(`[upgrade-art] copied ${copied}, kept ${skipped} existing`);
  }
}
