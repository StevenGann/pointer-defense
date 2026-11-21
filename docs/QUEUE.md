# Dev queue

The ordered list of what is being built next, and the only place the order lives. Chat moves on;
this file does not. Each entry says what "done" means, so an item can be closed without re-arguing
its scope, and links the spec that governs it.

Work is taken from the top. An item that needs a decision goes back to Sydney rather than sitting in
`doing` for a week.

**The list is never idle.** While `Next` has an unblocked item, something is in flight: when one merges,
the next is dispatched the same day rather than waiting to be asked. An item blocked on a person does
not count, and the one after it is taken instead.

## Doing

1. **Seven more stock maps** — `docs/MAPS-BATCH-3.md`. Comb, Shelves, Pinwheel, Twin Halls,
   Ziggurat, Gauntlet, Quarry; ten maps to seventeen. Branch `feat/maps-batch-3`.
2. **Ad progress bar** — `docs/ADS-PROGRESS.md`. A three-pixel bar on the bottom of every ad, the
   dialog grown to 220x98 to hold it. Branch `feat/ads-progress`.
3. **Pathing review** — an agent is reading how the field and `stepToward` decide a route, measuring
   whether enemies favour one side, and proposing fixes. Analysis only; branch `feat/pathing-review`.
4. **Cannon shells** — `docs/CANNON-SHELLS.md`. The Cannon stops dealing damage invisibly: it fires a
   shell that leads the target and lands its splash a flight later, reusing the Flak shell's
   machinery. Branch `feat/cannon-shells`.
5. **Loss returns to the main menu** — `docs/LOSS-TO-MENU.md`. The Game Over button stops creating a
   fresh Corridor run and calls the existing `exitRun()` instead. Branch `feat/loss-menu`.
6. **The No-Build tile** — `docs/NO-BUILD-TILE.md`. A third tile kind: walkable floor with a faint
   crosshatch, refused by tower and wall placement, painted in the editor. Branch
   `feat/no-build-tile`.
7. **Remove the enemy facing tick** — `docs/ENEMY-FACING-TICK.md`. The white leading-edge tick goes;
   enemies are drawn by their own art now. Branch `feat/enemy-tick`.
8. **Synergy in the tower tooltip** — `docs/TOWER-SYNERGY-TOOLTIP.md`. One `Synergy: <name>` line per
   synergy the tower is really in, read from a new `rowsOf` map on the memoised layout. Branch
   `feat/synergy-tooltip`.

## Next

### 0. Ground pathing tie-break

- **What:** `docs/PATHING-REVIEW.md` proves the one-sided route. `stepToward` keeps the first
  neighbour that ties for the shortest step, and the scan order is up, left, right, down, so a
  symmetric fork sends 20 of 20 enemies up, and the Corridor's route leans 26 tiles above centre to
  14 below.
- **Recommended rule:** momentum first — keep the current heading when it ties — then the
  tile-parity order only where momentum does not decide. Measured over all ten maps: 33 direction
  changes against the baseline's 28 (the parity-only rule sawtooths to 79, so it is rejected), with
  the above/below split moving from 180/87 to 142/125.
- **Done when:** the rule is in `stepToward`, the two smoke hashes are re-baselined with a note, and
  the Corridor route is checked by eye.
- **Not started:** holds until the five in-flight items land.

### 1. Native review of the six machine-draft catalogues

- **Why:** every non-English catalogue is `draft: true`. Machine translation is worst exactly where
  this UI lives — buttons, jargon, and short labels with no context.
- **Done when:** es, fr, ru, uk, zh-Hans and he have each been read by a speaker, the `draft` flag is
  dropped per locale as it is signed off, and the glossary traps (Hebrew Pointer/Cursor, Russian
  апгрейд on a button) are confirmed or overruled.
- **Known traps to settle first:** Hebrew has the pointer and the Cursor tower sharing a word in
  opposite directions — the clicking pointer is `סמן` while the Cursor tower is `מצביע` in
  `name.tower.cursor` and `tree.cursorLicence.name` but `סמן` in `tooltip.palette.cursor`,
  `tooltip.cursorName` and `ach.cursorFirst`. Pick one word for each concept before reading the rest.
  Ukrainian renders Endless as "Без меж"; confirm that is the name a player expects.
- **Blocked on:** people, not code. Nothing here can be closed by me.

## Housekeeping

Nothing outstanding. The branch and worktree sweep ran on 2026-11-21: 59 stale worktrees removed, 141
merged branches deleted, leaving `main` plus one spare detached checkout.

## Shipped recently

- **Help, all three phases** — content audit with every number bound to its constant and six new
  topics (`docs/HELP-REVIEW.md`); the CHM chrome (print, Options, Locate, tree keys, context menu,
  topic count, all-words search, tooltips); all six catalogues translated.
- **Menu submenus** (`60d8616`) — Spawn is a real nested flyout with hover, flip, clamp, keyboard and
  RTL mirroring; `secondColumn` is gone.
- **Synergies batch 2** (`9790aa3`) — Chill, Interlock, Shatter and Buttress, with marks drawn in
  `Graphics` rather than new art.
- **Branch and worktree sweep** — 65 worktrees down to 2, 142 branches down to 1.
- **Per-locale chrome fit** (`3abbb26`) — 771 fit checks over seven locales, plus real overflow fixes in
  the catalogues. Restart Windows, Endless and the Global Upgrades title keep their meaning.
- **Tower licences** (`241fd58`) — eight RP-priced prestige unlocks; Early Access removed and its
  owners migrated to all eight licences.
- **Four more maps** (`58a0604`) — Moat, Hourglass, Trident, Switchyard, appended to `LEVELS`; ten
  maps, four rows, and the gallery's scrollbar reaches the last one.
- **Scrolling map gallery** (`4cd002e`) — three fixed columns, vertical scroll with a proportional
  scrollbar, wheel/thumb/track/PageUp/PageDown input, focus-follows-scroll and clipped cards, so any
  number of maps fits. 39 smoke checks at six and at twenty-six maps.
- **The Ladder is playable** (`4b42644`) — the `box(1, 16, 3, 8)` fill left the map with zero buildable
  tiles; the centre is hollow now and each band keeps a 2×2 balcony island.

- **Map selection gallery** (`30390ee`) — Play opens a six-card gallery; thumbnails are drawn at
  runtime from each level's walls and route, cached per level id; `pd.map.v1` remembers the last map.
- **Spotter synergy** (`ecabd19`) — a Marksman (Gun branch A) lends its range, capped at 5.5 tiles, to
  orthogonally adjacent AA and Cannon towers; max never sum, Minesweeper excluded, a downed Marksman
  spots nothing. Spec is `docs/SYNERGIES.md` §9.
- **Per-row synergy art** (`bf9a4c1`) — the spotter row draws its own chevroned link, so the two rows
  differ by shape as well as colour.
- **Tower Synergies** (`4e1703b`) — adjacent AAs hold their fire for a leader and land one volley;
  amber dashed edges below the tower bases, View → Synergy lines, a Help page, all seven locales.
- **Ad tips, ads localized** (`a891c44`) — the ad dialog carries a verified gameplay tip under the
  reward line; the six ad titles and messages finally live in the catalogue instead of in core.
Kept short on purpose — the last few things that landed, so "did we do that?" has an answer here
instead of in chat. Older history is `git log`.

- **Help text measured, not guessed** (`0e9b180`) — the `length × 13 × 0.6` ruler made Help pages
  look stretched with wide gaps between words; prose now measures with the real font metrics and RTL
  prose is flush right.
- **Menu bar measured per locale** (`e37c696`) — CJK words collided because layout assumed 7 px a
  letter; words are measured, and every locale must fit the bar without overlap.
- **No phantom turrets** (`71b4a0a`) — per-tower sprite pools are indexed by slot, so a wall that
  inherited a gun's slot kept drawing the gun's turret. Slots are cleared before redraw.
- **Help prose in all seven languages** (`5e7f438`, `24286db`) — 910/910 keys, still `draft`.
- **Victory message no longer under the title bar** (`df60c77`) — the block was centre-anchored and
  grew upward into the 20 px title bar.

## Deferred by request — not in the queue

Kept here so these do not get re-proposed as new work:

- **Steam packaging.** `electron/`, the preload bridge and the `pack:*` scripts exist and degrade to
  the plain web build; no AppID, no depot upload.
- **Music.** `src/audio/sfx.ts` only.
- **Art.** The artist fills in quality animations later; the SVGs are placeholders by design. The
  files whose current drawing is still mine are listed in `docs/ART-TODO.md`.
- **Touch input, difficulty selection, co-op.** See `docs/design.md`,
  "What is not built".
