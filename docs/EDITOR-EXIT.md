# The editor has no way out

Status: spec, not built. Owner: Guppy. Written 2026-11-21 against `main` at `8865660`.
Reported live: "I lost and now I'm stuck in the map editor with no way to exit."

## The fault

The editor screen draws no exit control. The only way back to the menu is the Escape key
(`src/main.ts:1983-1994`), which is undiscoverable — and it takes up to three presses, because it
closes the library, then the save-name box, then a dialog, before it leaves.

The one control that looks like an exit does not work: **File → Exit** calls `exitRun()`, and
`exitRun()` branches on `runOrigin` (`src/main.ts:1134`). When the editor is reached from a lost
editor test run, `runOrigin === 'editor'`, so `exitRun()` sets `screen = 'editor'` — the editor
exits to itself. That is exactly the reported dead end, and it is worse than no button.

## The fix

1. **File → Exit is screen-aware.** On the editor screen it takes the editor's own way out — the
   same path Escape uses (save the draft, `screen = 'menu'`) — instead of `exitRun()`.
2. **A visible way out.** The editor's top strip gets an **Exit** button at its right end, same
   bevel and metrics as the editor's other controls, calling the same path. It reuses the existing
   `menu.file.exit` string, so no catalogue changes and no new keys.
3. **One key press, not three.** On the editor screen, Escape leaves for the menu even when a
   dialog or the name box is open — those are dismissed by the click that opened them, and a modal
   that can swallow the only exit is the bug being fixed. The library keeps its own Escape (it is a
   panel with a visible close).

## Tests

- `exitEditor()` puts `screen` at `'menu'` and writes the draft, whether `runOrigin` is `'play'`,
  `'load'` or `'editor'`.
- File → Exit on the editor screen reaches `exitEditor`, not `exitRun`.
- The Exit button's rect is inside the editor's top strip and inside the window at 1280×720 and
  1024×768, and it is not overlapped by another control.
- A lost editor test run does not leave a state where the only exit returns to the editor.

## Out of scope

The editor's tools, the draft format, and the loss dialog.
