# The daily challenge

One seeded run per day, the same for everyone on that date, short enough to finish over coffee, and
recorded so the result means something.

## What a daily is

- **One attempt per local day.** The day is the player's own calendar date (`YYYY-MM-DD`), not UTC,
  so a daily turns over at local midnight wherever they are.
- **A fixed map and a fixed seed for that date.** The map is `LEVELS[hash(date) % LEVELS.length]`; the
  seed is `hash(date)` and becomes the run's `rng`. Two players on the same date face the same board,
  the same enemy lanes and the same crit rolls for the same inputs.
- **Thirty waves, not a hundred.** The run ends in victory at wave 30. `RunState` gains
  `waveLimit`, default `WAVE_COUNT`, and the daily sets 30; `isFinalWave`, `finishWavePhase`, the HUD
  wave label and the endless offer all read `waveLimit` instead of `WAVE_COUNT`. Endless is not
  offered at the end of a daily.
- **No cheats, no save, no map cycling.** The Cheats menu does nothing in a daily, `cycleLevel` and
  the map Next button are inert, and the run is never written to `pd.run.v1` — a daily is one
  sitting.
- Everything else is a normal run: the profile's specs and Restore tree apply, achievements fire,
  the pointer and towers work exactly as usual.

## Recording the result

The attempt is written to the run records the moment the run ends for any reason, including
abandoning it via Esc:

- `outcome: 'daily'`, with `dailyDate` and `dailySeed` carried on the record.
- The result is also mirrored to `profile.daily = { date, wave, clearedWaves, outcome, at }` so the
  menu can show it without scanning the history.

Once recorded, the menu's Daily button is disabled until the next date, and reads
`Daily done — wave 22`.

## The button

The main menu's buttons become **Continue** (when a save exists), **Play**, **Daily**, **Editor**,
**Records**, **Load code**. A daily that has not been played reads `Daily — 2026-11-20`; bound to
`D`.

In a daily run the HUD's wave label reads `Wave 12 / 30 · Daily`, and the status line on start says
`Daily — 2026-11-20`.

## Tests

1. The seed and map for a fixed date are stable and differ on the next date.
2. Two runs created for the same date produce identical enemy lanes and crit rolls for the same
   inputs (a hash over 600 ticks).
3. A daily's `waveLimit` is 30; clearing wave 30 ends in victory and does not offer endless.
4. A normal run still has `waveLimit === WAVE_COUNT` and behaves exactly as before.
5. Ending a daily — victory, defeat, or Esc — appends exactly one record with `outcome: 'daily'` and
   the date, and sets `profile.daily`.
6. A second attempt on the same date is refused and the button is disabled.
7. The next date re-enables the button with a new seed.
8. Cheats, map cycling and run saving are all inert in a daily.
9. The HUD label reads `Wave 12 / 30 · Daily`.
