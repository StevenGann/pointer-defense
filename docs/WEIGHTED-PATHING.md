# Weighted pathing: enemies stop hugging towers and walls

Status: spec, not built. Owner: Guppy. Written 2026-11-21 against `main` at `60f9a1c`.

Today the field in `src/core/pathfield.ts` is a plain breadth-first distance field: every walkable
tile costs the same, so the shortest route clips the inside of every corner and runs one tile from
every tower. A Frost or Taser therefore covers a lane whether or not it was placed well, and walls
never push a route away — the route leans on them.

## 1. The shape of the change

A* over the same grid, evaluated once from the exit rather than once per enemy: a **cost field**.
The result is identical to running A* from every enemy to the exit, because every enemy walks the
same weighted field downhill. Same file, same call sites, same determinism.

- Step cost: `BASE = 10` per tile, plus terrain penalties below.
- Integer arithmetic only — no floats in the field — so replays stay byte-identical.
- Tie-break is unchanged: momentum first, then parity (`docs/PATHING-TIEBREAK.md`).

## 2. Penalties

Applied per tile to the cost of *entering* it, from that tile's orthogonal neighbours:

- Next to a **Frost** tower: `+14`
- Next to a **Taser** tower: `+10`
- Next to any other tower: `+6`
- Next to a **wall** (terrain, shutter, no-build does not count): `+3`

Penalties stack per neighbour and are capped at `+30` a tile, so a corridor between two Frosts is
expensive but never impassable.

Towers are already impassable — this does not change where enemies *can* walk, only what they
prefer. Nothing may make a tile unwalkable that is walkable today.

## 3. What must not change

- `e.dist` and every use of tile distance: leak order, targeting modes (`first`/`last`), route
  progress and the HUD stay on the plain distance field. The weighted field is for movement only.
- The drawn route and the map thumbnails keep following the same field the enemies walk, as they do
  now (`pathTiles`), so the grey line still shows the real path.
- Flyers, breachers and the Ram keep their own fields untouched.
- Towers still block; selling a tower still reopens the tile.

## 4. Bounds, checked on every map

- No map's route may grow past **135%** of its current tile count.
- No map may become unsolvable: start reaches exit on all 17 stock maps, the daily level, and the
  Ladder's authored map.
- On a map where a Frost sits beside the corridor, the route must move at least one tile further
  from it than before, or the change has done nothing.

## 5. Tests

- The cost field equals a reference Dijkstra on a hand-built 5×5 grid with a known answer.
- Determinism: the same placement and seed produce the same field twice, and the same run trace.
- Route length per map recorded before and after, with the 135% ceiling asserted.
- Every stock map still solves; the Ladder still reports buildable tiles.
- A Frost-adjacent corridor route shifts away by at least one tile.
- Regression hashes re-baselined with a note: enemies genuinely walk differently now.

## 6. Out of scope

Enemy speed, targeting modes, tower prices, and the drawn route's colour.
