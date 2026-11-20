# Tester notes, pass 2

Two more notes from the testers.

## 1. Close the tower detail pane without hunting for the board

Selecting a placed tower replaces the shop list with its detail pane. The only way back is to click an
empty part of the board, which looks like "do something on the board" and can start a placement.

- The detail pane's title row gains a small Win95 close box on its right edge, the same control the
  help window uses.
- Clicking it clears `selectedTowerId` and returns the shop list, exactly as clicking away does.
- Esc does the same while a placed tower is selected. Esc keeps its existing jobs first — closing a
  dialog — and only deselects when nothing else wants it.
- The pane still closes on a click away, unchanged.

## 2. Ctrl+click to upgrade every tower of that type

Ctrl+clicking a placed tower upgrades every other tower that is in the same place on the upgrade
ladder, in placement order, spending salvage until it runs out.

"Same place" means the same kind, the same tier and the same branch. A Ctrl+click on a tier-1 Gun
upgrades the other tier-1 Guns; a Ctrl+click on a tier-3 Marksman upgrades the other tier-3
Marksmen and touches nothing else.

- Towers that would need a branch choice are skipped. A tier-2 tower has two mutually exclusive
  branches and the game does not pick for the player. The status line reports the count:
  `Upgraded 4 towers — 2 need a branch (click one to choose)`.
- Walls are three-tier and branch at tier 2, so the same rule applies: Ctrl+click a tier-1 wall
  upgrades tier-1 walls, and the branch step is skipped.
- Order is placement order (tower id ascending), so the same board gives the same result.
- Spending stops at the first tower that cannot be afforded; everything already upgraded stays.
- The clicked tower is included in the sweep.
- The status line reports what happened and nothing happens when nothing could be upgraded.
- A plain click still selects the tower for inspection. Only the Ctrl modifier changes the meaning.

## Tests

1. The detail close box clears `selectedTowerId` and the shop returns.
2. Esc with a tower selected clears it; Esc with a dialog open closes the dialog and leaves the tower.
3. Ctrl+click on a tier-1 Gun upgrades every tier-1 Gun and no other kind or tier.
4. Ctrl+click never chooses a branch: tier-2 towers are left alone and counted in the report.
5. The sweep stops when salvage runs out, in id order, and keeps what it bought.
6. Without Ctrl the same click only selects.
