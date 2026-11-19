# Tester notes, pass 1

Two UI notes from the first tester round.

## 1. Salvage belongs above the shop

Salvage ($) is currently the last item in the status bar, bottom-right, where nobody looks while
shopping. It moves to the left panel, directly above the tower purchase list.

- A sunken readout, 26 px tall, spanning the panel's inner width, between the integrity block and the
  route line.
- The value is right-aligned and set in the larger readout size used by the integrity figure, not the
  body size: `$1,234`, tabular digits, no currency word.
- The Blackout modifier still masks it. Where the status bar printed `---`, this readout prints `---`
  too, and nothing about the masking changes.
- The status bar keeps wave and speed and loses the salvage item, which keeps the bar from growing.
- The readout is present whether or not a tower is selected for inspection; the detail view is
  otherwise taller than the build list, so make sure the panel still fits at 1280x720 and 1600x900.

## 2. Starting a wave drops the build tool

Clicking a tower in the shop arms a placement ghost. Start a wave with that still armed and the next
click on the board can place or drag instead of doing what the player meant.

Clear the armed build tool the moment a wave actually starts: `s.selected = null` inside
`startWave`, after the call has been accepted. This covers the HUD button, the keyboard shortcut and
the Auto Wave path in one place.

- It must not touch `selectedTowerId`. A tower selected for inspection stays selected.
- A refused start (already in a wave, or otherwise rejected) leaves the armed tool alone.
- The status-bar hint that says "Click a tile to place ... — right-click to cancel" disappears with
  the selection, so a wave start also clears that line.

## Smoke assertions

1. `computeHud` exposes a salvage row above the tower rows and below the integrity block.
2. The left panel's tallest layout still fits inside the panel at 1280x720 and 1600x900.
3. The salvage readout prints `$N` and prints `---` under Blackout; the status bar no longer prints
   the salvage figure.
4. `selectTower('gun')` then `startWave` leaves `s.selected === null`.
5. A `startWave` call refused because a wave is already running leaves `s.selected` untouched.
6. `selectPlacedTower(id)` then `startWave` keeps `s.selectedTowerId` set.
