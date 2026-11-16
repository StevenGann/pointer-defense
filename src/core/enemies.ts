import type { Tile } from './grid.ts';
import { TICK_HZ } from './time.ts';

export type EnemyKind = 'grunt' | 'runner' | 'shielded' | 'flyer';

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
 *
 * The flyer ignores the maze entirely: it flies a straight line from spawn to exit, fast and frail,
 * so it is a check on raw coverage rather than on the player's wall-building.
 */
export const ENEMY_STATS: Readonly<Record<EnemyKind, EnemyStats>> = {
  grunt: { name: 'Grunt', hp: 20, speed: GRUNT_SPEED, radius: 0.3, armour: 0, shield: 0, value: 4 },
  runner: { name: 'Runner', hp: 10, speed: GRUNT_SPEED * 2.2, radius: 0.18, armour: 0, shield: 0, value: 6 },
  shielded: { name: 'Shielded', hp: 30, speed: 1.2, radius: 0.36, armour: 2, shield: 15, value: 10 },
  flyer: { name: 'Flyer', hp: 8, speed: GRUNT_SPEED * 1.5, radius: 0.22, armour: 0, shield: 0, value: 5 },
};

export interface Enemy {
  readonly id: number;
  readonly kind: EnemyKind;
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
  dead: boolean;
}

/** Enemies get tougher each wave; salvage grows more slowly so towers stay a real investment. */
export function waveHpScale(wave: number): number {
  return 1 + 0.18 * (wave - 1);
}

export function waveValueScale(wave: number): number {
  return 1 + 0.1 * (wave - 1);
}

export function createEnemy(id: number, kind: EnemyKind, wave: number, spawn: Tile, exit: Tile): Enemy {
  const s = ENEMY_STATS[kind];
  const hp = Math.round(s.hp * waveHpScale(wave));
  const shield = Math.round(s.shield * waveHpScale(wave));
  const x = spawn.col + 0.5;
  const y = spawn.row + 0.5;
  const isFlyer = kind === 'flyer';
  return {
    id,
    kind,
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
    targetCol: isFlyer ? exit.col : -1,
    targetRow: isFlyer ? exit.row : -1,
    value: Math.round(s.value * waveValueScale(wave)),
    slowFactor: 1,
    slowUntilTick: 0,
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
