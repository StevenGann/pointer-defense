# Mortar recoil

Status: spec, not built. Owner: Guppy. Written 2026-11-21 against `main` at `ac2b113`.

A Cannon that has taken the Mortar branch (`cannon` + branch `A`) should kick when it fires. The
turret shakes on its own — not the camera, not the board, not the enemy hit reaction.

## 1. What moves

Only the **turret sprite**. The plinth, the branch mark, the health bar and the finished-upgrade pip
stay where they are, so the tower reads as a barrel rocking in a fixed mount rather than the tower
jumping.

## 2. The motion

A pure function in the view layer:

```
recoilOffset(fireTick, clock, cell) -> { dx, dy }
```

- Duration **10 ticks** (about 160 ms), then exactly `0, 0`.
- Envelope **linear decay** from 1 at the firing tick to 0 at the last tick.
- Peak displacement **0.035 × cell** (about 1.5 px at a 44 px cell) — a rattle, not a lurch.
- Direction alternates each tick on both axes with two incommensurate periods, so it reads as a
  shake and not as a slow wobble: `dx = A · d · sin(2.4k)`, `dy = A · d · 0.6 · cos(3.1k)`, where
  `A = 0.035 · cell`, `d` is the envelope and `k` is the age in ticks.
- No rng. The same shot at the same tick always produces the same offsets, so a replay is identical.

## 3. Where the firing tick comes from

`drainEvents` already resolves the tower for every `shot` event (`src/main.ts:2046`). When
`tower.kind === 'cannon' && tower.branch === 'A'` it calls `board.noteRecoil(tower.id, state.tick)`.

`BoardView` keeps a `Map<number, number>` of tower id → last firing tick, pruned of towers that no
longer exist and of entries older than the recoil duration. Nothing is added to the simulation, no
event shape changes, no save field is written: recoil is not part of a run.

## 4. Interaction with the rest

- **The camera does not move.** `shakeImpulseFor` is untouched; a Cannon shot never adds an impulse.
- **Quality:** drawn at `full` and `balanced`; skipped at `lean`, where per-tower decoration already
  drops. The governor stays presentation-only — the sim never reads it.
- **Selling mid-recoil** removes the tower and with it the map entry; the pooled sprite is cleared by
  the existing `clearTowerSprites` path.
- **A Cannon without Mortar, and the Minesweeper branch,** get nothing.

## 5. Tests

- `recoilOffset` returns `{0,0}` before the shot and from age 10 on.
- Peak magnitude at age 0 is `0.035 · cell` within a pixel, and the envelope never grows with age.
- Two calls with the same inputs are identical (determinism).
- A Mortar shot records a recoil tick; the same shot from a plain Cannon or a Minesweeper records
  none.
- No new `Math.random`, no new rng draws, and both regression hashes unchanged.
