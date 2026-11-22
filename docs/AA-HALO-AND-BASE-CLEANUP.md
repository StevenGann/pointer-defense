# AA halo size, and orphaned tower bases

Status: spec, not built. Owner: Guppy. Written 2026-11-22 against `main` at `dab8cc4`.
Reported twice in one message:
"the aura effect on the AA towers when they're in AA-AA synergy is way too big — can we keep it
approximately the size of the AA towers?" and "when towers are deleted or the window is resized the
tower bases get left behind."

## A. The AA-AA halo is 1.6 cells of nothing

`drawSynergyHalos` (inside `BoardView.draw`) sizes **every** cluster halo at
`cell * SYNERGY_HALO_CELLS` (1.6). The halo is a soft ring that reads as "these are peers"; at 1.6
cells it is fine for a bulky Cannon pair, but the AA tower's art is small and the halo ends up twice
its size, so the two AA towers look wrapped in a bubble rather than matched.

**Change:** a per-row halo size. `SYNERGY_HALO_CELLS = 1.6` stays the default;
`SYNERGY_HALO_AA_CELLS = 1.0` applies to a cluster whose members are all `aa`. Export a Pixi-free
helper `synergyHaloCells(cluster)` in `src/core/synergy.ts` so the rule is testable without a canvas,
and use it in the draw loop instead of the constant. The texture lookup stays a single cached call —
the size multiplier is applied by `width`/`height`, so no second texture is rastered.

Nothing else about the halo changes: alpha, tint, pulsing and the "clusters only" rule are untouched,
and the rule is still keyed on the synergy row, never on damage.

## B. Orphaned bases after a resize

`invalidateArt()` empties the four pooled-sprite arrays and calls `this.towerSprites.removeChildren()`
— but since `docs/TOWER-BASE-SPLIT.md` the **base sprites and wall overlays live in
`this.towerBases`**. Their arrays are cleared while the sprites stay parented and visible at their old
positions, so after a DPR change or the art preload completing, every plinth and wall overlay ever
drawn is left on the board as a ghost. Nothing can ever re-point or hide them again, because the
arrays that tracked them are gone — which is why the ghosts also survive towers being deleted.

**Change:** `invalidateArt()` also calls `this.towerBases.removeChildren()`. The draw loop already
hides every pooled sprite past the live tower count, so ordinary deletion needs no change; a test
pins that behaviour anyway.

## Tests

- `synergyHaloCells` returns `1.0` for a cluster built from two adjacent AA towers and `1.6` for two
  adjacent Guns, using real `synergyLayout` output.
- After `invalidateArt()`, `towerBases` and `towerSprites` both have zero children and all four pools
  are empty.
- Deleting one of three towers and drawing leaves no visible base, turret, mark or wall overlay past
  the new count.
- Both regression hashes unchanged: halo size is presentation only and `invalidateArt` touches no run
  state.

## Out of scope

Halo art itself, the other synergy rows' halo size, and the link/mark geometry.
