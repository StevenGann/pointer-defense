# Frost becomes a radial pulse

Status: spec, not built. Owner: Guppy. Written 2026-11-21 against `main` at `68036be`.

Today the Frost picks one enemy in range and applies its slow to that enemy. It becomes an area
tower: on each of its fire intervals it pulses its whole radius and everything inside feels it.

## 1. Behaviour

- **No target selection.** The Frost fires when at least one living enemy is inside its radius, on
  its existing interval (`fireIntervalTicks` from `effectiveStats`).
- **Everything in radius** gets the same effect the single target gets today:
  - tier 1-2 and branch A: `applySlow(st.slowFactor, st.slowTicks)` — one pulse, so two Frosts
    never stack, exactly as now (`applySlow` already enforces the weaker-wins rule).
  - branch B: its `damageMul` damage lands on every enemy in radius, in place of the splash it has
    today.
- **The pulse never misses.** Enemies are tested against the tower's tile centre with the same
  `distance <= radius` rule the targeting already uses.
- **Fire event.** The existing `{ type: 'shot' }` event is still pushed for the tower so the sound
  and the muzzle flash fire; the view draws the pulse ring instead of a tracer
  (docs/LINE-TRACERS.md).

## 2. The visual

A ring expanding from the tower to its radius over 8 ticks, in the Frost's own blue (`0x3399cc`),
drawn in the effects layer under the enemy sprites, fading as it grows. Pooled and capped like every
other effect, and skipped entirely at `lean` quality.

## 3. Balance

This is a straight buff: one tower now slows a crowd instead of one enemy. Rather than bend the
numbers in the same change, it ships at today's slow strength and interval and the balance harness
reports the delta — kills, leaks and integrity per map, compared against the previous build. If a
Frost now trivialises a wave, the follow-up tunes `slowTicks` down; the balance numbers are recorded
in the commit note either way.

## 4. Tests

- With three enemies inside the radius, one pulse slows all three; with enemies outside, they are
  untouched.
- Two Frosts overlapping give the same slow as one (weaker-wins, unchanged).
- The pulse fires only when an enemy is in range, on the documented interval.
- Branch B damages every enemy in radius, not one plus a splash.
- The balance harness runs and its per-map numbers are recorded; regression hashes are re-baselined
  with a note, because a Frost in a fixture genuinely changes the run.

## 5. Out of scope

Frost art, tier costs, the Chill synergy, and every other tower.
