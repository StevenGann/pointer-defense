# Artist to-do — art still drawn by the engineer

Status: **0 outstanding.** All 57 SVGs on the 2026-11-21 list were redrawn the same day, in the art
pass that also reworked the nine older tower pairs and touched up the seven base enemies. Nothing under
`public/art/` is an engineer placeholder any more.

How the list is derived: `git log` on each file, and a file is on this page when its **last** commit is
an engineer's rather than an artist's. It is mechanical, so add a file back here the next time one is
drawn to unblock a feature.

## How to hand a file back

- **Replace it in place.** Keep the filename; `src/view/art.ts` names each asset by hand, and a rename
  turns the sprite off into a procedural fallback that nobody will notice in a screenshot.
- Run `npm run art:manifest` after dropping files in (the build runs it too), then `npm run smoke` —
  it fails if a file is unreferenced or missing.
- Keep the sizes shown below. Most are **32×32**; achievements and global-upgrade icons are **44×44**;
  the synergy pieces are the two exceptions, a **64×64** halo and **64×24** links.
- **White templates are load-bearing.** `ui/check`, `ui/cursor-arrow`, `ui/shutter-open`,
  `ui/synergy-halo`, `ui/synergy-link`, `ui/synergy-link-spotter` and the five `wall/wall-t*` faces are
  tinted by the engine. Draw those white or pale grey — a coloured file fights the tint.
- Auras animate as four files (`aura-x.svg` plus `.1`, `.2`, `.3`) with a sibling `.json`. You can
  redraw the shapes freely; if you change the frame count, keep the numbers contiguous from 1.

## What replaced each placeholder

### AA tower — `towers/` (2 files, 32×32)

| File | What it is now |
|---|---|
| `aa-base.svg` | a cruciform flak mount: four outrigger legs to square jack pads, an octagonal deck, a toothed traverse ring. The X silhouette cannot be taken for the Gun's square |
| `aa-turret.svg` | twin autocannon 3.5 units either side of the pivot (where the twin muzzle flash is drawn), conical flash hiders, a wide yoke with a ring sight, an ammunition drum behind each gun |

### Wall — `wall/` (8 files, 32×32)

| File | What it is now |
|---|---|
| `wall-t1.svg` | one sheet, one seam, two tacks |
| `wall-t2.svg` | an inset panel line and four corner rivets |
| `wall-t3.svg` | a sunk panel, rivets and a cross-brace |
| `wall-t4.svg` | reserved: a double frame with eight rivets |
| `wall-t5.svg` | reserved: chevron ribs pointing in from all four sides |
| `wall-bulwark.svg` | a raised, bolted armour rim at 5..8; the middle stays clear |
| `wall-mesh.svg` | expanded metal in 8-unit diamonds, each strand cut in with a white copy; clipped to 3..29 |
| `wall-repairing.svg` | a hazard-tape border and a spanner: "cordoned off", not "more damage" |

The tier faces are still white templates; their detail is engraved in pale grey because the tint can
only darken.

### Synergy indicator — `ui/` (3 files)

| File | What it is now |
|---|---|
| `synergy-halo.svg` (64×64) | a square docking pad: a floor tint, a bracket on each corner, a coupling tab on each side. Not a ring, so not a range circle |
| `synergy-link.svg` (64×24) | a bolted coupling block on a bus bar, the same from both sides; everything that matters is in x = 22..42 |
| `synergy-link-spotter.svg` (64×24) | three chevrons between two thin rails, pointing +x: one-way by shape, not by colour |

### Global upgrades — `upgrades/` (14 icons and the fallback, 44×44)

All in the achievement icons' frame and drawing style. `autoloader` a magazine and a reload arrow ·
`ballistic-telemetry` a plotted arc on a sheet · `bounty-board` a cork board with a wanted poster ·
`bulk-requisition` three crates · `chain-reaction` three linked detonations · `compound-interest` two
coins and a climbing arrow · `coolant` a Frost-blue canister · `double-buffer` two stacked windows ·
`emergency-patch` a plaster over a crack · `salvage-contract` a signed sheet with a coin seal ·
`shutter-licence` a roller shutter with a lock plate · `structural-warranty` a steel shield with a
tick · `system-tray` a taskbar tray holding windows · `wide-reticle` a gunsight with a wider ring.

### Tower auras — `fx/` (16 files: 4 families × 4 frames, 32×32)

| Family | What it is now |
|---|---|
| `aura-beacon` | twelve brass studs round the tile; every fourth is lit and long, and the lit set steps clockwise |
| `aura-emp` | broken violet scan lines that slip sideways each frame, with one tear that jumps rows |
| `aura-heal` | three outlined green crosses rising in three columns, a step out of phase, shrinking as they fade |
| `aura-override` | four hard-cornered cyan brackets stepping inward and back, with a tick on each side |

### UI glyphs — `ui/` (12 files, 32×32)

| File | What it is now |
|---|---|
| `cursor-arrow.svg` | the classic pointer with mitred corners, built from two fills so the tip sits exactly on the origin |
| `cursor-help.svg` | the pointer, smaller, with an outlined question mark at its heel |
| `check.svg` | a tick cut on a 7×7 grid (4-unit steps) |
| `glyph-minimize.svg`, `glyph-maximize.svg`, `glyph-close.svg`, `glyph-help.svg` | the four control glyphs on a 2-unit grid, square-ended; the question mark is a path, not text |
| `arrow-left.svg`, `arrow-right.svg` | a white block arrow and its mirror |
| `offline-wrench.svg` | a red spanner crossed out by a red bar: an X at half a cell, a spanner up close |
| `shutter-open.svg` | the frame with the curtain rolled up along the top (white, tinted) |
| `shutter-closed.svg` | a five-slat roller shutter with a sill and a lift handle |

### Fallbacks — 2 files

`achievements/_placeholder.svg` and `upgrades/_upgrade-placeholder.svg` are the standard frame, a sunken
panel and a drawn question mark. Plain on purpose; the old `<text>` element is gone.
