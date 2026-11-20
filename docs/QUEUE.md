# Dev queue

The ordered list of what is being built next, and the only place the order lives. Chat moves on;
this file does not. Each entry says what "done" means, so an item can be closed without re-arguing
its scope, and links the spec that governs it.

Work is taken from the top. An item that needs a decision goes back to Sydney rather than sitting in
`doing` for a week.

## Doing

Nothing in flight — the two builds below merged; the map gallery is next to dispatch.

## Next

### 1. Map selection gallery

- **Spec:** `docs/MAP-SELECT.md`.
- **What ships:** Play opens a six-card gallery instead of starting `LEVELS[0]`; thumbnails are drawn
  at runtime from each level's own walls and route (no art files, cached per level id); card names use
  the existing localized `level.*.name` keys; focus order follows the visual order in RTL; the last map
  is remembered in `pd.map.v1`.
- **Done when:** every map's thumbnail is distinct and stable, six cards fit the client area in all
  seven locales, `Enter` starts the focused map, and `Esc` returns to the menu.
- **Why:** five of six authored maps are currently unreachable without the editor.

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
