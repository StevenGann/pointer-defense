# Pointer Defense — frame-sequence animation

This page is the artist's guide to animating an asset. You do not need to read any code: an
animation is just **more files plus a small JSON** in `public/art/`. The engine turns them into a
frame sequence automatically.

Read [`docs/ART-STYLE.md`](ART-STYLE.md) for what should look like *what* (silhouettes, colours,
the Windows 95 icon motif) and [`public/art/README.md`](../public/art/README.md) for the base file
contract (the 32×32 viewBox, facing, layers). This page is only about the frame sequence on top of
that.

---

## The support matrix — what animates, and what stays static

Not every asset can animate. The table is the whole story: if a row says *static*, numbered frames
are ignored, and the build warns you (see §7), so a dropped `x.1.svg` is never a silent no-op.

| Asset | Animated? | Clock | Phase seed | Notes |
|---|---|---|---|---|
| Enemy body | **yes** — fps | `now − spawnTick` | enemy id | `when: "moving"` works here (see §6) |
| Tower base | **yes** — fps | `now − placedTick` | tower id | counts from placement, so `hold` waits from the moment it is built |
| Tower turret | **yes** — fps | `now − placedTick` | tower id | same clock as the base so a two-part animation stays in step |
| Muzzle flash | **yes** — lifetime | effect age | — | frames map across the flash's whole life |
| Hit spark | **yes** — lifetime | effect age | — | same |
| Death ring | **yes** — lifetime | effect age | — | same |
| Shield arc | **yes** — lifetime | effect age | — | a one- or two-frame pulse is enough |
| Shutter (toggle wall) | **yes** — lifetime | ticks since the flip | — | plays once across 18 ticks, then holds (see §4) |
| Branch marks | **static** | — | — | a permanent badge, not motion |
| Board tiles | **static** | — | — | chrome that already changes with state |
| Wall face | **static** | — | — | tinted/bevelled per state by code |
| UI glyphs (cursor arrow, wrench, window glyphs, check, menu arrows) | **static** | — | — | movement there is noise |
| Placement ghost | **static** | — | — | a preview of a still asset |

The two shutter leaves (`ui/shutter-open`, `ui/shutter-closed`) are the *only* UI assets that animate;
everything else under `ui/` is static. The placement ghost reuses the tower's base/turret art at 50 %
alpha and is always drawn still, so animating a tower never doubles the ghost's sprite pool.

---

## The two clock models

An animation advances on one of two clocks. Both are **simulation ticks**, never wall-clock time, so
pausing freezes them and a ×2/×3 speed plays them faster with no view involvement.

**1. fps** (enemies, towers). A frame is chosen from `ticks × fps`, with `loop`, `hold`, `holdAfter`,
`randomStart` and `when` all honoured exactly as §2 describes. This is the walk-cycle / spin model.

**2. lifetime** (effects and shutters). An effect already has a fixed life — a muzzle flash lives a
few ticks, a death ring a few more — so an 8 fps sequence would need 7.5 ticks *per frame* and would
vanish before it moved. Instead the sequence is spread across the effect's whole life:

```
frame = min(frames − 1, floor(age / lifetime × frames))
```

`fps`, `loop` and `randomStart` are ignored; `hold` is respected only as a delay before the first
frame. A four-frame explosion lands on its last frame exactly as the effect expires, and it never
wraps. Shutters use the same model with a fixed `lifetime` of 18 ticks: when a toggle flips, the
target leaf plays its frames once across that beat, then holds the matching end frame. A map with no
shutter frames behaves exactly as today — the cut stays.

---

## 1. The filename convention

An asset named `grunt` animates by adding **numbered siblings** next to its existing still:

```
public/art/enemies/grunt.svg      frame 0 — the existing still, now the first frame
public/art/enemies/grunt.1.svg    frame 1
public/art/enemies/grunt.2.svg    frame 2
public/art/enemies/grunt.3.svg    frame 3
public/art/enemies/grunt.json     optional animation metadata
```

The rules:

- **`grunt.svg` is frame 0.** It stays exactly as it is today. An asset with no numbered siblings is
  a still and behaves exactly as it always did.
- **Frames number from 1 upward.** `grunt.1.svg`, `grunt.2.svg`, `grunt.3.svg`, and so on.
- **Numbering must be contiguous.** `grunt.1.svg` then `grunt.3.svg` is a build error — the build
  names the asset and the missing file, it never guesses.
- **Two or more frames make an animation; one frame is a still.** A `grunt.json` next to a still is
  ignored with a build warning.
- **Never use `grunt.0.svg`.** `grunt.svg` already *is* frame 0, and supporting both spellings
  invites off-by-one confusion. A `grunt.0.svg` file produces a build warning telling you to rename
  it.

### Worked example

To give the Grunt a four-frame walk:

1. Keep `grunt.svg` as the base pose (frame 0).
2. Add `grunt.1.svg`, `grunt.2.svg`, `grunt.3.svg` — the three in-between poses, in order.
3. Add `grunt.json` (the walk-cycle template below) if you want anything other than the defaults.

The engine now plays `0 → 1 → 2 → 3 → 0 → …` at the JSON's `fps`.

---

## 2. `grunt.json` — the metadata

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

Every key is optional; the value shown is the default. The JSON goes next to the frames and is named
after the base asset (`grunt.json` for `grunt.svg`).

| Key | Type | Default | What it does | Wrong value |
|---|---|---|---|---|
| `fps` | number | `8` | Frames per second, 1–60. `8` means each frame shows for 1/8 s. | Anything outside 1–60, or a non-integer, fails the build. |
| `loop` | string | `"loop"` | How the sequence advances: `loop` (play to the end, restart), `pingpong` (play forward then backward), `once` (play to the last frame and stay), `hold0` (play once then return to frame 0 and stay). | Any other string fails the build. |
| `hold` | number | `0` | Seconds to show frame 0 before the sequence starts. With `randomStart` it offsets into the sequence instead. | A negative or non-number fails the build. |
| `holdAfter` | number | `0` | Seconds to hold the *final* frame before restarting (loop modes only). | A negative or non-number fails the build. |
| `randomStart` | boolean | `true` | Offset each instance into the sequence by a deterministic hash of its id, so a crowd does not march in lockstep (see §5). | A non-boolean fails the build. |
| `when` | string | `"always"` | `"always"` plays always; `"moving"` plays only while the enemy is actually travelling and sits on frame 0 when stopped (see §6). | Any other string fails the build. |

**Unknown keys are a warning, not an error.** If you add `"note": "redo the legs"` the build prints a
warning and carries on, so extra artist notes are safe.

---

## 3. Copy-paste templates

### Looping walk cycle

```json
{
  "fps": 8,
  "loop": "loop",
  "hold": 0,
  "holdAfter": 0,
  "randomStart": true,
  "when": "moving"
}
```

Use this for an enemy that walks. `when: "moving"` keeps it on the base pose while it is stopped
(see §6); `randomStart` stops a crowd from marching in lockstep (see §5).

### One-shot effect

```json
{
  "fps": 8,
  "loop": "once",
  "randomStart": false,
  "when": "always"
}
```

Use this for something that happens once — a muzzle pop, a death burst, a beacon pulse. Effects are
**lifetime-driven** (see the two clock models): their frames are spread across the effect's whole life,
so `fps` and `loop` are ignored and you do not need to set them; `hold` is honoured only as a delay
before the first frame. The JSON above is still accepted, but for an effect the engine ignores
everything except `hold`.

---

## 4. How the clock works

An animation's frame is chosen from **simulation ticks, not wall-clock time**. The game advances in
fixed 1/60 s ticks regardless of the monitor's refresh rate, so pausing the game freezes the walk
cycle exactly and running at ×2 or ×3 speed plays it faster, without the view knowing about either.

There are two clock models — **fps** and **lifetime** — explained in the section above; the support
matrix tells you which asset uses which. This section describes the fps model: the animator is a pure
function of *(ticks since the entity spawned, fps, loop mode, holds, and a per-entity offset)*. A still
asset is a one-frame sequence, so it goes through the same path and costs nothing extra.

---

## 5. `randomStart` — why a crowd should not march in lockstep

By default every instance is offset into the sequence by a deterministic hash of its **entity id**.
Left to their own devices, twenty Grunts spawned the same tick would all show the same frame and march
in perfect unison — which reads as a single mechanical blob, not a crowd. The offset spreads their
phases so the wave looks alive. It is a *hash*, not a dice roll: the same id always gets the same
offset, and it never touches the simulation's own RNG stream, so a run's numbers are unaffected.

---

## 6. `when: "moving"`

Set `"when": "moving"` on any asset that should only animate while the thing is travelling. This
applies to **enemies only**: a Breacher chewing through a wall sits on frame 0 rather than looking
like it is still walking, and a stunned enemy does the same.

Towers and effects animate while alive, so the "moving" idea has no meaning for them — a tower is
placed once and never moves, and an effect only exists for its short life. The `when` field is kept in
the metadata for every asset, but the engine only reads it for enemies; everywhere else it is ignored
(and the support matrix says so).

---

## 7. The build step

The frame list is discovered at build time, so you never edit TypeScript. A scanner reads
`public/art/**`, finds each `*.svg` and its numbered siblings, reads the matching `.json`, and writes
`public/art/manifest.json` — the runtime manifest. It runs automatically before every dev server start
and every build, and you can run it yourself:

```
npm run art:manifest
```

It is wired into the `predev` and `prebuild` scripts, so `npm run dev` and `npm run build` both
regenerate it.

What it validates:

- frames number **contiguously from 1** (a gap is an error),
- a numbered frame always has its base `*.svg` (frame 0) present,
- the `.json` parses and every key is a legal value from the table in §2,
- a still's `.json` is ignored (warned), a `.0` frame is warned and dropped,
- a numbered frame on a **static** asset (see the support matrix) is ignored and warned — it would
  otherwise be a silent no-op, which is exactly the bug this contract exists to prevent.

### Exact output

Failures print to stderr and the build stops; warnings print to stderr and the build continues. On
success the scanner prints the manifest size.

Errors (each fails the build, with the offending path named):

```
[art] error: enemies/grunt: numbered frames must be contiguous from 1 (missing enemies/grunt.2.svg)
[art] error: enemies/grunt: numbered frames present but enemies/grunt.svg (frame 0) is missing
[art] error: enemies/grunt.json: not valid JSON (…)
[art] error: enemies/grunt.json: the top level must be an object
[art] error: enemies/grunt.json: fps must be a whole number 1-60 (got …)
[art] error: enemies/grunt.json: loop must be one of loop, pingpong, once, hold0 (got …)
[art] error: enemies/grunt.json: hold must be a number >= 0 (got …)
[art] error: enemies/grunt.json: randomStart must be true or false (got …)
[art] error: enemies/grunt.json: when must be "always" or "moving" (got …)
[art] manifest not written: N validation error(s)
```

Warnings (printed, then the build continues):

```
[art] warning: enemies/grunt.0.svg: ".0" frames are not used — rename to enemies/grunt.svg
[art] warning: enemies/grunt.json: unknown key "note" ignored
[art] warning: enemies/grunt.json: animation metadata ignored (enemies/grunt.svg has no numbered frames)
[art] warning: ui/glyph-close.1.svg will never play: ui glyphs are static
[art] warning: branches/gun-marksman.1.svg will never play: branch marks are static
[art] warning: towers/wall-base.1.svg will never play: the wall face is static
[art] warning: board/tile.1.svg will never play: board tiles are static
```

Success:

```
[art] wrote manifest.json (61 assets)
```

---

## 8. Troubleshooting

**The art does not appear at all.** The manifest was not regenerated. Run `npm run art:manifest` (or
just restart `npm run dev` / `npm run build`, which does it for you) and reload. The game reads
`public/art/manifest.json`; a stale one does not know about your new frames.

**Frames play out of order.** Numbering is not contiguous. `grunt.1.svg`, `grunt.3.svg` with no
`grunt.2.svg` is a build error — the scanner will name the missing file. Fill the gap and rescan.

**Everything flickers or shimmers.** You used sub-2 px detail. At 20 px a 1 px line strobes as the
frames advance. Keep the same silhouette from frame to frame and animate *within* it — shift a leg,
an eye, an arm — never the outline the hitbox reads from (see
[`docs/ART-STYLE.md`](ART-STYLE.md)).

**An animation does not start (it just sits on frame 0).** A JSON typo, most likely. Unknown keys are
a warning, not an error, so a misspelt key like `"fps": 8, "loop": "Loop"` (capital `L`) fails
validation — check the build output. An invalid value *does* fail the build, so if the build passed
but the animation is wrong, re-read §2 for the key you meant.

**The frames are there but the motion is wrong.** Check `loop` against §2: `once` freezes on the last
frame, `hold0` snaps back to frame 0, `pingpong` reverses. And check `hold` / `holdAfter` if there is
a pause you did not ask for.
