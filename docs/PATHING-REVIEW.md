# Pathing review

Analysis of the free-pathing distance field in `src/core/pathfield.ts` and its callers in
`src/core/state.ts`. No behaviour was changed. Measurements in §3 come from throwaway scripts run
against the unmodified source (`node scripts/_bias-measure.mjs`, `node scripts/_bias-variants.mjs`);
those files are not committed.

Board geometry: `COLS = 20`, `ROWS = 12`, row-major, tile `(col,row)` centre at `(col+0.5,row+0.5)`
(`src/core/grid.ts:10-11,20-23,41-43`).

---

## 1. The path, end to end

**The field.** A distance field over the board is built by a breadth-first search from the exit.
`bfs(cols, rows, walkable, exit)` (`src/core/pathfield.ts:24-53`) seeds the exit with distance 0
(lines 31-33), then drains a plain FIFO queue, assigning `field[neighbour] = dist + 1` to each
unvisited, walkable neighbour (lines 35-50). Every edge costs one tile, so the FIFO is a valid
Dijkstra with no priority queue (comment, lines 19-23). Unreachable tiles stay `-1`.

`DIRS` is the fixed neighbour order `up [0,-1], left [-1,0], right [1,0], down [0,1]`
(`pathfield.ts:12-17`), matching the header comment "up, left, right, down" (lines 8-9).

There are four fields, each a `build*` wrapper over `bfs`:

- `buildField` (ground): walkable iff the tile is `buildable` and not blocked
  (`pathfield.ts:59-62`).
- `buildAirField` (flyers): every in-bounds tile is walkable, only `blocked` tiles stop a flyer
  (`pathfield.ts:68-70`).
- `buildRouteField` (authored corridor): walkable iff the tile is in the route's tile set, is
  `buildable`, and is not blocked; everything else reads `-1`, which is what keeps adjacent
  corridors isolated (`pathfield.ts:77-87`).

**Who builds which field, and when.** `RunState` holds one field per kind plus one per authored route
(`state.ts:386-396`). `createRunState` builds them (lines 696-701) and `rebuildField` rebuilds all of
them after any tower change (`state.ts:1251-1258`): ground (`buildField` with `groundBlocked`),
breacher, Ram, flyer (`buildAirField` with `flyerBlocked`), and the per-route fields. The blocked sets
are derived in `state.ts:1167-1244` — `groundBlocked` = towers plus closed toggles, `breacherBlocked`
= everything but walls, `ramBlocked` = closed toggles only, `flyerBlocked` = Mesh walls only. So
placing/selling/upgrading a tower, and every shutter flip, rewrites the field (`placeTower` →
`rebuildField` at `state.ts:1119`; `updateToggles` re-paths enemies in the same tick, see
`state.ts:2111-2131`).

**Choosing the next tile.** `stepToward(field, col, row)` (`pathfield.ts:93-108`) scans the four
`DIRS` neighbours in order, skips out-of-bounds and `-1` tiles, and keeps the neighbour with the
strictly smaller distance (`d < bestDist`, line 102). It returns that neighbour or `null`.

**Committing to a target and moving.** Ground enemies (not flyers) walk in `moveEnemies`
(`state.ts:2502-2623`). An enemy's committed target is `targetCol`/`targetRow`
(`enemies.ts:237-239`), initialised to `-1` ("recompute") at spawn (`enemies.ts:348-349`). While
`targetCol < 0` the enemy calls `stepToward` on its field and commits the returned tile
(`state.ts:2574-2594`, the `stepToward` call at 2576, the commit at 2592-2593). It then walks in
continuous space toward the tile centre (`state.ts:2595-2600`), setting `heading` from the direction
of motion (2600). On arrival it snaps `col`/`row` to the target, clears the target back to `-1`
(2606-2614), and — if that tile is the exit — leaks (2608-2611, `leak` at 2782-2804). The result is a
stepwise downhill walk: each tile transition re-runs `stepToward` from the newly reached tile.

**Flyers.** `fieldFor` (`state.ts:2338-2344`) routes a flyer to `flyerField` and a routed ground enemy
to its route's field. Flyers move in `flyFlyer` (`state.ts:2421-2500`): a *base* position walks the
air field waypoint to waypoint using the same `stepToward` (2429) and the same commit/arrive logic
(2431-2473), but the drawn `x`/`y` is the base plus a lateral offset — a per-flyer `laneOffset` drawn
once at spawn plus a sinusoidal `sway`, both tapered near spawn and exit and clamped to the board
(2482-2495). `laneOffset` and `swayPhase` are drawn from the seeded run PRNG in `initFlight`
(`state.ts:2381-2389`, `enemies.ts:260-263`), never `Math.random`.

**Routes (authored corridors).** When a level authors `routes`, each spawn is assigned one via
`nextRouteIndex` (`state.ts:2285-2290`), a round-robin over `routeCursor` (0,1,…,n-1,0,…); the call
site is `spawnDue` at `state.ts:2270`. `fieldFor` then picks `routeFields[routeIndex % n]` (2342).
Drawing uses the same machinery: `currentRoutes`/`currentPath` (`state.ts:1147-1156`) run `pathTiles`
(which loops `stepToward`, `pathfield.ts:145-157`) over each field, and the map thumbnail does the same
for non-route levels (`src/core/thumb.ts:30-32`).

---

## 2. Where a tie is decided

There is one real tie-decider, not two.

- **`stepToward`'s neighbour scan decides the visible route.** The scan is `for i in DIRS` with a
  strict `<` comparison (`pathfield.ts:96-106`). Because it keeps the *first* neighbour that ties for
  the minimum, the effective priority is `up > left > right > down`. Every enemy's next tile, and
  therefore the drawn route, is decided here. This is the answer to "which side do enemies favour."

- **The BFS insertion order decides nothing observable.** The prompt's framing ("BFS order decides the
  distance values") is not borne out by the code. `bfs` uses a FIFO queue and unit edges
  (`pathfield.ts:27-50`), so every tile is first discovered at its true shortest distance regardless of
  the order its neighbours are enqueued; `field[ni] = dist + 1` (line 47) is written once, at the
  minimum. The `DIRS` order inside `bfs` only changes the order equal-distance neighbours are enqueued,
  which leaves the final `Int32Array` identical. It affects neither the distances nor the route.

So: **`stepToward` (`pathfield.ts:102`) is the sole tie-break for the visible path; the BFS scan
(`pathfield.ts:40-49`) is a non-factor.** (A second, unrelated "split" exists for authored routes —
`nextRouteIndex`'s round-robin at `state.ts:2285-2290` — but that is explicit alternation across
routes, not a tie, and it does not change which neighbour wins a tie *within* a route.)

---

## 3. Measuring the bias

### 3a. A symmetric fork around an obstacle

Throwaway board: a 5-tile vertical wall at column 9, rows 4-8, on an otherwise open 20x12 board;
spawn `(0,6)`, exit `(19,6)`. The top gap (rows 0-3) and bottom gap (rows 9-11) are exactly equal in
length, so at the decision tile `(8,6)` the "up" and "down" neighbours tie on distance.

- One pure-field walker (`pathTiles`/`stepToward`) goes **up**: `minRow = 3, maxRow = 6`.
- A queue of 20 identical `grunt`s spawned on the same spawn tile at staggered ticks, driven by the
  real `tick`/`moveEnemies` loop: **20 of 20 take the upper route, 0 take the lower route**
  (`upper=20 lower=0`, every enemy's minimum row = 3).

The tie is 100 % deterministic and 100 % one-sided.

### 3b. A wide open board

Same spawn/exit, no walls. The unique shortest path is a straight line along row 6.

- `pathTiles` returns 20 tiles, all row 6; row histogram `{"6":20}`; mean lane = **6.0**, lateral
  spread = **0**.
- There is **no edge convergence**: the whole crowd overlaps single-file on the centre row. The bias
  does not push anyone toward an edge on a truly open board — it only appears where the field offers a
  genuine tie.

### 3c. The shipped default map already ties (this is the "one side" Sydney saw)

Auditing the downhill walk on each shipped level (counting tiles where two or more neighbours share
the minimum distance):

| Level | Downhill ties on the route |
|---|---|
| `corridor` | **21** |
| `dumbbell` | 5 |
| `open-field` | 7 |
| `turnstile` | 6 |
| `fork` / `ladder` / `trident` (authored routes) | **0 / 0 / 0** |

The Corridor's 48-tile route has 21 tie points, and they all resolve the same way. The path
(`col,row`):

```
0,6 1,6 2,6 3,6 3,7 3,8 3,9 4,9 5,9 5,8 5,7 5,6 5,5 5,4 5,3 5,2
6,2 7,2 8,2 9,2 10,2 11,2 11,3 11,4 11,5 11,6 11,7 11,8 11,9 12,9 13,9
13,8 13,7 13,6 13,5 13,4 13,3 13,2 14,2 15,2 16,2 17,2 18,2 19,2 19,3 19,4 19,5 19,6
```

Through each 3-row gap the enemy hugs the **inner** edge — row 2 at the top of the board and row 9 at
the bottom — never the outer rows 0/11, and it cuts every corner as tightly as the priority allows.
Measured over the route: **26 tiles above the centre row, 14 below** (mean row 4.96), i.e. a visible
upward lean. This is the concrete, reproducible version of "enemies favour one side."

**Verdict:** the bias is *not* smaller than Sydney suspects. It is absolute, not probabilistic — on a
symmetric fork it is 20/20 to one branch, and on the default map the route visibly leans to one edge
of every gap.

---

## 4. What the bias costs

- **Difficulty — yes, but only where the player makes a symmetric fork.** Ground enemies are a single
  file; where the field has an equal-length fork (two walls forming a two-way-around detour), every
  enemy takes the `up > left > right > down` branch. Towers under that branch hit everything; towers
  under the other branch never fire. The difficulty asymmetry is real but player-authored, not a
  property of any shipped map at load.
- **Map thumbnails — consistent, not wrong.** `thumb.ts:30-32` draws the same `stepToward` route the
  enemies walk, so the thumbnail honestly shows where they will go. But for a symmetric fork it shows
  only the favoured branch, which can make a map read as simpler than it is (the equal-length
  alternative exists but is never drawn or walked).
- **Authored maps — none unfair at load.** The multi-route maps have **0 ties** (§3c): Fork/Ladder/
  Trident are split by `nextRouteIndex`'s round-robin, not by the tie-break, and within each corridor
  the shortest path is unique. The single-route maps do tie (Corridor 21, etc.), but those ties all
  resolve to a *shorter-looking, corner-cutting* route of the same documented length — a cosmetic lean,
  not a different difficulty. No shipped map is made unwinnable or one-sided by the tie-break.
- **Cluster/synergy layout — interacts.** Synergies cluster towers (`synergyLayout`, `state.ts`); since
  the entire ground crowd walks one inner edge, a cluster placed on that edge is optimal and a cluster
  on the opposite edge is dead weight. The bias quietly rewards one side of a symmetric layout.

---

## 5. Three fixes

All three rules are pure functions of state; **none** touches `Math.random` or the run `rng`.

### Fix 1 — fixed rotating tie-break keyed by the enemy's identity

**Rule:** when two neighbours tie, rotate the `DIRS` preference by `enemy.id % 4` (each enemy uses a
different tie-break order, fixed for its lifetime).

- **Code touched:** `stepToward` needs the enemy id (or a rotation offset) threaded in — that changes
  its signature and every caller: ground move `state.ts:2576`, flyer base path `state.ts:2429`,
  `pathTiles` `pathfield.ts:151`, `currentRoutes`/`currentPath` `state.ts:1149-1150`, and
  `thumb.ts:32`. The drawing callers have no enemy, so they must pick a canonical id (e.g. 0), meaning
  the thumbnail/route-preview would show one representative branch that no longer matches any single
  enemy exactly. Largest diff of the three.
- **Determinism/replay:** still deterministic (`id` is part of state); a replayed run reproduces.
- **RNG:** none — pure function of state.
- **Caveat found by measurement:** a naive `DIRS` rotation does **not** split a two-way fork evenly.
  On the §3a obstacle, `id % 4` gives **5 upper / 15 lower** (because `up` and `down` are two apart in
  `DIRS`, so rotations land `down` first three times in four). To split evenly you must rotate *only
  among the tied directions* (e.g. flip the up↔down preference on `id` parity) — more code, more
  subtle.
- **Regression hash / smoke:** changes both (see §6).

### Fix 2 — momentum rule (keep the current heading on a tie)

**Rule:** when two neighbours tie, prefer the neighbour that continues the current direction of
travel; fall back to `DIRS` order when neither does.

- **Code touched:** `stepToward` needs the previous direction (derivable from `e.heading` or
  `e.col`/`e.targetCol`); callers in `state.ts:2576` and `2429` pass it, while `pathTiles`/`thumb`
  fall back to `DIRS` (so drawing no longer matches enemy movement). Moderate diff.
- **Determinism/replay:** deterministic (`heading` is state); replayed runs reproduce.
- **RNG:** none.
- **What it actually does:** smooths the route — measured on the Corridor it moves the mean row from
  4.96 to **5.54** (22 tiles above centre / 18 below), i.e. it reduces but does not remove the lean,
  and because identical enemies have identical headings it does **not** split an identical crowd at a
  symmetric fork. It fixes the visual "hugging," not the "everyone on one side."
- **Regression hash / smoke:** changes both.

### Fix 3 — symmetric ordering alternating by tile parity

**Rule:** choose the tie-break order from the tile's `(col + row) % 2` — even parity uses
`up,left,right,down`, odd parity uses its reverse `down,right,left,up` — so equal-length alternatives
alternate along the path instead of always resolving one way.

- **Code touched:** only the body of `stepToward` (`pathfield.ts:96-106`) — select a `DIRS` array by
  parity and keep the strict `<` scan. No signature change, no new state, no caller changes; `pathTiles`,
  `currentRoutes`, and `thumb` stay coherent automatically because they share the one function.
  Smallest diff of the three.
- **Determinism/replay:** deterministic (parity is a pure function of the tile); replayed runs
  reproduce.
- **RNG:** none.
- **What it actually does:** measured on the Corridor it is the most symmetric of the three — mean row
  moves from 4.96 to **5.60**, and the above/below split becomes **22 / 20** (from 26 / 14), i.e. the
  route zigzags around the centre instead of hugging one edge. Honest limitation: it is a function of
  the *tile*, not the *enemy*, so at a single symmetric fork (§3a) an identical crowd still all picks
  one branch (measured: 20/20 upper) — it fixes the one-sided route, not crowd-splitting.
- **Regression hash / smoke:** changes both.

### Recommendation

**Ship Fix 3 (tile-parity symmetric ordering).** It is the only fix that is a one-function change,
needs no new state or signature, keeps the thumbnail, `currentPath` and enemy movement on the same
path (they all call `stepToward`), and — per the measurement — most directly removes the actual
symptom: the systematic one-sided route (Corridor 26/14 → 22/20). It stays fully deterministic and
rng-free. Its known gap — it does not split an *identical* crowd at a single symmetric fork — is not
clearly a defect: authored multi-route maps already split enemies evenly via `nextRouteIndex`, and a
deterministic single-file flow through a player-built maze is a funneling strategy, not a bug. If
crowd-splitting is ever wanted, Fix 1 is the only option that can provide it, and it must rotate the
tied directions rather than the whole `DIRS` array (the naive version measures 5/15, not 10/10).

---

## 6. What must be re-baselined if Fix 3 lands

- **The non-flyer regression hash.** `scripts/smoke.mjs:534-554` hashes a 2400-tick open-field
  fixture and asserts `ef768fdff0d07c96d27a99421dee2f0675f03271`. That fixture's ground field has
  **10 downhill ties**, so any tie-break change alters enemy positions and therefore the hash. Must be
  recomputed and re-committed.
- **The no-route levels wave hash.** `scripts/smoke.mjs:658-682` asserts `83ea51ae` for
  corridor/dumbbell/open-field/turnstile. Those four fields have **21 / 5 / 7 / 6** downhill ties, so
  the hash must be re-baselined.
- **Saved runs mid-flight.** `src/core/runsave.ts` serialises each enemy's committed
  `targetCol`/`targetRow`, `heading`, `col`/`row` (`runsave.ts:594-621`) and rebuilds the fields on
  load (`runsave.ts:1179`). A save taken mid-flight stores a target chosen by the old tie-break, so it
  replays with one stale step before diverging. Existing save files are not re-baselined by hand; the
  effect is a one-step divergence for in-flight saves, which is acceptable and needs no migration (the
  format is unchanged).
- **Balance claims in the docs — none affected.** Route *lengths* are tie-invariant (equal-length
  alternatives), so `ROUTE_LENGTHS` in `smoke.mjs:599` (48/28/22/20) and the design.md §5.5 table are
  unchanged, and the corridor-mazing "grows by at least 6 tiles" check (`smoke.mjs:628-637`) is an
  inequality that still holds. The flyer `Balance` note in `docs/FLYER-FLIGHT.md:56-60` concerns the
  sway's 5-10 % path lengthening and is unaffected by a ground tie-break. The only balance-adjacent
  assertion that moves is the two hashes above.
