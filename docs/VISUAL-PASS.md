# Visual pass: the four screens around the game

The board, the HUD and the windows drawn over a run look like the 1997 game they are imitating. The
four screens you meet *around* a run do not: the main menu is three raised rectangles on a sunken
field, Global Upgrades and Restore are plain panels, and the Help window is a close cousin of the CHM
viewer rather than a copy of it. This pass fixes all four without touching gameplay.

Everything is drawn with the existing palette (`PAL` in `src/view/chrome.ts`) and Tahoma. No new art
files: glyphs are drawn in `Graphics`, icons reuse the existing UI art where one fits.

## 0. Shared chrome (`src/view/chrome.ts`)

Four new helpers, used by every screen below, so the windows agree with each other:

- `drawWindowChrome(g, rect, title, opts)` — the outer raised face, a `PAL.title` title bar with a
  1 px `PAL.highlight` top bevel, the title text with a 3 px indent, and three 16×14 buttons on the
  right (minimise, maximise, close) drawn as beveled boxes with the classic glyph marks. `opts.close`
  decides whether the close box is live.
- `drawTabStrip(g, rect, labels, active)` — the property-sheet tab row: raised tabs with a 2 px
  lift for the active one, a `PAL.highlight` top-left bevel and `PAL.shadow` bottom-right, active tab
  2 px taller and joined to the sheet below.
- `drawListView(g, rect, columns, rows, selected, scroll)` — a sunken white field, a raised header
  band with beveled separators, column titles in 11 px bold, zebra rows, the selected row filled
  `PAL.title` with `PAL.titleInverse` text, and a vertical scrollbar drawn by `drawScrollbar`.
- `drawStatusBar(g, rect, panels, widths)` — a two- or three-panel status bar: raised separators,
  a 1 px sunken groove at the top of each panel, 11 px text.

Also `drawScrollbar(g, rect, thumbFrac, thumbStart, hovered)` — sunken track, raised arrows top and
bottom with drawn triangles, a raised proportional thumb with a 2 px grip band.

## 1. The main menu — a desktop that is alive

The menu stops being a dialog on an empty field and becomes a small application window sitting on a
desktop that is still running a game behind it.

**Backdrop** (fills the client area, under everything):
- `PAL.desktop` teal, with a 1 px dotted grid every 40 px at 12 % white — the board's own grid,
  seen from further away.
- A dimmed route: the current map's path drawn as 40 px tiles at 18 % white with 2 px dotted edges,
  slowly pulsing (alpha 0.10 → 0.18 over 4 s).
- **Drifting creeps**: four to six enemy silhouettes (the spawn's existing art if loaded, otherwise a
  solid rounded shape in `PAL.shadow`) that cross the desktop left to right along the route, 14 %
  alpha, at 12–20 px/s, respawning with a fresh offset when they reach the exit. Two of them are
  flyers and drift on a sine above the route.
- **Every 9–14 s** a 16 px pointer glyph slides to one drifting creep, clicks it (a 6 px white spark
  and a 3 px ring), and the creep pops with four small squares. This is what makes the screen feel
  alive: something is being played, badly, in the background.

**The window** (centred, 320 × 380 plus the menubar and status bar):
- Title bar: `Pointer Defense` — minimise and maximise drawn and disabled, close live and doing
  nothing but a soft beep (it is the menu, there is nowhere to go).
- Menu bar row under the title: `File  View  Help` in 11 px, each opening nothing — they are
  furniture, and clicking one flashes it.
- The wordmark: `POINTER DEFENSE` at 26 px bold in `PAL.title`, with a 1 px white drop shadow and a
  pointer-arrow glyph to its left, under a 2 px navy rule with a 1 px highlight beneath.
- A **marquee strip** under the rule, 18 px tall, sunken: rotating tips in 11 px, scrolling right to
  left at 30 px/s, `Tip: flyers ignore your maze` · `Tip: Ctrl+click upgrades a whole row` ·
  `Tip: the pointer crits on weak points` · `Tip: Restart Windows keeps your specs`.
- Buttons, 240 × 44, 12 px apart, each: a 16 px glyph on the left, the label at 13 px bold, the
  shortcut key right-aligned in 11 px (`Enter`, `D`, `E`, `R`, `L`, `C` for Continue). Hover lifts
  the bevel to `PAL.highlight`/`PAL.slight` and tints the glyph navy; pressed sinks it 1 px; the
  keyboard-focused button carries a 1 px dotted focus rectangle inset 3 px.
- Status bar with three panels: `Ready` (120 px) · `Best wave 61 · 37 runs · 42/118 achievements`
  (flex) · `v0.11` (60 px).

**Motion budget**: the backdrop is at most 8 sprites and 6 redrawn shapes a frame; nothing here may
allocate per frame or touch the art loader on demand beyond the first request. The menu must hold
60 fps at 1280 × 720.

## 2. Global Upgrades — Add/Remove Programs

Rebuild the window as a property sheet:

- 660 × 430, title `Global Upgrades`, live close box, `OK` / `Cancel` in the bottom right with `OK`
  as the default (a 1 px dotted ring inside its bevel).
- A toolbar strip under the title: three 24 px beveled buttons with drawn glyphs — a shopping cart
  (buy), an information `i`, and a down arrow — separated by a 2 px raised divider. Buttons look
  disabled (grey glyph, no bevel lift) when they have nothing to do.
- A tab strip: **Available** and **Owned**.
- A list view under the tabs, sunken, with the columns `Icon | Upgrade | Unlocks | Cost | Status`.
  44 px rows for the icon column, 11 px header text, zebra `PAL.face`/`PAL.light`, the selected row
  in navy with white text, and a vertical scrollbar when the list exceeds the pane.
- The **Owned** tab shows the same list without the cost column, with `Owned` in the status column
  and each row's icon at full colour instead of dimmed.
- Status bar: `14 upgrades · 3 owned` left, `Salvage $1,240` right.
- A one-line description strip between the list and the buttons: the selected upgrade's blurb in
  11 px italic on `PAL.face`, sunken 1 px.

## 3. Restore — System Properties

The prestige screen becomes a three-tab property sheet, 620 × 420:

- **Restore Point** tab: a sunken panel that explains the payout in plain words with the live numbers
  (`Restart Windows converts this run into 34 Restore Points`), the big `Restart Windows` button as
  the default action, and a Win95 **segmented progress bar** showing progress to the next point
  (14 px tall, 8 px blocks with 2 px gaps, `PAL.navy` fill).
- **Specs** tab: four rows (CPU, RAM, GPU, Disk) as a list view with `Name | Level | Effect`, the
  same zebra and selection rules as Upgrades, and a stepper (◄ value ►) beside the selected row's
  level when points are available.
- **Tree** tab: the Restore tree drawn as a proper tree control — 16 px `[+]`/`[-]` boxes with 1 px
  black borders, dotted 1 px guide lines between siblings, a 12 px node square (filled navy when
  bought, an empty sunken box when not), the node name in 13 px and its price right-aligned in 11 px.
- Bottom row: `Apply` and `Close`, Apply disabled when nothing changed.
- Status bar: `Restore Points 34` left, `Specs 12/70` right.

## 4. Help — a CHM viewer

Make it read as `hh.exe` at a glance:

- Window 720 × 470, title `Pointer Defense Help`, live close box, and a **toolbar** of six 24 px
  flat buttons, each 24 px apart, with drawn 16 px glyphs and tooltips: hide/show the navigation
  pane, Back, Forward, Home, Print, Options. Disabled arrows are greyed, not hidden.
- Left pane 200 px: a sunken white tree area with 16 px book and page glyphs, `+`/`-` expanders,
  dotted guide lines, and the selected topic filled `PAL.title` with white text. At the bottom of
  the pane, a **tab strip** `Contents | Index | Search` (CHM's three tabs), where Index is a
  scrollable A–Z list of page titles and Search is a sunken text field with a `Search` button that
  filters topics by substring as you type.
- A 4 px raised splitter between the panes with a 2 px grip line, draggable between 140 px and 320 px.
- Right pane: a white sunken page, 2 px padding, 13 px Tahoma body, the page title in 16 px bold
  `PAL.navy` with a 1 px `PAL.shadow` rule under it, bullets as `•` with a 12 px indent, and the
  scrollbar from §0 shown proportional to the page.
- Status bar: the current topic path (`Towers › Gun`) left, `Page 3 of 12` right.

## Constraints

- Nothing here changes gameplay, saves, or the sim.
- Hit-testing must keep working for every existing control: the menu buttons and their keys, the
  upgrade rows, the Restore buttons and tabs, and the whole Help tree and toolbar. Reuse the existing
  hit-test functions and extend them where a new control needs it.
- Every screen fits with no overlap at 1024 × 640 and 1280 × 720.
- No new dependencies, no new art files, no per-frame allocations in the draw path.

## Tests

1. Menu layout: the window, its buttons and its status bar fit at both sizes, the buttons keep their
   ids and key bindings, and nothing overlaps.
2. Menu animation state is pure and time-driven: two draws at the same time produce the same state,
   and the drifting-creep count never exceeds eight.
3. Upgrades: both tabs list the right rows, the selected row is the navy one, the list clips its
   rows, and the scrollbar appears only when the list overflows.
4. Restore: the three tabs switch, Apply disables when clean, and the progress bar's fill equals
   `points / pointsNeeded` within one block.
5. Help: Contents, Index and Search all select pages, the search filters on substrings, the splitter
   clamps to 140–320 px, and Back/Forward enable correctly.
6. All four screens keep their existing behaviour tests green.
