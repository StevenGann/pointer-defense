# Restore dialog: text from one tab survives on another

Status: spec, not built. Owner: Guppy. Written 2026-11-21 against `main` at `68036be`.
Reproduced in a real browser against the deployed build.

## 1. The leak

`drawRestoreTab` writes three dedicated `Text` objects — `payoutText`, `restartText`,
`progressText` (`src/view/restore.ts:347-349`, assigned at 471-484). Nothing ever blanks them when
another tab is drawn, so on the **Specs** tab the Restore Point copy is still on screen:

- "Windows could not run in 0" drawn across the list's column header row
- "Restart Windows" drawn across the RAM row
- "Progress to the next point" drawn across the GPU row

The Specs list itself is behind them and reads as garbage. The same three strings sit on the Tree tab.

## 2. The fix

- Add `clearRestoreTabTexts()`: blank those three `Text` objects. Call it whenever the active tab is
  not `restore`.
- Symmetrically, when the active tab **is** `restore`, blank the pooled `rows` texts that the Specs
  and Tree tabs fill — the existing per-tab blanking only runs inside those tabs' draw functions.
- Keep the tab dispatch as it is: `restore` / `specs` / `tree` each own their own content.

## 3. Two smaller faults found in the same view

- **The steppers never draw at zero.** `row.stepper` is `null` unless the row can go up *or* down
  (`src/view/restore.ts:186`), so a fresh profile shows a bare number with no way to change it: the
  Specs tab looks like a read-only list. Build the stepper for every row and draw the minus/plus as
  disabled (`PAL.shadow` arrows, sunken off-face) when that direction is unavailable.
- **The level number is half a character off.** `levelText.anchor.set(0.5, 0.5)` is applied, the
  position is set for a centre anchor, and then `anchor.set(0, 0.5)` replaces it — so the glyph is
  drawn right of the intended centre. Set the anchor once, before positioning.

## 4. Tests

- The dialog's own geometry is already covered; the leak is a draw-order fault, so the acceptance is
  visual: open System Properties, visit Restore Point → Specs → Tree → back, and each page shows only
  its own text.
- Steppers exist on all four spec rows with 0 RP; minus and plus are drawn but disabled.
- The level digit sits inside its 40 px value box, centred, at every level 0-10.

## 5. Out of scope

The Restore Point copy, the Tree tab's own layout, the Apply/Close wiring.
