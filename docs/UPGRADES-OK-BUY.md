# Global Upgrades: OK must buy, and off-screen rows must not eat clicks

Status: spec, not built. Owner: Guppy. Written 2026-11-21 against `main` at `815222d`.

Two faults, one symptom: pressing **OK** appears to do nothing.

## 1. Why the click misses

`upgradesHitAt` walks **every** row before it looks at the buttons
(`src/view/upgrades.ts:233-238`). Row rects are laid out for all revealed upgrades, not just the
visible ones, so rows past the bottom of the list are positioned *below* the body — across the
description strip, the OK/Cancel row and the status bar. A click on OK therefore resolves to an
invisible row, sets the selection, and returns; the dialog never sees `ok`.

Fix: the row loop only considers rows inside the visible window
(`firstRow .. firstRow + rowsVisible - 1`), and the buttons are tested **before** the rows so a
control on top of the list can never be shadowed by it. Both, not either.

## 2. Why OK still would not buy anything

`upgradesPointerDown` treats `ok` and `cancel` identically — both just hide the dialog
(`src/main.ts:1503-1504`). The only purchase path is the small cart glyph in the toolbar, and the
keyboard.

OK becomes the commit button:

- On the **Available** tab, if the selected row is buyable, OK buys it and closes the dialog.
- If the selected row is owned, unaffordable, or the tab is **Owned**, OK just closes — it never
  swallows a click and never buys something the player cannot pay for.
- Cancel still only closes.
- The cart glyph and the keyboard keep working as they do: buy in place, dialog stays open.

No new string: the button stays **OK**.

## 3. Tests

- A click at the centre of the OK rect resolves to `{ type: 'ok' }` on a list that overflows, at
  scroll 0 and at `scrollMax`, with 14 rows revealed.
- A click at the centre of the Cancel rect resolves to `{ type: 'cancel' }`.
- A click on a visible row still resolves to that row.
- A click below the last visible row but inside the body resolves to `{ type: 'window' }`, never to a
  hidden row.
- OK on a buyable selected row deducts its cost, adds it to the run's upgrades, and closes.
- OK on an unaffordable row leaves salvage and upgrades untouched, and closes.
- Cancel never changes salvage.

## 4. Out of scope

The cart glyph, the keyboard shortcuts, the row selection model, and the layout of the dialog.
