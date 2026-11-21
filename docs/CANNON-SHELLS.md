# Cannon shells

Status: spec, not built. Owner: Guppy. Written 2026-11-21 against `main` at `4bf096f`.

The Cannon is the last tower that deals damage with nothing on screen: it picks a target, calls
`fireSplash` at fire time, and a burst of damage simply appears. The AA's Flak branch already does the
honest version — a shell leaves the muzzle, leads the target, flies, and bursts where it lands
(`fireFlakShell` / `burstShell`, `src/core/state.ts:3802-3912`). The Cannon should use the same
machinery rather than a second one.

This is a real projectile, not a cosmetic trail: damage lands when the shell lands. A shell that
applies damage instantly and then animates would show enemies dying before the shot arrives.

## 1. Firing

- `CANNON_SHELL_SPEED = 14` tiles per second, added to `src/core/projectiles.ts` beside `SHELL_SPEED`.
  At the Cannon's 3.0-tile range the flight is about 0.21 s (13 ticks); at the Mortar's longer range
  it is proportionally longer, which is the point of a slow, heavy gun.
- `fireCannonShell` mirrors `fireFlakShell`: start at the tower centre, compute `flightTicks` from the
  distance, lead the target by its velocity over that flight, and push a `shell` projectile carrying
  the Cannon's damage and the firing tower's id.
- The lead needs the ground enemy's velocity too, so `flyerVelocity` is renamed `enemyVelocity` and
  used by both — an enemy's `heading` is already set from its direction of motion for ground and air
  alike (`state.ts:2600`). No new state, no rng.

## 2. Landing

- `burstShell` branches on the firing tower's kind:
  - **AA** keeps today's behaviour exactly: half damage to ground, `TARGETS_FLYERS_ONLY` flavour,
    `telemetrySplash` on the nearest impacted enemy.
  - **Cannon** calls the splash resolver at the shell's landing point instead: full damage,
    the Cannon's splash radius, `maxSplashKills`, and the Shatter check.
- `fireSplash` is split so the damage code can be called with a point rather than an enemy:
  `fireSplashAt(s, tower, st, cx, cy, dmg)`, with `fireSplash` calling it with the target's position.
  The Cannon stops calling either at fire time.
- **Shatter** is therefore evaluated at impact, not at fire: a shell that leaves while the target is
  fast and lands after a Frost has chilled it does burst again. That is the correct reading of "hits a
  slowed enemy" and it moves the burst trigger by one flight.
- A Cannon sold while its shell is in the air fizzles the shell with no damage, matching the Shatter
  burst's existing rule.
- Splash still uses the landing point, not the target's current position — a shell that lands behind a
  runner is a miss, which is what makes the projectile real.

## 3. Drawing

- Shells already have a sprite and a draw path (`src/view/board.ts:1795-1810`). A Cannon shell is drawn
  **larger** — 0.22 of a cell against the Flak's 0.16 — chosen by looking up the firing tower by
  `p.towerId` and reading its kind. No new art, no new asset names.

## 4. Determinism and balance

- Everything derives from state: positions, the target's heading, the tick. No `Math.random`, no extra
  rng draws.
- Damage now lands a flight later, so enemy positions at the impact tick differ from the hitscan
  build. The non-flyer regression hash and the no-route wave hash must be re-baselined and the new
  values committed with a comment saying why.
- Balance acceptance: within **1 %** of the hitscan build against a static target and within **3 %**
  against a moving one, measured over a fixed scenario. If it is worse, raise the speed rather than
  shrink the lead.

## 5. Tests

- A shell spawns at the muzzle with the expected lifetime, and the target takes no damage on the fire
  tick.
- Damage lands on the tick the shell's lifetime reaches zero, at the landing point.
- The lead is right: a target running at a known speed takes the hit rather than the shell landing
  behind it.
- Shatter triggers from the slow state at impact, and does not trigger when the target was only slowed
  after the shell had already landed.
- A Cannon sold mid-flight does no damage.
- A mid-flight shell survives save and restore (the runsave kind list already carries `shell`).
- The Flak branch's numbers are byte-identical to before this change.

## 6. Out of scope

No new tower, no new art, no change to the Laser, Taser, Frost, or AA Flak paths, and no change to
fire intervals, damage numbers, or splash radii.
