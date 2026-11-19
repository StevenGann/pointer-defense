# The Repeater's fifth tier stops firing

The Help pass made every tower's numbers visible and turned up a live bug. The Gun's Repeater branch
carries `intervalMul: 0.5`, and `scaledMultiplier` re-applies a multiplier linearly by branch depth:

| Tier | strength | interval multiplier | fire interval | shots/s |
|---|---|---|---|---|
| 3 | 1.0 | 0.50 | 0.25 s | 4 |
| 4 | 1.5 | 0.25 | 0.125 s | 8 |
| 5 | 2.0 | **0.00** | 0 s | **never** |

`state.ts` skips any tower whose `fireInterval <= 0` ("beacon never fires"), so the $130 fifth tier
turns the tower off. Nothing showed it until the Help page printed `fire — · DPS —`.

## Fix

A multiplier below 1 has to decay geometrically; a linear interpolation through zero is what breaks.
For interval multipliers below 1, use `intervalMul ^ (tier - 2)`, which is exactly the ladder the
branch promises ("fires twice as fast") and leaves the existing tiers untouched:

| Tier | multiplier | fire interval | shots/s |
|---|---|---|---|
| 3 | 0.5 | 0.25 s | 4 |
| 4 | 0.25 | 0.125 s | 8 |
| 5 | 0.125 | 0.0625 s | 16 |

Multipliers at or above 1 keep the existing linear rule, so Cannon's Mortar (1.33) and AA's Flak
(0.9/0.55) behave exactly as they do now.

## Guards

- `effectiveStats` never returns a `fireInterval` of zero or less for a tower that deals damage.
- The Help formatter prints `never fires` rather than an em dash if it is ever handed a zero.

## Tests

1. A tier-3 and tier-4 Repeater keep today's intervals (0.25 s, 0.125 s) exactly.
2. A tier-5 Repeater fires every 0.0625 s, 16 shots a second, DPS 28.
3. Every kind, tier and branch combination yields `fireInterval > 0` for towers that deal damage.
4. The Gun's Help page prints the tier-5 line with a real rate and DPS.
5. Cannon Mortar and AA Flak intervals are unchanged from before the fix.
