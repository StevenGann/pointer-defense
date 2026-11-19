# Pointer Defense — art handover

Read [`docs/ART-STYLE.md`](../../docs/ART-STYLE.md) first: it explains the Windows 95 motif, the
limited palette, what the engine draws on top of your files, and what to avoid. Frame-sequence
animation (walk cycles, chewing, spins) is covered in [`docs/ART-ANIMATION.md`](../../docs/ART-ANIMATION.md).

This directory is the source of truth for every **fixed** piece of art: anything whose *shape* is
constant and only its position, scale, rotation, alpha or colour changes at runtime. What stays in
code is the geometry that depends on state — window chrome, buttons, panels, health bars, range
rings, shields, route dots, damage numbers, tooltips, menus, dialogs. **What is in this directory is
what an artist owns; what is not is what the code owns.**

## The contract

- **32×32 viewBox.** Every file is an SVG with `viewBox="0 0 32 32"`, drawn centred. The silhouette
  is meant to fill roughly **28 px** of that box (a 2 px margin on every side). It must survive being
  drawn at 2× — bosses reuse the same file at a larger scale — so use **fills, not hairline strokes**.
  A 1–2 px outline is fine; a 0.5 px hairline is not.
- **Colour belongs to the file.** The game does not tint art by default; a designer's palette wins.
  Runtime effects that *must* recolour it (a damage flash, an offline tower's desaturation) apply a
  tint or filter to the sprite, and they are noted per asset below.
- **Layers.** A tower is two files: a **base** (the plinth, never rotates) and a **turret** (the
  barrel, rotates about the tile centre). The base is drawn first; the turret sits on top and pivots
  on the tile centre.
- **The turret pivot.** The turret file is drawn pointing **up (north)**. The engine places its pivot
  at the tile centre (the sprite anchor is `0.5, 0.5`) and rotates it by the tower's aim angle, where
  `0 = north` and angles increase clockwise. A tower with no turret file (Beacon, Cursor, Repair,
  Wall) never rotates.
- **Enemies face right.** An enemy's file is drawn facing **+x (right)**, which is heading `0`. The
  engine rotates the sprite by the enemy's live heading as it turns corners. Kinds whose shape is
  symmetric (Grunt, Shielded, Armoured, and their boss variants) are not rotated.
- **The path is code.** The route is a dashed line drawn from live pathfinding state, not a tile
  colour. `path-tile` below is reserved and currently unused.

## Naming table

### `enemies/`

| File | Represents |
|---|---|
| `grunt.svg` | small circle with a 1 px inner dot — the filler enemy |
| `runner.svg` | narrow triangle pointing along its heading, with two short streaks behind |
| `shielded.svg` | circle inside a dimmer hexagonal ring |
| `flyer.svg` | circle with two swept wings (its elliptical shadow is drawn by code, below the body) |
| `armoured.svg` | square with four corner rivets and a thicker 2 px outline |
| `saboteur.svg` | diamond with a small fuse spark at the rear corner |
| `breacher.svg` | rounded square with a jaw-notch cut into the leading edge and three teeth |

**Every boss variant has its own files**, each an upgraded version of its base type that keeps the base
silhouette and adds what the boss does:

| File | Boss | Represents |
|---|---|---|
| `grunt-boss.svg` | Sergeant | the Grunt's dome in a riveted armour collar, a scowling brow, gold sergeant's stripes, a crown |
| `runner-boss.svg` | Pacer | a longer dart with two pairs of fins, an afterburner, gold pace chevrons, a coronet |
| `shielded-boss.svg` | Bastion | three projector layers (outer frame, turning inner frame, energy ring) round a crowned, scowling core |
| `flyer-boss.svg` | Carrier | broad serrated wings, a translucent brood sac with three young inside, a horned head, a coronet |
| `armoured-boss.svg` | Dreadnought | three tiers of plating, clamping corner brackets, eight rivets, a V-scowl slit, a crown |
| `saboteur-boss.svg` | Wirecutter | cutter blades on the leading corner, an EMP coil crowned with gold points, the fuse at the rear |
| `breacher-boss.svg` | Ram | a compact hull on wide treads, a spinning drill in place of the jaw, a crowned twin-barrel turret |

All seven share the boss accents: **ember eyes** (the marker Boss's orange iris) and **gold crowns**. A
fixed boss wears the marker Boss's front-view crown; a boss that turns with its heading wears a
**coronet**, a crown seen from above, so it still reads as a crown at any angle.

Each boss has **4× the frames of its base type** (32 for the Sergeant, Pacer and Bastion; 24 for the
rest) and several motions on different rhythms. The Sergeant, for example, waddles twice a loop while its
collar grinds round, it blinks once and its crown jewel glints once. The Ram plays `when: "always"`: its
drill keeps spinning while it chews through a tower.

The engine draws a runtime crown notch, and a cone for the Ram's drill, **only when a boss is falling back
to its base type's art**. A boss file that is deleted or renamed falls back that way, so a half-finished
edit never leaves an invisible enemy. The Ram is drawn at a larger scale than the Breacher
(`ENEMY_ART_BODY` in `src/view/board.ts`) because its drill takes the front of the box; its hull is the
Breacher's size against its radius.

The **Pop-up** enemy is a Windows window and stays runtime (it is chrome, not art). There is no
`popup.svg`.

### `towers/`

| File | Represents |
|---|---|
| `gun-base.svg` | small square plinth |
| `gun-turret.svg` | the gun's barrel (rotates, 720°/s) |
| `cannon-base.svg` | round plinth |
| `cannon-turret.svg` | the cannon's thick barrel (rotates, 90°/s) |
| `laser-base.svg` | long bar plinth |
| `laser-turret.svg` | the laser's beam barrel (rotates, 150°/s) |
| `aa-base.svg` | steel-blue square plinth |
| `aa-turret.svg` | the AA's twin barrels (rotates, 540°/s) |
| `taser-base.svg` | diamond plinth |
| `taser-turret.svg` | the taser's coil (a static turret; the tower never turns) |
| `frost-base.svg` | hexagon plinth |
| `frost-turret.svg` | the frost's snow cross (a static turret; the tower never turns) |
| `beacon-base.svg` | ring with a dot |
| `cursor-base.svg` | grey plinth with a cursor-shaped cap |
| `repair-base.svg` | ring with a white cross |

Beacon, Cursor and Repair ship only a base — the loader treats a missing turret as "no rotation".
The Wall is the one tower with no base plinth here: its face and overlays live in [`wall/`](#wall)
below, because its look is a stateful button rather than a fixed icon.

### `branches/`

Small marks drawn on top of a tier-3 tower body, in the tower's own colour. Each file is drawn in
the same cell-fraction coordinate space as the tower: the tower centre is at the viewBox centre
(16,16) and one tile is 32 units, so a mark meant to sit 0.15 tiles above the centre is drawn at
`y = 16 − 0.15 × 32`. The engine places the mark sprite at the tower centre at one tile per 32 units,
so the mark lands exactly where the procedural spec put it.

| File | Represents |
|---|---|
| `gun-marksman.svg` | a long barrel with a sight notch |
| `gun-repeater.svg` | two short barrels side by side |
| `cannon-mortar.svg` | a short fat tube tilted up with a wide muzzle |
| `cannon-minesweeper.svg` | a mine: a spiked ball with a glint |
| `laser-focus.svg` | a lens ring around the muzzle |
| `laser-prism.svg` | a small triangle in front of the muzzle |
| `taser-arc.svg` | two prongs with a spark between them |
| `taser-overload.svg` | one heavy coil with a ring at its base |
| `frost-deep-freeze.svg` | a six-spoke snowflake |
| `frost-shard.svg` | three angled shards |
| `beacon-command.svg` | a four-point star on the cap |
| `beacon-relay.svg` | two nested arcs above the cap |
| `cursor-overclock.svg` | the overclock mark |
| `cursor-wide-search.svg` | the wide-search mark |
| `cursor-maintenance.svg` | an open-end wrench |

Walls carry their branch as a wall overlay (Bulwark's inner rim, Mesh's crosshatch), not as a branch
mark, and the Repair tower has no branches.

### `wall/`

The Wall's face is a Windows button, so it is split into a **tier face** plus **overlays** rather
than a single fixed icon. The engine still draws the button's outline and bevel in code (they are
runtime chrome), and it tints the tier face to the live raised / pressed / disabled grey — exactly as
the old `towers/wall-base.svg` white template worked — so leave the tier faces light.

| File | Represents |
|---|---|
| `wall-t1.svg` | the tier-1 face plate |
| `wall-t2.svg` | the tier-2 face plate |
| `wall-t3.svg` | the tier-3 face plate |
| `wall-t4.svg` | a reserved tier-4 face plate (placeholder copy) |
| `wall-t5.svg` | a reserved tier-5 face plate (placeholder copy) |
| `wall-bulwark.svg` | the Bulwark branch's raised inner rim (an overlay) |
| `wall-mesh.svg` | the Mesh branch's crosshatch (an overlay) |
| `wall-repairing.svg` | the diagonal repair hatch (an overlay) |
| `wall-damaged-1.svg` | damage overlay, stage 1 (the top third of HP) |
| `wall-damaged-2.svg` | damage overlay, stage 2 (the middle third of HP) |
| `wall-damaged-3.svg` | damage overlay, stage 3 (the bottom third of HP) |

A wall draws one tier face (tinted) and up to two overlays: a branch mark, then a damage stage — or
the repair hatch in place of both while a repair runs. The damage stage is chosen from the HP fraction
in integer thirds, so a wall sitting exactly on a third line never flickers between two stages. These
are placeholder files that reproduce the old code-drawn look; an artist may add per-tier detail and
richer damage without touching the code.

### `board/`

| File | Represents |
|---|---|
| `tile.svg` | a buildable tile face |
| `path-tile.svg` | reserved (the route is a dashed line drawn by code, not a tile) |
| `obstacle.svg` | a blocked / desk-object tile |
| `block.svg` | a static block |

### `fx/`

Effect sprites: fixed shapes whose only runtime variation is position, scale, rotation, alpha or
tint. The engine positions, scales, rotates and fades them from the existing effect code; nothing
about the timing or motion changed. Effect sprites are the one exception to "colour lives in the
file" — they may be tinted at runtime (see `docs/ART-STYLE.md`), because a death ring takes the
enemy's colour and nine near-identical files would be worse than one.

| File | Represents |
|---|---|
| `muzzle-gun.svg` | a yellow three-tongue flash at the barrel tip (3 frames: ignition, flash, sparks and a smoke ring) |
| `muzzle-cannon.svg` | an orange fireball (4 frames: white-hot ball, fireball, flame ring, smoke) |
| `muzzle-frost.svg` | an ice sparkle (3 frames: one crystal, a six-point sparkle over mist, snow) |
| `muzzle-laser.svg` | a lens flare on the crystal tip (3 frames: small star, long flare, afterglow ring) |
| `muzzle-taser.svg` | a yellow bolt from the coil (3 frames, a different bolt in each, so it flickers) |
| `muzzle-aa.svg` | the gun flash twice, one for each barrel (3 frames) |
| `muzzle-cursor.svg` | six rays round the click point (a still: the engine draws frame 0 only, at half a cell) |
| `spark-hit.svg` | a four-point star that bursts and scatters (4 frames, one per tick) |
| `shield-arc.svg` | the 270-degree cyan arc (2 frames: the bright arc, then a wider broken ripple) |
| `death-ring.svg` | the ring with three shards (3 frames: whole, cracked into six plates, slivers); white, tinted to the enemy's colour; the ring radius is 12 and the engine scales from it |

Every branch has its own fire effect as well; the full list is under "Fire effects, mines and
projectiles" below.

### `ui/`

UI glyphs: fixed chrome marks. Most keep their colour in the file; the two white templates below
are tinted to the live colour, and the tint is noted per asset.

| File | Represents |
|---|---|
| `cursor-arrow.svg` | the white pointer, tip at the top-left |
| `offline-wrench.svg` | the red crossed mark on an offline tower |
| `shutter-open.svg` | the open gate leaf's faint outline (white, tinted grey-to-warm as the close nears) |
| `shutter-closed.svg` | the closed gate leaf: a solid grey tile |
| `check.svg` | the tick used by the HUD checkbox and the menu check (white, tinted to the text colour) |
| `glyph-minimize.svg` | the window minimize glyph |
| `glyph-maximize.svg` | the window maximize glyph |
| `glyph-close.svg` | the window close glyph |
| `arrow-left.svg` | the title-bar left arrow |
| `arrow-right.svg` | the mirrored right arrow (reserved) |

The Cursor tower's own plinth is `towers/cursor-base.svg`; `cursor-arrow.svg` here is the flying
cursor and the OS pointer.


## Fire effects, mines and projectiles

Every tower that fires something has a fire-effect file: the muzzle flash at the moment of the shot.

- `fx/muzzle-<kind>.svg` — the base flash for a tower kind: `gun`, `cannon`, `laser`, `taser`,
  `frost`, `aa`, `cursor`.
- `fx/muzzle-<branch-mark>.svg` — a branch overrides its kind's flash: `muzzle-gun-marksman`,
  `muzzle-gun-repeater`, `muzzle-cannon-mortar`, `muzzle-cannon-minesweeper`, `muzzle-laser-focus`,
  `muzzle-laser-prism`, `muzzle-taser-arc`, `muzzle-taser-overload`, `muzzle-frost-deep-freeze`,
  `muzzle-frost-shard`, `muzzle-aa-flak`, `muzzle-aa-missile`, `muzzle-cursor-overclock`,
  `muzzle-cursor-wide-search`, `muzzle-cursor-maintenance`.
- **Resolution order**: branch file, then kind file, then the old procedural flash. Deleting a branch
  file falls back to the kind's; deleting the kind's falls back to code.
- **Drawing convention**: the file is drawn **pointing right (+x)**; the renderer sets the sprite's
  rotation to the shot's angle, where 0 is +x. This is not the projectile convention below, which is
  "pointing up". The renderer centres the sprite a quarter of a cell ahead of the tower centre, so in
  the 32×32 box the tower centre is at (8,16) and a barrel tip is at about (21,16): start the flash
  there. The cursor files are the exception: they are not rotated, and the renderer draws frame 0
  only, at half a cell, on the click point.
- **Timing**: a single-frame file flashes for two simulation ticks. Give the asset numbered frames
  (`muzzle-gun.1.svg`, `muzzle-gun.2.svg`, …) and it plays the whole sequence instead — see
  "Animating an asset" for the `.json` fps/hold rules. A 4-frame, 30 fps flash lives about 133 ms.

Ordnance and mines have their own files, rotated or not by the renderer:

- `projectiles/shell.svg` — drawn pointing up, rotated to its velocity.
- `projectiles/missile.svg` — drawn pointing up, rotated to its velocity.
- `mines/mine-armed.svg` and `mines/mine-unarmed.svg` — not rotated. The armed file's lamp should read
  as live; the unarmed one is drawn at half alpha by the renderer, so do not bake the dimness in.

## The runtime effects that recolour art

- **Damage flash** — not currently applied; when it is, it will be a white tint on the sprite.
- **Offline towers** — a grey desaturation wash is applied to the sprite, plus a red crossed wrench.
- **Wall face shade** — the `wall-t1`..`wall-t5` faces are light; the engine tints the chosen tier face
  to the raised / pressed / disabled grey, because a button's shade is stateful and a tint cannot
  brighten a pre-greyed face. Damage is a separate overlay, not a tint.
- **Death ring** — `death-ring.svg` is white; the engine tints it to the dead enemy's colour (the one
  effect-sprite tint, see `docs/ART-STYLE.md`).
- **Shield ring, slow arc, weak-point notch, health bar** — drawn by code on top of the enemy sprite.

## Adding or changing art

1. Drop the file in the right subdirectory with the exact name from the table above.
2. `npm run art:manifest` regenerates `manifest.json` (also run automatically by `npm run dev` and
   `npm run build`); the game picks it up on the next load.
3. `npm run smoke` fails if a file is unreferenced or missing, so the manifest and the directory can
   never drift apart.

## Animating an asset

An animation is just numbered files plus a JSON — no code change. For an asset named `grunt`, add
`grunt.1.svg`, `grunt.2.svg`, … next to `grunt.svg` (which is frame 0), then optionally a
`grunt.json`:

```json
{
  "fps": 8,
  "loop": "loop",
  "hold": 0,
  "holdAfter": 0,
  "randomStart": true,
  "when": "always"
}
```

| Key | Type | Default | What it does |
|---|---|---|---|
| `fps` | number | `8` | Frames per second, 1–60. |
| `loop` | string | `"loop"` | `loop`, `pingpong`, `once` (stay on last), or `hold0` (return to frame 0). |
| `hold` | number | `0` | Seconds to show frame 0 before the sequence starts. |
| `holdAfter` | number | `0` | Seconds to hold the final frame before restarting (loop modes). |
| `randomStart` | boolean | `true` | Offset each instance by a deterministic hash so a crowd does not march in lockstep. |
| `when` | string | `"always"` | `"always"` or `"moving"` (play only while travelling; sit on frame 0 when stopped). |

Frames must number contiguously from 1; a gap is a build error. Two or more frames make an animation;
a lone `grunt.json` with no numbered frames is ignored with a warning. **Not every asset animates** —
the support matrix in [`docs/ART-ANIMATION.md`](../../docs/ART-ANIMATION.md) lists what is animated and
what is static (branch marks, tiles, the wall face and the UI glyphs never play frames, and the build
warns if you add them). The full contract — the exact error and warning text, the two clock models,
and troubleshooting — is in that same page.

## Collaborating on art

Art is expected to be edited by more than one person, including someone pushing SVG files directly.

- **Keep filenames stable.** The manifest is generated from the directory, but the code that maps a
  kind to its file (`src/view/art.ts`) still names each asset by hand. Renaming a file without
  updating the code reference turns the sprite off and silently falls back to the old procedural
  drawing.
- **Adding a brand-new asset** (a new enemy, a new tower, a new branch) means two edits: the file in
  `public/art/`, and the code reference in `src/view/art.ts`. A new file with no code reference is
  inert, and the smoke run will flag it as unreferenced. Adding **frames** to an existing asset is
  files-only — see "Animating an asset" above.
- **Iterate freely.** A missing or malformed file degrades to the procedural drawing and logs a
  warning, so art can be pushed in a half-finished state without breaking a build.

### Conflicts: the more complex file wins

When two branches change the same SVG, the **more complex** version wins — the more elaborate drawing
is the one closest to final art. Do not hand-merge path data; it produces neither version.

    node scripts/art-merge.mjs            # dry run: reports each conflicted SVG and the winner
    node scripts/art-merge.mjs --apply    # keeps the more complex side and stages it

Complexity is `100 x element count + path command count + stripped byte length / 100`, so more shapes
dominate, path detail breaks ties, and size settles the rest. The script only touches `*.svg` conflicts;
resolve everything else by hand, then rerun it.
