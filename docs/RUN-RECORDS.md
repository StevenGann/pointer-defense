# A table of your runs

The profile remembers `bestWave` and nothing else: no record of what you played, on what map, or how
it ended. This adds a run history the player can look at, without a server.

## What is recorded

One record per finished run, written at the moment the run ends:

| Outcome | When |
|---|---|
| **Victory** | wave 100 cleared (phase reaches `victory`) |
| **Defeat** | integrity reaches zero (phase reaches `halted`) |
| **Reboot** | the player does Restart Windows |

Escaping to the menu is an abandonment, not a record: an abandoned run is overwritten by the next
Continue or Play, exactly as it is today.

A record carries: `id`, `at` (ISO date), `mapId`, `mapName`, `wave` (the highest wave reached),
`clearedWaves`, `integrity`, `pointerStage`, `salvage`, `durationTicks`, `outcome`, `victory`.

## Storage

`profile.runs`, newest first, capped at the most recent **50**. The profile schema version goes up by
one with a migration: an older profile loads with an empty list rather than failing. `bestWave` keeps
its existing meaning and stays the all-time high.

Derived views are computed, never stored: best wave per map, total runs, wins, defeats, reboots,
total play time.

## The screen

The main menu gains a **Records** button under Load code, and the View menu gains a **Records**
item that opens the same window from inside a run (as a viewer: it does not pause the run, like the
Help window).

The window is a plain Windows 95 dialog, 520 × 340 or so, with:

- A header line of totals: `Runs 37 · Wins 2 · Defeats 31 · Reboots 4 · Best wave 100`
- A scrollable table, newest first: `# | Wave | Map | Outcome | Date`. The top five rows are ranked
  by wave descending — a gold-ish highlight for rank 1 — and the rest stay in date order under a
  separator labelled `Earlier`.
- A footer line naming the best run per map: `Best by map — The Corridor 100, Dumbbell 61, …`
- Close box, and Esc closes it.

With no runs recorded the table shows one centred line: `No runs recorded yet.` and the totals line
reads `Runs 0`.

## Tests

1. A defeat, a victory and a Restart Windows each append exactly one record with the right outcome,
   map and wave.
2. Escaping to the menu appends nothing.
3. The list is newest first and never exceeds 50 (the 51st drops the oldest).
4. Per-map bests and the totals line are computed from the records, not stored.
5. A v1 profile with no `runs` migrates with an empty list and keeps every other field.
6. A profile with a corrupt `runs` entry drops that entry and keeps the rest.
7. The dialog fits at 1024 × 640 and 1280 × 720, the table clips its rows, and Esc closes it.
8. The empty state renders the placeholder line and `Runs 0`.
