# Pointer Defense: visual style guide

Read this before you draw anything for `public/art/`. It explains the look, the colours, what the
engine draws on top of your files, and the mistakes that cost the most.

The technical contract (file names, the 32×32 viewBox, layers, facing) is in
[`public/art/README.md`](../public/art/README.md), and frame-sequence animation — walk cycles, chewing,
spins — is in [`docs/ART-ANIMATION.md`](ART-ANIMATION.md). The engine depends on those contracts. This
file is about intent, and **it is a guide, not a rule book**. Break it when the art is better for it,
and say why in the pull request.

---

## 1. The motif

Pointer Defense looks like a **Windows 95 application that happens to be a tower defense**. The
window, the panels and the buttons are plain period chrome: grey bevels, a navy title bar, a teal
desktop.

The art on the board is the **icon art** of that era, not the chrome. Think of a good 32×32 desktop
icon: a hard black outline, a clear silhouette, and shading that makes the object look solid. The
towers are hardware bolted to the desktop. The enemies are small things that live on it, and they are
**alive**: they have eyes, they look where they go, and each kind has a character.

Two tests for every drawing:

1. **Does it read at 20 px?** The silhouette must still identify the thing.
2. **Does it reward a close look?** At 64 px there must be something more to see: a seam, a rivet, a
   glint.

---

## 2. Colour

Each kind has one **identity colour**. Use it as the mid-tone. Shade up and down from it to build
volume. Small accents in other colours are fine when they carry meaning (an eye, a spark, a crown).

### Chrome, drawn by code

| Hex | Name | Used for |
|---|---|---|
| `#008080` | Desktop teal | The desktop behind the window |
| `#c0c0c0` | Button face | Panels, buttons, buildable tiles |
| `#dfdfdf` | Light | The second bevel pixel, the route line |
| `#ffffff` | Highlight | Top and left bevel edge, text on navy |
| `#808080` | Shadow | Bottom and right bevel edge, wall outline |
| `#000000` | Dark | 1 px outlines, text |
| `#000080` | Navy | Title bar, range ring, Pop-up window |

### Towers: identity colours

| Hex | Tower | Shape of the base |
|---|---|---|
| `#008080` | Gun (teal) | Square |
| `#800000` | Cannon (maroon) | Circle |
| `#ff3300` | Laser (orange-red) | Long bar |
| `#808000` | Taser (olive, with yellow `#ffff00` for electricity) | Diamond |
| `#3399cc` | Frost (ice blue) | Hexagon |
| `#ffcc00` | Beacon (gold) | Ring with a lamp |
| `#00a000` | Repair (green) | Ring with a white cross |
| `#9a9a9a` | Cursor (grey) | Square with the arrow cursor |
| white | Wall | See section 5 |

### Enemies: one blue-grey family

Enemies are **not** colour-coded by hue. Shape carries identity, so a mixed wave reads as one force.

| Hex | Enemy | Shape |
|---|---|---|
| `#35506a` | Grunt | Round dome, one eye |
| `#577489` | Runner | Narrow dart |
| `#2f4b62` | Shielded | Round body inside a hexagon frame |
| `#6b8598` | Flyer | Winged |
| `#406080` | Armoured | Square plate with four rivets and a 2 px outline |
| `#4a637a` | Saboteur | Diamond with a fuse spark at the rear |
| `#5a7183` | Breacher | Rounded square with a toothed jaw |
| `#27495d` | Boss | Round, with a segmented rim and a crown |

Accent colours in use on enemies:

- **Eyes:** pale ice blue, `#e6f4ff` to `#bfe6ff`, with a black pupil.
- **Saboteur:** amber, `#806000` to `#ffcf5a`, for the fuse, the charge and the eyes.
- **Boss:** an orange eye (`#ff8a1e`) and a gold crown. The Boss is the only enemy with warm colour
  on its body, so it stands out.

### Colours the engine owns

The engine draws these over your art. Do not use them for the same job, or the player sees the effect
twice.

| Hex | Meaning |
|---|---|
| `#00d0d0` | Shield ring, shield impact arc, `SHD` number |
| `#6699ff` | Beacon aura ring |
| `#00d0ff` | Frost slow arc |
| `#0080c0` | Repair progress bar |
| `#d00000` | Offline tower mark |
| red to green | Health bar |

### The one exception: effect sprites may be tinted

Colour lives in the file, with one exception. Effects are colour-coded by what *caused* them rather
than by what they are: a death ring takes the enemy's colour, so a Grunt's ring is blue-grey and a
Boss's is darker still. Shipping nine near-identical death-ring files would be worse for an artist
than one, so **effect sprites are the single exception — the engine may tint them at runtime.** A
death ring is authored white and tinted to the dead enemy's colour; a shield arc keeps its cyan in
the file. Everything else keeps its colour in the file.

---

## 3. Rules of form

- **Light comes from the top-left.** This matches every bevel in the chrome. Highlights go on the top
  and left, shadows on the bottom and right. Art that rotates (turrets, four of the enemies) carries
  its light with it. That is accepted.
- **Gradients are for volume.** Use a radial gradient for a dome and a linear gradient for a plate or
  a barrel. Three stops are enough: light, identity colour, dark.
- **Keep the black outline.** A 1 px black outline around the silhouette holds the icon look together
  and separates the art from the grey tile. The Armoured uses 2 px on purpose.
- **Facets are an alternative to gradients.** The Saboteur, the Taser base and the Frost base are cut
  into flat facets, each a different shade. Use this for hard, crystalline things.
- **Opacity is fine for glass, glow and soft shadow.** Do not use it for the main body, because the
  tile shows through.
- **No stroke under 0.5 px.** Thin lines vanish at 20 px.
- **Stay in the 32×32 box.** Nothing clips your art, so overflow draws over the next tile. Aim for a
  28 px silhouette, centred. Board tiles are the exception: they fill all 32 px.
- **Do not change the outer size of a silhouette.** The engine sizes the sprite and the click area
  from the old bounds.

---

## 4. What the engine draws on top of you

Do not bake any of these into a file.

| Runtime element | Where it lands | What it means |
|---|---|---|
| Health bar | A thin bar at the top of the tile | Damage state |
| Range ring | A 1 px dashed navy circle | Shown on hover and while placing |
| Placement preview | A ghost of the tower plus the range ring | Where the next tower would go. The ghost reuses your base and turret art at 50% alpha, so it reads as the same tower |
| Shield ring | A cyan ring outside the body | Shield strength |
| Weak-point notch | A short white tick on the leading edge | An aimed click pays double |
| Slow arc | A pale blue arc | Frost is on this enemy |
| Route | A light grey dashed line, 3 px | The live path |
| Offline mark | A grey wash and a red cross | Tower at 0 HP |
| Repair hatch | Diagonal lines on a wall | Repair in progress |
| Fully-upgraded pip | A 4×4 green square in the top-right corner (bottom-right when a health bar shows) | Nothing left to buy |
| Flyer shadow | A dark ellipse under the Flyer | Height |
| Muzzle flash, tracers, sparks | Between tower and target | Firing |
| Wall bevel | The whole button edge of a wall | See section 5 |

**Layer order, back to front:** tiles → route → shutters → tower base → tower turret → branch mark →
tower overlays (wall bevel, bars, pip) → Pop-up windows → enemies → enemy effects → range rings,
placement ghost and the pointer.

Enemies draw **above** towers. Keep the top-right and bottom-right corners of a tower quiet, because
the pip lands there.

---

## 5. Specific guidance

### Enemies

- **Silhouette first.** Use the shapes in the table in section 2. No two kinds may be confused at
  20 px.
- **Give them eyes.** One eye or two, pale with a black pupil. Eyes are what make the enemies read as
  alive.
- **Rotating kinds face right.** Runner, Flyer, Saboteur and Breacher turn with their heading. Draw
  them pointing along **+x**, with the eyes looking forward.
- **Fixed kinds have no front.** Grunt, Shielded, Armoured and Boss never rotate. Draw them so they
  look out of the screen at the player. A face that points sideways will look wrong on every turn.
- **The Boss is drawn large.** `boss.svg` appears at about twice the size of the other enemies, so
  its detail gets a close look.

### Towers

- **Base and turret are separate files.** The base never rotates. The turret is drawn **pointing
  north (up)** and rotates about the centre of the box, where 0 is north and angles increase
  clockwise.
- **Put a hub on the pivot.** Each rotating turret has a round head at (16,16). It hides the join
  when the barrel turns.
- **The barrel is the character.** Gun: a slim barrel with a dark muzzle. Cannon: a short thick tube
  with a muzzle ring. Laser: a slim emitter with a crystal tip.
- **Taser and Frost turrets never turn.** Draw them with no front: the Taser is a coil seen from
  above, the Frost is a six-arm snowflake.
- **Beacon, Cursor, Repair and Wall have no turret file.**
- **Do not draw the tile** under a tower. The board draws it.

### The wall

`wall-base.svg` is a plain white square. The engine tints it and draws the whole button bevel in
code, because the wall changes look with its state (plain, branched, open gate, locked, damaged,
repairing). Leave this file white. A grey or coloured face cannot be tinted correctly.

### Branch marks

- A branch mark is a full 32×32 file drawn over the tower. The engine does **not** rotate it.
- For Gun, Cannon and Laser, **centre the mark on the hub at (16,16)**. A mark placed on the barrel
  stays where it is when the barrel turns away.
- For Cursor, put the mark in the **bottom-left corner**, clear of the arrow and of the pip.
- Keep a mark to about 10 px. Use a dark or light disc behind the glyph when the glyph needs contrast.

### Board tiles

- `tile.svg` appears 240 times. Keep it quiet: a soft gradient and a bevel, nothing else.
- `obstacle.svg` must look lower or heavier than a tile, so the player sees at once that nothing can
  be built there.

---

## 6. Things to avoid

- **Baked-in runtime state:** health bars, range rings, shield rings, selection boxes, the pip.
- **Colour-only differences.** If two things differ only by hue, they are the same thing to a
  colour-blind player.
- **Text inside SVGs.** The engine draws all text.
- **Isometric or 3D perspective.** The board is seen from straight above.
- **Soft, modern shapes:** pills, large corner radii, thin-line icon sets. They do not belong to the
  period.
- **Heavy blur and drop-shadow filters.** A small offset shadow drawn as a shape is fine. SVG filter
  effects are slow to rasterise and look out of period.
- **SVG's own animation.** The engine rasterises frames and drives frame-sequence animation itself
  from numbered files (see [Animation](#9-animation)); `<animate>` and CSS keyframes do not play.

---

## 7. Things to coordinate

- **Adding frames** to an existing asset needs only the numbered files plus a `.json` — no code
  change. See [Animation](#9-animation) and [`docs/ART-ANIMATION.md`](ART-ANIMATION.md).
- **Adding a new asset** (a new enemy, tower or branch) still needs the code to know its name: the
  naming helpers in `src/view/art.ts` map each kind to its file. A file with no code reference does
  nothing, and the smoke run flags it as unreferenced.
- **Renaming a file** makes the game fall back to the old code-drawn shape with no error. Rename the
  code reference in the same commit.
- **A new enemy** also needs a size factor in `ENEMY_ART_BODY` and, if it must face its heading, an
  entry in `ENEMY_ART_ROTATES` (both in `src/view/board.ts`).
- **A new tower with a turret** needs an entry in `TOWER_TURRET_KINDS` (`src/view/art.ts`).
- **Conflicts:** the more complex file wins, see
  [`public/art/README.md`](../public/art/README.md). `node scripts/art-merge.mjs --apply` does it.

---

## 8. Checklist before you push

- [ ] `viewBox="0 0 32 32"`, silhouette centred, outer size unchanged.
- [ ] Reads at 20 px. Has something more to see at 64 px.
- [ ] Light from the top-left. Black outline kept.
- [ ] Identity colour is the mid-tone.
- [ ] Turret points north. Rotating enemies point right. Fixed enemies have no front.
- [ ] Branch mark does not depend on the barrel angle.
- [ ] No runtime state baked in.
- [ ] File name matches the manifest.
- [ ] `npm run smoke` passes.

---

## 9. Animation

Frame-sequence animation is driven by numbered files, not code — the full contract is in
[`docs/ART-ANIMATION.md`](ART-ANIMATION.md). This section is the taste part: what is worth animating
and what will hurt you.

**Animate the small motions, keep the silhouette.** A good frame only moves a *part*: a leg, an eye, a
jaw, a spinning ring. The outline the engine sizes the sprite and the hitbox from must stay put, or a
player aiming at the weak point is aiming at a moving target.

Worth animating:

- **Walk cycles.** Enemies that travel should step, not glide. Two to four poses around the base frame
  read as a walk at 8 fps; `when: "moving"` keeps the base pose while they stop.
- **Chewing.** A Breacher biting a wall is the classic case for `when: "moving"` — the walk cycle must
  stop while it chews, or it looks like it is marching through the wall.
- **Spin.** A rotating part (a turret hub, a beacon lamp, a radar ring) can spin with a short loop.

Do not animate:

- **Silhouette changes that break hitbox reading.** Never shift the outer bounds or the leading edge
  from frame to frame. The weak-point notch and the click area are drawn from the same bounds the still
  used.
- **Sub-2 px detail.** A 1 px line or a single-pixel dot that moves between frames flickers at 20 px
  and reads as noise, not motion. Keep the smallest moving element at 2 px or larger.
- **Colour-only pulses.** A frame that differs only by hue is the same frame to a colour-blind player
  and adds nothing but file count.

When in doubt, leave it still. A clean still beats a muddy animation, and every still is already a
valid one-frame sequence — the engine costs nothing extra to draw it.

