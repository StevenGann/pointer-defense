# Cheats stay hidden until the Konami code

Status: spec, not built. Owner: Guppy. Written 2026-11-22 against `main` at `fce23c9`.
Requested: "hide the Cheats from the toolbar until the player types in the Konami Code."

## What exists

`src/core/cheats.ts` already funnels every read through `cheatsEnabled()`, but it returns a module
constant `CHEATS_VISIBLE = true`, so the menu word, its submenu and the shortcuts are always on.

## The change

1. **The gate reads a persisted unlock.** `cheatsEnabled()` returns a module flag seeded from
   `profile.cheatsUnlocked` at load (`setCheatsUnlocked`), not a compile-time constant. The profile
   gains `cheatsUnlocked: boolean`, defaulting to **false**; saves without the field load as false
   rather than being rejected.
2. **The sequence.** `ArrowUp, ArrowUp, ArrowDown, ArrowDown, ArrowLeft, ArrowRight, ArrowLeft,
   ArrowRight, B, A` — the real one, `b` and `a` case-insensitive. A rolling cursor on the handler
   (not a buffer of history); any wrong key resets to 0, except that `ArrowUp` resets to 1 (the
   sequence starts with it, so a double Up must still work).
3. **Where it counts.** The handler runs from the existing keydown listener on every screen: menu,
   gallery, run, editor, dialogs. It is ignored while a text field has focus (the save-name box, any
   seed input) so typing never eats the player's keystrokes, and it does nothing once unlocked.
4. **On unlock.** `profile.cheatsUnlocked = true`, save the profile, `setCheatsUnlocked(true)`, and
   the menu bar redraws with Cheats in it on the next frame. The toolbar word appears between View and
   Help, as it does today.
5. **Feedback.** The status bar shows the existing `menu.cheats` string for two seconds when it
   unlocks — no new i18n keys, no toast, no dialog. The menu appearing is the real confirmation.
6. **Everything else follows the gate.** The submenu, the spawn list and any cheat shortcut keys are
   already behind `cheatsEnabled()`; assert that they stay behind it, so a hidden Cheats menu cannot
   be opened by its hotkey either.

## Menu geometry

`MENU_WORDS` already inserts Cheats conditionally, so hiding it shifts Help left and every hit test
follows the array — no separate rect table to fix. Assert: with the gate closed the menu bar has
three words and clicking where Cheats would be hits nothing; with it open there are four.

## Tests

- The sequence unlocks; the same keys with one wrong in the middle do not.
- `ArrowUp, ArrowUp, ArrowUp, ArrowDown, ...` still unlocks (the restart-on-Up rule).
- Unlocking is once-only and persists through a profile save/load round trip.
- A save written before this change loads with `cheatsUnlocked === false`.
- With the gate closed, `cheatsEnabled()` is false, the menu bar has three words, and the cheats
  keyboard shortcut does nothing.
- Typing the sequence inside the save-name box does not unlock.

## Out of scope

The cheat effects themselves, the spawn list, and any public-facing discovery hint.
