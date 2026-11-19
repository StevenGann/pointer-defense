import { TICK_HZ } from './time.ts';
import { rngNext } from './rng.ts';

/**
 * The pointer as a weapon. Two stages, then a wave-gated overclock ladder (docs/design.md §9).
 *
 * Stage 1: a bare click — fixed damage on the enemy under the cursor.
 * Stage 2: a targeting reticle — additionally, the last enemy you clicked becomes the held target
 *          and takes damage over time while the mouse button is held down on the board. The reticle
 *          is also the *mark*: the enemy it is locked on is marked, which feeds the crit and the
 *          Manual Override.
 *
 * Overclock levels sit above stage 2: each one multiplies click damage (and the hold DPS that tracks
 * it) so the pointer keeps a cost curve of its own all the way to the endgame.
 *
 * Click damage ignores armour and is the only thing that can break shields.
 */

export type PointerStage = 1 | 2;
export const MAX_POINTER_STAGE: PointerStage = 2;

export interface PointerStageInfo {
  readonly name: string;
  /** Cost to reach this stage from the previous one (0 for stage 1). */
  readonly cost: number;
  /** Click damage at overclock level 0. */
  readonly clickDamage: number;
  /** Damage per second applied to the held target at overclock level 0. */
  readonly holdDps: number;
}

export const POINTER_STAGES: Readonly<Record<PointerStage, PointerStageInfo>> = {
  1: { name: 'Click', cost: 0, clickDamage: 3, holdDps: 0 },
  2: { name: 'Reticle', cost: 80, clickDamage: 4, holdDps: 10 },
};

/**
 * Overclock cost: `round(OVERCLOCK_COST_BASE * OVERCLOCK_COST_GROWTH ^ clickLevel)`. The base is
 * derived from the closed form so the whole ladder (levels 1–12) costs ~100k of salvage, keeping the
 * climb as expensive as the old 1.95 curve while the per-level growth flattens to 1.25.
 */
export const OVERCLOCK_COST_BASE = 1845;
export const OVERCLOCK_COST_GROWTH = 1.25;
/** Overclock damage: `reticleBase * OVERCLOCK_DAMAGE_GROWTH ^ clickLevel * milestone(clickLevel)`. */
export const OVERCLOCK_DAMAGE_GROWTH = 1.12;
/**
 * Explicit damage milestones, applied cumulatively once the level is reached. Each entry is a
 * `[level, multiplier]` pair: reaching that level multiplies click damage (and the hold DPS that
 * tracks it) by the multiplier, on top of the per-level growth. Used to shape the ladder into a
 * few visible jumps instead of one smooth curve.
 */
export const OVERCLOCK_MILESTONES: ReadonlyArray<readonly [number, number]> = [
  [5, 2],
  [10, 2],
];
/** Hold damage tracks click damage: `holdDps = clickDamage * 2.5`. */
export const HOLD_DPS_MULT = 2.5;

/** Cumulative damage multiplier from every milestone at or below the given overclock level. */
export function overclockMilestoneMult(level: number): number {
  let mult = 1;
  for (const [at, factor] of OVERCLOCK_MILESTONES) {
    if (level >= at) mult *= factor;
  }
  return mult;
}

/** One overclock level unlocks every this many waves: `floor(wave / 8)`, capped at 12. */
export const OVERCLOCK_WAVE_DIVISOR = 8;
/** The overclock ladder's hard top, so click power stops ahead of the content. */
export const MAX_OVERCLOCK_LEVEL = 12;

/**
 * The highest overclock level the current wave permits: `floor(wave / 8)`, clamped to 0..cap. The cap
 * is `MAX_OVERCLOCK_LEVEL` unless the run owns Coolant Loop (docs/GLOBAL-UPGRADES.md), which passes 16.
 */
export function overclockCeiling(wave: number, cap: number = MAX_OVERCLOCK_LEVEL): number {
  return Math.max(0, Math.min(cap, Math.floor(wave / OVERCLOCK_WAVE_DIVISOR)));
}

/** The wave at which an overclock level first becomes buyable (`level * 8`). */
export function overclockUnlockWave(level: number): number {
  return level * OVERCLOCK_WAVE_DIVISOR;
}

/** A click on the marked (reticle-locked) enemy deals +15 %. */
export const MARKED_DAMAGE_MULT = 1.15;

/** Crit damage multiplier. */
export const CRIT_MULTIPLIER = 2.5;
/** Base crit chance; +6 % marked, +8 % on the weak point. */
export const CRIT_BASE_CHANCE = 0.04;
export const CRIT_MARKED_CHANCE = 0.06;
export const CRIT_WEAK_CHANCE = 0.08;

export interface PointerState {
  stage: PointerStage;
  /** Overclock levels bought above stage 2. Starts 0. */
  clickLevel: number;
  /** Manual Override: towers in range of the marked enemy drop their own priority. */
  manualOverride: boolean;
  /** Enemy the reticle is locked on (stage 2+), or null. */
  targetId: number | null;
  /** Whether the button is held on the board; reticle DoT only ticks while held. */
  held: boolean;
  /** Last known cursor position in world units (tiles). */
  x: number;
  y: number;
  /** Consecutive weak-point hits in a row. */
  combo: number;
  /** Ticks remaining before the combo expires (refreshed on every weak-point hit). */
  comboTicks: number;
}

export function createPointer(): PointerState {
  return { stage: 1, clickLevel: 0, manualOverride: false, targetId: null, held: false, x: -10, y: -10, combo: 0, comboTicks: 0 };
}

/** A weak-point hit keeps the combo alive this many ticks (5 s). */
export const COMBO_TICKS = 300;

/** Click/reticle damage multiplier from the combo: 1 + 0.1 per hit, capped at 2. */
export function comboMultiplier(p: PointerState): number {
  return Math.min(2, 1 + 0.1 * p.combo);
}

/** Distance (tiles) the cursor may drift off a locked target before the reticle lets go. */
export const RETICLE_STICKY = 0.6;

export function pointerInfo(p: PointerState): PointerStageInfo {
  return POINTER_STAGES[p.stage];
}

/** Click damage for the current stage and overclock level (float, the value actually applied). */
export function clickDamage(p: PointerState): number {
  const base = POINTER_STAGES[p.stage].clickDamage;
  if (p.stage < MAX_POINTER_STAGE) return base;
  return base * Math.pow(OVERCLOCK_DAMAGE_GROWTH, p.clickLevel) * overclockMilestoneMult(p.clickLevel);
}

/** Hold damage per second: zero before the reticle, then click damage scaled to keep pace. */
export function holdDps(p: PointerState): number {
  if (p.stage < MAX_POINTER_STAGE) return 0;
  return clickDamage(p) * HOLD_DPS_MULT;
}

/** Cost of the next stage, or null at the top of this slice's stage list. */
export function nextStageCost(p: PointerState): number | null {
  if (p.stage >= MAX_POINTER_STAGE) return null;
  return POINTER_STAGES[(p.stage + 1) as PointerStage].cost;
}

/** Cost of the next overclock level, or null before the reticle. */
export function nextOverclockCost(p: PointerState): number | null {
  if (p.stage < MAX_POINTER_STAGE) return null;
  return Math.round(OVERCLOCK_COST_BASE * Math.pow(OVERCLOCK_COST_GROWTH, p.clickLevel));
}

/** Cost of the next pointer upgrade, whether a stage or an overclock level. */
export function nextPointerCost(p: PointerState): number | null {
  return nextStageCost(p) ?? nextOverclockCost(p);
}

export function holdDamagePerTick(p: PointerState): number {
  return holdDps(p) / TICK_HZ;
}

/** Crit chance for one click, from the marked and weak-point states (docs/design.md §9.2).
 *  Rounded to a whole percentage point so the sum is exact (0.1 + 0.2 would drift). */
export function critChance(marked: boolean, weak: boolean): number {
  const sum = CRIT_BASE_CHANCE + (marked ? CRIT_MARKED_CHANCE : 0) + (weak ? CRIT_WEAK_CHANCE : 0);
  return Math.round(sum * 100) / 100;
}

/** Roll one crit against the seeded PRNG, returning the outcome and the carried-forward state. */
export function nextCritRoll(rng: number, marked: boolean, weak: boolean): { crit: boolean; next: number } {
  const r = rngNext(rng);
  return { crit: r.value < critChance(marked, weak), next: r.next };
}

/** Radius of slack (tiles) added to enemy hitboxes for click hit tests, so tiny runners are fair. */
export const CLICK_SLACK = 0.15;
