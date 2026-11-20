import { COLS, ROWS, inBounds, tileAt, type Grid, type Tile, type TileKind } from './grid.ts';
import { isSealed } from './pathfield.ts';
import { t } from '../i18n/index.ts';

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

/**
 * A route is a corridor of tiles from the spawn to the exit. When a level authors routes, every
 * spawned enemy is assigned one and paths only across that corridor's tiles, so a wall on one route
 * never re-routes the other. The order is only meaningful for drawing; pathing treats the route as
 * a set of walkable tiles.
 */
export type Route = readonly Tile[];

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
  /**
   * Optional authored corridors. Absent (or empty) means today's single implicit route over the whole
   * board, unchanged. When present, routes must be tile-disjoint except at the spawn and exit tiles.
   */
  readonly routes?: readonly Route[];
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

/**
 * Turnstile: a two-wide direct lane across the middle pinches to a single shutter gate, while an
 * upper hall runs the long way above it. Closing the gate severs the lane and sends creeps the long
 * way; the upper hall's own shutter is a second gate on a different period, so the two never lockstep.
 */
const TURNSTILE_WALLS: readonly (readonly [number, number])[] = [
  ...horizontal(4, 1, 18), // the hall's floor, the direct lane's ceiling
  ...horizontal(7, 0, 19), // seal the desk drawer below the lane
  [10, 5], // gate shoulder: the lane pinches to the shutter tile
];

/** The two shutters: the direct gate (15 s) and the upper-hall gate (10 s), offset out of lockstep. */
const TURNSTILE_TOGGLES: readonly LevelToggle[] = [
  { col: 10, row: 6, periodTicks: 900, openTicks: 420, phaseTicks: 0 },
  { col: 9, row: 1, periodTicks: 600, openTicks: 240, phaseTicks: 300 },
];

/** A solid rectangle of wall tiles, for filling the inside of a carved corridor. */
function box(c0: number, c1: number, r0: number, r1: number): readonly (readonly [number, number])[] {
  const out: [number, number][] = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push([c, r]);
  return out;
}

/** A solid rectangle of corridor tiles, for a route's walkable set. */
function band(c0: number, c1: number, r0: number, r1: number): Route {
  const out: Tile[] = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) out.push({ col: c, row: r });
  return out;
}

/** A vertical run of corridor tiles. */
function column(col: number, r0: number, r1: number): Route {
  const out: Tile[] = [];
  for (let r = r0; r <= r1; r++) out.push({ col, row: r });
  return out;
}

/** A horizontal run of corridor tiles. */
function rowRun(row: number, c0: number, c1: number): Route {
  const out: Tile[] = [];
  for (let c = c0; c <= c1; c++) out.push({ col: c, row });
  return out;
}

/**
 * The Fork: one spawn splits into an upper and a lower corridor of equal length that rejoin at the
 * exit. A full wall across row 1 seals the top, row 11 seals the bottom, and a row-6 divider with
 * gaps only at the spawn and exit columns forces every path through one corridor or the other.
 */
const FORK_WALLS: readonly (readonly [number, number])[] = [
  ...horizontal(1, 0, 19),
  ...horizontal(6, 1, 18),
  ...horizontal(11, 0, 19),
];

const FORK_UPPER: Route = [{ col: 0, row: 6 }, ...band(0, 19, 2, 5), { col: 19, row: 6 }];
const FORK_LOWER: Route = [{ col: 0, row: 6 }, ...band(0, 19, 7, 10), { col: 19, row: 6 }];

/**
 * The Ladder: two vertical corridors (the rails) joined by two horizontal cross-links (the rungs),
 * forming a hollow rectangle. Route A walks the left rail and the bottom rung; route B walks the top
 * rung and the right rail. The two share only the spawn corner (0,2) and the exit corner (17,9).
 */
const LADDER_WALLS: readonly (readonly [number, number])[] = [
  ...horizontal(0, 0, 19),
  ...horizontal(1, 0, 19),
  ...horizontal(10, 0, 19),
  ...horizontal(11, 0, 19),
  ...vertical(18, 2, 9),
  ...vertical(19, 2, 9),
  ...box(1, 16, 3, 8),
];

const LADDER_LEFT: Route = [{ col: 0, row: 2 }, ...column(0, 3, 9), ...rowRun(9, 1, 17)];
const LADDER_RIGHT: Route = [{ col: 0, row: 2 }, ...rowRun(2, 1, 17), ...column(17, 3, 9)];

export const LEVELS: readonly Level[] = [
  {
    id: 'corridor',
    name: t('level.corridor.name'),
    walls: CORRIDOR_WALLS,
    starts: [{ col: 0, row: 6 }],
    exits: [{ col: COLS - 1, row: 6 }],
  },
  {
    id: 'dumbbell',
    name: t('level.dumbbell.name'),
    walls: DUMBBELL_WALLS,
    starts: [{ col: 0, row: 6 }],
    exits: [{ col: COLS - 1, row: 6 }],
  },
  {
    id: 'open-field',
    name: t('level.openField.name'),
    walls: OPEN_FIELD_WALLS,
    starts: [{ col: 0, row: 6 }],
    exits: [{ col: COLS - 1, row: 6 }],
  },
  {
    id: 'turnstile',
    name: t('level.turnstile.name'),
    walls: TURNSTILE_WALLS,
    starts: [{ col: 0, row: 6 }],
    exits: [{ col: COLS - 1, row: 6 }],
    toggles: TURNSTILE_TOGGLES,
  },
  {
    id: 'fork',
    name: t('level.fork.name'),
    walls: FORK_WALLS,
    starts: [{ col: 0, row: 6 }],
    exits: [{ col: COLS - 1, row: 6 }],
    routes: [FORK_UPPER, FORK_LOWER],
  },
  {
    id: 'ladder',
    name: t('level.ladder.name'),
    walls: LADDER_WALLS,
    starts: [{ col: 0, row: 2 }],
    exits: [{ col: 17, row: 9 }],
    routes: [LADDER_LEFT, LADDER_RIGHT],
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

/**
 * A deterministic id for a level built from its geometry: walls, toggles, start and exit. The name
 * and the id itself are not part of the hash, so two levels that differ only by label still collide
 * — and that is fine, because the id is only used to key the board's static tile layer.
 */
export function levelFingerprint(level: Level): string {
  let h = 0x811c9dc5;
  const mix = (n: number): void => {
    for (let i = 0; i < 4; i++) {
      h ^= n & 0xff;
      h = Math.imul(h, 0x01000193);
      n >>>= 8;
    }
  };
  const walls = [...level.walls].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (const [c, r] of walls) {
    mix(c);
    mix(r);
  }
  for (const t of [...(level.toggles ?? [])].sort((a, b) => a.col - b.col || a.row - b.row)) {
    mix(t.col);
    mix(t.row);
    mix(t.periodTicks);
    mix(t.openTicks);
    mix(t.phaseTicks);
  }
  mix(level.starts[0]?.col ?? -1);
  mix(level.starts[0]?.row ?? -1);
  mix(level.exits[0]?.col ?? -1);
  mix(level.exits[0]?.row ?? -1);
  return (h >>> 0).toString(16);
}

/** A plain-language description of a validateLevel reason, for the editor status line and the
 *  load-code dialog. Reused so the game and the editor never disagree about what is wrong. */
export function levelProblemMessage(reason: string): string {
  switch (reason) {
    case 'too many toggles':
      return t('level.problem.tooManyShutters');
    case 'toggle out of bounds':
      return t('level.problem.shutterOutOfBounds');
    case 'toggle on a wall tile':
      return t('level.problem.shutterOnWall');
    case 'toggle period must be positive':
      return t('level.problem.shutterPeriodPositive');
    case 'toggle open window out of range':
      return t('level.problem.shutterOpenWindowRange');
    case 'toggle combination seals the route':
      return t('level.problem.sealedRoute');
    case 'routes overlap':
      return t('level.problem.routesOverlap');
    default:
      return reason;
  }
}

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

/** The authored routes of a level (empty means today's single implicit route). */
export function levelRoutes(level: Level): readonly Route[] {
  return level.routes ?? [];
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
  const reason = routeProblem(level);
  if (reason !== null) return reason;
  const spawn = level.starts[0];
  const exit = level.exits[0];
  for (const closed of toggleCombinations(toggles)) {
    if (isSealed(grid, closed, spawn, exit)) return 'toggle combination seals the route';
  }
  return null;
}

/** A tile is shared between routes legitimately only if it is a spawn or an exit tile. */
function isStartOrExit(level: Level, idx: number): boolean {
  for (const t of level.starts) if (t.row * COLS + t.col === idx) return true;
  for (const t of level.exits) if (t.row * COLS + t.col === idx) return true;
  return false;
}

/**
 * Routes must be tile-disjoint except at the spawn and exit: a tile that appears in two routes (and is
 * not one of those shared endpoints) would let one route's walls re-route the other, breaking the
 * isolation the mechanic depends on.
 */
function routeProblem(level: Level): string | null {
  const routes = levelRoutes(level);
  for (let i = 0; i < routes.length; i++) {
    const a = new Set<number>();
    for (const t of routes[i]) a.add(t.row * COLS + t.col);
    for (let j = i + 1; j < routes.length; j++) {
      for (const t of routes[j]) {
        const idx = t.row * COLS + t.col;
        if (a.has(idx) && !isStartOrExit(level, idx)) return 'routes overlap';
      }
    }
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
