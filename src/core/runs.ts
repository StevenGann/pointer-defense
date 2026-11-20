import type { RunState } from './state.ts';
import { MAX_RUNS, type Profile, type RunOutcome, type RunRecord } from './save.ts';

/**
 * Run history (docs/RUN-RECORDS.md).
 *
 * A record is captured at the moment a run ends — victory, defeat, or Restart Windows — and pushed
 * onto `profile.runs`, newest first, capped at 50. Every view over the history (best wave per map,
 * the totals line, rankings) is computed from the records, never stored.
 */

/** A fresh record id. UUID when available, a timestamp fallback otherwise. */
function newRunId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (typeof g.crypto?.randomUUID === 'function') return g.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Build the record for a run that just ended, stamped with the current time. */
export function buildRunRecord(state: RunState, outcome: RunOutcome): RunRecord {
  return {
    id: newRunId(),
    at: new Date().toISOString(),
    mapId: state.levelId,
    mapName: state.level.name,
    wave: state.wave,
    clearedWaves: state.clearedWaves,
    integrity: state.integrity,
    pointerStage: state.pointer.stage,
    salvage: state.economy.earned,
    durationTicks: state.tick,
    outcome,
    victory: outcome === 'victory',
  };
}

/** Append a record, newest first, dropping the oldest once the list reaches MAX_RUNS. */
export function appendRun(profile: Profile, record: RunRecord): void {
  profile.runs.unshift(record);
  if (profile.runs.length > MAX_RUNS) profile.runs.length = MAX_RUNS;
}

export interface RunTotals {
  runs: number;
  wins: number;
  defeats: number;
  reboots: number;
  /** Total play time across all recorded runs, in sim ticks. */
  durationTicks: number;
}

/** The totals line figures, computed from the records alone (never stored). */
export function runTotals(runs: readonly RunRecord[]): RunTotals {
  let wins = 0;
  let defeats = 0;
  let reboots = 0;
  let durationTicks = 0;
  for (const r of runs) {
    if (r.outcome === 'victory') wins++;
    else if (r.outcome === 'defeat') defeats++;
    else reboots++;
    durationTicks += r.durationTicks;
  }
  return { runs: runs.length, wins, defeats, reboots, durationTicks };
}

export interface BestByMap {
  mapId: string;
  mapName: string;
  wave: number;
}

/** The best wave per map, highest first, computed from the records alone (never stored). */
export function bestByMap(runs: readonly RunRecord[]): BestByMap[] {
  const best = new Map<string, BestByMap>();
  for (const r of runs) {
    const cur = best.get(r.mapId);
    if (!cur || r.wave > cur.wave) best.set(r.mapId, { mapId: r.mapId, mapName: r.mapName, wave: r.wave });
  }
  return [...best.values()].sort((a, b) => b.wave - a.wave);
}
