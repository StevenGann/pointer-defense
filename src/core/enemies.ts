import type { Tile } from './grid.ts';
import { TICK_HZ } from './time.ts';

export type EnemyKind =
  | 'grunt' | 'runner' | 'shielded' | 'flyer' | 'armoured' | 'saboteur' | 'breacher' | 'popup'
  | 'grunt-boss' | 'runner-boss' | 'shielded-boss' | 'flyer-boss' | 'armoured-boss' | 'saboteur-boss' | 'breacher-boss';

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
  /** Flat reduction added to `armour` for tower hits (the Dreadnought's plating; 0 elsewhere). */
  readonly plating: number;
  /** Damage per second dealt to a wall while stopped at it (0 for non-breachers). */
  readonly wallDps: number;
  /** Integrity lost when the enemy leaks. */
  readonly integrity: number;
  /** Draw multiplier on the base silhouette (1.0 = the base type's size). */
  readonly scale: number;
}

const GRUNT_SPEED = 1.6;

/**
 * Boss variants (docs/design.md, boss-variants passes). Each is a separate kind so waves, harness
 * and tests can name it, but it counts as its base type for tower rules (an Overload Taser sees a
 * Bastion as shielded; an AA tower will see a Carrier as a flyer in a later pass). The three pass-1
 * bosses keep one gimmick each: the Sergeant is a wall of HP, the Pacer sets a speed floor, and the
 * Bastion wears shield layers.
 */
export const BASTION_SHIELD_LAYERS = 3;
/** Each Bastion layer is worth the base Shielded shield (15 points). */
export const BASTION_SHIELD_LAYER_VALUE = 15;
/** The Pacer's aura radius: enemies inside move at the Pacer's speed or their own, whichever is faster. */
export const PACER_AURA_RADIUS = 3;

/** The Carrier releases a brood of flyers this many ticks apart while it walks. */
export const CARRIER_BROOD_INTERVAL_TICKS = TICK_HZ * 4;
/** Flyers the Carrier releases per brood; it releases twice as many on death. */
export const CARRIER_BROOD_COUNT = 3;
export const CARRIER_DEATH_BROOD_COUNT = 6;
/** Brood flyers scatter outward for half a second before homing on the exit. */
export const CARRIER_BROOD_SCATTER_TICKS = Math.round(TICK_HZ * 0.5);

/** The Dreadnought's plating: flat reduction added to its base armour on every tower hit. */
export const DREADNOUGHT_PLATING = 6;

/** The Wirecutter's EMP: towers this close are knocked offline for this long as it passes. */
export const WIRECUTTER_EMP_RADIUS = 2.5;
export const WIRECUTTER_EMP_TICKS = TICK_HZ * 3;

/** The Ram chews non-wall towers at this many damage per second (walls use its `wallDps`). */
export const RAM_TOWER_DPS = 40;
/** The Ram's mounted turret: 8 damage at 3 tiles (the Breacher's is 2 at 2.2). */
export const RAM_TURRET_DAMAGE = 8;
export const RAM_TURRET_RANGE = 3;

/** The base enemy type a boss variant counts as for tower rules (and art). */
export function baseEnemyKind(kind: EnemyKind): EnemyKind {
  if (kind === 'grunt-boss') return 'grunt';
  if (kind === 'runner-boss') return 'runner';
  if (kind === 'shielded-boss') return 'shielded';
  if (kind === 'flyer-boss') return 'flyer';
  if (kind === 'armoured-boss') return 'armoured';
  if (kind === 'saboteur-boss') return 'saboteur';
  if (kind === 'breacher-boss') return 'breacher';
  return kind;
}

/** Whether the kind is one of the boss variants. */
export function isBossVariant(kind: EnemyKind): boolean {
  return (
    kind === 'grunt-boss' || kind === 'runner-boss' || kind === 'shielded-boss' ||
    kind === 'flyer-boss' || kind === 'armoured-boss' || kind === 'saboteur-boss' || kind === 'breacher-boss'
  );
}

/** Whether the kind flies: it ignores the ground maze and only a Mesh wall blocks it. */
export function isFlyerKind(kind: EnemyKind): boolean {
  return kind === 'flyer' || kind === 'flyer-boss';
}

/** Halve a slow's strength for the Dreadnought (armoured-boss), whose plating resists slows. */
export function slowFactorFor(kind: EnemyKind, factor: number): number {
  if (kind === 'armoured-boss' && factor < 1) return 1 - (1 - factor) / 2;
  return factor;
}

/** Whether the kind is a boss (a boss variant). */
export function isBossKind(kind: EnemyKind): boolean {
  return isBossVariant(kind);
}

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
  grunt: { name: 'Grunt', hp: 20, speed: GRUNT_SPEED, radius: 0.3, armour: 0, plating: 0, shield: 0, value: 4, wallDps: 0, integrity: 1, scale: 1 },
  runner: { name: 'Runner', hp: 10, speed: GRUNT_SPEED * 2.2, radius: 0.18, armour: 0, plating: 0, shield: 0, value: 6, wallDps: 0, integrity: 1, scale: 1 },
  shielded: { name: 'Shielded', hp: 30, speed: 1.2, radius: 0.36, armour: 2, plating: 0, shield: 15, value: 10, wallDps: 0, integrity: 1, scale: 1 },
  flyer: { name: 'Flyer', hp: 8, speed: GRUNT_SPEED * 1.5, radius: 0.22, armour: 0, plating: 0, shield: 0, value: 5, wallDps: 0, integrity: 1, scale: 1 },
  armoured: { name: 'Armoured', hp: 45, speed: 1.0, radius: 0.34, armour: 8, plating: 0, shield: 0, value: 12, wallDps: 0, integrity: 1, scale: 1 },
  saboteur: { name: 'Saboteur', hp: 25, speed: 1.5, radius: 0.28, armour: 0, plating: 0, shield: 0, value: 11, wallDps: 0, integrity: 1, scale: 1 },
  breacher: { name: 'Breacher', hp: 55, speed: 0.6, radius: 0.42, armour: 0, plating: 0, shield: 0, value: 14, wallDps: 12, integrity: 1, scale: 1 },
  popup: { name: 'Pop-up', hp: 60, speed: 0.7, radius: 0.4, armour: 0, plating: 0, shield: 0, value: 18, wallDps: 0, integrity: 0, scale: 1 },
  'grunt-boss': { name: 'Sergeant', hp: 120, speed: 0.55, radius: 0.48, armour: 0, plating: 0, shield: 0, value: 24, wallDps: 0, integrity: 4, scale: 1.6 },
  'runner-boss': { name: 'Pacer', hp: 40, speed: 0.85, radius: 0.27, armour: 0, plating: 0, shield: 0, value: 36, wallDps: 0, integrity: 3, scale: 1.5 },
  'shielded-boss': { name: 'Bastion', hp: 150, speed: 0.45, radius: 0.576, armour: 2, plating: 0, shield: BASTION_SHIELD_LAYERS * BASTION_SHIELD_LAYER_VALUE, value: 60, wallDps: 0, integrity: 4, scale: 1.6 },
  'flyer-boss': { name: 'Carrier', hp: 96, speed: 0.35, radius: 0.44, armour: 0, plating: 0, shield: 0, value: 30, wallDps: 0, integrity: 5, scale: 2.0 },
  'armoured-boss': { name: 'Dreadnought', hp: 405, speed: 0.4, radius: 0.578, armour: 8, plating: DREADNOUGHT_PLATING, shield: 0, value: 72, wallDps: 0, integrity: 4, scale: 1.7 },
  'saboteur-boss': { name: 'Wirecutter', hp: 125, speed: 0.6, radius: 0.42, armour: 0, plating: 0, shield: 0, value: 66, wallDps: 0, integrity: 4, scale: 1.5 },
  'breacher-boss': { name: 'Ram', hp: 440, speed: 0.4, radius: 0.756, armour: 0, plating: 0, shield: 0, value: 84, wallDps: 40, integrity: 5, scale: 1.8 },
};

/**
 * The breacher's mounted turret (docs/design.md §7). It shoots the nearest player tower — the line,
 * not the maze — so a wall-less board cannot ignore a Breacher. Walls are the nose's job (chewing),
 * not the gun's, so they are never a turret target. Range is measured centre to centre.
 */
export const BREACHER_TURRET_RANGE = 2.2;
export let BREACHER_TURRET_DAMAGE = 2;
/** Ticks between turret shots: one per second. */
export const BREACHER_TURRET_INTERVAL_TICKS = TICK_HZ;

/** The balance harness overrides the turret's per-shot damage to sweep the survivable rate. */
export function setBreacherTurretDamage(value: number): void {
  BREACHER_TURRET_DAMAGE = value;
}

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
  maxShield: number;
  /** Bastion only: shield layers remaining, each worth the base shield (0 for every other kind). */
  shieldsRemaining: number;
  /** Distance travelled this run, in tiles. */
  dist: number;
  /** The sim tick at which this enemy spawned; the frame animation clock counts up from here. */
  spawnTick: number;
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
  /** Tower id this enemy is currently chewing through (a wall for a Breacher, any tower for a Ram). */
  attackTowerId: number | null;
  /** Breacher/Ram only: ticks until the mounted turret may fire again (0 = ready). */
  turretCooldown: number;
  /** Flyer only: ticks remaining it moves straight in `heading` before homing (brood scatter). */
  scatterTicks: number;
  /** Carrier only: ticks until the next brood release (0 = release this tick). */
  broodCooldown: number;
  dead: boolean;
}

/**
 * Enemies get tougher each wave; salvage grows more slowly so towers stay a real investment.
 * Piecewise per docs/design.md §8.3: linear to wave 20, then exponential — HP outgrows value on
 * purpose so the curve visibly bends around wave 60 and the player starts thinking about a reboot.
 *
 * Waves 101+ are endless and escalate in compounding bands (docs/design.md §8.3): the rate climbs
 * through four band steps and then +0.005 every 25 waves, capped at 1.12, so a maxed board cannot
 * coast forever.
 */

/** The per-wave HP growth multiplier for endless waves (101+). */
export function endlessHpRate(wave: number): number {
  const w = Math.max(101, wave);
  if (w <= 125) return 1.02;
  if (w <= 150) return 1.035;
  if (w <= 175) return 1.05;
  return Math.min(1.12, (1065 + 5 * Math.floor((w - 176) / 25)) / 1000);
}

export function waveHpScale(wave: number): number {
  const w = Math.max(1, wave);
  if (w <= 20) return 1 + 0.18 * (w - 1);
  if (w <= 60) return 4.42 * Math.pow(1.015, w - 20);
  if (w <= 100) return 4.42 * Math.pow(1.015, 40) * Math.pow(1.001, w - 60);
  let scale = 4.42 * Math.pow(1.015, 40) * Math.pow(1.001, 40);
  for (let i = 101; i <= w; i++) scale *= endlessHpRate(i);
  return scale;
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
  const isFlyer = isFlyerKind(kind);
  const heading = isFlyer ? Math.atan2(exit.row - spawn.row, exit.col - spawn.col) : 0;
  return {
    id,
    kind,
    wave,
    isBoss: isBossKind(kind),
    towerDamaged: false,
    hp,
    maxHp: hp,
    shield,
    maxShield: shield,
    shieldsRemaining: kind === 'shielded-boss' ? BASTION_SHIELD_LAYERS : 0,
    dist: 0,
    spawnTick: 0,
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
    attackTowerId: null,
    turretCooldown: 0,
    scatterTicks: 0,
    broodCooldown: kind === 'flyer-boss' ? CARRIER_BROOD_INTERVAL_TICKS : 0,
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
