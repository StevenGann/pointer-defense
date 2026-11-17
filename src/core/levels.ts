import { COLS, ROWS, inBounds, tileAt, type Grid, type Tile, type TileKind } from './grid.ts';
import { isSealed } from './pathfield.ts';

/**
 * Authored maps (docs/design.md §5).
 *
 * Each level is a 20 x 12 board of buildable tiles, a handful of wall tiles (`#`) and exactly one
 * start and one exit. Walls are part of the terrain — never buildable, never walkable — so a level
 * forces the route to wind before the player lays a single tower. The player's towers are still
 * walls, so mazing happens on top of the authored geometry.
 */

/**
 * A map toggle ("shutter"): a buildable tile that flips between open floor and closed wall on its
 * own timer. Its state is a pure function of the run clock (§5.6): open while
 * `(clock + phaseTicks) % periodTicks < openTicks`, closed otherwise.
 */
export interface LevelToggle {
  readonly col: number;
  readonly row: number;
  /** Length of one full open/closed cycle, in ticks (e.g. 900 = 15 s at 60 Hz). */
  readonly periodTicks: number;
  /** Ticks of each cycle the toggle is open (0 = never open, period = never closed). */
  readonly openTicks: number;
  /** Offset added to the clock so two toggles on a map do not move in lockstep. */
  readonly phaseTicks: number;
}

export interface Level {
  readonly id: string;
  /** Shown in the panel, e.g. 'The Corridor'. */
  readonly name: string;
  /** Wall tiles as [col, row]. */
  readonly walls: readonly (readonly [number, number])[];
  /** v0.10b: exactly one. */
  readonly starts: readonly Tile[];
  /** v0.10b: exactly one. */
  readonly exits: readonly Tile[];
  /** Optional map toggles (shutters); at most MAX_TOGGLES. */
  readonly toggles?: readonly LevelToggle[];
}

function vertical(col: number, r0: number, r1: number): readonly (readonly [number, number])[] {
  const out: [number, number][] = [];
  for (let r = r0; r <= r1; r++) out.push([col, r]);
  return out;
}

function horizontal(row: number, c0: number, c1: number): readonly (readonly [number, number])[] {
  const out: [number, number][] = [];
  for (let c = c0; c <= c1; c++) out.push([c, row]);
  return out;
}

/** Four baffles force four switchbacks; the route winds 48 tiles through the gaps. */
const CORRIDOR_WALLS: readonly (readonly [number, number])[] = [
  ...vertical(4, 0, 8),
  ...vertical(8, 3, 11),
  ...vertical(12, 0, 8),
  ...vertical(16, 3, 11),
];

/** Two 6-wide halls joined by a 2-tile neck; a wide field the player mazes inside. */
const DUMBBELL_WALLS: readonly (readonly [number, number])[] = [
  ...vertical(2, 2, 9),
  ...vertical(17, 2, 9),
  ...horizontal(2, 2, 6),
  ...horizontal(2, 13, 17),
  ...horizontal(9, 2, 6),
  ...horizontal(9, 13, 17),
  ...vertical(8, 5, 7),
  ...vertical(11, 5, 7),
];

/** Today's board: the ten decorative desk-object tiles, kept as the easy map. */
const OPEN_FIELD_WALLS: readonly (readonly [number, number])[] = [
  [1, 9], [2, 9], [1, 10],
  [11, 0], [12, 0],
  [18, 1],
  [6, 11], [7, 11],
  [11, 6], [12, 6],
];

export const LEVELS: readonly Level[] = [
  {
    id: 'corridor',
    name: 'The Corridor',
    walls: CORRIDOR_WALLS,
    starts: [{ col: 0, row: 6 }],
    exits: [{ col: COLS - 1, row: 6 }],
  },
  {
    id: 'dumbbell',
    name: 'Dumbbell',
    walls: DUMBBELL_WALLS,
    starts: [{ col: 0, row: 6 }],
    exits: [{ col: COLS - 1, row: 6 }],
  },
  {
    id: 'open-field',
    name: 'Open Field',
    walls: OPEN_FIELD_WALLS,
    starts: [{ col: 0, row: 6 }],
    exits: [{ col: COLS - 1, row: 6 }],
  },
];

/** The level a fresh run begins on; cycling before wave 1 visits the others. */
export const DEFAULT_LEVEL: Level = LEVELS[0];

/** The level for an id, falling back to the default so a stale id cannot crash the run. */
export function levelById(id: string): Level {
  return LEVELS.find((l) => l.id === id) ?? DEFAULT_LEVEL;
}

/** The most toggles a level may author: 2^4 = 16 combinations to check at load and on placement. */
export const MAX_TOGGLES = 4;

/** The flat tile index of a toggle. */
export function toggleIndex(t: LevelToggle): number {
  return t.row * COLS + t.col;
}

/** The toggle's position within its cycle, folded into [0, periodTicks). */
export function togglePhase(t: LevelToggle, clock: number): number {
  const period = t.periodTicks;
  return ((clock + t.phaseTicks) % period + period) % period;
}

/** Open while (clock + phaseTicks) % periodTicks < openTicks; pure in the clock. */
export function toggleOpenAt(t: LevelToggle, clock: number): boolean {
  return togglePhase(t, clock) < t.openTicks;
}

/** Fraction (0..1) of the current state elapsed toward the next change; 0 at a flip, 1 just before it. */
export function toggleProgress(t: LevelToggle, clock: number): number {
  const period = t.periodTicks;
  const phase = togglePhase(t, clock);
  if (phase < t.openTicks) return t.openTicks === 0 ? 0 : phase / t.openTicks;
  const closed = period - t.openTicks;
  return closed === 0 ? 0 : (phase - t.openTicks) / closed;
}

/** The authored toggles of a level (empty when it has none). */
export function levelToggles(level: Level): readonly LevelToggle[] {
  return level.toggles ?? [];
}

/**
 * Every reachable combination of toggle states, as the set of closed-toggle tile indices. A toggle
 * whose window is the whole period is never closed, one whose window is empty is never open; only a
 * partial window contributes both states, so at most 2^MAX_TOGGLES combinations are produced.
 */
export function toggleCombinations(toggles: readonly LevelToggle[]): ReadonlyArray<ReadonlySet<number>> {
  const alwaysClosed: number[] = [];
  const toggling: LevelToggle[] = [];
  for (const t of toggles) {
    if (t.openTicks >= t.periodTicks) continue; // always open
    if (t.openTicks <= 0) alwaysClosed.push(toggleIndex(t)); // always closed
    else toggling.push(t);
  }
  const out: Set<number>[] = [];
  const n = toggling.length;
  for (let mask = 0; mask < (1 << n); mask++) {
    const closed = new Set(alwaysClosed);
    for (let i = 0; i < n; i++) if (mask & (1 << i)) closed.add(toggleIndex(toggling[i]));
    out.push(closed);
  }
  return out;
}

/**
 * Load-time validation. Returns null when the level is safe to run, otherwise a named reason.
 * A level whose toggles can seal the spawn-to-exit route in any combination of states is rejected.
 */
export function validateLevel(level: Level): string | null {
  const toggles = levelToggles(level);
  if (toggles.length > MAX_TOGGLES) return 'too many toggles';
  const grid = createGrid(level);
  for (const t of toggles) {
    if (!inBounds(t.col, t.row)) return 'toggle out of bounds';
    if (tileAt(grid, t.col, t.row) !== 'buildable') return 'toggle on a wall tile';
    if (!(t.periodTicks > 0)) return 'toggle period must be positive';
    if (!(t.openTicks >= 0 && t.openTicks <= t.periodTicks)) return 'toggle open window out of range';
  }
  const spawn = level.starts[0];
  const exit = level.exits[0];
  for (const closed of toggleCombinations(toggles)) {
    if (isSealed(grid, closed, spawn, exit)) return 'toggle combination seals the route';
  }
  return null;
}

export function createGrid(level: Level): Grid {
  const tiles: TileKind[] = new Array<TileKind>(COLS * ROWS).fill('buildable');
  for (const [c, r] of level.walls) {
    tiles[r * COLS + c] = 'blocked';
  }
  return { cols: COLS, rows: ROWS, tiles };
}
