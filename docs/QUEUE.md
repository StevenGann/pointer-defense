# Dev queue

The ordered list of what is being built next, and the only place the order lives. Chat moves on;
this file does not. Each entry says what "done" means, so an item can be closed without re-arguing
its scope, and links the spec that governs it.

Work is taken from the top. An item that needs a decision goes back to Sydney rather than sitting in
`doing` for a week.

## Doing

Nothing in flight.

## Next

### 1. Four more stock maps

- **Spec:** `docs/MAPS-BATCH-2.md` — Moat, Hourglass, Trident, Switchyard, with exact geometry and
  measured path lengths.
- **What ships:** four entries appended to `LEVELS`, their `level.<id>.name` keys in all seven
  catalogues, and the gallery grid deriving its column count from `LEVELS.length` and the client width
  (the fixed 3×2 no longer holds ten cards).
- **Done when:** all four validate, each has buildable tiles and a proven placement, thumbnails stay
  distinct across ten, and the grid fits at 1280×720 and 1024×768 in both directions.

### 2. Per-locale width assertions across the chrome

- **Why:** the menu bar got per-locale fit tests when the CJK width bug was fixed; the HUD panels,
  dialogs, buttons and status bar still only assert that English fits. Russian runs ~130% of English
  and Hebrew ~110%, so a translation can overflow a rect that English passes.
- **Done when:** a smoke group measures every fixed-width label in the HUD, the dialogs and the
  status bar under all seven locales and fails on overflow or collision.

### 3. Native review of the six machine-draft catalogues

- **Why:** every non-English catalogue is `draft: true`. Machine translation is worst exactly where
  this UI lives — buttons, jargon, and short labels with no context.
- **Done when:** es, fr, ru, uk, zh-Hans and he have each been read by a speaker, the `draft` flag is
  dropped per locale as it is signed off, and the glossary traps (Hebrew Pointer/Cursor, Russian
  апгрейд on a button) are confirmed or overruled.
- **Blocked on:** people, not code. Nothing here can be closed by me.

## Housekeeping

### 4. Branch and worktree sweep

- **Why:** the repo carries 100+ merged branches and roughly 50 worktrees; only `pd-upgate` holds
  `main`. It works, it is just noise when looking for something.
- **Done when:** merged branches are deleted, stale worktrees are removed, and `pd-upgate` is the
  only long-lived one besides whatever is currently in flight.
- **Note:** offered twice, never answered. Safe to ignore.

## Shipped recently

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
- **Art.** The artist fills in quality animations later; the SVGs are placeholders by design.
- **Touch input, difficulty selection, more authored maps, co-op.** See `docs/design.md`,
  "What is not built".
