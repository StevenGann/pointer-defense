import { secondsToTicks } from './time.ts';

/**
 * Projectiles are the AA tower's slow munitions: a Flak shell and a homing missile. They are the
 * first real (non-hitscan) entities in the sim — they tick with the fixed timestep, integrate their
 * motion from the same dt as everything else, and are removed on hit or expiry. The shape here is
 * deliberately small: the sim owns position and velocity, the view draws the vector shape.
 */

export type ProjectileKind = 'shell' | 'missile';

export interface Projectile {
  readonly id: number;
  readonly kind: ProjectileKind;
  x: number;
  y: number;
  /** Velocity in tiles per second. */
  vx: number;
  vy: number;
  /** The enemy the projectile homes toward (missile) or the shell's designated target. */
  targetId: number | null;
  /** The tower that fired this projectile, for kill/damage attribution. */
  readonly towerId: number;
  /** Damage the projectile carries (before the per-enemy flyer/shielded multipliers). */
  damage: number;
  /** Ticks remaining; resolved (burst/expire) when it reaches 0. */
  lifetime: number;
}

/** A Flak shell's travel speed, tiles per second. */
export const SHELL_SPEED = 20;

/** Missile speed at launch, tiles per second. */
export const MISSILE_INITIAL_SPEED = 6;
/** Missile acceleration, tiles per second squared. */
export const MISSILE_ACCEL = 15;
/** Missile terminal speed, tiles per second. */
export const MISSILE_MAX_SPEED = 9;
/** Missile turn rate, radians per second (about 860°/s). */
export const MISSILE_TURN_RATE = 15;
/** A missile expires this long after launch when it cannot find a target. */
export const MISSILE_LIFETIME_TICKS = secondsToTicks(2);
/**
 * A missile whose target dies retargets to the nearest flyer within this radius **of the missile
 * itself** — not of the tower that launched it. The missile is already out over the field by then,
 * so the launch site is the wrong centre for the search.
 */
export const MISSILE_RETARGET_RANGE = 6;
/** A missile detonates when it closes to the target's radius plus this much (tiles). */
export const MISSILE_HIT_RANGE = 0.5;

/** Missiles launched in one salvo. */
export const AA_SALVO_COUNT = 4;

/**
 * The seed for a missile salvo's launch directions: a deterministic hash of the simulation tick, the
 * firing tower and the tower's salvo counter. Feeding this to `rngNext` reproduces the exact same
 * four directions for the same (tick, tower, salvo), and it never touches the run's own PRNG stream,
 * so firing missiles cannot shift the pointer's crit rolls (see ads.ts for the same rule).
 */
export function missileSeed(tick: number, towerId: number, salvoIndex: number): number {
  let x = (tick ^ Math.imul(towerId, 0x9e3779b9) ^ Math.imul(salvoIndex, 0x85ebca6b)) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = x ^ (x >>> 16);
  return x >>> 0;
}
