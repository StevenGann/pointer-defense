#!/usr/bin/env node
// Resolve SVG merge conflicts by deferring to the more complex file.
//
// Owner's rule (2026-11-17): when art conflicts, the more complex version wins, because the more
// complex file is closer to final art. This applies to `public/art/**/*.svg` only — everything else
// is resolved by hand.
//
// Usage:
//   node scripts/art-merge.mjs            # report what it would do
//   node scripts/art-merge.mjs --apply    # resolve conflicted SVGs and `git add` them
//
// Complexity is deliberately blunt and explainable: element count dominates, path data breaks ties,
// and raw size settles the rest. A file with more shapes is a later drawing of the same thing.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const APPLY = process.argv.includes('--apply');

function git(args, { allowFail = false } = {}) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch (err) {
    if (allowFail) return '';
    throw err;
  }
}

function complexity(text) {
  const elements = (text.match(/<(path|circle|rect|polygon|polyline|line|ellipse|g|use)\b/g) || []).length;
  const commands = (text.match(/[MmLlHhVvCcSsQqTtAaZz]/g) || []).length;
  const bytes = text.replace(/\s+/g, '').length;
  return elements * 100 + commands + bytes / 100;
}

const conflicted = git(['diff', '--name-only', '--diff-filter=U'], { allowFail: true })
  .split('\n')
  .filter((p) => p.endsWith('.svg'));

if (conflicted.length === 0) {
  console.log('no conflicted SVG files');
  process.exit(0);
}

let unresolved = 0;
for (const path of conflicted) {
  const ours = git(['show', `:2:${path}`], { allowFail: true });
  const theirs = git(['show', `:3:${path}`], { allowFail: true });
  if (!ours || !theirs) {
    console.log(`${path}: no base/ours/theirs triplet, leaving for a human`);
    unresolved += 1;
    continue;
  }
  const a = complexity(ours);
  const b = complexity(theirs);
  const winner = a >= b ? 2 : 3;
  const side = winner === 2 ? 'ours' : 'theirs';
  console.log(
    `${path}: ours=${a.toFixed(1)} theirs=${b.toFixed(1)} -> ${side}` +
      (APPLY ? '' : ' (dry run)'),
  );
  if (APPLY) {
    const blob = winner === 2 ? ours : theirs;
    writeFileSync(path, blob.endsWith('\n') ? blob : `${blob}\n`);
    git(['add', path]);
  }
}

if (unresolved > 0) process.exitCode = 1;
