import { enemyKillValue, type EnemyKind } from './enemies.ts';
import { secondsToTicks } from './time.ts';

/**
 * Wave generation (docs/design.md §8).
 *
 * A wave is a list of spawn groups. A group spawns `count` enemies of one kind, `interval` ticks
 * apart, starting `delay` ticks after the wave begins. Groups may overlap, which is how mixed waves
 * are made without listing every enemy.
 *
 * Waves 1..10 are the hand-written tutorial and are kept exactly as authored. Waves 11..100 are
 * produced by a deterministic generator: the wave number is the seed, so there is no `Math.random`
 * in the table and every player sees the same hundred waves. Bosses ride waves 10, 25, 50, 75 and
 * 100, and modifiers begin at wave 51.
 */

export interface SpawnGroup {
  readonly kind: EnemyKind;
  readonly count: number;
  /** Ticks between spawns within the group. */
  readonly interval: number;
  /** Ticks from wave start to the group's first spawn. */
  readonly delay: number;
}

export interface WaveDef {
  readonly groups: readonly SpawnGroup[];
}

export interface Spawn {
  readonly tick: number;
  readonly kind: EnemyKind;
}

/** A run is a hundred waves. Endless (101+) uses the same generator with a seed offset. */
export const WAVE_COUNT = 100;

/** Fixed offset mixed into the seed for endless waves, so 101+ is not a repeat of 1..100. */
export const ENDLESS_SEED_OFFSET = 1_000_000;

/** Per-wave enemy cap: late waves are won by damage and maze, not by attrition. */
export const WAVE_ENEMY_CAP = 70;

export type ModifierId = 'fog' | 'no-build' | 'fast' | 'blackout' | 'rush';

export const MODIFIER_POOL: readonly ModifierId[] = ['fog', 'no-build', 'fast', 'blackout', 'rush'];

export const MODIFIER_NAMES: Readonly<Record<ModifierId, string>> = {
  fog: 'Fog',
  'no-build': 'No-Build',
  fast: 'Fast Forward',
  blackout: 'Blackout',
  rush: 'Rush',
};

const g = (kind: EnemyKind, count: number, intervalS: number, delayS = 0): SpawnGroup => ({
  kind,
  count,
  interval: secondsToTicks(intervalS),
  delay: delayS === 0 ? 0 : secondsToTicks(delayS),
});

/** Waves 1..10: one lane, towers teach, clicking is a nudge. Kept verbatim for the tutorial. */
const TUTORIAL_WAVES: readonly WaveDef[] = [
  /* 1 */ { groups: [g('grunt', 8, 1.2)] },
  /* 2 */ { groups: [g('grunt', 12, 0.9)] },
  /* 3 */ { groups: [g('grunt', 10, 0.9), g('runner', 3, 1.5, 6)] },
  /* 4 */ { groups: [g('grunt', 16, 0.7)] },
  /* 5 */ { groups: [g('grunt', 10, 0.8), g('runner', 6, 1.0, 4)] },
  /* 6 */ { groups: [g('grunt', 19, 0.5), g('flyer', 3, 2.0, 8)] },
  /* 7 */ { groups: [g('runner', 10, 0.7), g('grunt', 11, 0.6, 3), g('flyer', 4, 2.0, 10)] },
  /* 8 */ { groups: [g('grunt', 17, 0.5), g('runner', 8, 0.8, 5), g('flyer', 5, 1.8, 12)] },
  /* 9 */ { groups: [g('grunt', 15, 0.5), g('shielded', 3, 3.0, 4), g('runner', 6, 0.8, 8), g('flyer', 6, 1.8, 12)] },
  /* 10 */ { groups: [g('grunt', 21, 0.4), g('runner', 10, 0.6, 4), g('shielded', 4, 2.5, 6), g('flyer', 8, 1.5, 10)] },
];

// ---------------------------------------------------------------------------------------------
// Determinism

/** SplitMix32-style integer hash: deterministic across platforms and builds. */
function hashInt(seed: number): number {
  let x = seed | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = x ^ (x >>> 16);
  return x >>> 0;
}

/** Endless waves shift the seed so the sequence does not just restart at wave 1. */
function seedFor(wave: number): number {
  return wave > WAVE_COUNT ? wave + ENDLESS_SEED_OFFSET : wave;
}

/** A fresh mulberry32 stream seeded by the wave number (pure; no shared state). */
function waveRng(wave: number): () => number {
  let state = hashInt((seedFor(wave) ^ 0x9e3779b9) | 0);
  return () => {
    const a = (state + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    state = a;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

// ---------------------------------------------------------------------------------------------
// Bosses

const BOSS_WAVES: ReadonlySet<number> = new Set([10, 25, 50, 75, 100]);

export function isBossWave(wave: number): boolean {
  return BOSS_WAVES.has(wave);
}

/** Ground enemies available in a band for boss escorts (flyers are the dedicated air group). */
function escortKinds(wave: number): readonly EnemyKind[] {
  return wave >= 21 ? ['grunt', 'runner', 'shielded', 'armoured'] : ['grunt', 'runner', 'shielded'];
}

/** The boss group plus a small escort, timed so escorts straddle the boss's spawn. */
function bossGroups(wave: number): readonly SpawnGroup[] {
  const rnd = waveRng(wave);
  const escortCount = 6 + Math.floor(rnd() * 7); // 6..12
  const kinds = escortKinds(wave);
  const escortKind = kinds[hashInt(seedFor(wave) + 7) % kinds.length];
  const bossDelay = secondsToTicks(2);
  const escortInterval = secondsToTicks(0.45);
  const escortDelay = Math.max(0, bossDelay - Math.floor(escortCount / 2) * escortInterval);
  return [
    { kind: escortKind, count: escortCount, interval: escortInterval, delay: escortDelay },
    { kind: 'boss', count: 1, interval: 1, delay: bossDelay },
  ];
}

// ---------------------------------------------------------------------------------------------
// Pop-up enemies (the walking shield)

/** First wave that may carry a pop-up; the wave itself is the seed, so it never changes. */
export const POPUP_FIRST_WAVE = 15;

/** Two pop-ups per wave (and two alive at once) become possible from this wave. */
export const POPUP_TWO_FROM = 60;

/**
 * How many pop-ups a wave carries: 0 or 1 before wave 60, 0..2 after, never on a boss wave, and
 * never before wave 15. Decided from the wave's seeded RNG, so the same wave always produces the
 * same pop-ups.
 */
export function popupCountForWave(wave: number): number {
  if (wave < POPUP_FIRST_WAVE || isBossWave(wave)) return 0;
  const rnd = waveRng(wave);
  if (wave < POPUP_TWO_FROM) return rnd() < 0.2 ? 1 : 0;
  const roll = rnd();
  if (roll < 0.4) return 0;
  if (roll < 0.75) return 1;
  return 2;
}

/** The most pop-ups that may be alive at once during a wave of this number. */
export function popupAliveCap(wave: number): number {
  return wave < POPUP_TWO_FROM ? 1 : 2;
}

// ---------------------------------------------------------------------------------------------
// Modifiers

/** The modifiers for a wave: one from 51, two (distinct) from 120 in endless. Empty before 51. */
export function waveModifiers(wave: number): readonly ModifierId[] {
  if (wave < 51) return [];
  const first = MODIFIER_POOL[hashInt(wave) % MODIFIER_POOL.length];
  if (wave < 120) return [first];
  const idx = MODIFIER_POOL.indexOf(first);
  const offset = 1 + (hashInt(wave ^ 0x51ab3) % (MODIFIER_POOL.length - 1));
  return [first, MODIFIER_POOL[(idx + offset) % MODIFIER_POOL.length]];
}

// ---------------------------------------------------------------------------------------------
// The generator

/** Per-band baseline enemy count; deterministic jitter is added, then the whole thing is capped. */
function totalCount(wave: number): number {
  let base: number;
  if (wave <= 20) base = 30;
  else if (wave <= 40) base = 42;
  else if (wave <= 60) base = 52;
  else if (wave <= 80) base = 60;
  else base = 66;
  const jitter = Math.floor(waveRng(wave)() * 7) - 3; // -3..+3
  return Math.min(WAVE_ENEMY_CAP, Math.max(8, base + jitter));
}

/** Spawn spacing (seconds) per kind; single-spawn groups ignore it. */
const KIND_INTERVAL_S: Readonly<Record<EnemyKind, number>> = {
  grunt: 0.6,
  runner: 0.7,
  flyer: 1.5,
  shielded: 2.5,
  armoured: 2.0,
  saboteur: 3.0,
  breacher: 3.5,
  boss: 0,
  popup: 0,
};

/** Assemble ordered groups, staggering each group to start partway through the previous one. */
function withStagger(items: readonly { kind: EnemyKind; count: number }[]): SpawnGroup[] {
  const groups: SpawnGroup[] = [];
  let delay = 0;
  for (const it of items) {
    const interval = secondsToTicks(KIND_INTERVAL_S[it.kind]);
    groups.push({ kind: it.kind, count: it.count, interval, delay });
    delay += Math.round(interval * it.count * 0.5);
  }
  return groups;
}

/**
 * Deterministic composition for waves 11..100. The groups are flyer (15-25%), tank (shielded early,
 * armoured late), chaff (grunt/runner), breachers (from wave 12, 3-6%, skipped on boss waves) and
 * saboteurs (21+).
 * Wave 11..20 has no saboteur, so the two chaff kinds both appear. Flyers stay 15-25% after wave 6;
 * the shielded share shrinks after wave 40 as armoured takes over the "towers cannot do this" role.
 */
function generateWave(wave: number): WaveDef {
  const rnd = waveRng(wave);
  const total = totalCount(wave);

  const flyers = Math.min(
    Math.floor(total * 0.25),
    Math.max(Math.ceil(total * 0.15), Math.round(total * (0.15 + rnd() * 0.1))),
  );

  const saboteurs = wave >= 21 ? 1 + Math.floor(rnd() * 3) : 0;

  // Breachers arrive from wave 12 as a minority (3-6% of the wave) and scale with the wave's
  // total, so they stay a trickle rather than a second tank line. Boss waves are already dense
  // (a boss plus escorts on top of a full wave), so breachers skip them.
  const breachers = wave >= 12 && !isBossWave(wave) ? Math.max(1, Math.round(total * (0.03 + rnd() * 0.03))) : 0;

  let tank: EnemyKind;
  let tankCount: number;
  if (wave >= 21) {
    const armouredBias = wave <= 40 ? 0.55 : 0.85;
    if (rnd() < armouredBias) {
      tank = 'armoured';
      tankCount = Math.round(total * (0.12 + rnd() * 0.1));
    } else {
      tank = 'shielded';
      tankCount = Math.round(total * (wave <= 40 ? 0.15 : 0.04));
    }
  } else {
    tank = 'shielded';
    tankCount = Math.round(total * (0.12 + rnd() * 0.1));
  }

  const rest = Math.max(1, total - flyers - saboteurs - tankCount - breachers);

  let ordered: { kind: EnemyKind; count: number }[];
  if (wave < 21) {
    const runners = Math.round(rest * (0.25 + rnd() * 0.25));
    const grunts = rest - runners;
    ordered = [
      { kind: 'grunt', count: grunts },
      { kind: 'runner', count: runners },
      { kind: tank, count: tankCount },
      { kind: 'breacher', count: breachers },
      { kind: 'flyer', count: flyers },
    ];
  } else {
    const chaff: EnemyKind = rnd() < 0.7 ? 'grunt' : 'runner';
    ordered = [
      { kind: chaff, count: rest },
      { kind: tank, count: tankCount },
      { kind: 'breacher', count: breachers },
      { kind: 'flyer', count: flyers },
      { kind: 'saboteur', count: saboteurs },
    ];
  }

  return { groups: withStagger(ordered) };
}

// ---------------------------------------------------------------------------------------------
// Public surface

/** The wave definition for any wave, or null below wave 1. Tutorial waves are hand-written. */
export function waveDef(wave: number): WaveDef | null {
  if (wave < 1) return null;
  if (wave <= TUTORIAL_WAVES.length) return TUTORIAL_WAVES[wave - 1];
  return generateWave(wave);
}

/** Flatten a wave into a tick-ordered spawn schedule. Ties keep group order (stable sort). */
export function buildSchedule(wave: number): Spawn[] {
  const def = waveDef(wave);
  if (!def) return [];
  const groups = [...def.groups];
  if (isBossWave(wave)) groups.push(...bossGroups(wave));
  const rush = waveModifiers(wave).includes('rush');
  const intervalScale = rush ? 0.75 : 1;
  const out: Spawn[] = [];
  for (const grp of groups) {
    const interval = Math.max(1, Math.round(grp.interval * intervalScale));
    for (let i = 0; i < grp.count; i++) out.push({ tick: grp.delay + i * interval, kind: grp.kind });
  }

  // The walking shield rides mid-wave, so it covers enemies rather than leading the pack.
  const popups = popupCountForWave(wave);
  if (popups > 0) {
    let last = 0;
    for (const sp of out) last = Math.max(last, sp.tick);
    const span = Math.max(60, last);
    for (let i = 0; i < popups; i++) {
      const frac = popups === 1 ? 0.5 : i === 0 ? 0.3 : 0.7;
      out.push({ tick: Math.round(span * frac), kind: 'popup' });
    }
  }

  return out.sort((a, b) => a.tick - b.tick);
}

/**
 * The salvage a wave pays if every enemy in it is killed: the sum of each enemy kind's base value
 * scaled to the wave, the same value `createEnemy` assigns the enemy. Includes boss escorts on boss
 * waves. Excludes the rush modifier's kill-time value bonus, which is applied when the kill lands,
 * not when the enemy is spawned.
 */
export function waveKillValue(wave: number): number {
  return buildSchedule(wave).reduce((sum, spawn) => sum + enemyKillValue(spawn.kind, wave), 0);
}

/**
 * The salvage bonus for starting the next wave early (docs/design.md §8.5). `elapsedTicks` is the
 * time since the most recent wave started, and `nextWave` is the wave being called: the span is the
 * last spawn tick of the wave that just started (`nextWave - 1`, min 60 ticks), and the reward is a
 * fraction of the called wave's kill value, so a full-early call pays a quarter of that wave's worth
 * and a late call decays to a floor of 5. Deterministic — no randomness.
 */
export function earlyCallBonus(elapsedTicks: number, nextWave: number): number {
  const schedule = buildSchedule(nextWave - 1);
  const last = schedule.length > 0 ? schedule[schedule.length - 1].tick : 0;
  const span = Math.max(60, last);
  const fraction = Math.min(1, Math.max(0, 1 - elapsedTicks / span));
  const kill = waveKillValue(nextWave);
  return Math.min(kill, Math.max(5, Math.round(0.25 * kill * fraction)));
}

/** Total enemies in a wave, including a boss and its escorts on boss waves. */
export function waveEnemyCount(wave: number): number {
  const def = waveDef(wave);
  if (!def) return 0;
  let n = def.groups.reduce((sum, grp) => sum + grp.count, 0);
  if (isBossWave(wave)) n += bossGroups(wave).reduce((sum, grp) => sum + grp.count, 0);
  n += popupCountForWave(wave);
  return n;
}
