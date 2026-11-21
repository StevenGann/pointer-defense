# The No-Build tile

Status: spec, not built. Owner: Guppy. Written 2026-11-21 against `main` at `94cf196`.

A third tile kind: floor you can walk over and cannot build on. It exists so a map can shape the maze
without shaping the walk — a lane that is open ground but denied to towers. The No-Build *wave
modifier* freezes the whole board; this is the quieter, permanent, per-tile version of the same idea.

Visually: an ordinary floor tile carrying a translucent crosshatch, much fainter than the Mesh wall's
crosshatch, drawn under everything that moves.

## 1. Core

- `TileKind` becomes `'buildable' | 'blocked' | 'no-build'` (`src/core/grid.ts:13`).
- `no-build` is **walkable**: every path field treats it exactly like `buildable`. `buildField`'s
  walkable test changes from `=== 'buildable'` to `!== 'blocked'`; the air field already ignores tiles.
- `canPlace` returns false on it, and the existing blocked-tile refusal carries a new reason so the
  player is told why (`shell.refusal.noBuildTile`: "No towers on a No-Build tile.").
- Wall placement is refused on it too — that is the point of the tile.
- `Level` gains `noBuild?: readonly (readonly [number, number])[]`, applied by `createGrid` on top of
  `walls`. `validateLevel` accepts it and still rejects a tile that is both wall and no-build.

## 2. Drawing

- In the tile pass — **below enemies, towers, projectiles and effects** — after the floor is drawn:
  both diagonal families of a 1 px crosshatch, spacing 4 px, inset 1 px, in `PAL.shadow` at
  **alpha 0.14**. Reuse `hatchSegments` from `src/view/wallAppearance.ts`; do not write a second
  hatch.
- For comparison, the Mesh wall's crosshatch is opaque. This one must read as a texture on the floor,
  not as furniture.
- It is symmetric, so RTL changes nothing about it.
- **Thumbnails** are 6 px per cell, where a 4 px hatch is mush: a no-build tile is drawn as the floor
  colour darkened by 8 %, and nothing else.

## 3. Editor

- `EditorTileKind` gains `'no-build'`. A fourth paint tool sits with Floor, Wall and Shutter, painted
  and erased by the same code path as floor.
- Painting a wall over a no-build tile replaces it and vice versa; the toggle rules are unchanged.
- The map save encodes it as a third character, with the old two kept, so every existing saved map and
  every shared map code still decodes. Decoding is total: an unknown character is a hard error, not a
  silent floor.

## 4. What does not change

- No stock map is edited to use the tile (that is a later map decision, not this one).
- The No-Build wave modifier keeps its current behaviour, message and lock-out.
- Pathing lengths on every shipped map stay identical, asserted.

## 5. Strings

- `shell.refusal.noBuildTile` — "No towers on a No-Build tile."
- Editor tool label `shell.editor.tool.noBuild` — "No-Build", and its tooltip
  `shell.editor.tool.noBuildHint` — "Walkable floor you cannot build on."
- All seven catalogues; the six non-English ones stay `draft: true` with the English value.

## 6. Tests

- Pathing: a field across a no-build tile is identical to the same board with a buildable tile there.
- `canPlace` is false on it for every tower kind, with the new refusal reason.
- `validateLevel` accepts it, and rejects a tile listed as both wall and no-build.
- Save round-trip: a map with all three tile kinds encodes, decodes and paints back identically; an
  old two-character save still loads.
- Draw order: the hatch sprite is added before the enemy layer, asserted on the container order.
- Editor paint, erase, and the wall-over-no-build replacement.
- Thumbnail: a no-build tile differs from a floor tile by exactly the 8 % darkening.
