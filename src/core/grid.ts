/**
 * The board: a fixed 20 x 12 tile grid, mostly buildable with a scatter of decorative obstacles.
 *
 * World units are tiles. Tile (col, row) covers [col, col+1) x [row, row+1), so its centre is
 * (col + 0.5, row + 0.5). The view multiplies world units by the current cell size in pixels;
 * the simulation never knows how big a pixel is.
 *
 * The route is not fixed: creeps path downhill across a distance field (see pathfield.ts). Towers
 * are walls, so the maze is whatever the player builds. The only fixed landmarks are SPAWN and EXIT.
 */

export const COLS = 20;
export const ROWS = 12;

export type TileKind = 'buildable' | 'blocked';

export interface Point {
  x: number;
  y: number;
}

export interface Tile {
  col: number;
  row: number;
}

/** Creeps enter here, on the left edge. */
export const SPAWN: Tile = { col: 0, row: 6 };

/** Creeps leak here, on the right edge, on the same row as the spawn. */
export const EXIT: Tile = { col: COLS - 1, row: 6 };

/** Decorative obstacles ("desktop clutter"): never buildable, never walkable. */
const BLOCKED_TILES: readonly (readonly [number, number])[] = [
  [1, 9], [2, 9], [1, 10],
  [11, 0], [12, 0],
  [18, 1],
  [6, 11], [7, 11],
  [11, 6], [12, 6],
];

export interface Grid {
  readonly cols: number;
  readonly rows: number;
  /** Row-major, length cols * rows. */
  readonly tiles: readonly TileKind[];
}

export function createGrid(): Grid {
  const tiles: TileKind[] = new Array<TileKind>(COLS * ROWS).fill('buildable');
  for (const [c, r] of BLOCKED_TILES) {
    tiles[r * COLS + c] = 'blocked';
  }
  return { cols: COLS, rows: ROWS, tiles };
}

export function inBounds(col: number, row: number): boolean {
  return col >= 0 && col < COLS && row >= 0 && row < ROWS;
}

export function tileAt(grid: Grid, col: number, row: number): TileKind | undefined {
  return inBounds(col, row) ? grid.tiles[row * grid.cols + col] : undefined;
}

/** Centre of a tile in world units. */
export function tileToWorld(col: number, row: number): Point {
  return { x: col + 0.5, y: row + 0.5 };
}

/** The tile containing a world point (may be out of bounds; check with inBounds). */
export function worldToTile(x: number, y: number): Tile {
  return { col: Math.floor(x), row: Math.floor(y) };
}
