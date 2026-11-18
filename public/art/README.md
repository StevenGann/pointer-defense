# Pointer Defense — art handover

This directory is the source of truth for every **fixed** piece of art. Anything that changes at
runtime — window chrome, buttons, panels, health bars, range rings, shields, route dots, damage
numbers, muzzle flashes, sparks, death pops, tooltips, menus, dialogs — is drawn in code from state
and has no file here. **What is in this directory is what an artist owns; what is not is what the
code owns.**

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
  symmetric (Grunt, Shielded, Armoured, Boss) are not rotated.
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
| `boss.svg` | large circle with a segmented outer rim and a crown notch at the top |

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
| `taser-base.svg` | diamond plinth |
| `taser-turret.svg` | the taser's coil (a static turret; the tower never turns) |
| `frost-base.svg` | hexagon plinth |
| `frost-turret.svg` | the frost's snow cross (a static turret; the tower never turns) |
| `beacon-base.svg` | ring with a dot |
| `cursor-base.svg` | grey plinth with a cursor-shaped cap |
| `repair-base.svg` | ring with a white cross |
| `wall-base.svg` | a white button-face template; the engine applies the Win95 grey per state and draws the bevel in code |

Beacon, Cursor, Repair and Wall ship only a base — the loader treats a missing turret as "no
rotation". The wall's face is a button, so its bevel and its raised / pressed / disabled shade are
runtime chrome: `wall-base.svg` is a white template that the engine tints to the state's grey (see
below), because the shade changes with state and damage and a tint cannot brighten a pre-greyed face.

### `branches/`

Small marks drawn on top of a tier-3 tower body, in the tower's own colour.

| File | Represents |
|---|---|
| `gun-marksman.svg` | a long barrel with a sight notch |
| `gun-repeater.svg` | two short barrels side by side |
| `cannon-mortar.svg` | a short fat tube tilted up with a wide muzzle |
| `cannon-minesweeper.svg` | the minesweeper's tilted tube |
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

Walls carry their branch in the button face (Bulwark's inner rim, Mesh's crosshatch), not in a
branch mark, and the Repair tower has no branches.

### `board/`

| File | Represents |
|---|---|
| `tile.svg` | a buildable tile face |
| `path-tile.svg` | reserved (the route is a dashed line drawn by code, not a tile) |
| `obstacle.svg` | a blocked / desk-object tile |
| `block.svg` | a static block |

## The runtime effects that recolour art

- **Damage flash** — not currently applied; when it is, it will be a white tint on the sprite.
- **Offline towers** — a grey desaturation wash is applied to the sprite, plus a red crossed wrench.
- **Wall face shade** — `wall-base.svg` is white; the engine tints it to the raised / pressed / disabled
  / damaged grey, because a button's shade is stateful and a tint cannot brighten a pre-greyed face.
- **Shield ring, slow arc, weak-point notch, health bar** — drawn by code on top of the enemy sprite.

## Adding or changing art

1. Drop the file in the right subdirectory with the exact name from the table above.
2. `src/view/art.ts` already lists it in `ART_MANIFEST`; the game picks it up on the next load.
3. `npm run smoke` fails if a file is unreferenced or missing, so the manifest and the directory can
   never drift apart.
