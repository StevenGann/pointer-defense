# Pointer Defense — visual style guide

This is the document to read before drawing anything for `public/art/`. It explains what the game is
trying to look like, which colours are allowed, what the engine draws on top of your files, and the
mistakes that break the illusion.

The contract for file size, naming and layers is in [`README.md`](./README.md). This file is about
intent.

---

## 1. The motif

Pointer Defense looks like a **Windows 95 application that happens to be a tower defense**. Not a game
with a retro skin — an actual period program: grey beveled panels, a navy title bar, a teal desktop,
and a 16-colour discipline that assumes the artwork had to fit on a floppy.

Two references, in order:

1. **Windows 95 / 98 / 2000 Classic** — the chamfered 2px bevels, `#c0c0c0` button faces, the navy
   active title bar, the teal desktop behind the window.
2. **Windows XP Classic theme** — the same language with slightly softer greys and the Luna-era blue
   still absent from the working surfaces. If XP Classic and 95 disagree, follow 95.

The joke the art has to support: this is a program the player installed from a CD, and the enemies are
things that live on a desktop. Everything should feel *manufactured*, flat, and drawn by someone with a
16-colour palette and no anti-aliasing.

---

## 2. Palette

These are the only colours in the game. Values come from the live code (`src/view/chrome.ts`,
`board.ts`, `wallAppearance.ts`); if you need a new one, add it here first and say what it is for.

### System surfaces — the Windows 95 sixteen

| Hex | Name | Used for |
|---|---|---|
| `#008080` | Desktop teal | The desktop behind the window |
| `#c0c0c0` | Button face | Panels, buttons, buildable tiles, wall faces |
| `#dfdfdf` | Light | The second bevel pixel on raised surfaces |
| `#ffffff` | Highlight | Top/left bevel edge, text on navy |
| `#808080` | Shadow | Bottom/right bevel edge, wall outline |
| `#000000` | Dark | 1px outlines, text |
| `#000080` | Navy | Active title bar, Pop-up window chrome |
| `#800000` | Maroon | Cannon identity, dark red accents |
| `#808000` | Olive | Taser identity |
| `#800080` | Purple | Reserved; spikes and rare accents |
| `#806000` | Amber | Reserved; warm accents |
| `#c0c0c0` | — | Wall face (same as button face; walls *are* disabled buttons) |

### Board

| Hex | Name | Used for |
|---|---|---|
| `#c0c0c0` | Buildable tile | With a `#ffffff` top/left and `#808080` bottom/right edge |
| `#a0a0a0` | Blocked tile | With a `#707070` edge |
| `#707070` | Structure edge | Shutters, blocked tiles |
| `#ff6a00` | Shutter warning | Only as a shutter is about to close |
| `#cccccc` | Wall, disabled state | |
| `#b0b0b0` | Wall, pressed state | |
| `#e8e8e8` / `#909090` | Disabled bevel light / dark | |
| `#ffffff` / `#dfdfdf` | Raised bevel light pair | |
| `#404040` / `#808080` | Raised bevel dark pair | |

### Towers — identity colours

| Hex | Tower |
|---|---|
| `#008080` | Gun (teal) |
| `#800000` | Cannon (maroon) |
| `#808000` | Taser (olive) |
| `#3399cc` | Frost (cold blue) |
| `#ff3300` | Laser (hot orange-red) |
| `#ffcc00` | Beacon (amber yellow) |
| `#00a000` | Repair (green) |
| `#8a8a8a` | Wall (grey — it is a button) |
| `#9a9a9a` | Cursor (pointer grey) |

### Enemies — one blue-grey family

Enemies are **not** colour-coded. Shape carries identity; colour only shades it, so a mixed wave reads
as one coherent force rather than a bag of sweets.

| Hex | Enemy |
|---|---|
| `#35506a` | Grunt |
| `#577489` | Runner |
| `#2f4b62` | Shielded |
| `#6b8598` | Flyer |
| `#406080` | Armoured |
| `#4a637a` | Saboteur |
| `#5a7183` | Breacher |
| `#27495d` | Boss |
| `#000080` | Pop-up (a window, so it is navy) |

### Runtime-only colours — do not draw these

The engine paints all of these over your art. Drawing them yourself causes double lines and
flicker.

| Hex | Meaning |
|---|---|
| `#00d0d0` | Shield ring, shield impact arc, `SHD` number |
| `#6699ff` | Friendly aura (Beacon, Repair) |
| `#00d0ff` | Frost slow arc |
| `#ff3300` | Crit number, crit spark |

---

## 3. Rules of form

- **Flat fills.** No gradients, no soft shading, no ambient occlusion, no glow. If something needs
  depth, it gets a 1–2px bevel: light on top and left, dark on bottom and right. That is the whole
  lighting model.
- **Hard edges.** No anti-aliased curves at large scale, no feathered strokes, no opacity below 1.0 on
  a fill. A 1px outline at 32×32 becomes a 2px outline at boss scale — which is exactly right.
- **Corners are square.** The only exceptions are the shapes that are circles by nature (the Grunt, the
  Shielded, the Flyer body) and the 2px inner rounds on beveled buttons.
- **Diagonals are 1:1** where they imply a chamfer. Windows 95 had no 30-degree angle.
- **Every silhouette must read at 14px.** Zoom out until it is the size of a fingernail: if you can't
  tell what it is, it is too detailed. Detail is for the 32×32 inspection, identity is for the
  silhouette.
- **Draw inside the 28px circle of the 32px viewBox.** The 2px margin is the engine's; overflow is
  clipped by neighbouring tiles.

---

## 4. What the engine draws on top of you

Coordinate with these. Baking any of them into an SVG means the player sees two of them, or one that
does not update.

| Runtime element | Where it lands | What it means |
|---|---|---|
| Health bar | A thin bar above the entity's box | Damage state; empty means offline/dying |
| Range ring | A 1px **dashed navy** circle at the tower's radius | Shows on hover and while placing |
| Placement preview | Ghosted tower plus the dashed range circle | Where the next tower would go |
| Hover highlight | 1px lighter box | Cursor is over a placeable tile |
| Shield ring | Concentric cyan ring | Shield strength; drawn outside the body |
| Weak-point arc | 25% arc on the leading edge | Aimed shot is worth double |
| Slow arc | Pale blue arc | Frost is on this enemy |
| Route dots | White 2px dashed line | The live path, redrawn whenever the maze changes |
| Damage flash | White tint over the sprite | Hit feedback |
| Offline desaturation | Grey tint + crossed wrench | Tower at 0 HP, repairable |
| Repair hatch | Diagonal lines | Repair in progress |
| Branch mark | Small shape at the tower's corner | Which branch was chosen |
| Fully-upgraded pip | 4×4 green square | Nothing left to buy |
| Muzzle flash / tracers | Between tower and target | Firing |
| Countdown bar | Under a shutter | Time until it toggles |

**Layer order, back to front:** tiles → route → walls and shutters → tower bases → enemies → tower
turrets → allies' effects → runtime overlays (health, shields, rings) → cursor.

Because turrets draw *above* enemies, a tower's barrel must not be tall enough to hide the tile behind
it — keep the barrel inside the 28px box.

---

## 5. Specific guidance

### Enemies

- **Silhouette first.** Grunt = round. Runner = pointed and narrow. Shielded = round inside a ring.
  Flyer = winged. Armoured = square, riveted. Saboteur = diamond. Breacher = blunt nose with teeth.
  Boss = round with a segmented rim. None of these may be confused at a glance.
- **Face right.** Runner, Flyer, Saboteur and Breacher are rotated by their heading; everything else is
  symmetric and never rotates. Draw the asymmetric ones pointing along **+x**.
- **No faces, no eyes, no pupils.** The charm is that these are anonymous desktop objects.
- **Bosses reuse the same file at up to 2× scale.** Anything thinner than 1px at 32×32 will vanish or
  turn into a moiré at 2×.

### Towers

- **Base and turret are separate files.** The base never rotates; the turret pivots at the tile centre
  and is drawn **pointing north (up)**. The engine rotates it to the aim angle, where 0 = north and
  angles increase clockwise.
- **Bases sit on the tile floor.** Do not draw a shadow that spills onto the neighbouring tile, and do
  not draw the tile itself — the board draws that.
- **The barrel is the character.** Gun: single long barrel. Cannon: short fat tube. Laser: emitter
  ring. Taser: twin prongs. Frost: nozzle with a frost cap. Beacon, Cursor and Repair have no turret
  file at all.
- **The wall is a raised, disabled Windows button.** That is the joke and the read: `#c0c0c0` face,
  `#ffffff`/`#dfdfdf` top-left bevel, `#404040`/`#808080` bottom-right, `#808080` outline, flat centre.
  A wall that has been upgraded to toggle looks like a *normal* (enabled) button instead.

### Branch marks

- One small shape per branch, drawn in the corner of the tower at ~10px. Marks are read at speed; a
  clean glyph beats a detailed icon. Colour follows the tower, not the branch.

---

## 6. Things to avoid

- **Gradients, glows, drop shadows** — the engine has no lighting; anything shaded will look pasted on.
- **Transparency as a design element.** Opacity is reserved for runtime overlays.
- **Isometric or 3D perspective.** The board is orthographic and top-down.
- **Rounded, "modern flat" shapes** — pills, 8px radii, Material-style icons.
- **Emoji or pictograms as tower art.** Use the geometric vocabulary.
- **Thin hairlines** (0.5px) and any stroke that only exists at one scale.
- **Baking in runtime state** — health bars, rings, selection boxes, damage flashes, the pip.
- **Baking in the tile** under a tower or enemy.
- **Colour-only differentiation.** If two enemies differ only by hue, they are the same enemy to a
  colour-blind player, and to everyone at 14px.
- **Anti-aliased soft curves** at 32×32 that turn into mush at 2×.
- **Text inside SVGs.** All text is drawn by the engine with Tahoma at 13/11/10px.

---

## 7. Things to coordinate

- **Adding an asset** needs the file *and* one line in `ART_MANIFEST` (`src/view/art.ts`). A file with
  no manifest entry is inert.
- **Renaming a file** silently falls back to the old procedural drawing. Rename the manifest entry in
  the same commit.
- **Changing a silhouette's size** breaks placement feel — the engine sizes sprites to the old bounds.
  If a shape must grow, say so in the pull request so the bounds can be updated deliberately.
- **New kinds** (a new tower, a new enemy) need the manifest, the `ENEMY_ART_BODY` factor for enemies,
  and a turret flag for towers.
- **Conflicts:** the more complex file wins (see `README.md`), because the more elaborate drawing is
  closer to final art. `node scripts/art-merge.mjs --apply` does it.

---

## 8. Checklist before you push

- [ ] `viewBox="0 0 32 32"`, silhouette inside a centred 28px box.
- [ ] Flat fills, 1–2px bevels, no gradients or transparency.
- [ ] Colours come from the palette above; anything new is added to this document.
- [ ] Reads at 14px and survives 2× without hatching.
- [ ] Turret points north; asymmetric enemies point right.
- [ ] No runtime state baked in (bars, rings, flashes, tiles).
- [ ] Filename matches the manifest; new assets have an entry.
- [ ] `npm run smoke` passes — it asserts the manifest/reality diff.
