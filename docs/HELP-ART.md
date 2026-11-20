# Help pages show the thing

The enemy and tower pages in Help are text only. Every one of them names a thing the game already
draws, and the art is sitting in `public/art` behind `frameTexture`. Each page should show its
subject, at 200 % of its in-game size so the detail reads, animating on its own clock.

## What a page gains

```ts
export interface HelpPageArt {
  /** The body texture: the enemy sprite, or a tower's base. */
  readonly base: string;
  /** A tower's turret, drawn over the base. Absent for enemies and for art with no turret split. */
  readonly turret?: string;
}
```

`HelpPage` gains `readonly art?: HelpPageArt`. Populate it:

- **Enemy pages**: `artNameForEnemy(kind)`; omit the field when it returns `null`.
- **Tower pages**: `artNameForTowerBase(kind)`, plus `artNameForTowerTurret(kind)` when that returns
  a name. Towers whose art has no turret split get the base only.

Nothing else about the page changes. A page with no art must render exactly as it does today.

## Sizing: 200 %, and never a hardcoded number

Preview size is **twice what the board draws**, derived from the same constants the board uses:

- Enemy: `2 * artSpriteSize(ENEMY_ART_BODY[kind] * HELP_REFERENCE_CELL)`.
- Tower: twice the sprite size the board uses for a tower body and turret at the same reference cell.

`HELP_REFERENCE_CELL` is one exported constant (the board's nominal cell), so the two views cannot
drift apart. Do not type 96, 108 or any pixel figure into the view; compute the box from the preview
sizes: `box = maxPreview + 2 * padding`, and the tallest/widest part decides it.

Round preview px up to whole pixels after doubling.

## Where it sits, and how text flows

The art box sits at the top-right of the page text area, inset by `HELP_ART_INSET` from the pane's
right edge and top. Body text flows around it: any line whose vertical band intersects the box is
wrapped to `maxWidth - boxWidth - HELP_ART_GAP` instead of `maxWidth`. Lines below the box return to
full width. The heading ("Stats", etc.) and the title are never narrowed.

This has one invariant to hold: **`pageBodyHeight` must equal the height the view actually lays
out**, because it drives the scrollbar and its clamping. Implement one exported layout function

```ts
export function layoutPageLines(page: HelpPage, maxWidth: number): { text: string; x: number; y: number; width: number }[]
```

that the view draws from and `pageBodyHeight` sums. Do not keep a second copy of the wrap logic —
the existing mirror is exactly the kind of thing that drifts.

## Drawing

- Sunken 1 px frame, paper fill, the box clipped so nothing spills.
- Textures come from `frameTexture(name, px, clockTicks, 0)`. When it returns `null` (art still
  loading, or absent), draw the frame and nothing inside it; the next frame picks the art up.
- Animation uses the asset's own fps from the manifest, driven by `clockTicks` — the help view is
  passed `state.clock` from `main.ts`, the same clock the board animates from, so a paused game
  pauses the preview too.
- Towers: base first, then the turret rotated to angle 0 (facing right), both centred in the box.
- Sprites are pooled: one base sprite and one turret sprite on the view, `visible = false` when the
  page has no art. No texture is created per frame.

## Tests

1. Every enemy and tower page that names art resolves to an asset that exists in the art manifest.
2. No body line's rectangle overlaps the art box, for every page, at two pane widths.
3. `pageBodyHeight` equals the laid-out height for every page at both widths — the scroll invariant.
4. A page with no art lays out exactly as before (full width, no box).
5. An animated asset cycles frames across ticks; a still one does not.
6. A tower page with a turret reports both parts; a tower page without one reports the base only.
