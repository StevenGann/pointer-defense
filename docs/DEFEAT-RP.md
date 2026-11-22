# Losing a run banks its Restore Points

Status: spec, not built. Owner: Guppy. Written 2026-11-22 against `main` at `73a3998`.

Today a defeat records the run in history (`recordRun(state, 'defeat')`) and banks nothing. The only
way to turn a lost run's salvage into Restore Points is Restart Windows, which also throws the run
away and starts a new one. Losing should pay out on its own.

## The rule

When a run transitions to `phase === 'halted'` (defeat — a victory still pays nothing, as today):

- Grant exactly what Restart Windows grants: `rp += gained`, `rpEarned += gained`,
  `lastSalvage = economy.earned`, `bestWave = max(bestWave, wave)`, and the `reboot-50` achievement
  check. Not the reboot counter, not a new run.
- **Cheated runs grant nothing**, unchanged (`cheatsUsed`).
- **Once per run.** The run carries a `defeatCredited` flag; a second transition, a reload of the same
  lost state, or the player pressing Restart Windows afterwards must not pay twice.
- Dailies keep their own path (`recordDaily`); a daily defeat does not touch the normal profile.

Restart Windows keeps working as it does now, minus the double credit.

## What the player sees

The defeat dialog says how much was banked — `dlg.restart.earned` already carries the count for
Restart Windows, so reuse it rather than adding a string. If the run was cheated, the dialog shows
the existing "records nothing" wording.

## Tests

- A defeat with 0.7 points banked adds 57 (or whatever the formula yields) exactly once.
- Calling the payout twice for the same run adds nothing the second time.
- A cheated defeat adds nothing and does not move `lastSalvage`.
- A victory adds nothing.
- Restart Windows after a defeated run does not grant the points a second time.
- The dialog's reported number equals `profile.rp - rpBefore`.

## Out of scope

The victory path, the run-history record format, and the Restore Point formula itself.
