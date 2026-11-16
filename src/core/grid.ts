/**
 * The board geometry: a fixed 20 x 12 tile grid. World units are tiles. Tile (col, row) covers
 * [col, col+1) x [row, row+1), so its centre is (col + 0.5, row + 0.5). The view multiplies world
 * units by the current cell size in pixels; the simulation never knows how big a pixel is.
 *
 * The route is not fixed: creeps path downhill across a distance field (see pathfield.ts). Towers
 * are walls, so the maze is whatever the player builds on top of the authored map (see levels.ts).
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

export interface Grid {
  readonly cols: number;
  readonly rows: number;
  /** Row-major, length cols * rows. */
  readonly tiles: readonly TileKind[];
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
