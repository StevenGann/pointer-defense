// Enforce the localisation catalogue stays the source of truth (docs/LOCALIZATION.md §Enforcement).
//
//   npm run i18n:check
//
// Scans `src/view`, `src/input` and `src/main.ts` for quoted or template prose that does not go
// through `t()`. A checked-in baseline file lists the modules that have not been migrated yet; the
// checker fails when a migrated module (one absent from the baseline) regains a bare string, and when
// the baseline lists a module that is now clean (so the baseline shrinks module by module until it
// is empty). It prints a per-module count either way.
//
// The scan is intentionally a small, dependency-free tokeniser rather than a full JS parser: it has
// to run in CI and inside the smoke harness, and the subset of syntax that matters here is small.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** The directories and files the enforcement scan covers. */
export const SCAN_PATHS = ['src/view', 'src/input', 'src/main.ts'];

/** The default checked-in baseline, relative to the repo root. */
export const BASELINE_PATH = 'scripts/i18n-baseline.json';

// ---------------------------------------------------------------------------------------------
// Tokenising

function tokenize(source) {
  const tokens = [];
  let i = 0;
  const n = source.length;
  while (i < n) {
    const c = source[i];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
      i++;
      continue;
    }
    if (c === '/' && source[i + 1] === '/') {
      while (i < n && source[i] !== '\n') i++;
      continue;
    }
    if (c === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < n && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      const quote = c;
      const start = i;
      i++;
      let value = '';
      let closed = false;
      while (i < n) {
        const ch = source[i];
        if (ch === '\\') {
          value += ch + (source[i + 1] ?? '');
          i += 2;
          continue;
        }
        if (ch === quote) {
          closed = true;
          i++;
          break;
        }
        value += ch;
        i++;
      }
      tokens.push({ type: quote === '`' ? 'tpl' : 'str', value, start, end: i, closed });
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      const start = i;
      while (i < n && /[A-Za-z0-9_$]/.test(source[i])) i++;
      tokens.push({ type: 'ident', value: source.slice(start, i), start, end: i });
      continue;
    }
    tokens.push({ type: 'punct', value: c, start: i, end: i + 1 });
    i++;
  }
  return tokens;
}

// ---------------------------------------------------------------------------------------------
// Classification

/** The start offsets of string/template literals that are direct arguments to `t(` or `plural(`. */
function catalogueReferences(tokens) {
  const refs = new Set();
  for (let k = 0; k < tokens.length; k++) {
    const tok = tokens[k];
    if (tok.type !== 'ident' || (tok.value !== 't' && tok.value !== 'plural')) continue;
    const open = tokens[k + 1];
    if (!open || open.type !== 'punct' || open.value !== '(') continue;
    let depth = 0;
    for (let j = k + 2; j < tokens.length; j++) {
      const t = tokens[j];
      if (t.type === 'punct' && t.value === '(') {
        depth++;
      } else if (t.type === 'punct' && t.value === ')') {
        if (depth === 0) break;
        depth--;
      } else if (depth === 0 && (t.type === 'str' || t.type === 'tpl')) {
        refs.add(t.start);
      }
    }
  }
  return refs;
}

/** Whether a literal's content reads as user-facing prose rather than an id, key or asset name. */
export function isProse(text) {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;
  if (!/[A-Za-z]/.test(trimmed)) return false;
  // A space or sentence punctuation marks a phrase.
  if (/[\s.!?:;,—·…]/.test(trimmed)) return true;
  // A lone title-cased or all-caps word is a UI label ('File', 'Ready', 'CHEATS').
  if (/^[A-Z][A-Za-z'’-]*$/.test(trimmed)) return true;
  return false;
}

/** The start offsets of module specifiers (`import ... from 'x'`, `import 'x'`, `export ... from 'x'`). */
function moduleSpecifiers(tokens) {
  const set = new Set();
  for (let k = 1; k < tokens.length; k++) {
    const prev = tokens[k - 1];
    if (prev.type === 'ident' && (prev.value === 'from' || prev.value === 'import')) {
      const cur = tokens[k];
      if (cur.type === 'str' || cur.type === 'tpl') set.add(cur.start);
    }
  }
  return set;
}

/** Every bare (non-catalogue) prose literal in one source file, in order. */
export function scanSource(source) {
  const tokens = tokenize(source);
  const refs = catalogueReferences(tokens);
  const specs = moduleSpecifiers(tokens);
  const bare = [];
  for (const tok of tokens) {
    if ((tok.type !== 'str' && tok.type !== 'tpl') || refs.has(tok.start) || specs.has(tok.start)) continue;
    if (isProse(tok.value)) bare.push(tok.value);
  }
  return bare;
}

/** The catalogue keys referenced via `t('key')` / `t("key")` (no interpolation), in order. */
export function extractTKeys(source) {
  const tokens = tokenize(source);
  const keys = [];
  for (let k = 0; k < tokens.length; k++) {
    const tok = tokens[k];
    if (tok.type !== 'ident' || tok.value !== 't') continue;
    const open = tokens[k + 1];
    if (!open || open.type !== 'punct' || open.value !== '(') continue;
    const arg = tokens[k + 2];
    if (arg && arg.type === 'str') keys.push(arg.value);
    else if (arg && arg.type === 'tpl' && !arg.value.includes('${')) keys.push(arg.value);
  }
  return keys;
}

/** The keys declared in `src/i18n/en.ts`, from the `'key': value,` lines. */
export function parseCatalogueKeys(source) {
  const keys = [];
  const re = /^\s*'([^']+)'\s*:/gm;
  let m;
  while ((m = re.exec(source)) !== null) keys.push(m[1]);
  return keys;
}

// ---------------------------------------------------------------------------------------------
// Filesystem scanning

function readTsFile(absPath) {
  return readFileSync(absPath, 'utf8');
}

function tsFilesUnder(absDir) {
  const out = [];
  for (const entry of readdirSync(absDir, { withFileTypes: true })) {
    const p = join(absDir, entry.name);
    if (entry.isDirectory()) out.push(...tsFilesUnder(p));
    else if (entry.name.endsWith('.ts')) out.push(p);
  }
  return out;
}

/** Walk the checker's scan roots, returning a map of repo-relative path -> bare prose literals. */
export function scanRoots() {
  const files = [];
  for (const rel of SCAN_PATHS) {
    const abs = join(ROOT, rel);
    if (!existsSync(abs)) continue;
    if (rel.endsWith('.ts')) files.push(abs);
    else files.push(...tsFilesUnder(abs));
  }
  const map = new Map();
  for (const abs of files) {
    map.set(normalizeRel(relative(ROOT, abs)), scanSource(readTsFile(abs)));
  }
  return map;
}

/** Walk every `.ts` file under `src`, returning a map of repo-relative path -> raw source. */
export function walkAllSources() {
  const map = new Map();
  for (const abs of tsFilesUnder(join(ROOT, 'src'))) {
    map.set(normalizeRel(relative(ROOT, abs)), readTsFile(abs));
  }
  return map;
}

function normalizeRel(p) {
  return p.split('\\').join('/');
}

export function readBaseline(path = join(ROOT, BASELINE_PATH)) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// ---------------------------------------------------------------------------------------------
// The check

/**
 * Compare a scan (`Map<relPath, string[]>` of bare literals) against the baseline (`string[]` of
 * not-yet-migrated module paths). Returns `{ ok, errors, counts }` where `counts` is a per-module
 * list of `{ path, count }` sorted by path.
 */
export function checkI18n(sources, baseline) {
  const baselineSet = new Set(baseline);
  const errors = [];
  const counts = [];

  for (const path of [...sources.keys()].sort()) {
    const count = (sources.get(path) ?? []).length;
    counts.push({ path, count });
    if (count > 0 && !baselineSet.has(path)) {
      errors.push(`migrated module ${path} has ${count} bare string(s) not going through t()`);
    }
  }

  for (const path of baseline) {
    const scanned = sources.has(path);
    const count = scanned ? (sources.get(path) ?? []).length : -1;
    if (!scanned || count === 0) {
      errors.push(`baseline lists ${path} but it is ${scanned ? 'now clean' : 'not scanned'} — shrink the baseline`);
    }
  }

  return { ok: errors.length === 0, errors, counts };
}

function main() {
  const baselineArg = process.argv.find((a) => a.startsWith('--baseline='));
  const baselinePath = baselineArg ? resolve(ROOT, baselineArg.slice('--baseline='.length)) : join(ROOT, BASELINE_PATH);

  const sources = scanRoots();
  let baseline;
  try {
    baseline = readBaseline(baselinePath);
  } catch {
    baseline = [];
  }
  const { ok, errors, counts } = checkI18n(sources, baseline);

  for (const { path, count } of counts) {
    console.log(`${String(count).padStart(4)}  ${path}`);
  }
  if (errors.length > 0) {
    console.log('\n' + errors.join('\n'));
  }
  console.log(ok ? '\ni18n:check OK' : `\ni18n:check FAIL (${errors.length})`);
  process.exit(ok ? 0 : 1);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
