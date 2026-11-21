import { COLS, ROWS, inBounds, type Grid, type Tile } from './grid.ts';

/**
 * Free pathing: a distance field over the board, rebuilt whenever towers change the maze.
 *
 * Creeps walk downhill on the field — each step moves to the neighbouring tile closest to the exit —
 * which makes them take the shortest route through whatever maze the player has built. Towers are
 * walls, so every placement rewrites the field. Ties are broken in a fixed order (up, left, right,
 * down) so the route, and therefore the whole simulation, stays deterministic.
 */

const DIRS: readonly (readonly [number, number])[] = [
  [0, -1], // up
  [-1, 0], // left
  [1, 0], // right
  [0, 1], // down
];

/**
 * Breadth-first search from the exit over every tile `walkable` permits, storing the distance in
 * tiles to the exit. `-1` marks tiles the exit cannot be reached from. All edges cost one tile, so a
 * FIFO queue of buckets (one per distance) is a valid Dijkstra without a priority queue.
 */
function bfs(cols: number, rows: number, walkable: (idx: number) => boolean, exit: Tile): Int32Array {
  const n = cols * rows;
  const field = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;

  const start = exit.row * cols + exit.col;
  field[start] = 0;
  queue[tail++] = start;

  while (head < tail) {
    const idx = queue[head++];
    const dist = field[idx];
    const col = idx % cols;
    const row = (idx - col) / cols;
    for (let i = 0; i < DIRS.length; i++) {
      const c = col + DIRS[i][0];
      const r = row + DIRS[i][1];
      if (!inBounds(c, r)) continue;
      const ni = r * cols + c;
      if (field[ni] >= 0) continue;
      if (!walkable(ni)) continue;
      field[ni] = dist + 1;
      queue[tail++] = ni;
    }
  }

  return field;
}

/**
 * The ground field: only `blocked` tiles are impassable, so both `buildable` and `no-build` tiles are
 * walkable. Towers (including walls) live in `blocked`, so every placement rewrites the field.
 */
export function buildField(grid: Grid, blocked: ReadonlySet<number>, exit: Tile): Int32Array {
  const { cols, rows, tiles } = grid;
  return bfs(cols, rows, (idx) => tiles[idx] !== 'blocked' && !blocked.has(idx), exit);
}

/**
 * The air field: every in-bounds tile is walkable and only `blocked` tiles are impassable. Flyers
 * use this, so authored terrain and ordinary towers never stop them — only a Mesh wall does.
 */
export function buildAirField(cols: number, rows: number, blocked: ReadonlySet<number>, exit: Tile): Int32Array {
  return bfs(cols, rows, (idx) => !blocked.has(idx), exit);
}

/**
 * A route's field: only the corridor's own tiles are walkable, so a tower placed on one route never
 * changes another route's distances. Buildable tiles outside the corridor read as -1, exactly like a
 * sealed board, which is what keeps two adjacent corridors isolated from each other.
 */
export function buildRouteField(
  grid: Grid,
  blocked: ReadonlySet<number>,
  exit: Tile,
  route: readonly Tile[],
): Int32Array {
  const walkable = new Set<number>();
  for (const t of route) walkable.add(t.row * grid.cols + t.col);
  const { cols, rows, tiles } = grid;
  return bfs(cols, rows, (idx) => walkable.has(idx) && tiles[idx] !== 'blocked' && !blocked.has(idx), exit);
}

/**
 * The neighbouring walkable tile with the lowest distance to the exit, or null if there is none.
 * Ties keep the first direction in the fixed order, so the choice is deterministic.
 */
export function stepToward(field: Int32Array, col: number, row: number): Tile | null {
  let best: Tile | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < DIRS.length; i++) {
    const c = col + DIRS[i][0];
    const r = row + DIRS[i][1];
    if (!inBounds(c, r)) continue;
    const d = field[r * COLS + c];
    if (d < 0) continue;
    if (d < bestDist) {
      bestDist = d;
      best = { col: c, row: r };
    }
  }
  return best;
}

/** Flood fill from spawn over walkable, unblocked tiles; true when the exit is unreachable. */
export function isSealed(grid: Grid, blocked: ReadonlySet<number>, spawn: Tile, exit: Tile): boolean {
  const { cols, rows, tiles } = grid;
  const n = cols * rows;
  const spawnIdx = spawn.row * cols + spawn.col;
  const exitIdx = exit.row * cols + exit.col;
  if (blocked.has(spawnIdx) || blocked.has(exitIdx)) return true;

  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  let top = 0;
  stack[top++] = spawnIdx;
  seen[spawnIdx] = 1;

  while (top > 0) {
    const idx = stack[--top];
    if (idx === exitIdx) return false;
    const col = idx % cols;
    const row = (idx - col) / cols;
    for (let i = 0; i < DIRS.length; i++) {
      const c = col + DIRS[i][0];
      const r = row + DIRS[i][1];
      if (!inBounds(c, r)) continue;
      const ni = r * cols + c;
      if (seen[ni]) continue;
      if (tiles[ni] === 'blocked') continue;
      if (blocked.has(ni)) continue;
      seen[ni] = 1;
      stack[top++] = ni;
    }
  }
  return true;
}

/** The route from spawn to exit by repeatedly stepping downhill, capped so a bad field cannot loop. */
export function pathTiles(field: Int32Array, spawn: Tile): Tile[] {
  const out: Tile[] = [];
  let cur: Tile = { col: spawn.col, row: spawn.row };
  out.push(cur);
  for (let i = 0; i < COLS * ROWS; i++) {
    if (field[cur.row * COLS + cur.col] === 0) break;
    const next = stepToward(field, cur.col, cur.row);
    if (!next) break;
    out.push(next);
    cur = next;
  }
  return out;
}
