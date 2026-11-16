import type { EnemyKind } from './enemies.ts';
import { secondsToTicks } from './time.ts';

/**
 * Waves 1..10: one lane, towers teach, clicking is a nudge (docs/design.md, band 1–10).
 *
 * Each wave is a list of groups. A group spawns `count` enemies of one kind, `interval` ticks
 * apart, starting `delay` ticks after the wave begins. Groups may overlap, which is how mixed
 * waves are made without listing every enemy.
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

const g = (kind: EnemyKind, count: number, intervalS: number, delayS = 0): SpawnGroup => ({
  kind,
  count,
  interval: secondsToTicks(intervalS),
  delay: delayS === 0 ? 0 : secondsToTicks(delayS),
});

export const WAVES: readonly WaveDef[] = [
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

export const WAVE_COUNT = WAVES.length;

/** Flatten a wave into a tick-ordered spawn schedule. Ties keep group order (stable sort). */
export function buildSchedule(wave: number): Spawn[] {
  const def = WAVES[wave - 1];
  if (!def) return [];
  const out: Spawn[] = [];
  for (const grp of def.groups) {
    for (let i = 0; i < grp.count; i++) out.push({ tick: grp.delay + i * grp.interval, kind: grp.kind });
  }
  return out.sort((a, b) => a.tick - b.tick);
}

export function waveEnemyCount(wave: number): number {
  return WAVES[wave - 1]?.groups.reduce((n, grp) => n + grp.count, 0) ?? 0;
}
