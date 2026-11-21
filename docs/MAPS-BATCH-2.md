# Four more stock maps

Status: spec, not built. Owner: Guppy. Written 2026-11-21. Drafted against the maps shipped in
`src/core/levels.ts` at `4b42644`.

The gallery now has a card for every entry in `LEVELS`, and six maps is thin for a selection screen:
four of the six are corridor-shaped, and none of them is a chokepoint, an enclosure, or a map with more
than two lanes. This spec adds four that each play differently, and the one layout change the gallery
needs to hold ten cards.

Every number in this document was measured by building the candidate `Level` and running the real
`validateLevel`, `createGrid`, `buildField` and `pathTiles` over it — not estimated from the picture.

A note for whoever implements this: `box(c0, c1, r0, r1)` was removed from `src/core/levels.ts` with
the Ladder fix, because nothing used it any more. Two of these maps need it, so it comes back — same
signature, same body as the other wall helpers.

## Design rules these four follow

- 20×12 board, exactly one spawn and one exit, both on tiles a route can reach.
- A level must leave enough buildable floor that a player can actually play it. The Ladder shipped with
  zero buildable tiles because `box(...)` filled the middle; the smoke group added with that fix is the
  template for what each new map gets.
- No authored route may share a tile with another except at the spawn and exit (`routeProblem`).
- At most four toggles, and no combination of their states may seal spawn from exit.
- Names come from `level.<id>.name`; ids are stable identifiers and never localized.

## 1. The Moat — `moat`

A ring road around a sealed courtyard. The ring is one tile wide and the courtyard is nine tiles
across, so the map is played from the inside out: towers in the courtyard cover the arc nearest them,
and a tower placed *on* the ring pushes the flow round the other way. The courtyard has no gate on
purpose — enemies never walk in it, and turrets fire over the moat wall.

```ts
const MOAT_WALLS = [
  ...horizontal(0, 0, 19),
  ...horizontal(11, 0, 19),
  ...vertical(0, 0, 11),
  ...vertical(19, 0, 11),
  ...horizontal(2, 2, 17),
  ...horizontal(9, 2, 17),
  ...vertical(2, 3, 8),
  ...vertical(17, 3, 8),
];
// spawn (1,1) · exit (18,10)
```

```
####################
#S.................#
# ################.#
# #              #.#
# #              #.#
# #              #.#
# #              #.#
# #              #.#
# #              #.#
# ################.#
#                 X#
####################
```

- Buildable tiles: **136** (48 ring + 84 courtyard + 4 corners).
- Shortest route: **27** tiles.
- Buildable tiles within two tiles of the route: **50** — the courtyard rows adjacent to each moat wall.
- Reads as: enclosure and coverage. Bad for a single tall stack, good for spreading Guns and Cannons
  along the two arcs the ring actually uses.

## 2. The Hourglass — `hourglass`

One full-height wall with a single gate. Two large rooms, one threshold, and four 2×2 blocks that break
up the corners so the rooms are not empty rectangles. Everything the player builds is aimed at the gate
or at the long approach to it.

```ts
const HOURGLASS_WALLS = [
  ...vertical(9, 0, 4),
  ...vertical(9, 6, 11),
  ...box(3, 4, 2, 3),
  ...box(15, 16, 2, 3),
  ...box(3, 4, 8, 9),
  ...box(15, 16, 8, 9),
];
// spawn (0,2) · exit (19,9) · the gate is (9,5)
```

```
         #
         #
S..##    #     ##
  .##    #     ##
  .......#
        ............
         #         .
         #         .
   ##    #     ##  .
   ##    #     ##  X
         #
         #
```

- Buildable tiles: **213**.
- Shortest route: **27** tiles.
- Within two tiles of the route: **104**.
- Reads as: chokepoint. The only map where a single well-placed splash tower can cover the whole
  crossing; the wide rooms punish players who spread out instead of stacking the gate.

## 3. The Trident — `trident`

Three authored lanes from one spawn to one exit: a short middle lane straight across, a long top lane
and a longer bottom lane. Fork already splits enemies two ways, but the two halves there are the same
length; here the lanes are 20, 27 and 29 tiles, so a slow tower is worth more on the middle lane and a
long-range one earns its cost on the outer lanes. The four 2×2 blocks sit between the lanes, where a
tower can reach two of them at once.

```ts
const TRIDENT_WALLS = [
  ...box(4, 5, 3, 4),
  ...box(13, 14, 3, 4),
  ...box(4, 5, 7, 8),
  ...box(13, 14, 7, 8),
];

const TRIDENT_TOP: Route = [
  { col: 0, row: 5 }, ...column(0, 1, 4), ...rowRun(1, 1, 19), ...column(19, 2, 4),
];
const TRIDENT_MID: Route = rowRun(5, 0, 19);
const TRIDENT_BOTTOM: Route = [
  { col: 0, row: 5 }, ...column(0, 6, 10), ...rowRun(10, 1, 19), ...column(19, 6, 9),
];
// spawn (0,5) · exit (19,5)
```

```
....................
.                  .
.   ##       ##    .
.   ##       ##    .
S..................X
.                  .
.   ##       ##    .
.   ##       ##    .
.                  .
....................
```

- Buildable tiles: **224**.
- Lane lengths: top **27**, middle **20**, bottom **29**.
- Reads as: routing. It is the most open board after Open Field, but the lanes are fixed, so mazing
  cannot collapse them into one corridor.

## 4. The Switchyard — `switchyard`

Two full-height walls, each with a permanent gap and one shutter. The long way round is always open;
the shutters are shortcuts, so opening one shortens the run from **38** tiles to **28** and closing it
puts the length back. Turnstile asks the player to react to a gate that severs a lane; this asks them to
build for a route that keeps changing shape, and the two shutters run on different periods so the shape
changes twice per cycle.

```ts
const SWITCHYARD_WALLS = [
  ...vertical(6, 0, 0),
  ...vertical(6, 2, 8),
  ...vertical(6, 10, 11),
  ...vertical(13, 0, 1),
  ...vertical(13, 3, 9),
  ...vertical(13, 11, 11),
  ...box(2, 3, 7, 8),
  ...box(16, 17, 3, 4),
];

const SWITCHYARD_TOGGLES: readonly LevelToggle[] = [
  { col: 6, row: 9, periodTicks: 720, openTicks: 300, phaseTicks: 0 },
  { col: 13, row: 2, periodTicks: 540, openTicks: 240, phaseTicks: 180 },
];
// spawn (0,5) · exit (19,5) · permanent gaps at (6,1) and (13,10)
```

```
      #      #
.............#
.     #     .o......
.     #      #  ## .
.     #      #  ## .
S     #      #     X
      #      #
  ##  #      #
  ##  #      #
      o      #
      #
      #      #
```

- Buildable tiles: **212**.
- Route: **38** tiles with both shutters closed, **28** with both open.
- Within two tiles of the route: **122** on the long way round, **92** on the short cut.
- Reads as: timing. Neither shutter can ever seal the map, because each wall keeps a permanent gap —
  that is a hard requirement of `validateLevel`, not a stylistic choice.

## What the gallery needs

`LEVELS.length` becomes ten, which is four rows at the gallery's three columns — more than the client
area shows at once. The answer is the scrolling gallery specified in `docs/MAP-SELECT.md` §Layout: a
proportional scrollbar on the right edge (left in RTL), one row per wheel notch, focus-follows-scroll,
and cards clipped to the view. With ten maps the bar is visible at 1280×720; with six it is not.

Nothing else about the cards changes: 196×146 with a 120×72 thumbnail, three columns, centred, RTL
columns right to left.

## Localization

Four new keys, one per map, in all seven catalogues:

- `level.moat.name` — "The Moat"
- `level.hourglass.name` — "The Hourglass"
- `level.trident.name` — "The Trident"
- `level.switchyard.name` — "The Switchyard"

Non-English entries ship as machine drafts behind the existing `draft: true` flag, like every other
catalogue. The ids are never translated.

## Acceptance

- `validateLevel` returns null for all four.
- Each map has at least 60 buildable tiles, and `canPlace(s, 'gun', …)` succeeds on at least one tile
  of each — the placement path, not only the grid.
- Thumbnails stay distinct across all ten levels (the existing gallery check must be widened to ten).
- The gallery fits ten cards at 1280×720 and at 1024×768 without overflow, in both LTR and RTL.
- `npx tsc --noEmit`, `npm run i18n:check`, `npm run smoke`, `npm run build` all pass.

## Open questions, with a proposed answer

- **Where in `LEVELS` do they go?** Append after Ladder, so `DEFAULT_LEVEL` and every saved run keep
  pointing at the same map. Order by difficulty later if the gallery needs a curve.
- **Does the Moat's sealed courtyard need a visual hint?** No new art. The thumbnail shows the moat, and
  the first tower placed in the courtyard teaches it.
- **Are two shutter maps too many?** They share a mechanic and nothing else: Turnstile severs a lane,
  Switchyard changes the route's length. If they feel repetitive in play, Switchyard is the one to cut,
  and The Terrace — a 51-tile serpentine across three one-row walls, 195 buildable, 138 within two tiles
  of the route — is the replacement already measured.
