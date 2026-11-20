# The editor keeps your work

The editor can produce a map and a `PD2.` code, but the drawing lives in memory only: reload and it is
gone, and there is nowhere to keep more than the one map you are working on. This gives the editor a
draft that survives a reload and a small library of saved maps.

## The draft

Every edit (paint, erase, undo, redo, clear, shutter nudge) writes the current drawing to
`pd.editor.draft.v1`, debounced to at most one write a second. Opening the editor restores it. A
reload, a crash or an Esc to the menu never loses work.

The draft is cleared by **Clear** (it writes the empty board) and by nothing else. It is not the
library; it is the piece of paper currently on the desk.

## The library

`pd.editor.lib.v1` holds an array of saved maps, newest first:

```json
{ "v": 1, "maps": [ { "id": "m3", "name": "The Corridor II", "savedAt": "2026-11-20T21:04:11Z", "level": { ... } } ] }
```

- At most 50 maps; saving the 51st asks which to replace, or refuses if the player cancels.
- `id` is a small monotonic string, unique within the library.
- A map that fails `validateLevel` on load is dropped from the list, not shown.
- Names are 1–24 printable characters; the name field pre-fills with the draft's level name, and an
  empty name becomes `Untitled`.

## The toolbar

The editor toolbar gains **New**, **Open…**, and **Save** ahead of the existing Clear / Test / Copy
code, in that order:

| Button | What it does |
|---|---|
| **New** | Clears the board after a confirm when the draft is not empty; writes the empty draft |
| **Open…** | A small dialog listing saved maps (name, date, size), with **Load**, **Delete** and Cancel |
| **Save** | Writes the draft into the library under its current name; a second Save updates that entry rather than creating another |

After **Load**, the loaded map becomes the draft and its name becomes the drawing's name, so a
following Save updates it instead of duplicating. After **New**, the drawing is unnamed, so the next
Save creates an entry and asks for a name.

Copy code and Test are unchanged. The editor's status line reports every save and load:
`Saved "The Corridor II"`, `Loaded "Fork"`.

The layout must still fit at 1024 × 640 and at 1280 × 720 without overlap; the seven buttons may
shrink to fit but the labels must stay readable.

## Tests

1. An edit writes the draft, and a fresh editor model restores exactly that drawing.
2. Save creates a library entry; a second Save updates it rather than adding a second.
3. Open lists saved maps newest first, and loading one replaces the draft and its name.
4. Delete removes an entry and does not touch the draft.
5. A library entry with an invalid level is dropped from the list and never loaded.
6. The 51st save is refused or replaces a chosen map; the count never exceeds 50.
7. New writes an empty draft, and asks before discarding a non-empty one.
8. A corrupt draft is ignored, the editor opens blank, and the game still boots.
9. Toolbar hit-testing at 1024 × 640 and 1280 × 720 finds every button with no overlap.
