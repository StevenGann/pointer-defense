/**
 * Simulation clock.
 *
 * The sim advances in fixed 1/60 s ticks regardless of display refresh rate. A clicker's numbers
 * are sensitive to time: if the sim stepped by frame delta, a 144 Hz monitor would integrate
 * damage-over-time and movement slightly differently from a 60 Hz one, a long frame could tunnel
 * an enemy past a tower's range, and the smoke test could not reproduce a run exactly. With a fixed
 * tick, all timings in the tables are whole ticks and the same inputs always give the same run.
 */
export const TICK_HZ = 60;
export const TICK_MS = 1000 / TICK_HZ;

/** Seconds to whole ticks (at least 1). */
export function secondsToTicks(s: number): number {
  return Math.max(1, Math.round(s * TICK_HZ));
}
