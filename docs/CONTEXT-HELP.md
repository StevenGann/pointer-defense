# Context help: the ? button

Windows has a `?` box in the title bar next to minimise, maximise and close. Click it and the
pointer becomes a question mark; the next thing you click opens Help at the page for that thing, and
if nothing is written about it the pointer simply goes back to normal. This is that.

## The box

- `WindowChromeOpts` gains `help?: boolean`. When set, `drawWindowChrome` draws a fourth control box
  to the **left of minimise** and returns it as `WindowChromeGeom.help`.
- The glyph is `?`, from a new `public/art/ui/glyph-help.svg` (14 px, white on transparent, same
  conventions as `glyph-close`), with a drawn fallback so the button exists before art loads.
- `?` is dimmed exactly like a disabled control when the window has no help to give.
- The main window — the one that frames the menu and the run — passes `help: true`. Sub-windows
  (Help itself, Upgrades, Restore, dialogs) do not: a help button inside Help is noise.
- The four boxes must fit inside the title bar without overlapping at the narrowest supported window
  (640 px wide) and at 1280 px. That is a geometry test, not a visual check.

## The mode

One piece of state, `helpCursor: boolean`, owned by `main.ts` and derived by one pure function:

```ts
export function nextHelpMode(mode: boolean, action: 'press-help' | 'click' | 'cancel'): boolean
```

- `press-help` toggles it.
- `cancel` (Esc, right click, clicking the box again) clears it.
- `click` always clears it — a click is consumed either way.

While the mode is on:

- The pointer draws `public/art/ui/cursor-help.svg` (arrow with a `?` badge) instead of
  `cursor-arrow`. Fallback: the arrow with a drawn `?` badge, so the mode is never invisible.
- The status-bar hint reads `Click something to read about it — Esc cancels`.
- The left click does **not** reach the game: no tower is placed, no wave is called, no enemy is
  clicked, nothing is selected. It resolves one help topic instead.

## Resolving the topic

New `src/view/contexthelp.ts`:

```ts
export type ContextHelpHit =
  | { kind: 'tower'; tower: TowerKind }
  | { kind: 'enemy'; enemy: EnemyKind }
  | { kind: 'control'; control: 'pointer' | 'salvage' | 'integrity' | 'wave' | 'next-wave' | 'upgrades' | 'specs' | 'records' }
  | { kind: 'board' }
  | { kind: 'none' };

export function contextHelpPage(hit: ContextHelpHit): string | null
```

Mapping — and it must be this table, because these are the pages that exist:

| Hit | Page |
|---|---|
| tower (button or on the board) | `tower-<kind>` |
| enemy (boss kinds included) | `boss-<kind>` for a boss, `enemy-<kind>` otherwise |
| pointer control or a click on the board with nothing else under it | `mechanics-pointer` |
| salvage readout | `mechanics-salvage` |
| wall button or a wall on the board | `mechanics-walls` |
| wave / next-wave panel | `mechanics-early-call` |
| upgrades panel | `tower-<kind>`? **No** — return `null`; global upgrades have no page yet |
| everything else | `null` |

`null` means "nothing written about this", and the click closes the mode without opening Help.

The hit is built from the **same hit-tests the normal click path already uses** (`towerAt`,
`hudControlAt`, the enemy pick), so the two cannot drift apart. Resolve the kind of the thing under
the pointer; do not act on it.

## Opening the page

`HelpSession` gains `openAt(pageId: string)`: opens the viewer with that page selected in the nav
panel, scrolled into view, at scroll 0. If the page does not exist, or `pageUnlocked` is false for
the current profile, the call does nothing and returns false.

## Tests

1. The mapping table above, case by case, including the nulls (a boss kind maps to `boss-…`, a grunt
   to `enemy-…`, an unknown control to null).
2. `nextHelpMode` truth table for the three actions.
3. Title-bar geometry: four boxes, no overlap, inside the bar, at 640 and 1280 px.
4. `openAt('tower-gun')` selects that page; `openAt('nope')` changes nothing and returns false;
   `openAt` on a page gated by an unseen enemy returns false.
5. A click in help mode places no tower and starts no wave: run the normal click path with the mode
   on and assert the run state is byte-identical afterwards.
