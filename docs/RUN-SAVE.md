# Saving a run in progress

The profile has always persisted; the run never has. Reload on wave 40 and the wave, the towers, the
salvage and the pointer upgrades are gone. This closes that gap.

## What is saved, and what is rebuilt

Save only what the simulation treats as authoritative. Everything derived comes back from the code
that already derives it, so there is never a second answer to "what does this board look like".

**Saved** (per `RunState`): `levelId`, `level` (the whole `Level`, including custom maps from the
codec and editor), `toggles`, `routes`, `routeCursor`, `phase`, `wave`, `clearedWaves`, `integrity`,
`economy`, `pointer`, `towers[]`, `enemies[]`, `projectiles[]`, `mines[]`, `runs[]`, `waveTick`,
`clock`, `tick`, `nextId`, `modifiers`, `endless`, `rng`, `towerDisabled` (as `[id, ticks]` pairs),
`towerDamageBuffTicks`, `enemySlowTicks`, `ad`, `nextAdAttemptTick`, and the run counters the
achievements read (`salvageSpent`, `upgradesBought`, `idleTicks`, `kills` and friends).

**Rebuilt on load**: `grid`, `blocked`, and the four distance fields plus `routeFields`, by calling
the existing `rebuildField(s)` after the towers are in place; auras via `recomputeAuras`. These are
never written to disk — a save that carries them is a save that can disagree with itself.

**Deliberately not saved**: `events` (drained each frame and meaningless across a reload),
`selected` / `selectedTowerId` (a UI choice; the run resumes with nothing armed and nothing
inspected), and `accumulator` (starts at zero, so a reload cannot fast-forward).

## Format and storage

A plain JSON object with `v: 1` and the fields above, in `localStorage` under `pd.run.v1`. Sizes are
small — a wave-90 board is tens of kilobytes — so no IndexedDB.

Writes are throttled to at most one every two seconds of run time, plus an immediate write on: wave
start, wave clear, any build action (place, upgrade, branch, sell), pause, Esc to the menu, and
`pagehide` / `visibilitychange` to hidden. Pausing writes once and then stops; an idle menu writes
nothing.

## Boot, menu, and the end of a run

- With a valid save, the main menu's primary button is **Continue** — `Wave 34 — The Corridor` — bound
  to `Enter`, ahead of Play.
- **Play** starts a fresh run. If a save exists it asks once: *"Start over? The saved run at wave 34
  will be lost."* with No as the default button.
- The save is **kept** while a run is in progress and updated as it goes; it is **deleted** on
  victory, on integrity reaching zero, and on Restart Windows.
- The editor's Test run is not saved: it is a preview, not a run.
- `?nosave` in the URL disables all saving, for the tests and for anyone debugging.

## Refusing a bad save

`loadRunSave()` returns `null` and deletes the key when the JSON does not parse, the version is not
`1`, the level fails `validateLevel`, `phase` is not one of build/wave/halted/victory, integrity is
outside 1..20, the wave is outside 1..100 (endless may exceed 100), a tower sits out of bounds or on
another tower, an enemy kind is unknown, `nextId` is not above every id in use, or the counts are
absurd (towers > 240, enemies > 400, projectiles > 400, mines > 200). A refusal is silent in the
menu and shows one status line if the player tried to continue explicitly: *"That run could not be
restored."* The game must never fail to boot because of a save.

## Determinism

The run is seeded and must stay byte-identical across a save. `rng` is restored verbatim, and the
resumed run continues on the same tick boundary it was saved at.

## Tests

1. **Round trip**: a rich run (mid-wave, towers on branches, a disabled tower, mines, projectiles,
   an active ad, modifiers, several waves of history) captures, serialises, restores, and the
   restored state deep-equals the original on every saved field, with identical distance fields.
2. **Determinism**: run 900 ticks, save, then continue the original for 600 more ticks and hash the
   event stream (A); restore from the save, run 600 ticks, hash (B). A === B, and the same for the
   RNG value at the end.
3. **Rebuild, not restore**: after loading, `blocked` and all five fields equal what `rebuildField`
   computes for the restored towers — a hand-edited save that lies about `blocked` is simply ignored.
4. **Refusals**: truncated JSON, `v: 2`, a level with no route, integrity 0, an unknown enemy kind,
   and a tower on another tower each return `null` and delete the key, and the game still boots.
5. **No double counting**: loading mid-wave grants no salvage, fires no wave-start effects and
   re-grants no achievements.
6. **Lifecycle**: victory, integrity zero and Restart Windows each clear the key; a Test run never
   writes one; `?nosave` writes nothing.
7. **Menu**: with a save, Continue is primary and Enter resumes at the saved wave on the saved map;
   Play asks once and only then discards.
