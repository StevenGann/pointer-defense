# Tower Synergies, batch 2

Status: spec, not built. Owner: Guppy. Written 2026-11-21. Follows `docs/SYNERGIES.md` (mechanism,
vocabulary, adjacency, determinism) and `docs/PRESTIGE.md` for the queue conventions.

Four new pairs. Two are one-way gifts in the shape of `spotter` — a tower lends something to a
neighbour. Two are peer rules that change what a pair does to the board. None of them is a damage
multiplier, and none needs new art: the marks below are drawn with `Graphics`, like the halo fallback.

## 0. The catalogue rows

| Id | Pair | Name | Shape | Colour | Leads |
|---|---|---|---|---|---|
| `chill` | Frost → AA | Chill | gift link | `0x8fd8ff` | the Frost |
| `interlock` | Laser → Taser | Interlock | gift link | `0xc77dff` | the Laser |
| `shatter` | Cannon ↔ Frost | Shatter | peer link | `0x4dd6c1` | Cannon (interval tie-break) |
| `buttress` | Bulwark wall ↔ Bulwark wall | Buttress | peer link | `0x9aa7c7` | Northmost, then westmost |

Each row gains one field the current table does not have: `mark`. It is one of
`'snow' | 'bolt' | 'crack' | 'brace'`, drawn at the midpoint of the link with `Graphics` — three
crossed strokes, a zigzag, two angled strokes, and a double chevron. Colour alone cannot carry four
more rows (the deuteranopia rule from `SYNERGIES.md` §4), and a mark is cheaper than four new SVGs.

A gift link always points from the giver to the receiver and uses the chevroned art already used by
`spotter`. A peer link points nowhere and uses the plain link.

## 1. Chill — Frost → AA

A Frost lends its chill to an adjacent AA. Damage dealt by that AA to a flyer applies a slow of
**factor 0.6 for 60 ticks (1.0 s)**.

- The giver is any Frost, any tier, either branch. The numbers are fixed rather than taken from the
  Frost's stats: Shard (Frost B) has no slow at all, and a synergy that silently switches itself off
  because of a branch choice on a different tower is a trap rather than a decision.
- It lands on every AA damage event against a flyer — autocannon hit, flak splash, and each missile,
  because all three are the AA's damage.
- Two adjacent Frosts do not stack and do not sum: the strongest factor wins and the later expiry
  wins, which is exactly what the existing `applySlow` already does. Call it; do not reimplement it.
- Ground enemies are untouched. The AA cannot hit them anyway, and slowing through a wall of flyers
  would make the pair a general-purpose slow.

Why build it: flyers are the reason to buy an AA at all, and a flyer held in a 3.4-tile envelope for
an extra second takes noticeably more shots. The cost is a Frost placed where it does nothing for the
ground route, so the pair is a placement decision, not free power.

## 2. Interlock — Laser → Taser

A Taser may acquire the target an adjacent Laser is currently firing at, even when that target is
outside the Taser's own 1.6 tiles, provided it is inside the Laser's 3.4.

- The Laser gives **targeting**, not range and not damage: the Taser's interval, damage, armour
  piercing and chain rule are untouched, and the borrowed target is still resolved through the normal
  firing path so the shot can miss a moving target like any other.
- Acquired only while the Laser has a live target in its own range. When the Laser loses the target,
  the Taser loses it on its next shot and falls back to its own nearest-target rule.
- Two adjacent Lasers: take the first in the deterministic neighbour order (north, south, east, west)
  that has a live target, so the same layout always resolves the same way.
- The Taser's chain (Taser A) still starts from that enemy and still uses its own chain range.

Why build it: the Laser targets *first* (deepest along the route) and the Taser targets *closest*, so
the two point in opposite directions. Interlocking them lets a cheap, armour-piercing tower finish what
the long-range one started, which is the one combination that answers an armoured column cheaply.

Balance note for the implementer: this is the strongest of the four. Land it as written, then prove in
the smoke harness that a Taser with no adjacent Laser behaves byte-identically to before, so the only
change is the new acquisition path.

## 3. Shatter — Cannon ↔ Frost

A Cannon shell that damages an enemy which is **slowed at the moment of impact** leaves a second,
smaller burst at the impact point **24 ticks (0.4 s) later**: splash 0.6 tiles, damage 40% of the
shell's damage, no pierce, no armour change.

- "Slowed" means `s.tick < enemy.slowUntilTick` at impact, whatever applied it — Frost, Chill, a
  global slow, or the timezone ad. The synergy is between the two towers' *placement*; the trigger is
  the enemy's state.
- The second burst cannot trigger Shatter again. One shell, at most one extra burst.
- The burst is a scheduled effect on the run state, resolved in tick order, so it is deterministic and
  replay-safe. It is **not** serialized: a mid-run save taken inside the 24-tick window drops the
  pending burst. Accepted — it is under half a second and cannot change a wave's outcome.

Why build it: the Cannon already waits 1.6 s between shells and a Frost already holds targets still.
Shatter makes the Frost an amplifier for the shot instead of just a delay, and the double burst is
visible, so the pair reads without a tooltip.

## 4. Buttress — Bulwark wall ↔ Bulwark wall

Two orthogonally adjacent walls **both at tier 3, branch A (Bulwark)** share incoming damage: a hit on
either wall is split evenly across the connected Buttressed group, up to **four** walls. Hit points
stay per-wall; the split is what makes a group fall together.

- Group = connected component over orthogonal adjacency among Bulwark tier-3 walls, capped at four.
  Membership order is deterministic: the hit wall first, then the rest sorted by row, then column.
- The split is integer-safe: `floor(damage / n)` per wall, and the remainder goes to the hit wall.
- When a member is destroyed the survivors take the shares of the dead for the rest of that hit; a
  wall alone in its component takes the whole hit.
- Non-Bulwark walls are never members, so Mesh and Toggle walls keep the old behaviour exactly. This
  is the requirement that makes the synergy a build: four tiles of Bulwark at tier 3 is 540 → 1080 HP
  per wall, and the pair above it is what stops a breacher tunnelling one of them.

Why build it: breachers have 12 wall DPS and pick one block. Today the answer is more wall; Buttress
makes the answer *thicker wall in the right shape*, and it rewards two-by-two blocks over long thin
lines, which is a different board than the one players build now.

## 5. What the view draws

- `chill` and `interlock` draw a gift link from giver to receiver, chevroned, plus the row's mark at
  the midpoint.
- `shatter` and `buttress` draw a peer link and their mark, with no halo: a halo reads "these towers
  are the same club", and both pairs are two different towers doing one thing.
- Marks are drawn only when the pair is on screen and the View → Synergy lines toggle is on. No new
  allocation per frame: reuse the existing per-edge loop and the same `Graphics` object.

## 6. Localization

Eight keys per catalogue: `synergy.chill.name` / `.description`, and the same for `interlock`,
`shatter` and `buttress`, in all seven locales, non-English behind `draft: true`. The description says
what the pair does in one sentence and never names a number that the code could change.

## 7. Tests

One smoke group per synergy, plus a shared group for the catalogue:

- **Catalogue:** four rows present; every row has a colour, a shape, a mark and a lead rule; no two
  rows share a colour; the four marks are distinct.
- **Chill:** an AA with an adjacent Frost applies a slow on hit; without one it does not; two Frosts do
  not produce a stronger slow than one; ground damage never applies it.
- **Interlock:** a Taser with an adjacent Laser fires at a target 2.5 tiles away; the same Taser
  without the Laser does not; the borrowed target leaves when the Laser retargets; a Taser with no
  adjacent Laser produces byte-identical events to the pre-change baseline over 600 ticks.
- **Shatter:** a shell into a slowed enemy schedules exactly one burst 24 ticks later with 40% damage
  and 0.6 splash; a shell into an unslowed enemy schedules none; a burst never schedules another.
- **Buttress:** a hit on one of two Bulwark walls splits evenly and the remainder is deterministic; a
  group of five splits across four; a Mesh wall beside a Bulwark wall is not split; a lone Bulwark wall
  takes the full hit; a dead member redistributes within the same hit.
- **Determinism:** a seeded run with all four pairs on the board replays to the same hash twice.

## 8. Out of scope

New art files, new towers, a synergy that requires three towers, diagonal adjacency, and anything that
changes the AA's damage. If a synergy needs a stat to make it work, it is the wrong synergy.
