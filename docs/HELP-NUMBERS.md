# Help: the numbers

The Help pages read as prose. A tower page says "range 2.6 tiles · damage 3 · every 0.5 s" for the
base tier and then describes its branches in words ("fires twice as fast"). Nobody can plan a run
from that. Testers want the arithmetic.

## Rule

Every number on a Help page is **derived from the same functions the simulation uses**, at the moment
the page is asked for. No table of literals in the help content. If a balance number moves,
`TOWER_STATS`, a branch effect or a tier table moves and the page follows it; a test recomputes every
line and fails when the two disagree.

## Tower pages

Each tower page gains a stat block above the existing prose:

```
Cost $25 · unlocks wave 1
Range 2.60 · Damage 3.00 · Fire 0.50 s (2.00/s) · Turn 720 °/s
Splash — · Piercing — · Armour ignored: no
DPS 6.00 vs one target
Tier 2 — $40: range 2.65 · damage 3.75 · DPS 7.50
Marksman — $120
  Tier 3: range 4.16 · damage 6.75 · DPS 13.50
  Tier 4 — $X: range 4.68 · damage 8.10 · DPS 16.20
  Tier 5 — $Y: range 5.21 · damage 9.45 · DPS 18.90
Repeater — $120
  Tier 3: damage 2.75 · fire 0.25 s (4.00/s) · DPS 11.00
  ...
```

- Values come from `effectiveStats` on a synthetic tower at that tier and branch, and from
  `upgradeCost` for the prices.
- Damage, range and DPS to two decimals. Fire interval in seconds to two decimals with the
  shots-per-second rate beside it. Turn rate as a whole number of degrees per second.
- A stat that does not apply prints an em dash rather than a zero.
- Mechanics that live outside `effectiveStats` still get their numbers, read from the constants that
  drive them: the Mine Layer's drop interval, arming time, live-mine cap and blast, the Missile
  Battery's salvo size and per-missile damage, the chain count and falloff, the beam count and
  per-beam damage, slow strength and duration, aura percentages and radii, wall hit points by tier,
  the Repair tower's heal rate and radius by tier, the Cursor's click rate, radius and click-damage
  fraction, AA's 2x on flyers, and the Gun's 0.1x.
- The existing role prose and branch names stay below the block, unchanged.

## Scrolling

A page with a stat block is taller than the page panel. The page panel gains a vertical scrollbar:

- mouse wheel scrolls the page under the pointer, three lines a notch
- Page Up / Page Down scroll a window at a time while the help window has focus
- the thumb is proportional, sits in a sunken track on the panel's right edge, and is hidden when
  the page fits
- scrolling clamps to the first line and to the last line plus the panel's height
- page text is clipped to the panel, so it never draws over the toolbar or the status bar

## Other pages where a number is missing

Add the number where the page already describes a scaling mechanic and the value exists in code: the
pointer's click damage per level, the crit/mark/weak percentages, the overclock ceiling, the SPECS
percentages and cost formula, the Restore-point payout formula, and the early-call bonus. Leave prose
that has no number behind it alone.

## Tests

1. For every tower kind, the generated block equals a recomputation from `TOWER_STATS`,
   `effectiveStats` and `upgradeCost` — same strings, character for character.
2. Tier and branch lines match `effectiveStats` on a synthetic tower at that tier and branch.
3. A page longer than the panel reports a positive scroll range; a short page reports zero and draws
   no scrollbar; scrolling past either end clamps.
4. The help window still fits at 1280x720 and 1600x900.
