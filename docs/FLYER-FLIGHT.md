# Flyer flight

Flyers currently ignore obstacles but still walk the tile grid: `moveEnemies` steers them through the
air flow field and snaps `x`/`y` to each tile centre on arrival, so a flyer turns at right angles and
every flyer in a wave flies the identical line.

## Goal

Flyers should read as aircraft, not pedestrians. Each one enters on its own line and weaves across the
route without ever touching the maze.

## Rules

Only `flyer` and `flyer-boss`. Pop-ups, and every other kind, keep their current movement exactly.

### Path

Keep the air flow field as the route. Flyers walk it waypoint to waypoint in continuous space: never
snap `x`/`y` to a tile centre, and only update `col`/`row` when the base position crosses into a new
tile. `col`/`row` come from the **base** position, so field lookups keep working while the sprite is
offset to one side.

### Offset

Two terms, both measured perpendicular to the direction of travel (right-hand normal):

- `laneOffset` — fixed per enemy, drawn once at spawn from `[-4, +4]` tiles.
- `sway` — `amplitude * sin(2*pi*dist/wavelength + phase)`, with `amplitude` 3 tiles for a flyer and
  2 for a flyer-boss, `wavelength` 12 tiles travelled, and `phase` drawn per enemy from `[0, 2*pi)`.

`dist` is the distance travelled along the base path. The pendulum therefore repeats every 12 tiles:
a 48-tile route swoops four times.

Both terms taper to zero at the ends of the journey — linearly over the last 3 tiles before the exit
and over the first 0.75 tiles after spawn — so a flyer enters and leaves on the route and still
reaches the exit tile to leak.

The final position is clamped inside the board, so a large lane offset near an edge cannot fly off the
canvas.

### Consequences

- `x`/`y` are the swayed position. Clicks, collisions, the shadow and the drawn sprite all use it, so
  what the player sees is what they hit.
- `heading` follows the actual direction of motion, so the sprite banks into each swoop and the weak
  point faces where the flyer is going.
- Randomness comes from `s.rng` via `rngNext`. A seeded run must reproduce identical flight, so no
  `Math.random`.
- The Carrier's brood keeps its existing scatter, then joins the sway when the scatter ends.

## Balance

The base path length is unchanged and speed is unchanged, so a wave's arrival time barely moves. The
sway lengthens the flown path by roughly 5-10 %, which makes AA and Gun coverage matter somewhat more
than a straight line did.

## Smoke assertions

1. A flyer mid-flight is not tile-centre-snapped: its `x` or `y` is off the nearest integer by more
   than 0.05 on most ticks.
2. Two flyers spawned by one wave have different `laneOffset` values.
3. The perpendicular deviation from the base path never exceeds `|laneOffset| + amplitude + 1e-6`.
4. Within the last two tiles before the exit the deviation is under 0.25 tiles, and the flyer still
   leaks on the exit tile.
5. A fixture run of a non-flyer wave produces byte-identical positions to the current build.
6. The same seed produces identical flyer positions across two runs.
