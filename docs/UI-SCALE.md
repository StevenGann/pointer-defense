# A UI scale setting, so text and cursors are readable on large screens

Status: spec, not built. Owner: Guppy. Written 2026-11-22 against `main` at `3e52a63`.
Reported: "Text is way too small on high resolution screens. We need a setting to change text scale."
and, immediately after, "Cursors are also too small on large monitors."

## Why it happens

The canvas fills the window (`resizeTo: window`) and `computeLayout(app.screen.width, app.screen.height)`
lays the whole interface out in CSS pixels. Every font size in `FONT_SIZE` and every rect in
`computeLayout` is a fixed number, so a 4K monitor gets the same 11 px text and the same 16 px pointer
drawn across 3840 px of window. Nothing is wrong with the type — the interface simply never scales.

## The decision: scale the interface, not only the glyphs

A text-only multiplier would grow strings inside rects that did not grow with them, and the app has
hundreds of fixed-height rows, fixed-width panels and `fit:` assertions whose whole point is that text
fits its box. Instead the game gets the same mechanism Windows itself used for the same problem: lay
the interface out in **fewer logical pixels** and scale the finished stage up.

- `profile.uiScale` — one of `1`, `1.25`, `1.5`, `2`. Default `1`. Persisted with the profile; older
  saves load as `1`.
- `layout = computeLayout(screen.width / uiScale, screen.height / uiScale)`, and the single `root`
  container holding every view gets `root.scale.set(uiScale)`.
- Because the stage is scaled, the whole interface scales uniformly: text, the title bar, the menu,
  panel rows, the board, the procedurally drawn pointer. Large screens get a bigger interface instead
  of more empty desktop; the window still fills the screen.
- Pointer input divides the canvas coordinates by `uiScale` before any hit test, so a click still lands
  where the user clicked. Every existing hit test stays in logical space and needs no change.
- `syncViewport()` keeps feeding the *logical* window to the run state, so the performance governor and
  the board's static-layer key keep seeing the numbers they always saw.

## The setting

View → **Text Size**: `100%`, `125%`, `150%`, `200%`, with the current value checked. Radio behaviour —
choosing one closes the menu, writes the profile and redraws immediately. The label says text size
because that is what the player is reaching for; the mechanism scales the whole interface and the
submenu says so on the status bar when changed (reusing the existing status line, no new sentence).

Strings: one new label `menu.view.textSize` and four values. Values reuse the numbers plus `%` — no
translated prose, nothing to fit.

## What must not change

- Save keys, seeds, level codes, balance constants: untouched.
- `pd.save` gains one field with a default, older saves still load.
- The board still shows the same number of tiles at every scale (the logical layout does not change,
  only how many device pixels a logical pixel occupies).
- No new dependency, no art file, no rng.

## Tests

- `computeLayout(3840 / 2, 2160 / 2)` equals `computeLayout(1920, 1080)` — scaling is exact, not
  approximate.
- A pointer at device (x, y) maps to logical (x / uiScale, y / uiScale); at `2` a click at device
  (1000, 600) lands in the same panel as a click at (500, 300) at scale `1`.
- `profile.uiScale` round-trips through save and load, and an older save without the field loads at `1`.
- The menu shows four values with exactly one checked, and checking a different one changes it.
- Both regression hashes unchanged: the sim never sees the scale.

## Out of scope

Per-element font sizes, a free-form slider, and any change to the art or to the pointer's shape.
