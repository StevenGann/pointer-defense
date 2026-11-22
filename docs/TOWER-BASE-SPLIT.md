# Shots between the tower base and its barrel

Status: spec, not built. Owner: Guppy. Written 2026-11-22 against `main` at `e712adc`.
Reported: "shooting lines should be below turrets but above tower bases."

## Why it reads wrong now

`shots` sits at index 3 of `BOARD_LAYER_ORDER`, under `shadows`, `mines` and the whole
`towerSprites` layer. A tracer therefore disappears behind the plinth too, so a tower firing across
its own tile looks like the line stops at the edge of its art instead of leaving the muzzle.

The board already separates **base art** from **barrel art** at draw time — `drawTower` receives a
`baseSprite` and a `turretSprite` — but both pools are parented into the same `towerSprites`
container, so there is no seam to slip the tracer through.

## The change

1. New layer `towerBases`, added to `BOARD_LAYER_ORDER` **immediately before `shots`**, and `shots`
   moves to sit immediately before `towerSprites`:
   `... 'synergy', 'towerBases', 'shots', 'towerSprites', 'towers', 'auras', ...`
2. `towerBaseSprite()` and `wallOverlaySprite()` parent into `layers.towerBases`; `towerTurretSprite()`
   and `towerMarkSprite()` stay in `layers.towerSprites`. Nothing else moves: the procedural body
   still draws into `towers`, above both.
3. No drawing code changes — only which container a pooled sprite belongs to, and where the layer is
   created. `drawTower`, `drawTowerBody`, recoil offsets, branch marks and wall overlays keep their
   current geometry.

## What this looks like

- a shot leaves the barrel and passes **over the plinth** it was fired from, and over every plinth it
  crosses,
- it passes **under** every barrel, branch mark and procedural body, and under auras, popups,
  enemies and the cursor,
- ground art (tiles, path, shadows, mines) stays under the shot.

With bases in their own container all bases sit below all barrels — for a top-down board that is the
correct depth already, and it removes the accidental "barrel behind a nearer plinth" case.

## Tests

- `BOARD_LAYER_ORDER` indexes: `path < towerBases < shots < towerSprites < towers < enemies`.
- A `Sprite` handed out by `towerBaseSprite()` is parented in `towerBases`; one from
  `towerTurretSprite()` and one from `towerMarkSprite()` are parented in `towerSprites`.
- A wall overlay is parented in `towerBases`.
- Tracer colours, widths, lifetimes and the set of towers that draw one are unchanged; both
  regression hashes stay identical.

## Out of scope

Base art, turret art, recoil, muzzle flashes (they stay above towers with the other combat art).
