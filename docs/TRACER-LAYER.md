# Shot lines render under the turrets

Status: spec, not built. Owner: Guppy. Written 2026-11-22 against `main` at `d9fb9ff`.
Reported: "Shooting lines should be rendered below the turrets."

## Today

`EffectView` puts one `Graphics` (`this.g`) that draws every tracer into `effects.root`, and
`main.ts` adds `effects.root` to the stage **after** `board.root`. A yellow Gun line therefore paints
over the turret that fired it and over every turret it crosses.

## The change

Split the tracer geometry out of `EffectView` into its own container and hand that container to the
board's existing layer stack, so tracers obey board depth instead of stage depth.

- Add a `'shots'` layer to `BOARD_LAYER_ORDER`, positioned **after `'path'` and before `'shadows'`**,
  so tracers sit above the route and the tiles and below shadows, mines, towers, auras, popups and
  enemies.
- `EffectView` exposes `tracerRoot` holding the tracer `Graphics`; `effects.root` keeps muzzles,
  sparks, shield arcs and deaths, which stay above the board exactly as they are.
- `main.ts` parents `effects.tracerRoot` into the board's `'shots'` layer once, at construction.

Nothing else moves: muzzle flashes stay on top, the frost pulse ring stays in its own pooled layer
under enemies, and the recoil offset is unaffected.

## Tests

- `BOARD_LAYER_ORDER` index of `'shots'` is greater than `'path'` and less than `'shadows'`,
  `'towerSprites'`, `'enemies'` and `'popups'`.
- `tracerRoot` is a child of the board's shots layer and **not** of `effects.root`.
- Muzzle, spark, shield and death layers remain children of `effects.root`.
- Both regression hashes unchanged: this is draw order only.

## Out of scope

Tracer width, colour, lifetime and the towers that draw one.
