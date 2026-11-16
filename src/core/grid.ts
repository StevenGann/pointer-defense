/**
 * The board: a fixed 20 x 12 tile grid with one hand-made lane.
 *
 * World units are tiles. Tile (col, row) covers [col, col+1) x [row, row+1), so its centre is
 * (col + 0.5, row + 0.5). The view multiplies world units by the current cell size in pixels;
 * the simulation never knows how big a pixel is.
 */

export const COLS = 20;
export const ROWS = 12;

export type TileKind = 'buildable' | 'path' | 'blocked';

export interface Point {
  x: number;
  y: number;
}

export interface Tile {
  col: number;
  row: number;
}

/**
 * Lane waypoints in tile coordinates. The first and last sit one tile outside the board so enemies
 * walk in from the left edge and leave through the right edge instead of popping into existence.
 * Every leg is axis-aligned, which keeps rasterising the path trivial.
 */
export const PATH_WAYPOINTS: readonly (readonly [number, number])[] = [
  [-1, 2],
  [4, 2],
  [4, 8],
  [9, 8],
  [9, 3],
  [14, 3],
  [14, 9],
  [17, 9],
  [17, 5],
  [20, 5],
];

/** Decorative obstacles ("desktop clutter"): not path, not buildable. */
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
  /** Waypoints in world coordinates (tile centres). */
  readonly waypoints: readonly Point[];
  /** Cumulative distance along the path at each waypoint; [0] = 0. */
  readonly cumulative: readonly number[];
  /** Total walkable length in tiles. Reaching it means the enemy leaked. */
  readonly length: number;
}

export function createGrid(): Grid {
  const tiles: TileKind[] = new Array<TileKind>(COLS * ROWS).fill('buildable');

  for (let i = 1; i < PATH_WAYPOINTS.length; i++) {
    const [ax, ay] = PATH_WAYPOINTS[i - 1];
    const [bx, by] = PATH_WAYPOINTS[i];
    const steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    for (let s = 0; s <= steps; s++) {
      const c = ax + Math.sign(bx - ax) * s;
      const r = ay + Math.sign(by - ay) * s;
      if (inBounds(c, r)) tiles[r * COLS + c] = 'path';
    }
  }
  for (const [c, r] of BLOCKED_TILES) {
    if (tiles[r * COLS + c] === 'buildable') tiles[r * COLS + c] = 'blocked';
  }

  const waypoints = PATH_WAYPOINTS.map(([c, r]) => tileToWorld(c, r));
  const cumulative = [0];
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1];
    const b = waypoints[i];
    cumulative.push(cumulative[i - 1] + Math.hypot(b.x - a.x, b.y - a.y));
  }

  return { cols: COLS, rows: ROWS, tiles, waypoints, cumulative, length: cumulative[cumulative.length - 1] };
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

/** Position on the lane after travelling `dist` tiles from the entrance. */
export function pointAlongPath(grid: Grid, dist: number): Point {
  const { waypoints, cumulative } = grid;
  if (dist <= 0) return { ...waypoints[0] };
  for (let i = 1; i < waypoints.length; i++) {
    if (dist <= cumulative[i]) {
      const a = waypoints[i - 1];
      const b = waypoints[i];
      const t = (dist - cumulative[i - 1]) / (cumulative[i] - cumulative[i - 1]);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
  }
  return { ...waypoints[waypoints.length - 1] };
}
