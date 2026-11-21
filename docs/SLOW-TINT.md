# A slowed enemy goes light blue

Status: spec, not built. Owner: Guppy. Written 2026-11-21 against `main` at `17e5ac7`.

Today a slowed enemy is marked by a 1 px arc over its top edge (`src/view/board.ts:2415-2421`,
`SLOW_COLOR`). With the Frost now pulsing a whole radius, a dozen enemies carry that arc at once and
the cue does not read at a glance. The body itself should go cold.

## The rule

`drawEnemy` already receives `slowed` (`state.tick < e.slowUntilTick && e.slowFactor < 1`, passed at
`src/view/board.ts:897`). Use it on the body:

- **Art path**: `sprite.tint = slowed ? SLOW_TINT : 0xffffff`, where `SLOW_TINT = 0xbfdfff` — a pale
  blue that multiplies over the artwork and still lets the enemy's own colour through.
- **Procedural fallback**: pass `mixColor(color, SLOW_TINT, 0.55)` as the body colour, so the shape
  reads the same way the sprite does.
- **Everything else stays**: shield ring, health arc, boss crown, aura rings and the existing slow
  arc all keep their own colours. The tint is the body cue, not a replacement for the mechanics.
- A tint is presentation only: no simulation state, no rng, no change to any run.

## Tests

- `SLOW_TINT` is a pale blue: `r < b` and `g > r`, i.e. actually blue rather than merely desaturated.
- A slowed enemy's sprite tint is `SLOW_TINT`; an unslowed one is `0xffffff`.
- The tint clears the tick the slow expires (`tick === slowUntilTick` is not slowed).
- Both regression hashes unchanged.

## Out of scope

The slow arc, the Chill synergy's own marker, enemy art, and any damage-type colouring.
