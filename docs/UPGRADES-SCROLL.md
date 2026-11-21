# Global Upgrades list does not scroll its rows

Status: spec, not built. Owner: Guppy. Written 2026-11-21 against `main` at `2da1653`.

The Global Upgrades dialog scrolls its stripes but not its contents. `computeUpgradesLayout` builds
each row's hit rect and icon as

```
y: list.body.y + i * UPGRADE_ROW_H
```

with no `firstRow` term (`src/view/upgrades.ts:165-171`). `drawListView` paints zebra rows from
`geom.firstRow`, so after one wheel notch the stripes have moved up while the names, unlocks, costs,
statuses and icons have not: they sit one row lower per notch, spill past the bottom of the pane and
over the description strip.

The same rect is what `upgradesHitTest` tests (`src/view/upgrades.ts:234`), so the fault is not only
visual — a click lands on the row above the one the player aimed at.

## The fix

One offset, applied where the rows are built:

```
y: list.body.y + (i - list.firstRow) * UPGRADE_ROW_H
```

for `rect` and for `icon`. Rows outside the visible window are skipped by the caller already; this
just puts the visible ones where the stripes are.

## Tests

- With `scroll = 2`, the row at `firstRow` has `rect.y === list.body.y`, and no visible row's rect
  leaves `list.body`.
- A hit test at the centre of the body's first row returns the upgrade at `firstRow`, not at row 0.
- Scrolling to `scrollMax` keeps the last row inside the body and the icon aligned with its row.
- Standing checks that already pass keep passing: rows clipped, scrollbar only when overflowing,
  Available/Owned column sets.

## Out of scope

`restore.ts` builds its Specs rows the same way but never scrolls them (its scroll is hardcoded to 0),
so it is correct today and is not touched here.
