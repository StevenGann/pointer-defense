import { pointAlongPath, type Grid } from './grid.ts';
import { TICK_HZ } from './time.ts';

export type EnemyKind = 'grunt' | 'runner' | 'shielded';

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
}

const GRUNT_SPEED = 1.6;

/**
 * Data, not code: balance lives here.
 *
 * The runner "resists towers" without a damage multiplier: it is 2.2x as fast (less time inside
 * any tower's range) and has a small hitbox (range and splash are measured to its edge, so it
 * slips out of reach sooner and is rarely caught by cannon splash). The pointer is the answer.
 */
export const ENEMY_STATS: Readonly<Record<EnemyKind, EnemyStats>> = {
  grunt: { name: 'Grunt', hp: 20, speed: GRUNT_SPEED, radius: 0.3, armour: 0, shield: 0, value: 4 },
  runner: { name: 'Runner', hp: 10, speed: GRUNT_SPEED * 2.2, radius: 0.18, armour: 0, shield: 0, value: 6 },
  shielded: { name: 'Shielded', hp: 30, speed: 1.2, radius: 0.36, armour: 2, shield: 15, value: 10 },
};

export interface Enemy {
  readonly id: number;
  readonly kind: EnemyKind;
  hp: number;
  readonly maxHp: number;
  shield: number;
  readonly maxShield: number;
  /** Distance travelled along the lane, in tiles. */
  dist: number;
  x: number;
  y: number;
  /** Position at the previous tick, for render interpolation. */
  prevX: number;
  prevY: number;
  /** Salvage paid on death before the pointer bonus. */
  readonly value: number;
  dead: boolean;
}

/** Enemies get tougher each wave; salvage grows more slowly so towers stay a real investment. */
export function waveHpScale(wave: number): number {
  return 1 + 0.18 * (wave - 1);
}

export function waveValueScale(wave: number): number {
  return 1 + 0.1 * (wave - 1);
}

export function createEnemy(id: number, kind: EnemyKind, wave: number, grid: Grid): Enemy {
  const s = ENEMY_STATS[kind];
  const p = pointAlongPath(grid, 0);
  const hp = Math.round(s.hp * waveHpScale(wave));
  const shield = Math.round(s.shield * waveHpScale(wave));
  return {
    id,
    kind,
    hp,
    maxHp: hp,
    shield,
    maxShield: shield,
    dist: 0,
    x: p.x,
    y: p.y,
    prevX: p.x,
    prevY: p.y,
    value: Math.round(s.value * waveValueScale(wave)),
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
