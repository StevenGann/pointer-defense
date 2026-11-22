# Tooltips on the Restore tree

Status: spec, not built. Owner: Guppy. Written 2026-11-22 against `main` at `a802242`.
Reported: "Prestige upgrades need tool tips explaining what they do."

## What exists

Every node in `src/core/tree.ts` already carries a name, a one-line `description` ("+10% tower
damage") and a `cost`. The Tree tab draws the name and the price and nothing else, so the only way to
learn what a node does is to buy it and watch.

`TooltipView` already exists, is parented above the Restore window on the stage, and is already fed by
`updateTooltip()` for palette entries, towers, enemies and Global Upgrades rows.

## The change

**A tree-node tooltip, on hover, over the whole row.**

- `treeNodeTooltipLines(node, profile)` in `src/view/restore.ts` (Pixi-free, so smoke can call it):
  - line 1 — the node name, in `TOOLTIP_BLUE` as a `TooltipSegment` so it reads as a header
  - line 2 — `node.description`
  - line 3 — the price: `dlg.restore.treeCost` = `{cost} Restore Points` (one new key)
  - when already owned, line 3 becomes `dlg.upgrades.rowOwned` (`Owned`) instead of a price
- `updateTooltip()` gains one branch before the board/HUD cases: while `restoreSession.open` and the
  Tree tab is active, resolve `restoreHitAt(...)`; a `{type:'node'}` hit shows that node's lines keyed
  `'tree:' + id`, anything else clears the tooltip and returns — so a board tooltip can never show
  through the dialog.
- Tier rows get no tooltip: their whole label is already on screen, and their expander is a control,
  not a description.
- The tooltip is already above `restoreView.root` in the stage order, so no reordering is needed; if a
  later change moves it below, the tooltip would hide behind the window — assert the parent order.

## Strings

One new key, `dlg.restore.treeCost`: `{cost} Restore Points`, drafted into all seven catalogues with
`draft: true` and `fit:` width assertions like every other dialog string. Placeholder preserved.
Nothing else is new — name, description and `Owned` all exist.

## Tests

- `treeNodeTooltipLines` for a known node returns its name, description and `"{cost} Restore Points"`.
- An owned node's third line is `Owned`, not a price.
- `restoreHitAt` on the middle of a node row returns that id, and the same point over the tier header
  returns a tier hit rather than a node.
- The tooltip key changes when the hover moves between two nodes and empties over the status bar.
- `i18n:check` passes with the new key present in all seven catalogues.
- Both regression hashes unchanged: hover is presentation only.

## Out of scope

Tooltips for the Specs or Restore Point tabs, node reordering, and any change to the tree data.
