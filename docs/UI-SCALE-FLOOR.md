# The UI scale must not shrink the interface below its design size

Status: spec, not built. Owner: Guppy. Written 2026-11-22 against `main` at `871c257`.
Reported: "The map select screen is broken, it is clipped and most selections are not visible."

## Why

`uiScale` divides the viewport before layout, so at 200% a 1920×1080 window lays out in 960×540 —
less than the interface was designed for. The map gallery computes `rowsVisible` from the client
height and a **fixed** `MAP_CARD_H`; when that height shrinks the floor lands on 0 or 1, the card
column no longer fits, and the bottom of every card is clipped by the client area. Every other screen
with fixed-height rows and dialogs has the same latent fault — the board survives, the map screen does
not.

`uiScale` is a readability setting, not a licence to run the interface in a viewport it cannot fit.

## The change

1. **A floor.** `MIN_LOGICAL_W = 1280`, `MIN_LOGICAL_H = 720`. The profile still stores the requested
   scale, but the applied scale is
   `effectiveUiScale(requested, screenW, screenH)` = the largest value in `UI_SCALES` that is
   `<= requested` **and** leaves at least the floor in both axes; `1` when even that cannot fit.
   Pure and exported, so it is tested without a window.
2. Everything that reads the scale — `computeLayout`, `root.scale`, `devicePointToLogical`,
   `syncViewport`, the screen-size checks — uses the **effective** scale. The profile keeps the
   requested value so the setting survives a move to a bigger monitor.
3. The Text Size submenu marks the **effective** scale with the check and draws a value that cannot
   fit disabled rather than letting the player pick a broken layout.
4. `mapGridMetrics` floors `rowsVisible` at 1: with the clamp this should never trigger, but a
   gallery that can report zero visible rows is a trap for the next layout change.

## Tests

- `effectiveUiScale(2, 3840, 2160)` is `2`; `(2, 1920, 1080)` is `1`; `(1.5, 2560, 1440)` is `1.5`;
  `(1.5, 1600, 900)` is `1.25`; `(1, anything)` is `1`.
- Logical viewport at every allowed combination is at least 1280×720.
- `mapGridMetrics` never returns `rowsVisible < 1`, even for a 200 px client height.
- Both regression hashes unchanged.

## Out of scope

Making the map gallery scale its cards to fit, and any change to the art or to the dialogs.
