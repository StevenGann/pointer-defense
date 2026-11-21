# Artist to-do — art still drawn by the engineer

Status: 57 SVGs. Written 2026-11-21 against `main` at `e8d94fb`.

Everything under `public/art/` is meant to be yours. This page lists the files whose **current
drawing is still mine** — I made them to unblock a feature, and no artist pass has replaced them yet.
The other **470** SVGs in the tree already carry an artist change as their last edit (enemies and every
boss, the nine tower bases and turrets except the AA, the board tiles, branch marks, most of `fx/`, the
achievement icons, projectiles and mines), so they are not listed here.

How the list was derived: `git log` on each file, and the file is on this page when its **last** commit
touched it is one of mine rather than one of yours. It is mechanical, so a file drops off the moment
your replacement lands.

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

## Priority order

1. **AA tower** — on screen every run, and the AA is the newest tower.
2. **Wall faces and overlays** — every wall the player builds.
3. **Synergy indicator** — new feature; currently reads as my geometry, and it is the piece players
   stare at to understand that two towers are linked.
4. **Global upgrade icons** — 15 icons in the right-hand HUD panel.
5. **Auras** — four floating status effects around towers.
6. **UI glyphs** — small chrome marks; several are already close to final.
7. **The two placeholders** — fallbacks that only appear if a real file is missing.

## 1. AA tower — `towers/` (2 files, 32×32)

| File | What it is now | What it wants |
|---|---|---|
| `aa-base.svg` | square plinth with a raised deck plate and a fast-traverse turntable | a turret mount that reads as anti-aircraft at a glance, and sits under a barrel that swings fast |
| `aa-turret.svg` | points north; two elevated autocannon barrels on a shared yoke | twin barrels that stay legible when rotated and at 2× boss scale; the AA is the busiest sprite on the board |

## 2. Wall — `wall/` (8 files, 32×32)

The wall is a Windows button: the engine draws the bevel and outline, and **tints** the tier face to
the live raised / pressed / disabled grey. So the faces are light templates, and the branch and damage
detail rides on top.

| File | What it is now | What it wants |
|---|---|---|
| `wall-t1.svg` | plain face, tinted by the engine | the cheapest-looking wall; the one players build most |
| `wall-t2.svg` | plain face | slightly sturdier plating |
| `wall-t3.svg` | plain face | the top of the everyday ladder |
| `wall-t4.svg` | plain face (reserved tier) | reserved — draw it if the ladder grows |
| `wall-t5.svg` | plain face (reserved tier) | reserved |
| `wall-bulwark.svg` | inner raised rim, light top-left / dark bottom-right | a rim that reads as extra armour without hiding the tinted face |
| `wall-mesh.svg` | crosshatch over the face | a mesh pattern that survives at 16 px |
| `wall-repairing.svg` | diagonal hatch, drawn while a repair runs | a hatch that reads as "under repair", not as damage |

Damage stages (`wall-damaged-1..3`) are already yours and must keep the rule that each stage contains
the one before.

## 3. Synergy indicator — `ui/` (3 files)

New in the last two days, and the piece players look at to understand a pairing.

| File | What it is now | What it wants |
|---|---|---|
| `synergy-halo.svg` (64×64) | a translucent ring at r=21 with faint corner ticks, drawn under every tower in a cluster | a floor tint that says "paired" and cannot be mistaken for a range ring. Tinted with the synergy colour; keep it white and translucent |
| `synergy-link.svg` (64×24) | a bar with a bright core and a centre pip, drawn between two adjacent towers, rotated for north/south pairs | a connector that reads when only ~8 px of it is visible between two bases |
| `synergy-link-spotter.svg` (64×24) | a chevroned rail, drawn from a Marksman to the tower it gifts range to | the same idea, but evidently one-way: it must differ from the peer link by **shape**, not only by colour (deuteranopia rule) |

## 4. Global upgrades — `upgrades/` (15 files, 44×44)

All fifteen are placeholders I generated from the upgrade names, in the Win95 tile frame the HUD draws
around them. They are the icons beside each global upgrade in the right-hand panel.

`autoloader` · `ballistic-telemetry` · `bounty-board` · `bulk-requisition` · `chain-reaction` ·
`compound-interest` · `coolant` · `double-buffer` · `emergency-patch` · `salvage-contract` ·
`shutter-licence` · `structural-warranty` · `system-tray` · `wide-reticle`

Each should read as its name at 28 px: a magazine with a reload arrow, a plotted trajectory, a
noticeboard, a crate stack, a chain of detonations, a coin with a second coin behind it, a coolant
canister, two stacked frames, a bandage with a cross, a contract with a coin, a shutter with a keyhole,
a shield with a tick, a tray with windows on it, a reticle with a wider ring.

## 5. Tower auras — `fx/` (16 files: 4 families × 4 frames, 32×32)

Drawn under or over a tower while a status is live. Frame 0 plus `.1`, `.2`, `.3`, each with a `.json`
holding the fps and loop mode.

| Family | What it is now | What it wants |
|---|---|---|
| `aura-beacon` | a gold ring, fading to transparent at the centre | a command aura that shows which towers are in range |
| `aura-emp` | violet static, broken arcs round the rim | a jamming field that reads as interference, not as damage |
| `aura-heal` | three green plus signs rising and fading | repair in progress; should read at 0.5 s glance |
| `aura-override` | a cyan reticle, four corner brackets tightening | the override buff: mechanical, precise, not magical |

## 6. UI glyphs — `ui/` (12 files, 32×32)

| File | What it is now | What it wants |
|---|---|---|
| `cursor-arrow.svg` | the classic white pointer, tip at top-left | the game's own pointer; it is also the OS cursor, so it must read at 16 px |
| `cursor-help.svg` | the pointer with a question-mark badge at its heel | the context-help pointer used by the `?` box |
| `check.svg` | a white tick, tinted to the text colour | a tick that stays crisp at 9 px |
| `glyph-minimize.svg` | a short horizontal bar | Windows 95 control glyph, 1 px weight |
| `glyph-maximize.svg` | an outlined square with a filled top bar | ditto |
| `glyph-close.svg` | a black X | ditto |
| `glyph-help.svg` | a black question mark, same weight as the X | ditto |
| `arrow-left.svg` | the title-bar system-menu icon, white left arrow | a 16 px system-menu arrow |
| `arrow-right.svg` | mirrored arrow, reserved | unused today; draw it only if the mirror ships |
| `offline-wrench.svg` | a red crossed wrench | marks a tower that lost its beacon; must read at half a cell |
| `shutter-open.svg` | a white outline, tinted grey→warm as closing nears | the open gate leaf, so the tint carries the warning |
| `shutter-closed.svg` | a solid grey tile with a darker edge | the closed gate; it is a wall for a moment, and should look like one |

## 7. Fallbacks — 2 files

| File | What it is now | What it wants |
|---|---|---|
| `achievements/_placeholder.svg` (44×44) | the beveled Win95 tile with no glyph | shown only if an achievement icon is missing; leave it plain |
| `upgrades/_upgrade-placeholder.svg` (44×44) | "not drawn yet" tile | ditto for the global upgrades |

## Already yours — no action

For the record, so nobody re-lists them: all seven enemy kinds and their bosses (including animations),
the nine tower pairs other than the AA, `board/`, `branches/`, the fire effects, projectiles, mines,
the achievement icons, and the wall damage stages. 470 files in total.
