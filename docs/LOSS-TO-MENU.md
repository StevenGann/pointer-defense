# Losing returns to the main menu

Status: spec, not built. Owner: Guppy. Written 2026-11-21 against `main` at `7d973a9`.

The Game Over dialog has one button, it reads **Restart**, and it calls `ctx.restart()`, which runs
`state = createRunState(profile)` — a fresh run on the default level. So losing the Trident puts you on
the Corridor, having never chosen it. The app already has the right exit: `exitRun()`
(`src/main.ts:1130`), which returns to the main menu (or to the editor for a Test run), refreshes the
menu's Continue state, and closes the run modals. It is safe from a loss: `maybeSaveRun` refuses to
save a halted run (`main.ts:656`), so no dead save is left behind.

## 1. The button

- The loss dialog keeps its single button and its geometry (`modalRect` 300x132, `restartRect` at the
  bottom centre). The label becomes **Main Menu** and the action becomes `exitRun()`.
- New string `hud.mainMenu`, in all seven catalogues:
  es `Menú principal`, fr `Menu principal`, ru `Главное меню`, uk `Головне меню`,
  zh-Hans `主菜单`, he `תפריט ראשי`. The six stay under their existing `draft: true`.
- `hud.restart` has no other caller and is deleted from all seven catalogues.

## 2. Names

`modalRestartAt` describes the old action and is renamed `modalMenuAt`; `hover.overRestart` becomes
`hover.overModalMenu`. The hit-test rect is unchanged, so the button that lights up is the button that
is drawn.

## 3. Escape

Escape on the loss screen does what the button does — returns to the main menu. It is the same exit,
not a second one, and it must not create a run either.

## 4. What does not change

- Victory keeps its two buttons: Endless, and Restart Windows. Losing is not a victory and does not
  gain an Endless option.
- The defeat is still recorded once, on the phase transition, before the dialog appears.
- No new run is created on the way out, and the map the player lost on is not silently swapped.

## 5. Tests

- Clicking the loss button leaves `screen` on the menu, with no new run created and the lost run's
  wave still recorded.
- The button's hit rect matches its drawn rect.
- Escape from the loss screen reaches the menu through the same path.
- From a Test run (origin `editor`) the same button returns to the editor, because `exitRun()` already
  does that and the button must not bypass it.
- `fit:` for `hud.mainMenu` in every locale inside the 96 px button.
- No catalogue still carries `hud.restart`.

## 6. Out of scope

The victory modal's Restart Windows behaviour, the menu layout, and the run-record rules.
