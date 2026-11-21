# Line-tower tracer colours

Status: spec, not built. Owner: Guppy. Written 2026-11-21 against `main` at `68036be`.

Every hitscan tower draws its tracer in `TOWER_COLOR[kind]` (`src/view/effects.ts:197`), the same
colour it uses for its branch mark and procedural body. That makes the Gun's line teal and the
Taser's olive — tower identity colours doing a job that wants one consistent shot colour.

## 1. What a line means

A tracer means "this tower shoots with a line, and the line is the shot". Towers that launch
something — Cannon and Flak (shells), Missile — show the projectile, not a line. So:

- **Yellow** (`0xffd400`) for every line tower: **Gun**.
- **Red** (`0xff3300`) for the **Laser**, which keeps its own colour because piercing beams are its
  identity and red reads as the laser in this palette.
- **No line at all** for the **Taser** and the **Frost**. The Taser's arc is its own effect and the
  Frost is becoming a radial pulse (docs/FROST-PULSE.md); neither should paint a straight line.

## 2. Where the colour lives

A new `TRACER_COLOR: Partial<Record<TowerKind, number>>` beside `TOWER_COLOR` in
`src/view/board.ts`. `addShot` draws a tracer only when the map has a colour for that kind; `TOWER_COLOR`
stays the identity colour and keeps its other three uses. The muzzle flash keeps `TOWER_COLOR` — a
teal flash on a teal tower is right even when the beam is yellow.

## 3. Tests

- `TRACER_COLOR` has entries for `gun` and `laser` only; both are the documented values.
- A Gun shot adds one tracer; a Laser shot adds one; Taser, Frost, Cannon and Flak shots add none.
- The muzzle pool still fills for every tower that fires, including Taser and Frost.
- No change to any run: this is presentation only, so both regression hashes stay identical.

## 4. Out of scope

Muzzle colours, projectile art, the Taser's chain arc rendering, and the Frost pulse's ring (its own
spec).
