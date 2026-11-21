# No tracer for a Cannon shot

Status: spec, not built. Owner: Guppy. Written 2026-11-21 against `main` at `c835910`.

`Effects.addShot` pushes two things for every tower shot: a muzzle flash and a tracer line from the
muzzle to the target's position at fire time (`src/view/effects.ts:181-202`). The Cannon now fires a
real shell that leads its target and lands a flight later, so the tracer is both redundant and wrong —
it draws a line to where the enemy *was*, while the shell flies to where it will be.

## 1. The change

- In `addShot`, a Cannon still gets its muzzle flash and its sound, and gets **no tracer**. The shell
  is the shot.
- Nothing else changes: every other tower keeps its tracer, the tracer pool and its compaction stay,
  and `drainEvents` is untouched.

## 2. What this does not change

- The sim: no event, no timing, no damage. This is one view call skipped.
- The AA Flak also fires a shell and also gets a tracer today. It is the same argument, but it is not
  in this change — Sydney asked about the Cannon. If the Flak tracer is also unwanted, it is a
  one-line follow-up and should be asked for rather than assumed.

## 3. Tests

- A Cannon shot adds a muzzle and no tracer; a Gun shot adds both; a Beacon adds neither.
- The tracer pool never exceeds its cap and still compacts to empty.
- No change to any run's outcome — the smoke suite's run checks must pass unchanged.

## 4. Out of scope

Tracer colours, muzzle art, shell visuals, and the Flak.
