import { secondsToTicks } from './time.ts';

export type TowerKind = 'gun' | 'cannon' | 'taser';

export interface TowerStats {
  readonly name: string;
  readonly blurb: string;
  readonly cost: number;
  /** Range in tiles, measured from the tower's centre to the enemy's hitbox edge. */
  readonly range: number;
  readonly damage: number;
  /** Ticks between shots. */
  readonly fireInterval: number;
  /** Splash radius in tiles around the primary target (0 = single target). */
  readonly splash: number;
  /** If true, enemy armour is not subtracted from this tower's hits. */
  readonly ignoresArmour: boolean;
}

export const TOWER_KINDS: readonly TowerKind[] = ['gun', 'cannon', 'taser'];

/** Data, not code: balance lives here. */
export const TOWER_STATS: Readonly<Record<TowerKind, TowerStats>> = {
  gun: {
    name: 'Gun',
    blurb: 'Cheap, single target',
    cost: 25,
    range: 2.6,
    damage: 4,
    fireInterval: secondsToTicks(0.5),
    splash: 0,
    ignoresArmour: false,
  },
  cannon: {
    name: 'Cannon',
    blurb: 'Slow, splash',
    cost: 60,
    range: 3.0,
    damage: 10,
    fireInterval: secondsToTicks(1.6),
    splash: 1.0,
    ignoresArmour: false,
  },
  taser: {
    name: 'Taser',
    blurb: 'Short range, fast, ignores armour',
    cost: 45,
    range: 1.6,
    damage: 2,
    fireInterval: secondsToTicks(0.15),
    splash: 0,
    ignoresArmour: true,
  },
};

export interface Tower {
  readonly id: number;
  readonly kind: TowerKind;
  readonly col: number;
  readonly row: number;
  /** Ticks until the tower may fire again. */
  cooldown: number;
  /** Id of the enemy hit by the most recent shot, for drawing a tracer. */
  lastTargetId: number | null;
  /** Ticks remaining on the muzzle flash / tracer. */
  flash: number;
}

export function createTower(id: number, kind: TowerKind, col: number, row: number): Tower {
  return { id, kind, col, row, cooldown: 0, lastTargetId: null, flash: 0 };
}
