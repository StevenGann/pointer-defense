#!/usr/bin/env node
/**
 * Report how complete each locale is against the English catalogue.
 *
 * Usage: npm run i18n:missing [-- --verbose]
 *
 * A locale file that does not exist yet reports every key as missing, which is the honest answer at
 * the start of a translation and the reason this is not a build failure: the game runs fine with a
 * partially translated catalogue because `t()` falls back to English per key.
 */
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const { en } = await import(join(root, 'src/i18n/en/index.ts'));
const { LOCALES } = await import(join(root, 'src/i18n/locales.ts'));
const englishKeys = Object.keys(en);

const verbose = process.argv.includes('--verbose');
let incomplete = 0;

for (const locale of LOCALES) {
  if (locale.code === 'en') continue;
  const path = join(root, 'src/i18n', locale.code, 'index.ts');
  if (!existsSync(path)) {
    incomplete += 1;
    console.log(`${locale.code.padEnd(8)} ${'0'.padStart(4)} / ${englishKeys.length}  (no catalogue yet)`);
    continue;
  }
  const mod = await import(path);
  const catalogue = mod[Object.keys(mod)[0]];
  const translated = englishKeys.filter((k) => typeof catalogue?.[k] === 'string' && catalogue[k] !== '');
  const missing = englishKeys.filter((k) => !translated.includes(k));
  if (missing.length > 0) incomplete += 1;
  const pct = ((translated.length / englishKeys.length) * 100).toFixed(1);
  console.log(
    `${locale.code.padEnd(8)} ${String(translated.length).padStart(4)} / ${englishKeys.length}  ${pct}%` +
      (locale.draft ? '  (draft)' : '') +
      (missing.length === 0 ? '  complete' : ''),
  );
  if (verbose && missing.length > 0) {
    for (const key of missing.slice(0, 40)) console.log(`    missing: ${key}`);
    if (missing.length > 40) console.log(`    ... and ${missing.length - 40} more`);
  }
}

console.log(
  incomplete === 0
    ? `\nall ${LOCALES.length} locales complete against ${englishKeys.length} keys`
    : `\n${incomplete} locale(s) incomplete against ${englishKeys.length} keys`,
);
// Reporting only: a missing string falls back to English, so this never fails the build.
process.exit(0);
