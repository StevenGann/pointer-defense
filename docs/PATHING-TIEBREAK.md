# Ground pathing tie-break

Status: spec, not built. Owner: Guppy. Written 2026-11-21 against `main` at `51ac996`.
Supersedes §5's recommendation in `docs/PATHING-REVIEW.md`, which picked tile parity alone.

`stepToward` keeps the first neighbour that ties for the shortest step, and the scan order is up, left,
right, down. Every tie therefore resolves the same way: a symmetric fork sends **20 of 20** enemies
up, and the Corridor's route sits **26 tiles above centre against 14 below**.

## 1. The rule

Distance still decides first, exactly as now. Only when two or more neighbours tie:

1. **Momentum** — if the direction the enemy is already travelling is among the tied neighbours, take
   it. Walking straight through a gap instead of cutting to its inner corner is what a person expects.
2. **Tile parity** — otherwise use an order chosen by the tile: `(col + row)` even scans
   up, left, right, down; odd scans down, right, left, up. This makes equal-length alternatives
   alternate instead of always resolving toward the top-left.
3. Nothing else changes: no rng draw, no new tie-break state beyond the heading the enemy already has.

## 2. Why not parity alone

Measured over all ten shipped maps, walking the route with each rule:

| rule | direction changes | above / below centre |
|---|--:|--:|
| today | 28 | 180 / 87 |
| parity only | **79** | 149 / 118 |
| momentum only | 25 | 176 / 91 |
| **momentum then parity** | **33** | **142 / 125** |

Parity alone fixes the lean by making the route sawtooth — the Corridor goes from 9 turns to 29. The
hybrid keeps the route nearly as smooth as today (33 against 28) while halving the lean. That is the
rule this spec ships.

## 3. Where the state lives

- `stepToward(field, col, row, lastDir = -1)` — the direction index the enemy last moved in, or `-1`.
- `Enemy` gains `lastDir`, set to `-1` at spawn and to the chosen index when a target is committed.
  Persisted in the run save with a default of `-1`, so an old save resumes with parity-only decisions
  for one step.
- Drawing callers (`pathTiles`, `currentPath`, the thumbnail) pass `-1` and get the parity route. They
  no longer match an individual enemy every step, which is honest: the drawn route is the canonical
  one, the enemies are individuals.

## 4. Re-baselining

Both smoke hashes change, and must be recomputed with a comment saying why:
`ef768fdff0d07c96d27a99421dee2f0675f03271` (non-flyer regression, 2400 ticks) and `83ea51ae` (no-route
wave). Route **lengths** are tie-invariant and must stay 48/28/22/20.

## 5. Tests

- A lone enemy over 600 ticks is byte-identical between two runs with the same seed.
- On the Corridor the route's above/below split is within 10 tiles of even (today it is 26/14).
- Direction changes across the ten maps stay under 45 (today 28; parity alone would be 79).
- A saved run mid-flight restores `lastDir` and continues without diverging.
- No `Math.random`, no extra rng draws: the rng stream position after a fixed scenario is unchanged.
- Flyers keep their own lane offsets and are untouched.

## 6. Out of scope

Enemy speed, lane sway, the authored multi-route round-robin, and any change to the field itself.
