# Right-to-left layout (Hebrew)

The catalogue gives Hebrew its words; this makes the chrome read the way Hebrew Windows does. The
board is exempt: a tower-defence map is a map, and mirroring it would change which tile is which.

Status: spec, then implementation. Presentation only — a run's outcome must be identical in `he` and
`en`, and smoke proves it with a determinism hash.

## One source of direction

`src/i18n/locales.ts` already carries `dir: 'ltr' | 'rtl'` per locale. `src/i18n/boot.ts` installs the
locale before any module evaluates `t()`.

Add `src/view/direction.ts`:

```ts
export function setDirection(dir: 'ltr' | 'rtl'): void
export function isRtl(): boolean
export function mirrorX(rect: Rect, outer: Rect): Rect   // same size, x flipped inside outer
export function mirrorIfRtl(rect: Rect, outer: Rect): Rect
export function textAnchor(align: 'start' | 'center' | 'end'): { anchor: { x: number }; x: number }
```

`boot.ts` calls `setDirection(localeMeta(code).dir)` when it installs the catalogue, so every view
that asks gets the same answer. No view may read the locale code to infer direction.

## What mirrors

**Window chrome**

- Title bar controls (help `?`, minimize, maximize, close) move to the **left** edge. Visual order
  from the left edge: close, maximize, minimize, help — i.e. the same sequence read right-to-left, so
  the close box is still the outermost button the way Hebrew Windows puts it.
- Menu bar words lay out from the **right** edge: File at the far right, then View, Cheats, Help
  moving left.
- A dropdown opens aligned to the **right** edge of its menu word, and its items are right-aligned.
  Separators and check marks/radio dots sit on the right of the label. Sub-columns (Cheats) render to
  the **left** of the first column, not the right.
- Status bar panes reverse horizontally; each pane's text is right-aligned with the same padding.

**Panels**

- `Layout.leftPanel` and `Layout.rightPanel` swap sides: the build panel is on the right, the
  information panel on the left. The board column keeps its width and position in the middle.
- Inside each panel, labels are right-aligned to the panel's right padding and values keep their own
  alignment; the sunken borders and the list rows are unchanged.
- The tower list buttons keep their vertical order; their labels right-align.

**Dialogs and lists**

- Dialog text right-aligned, buttons reversed left-to-right, default button still reachable with
  Enter and still drawn first in reading order.
- List views (records, map library, upgrades): column order reverses, the rightmost column of an LTR
  list becomes the leftmost, and header text right-aligns.
- Scrollbars move to the **left** edge of their field.

## What does not mirror

- The board, its tiles, the route, tower and enemy sprites, effects and floating numbers. Ground
  shadow offsets keep their sign: the light comes from the same direction in both locales.
- Numbers inside strings. `$1,250`, `20/20` and `×1.5` are rendered by `Intl`/canvas bidi; never
  reverse them by hand and never insert bidi control characters into catalogue strings.
- Keyboard shortcuts and key names.

## Tests (smoke)

1. `isRtl()` is false by default and true only while a `dir: 'rtl'` locale is installed.
2. `mirrorX` is its own inverse and preserves size.
3. With Hebrew installed, `computeLayout` puts `leftPanel` right of `rightPanel`, and their widths,
   the board rect and the total client rect are unchanged from the LTR case.
4. Menu word hit-boxes, reversed, still open the menu the player clicked.
5. A seeded run in `he` produces the same determinism hash as the same seed in `en`.
6. Panel-fit: every HUD label fits its rect in `he` at 1280×720 and 1024×768, measured, not guessed.

## Not in scope

Translating the Help prose, localising the board's own labels beyond the catalogue, or mirroring the
map editor's grid coordinates. Those are separate items.
