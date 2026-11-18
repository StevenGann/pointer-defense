#!/usr/bin/env node
// Copy the achievement placeholder to `public/art/achievements/<id>.svg` for every achievement id
// that does not already have a file. It never overwrites, so the artist can replace files one at a
// time and the next build keeps their work. Wired into `prebuild`/`predev` (before `art:manifest`
// scans the directory); `runAchArt` is exported so the smoke harness can assert idempotency on a
// throwaway directory.
//
// Usage:
//   node scripts/ach-art.mjs

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ACHIEVEMENTS } from '../src/core/achievements.ts';

const ART_DIR = fileURLToPath(new URL('../public/art', import.meta.url));

/** Copy the placeholder into every missing id file under `artDir`. Never overwrites. */
export function runAchArt(artDir = ART_DIR) {
  const achDir = join(artDir, 'achievements');
  const placeholder = join(achDir, '_placeholder.svg');
  if (!existsSync(placeholder)) {
    return { copied: 0, skipped: ACHIEVEMENTS.length, missingPlaceholder: true };
  }
  mkdirSync(achDir, { recursive: true });
  const svg = readFileSync(placeholder, 'utf8');
  let copied = 0;
  let skipped = 0;
  for (const a of ACHIEVEMENTS) {
    const file = join(achDir, `${a.id}.svg`);
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
  const { copied, skipped, missingPlaceholder } = runAchArt();
  if (missingPlaceholder) {
    console.warn('[ach-art] missing achievements/_placeholder.svg; no copies made');
  } else {
    console.log(`[ach-art] copied ${copied}, kept ${skipped} existing`);
  }
}
