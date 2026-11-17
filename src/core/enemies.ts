import type { Tile } from './grid.ts';
import { TICK_HZ } from './time.ts';

export type EnemyKind = 'grunt' | 'runner' | 'shielded' | 'flyer' | 'armoured' | 'saboteur' | 'boss' | 'breacher' | 'popup';

export interface EnemyStats {
  readonly name: string;
  /** Hit points at wave 1; scaled by waveHpScale. */
  readonly hp: number;
  /** Tiles per second. */
  readonly speed: number;
  /** Hitbox radius in tiles. Used for tower range, splash and click hit tests. */
  readonly radius: number;
  /** Flat reduction applied to tower hits (except the taser). Clicks ignore armour. */
  readonly armour: number;
  /** Shield points. While > 0 the enemy takes no tower damage; only the pointer wears it down. */
  readonly shield: number;
  /** Base salvage for a kill at wave 1. */
  readonly value: number;
  /** Damage per second dealt to a wall while stopped at it (0 for non-breachers). */
  readonly wallDps: number;
}

const GRUNT_SPEED = 1.6;

/**
 * Data, not code: balance lives here.
 *
 * The runner "resists towers" without a damage multiplier: it is 2.2x as fast (less time inside
 * any tower's range) and has a small hitbox (range and splash are measured to its edge, so it
 * slips out of reach sooner and is rarely caught by cannon splash). The pointer is the answer.
 *
 * The flyer ignores the maze entirely: it flies a straight line from spawn to exit, fast and frail,
 * so it is a check on raw coverage rather than on the player's wall-building.
 */
export const ENEMY_STATS: Readonly<Record<EnemyKind, EnemyStats>> = {
  grunt: { name: 'Grunt', hp: 20, speed: GRUNT_SPEED, radius: 0.3, armour: 0, shield: 0, value: 4, wallDps: 0 },
  runner: { name: 'Runner', hp: 10, speed: GRUNT_SPEED * 2.2, radius: 0.18, armour: 0, shield: 0, value: 6, wallDps: 0 },
  shielded: { name: 'Shielded', hp: 30, speed: 1.2, radius: 0.36, armour: 2, shield: 15, value: 10, wallDps: 0 },
  flyer: { name: 'Flyer', hp: 8, speed: GRUNT_SPEED * 1.5, radius: 0.22, armour: 0, shield: 0, value: 5, wallDps: 0 },
  armoured: { name: 'Armoured', hp: 45, speed: 1.0, radius: 0.34, armour: 8, shield: 0, value: 12, wallDps: 0 },
  saboteur: { name: 'Saboteur', hp: 25, speed: 1.5, radius: 0.28, armour: 0, shield: 0, value: 11, wallDps: 0 },
  boss: { name: 'Boss', hp: 450, speed: 0.8, radius: 0.55, armour: 6, shield: 120, value: 120, wallDps: 0 },
  breacher: { name: 'Breacher', hp: 55, speed: 0.6, radius: 0.42, armour: 0, shield: 0, value: 14, wallDps: 12 },
  popup: { name: 'Pop-up', hp: 60, speed: 0.7, radius: 0.4, armour: 0, shield: 0, value: 18, wallDps: 0 },
};

/**
 * The breacher's mounted turret (docs/design.md §7). It shoots the nearest player tower — the line,
 * not the maze — so a wall-less board cannot ignore a Breacher. Walls are the nose's job (chewing),
 * not the gun's, so they are never a turret target. Range is measured centre to centre.
 */
export const BREACHER_TURRET_RANGE = 2.5;
export const BREACHER_TURRET_DAMAGE = 4;
/** Ticks between turret shots: one per second. */
export const BREACHER_TURRET_INTERVAL_TICKS = TICK_HZ;

/**
 * The pop-up enemy is a walking shield, not a "shielded" enemy: its `shield` stat is 0. Towers are
 * blinded to any enemy whose centre lies inside the window's rectangle, and the window itself can
 * only be killed by clicking its close box (the view dispatches that click to a core reducer).
 */
export const POPUP_W = 2.2; // window width in tiles
export const POPUP_H = 1.5; // window height in tiles

export type PopupEnemy = Enemy & { readonly kind: 'popup' };

export function isPopupEnemy(e: Enemy): e is PopupEnemy {
  return e.kind === 'popup';
}

/** Whether a world point lies inside the window's shield rectangle (inclusive edges). */
export function popupCovers(e: Enemy, x: number, y: number): boolean {
  return Math.abs(x - e.x) <= POPUP_W / 2 && Math.abs(y - e.y) <= POPUP_H / 2;
}

export interface Enemy {
  readonly id: number;
  readonly kind: EnemyKind;
  /** The wave this enemy was spawned for; drives HP scaling and per-wave leak accounting. */
  readonly wave: number;
  /** Bosses (wave bosses, added in a later slice) are tracked for the boss-by-pointer achievement. */
  readonly isBoss: boolean;
  /** True once any tower has landed a hit; used to detect a pointer-only boss kill. */
  towerDamaged: boolean;
  hp: number;
  readonly maxHp: number;
  shield: number;
  readonly maxShield: number;
  /** Distance travelled this run, in tiles. */
  dist: number;
  x: number;
  y: number;
  /** Position at the previous tick, for render interpolation. */
  prevX: number;
  prevY: number;
  /** The tile whose centre the enemy last reached (spawn at first). */
  col: number;
  row: number;
  /** The tile centre it is walking toward; -1 means "recompute with the field" (flyers never do). */
  targetCol: number;
  targetRow: number;
  /** Salvage paid on death before the pointer bonus. */
  readonly value: number;
  /** Movement multiplier while slowed (1 = normal). */
  slowFactor: number;
  /** Last tick the slow applies through; slowed while tick < this. */
  slowUntilTick: number;
  /** Last tick the enemy is stunned through; it does not move while tick < this. */
  stunUntilTick: number;
  /** Direction of travel in radians; the leading edge (and weak point) faces this way. */
  heading: number;
  /** Wall tower id this breacher is currently chewing through, or null. */
  attackWallId: number | null;
  /** Breacher only: ticks until the mounted turret may fire again (0 = ready). */
  turretCooldown: number;
  dead: boolean;
}

/**
 * Enemies get tougher each wave; salvage grows more slowly so towers stay a real investment.
 * Piecewise per docs/design.md §8.3: linear to wave 20, then exponential — HP outgrows value on
 * purpose so the curve visibly bends around wave 60 and the player starts thinking about a reboot.
 */
export function waveHpScale(wave: number): number {
  const w = Math.max(1, wave);
  if (w <= 20) return 1 + 0.18 * (w - 1);
  if (w <= 60) return 4.42 * Math.pow(1.015, w - 20);
  return 4.42 * Math.pow(1.015, 40) * Math.pow(1.001, w - 60);
}

export function waveValueScale(wave: number): number {
  const w = Math.max(1, wave);
  if (w <= 50) return 1 + 0.06 * (w - 1);
  return 3.94 * Math.pow(1.012, w - 50);
}

/** The base salvage an enemy of `kind` pays when killed at `wave`, before source bonuses. */
export function enemyKillValue(kind: EnemyKind, wave: number): number {
  return Math.round(ENEMY_STATS[kind].value * waveValueScale(wave));
}

export function createEnemy(id: number, kind: EnemyKind, wave: number, spawn: Tile, exit: Tile): Enemy {
  const s = ENEMY_STATS[kind];
  const hp = Math.round(s.hp * waveHpScale(wave));
  // Shield is a flat pointer-check, not wave-scaled: pointer damage does not scale with wave, so a
  // wave-scaled shield would make the pointer half irrelevant (a wave-100 boss shield would take
  // thousands of seconds to break at 3 damage per click).
  const shield = s.shield;
  const x = spawn.col + 0.5;
  const y = spawn.row + 0.5;
  const isFlyer = kind === 'flyer';
  const heading = isFlyer ? Math.atan2(exit.row - spawn.row, exit.col - spawn.col) : 0;
  return {
    id,
    kind,
    wave,
    isBoss: kind === 'boss',
    towerDamaged: false,
    hp,
    maxHp: hp,
    shield,
    maxShield: shield,
    dist: 0,
    x,
    y,
    prevX: x,
    prevY: y,
    col: spawn.col,
    row: spawn.row,
    targetCol: -1,
    targetRow: -1,
    value: enemyKillValue(kind, wave),
    slowFactor: 1,
    slowUntilTick: 0,
    stunUntilTick: 0,
    heading,
    attackWallId: null,
    turretCooldown: 0,
    dead: false,
  };
}

/** Tiles travelled per simulation tick. */
export function speedPerTick(kind: EnemyKind): number {
  return ENEMY_STATS[kind].speed / TICK_HZ;
}

export function radiusOf(e: Enemy): number {
  return ENEMY_STATS[e.kind].radius;
}

/**
 * The weak point is the leading-edge arc: clicks within the enemy's radius and within this half-angle
 * of its heading hit the weak point. ±22.5° spans a 45° arc.
 */
export const WEAK_ARC_HALF_ANGLE = Math.PI / 8;

/** Signed angle from the enemy's heading to the ray toward (x, y), folded into [-π, π]. */
export function weakPointAngleDiff(e: Enemy, x: number, y: number): number {
  let d = Math.atan2(y - e.y, x - e.x) - e.heading;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Whether a world point lies inside the enemy's radius and inside its weak-point arc. */
export function isWeakPointHit(e: Enemy, x: number, y: number): boolean {
  const dx = x - e.x;
  const dy = y - e.y;
  if (dx * dx + dy * dy > radiusOf(e) * radiusOf(e)) return false;
  return Math.abs(weakPointAngleDiff(e, x, y)) <= WEAK_ARC_HALF_ANGLE;
}
