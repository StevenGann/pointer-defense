import { COLS, ROWS, inBounds, type Grid, type Tile } from './grid.ts';
import type { TowerKind } from './towers.ts';

/**
 * Weighted pathing (docs/WEIGHTED-PATHING.md): a cost field over the board, rebuilt whenever towers
 * change the maze.
 *
 * Creeps walk downhill on the field — each step moves to the neighbouring tile with the lowest cost
 * to the exit — which makes them take the cheapest route through whatever maze the player has built.
 * Towers are walls, so every placement rewrites the field. Ties are broken by momentum (keep the
 * current heading when it ties) then by a tile-parity scan order (docs/PATHING-TIEBREAK.md), so the
 * route stays deterministic while symmetric forks alternate instead of always resolving one way.
 */

const DIRS: readonly (readonly [number, number])[] = [
  [0, -1], // up
  [-1, 0], // left
  [1, 0], // right
  [0, 1], // down
];

/** Step cost of moving one tile toward the exit, before any terrain penalty. */
export const BASE_COST = 10;

/** Penalty a wall — terrain or a closed shutter — contributes to each orthogonal neighbour. */
export const WALL_PENALTY = 3;

/** The per-tile cap on the summed neighbour penalties; a corridor between two Frosts is costly, never impassable. */
export const PENALTY_CAP = 30;

/** Penalty a tower contributes to each tile entered beside it. */
export function towerPenalty(kind: TowerKind): number {
  if (kind === 'frost') return 14;
  if (kind === 'taser') return 10;
  return 6;
}

/**
 * Breadth-first search from the exit over every tile `walkable` permits, storing the distance in
 * tiles to the exit. `-1` marks tiles the exit cannot be reached from. All edges cost one tile, so a
 * FIFO queue of buckets (one per distance) is a valid Dijkstra without a priority queue. Used for the
 * fields that deliberately stay unweighted: flyers, breachers and the Ram.
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
 * The per-tile cost of *entering* a tile: `BASE_COST` plus the sum of the penalties its orthogonal
 * neighbours contribute, capped at `PENALTY_CAP`. `penalty` supplies a tile's own contribution
 * (towers and closed shutters); a terrain wall contributes `WALL_PENALTY` regardless. Integer
 * arithmetic only, so replays stay byte-identical.
 */
function entryPenalties(grid: Grid, penalty: (idx: number) => number): Int32Array {
  const { cols, rows, tiles } = grid;
  const n = cols * rows;
  const out = new Int32Array(n);
  for (let idx = 0; idx < n; idx++) {
    const col = idx % cols;
    const row = (idx - col) / cols;
    let sum = 0;
    for (let i = 0; i < DIRS.length; i++) {
      const c = col + DIRS[i][0];
      const r = row + DIRS[i][1];
      if (!inBounds(c, r)) continue;
      const ni = r * cols + c;
      if (tiles[ni] === 'blocked') sum += WALL_PENALTY;
      else sum += penalty(ni);
    }
    out[idx] = sum > PENALTY_CAP ? PENALTY_CAP : sum;
  }
  return out;
}

/**
 * Dijkstra from the exit over every tile `walkable` permits, storing the integer cost to the exit.
 * `-1` marks tiles the exit cannot be reached from. This is the equivalent of A* from every enemy
 * evaluated once: every enemy walks the same weighted field downhill.
 */
function dijkstra(
  cols: number,
  rows: number,
  walkable: (idx: number) => boolean,
  entryPenalty: Int32Array,
  exit: Tile,
): Int32Array {
  const n = cols * rows;
  const field = new Int32Array(n).fill(-1);
  const start = exit.row * cols + exit.col;
  field[start] = 0;

  // Binary min-heap over tile indices, keyed by current best cost. The order of equal-cost pops does
  // not affect the final distances, so the field is deterministic.
  const heap: number[] = [start];
  const done = new Uint8Array(n);
  const less = (a: number, b: number): boolean => field[a] < field[b];
  const siftUp = (i: number): void => {
    const idx = heap[i];
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!less(idx, heap[p])) break;
      heap[i] = heap[p];
      i = p;
    }
    heap[i] = idx;
  };
  const siftDown = (i: number): void => {
    const idx = heap[i];
    const m = heap.length;
    for (;;) {
      let c = (i << 1) + 1;
      if (c >= m) break;
      if (c + 1 < m && less(heap[c + 1], heap[c])) c++;
      if (!less(heap[c], idx)) break;
      heap[i] = heap[c];
      i = c;
    }
    heap[i] = idx;
  };
  const push = (idx: number): void => {
    heap.push(idx);
    siftUp(heap.length - 1);
  };
  const pop = (): number => {
    const top = heap[0];
    const last = heap.pop() as number;
    if (heap.length > 0) {
      heap[0] = last;
      siftDown(0);
    }
    return top;
  };

  while (heap.length > 0) {
    const idx = pop();
    if (done[idx]) continue;
    done[idx] = 1;
    const cost = field[idx];
    const col = idx % cols;
    const row = (idx - col) / cols;
    for (let i = 0; i < DIRS.length; i++) {
      const c = col + DIRS[i][0];
      const r = row + DIRS[i][1];
      if (!inBounds(c, r)) continue;
      const ni = r * cols + c;
      if (done[ni]) continue;
      if (!walkable(ni)) continue;
      const next = cost + BASE_COST + entryPenalty[ni];
      if (field[ni] < 0 || next < field[ni]) {
        field[ni] = next;
        push(ni);
      }
    }
  }

  return field;
}

/**
 * The ground field: only `blocked` tiles are impassable, so both `buildable` and `no-build` tiles are
 * walkable. Towers (including walls) live in `blocked`, so every placement rewrites the field. `penalty`
 * returns the per-neighbour penalty a tile contributes (towers and closed shutters); terrain walls
 * contribute `WALL_PENALTY` automatically.
 */
export function buildField(
  grid: Grid,
  blocked: ReadonlySet<number>,
  exit: Tile,
  penalty: (idx: number) => number = () => 0,
): Int32Array {
  const { cols, rows, tiles } = grid;
  const pen = entryPenalties(grid, penalty);
  return dijkstra(cols, rows, (idx) => tiles[idx] !== 'blocked' && !blocked.has(idx), pen, exit);
}

/** A plain, unweighted distance field for breachers and the Ram, which keep the old BFS. */
export function buildPlainField(grid: Grid, blocked: ReadonlySet<number>, exit: Tile): Int32Array {
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
  penalty: (idx: number) => number = () => 0,
): Int32Array {
  const walkable = new Set<number>();
  for (const t of route) walkable.add(t.row * grid.cols + t.col);
  const { cols, rows, tiles } = grid;
  const pen = entryPenalties(grid, penalty);
  return dijkstra(cols, rows, (idx) => walkable.has(idx) && tiles[idx] !== 'blocked' && !blocked.has(idx), pen, exit);
}

/**
 * The neighbouring walkable tile with the lowest distance to the exit, or null if there is none.
 * Distance decides first, exactly as before. When two or more neighbours tie, `lastDir` (the direction
 * index the enemy already travels in, or -1) wins if it is among them; otherwise a scan order picked
 * by tile parity breaks the tie — `(col + row)` even scans up, left, right, down, odd scans down,
 * right, left, up — so equal-length alternatives alternate instead of always resolving one way.
 */
export function stepToward(field: Int32Array, col: number, row: number, lastDir = -1): Tile | null {
  let bestDist = Infinity;
  for (let i = 0; i < DIRS.length; i++) {
    const c = col + DIRS[i][0];
    const r = row + DIRS[i][1];
    if (!inBounds(c, r)) continue;
    const d = field[r * COLS + c];
    if (d < 0) continue;
    if (d < bestDist) bestDist = d;
  }
  if (bestDist === Infinity) return null;

  // Momentum: keep walking in the direction already travelling when it is one of the tied steps.
  if (lastDir >= 0 && lastDir < DIRS.length) {
    const c = col + DIRS[lastDir][0];
    const r = row + DIRS[lastDir][1];
    if (inBounds(c, r) && field[r * COLS + c] === bestDist) {
      return { col: c, row: r };
    }
  }

  // Tile parity: even scans up, left, right, down; odd scans down, right, left, up.
  const even = ((col + row) & 1) === 0;
  for (let k = 0; k < DIRS.length; k++) {
    const i = even ? k : DIRS.length - 1 - k;
    const c = col + DIRS[i][0];
    const r = row + DIRS[i][1];
    if (!inBounds(c, r)) continue;
    if (field[r * COLS + c] === bestDist) {
      return { col: c, row: r };
    }
  }
  return null;
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

/**
 * The route from spawn to exit by repeatedly stepping downhill, capped so a bad field cannot loop.
 * The walker keeps its own momentum: the direction index of the step just taken (0 up, 1 left, 2
 * right, 3 down, from the delta to the previous tile) is passed as `lastDir` on the next step, so the
 * drawn route and the map thumbnail show the same smooth route a single enemy walks from the spawn.
 */
export function pathTiles(field: Int32Array, spawn: Tile): Tile[] {
  const out: Tile[] = [];
  let cur: Tile = { col: spawn.col, row: spawn.row };
  let lastDir = -1;
  out.push(cur);
  for (let i = 0; i < COLS * ROWS; i++) {
    if (field[cur.row * COLS + cur.col] === 0) break;
    const next = stepToward(field, cur.col, cur.row, lastDir);
    if (!next) break;
    lastDir = next.col !== cur.col ? (next.col > cur.col ? 2 : 1) : (next.row < cur.row ? 0 : 3);
    out.push(next);
    cur = next;
  }
  return out;
}
