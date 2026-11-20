import { LEVELS, type Level } from './levels.ts';

/**
 * The daily challenge (docs/DAILY.md): one seeded run per local day, the same for everyone on that
 * date. The date string is hashed to a stable 32-bit seed; the map is `LEVELS[hash(date) %
 * LEVELS.length]` and the seed becomes the run's `rng`, so two players on the same date face the same
 * board and the same crit rolls.
 */

/** A daily is thirty waves, not a hundred. */
export const DAILY_WAVES = 30;

/** FNV-1a 32-bit hash of the YYYY-MM-DD date, stable across platforms. */
export function hashDaily(date: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < date.length; i++) {
    h ^= date.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The local date as YYYY-MM-DD, from an explicit Date (defaults to now). */
export function dailyDate(date: Date = new Date()): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${day}`;
}

/** The seeded map for a date: LEVELS[hash(date) % LEVELS.length]. */
export function dailyLevel(date: string): Level {
  return LEVELS[hashDaily(date) % LEVELS.length];
}

/** The run seed for a date: hash(date). */
export function dailySeed(date: string): number {
  return hashDaily(date);
}

export interface DailyPlan {
  date: string;
  seed: number;
  level: Level;
}

/** The full plan for a date, in one call. */
export function dailyFor(date: string): DailyPlan {
  return { date, seed: dailySeed(date), level: dailyLevel(date) };
}

/** The Daily button's label: `Daily — <date>`, or `Daily done — wave <n>` once today is played. */
export function dailyMenuLabel(played: { date: string; wave: number } | null, today: string): string {
  return played !== null && played.date === today ? `Daily done — wave ${played.wave}` : `Daily — ${today}`;
}

/** Whether the daily is still available today (it turns over at local midnight). */
export function dailyAvailable(played: { date: string } | null, today: string): boolean {
  return played === null || played.date !== today;
}
