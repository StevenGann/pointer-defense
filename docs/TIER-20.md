# Twenty tiers

Every combat tower currently stops at tier 5. Raise the ceiling to 20, with prices that grow
geometrically so the top of the ladder is a long-term sink rather than a mid-run power spike.

## Scope

- **Combat kinds go to 20**: gun, cannon, taser, frost, laser, aa, beacon.
- **Walls, Repair and Cursor keep their current caps.** They are not on the standard ladder: a wall
  branches once at tier 3 and is then finished, Repair is a three-tier support tower, and the Cursor
  is the pointer, priced by hand. Extending them means inventing mechanics, not extending a ladder.
  Say so in `docs/design.md` rather than leaving it implied.

`MAX_TIER = 20` lives in `src/core/towers.ts`, and the `Tier` type plus `TIERS` derive from it. The
ceiling must be one constant: the user's "up to T20 for now" means it should move in one place.

## Power ladder

Damage per tier, as a multiplier on the kind's base damage:

| Tier | 1 | 2 | 3 … 20 |
|---|---|---|---|
| Damage | 1.0 | 1.25 | each tier ×1.09 on the one before |

Tier 20 is therefore `1.25 × 1.09^18 = 5.90×` base damage. Range grows `+1 %` per tier from tier 6,
capped at `+10 %` (held from tier 15) and stacked on the existing tier-2 `+2 %`, so late towers do not
out-range the maps.

Tiers 1–5 keep exactly today's behaviour: tier 2 is ×1.25, and tiers 3–5 get their power from branch
depth, unchanged. A branched tower therefore joins the damage ladder at tier 6 (`1.09^(tier−5)`)
rather than tier 3, because its tiers 3–5 are already paid for in branch depth.

## Branch depth, capped

Branch strength today is `1 + 0.5 × (tier − 3)`, which at tier 20 would be 9.5 and would turn every
multiplicative branch into nonsense (and every interval branch into a negative or zero-length
interval). Cap it:

- `branchStrength(tier) = min(1 + 0.5 × (tier − 3), 4)` — reached at tier 9, held after.
- An `intervalMul < 1` branch keeps `intervalMul ^ min(tier − 2, 4)`: the "fires faster" ladder
  plateaus at four steps, and further tiers earn their power through the damage ladder.
- Backstops, because a negative or zero stat is a broken tower: `damage = max(1, damage)` and
  `fireInterval = max(1, fireInterval)` after all multipliers.

## Cost ladder

Tiers 1–4 keep their current prices (`0.9×`, `1.6×`, `2.9×`, `5.2×` of the kind's build cost) — the
early game does not change. From tier 5 the factor grows **1.18× per step**:

```
factor(1..4) = 0.9, 1.6, 2.9, 5.2
factor(t>=5) = 5.2 * 1.18^(t-4)
cost(tier)   = roundCost(baseCost * factor(tier))
```

`roundCost` rounds to a readable figure: nearest 5 under $100, nearest 10 under $1,000, nearest 50
above. Prices must be integers and strictly increasing.

What that buys, per kind, summing the rounded prices the game actually charges:

| Kind | Build | Tier 20 total | Final step |
|---|---|---|---|
| Gun | $25 | $9,566 | $1,550 |
| Laser | $70 | $26,902 | $4,350 |
| Taser | $80 | $30,808 | $5,000 |
| Cannon | $90 | $34,584 | $5,600 |

(An earlier draft of this table rounded once at the end; the figures above are the sum of the rounded
per-step prices, which is what a player pays. The smoke suite freezes these.)

A wave-100 run earns roughly $25,000 before kill bounties, so a maxed Gun is a deliberate long goal
and a maxed Cannon is endless-mode territory. That is the intent: the ladder is a sink, not a
shortcut. Update these figures in the doc if the curve moves.

## What the player sees

- The tower detail panel and the upgrade button show the tier out of the maximum (`T12` / `T12 of
  20`), and the upgrade button's price is the ladder's price.
- Mass upgrade (Ctrl+click) walks the same ladder and stops when the money or the cap runs out.
- The Help tower pages derive their tier lines from the same functions — no hardcoded "tier 5"
  anywhere in `src/content/help.ts`. The getting-started page says towers go to 20.
- Achievement "First of Five" still fires at tier 5; do not add new achievements in this change.

## Saves

`runsave.ts` validates a tower's tier against `TIERS`; with `TIERS` derived from `MAX_TIER`, a
mid-run save from a T12 tower round-trips. A profile or run save containing a tier above 20 is
rejected exactly as an invalid tier is today — no save version bump is needed, because the stored
shape has not changed.

## The balance harness

`scripts/balance.mjs` upgrades greedily. Give it `--maxTier N` (default **5**) so its existing
comparisons stay comparable, and have it print the highest tier it reached per map. The harness is not a gate for this change: human testers are authoritative for balance, and the
harness is run only when Sydney asks. What matters here is the smoke suite's frozen tier 1–5
expectations, which prove the lower ladder did not move.

## Tests

1. The cost ladder is strictly increasing for every combat kind, and the tier-20 totals match the
   table above for Gun, Laser, Taser and Cannon.
2. `effectiveStats` at tiers 1–5 for every kind and branch equals the pre-change values (freeze the
   T5 damage and interval of Gun A, Gun B, Cannon A, Taser B, Laser A and AA A as literal
   expectations).
3. Tier 20 damage for a branchless kind is `1.25 × 1.09^18` of base, and range is capped at +10 %.
4. Branch strength is 4 at tier 9 and still 4 at tier 20; an interval branch's interval never drops
   below one tick, and damage is never below 1 at any tier or branch.
5. A tower saved at tier 12 restores at tier 12; tier 21 is rejected.
6. The 900-tick determinism hash over a scripted run that upgrades to tier 8 is stable across two
   runs of the same script.
