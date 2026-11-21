# Cursors go home at the start of a wave

Status: spec, not built. Owner: Guppy. Written 2026-11-21 against `main` at `c17e175`.

`wanderCursor` refuses a step that `cursorStepOk` rejects — it flips the angle and leaves the cursor
where it is. Next tick it draws a new angle from its own seeded stream and tries again. In the corner
of a map the arrows can be refused over and over, so a Cursor tower's pointer sits pinned against a
wall for the rest of the run, drifting in place and never coming back into its radius.

## The rule

At the start of every wave — automatic or called early — every Cursor tower's pointer returns to its
own tile centre:

```
for each tower of kind 'cursor':  tower.cursorX, cursorY = cursorHome(tower)
```

- Insertion point is `startWave` in `src/core/state.ts`, after `recomputeAuras` and before the
  `waveStarted` event, so the first frame of the wave already shows the pointer home.
- **No rng draw.** The reset is a position write; `cursorWanderSeed` and `cursorWanderAngle` are left
  untouched, so the throw count of the run's rng stream does not move.
- **No new state, no save field.** `cursorX`/`cursorY` already persist; a save taken mid-wave simply
  restores wherever the pointer was and the next wave start brings it home.
- The cursor keeps whatever it was doing: no target is cleared, no cooldown is reset. A Cursor that
  was mid-repair still finishes it.

## Why this rather than making the wander smarter

Escaping a corner would need either a look-ahead search every tick (cost in the hot loop, and a new
place for the determinism argument to go wrong) or a random teleport (which the run's replay would
have to carry). Snapping home once per wave costs nothing, is deterministic, and matches what the
player sees: a new wave, the pointers reset to their posts.

## Tests

- After `startWave`, every cursor tower's pointer is exactly at its `cursorHome`.
- A cursor deliberately wedged against a wall — position written into a blocked tile — is home after
  the next `startWave` and moves again on the following ticks.
- The rng stream position after a fixed scenario is unchanged by the reset (no extra draws).
- Moving to the next wave with no Cursor towers changes nothing.
- If either regression hash moves, it is re-baselined with a note saying the cursor reset caused it;
  if neither fixture places a Cursor, both stay byte-identical and that is recorded too.

## Out of scope

The wander rules themselves, `cursorStepOk`, the Cursor's radius, clicking enemies, and repair.
