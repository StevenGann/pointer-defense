# Effects clear when a new run starts

Status: spec, not built. Owner: Guppy. Written 2026-11-22 against `main` at `592f872`.
Reported: "Effects aren't clearing at the start of a new run."

## Why

`EffectsView` keeps its tracers, muzzles, sparks, shield arcs, deaths and knockback offsets in plain
lists on the view, and `FloatingNumbersView` does the same with its damage numbers. Nothing clears
them when the run is replaced. Every age is `state.clock - born`, and a new run restarts `clock` at
zero, so an effect born late in the previous run has a **negative** age — it stays alive, at full or
greater alpha, until the new clock climbs past its old birth tick. On a long run that can be minutes
of stale lines hanging over a fresh board.

Every stray is pooled art as well: sprites are hidden only when their entry expires.

## The change

1. `EffectsView.reset()` — empty `tracers`, `muzzles`, `sparks`, `shieldArcs`, `deaths`, clear
   `knockbacks`, `clear()` both Graphics, and set every pooled sprite in every pool `visible = false`.
   `FloatingNumbersView.reset()` does the same for `active` and its pooled texts.
2. One helper in `main.ts`, `resetRunVisuals()`, calling both, placed beside `resetRunNotified()`.
3. Called from **every** point that installs a run state — Restart Windows, New Run, starting a level,
   starting the Daily, and loading a run save. A source check in smoke asserts all five sites call it,
   so a sixth entry point added later cannot quietly skip it.

Nothing else changes: the caps, lifetimes, pooling and colours are untouched, and a reset costs no
allocation.

## Tests

- After `reset()`, every list is empty, both Graphics report no geometry, and no pooled effect sprite
  is visible.
- A tracer born at tick 1000 does not survive a reset: a draw at tick 0 afterwards emits no geometry
  (`g.geometryBounds` stays null / the graphics draws nothing).
- Same for a floating number born at tick 1000.
- The five `state = ...` run-install sites in `src/main.ts` each call `resetRunVisuals()`.
- Both regression hashes unchanged: presentation state only, no simulation field touched.

## Out of scope

Pool sizes, effect lifetimes, and clearing on pause, victory or defeat (the board stays as it was).
