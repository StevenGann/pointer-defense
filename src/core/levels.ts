import { COLS, ROWS, type Grid, type Tile, type TileKind } from './grid.ts';

/**
 * Authored maps (docs/design.md §5).
 *
 * Each level is a 20 x 12 board of buildable tiles, a handful of wall tiles (`#`) and exactly one
 * start and one exit. Walls are part of the terrain — never buildable, never walkable — so a level
 * forces the route to wind before the player lays a single tower. The player's towers are still
 * walls, so mazing happens on top of the authored geometry.
 */

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

export function createGrid(level: Level): Grid {
  const tiles: TileKind[] = new Array<TileKind>(COLS * ROWS).fill('buildable');
  for (const [c, r] of level.walls) {
    tiles[r * COLS + c] = 'blocked';
  }
  return { cols: COLS, rows: ROWS, tiles };
}
