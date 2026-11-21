# Detail pane: branch on its own line, no tier cap

Status: spec, not built. Owner: Guppy. Written 2026-11-21 against `main` at `d49fcef`.

Two defects in the selected-tower pane on the right (`src/view/hud.ts`, `TowerDetailLayout`):

1. **The branch name overflows.** The title is one string — `{name} T{tier} of {max}` plus
   ` - {branch}` — so `Cursor T4 of 5 - Overclock` is one unbroken Text that runs past the panel edge.
2. **The title reveals the tier cap.** `of {max}` tells a first-time player exactly how far upgrading
   goes, which is information the ladder is supposed to teach.

## 1. Title

`hud.towerName` becomes `{name}  T{tier}` in all seven catalogues. `max` and `kindMaxTier` leave the
call site. No other change to the title row, its close box, or its position.

## 2. Branch line

A new row directly under the title, drawn only when `tower.branch !== null`:

- `hud.towerBranch` loses its dash prefix and becomes `{branch}` in all seven catalogues.
- The row is the same height (18 px) and the same style as the stats row beneath it, so the pane reads
  title → branch → stats.
- The pane grows by 18 px when the branch row exists (`box.h` is derived from the cursor, so this is
  free), and everything under it — buttons, map row, wave, auto-wave — moves down with it.

## 3. Nothing else may leak the cap

The upgrade-button tooltips print `T{tier} of {max}` for the current and next tier
(`tooltip.tierOfMax`, used by the damage, repair, beacon, wall, minesweeper and cursor upgrade
lines). Those become `T{tier}` too. The key is renamed `tooltip.tier` and `max` is dropped from every
call; all seven catalogues get the language-neutral `T{tier}`.

"Fully upgraded" stays. It is a state the tower is already in, not a count of how many are left.

## 4. Fitting

- Every translated branch name must fit the new row at the pane's inner width, in all seven locales.
  The `fit:` assertions get a case for the longest branch name per locale.
- The `detail name` fit assertion drops its `max` argument and must still pass.
- Worst-case column height — branch row, synergy row, target row, upgrade, three stacked branch
  buttons, repair, sell, map row, wave, auto-wave — must end inside the sidebar. Add a smoke check
  that computes the detail box bottom and the last row's bottom in that case.

## 5. Out of scope

The hover tooltip's title (it never carried the cap), the branch button labels, the Help ladder table
(deliberate documentation), and the `Route: N tiles` row.
