#!/usr/bin/env node
// Generate `public/art/manifest.json` from the SVG files on disk.
//
// An artist animates an asset by adding numbered siblings plus an optional JSON, with no TypeScript
// change. `grunt.svg` is frame 0 (the existing still); `grunt.1.svg`, `grunt.2.svg`, ... are frames
// 1 upward. `grunt.json` carries the animation metadata. This script is the single place that reads
// the directory and turns it into the manifest the runtime fetches; it is wired into `predev` and
// `prebuild` and is also exposed as `npm run art:manifest`.
//
// Validation errors fail the build with the offending path; warnings print and continue. See
// docs/ART-ANIMATION.md for the contract and the exact messages.
//
// Usage:
//   node scripts/art-manifest.mjs            # scan and write public/art/manifest.json

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ART_DIR = fileURLToPath(new URL('../public/art', import.meta.url));
const MANIFEST_FILE = join(ART_DIR, 'manifest.json');

const VALID_LOOPS = new Set(['loop', 'pingpong', 'once', 'hold0']);
const VALID_WHEN = new Set(['always', 'moving']);
const KNOWN_KEYS = new Set(['fps', 'loop', 'hold', 'holdAfter', 'randomStart', 'when']);

const DEFAULTS = { fps: 8, loop: 'loop', hold: 0, holdAfter: 0, randomStart: true, when: 'always' };

/** `enemies/grunt.3.svg` -> `{ base: 'enemies/grunt', frame: 3 }`, or null for a non-frame file. */
function parseFrame(rel) {
  const m = /^(.*)\.(\d+)\.svg$/.exec(rel);
  if (m) return { base: m[1], frame: Number(m[2]) };
  return null;
}

/** A relative path with forward slashes and no `.svg` suffix. */
function baseName(rel) {
  return rel.replace(/\.svg$/, '');
}

/** Recursively list every file under `dir`, as slash-separated paths relative to `dir`. */
function walk(dir) {
  const out = [];
  const visit = (d, rel) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const r = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) visit(join(d, entry.name), r);
      else out.push(r);
    }
  };
  visit(dir, '');
  return out;
}

/** Read and validate an asset's `.json`; returns `{ anim }` or null, pushing errors/warnings. */
function readMetadata(artDir, base, pushError, pushWarning) {
  const jsonPath = join(artDir, `${base}.json`);
  if (!existsSync(jsonPath)) return null;

  let raw;
  try {
    raw = JSON.parse(readFileSync(jsonPath, 'utf8'));
  } catch (err) {
    pushError(`${base}.json: not valid JSON (${err.message})`);
    return null;
  }

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    pushError(`${base}.json: the top level must be an object`);
    return null;
  }

  for (const key of Object.keys(raw)) {
    if (!KNOWN_KEYS.has(key)) pushWarning(`${base}.json: unknown key "${key}" ignored`);
  }

  const nonNegative = (key) => {
    const v = raw[key];
    if (v === undefined) return DEFAULTS[key];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
      pushError(`${base}.json: ${key} must be a number >= 0 (got ${JSON.stringify(v)})`);
      return DEFAULTS[key];
    }
    return v;
  };

  let fps = DEFAULTS.fps;
  if (raw.fps !== undefined) {
    if (typeof raw.fps !== 'number' || !Number.isInteger(raw.fps) || raw.fps < 1 || raw.fps > 60) {
      pushError(`${base}.json: fps must be a whole number 1-60 (got ${JSON.stringify(raw.fps)})`);
    } else {
      fps = raw.fps;
    }
  }

  let loop = DEFAULTS.loop;
  if (raw.loop !== undefined) {
    if (!VALID_LOOPS.has(raw.loop)) {
      pushError(`${base}.json: loop must be one of loop, pingpong, once, hold0 (got ${JSON.stringify(raw.loop)})`);
    } else {
      loop = raw.loop;
    }
  }

  let randomStart = DEFAULTS.randomStart;
  if (raw.randomStart !== undefined) {
    if (typeof raw.randomStart !== 'boolean') {
      pushError(`${base}.json: randomStart must be true or false (got ${JSON.stringify(raw.randomStart)})`);
    } else {
      randomStart = raw.randomStart;
    }
  }

  let when = DEFAULTS.when;
  if (raw.when !== undefined) {
    if (!VALID_WHEN.has(raw.when)) {
      pushError(`${base}.json: when must be "always" or "moving" (got ${JSON.stringify(raw.when)})`);
    } else {
      when = raw.when;
    }
  }

  return {
    anim: {
      fps,
      loop,
      hold: nonNegative('hold'),
      holdAfter: nonNegative('holdAfter'),
      randomStart,
      when,
    },
  };
}

/**
 * Scan `artDir` and return `{ assets, warnings, errors }`. `assets` is a sorted list of
 * `{ name, frames, anim? }`; a still is `frames: 1` with no `anim`, an animation is `frames >= 2`
 * with a fully-defaulted `anim`.
 */
export function scanArt(artDir = ART_DIR) {
  const errors = [];
  const warnings = [];
  const files = walk(artDir);

  const framesByBase = new Map(); // base (no ext) -> Set of frame numbers (0 is the base file)

  for (const rel of files) {
    if (!rel.endsWith('.svg')) continue;

    const parsed = parseFrame(rel);
    if (parsed === null) {
      const base = baseName(rel);
      if (!framesByBase.has(base)) framesByBase.set(base, new Set());
      framesByBase.get(base).add(0);
      continue;
    }

    const { base, frame } = parsed;
    if (frame === 0) {
      warnings.push(`${rel}: ".0" frames are not used — rename to ${base}.svg`);
      continue;
    }
    if (!framesByBase.has(base)) framesByBase.set(base, new Set());
    framesByBase.get(base).add(frame);
  }

  const assets = [];
  for (const base of [...framesByBase.keys()].sort()) {
    const frames = framesByBase.get(base);
    const max = Math.max(...frames);

    // A numbered frame with no base file is a dangling sibling, not an animation.
    if (!frames.has(0)) {
      errors.push(`${base}: numbered frames present but ${base}.svg (frame 0) is missing`);
      continue;
    }

    // Frames must be contiguous from 1.
    for (let i = 1; i <= max; i++) {
      if (!frames.has(i)) {
        errors.push(`${base}: numbered frames must be contiguous from 1 (missing ${base}.${i}.svg)`);
      }
    }
    if (errors.some((e) => e.startsWith(`${base}:`))) continue;

    const count = max + 1; // frame 0 plus 1..max

    if (count === 1) {
      // A JSON with no numbered frames cannot animate: ignore it without parsing its contents, so a
      // still's notes never fail the build.
      if (existsSync(join(artDir, `${base}.json`))) {
        warnings.push(`${base}.json: animation metadata ignored (${base}.svg has no numbered frames)`);
      }
      assets.push({ name: base, frames: 1 });
      continue;
    }

    const meta = readMetadata(artDir, base, (msg) => errors.push(msg), (msg) => warnings.push(msg));
    assets.push({ name: base, frames: count, anim: meta ? meta.anim : { ...DEFAULTS } });
  }

  return { assets, warnings, errors };
}

function writeManifest(artDir) {
  const { assets, warnings, errors } = scanArt(artDir);

  for (const w of warnings) console.warn(`[art] warning: ${w}`);
  for (const e of errors) console.error(`[art] error: ${e}`);

  if (errors.length > 0) {
    console.error(`[art] manifest not written: ${errors.length} validation error(s)`);
    process.exit(1);
  }

  writeFileSync(MANIFEST_FILE, `${JSON.stringify({ assets }, null, 2)}\n`);
  console.log(`[art] wrote manifest.json (${assets.length} assets)`);
}

const invoked = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (invoked) writeManifest(ART_DIR);
