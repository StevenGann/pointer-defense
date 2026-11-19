# Pointer Defense — design

A tower defense game where clicking is the economy and towers are the time to click.

Status: 2026-11-16, v0.2 in development. This is the specification the code is written against. Where
the code and this document disagree, the code is wrong unless this document says otherwise.

---

## 1. The pitch

The board is a maze you build. The towers branch into specialists. Your cursor is an economy: kills
you land pay more, and every so often the desktop offers something worth dropping everything for.
When it ends you reboot the machine, and the next run is faster because the specs are better.

## 2. Pillars

| # | Pillar | What it forbids |
|---|---|---|
| 1 | **Clicks earn, towers buy time** | either half becoming optional |
| 2 | **The path is the puzzle** | fixed lanes; towers that only deal damage |
| 3 | **Every tower is a choice, not a purchase** | a strictly-best tower; upgrades that only enlarge |
| 4 | **The desktop is the world** | UI that could be HTML; a Win95 skin with no mechanics behind it |

## 3. The hybrid rule

Every kill pays salvage. A kill landed by the pointer pays **1.5×**; a kill on a marked weak point pays
**2×**.

That single rule ties the halves together. No clicking means slow kills, which means late upgrades. No
towers means no time to click, which means the wave reaches the exit. The player is not choosing
between building and clicking — they are allocating attention between earning and surviving, every
wave, for the whole run. Every balance decision in this document is downstream of that sentence.

## 4. Session shape

| Phase | Duration | What happens |
|---|---|---|
| Build | as long as the player likes | place, upgrade, sell; the wave never starts on its own |
| Wave | 30–90 s | enemies spawn, towers fire, the player clicks |
| Aftermath | 2 s | wave bonus paid, the status bar reports leaks and earnings |

A run to prestige is **45–90 minutes**. Waves 1–10 are a tutorial; a hundred is a run.

---

## 5. The board

### 5.1 Geometry

- **20 × 12 tiles**, integer cell size, board centred in its client column.
- **Spawn** on the left edge, **exit** on the right edge, both on row 6 (per map — see §5.5).
- **Blocked** tiles are desk objects and authored walls, impassable and never buildable.
- The board sits in a 2px sunken well inside the window's client area.

### 5.2 Mazing

Taken from *Desktop Tower Defense* (Paul Preece, March 2007), and it is the structural mechanic.

- Enemies take the **shortest walkable route** to the exit, recomputed whenever a tower is placed.
- A **tower blocks its tile**. Towers are damage and terrain at the same time.
- The route may never be sealed. A placement that would leave the exit unreachable is **refused**, and
  the refusal is explained where it happened: *"That would seal the route."*
- Selling is always legal and always re-paths.
- The HUD shows **route length in tiles**. Making the number visible is what teaches mazing: the
  player watches a placement turn 31 into 44 and understands the game without being told.

### 5.3 Pathfinding

A **cost field** from the exit, rebuilt on every placement: BFS over walkable unblocked tiles storing
distance-to-exit. Enemies read the field and step to the lowest neighbour, ties broken
up → left → right → down so the simulation stays deterministic. 240 tiles per rebuild; do it
synchronously.

Sealing is detected by flood fill from the spawn after a hypothetical placement. Also cheap.

### 5.4 Flyers

From wave 6, part of each wave flies **straight from spawn to exit**, ignoring the maze and the blocked
tiles. This is the answer to an over-mazed board and the reason mazing cannot be the whole strategy.
Flyers are purple chevrons with motion ticks, and the next-wave preview names them. The one exception
is a **Mesh** wall, which blocks flyers and forces them to detour around it.

### 5.5 Authored maps

The board is a small library of authored maps rather than one fixed lane. Before wave 1, with no
towers placed, the left panel shows `MAP <name>  [Next]`; clicking cycles the map, rebuilding the
grid, the path field and the route-length readout. The row disappears once the run starts. The level
id is carried in the run state and survives a restart only as the default.

| id | Name | Walls | Route (tiles) |
|---|---|---|---|
| `corridor` | The Corridor | four baffles forcing four switchbacks | 48 |
| `dumbbell` | Dumbbell | two 6-wide halls joined by a 2-tile neck | 28 |
| `open-field` | Open Field | the ten decorative desk-object tiles | 22 |
| `turnstile` | Turnstile | a two-wide direct lane with a shutter gate, and an upper hall above it | 20 (open) / 26 (closed) |

Legend: `#` wall, `.` buildable, `S` start, `X` exit.

```
The Corridor                      Dumbbell                          Open Field
....#.......#.......              ....................              ...........##.......
....#.......#.......              ....................              ..................#.
....#.......#.......              ..#####......#####..              ....................
....#...#...#...#...              ..#..............#..              ....................
....#...#...#...#...              ..#..............#..              ....................
....#...#...#...#...              ..#.....#..#.....#..              ....................
S...#...#...#...#..X              S.......#..#.......X              S..........##......X
...#...#...#...#...              ..#.....#..#.....#..              ....................
...#...#...#...#...              ..#..............#..              ....................
........#.......#...              ..#####......#####..              .##.................
........#.......#...              ....................              .#..................
........#.......#...              ....................              ......##............
```

The Corridor's baffles are column 4 rows 0-8, column 8 rows 3-11, column 12 rows 0-8 and column 16
rows 3-11. Dumbbell's walls are columns 2 and 17 rows 2-9, row 2 and row 9 columns 2-6 and 13-17, and
the neck walls at columns 8 and 11 rows 5-7. Open Field keeps the ten decorative tiles from the
original board. All four spawn at (0,6) and exit at (19,6).

Turnstile is the first map to author shutters (§5.6). Its direct lane runs two tiles wide along rows 5
and 6 and pinches to a single gate at the shutter; the upper hall is rows 0-3, bounded by the row-4
wall. The row-7 wall seals the drawer below the lane so the only long way is up through the hall. `A`
is the direct-lane gate (period 900, open 420, phase 0); `B` is the upper-hall gate (period 600, open
240, phase 300):

```
Turnstile
....................
.........B..........
....................
....................
.##################.
..........#.........
S.........A........X
####################
....................
....................
....................
....................
```

### 5.6 Map toggles (shutters)

A **map toggle** is a buildable tile that flips between open floor and closed wall on its own timer,
so the board itself becomes a moving field while the enemies stay the same creatures. It is a map
element, never a tower: it cannot be built over, sold, upgraded, or damaged. A breacher walks
through it (a shutter is not a wall to chew) and a flyer ignores it, exactly as the wall-breaking and
air fields already do.

Each toggle owns its period; two toggles on one map are expected to differ so their bars do not move
in lockstep.

#### Level format

`Level` gains an optional array:

```
toggles?: {
  col: number;
  row: number;
  periodTicks: number;   // full open/closed cycle, e.g. 900 = 15 s at 60 Hz
  openTicks: number;     // ticks of the cycle the shutter is open
  phaseTicks: number;    // offset so two toggles do not move in lockstep
}[]
```

A toggle is **open** while `(clock + phaseTicks) % periodTicks < openTicks`, closed otherwise. State
is a pure function of the clock: the same tick always yields the same state. At most **four** toggles
per level, so load and placement need check at most sixteen combinations.

Legend: `#` wall, `.` buildable, `S` start, `X` exit, `T` toggle tile.

```
....................    The shutter at (10,6) blocks the straight lane when
....................    closed, forcing a two-tile detour, and reopens on
....................    its own timer. Two shutters with different periods
....................    read as two different countdown-bar speeds.
....................
S.........T.........X
....................
....................
....................
....................
....................
....................
```

#### Safety rules

- **Placement** is refused if it would leave any start unable to reach an exit in *any* combination
  of toggle states, not just the current one. The refusal message names the shutter: *"That would
  seal the route when a shutter closes."*
- **Loading** rejects a level whose toggles can seal the route in any combination, with a named
  reason (`"toggle combination seals the route"`, `"too many toggles"`, and so on).
- A closed shutter is a blocked tile for ground pathing only. It never enters the breacher or flyer
  fields, so a breacher will not divert around a shutter that is about to close.
- When any toggle changes state the distance field is recomputed in that same tick and every enemy
  is re-pathed from the tile it occupies. Enemies never teleport; a ground enemy caught inside a
  tile that closes on it is pushed to the nearest open tile in the direction it was heading, never
  left inside a wall.
- A toggle's countdown bar fills as the next change approaches, and the shutter's colour shifts warm
  as it is about to close.

---


### 5.7 Multi-route levels

A level may author `routes: Route[]`, where a `Route` is a list of tiles from the shared spawn to the
shared exit. A level with no `routes` keeps exactly one implicit route, which is every level shipped
before this section — their behaviour is unchanged, including the wave hash.

Routes must be **tile-disjoint except at the spawn and the exit**. `validateLevel` rejects a level whose
routes share a corridor in the middle: two routes that overlap are one route with bookkeeping, and the
editor-shaped data that produces them is a mistake, not a design.

Each spawned enemy is assigned a route at spawn by a seeded alternating choice, and its pathing runs on
that route's own distance field. That is what keeps the routes independent in practice: a wall placed on
one route changes that route's field and the enemies walking it, and leaves the other route's enemies
untouched. Blocking a route outright follows the existing blocked-path rules rather than teleporting an
enemy to the other corridor.

The value is economic: two lanes cannot be covered by one tower line, so the same salvage has to be split.

Two maps ship with routes:

| Map | Shape | What it asks |
|---|---|---|
| **Fork** | one spawn, two equal corridors that rejoin only at the exit | cover two lanes at once, or lose the one you ignored |
| **Ladder** | two corridors joined by two cross-links | walling a cross-link changes which corridor is short, so the maze is a decision rather than a shape |

The map editor does not author routes yet. A level built in the editor falls back to a single route, and
that is stated rather than papered over.

## 6. Towers

Ten towers. Each has a role and a tier ladder; nine carry **two exclusive branches** at tier 3, and the
Repair tower keeps a plain upgrade ladder for now.

### 6.1 The ten

| Tower | Unlocks | Cost | Range | Damage | Interval | Turn rate | Targeting | Role | Wants |
|---|---|---|---|---|---|---|---|---|---|---|
| **Gun** | 1 | 25 | 2.6 | 3 | 0.50 s | 720°/s | player's choice | cheap single-target backbone | the longest stretch of route it can reach |
| **Cannon** | 4 | 90 | 3.0 | 5 + splash 1.0 | 1.60 s | 90°/s | strongest (fixed) | clusters and corners | where the maze doubles back |
| **Taser** | 14 | 80 | 1.6 | 1, ignores armour | 0.12 s | instant | closest (fixed) | armour, speed, close work | the inside of a hairpin |
| **Frost** | 6 | 70 | 2.2 | 1, slows to 30 % speed for 3.0 s | 0.60 s | instant | closest (fixed) | utility | in front of the damage |
| **Laser** | 11 | 70 | 3.4 | 11, pierces 8 | 0.80 s | 150°/s | first (fixed) | straight lines | corridors you deliberately left open |
| **AA** | 5 | 40 | 3.4 | 2.6, flyers only, 2× vs flyers | 0.55 s | 540°/s | player's choice | dedicated anti-air | flyer-heavy waves |

Only two towers can acquire a flyer at all: the **Gun** and the **AA**. Taser and Frost cannot target
one, and neither can the Laser, the Cannon or a Cursor — their shots simply never leave the ground.
A Gun's hit lands at **0.1×** its damage against a flyer (`FLYER_OFF_KIND_DAMAGE`), so its 3 damage
becomes 0.3: enough to finish a straggler that reaches the exit, nowhere near enough to answer a wave.
Air is the AA tower's job, and until AA is scattered across the map a flyer wave is a real threat
rather than something a gun line absorbs. The floor on armour damage is `min(1, dmg)`, not a flat 1,
so that reduction is not rounded back up to a full point.
| **Beacon** | 8 | 90 | 3.5 | none | — | — (still) | — | +60 % damage to towers in radius | a dense cluster worth buffing |
| **Repair** | 18 | 220 | 4.5 | none (heals 2 HP/s) | — | — (still) | — | heals damaged towers in radius | a cluster of towers worth keeping alive |
| **Wall** | 1 | 8 | — | none | — | — (still) | — | blocks the route, has hit points | a long maze made cheap |
| **Cursor** | 24 | 200 | 3.0 | ½ your click damage | 1.5 s | — (still) | shielded, then nearest (fixed) | an autonomous hand that clicks for you | a pointer ladder worth feeding |

Four towers are **locked** to one targeting mode and ignore the player's choice. The **Taser** always
fires at the nearest enemy in range — a Tesla coil discharges into whatever is nearest, so its
placement is the decision, not its priority. The **Frost** also always targets the closest enemy — it
slows the enemy nearest the exit, and a player-chosen mode on a utility tower only ever makes it
worse. The **Laser** always fires at the leading edge of the column, which reads correctly when its
Focus beam pierces along that line. The **Cannon** always swings at the strongest thing it can see and
lives with its two-second traverse. The **Cursor** carries its own fixed rule rather than one of the
three named modes: it hunts shielded enemies first, then the nearest enemy to its home tile (§6.7).
The **Gun** stays fully configurable — it obeys the player — and Beacon and Repair have no targeting
mode to lock. The Repair tower never fires at enemies at all.
**Manual Override** (§9.5), the player's explicit mark, wins over every lock: while the marked enemy
is in range, a locked tower fires at it, which is the only way to aim a locked tower at something
specific.

Four damage answers and four that are useless alone, plus the Cursor, which is a damage answer that
borrows its strength from the pointer ladder (§6.7). That is how placement stays interesting without
becoming opaque.

Every tower carries hit points, not just the Wall. The Wall is still the asymmetry because it is the
one that can be destroyed and then is gone for good: it carries 60 hit points at tier 1, 180 at tier 2
and 540 at tier 3; the Bulwark and Mesh branches double that, while the Toggle branch keeps the base
total and pays in control instead. A destroyed wall is removed, the route is recomputed in the same
tick, and nothing is refunded. The other towers keep a fixed pool (see the HP table below) that the
Breacher's turret can deplete; when it runs out the tower goes offline rather than leaving the board
(see §6.9).

A wall's face is art (`public/art/wall/`), not code: a tier plate plus overlays for the Bulwark rim,
the Mesh crosshatch, the repair hatch and damage. Damage is read in integer thirds of `hp / maxHp`
(the bottom third is heaviest), and the engine falls back to the old code-drawn button when the files
are missing.

#### Hit points

`maxHp` is set at placement and, for a wall, re-derived from its tier and branch when it changes. An
upgrade must never heal a tower: it raises the ceiling and leaves the **HP fraction** where it was, so
a tower at half health stays at half of the new maximum.

| Tower | max HP |
|---|---|
| Gun | 100 |
| Cannon | 140 |
| Taser | 120 |
| Laser | 120 |
| AA | 100 |
| Frost | 90 |
| Beacon | 80 |
| Repair | 90 |
| Cursor | 80 |
| Wall | 60 / 180 / 540 by tier |

A non-wall tower whose pool reaches 0 goes **offline** (see §6.9); a wall at 0 is destroyed instead.
Only the Wall changes ceiling with tier and branch — every other kind keeps its fixed pool for life,
so an upgrade never resets current HP.

**These are the harness's numbers, not the first draft's.** The first draft (Gun 4 damage at 25,
Cannon 10 at 60, Taser 2 at 45, Laser 6 at 120, Beacon +15 %) let a scripted player win with Gun and
Cannon alone — the other four were never bought, so they were untested at every wave. The tuned set
gives every kind a slot a player notices: Taser and Laser both beat Gun on damage per salvage, Cannon
pays for its cost in splash, and Frost plus Beacon are load-bearing rather than decorative — a control
run that replaces those two with Guns dies at wave 40 while the standard run reaches 100.

### 6.2 The tier ladder

| Tier | What it does | Cost |
|---|---|---|
| 1 | the tower as listed | base |
| 2 | +25 % damage, +2 % range | base × 0.9 |
| 3 | **choose branch A or B** — exclusive | base × 1.6 |
| 4 | the branch, deepened | base × 2.9 |
| 5 | the branch, completed; one per tower type per run | base × 5.2 |

Tier 3 is the identity choice. A tier-5 tower is roughly **6–9×** the base tower's output, not 2×,
because waves 60–100 demand it.

Walls break the ladder pattern: they are a three-tier tower. Tier 2 costs 12, the tier-3 branch costs
20, and there is no tier 4 or 5 — a branched wall is finished.

The Repair tower also stops at tier 3, but with no branch: tier 2 costs 140 and widens the radius to
5.0 tiles, tier 3 costs 260 and deepens the heal to 3 HP/s, and then it is done. It never branches, so
the tier-3 choice is just another Upgrade button, not a branch pair.

### 6.3 Branches

| Tower | Branch A | Branch B |
|---|---|---|
| Gun | **Marksman** — +60 % range, +80 % damage to its current target | **Repeater** — double fire rate, −1 damage |
| Cannon | **Mortar** — +1 splash, +50 % damage, −25 % fire rate | **Minesweeper** — stops firing and lays mines on the path |
| Taser | **Arc** — chains to 3 targets | **Overload** — +150 % damage to shielded enemies |
| Frost | **Deep Freeze** — 60 % slow for 2.5 s | **Shard** — no slow; damage ×4, splash 0.6 |
| Laser | **Focus** — pierce 8, +50 % damage | **Prism** — splits into 3 short beams at −40 % damage |
| AA | **Flak** — shells burst on the target's predicted position, splash 1.2 tiles, full to flyers and half to ground; 4.0 damage, 0.9 s | **Missile** — 4 homing missiles per salvo, each worth a quarter of a hit; a missile that loses its target re-acquires the nearest flyer within **6 tiles of the missile**, not of the tower |
| Beacon | **Command** — +30 % damage aura *on top of* the base +60 % (so +90 %), no range bonus | **Relay** — extends pointer reach, +50 % pointer damage in radius |

Branch effects on the Beacon's aura add to the base rather than replacing it, the same as every
other numeric branch effect. This is not a detail: when the two aura fields were assigned instead,
Command quietly landed *below* an un-branched Beacon (+30 % against +60 %), and the branch a player
paid for made the tower worse. The tooltips show the resulting percentage, so a wrong number is now
visible on screen rather than buried in `effectiveStats`.
| Wall | **Bulwark** — hit points doubled again | **Mesh** — hit points doubled and it blocks flyers |
| Cursor | **Overclock** — rate ×1.8, per-click damage ×0.6 | **Wide Search** — radius ×1.35, rate ×0.7 |

Walls are the one tower with a third branch: **Toggle** (`C`). A Toggle wall is a gate — left-clicking
it opens it (walkable, cannot be attacked, no ground block) or closes it (blocks exactly like a plain
wall); closing is refused when it would seal the route. A successful flip locks that gate for **3
seconds (180 ticks)** on the simulation clock; another flip while locked does nothing and the status
bar says *"Gate locked for 1.4 s"*, with the remaining lock in seconds. The lock is per gate, so two
gates can be flipped in turn. While a gate is locked it is drawn in the disabled wall style rather
than its live style, and its tooltip reads *"Gate locked — 1.4 s"*.

The tensions are deliberate. Mortar or Minesweeper is "hit now or lay a field": the Mortar answers
whatever is in range the moment it fires, while the Minesweeper trades that certainty for a field of
mines that only pays off where enemies actually bunch. Command or Relay is "your towers or you" — the
one place the pointer gets a tower's help, and the reason a clicker-minded player and a tower-minded
player build different boards from the same pieces.

#### The Minesweeper's minefield

A Minesweeper is the Cannon's branch **B**. It **stops firing** — it keeps its hit points, its repair
cost and its sell value, and still counts as a tower for Breacher chewing and for the Repair tower — and
instead lays a mine on the nearest path tile within **3 tiles** every **2.5 s**. A mine arms **0.5 s**
after it lands and expires unspent after **30 s**. At most **6 live mines** may exist per tower; when a
seventh would land, the oldest is removed.

A mine detonates when any ground enemy walks within **0.35 tiles** of its centre: it deals **18 damage**
to every ground enemy inside a **0.9-tile** radius, then is gone. Flyers never trigger a mine and are
never damaged by it; friendly towers are unaffected. Mines are visible — a small hatch-ring on the path
tile, with a faint 1 px pulse while armed — so the player can read where the field is dense without
relying on colour.

The **6-mine cap is the whole balance argument**: a minefield is a placement puzzle with a ceiling, not
a stacking exploit. Without the cap a Minesweeper left anywhere near a choke would accumulate an
unbounded burst over the course of a wave; with it, the field is a bounded resource the player places by
choosing where the tower stands. The expected shape of the trade is the Frost tower's: strong on a
corridor where enemies bunch, weak on open maps where a 0.9-tile burst catches one enemy, and useless
against a pure flyer wave.

The mine numbers are fixed, not tier-scaled: the drop interval, arming, expiry, cap, blast radius and
damage do not change as the Cannon deepens through tiers 4 and 5. They are hypotheses from the mechanism
first, to be tuned after the field reads on the board.

### 6.4 Selling

Refund **70 %** of everything spent, rounded down. Selling is how mazing recovers from a mistake, so it
has to stay cheap enough to actually use.

### 6.5 Turret traverse

A tower does not fire the instant it has a target: it must first bring its barrel to bear. Each tower
has a **turn rate** (degrees per second); `0` means it never turns and fires instantly. On each tick a
tower picks its target exactly as before, computes the bearing from its centre to that enemy, and
rotates its barrel toward the bearing by at most `turnRate / 60` degrees (one fixed 60 Hz tick). It
only fires once the remaining angular error is within the **8° aim tolerance**; otherwise it holds
fire and keeps turning. Cooldown ticks down regardless of facing, so a slow traverse costs shots, not
cooldown.

The tolerance is 8° by design. It is wide enough that a tower tracking a slow enemy settles and holds
without wobbling across the firing line, and narrow enough that a fast enemy crossing the field forces
a real swing. A cannon needs a moment to swing round and loses time reacquiring a runner that has
rounded a corner — slow traverse costs something, without making the cannon bad.

| Tower | Turn rate | Why |
|---|---|---|
| Gun | 720°/s | fast — it can track almost anything, costs a fraction of a second to swing round |
| Cannon | 90°/s | slow and heavy — the one that changes play |
| Laser | 150°/s | must line the beam up before it fires |
| Taser | 0 | instant — an arc weapon that needs no aiming |
| Frost | 0 | instant — area effect |
| Beacon | 0 | never fires; keep it still |

The barrel facing is a sim value stored on the tower in radians (`0` = north, increasing clockwise)
and drawn at that angle. Angle 0 is the classic north-facing barrel and renders identically to the
pre-traverse build.

### 6.6 Repair

Any tower with hit points can be repaired. The mechanic is written tower-generic, so a Gun, a Frost,
a Repair tower — anything — gets the same Repair button the Wall does the moment it is damaged.

**Cost.** `repairCost = ceil(0.5 × spent × (1 − hp / maxHp))`, where `spent` is the tower's total
spend (the build price plus everything bought for it). Half the tower's value restores it completely,
pro rata for partial damage: a Bulwark wall (spent 40, max 1080 HP) costs 20 to repair from 1 HP to
full, and 4 to repair at 80% health. Repairs are always cheaper than rebuilding, and much cheaper the
earlier you repair.

**Time.** A repair is a job, not a transaction. A full repair (1 HP to max) takes **5 seconds**, and
the duration scales linearly with the damage restored, so a half-damaged wall takes 2.5 s. The cost
is paid up front when the repair starts.

**Not functional while repairing.** While the timer runs the tower is out of service. For a wall that
means it stops blocking: it is off the field for pathing exactly as an open Toggle gate is, which
re-paths the enemies and may open a short cut straight through the maze. That is the risk that makes
a mid-battle repair a decision rather than a reflex. A repairing wall cannot be attacked by breachers
— the enemies simply walk past it and hit something else — so a repair cannot be used as a shield
against damage that is already arriving. Hit points tick back at a constant rate and the tower
returns to service the moment the timer ends.

**Spam prevention** falls out of the time and the price: one repair at a time per tower, no repair
while one is running, no repair at full health, and no refund if the tower is sold mid-repair.

The damaged tower's panel gains a **Repair** button above Sell, showing the price; its tooltip names
the duration. While repairing, a wall draws with a hatched face and a small progress bar in place of
its health bar, and the route line shows it as walkable the moment the repair begins. A non-wall tower
shows the same progress bar in place of its health bar, and leaves the field for pathing just as a
wall does.

### 6.7 The Cursor tower

The **Cursor** is the one tower whose damage is not its own. It cannot fire; instead it carries a
second cursor — the classic white arrow, drawn at the **same 16 px size as the player's own pointer**,
not as a miniature — that wanders around its home tile and clicks enemies for you. Hovering the tower
draws its range ring around the **tower tile**, which is the leash: the circle is how far the cursor may
wander from home, not where the shot happens. A **dotted tether** runs from the tower's base to the
cursor's current position, so the wandering arrow is legibly that tower's and not a second pointer
loose on the board. A ring centred on the cursor was tried first and read wrong — it slid around the
board as the cursor drifted and stopped describing a fixed property of the tower. Every click deals **half the player's current click damage**, ladder and spec multipliers
included, and is treated as pointer damage: it ignores armour and wears shields down exactly as the
player's own clicks do. The tower's radius (3.0 → 4.0 → 4.75 tiles) and its click clock (1.5 → 2.0 →
2.75 clicks/s) are its only stats, and at tier 3 it branches into **Overclock** (more, weaker clicks),
**Wide Search** (a wider reach, clicking less often) or **Maintenance** (see below).

The relationship is the point. The pointer ladder was a personal weapon; the Cursor makes it *board*
value. A click level that adds damage to your hand now adds half that to every Cursor on the field,
so the ladder is worth buying partly because of these towers — a clicker-minded player climbs the
ladder and a tower-minded player's Cursors still benefit, which is what keeps the two halves feeding
each other instead of drifting apart. Cursors never crit, never mark, and ignore held pointer, combo
and weak points: the ladder feeds them through click damage and nothing else.

A cursor's targeting is fixed, not a player choice. It clicks the nearest shielded enemy to its home
tile — a **Shielded** or a **Bastion**, whose shield is above zero — and with no shielded enemy in radius
it clicks the nearest enemy to its home tile. An enemy hidden under a Pop-up window is never a
candidate. **Manual Override** (§9.5) still wins over this rule, exactly as it beats the Taser's lock:
while the marked enemy is in range and targetable, the cursor clicks it instead.

**Maintenance** is the third branch and the one that gives a Cursor a support role. A Maintenance
cursor behaves exactly as any other cursor while an enemy is inside its radius — shielded first, then
nearest. Only when the radius is clear does it look for work: any tower inside its radius below **80%**
of maximum hit points, lowest fraction first, then nearest. It flies to that tower, clicks it, and
starts an ordinary repair — the same `startRepair` path a player uses, with the same salvage cost and
the same downtime, during which the tower is off the field and not firing. It repairs one tower at a
time and only while the area stays clear; if an enemy walks in, it abandons the job and fights.

Three limits keep it honest. It never starts a repair the player cannot afford, so it cannot run a
salvage debt. It ignores towers above 80%, so it does not spend money topping up a scratch. It never
touches a wall that was destroyed and removed — but an offline tower is a valid target, and at 0% it
wins the choice (see §6.9). The branch's cost is the damage output of the Overclock click it did not
take, which the tooltip says plainly.

**How this tower is measured.** Its damage share is the wrong statistic and the balance harness was
wrong to judge it by one. A Cursor's job is to take shields off enemies that nothing else can touch
and, on Maintenance, to keep the board repaired without a Repair tower — neither of which shows up as
damage dealt. The metric that matters is **shields removed per salvage spent** and **towers repaired
per run**; a Cursor that deals 1 % of the damage and breaks every shield in its radius is doing its
job. It is also the tower that changes the shape of a run: once it is unlocked, a defence can be left
alone, which is the moment the game turns from tower defence into an idler.

### 6.8 The Repair tower and its aura

The **Repair** tower is the board's medic. It never fires at enemies; instead every tick it adds hit
points to every damaged tower inside its radius, at a rate of **2 HP/s** (tier 3 raises it to 3 HP/s),
in both the build and the wave phase. It needs no aiming, and it heals several towers at once. The
radius is **4.5 tiles** at tier 1 and **5.0** from tier 2.

The aura is deliberately narrow in scope:

- **Only damaged towers in radius.** A tower at full health is not a target, and the placed-tower panel
  and tooltip report `Healing N towers` — the number of damaged towers currently being healed, which
  reads `0` when the aura has nothing to do.
- **It cannot revive.** A destroyed tower is gone and out of scope. A wall that is destroyed still
  re-opens the maze, exactly as if no Repair tower had ever existed.
- **It never heals an enemy.** The aura reads the tower list only; enemies are untouched.
- **It never heals itself**, and it does not interfere with a manual repair: a tower being repaired by
  hand is off the field, so the aura simply does not apply to it while the job runs.
- **It is not a Beacon.** The Repair tower grants no damage or range bonus, and a Beacon grants no
  healing — the two support auras do not stack into one tower.

The Repair tower keeps the same HP pool and Repair button as any other tower, so it can be damaged by
a Breacher's turret and must then be healed by another Repair tower or repaired by hand.

### 6.9 Tower hit points and offline

A non-wall tower reduced to **0 HP goes offline**. It does not leave the board — it stays on its tile
and still blocks the route — but it stops doing everything a live tower does:

- It **stops firing** (a Gun, Cannon, Taser, Frost or Laser goes quiet).
- It **stops projecting auras**: a Repair tower stops healing, a Beacon stops buffing, and a Relay
  Beacon stops extending the pointer.
- A **Cursor** stops clicking.
- It **cannot be upgraded or branched** — the only way back is a repair.

An offline tower reads as broken-but-fixable, not gone: a desaturated body, a small red crossed
wrench, and an empty health bar.

**Repair brings it back.** An offline tower is repaired through the normal repair flow, starting from
0 HP at the usual price formula — which at 0 HP is the full `0.5 × spent` cap — and it returns to
full health and full service when the timer ends. The Repair tower's aura **does** heal an offline
tower (that is the point of owning one), and a Maintenance cursor treats an offline tower as a valid
target: at 0% health it is the lowest fraction, so it wins the choice over any merely damaged tower.

**Walls are the exception.** A wall at 0 HP is destroyed as it is today, removed from the board and
re-opening the route in the same tick — a wall that stayed would keep the maze closed. Say it plainly:
walls are destroyed, everything else goes offline.

### 6.10 Tower unlocks

The palette is gated so each tower arrives when the enemy it answers does. Gun and Wall are the
starting pair — available from the initial build phase before wave 1 — and every later kind unlocks at
a fixed wave, permanently, for the rest of the run (endless included):

| Wave | Unlock | Why then |
|---|---|---|
| 1 | Gun, Wall | the two that teach the game: damage and the maze |
| 4 | Cannon | the first tank enemies reward a slow, heavy hitter |
| 6 | Frost | flyers arrive around here; slowing what you cannot block is the lesson |
| 8 | Beacon | support arrives once the player has enough towers to cluster |
| 11 | Laser | the first boss clears at 10; the long-range single-target answer |
| 14 | Taser | breachers walk from 12; a wall-chewer needs a tower that punishes close |
| 18 | Repair | towers start taking real chip damage once breachers are common |
| 24 | Cursor | the pointer ladder should be familiar before it can be delegated |

A locked tower stays in the palette, **greyed and disabled**, in its normal position — visible, never
hidden. Its tooltip reads `Unlocks at wave 18` above the normal description. Its keyboard shortcut is
inert and the status bar says why (`Frost unlocks at wave 6`), and `canPlace` refuses a locked kind even
if a stale selection still points at it. The wave that unlocks a tower shows a one-line status message
(`Frost unlocked`), and the build phase after that wave is the first time the button is live. Unlocks
never re-lock, so a tower bought once stays available through endless.

---

## 7. Enemies

| Enemy | HP | Speed | Radius | Armour | Shield | Value | Answer |
|---|---|---|---|---|---|---|---|
| **Grunt** | 20 | 1.6 t/s | 0.30 | 0 | 0 | 4 | anything |
| **Runner** | 10 | 3.5 t/s | 0.18 | 0 | 0 | 6 | pointer; a taser on a corner |
| **Shielded** | 30 | 1.2 t/s | 0.36 | 2 | 15 | 10 | pointer breaks the shield, towers finish |
| **Flyer** | 14 | 2.2 t/s | 0.26 | 0 | 0 | 7 | Flak, laser, pointer |
| **Armoured** | 45 | 1.0 t/s | 0.34 | 8 | 0 | 12 | taser, laser, Overload |
| **Saboteur** | 25 | 1.5 t/s | 0.28 | 0 | 0 | 11 | kill it before it arrives — it disables a tower for 4 s |
| **Breacher** | 55 | 0.6 t/s | 0.42 | 0 | 0 | 14 | chews walls and shoots a 2.2-tile turret at your towers — walls disarm it, a gun in front of the wall finishes it |
| **Pop-up** | 60 | 0.7 t/s | 0.40 | 0 | 0 | 18 | click its close box — a window that shields every enemy under it from towers |

Armour is **flat subtraction** on tower hits, floored at 1. Clicks ignore armour entirely. Shields
absorb tower damage completely until broken, and only the pointer can break them. That is pillar 1
stated as arithmetic.

The Breacher carries a **mounted turret** in addition to its nose. While it is walking it fires at the
nearest player tower — range 2.2 tiles, 2 damage, one shot per second — so a Breacher threatens the
line itself, not just the maze. The turret stops the moment the Breacher sets its nose to a wall: the
nose is busy, so a wall both slows and **disarms** a Breacher, and it resumes firing the moment the
wall is gone. Walls are the nose's job, not the gun's, so the turret never targets them. A turret shot
is a visible tracer with a muzzle flash at the Breacher's nose and a hit spark on the tower it struck.
At 2 damage per second the turret is a lane threat, not a demolition crew: a tower caught in the open
for a whole wave loses a quarter to half of its pool, which the player answers with a repair between
waves — and the balance harness's scripted player now does the same (it repairs a tower that is offline
or below 35% HP between waves, paying out of salvage it cannot otherwise spend).

Shield damage is visible, not a silent clock: every enemy whose shield is above zero draws a cyan
shield ring whose alpha tracks the fraction remaining (a Shielded entering at 15 reads as heavily
protected, one nearly stripped as faint), and every hit the shield absorbs pops a cyan `SHD` floater
with a short arc at the impact, so a fully absorbed click still shows something happening.

The pop-up window is a **spatial shield**, not a stat: any enemy whose centre is inside its rectangle
is untargetable by towers, and no tower damage — including flak bursts — reaches it while the window
lives. The pointer is unaffected and can still shoot those enemies; the window itself only dies when
its close box is clicked, which pays the normal salvage and releases whatever it was covering.

A pop-up that reaches the exit **costs no integrity**. It is the only enemy that can only be removed
by clicking its close box, so if it also damaged integrity on arrival, idling would be impossible by
construction — the one enemy the player must be present for would also be the one that punishes not
being present. The pop-up's job is to blind the towers and take the player's attention for a moment,
not to end a run the player left alone. When it reaches the exit it leaves the board harmlessly: it is
not a leak, it does not shake or flash or play the damage sound, and it shows a neutral status line
(`Pop-up left — no damage`) instead.

If an enemy could be answered equally well by either half, it is not doing its job.

### 7.1 Boss variants (pass 1)

Every enemy type has a bigger, nastier version of itself. Each is a **separate enemy kind** (not a flag
on the base kind), keeps the base type's identity, and counts as its base type for tower rules (an
Overload Taser reads a Bastion as shielded). Killing one pays **6×** the base type's kill value and
shows a distinct death pop; a boss variant that leaks costs its own integrity.

| Kind | Name | Scale | HP | Speed | Integrity | Gimmick |
|---|---|---|---|---|---|---|
| `grunt-boss` | **Sergeant** | 1.6 | 6× | 0.55 | 4 | none — a wall of hit points, the baseline every other boss is read against |
| `runner-boss` | **Pacer** | 1.5 | 4× | 0.85 | 3 | **Aura of pace**: a 3-tile speed floor that makes every enemy inside move at the Pacer's speed or its own, whichever is faster |
| `shielded-boss` | **Bastion** | 1.6 | 5× | 0.45 | 4 | **Three shield layers** (each worth the base 15-point shield), stripped one per pointer/cursor hit |

The radius is the base type's radius × scale, so hit-testing and the drawn silhouette agree. Each boss
is drawn from **its own SVG** — an upgraded version of its base type, crowned, with 4× the base type's
animation frames — at the stated scale, falling back to the base type's art plus a runtime crown notch
if its file is missing; the Pacer aura draws as a faint ring.

Type bosses unlock at **wave 12 (Sergeant), 18 (Pacer) and 24 (Bastion)** — each boss's first
appearance is its unlock wave, never before it — and then one boss rides every eighth wave after that
(wave 24 + 8k), chosen from the unlocked set by a seeded roll that favours the newest type. The
milestone waves 10/25/50/75/100 spawn their own mapped type boss (see §8.2); a type boss appearing on
a milestone wave's neighbour is fine and intended.

The Bastion's **Warden aura** — an area shield grant to nearby enemies — is **deferred to boss pass 3**.
Pass 1 shipped it and it read as a wall on the two open maps: shields only fall to pointer damage, so
while the Bastion stood a tower-only board could not damage anything inside the aura's radius, which
contradicted idling being viable. When it returns it must be capped — a small radius plus a hard cap on
the number of affected enemies, or a short-lived shield that decays — so it cannot neutralise a
tower-only board again.

### 7.2 Boss variants (pass 2)

Pass 2 adds the next four type bosses, each keeping its base type's identity and adding exactly one
gimmick. They are separate kinds (naming them in waves, harness and tests), count as their base type
for tower rules (an AA tower reads the Carrier as a flyer, and a Minesweeper's mines pass under it;
walls block the Ram and the Sergeant but not the Carrier), pay 6× their base kill value, and pop like a
boss on death.

| Kind | Name | Scale | HP | Speed | Integrity | Gimmick |
|---|---|---|---|---|---|---|
| `flyer-boss` | **Carrier** | 2.0 | 12× | 0.35 | 5 | **Brood**: every 4 s it releases three flyers at its position that scatter outward and then home on the exit; on death it releases six |
| `armoured-boss` | **Dreadnought** | 1.7 | 9× | 0.40 | 4 | **Plating**: flat 6 damage reduction per hit on top of its 8 armour, and slow effects on it are halved |
| `saboteur-boss` | **Wirecutter** | 1.5 | 5× | 0.60 | 4 | **EMP**: every non-wall tower within 2.5 tiles is knocked offline for 3 s as it passes, then returns on its own — the tower keeps its hit points, so it is not the repair flow |
| `breacher-boss` | **Ram** | 1.8 | 8× | 0.40 | 5 | **Breaches towers**: it chews any tower in its path — 40 wall DPS, 40 tower DPS — driving a non-wall tower offline at 0 HP rather than destroying it (repairable), and mounts an 8-damage turret at 3 tiles. It prefers a wall it is touching over a tower, and a tower over walking, so a maze buys time one tile at a time |

The radius is still the base type's radius × scale. Each gimmick is a first-cut number, not a tuned one:

- **Brood** flies for half a second outward, then homes; the released flyers are ordinary flyers of the
  Carrier's wave, so they leak for 1 each if the board does not catch them.
- **Plating** is additive with armour (a tower hit loses armour + plating before the 1-damage floor),
  and both are ignored by armour-ignoring towers. "Slow halved" is the slow *strength* halved — Frost's
  0.3× becomes 0.65× — applied to tower slows and the Time Zone global slow alike.
- **EMP** is a refresh, not a stack: while the Wirecutter stays in range the timer keeps pointing at
  now + 3 s, so the tower returns 3 s after the boss moves on. It never damages, and it never touches a
  wall (a wall has no firing/aura state to knock out). The EMP'd tower is drawn with an amber bolt, not
  the red offline wrench.
- The **Ram** paths over a field that treats towers as walkable, so it does not route around the
  defence — it chews straight through it. It prefers a wall over a non-wall tower, and either over
  walking on, so a wall maze is eaten one tile at a time; the counter is a spread board with a Repair
  tower (or Maintenance cursor) behind the line to bring the offline towers back.

The pass-2 schedule extends pass 1's: unlocks at **12 (Sergeant), 18 (Pacer), 24 (Bastion), 30
(Carrier), 36 (Dreadnought), 42 (Wirecutter) and 48 (Ram)**, then one boss rides every eighth wave
after 48 (56 + 8k), chosen from the unlocked set by a seeded roll that favours the newest type. The
milestone waves 10/25/50/75/100 spawn their mapped type boss (§8.2); multi-boss waves are pass 3.

The **Ram is the scare**: every other boss asks the player to shoot it better; the Ram asks whether the
line can survive being eaten. It is telegraphed in the draw (a drill nose) and named in the NEXT WAVE
preview before it spawns. Balance is not a gate here — the first-cut numbers above drop the standard
run below 6 integrity on every map, recorded in the commit message rather than tuned (see pass-1 for
the tuning precedent).

---

## 8. Waves

### 8.1 Structure

A wave is a list of **spawn groups**: kind, count, interval, delay. Groups overlap, which is how mixed
waves are authored without listing individuals.

### 8.2 The hundred

| Band | Waves | Introduced |
|---|---|---|
| Tutorial | 1–5 | grunts, the first runners, the economy |
| Pressure | 6–20 | flyers, shielded, breachers (from 12), the first real maze |
| Specialists | 21–40 | armoured, saboteurs, branch towers |
| Attrition | 41–60 | mixed waves; modifiers begin at 51 |
| Siege | 61–80 | boss at 75, dense flyer waves |
| Endgame | 81–100 | everything, modifiers stack, boss at 100 |

Boss waves at **10, 25, 50, 75, 100**. Each milestone wave carries one type boss plus its 6–12 ground
escort and does not pause the wave timer. The mapping is fixed:

| Wave | Type boss |
|---|---|
| 10 | **Sergeant** (`grunt-boss`) |
| 25 | **Pacer** (`runner-boss`) |
| 50 | **Bastion** (`shielded-boss`) |
| 75 | **Carrier** (`flyer-boss`) |
| 100 | **Dreadnought** (`armoured-boss`) |

### 8.3 Scaling

```
hpScale(w)    = 1 + 0.18·(w−1)          for w ≤ 20
              = 4.42 · 1.015^(w−20)     for 20 < w ≤ 60
              = 8.02 · 1.001^(w−60)     for 60 < w ≤ 100
valueScale(w) = 1 + 0.06·(w−1)          for w ≤ 50
              = 3.94 · 1.012^(w−50)     for w > 50
```

HP outgrows value on purpose. The curve bends twice: it steepens through the Specialists and Attrition
bands, then flattens past wave 60 so that one reboot's worth of specs is enough to carry a competent
player to wave 100. Without the reboot the same player runs out of integrity somewhere in the Siege band.

**Endless** continues the HP curve in compounding bands, so a maxed board cannot coast forever:

| Waves | HP rate per wave | Spawn interval scale | Enemy-count baseline |
|---|---|---|---|
| ≤ 100 | as above | 1.00 | 66 |
| 101–125 | 1.020 | 0.96 | 72 |
| 126–150 | 1.035 | 0.92 | 78 |
| 151–175 | 1.050 | 0.88 | 84 |
| 176–200 | 1.065 | 0.84 | 90 |
| 201–225 | 1.070 | 0.80 | 96 |
| 226–250 | 1.075 | 0.76 | 102 |

The HP rate then climbs +0.005 every 25 waves, capped at **1.12**; the spawn-interval scale tightens
4 % per 25 waves down to a floor of **0.60**; and the enemy-count baseline rises 6 per 25 waves,
capped at **110**. Each band compounds on the one before, so there is no step or dip at a band edge —
only a steeper slope. Modifiers stack harder too: one from wave 51, two distinct from wave 120, three
from 150, four from 200.

The measured curve: `waveHpScale` is **12.40** at wave 120, **32.36** at 150, **528.9** at 200 and
**17,507** at 250 (wave 100 is 8.35). The balance harness's `--endless` flag drives the standard build
past victory until it dies; every authored map currently falls between wave 119 and 126 under this
curve.

From wave 51 each wave takes one modifier from a small pool: **fog** (range −20 %), **no-build**
(the whole board is frozen for the wave), **fast forward** (speed +15 %), **blackout** (salvage
hidden until the wave ends), **rush** (spawn interval −25 %, value +10 %).

During a **no-build** wave the player cannot change their board or their towers: no placing a tower
anywhere, no upgrades, no branch choices, no repairs (by hand or by a Maintenance cursor), no
selling, and no changing a tower's target priority. Towers still fire, the Repair tower's aura still
heals, the pointer and cursors still click, and the Auto checkbox still runs. Manual Override keeps
working too — it is a pointer spec, not a tower setting — though towers themselves cannot be
retargeted. Every blocked action reports `No-Build — the board is frozen this wave` in the status bar
and the relevant buttons render disabled for the duration of the wave, re-enabling the moment it ends.

### 8.4 Victory and endless

Clearing wave 100 grants victory and unlocks **endless**: procedural composition from a weighted pool,
scaling continues (see the endless table in §8.3), modifiers stack. Endless exists for players who do
not want to reboot yet — but it is now a mode that eventually ends the run rather than a flat coast.

The balance harness measures it with `npm run balance -- --endless`: the standard build plays through
the victory transition and keeps going until integrity hits zero, then reports the wave reached per
map. The target is that a maxed, competently played board does not walk past wave 150, and every map
dies between wave 110 and 220. If a map passes 250 the 101–125 rate is raised 0.005 and the run
re-measured.

### 8.5 Call the next wave early

While a wave is running the player may **start the next wave immediately** instead of waiting for the
board to clear, and is paid a salvage bonus for the risk (Desktop TD's "send next wave"). The wave
loop is no longer one-wave-at-a-time: several waves may be in flight at once.

**Model.** The single spawn schedule is replaced by a queue of *wave runs*, one per started wave:

```
WaveRun { wave, startTick, spawns[] }
```

`spawns` holds the remaining spawns for that wave, each tick measured **relative to `startTick`**. A
monotonic run clock (`clock`) advances once per simulation tick and is never reset; a wave's spawn
fires when `clock` reaches `startTick + spawn.tick`. `waveTick` still means "ticks since the most
recent wave started" (ads and the bonus read it) and resets on every start, early ones included.

`startWave` is allowed from **build** (a normal call, no bonus) or from **wave** (an early call). It
is refused at wave 100 in a normal run. Starting increments the wave number, pushes a `WaveRun`, sets
phase to wave, resets `waveTick`, applies the new wave's modifiers, and — on an early call — pays
the bonus.

A wave is **cleared** when its queue is empty and no living enemy carries that wave number. Clearing
awards `waveClearBonus(wave)` and pushes `waveCleared`, exactly as before. The run returns to **build**
when every run is cleared and no enemies remain; **victory** still lands on the wave-100 clear. Leaks
are counted **per wave number**, so an early call can neither poison nor rescue another wave's
no-leak record.

**Bonus.** Calling early pays, at the moment of the call, a fraction of the *called* wave's kill
value — the salvage that wave would pay if every enemy in it died:

```
span     = last spawn tick of the wave that just started        (min 60 ticks)
fraction = clamp(1 − elapsedTicks / span, 0, 1)
bonus    = clamp(round(0.5 × waveKillValue(nextWave) × fraction), 5, waveKillValue(nextWave))
```

`waveKillValue(wave)` sums each enemy's base value scaled to that wave — the same per-enemy value
`createEnemy` assigns, so the bonus cannot drift from the economy. `nextWave` is the wave being called,
not the one currently running; `span` is measured from the wave that just started (the current one,
`nextWave − 1`). The 0.5 coefficient means a full-early call pays half of the next wave's worth —
24 at wave 2, 365 at wave 30, 879 at wave 60, 2,373 at wave 100 — and later calls decay to a floor of
5. The HUD shows the live value counting down. The formula has no randomness.

**Harness.** `scripts/balance.mjs` runs five scenarios and reports waves cleared, last wave started,
integrity, salvage, specs, leaks and reboots for each:

| Scenario | Flag | Strategy |
|---|---|---|
| standard | *(default)* | build greedily, click at a fixed rate, reboot at wave 60 |
| control | `--no-support` | the same policy with Frost and Beacon replaced by Guns |
| call | `--call` | run normally; call the next wave once every spawn queue is exhausted while enemies remain |
| call-all | `--call-all` | chain every remaining wave at tick zero, as a stress test of overlapping waves |
| call-sweep | `--call-sweep` | call each next wave at 25%, 50% and 75% of the current spawn window, and spend the bonus instead of banking it |

The sweep prints one table: a row per timing (25%, 50%, 75%) plus a **control** row — the same build
policy with no early calls — so the comparison sits in the table rather than in prose. Its timing uses
the same spawn-window span as the bonus itself.

| timing | bonus earned | waves cleared | last started | integrity | salvage |
|---|---|---|---|---|---|
| 25% | 308 | 3 | 10 | 0 | 744 |
| 50% | 438 | 11 | 16 | 0 | 3,879 |
| 75% | 8,108 | 100 | 100 | 11 | 179,945 |
| control | 0 | 100 | 100 | 17 | 171,661 |

The 75% line clears while 50% stays fatal, so the bonus is a lever for a strong board rather than a
free win. The 75% line still lands a little below the control (11 vs 17 integrity): a late call is
close to break-even but not free.

Waves cleared counts waves actually cleared, not the wave counter: the separate last wave started line
is the counter, so an early call cannot inflate the result. The call scenario exists to *measure* the
mechanic rather than assume it is fair: if the aggressive-but-playable line clears 100 with little
loss, the bonus is reduced or the decay steepened — enemies are never made harder and per-wave
HP/salvage tables are left alone. The call-all scenario is only a stress test of overlap, not a
balance number.

### 8.6 Auto-wave

The **Auto** checkbox under the Next Wave button turns the late game into an idler. When it is on,
the run returns to build after a wave clears and — 1.5 s later, so the player can still spend
salvage or start a repair — the next wave starts on its own. It only ever starts a wave that has
already been earned, so it never pays the early-call bonus. The countdown is armed on the first
build tick after a clear (`wave > 0`, so a fresh run at wave 0 never auto-starts), reads
`Auto: next wave in 1.2 s` in the status bar, and holds at `Auto: waiting for repairs` while any
tower is off the field mid-repair. A manual Next Wave resets the countdown; toggling Auto off
cancels it. The setting is off by default and persists in the profile like sound and volume.

---

## 9. The pointer

The OS cursor is hidden; a drawn arrow replaces it, hotspot at the tip. The pointer is the clicker half
of the game: it has its own ladder, its own cost curve and a reason to keep clicking during a wave.

### 9.1 Stages

Two stages. The first is the bare click; the second adds the reticle.

| Stage | Name | Cost | Click damage | Effect |
|---|---|---|---|---|
| 1 | **Click** | — | 3 | a bare click |
| 2 | **Reticle** | 80 | 4 | hold to lock: damage over time on the locked target, and the enemy it locks is *marked* |

Click damage ignores armour and is the only thing that can break shields (§7).

### 9.2 The overclock ladder

Above stage 2 the pointer keeps a cost curve of its own. **Overclock levels** are capped at 12 and
wave-gated so click power grows with the content instead of ahead of it:

```
cost(level)  = round(1845 × 1.25^level)   // buying level+1 from level; ~100k for the whole ladder
damage       = 4 × 1.12^level × milestone(level)
holdDps      = damage × 2.5               // so the reticle keeps pace with the click
ceiling(wave) = clamp(floor(wave / 8), 0, 12)
milestone(level) = ×2 at level 5, and ×2 again at level 10
```

The cost base is derived from the closed form so the full ladder still costs about **100k** of salvage —
the same total spend the old 1.95 curve charged for the climb — while the per-level growth flattens to
1.25, turning the last two walls into thirteen small steps. The damage growth is 1.12 with **explicit
×2 milestones at level 5 and level 10**: each milestone doubles the click (and the hold DPS that tracks
it) the moment it is reached, so the ladder reads as a few visible jumps rather than one smooth curve.
The milestone is the reason level 12 still lands near the old power — **~62** — without a steep
per-level curve. The crit chances and the marked multiplier stay as written.

The highest level the current wave permits is `floor(wave / 8)`, clamped to 0..12
(`OVERCLOCK_WAVE_DIVISOR = 8` in pointer.ts): level 1 unlocks at wave 8, level 2 at wave 16, and so
on, reaching level 12 at wave 96. Buying above the ceiling is refused, and the pointer panel shows
the current level against the ceiling (`Overclock 3 / 5`). The ceiling only ever rises, so levels
already bought are never taken away — it is a guard, not a tax.

### 9.3 Precision

Every enemy carries a **weak point**: a 25 % arc on its leading edge, drawn as a small notch. Clicking
it deals **×2** damage and marks the kill for the 2× payout. Clicking elsewhere deals normal damage.
Missing does nothing and breaks the combo.

**Combo:** consecutive weak-point hits add **+10 %** each, capped at **×2**. Missing, or five seconds
without a hit, resets to ×1.

The combo is the clicker half's skill expression. It exists so that clicking is *aiming* rather than
*spamming* — the Sanctum lesson, applied to the mouse.

### 9.4 The mark, and crits

The reticle earns its keep beyond the damage tick. The enemy the reticle is locked on is **marked**,
drawn with a corner-bracket reticle so it is unmistakable. The mark pays two ways:

- **Clicks on a marked enemy deal +15 % damage.** Focusing one enemy (a boss) makes the next click on
  it hurt more than a click on a fresh target.
- **Crits.** A click can crit for **2.5×**. The base chance is 4 %, plus 6 % when the target is
  marked and plus 8 % when the click lands on the weak point. The held pointer's damage-over-time
  crits by the same chances, since it is always on its marked target. A crit pops a loud `CRIT` so a
  lucky streak is visible.

Clicks are rolled against the seeded run PRNG, so a crit is part of the deterministic simulation — a
given click always lands the same way on the same run.

### 9.5 Manual Override

From stage 2 the pointer panel gains an **Override** checkbox, per-run state drawn as a Windows
checkbox. While it is on, any tower whose range holds the marked enemy **ignores its targeting mode
(and any per-kind lock) and shoots the marked enemy**. Point at a boss and the whole board focuses.

The trade is real: every tower in range drops its own priority for the mark. Enemies hidden by a
Pop-up window are still untargetable — override does not defeat the shield — and when the marked enemy
dies or leaves range, towers return to their own mode immediately.

### 9.6 What the pointer is for

The pointer is a real weapon now, not just a bonus printer. Its precision — the weak point, the mark,
the combo — rewards aiming, and the overclock ladder gives a clicker-minded player a bulk-damage path
of their own that competes with towers for the same salvage. Manual Override is the clicker's answer
to a boss the board is ignoring. The balance harness keeps the two honest: a clicker build clears the
hundred at parity with a tower build, never strictly better.

---

## 10. Desktop events

The Win95 motif doing mechanical work, taken from *Cookie Clicker*'s golden cookies.

During a wave an **ad** appears at a random spot on the desktop — the board field, inside the window's
client area with an 8 px margin, never over the title bar, the status bar or either side panel, and
never hanging off an edge. Its chrome is the main window's own scale: a 22 px title bar, a 16×14 close
box, a 2 px bevel and 13 px text, so it reads as part of the same application. The sim owns the
rectangle, so input and view agree, and the spot is chosen from the seeded RNG so a replay shows the
same ad in the same place. It lives **8 seconds**. Clicking its close box dismisses it and pays.

| Ad | Weight | Effect |
|---|---|---|
| *Defrag complete* | 30 | +8 % of current salvage |
| *AutoUpdate* | 20 | towers +40 % damage for 10 s |
| *Time Zone Change* | 15 | enemies −50 % speed for 6 s |
| *Freeware* | 15 | a free Gun appears on a random buildable tile |
| *Screensaver* | 10 | all enemies take 25 damage and are briefly stunned |
| *Blue Screen* | 10 | a trap: dismissing pays nothing and disables a random tower for 3 s |

- At most **one** ad on screen at a time.
- The first attempt comes **8–16 s** into the first wave; later attempts come every **25–45 s**. The
  countdown is absolute and keeps running between waves, so a wave start never resets it. An attempt
  that finds its conditions unmet retries after **8–12 s**.
- Attempts happen during waves only, never within the first **5 s** of a wave, and pause below **two**
  enemies on the board: a bonus you cannot earn is just noise.
- Blue Screen exists so the bonus is a decision rather than a reflex. Its title bar is subtly wrong —
  the text sits a pixel high — and an attentive player learns the tell.

---

## 11. Economy

| Source | Amount |
|---|---|
| kill | `value × valueScale(wave)`, ×1.5 pointer, ×2 weak point |
| wave clear | `30 + 6 × wave` |
| no leaks | +25 % of the wave-clear bonus |
| ad | as listed in §10 |

| Sink | Amount |
|---|---|
| tower | §6.1 |
| upgrade | base × {0.9, 1.6, 2.9, 5.2} |
| pointer stage | §9.1 |
| sell | refunds 70 % |

Starting salvage **60** — two Guns or one Cannon. Starting integrity **20**; a leak costs 1, a boss
variant leak costs **3–5** (its own integrity). Integrity never regenerates: the run's mistake budget
is spent, not healed.

---

## 12. Meta: Restart Windows and the Restore tree

Prestige is modelled on Cookie Clicker's Heavenly Chips: a currency you earn by ending a run, spent
on permanent upgrades that make the next run start further along. The point is not a bigger number on
the same run — it is that wave 40, which was the wall, becomes the opening act.

### 12.1 Restore Points

After wave 50 the player may **Restart Windows**. The run ends and the machine reboots. The reboot
pays **Restore Points**:

```
rp = floor(2.2 * sqrt(totalSalvageEarned / 900))
```

| Salvage earned in the run | Restore Points |
|---|---|
| 20,000 | 10 |
| 60,000 | 17 |
| 150,000 | 28 |
| 500,000 | 51 |

Two numbers are tracked separately and the difference matters:

- **`rpEarned`** is lifetime and never falls. It is the **prestige level**, and it drives the tree's
  tier gates and the passive bonus.
- **`rp`** is the unspent balance. Spending it buys tree nodes and spec levels; spending never
  reduces the prestige level.

Passive: **+0.5 % tower damage and +0.5 % pointer damage per prestige level**, additive with the
spec tracks and uncapped. At level 60 that is ×1.3.

### 12.2 Spec tracks

The four original tracks survive, repriced from a flat one point per level to a curve:

```
cost(level) = ceil(2 * 1.28^level)
```

| Spec | Effect per point | Cap |
|---|---|---|
| **CPU** | +2 % tower damage | 20 |
| **RAM** | +5 starting salvage | 20 |
| **GPU** | +2 % pointer damage | 20 |
| **Disk** | +1 starting integrity | 10 |

Cost to take CPU from 0 to 20 is 1,000 RP, and the whole tree is priced against that scale: a player
who reboots regularly should own most of the tree by prestige 70 and finish the spec tracks around
level 100. If that reads as a grind in human play, cut the exponents rather than raising payouts.

### 12.3 The Restore tree

Nodes are permanent once bought: they survive every later reboot and are never spent again. Each
tier unlocks at a prestige level, so a new player sees five greyed rows and one lit one.

| Tier | Unlocks at level | Node | Cost | Effect |
|---|---|---|---|---|
| 1 | 0 | **Loose Change** | 4 | +200 starting salvage |
| 1 | 0 | **Spare Slot** | 5 | +2 starting integrity |
| 1 | 0 | **Fast Boot I** | 5 | runs begin at wave 3 |
| 1 | 0 | **Warm Cache** | 6 | +10 % tower damage |
| 1 | 0 | **Steady Hand** | 6 | +10 % pointer damage |
| 2 | 8 | **Auto-login** | 6 | auto-wave is on by default |
| 2 | 8 | **Preload** | 10 | the run starts with two free Gun towers |
| 2 | 8 | **Fast Boot II** | 12 | runs begin at wave 8 |
| 2 | 8 | **Cooling Loop** | 12 | repairs are 25 % faster |
| 2 | 8 | **Bulk Discount** | 14 | towers cost 8 % less |
| 3 | 20 | **Safe Mode** | 18 | +5 integrity, but −10 % Restore Points earned |
| 3 | 20 | **Blue Screen** | 18 | +25 % Restore Points earned, but −5 integrity |
| 3 | 20 | **Bulk Discount II** | 22 | a further 7 % off (15 % total) |
| 3 | 20 | **Fast Boot III** | 25 | runs begin at wave 15 |
| 3 | 20 | **Early Access** | 30 | every tower is unlocked at wave 1 |
| 4 | 40 | **Hot Swap** | 30 | selling refunds 90 % instead of 70 % |
| 4 | 40 | **Windows Update** | 35 | each reboot banks one extra spec point |
| 4 | 40 | **Fast Boot IV** | 45 | runs begin at wave 25 |
| 5 | 70 | **Restore Point** | 60 | the run starts with 10 % of the last run's salvage |
| 5 | 70 | **Fast Boot V** | 80 | runs begin at wave 40 |
| 5 | 70 | **New Game+** | 90 | towers are placed at tier 2 |

**Safe Mode and Blue Screen are mutually exclusive.** The tree is otherwise additive. Every node is
one boolean in the save and one branch at run creation; a node that cannot be described as a single
number at `createRunState` does not belong in the tree.

### 12.4 What a fast boot must not break

- **Achievements gated on waves still fire.** Starting at wave 40 must not silently grant "reach wave
  20" style achievements for waves the player never played. Wave-progress achievements compare
  `bestWave`, which is only written from waves actually cleared.
- **The wave hash is untouched.** Starting at wave N is a `state.wave = N` at creation; wave
  composition for a given number does not depend on how the player got there.
- **Cheated runs still record nothing,** including Restore Points.
- **The first run is unchanged.** With no tree and no specs, `rp = 0`, `rpEarned = 0`, and every
  effect is identity.

---

## 13. Art direction

**The field is a desktop; the towers are icons; the OS is the interface.** Played straight — no irony
about the era, no CRT filter, no retro winking. The Windows look is the game's world, not a costume.

### 13.1 Palette

| Token | Hex | Use |
|---|---|---|
| desktop | `#008080` | the world outside the window |
| face | `#c0c0c0` | panels, tiles, buttons |
| light | `#dfdfdf` | bevel light, path dashes |
| highlight | `#ffffff` | bevel top-left |
| shadow | `#808080` | bevel bottom-right, path fill |
| dark | `#000000` | outlines, text |
| title | `#000080` | title bars, selection |
| teal | `#008080` | Gun |
| maroon | `#800000` | Cannon |
| olive | `#808000` | Taser |
| heal green | `#00a000` | Repair |
| grey-blue | `#406080` | Armoured |
| amber | `#806000` | Saboteur's fuse spark |

Enemies are drawn in a single grey/blue family (blue-grey from `#27495d` to `#6b8598`): shape and
outline carry identity, colour only shades it.

Fixed art — enemies, towers, branch marks and the board — ships as SVG files (see §13.6); everything
else is a vector drawn at runtime. No sprite sheets, no external fonts. The whole game weighs less
than one photograph and scales to any DPI.

### 13.2 Shape grammar

Shape carries meaning before colour does — readability, and colour-blind players:

| Thing | Shape |
|---|---|
| Grunt | small circle with a 1 px inner dot |
| Runner | narrow triangle pointing along its heading, with two short streaks behind it |
| Shielded | circle inside a dimmer hexagonal ring |
| Flyer | circle with two swept wings and an elliptical shadow on the tile below it |
| Armoured | square with four corner rivets and a thicker 2 px outline |
| Saboteur | diamond with a small fuse spark at the rear corner |
| Breacher | rounded square with a jaw-notch cut into the leading edge and three teeth |
| Pop-up | Win95 window with a title bar and close box |
| Gun | small square with a barrel |
| Cannon | circle with a thick barrel |
| Taser | diamond with a coil |
| Frost | hexagon with a snow cross |
| Laser | long bar |
| Beacon | ring with a dot |
| Repair | ring with a white cross |
| Wall | Windows push button — raised, pressed, or disabled, with Bulwark's inner rim and Mesh's crosshatch |

### 13.3 Type and layout

Tahoma / MS Sans Serif. The type scale is **13 px** for body text, list rows and tooltips,
**11 px** for section labels, small rows and stats, and **10 px** for the tiny board labels, with
floating damage numbers at 12/16 px. Chrome geometry is derived from one window rect: title bar 22,
menu bar 22, client well, status bar 22, all inset 2, with two 168 px side panels flanking the board.

### 13.4 Motion

Short and mechanical, measured in ticks at 60 Hz:

| Event | Length |
|---|---|
| muzzle flash | 2 ticks, weapon-shaped: a wedge (gun), a puff (cannon/frost), a cross-spark (laser), an arc flicker (taser), nothing (beacon) |
| tracer | 6 ticks |
| hit spark | 3 short lines from the impact for 4 ticks; shielded (and the Bastion) show a shield arc instead |
| knockback | a 1 px nudge along the shot direction, decaying over 3 ticks (cosmetic only) |
| shield hit | cyan arc at the impact (8 ticks) plus a cyan `SHD` floater (30 ticks) |
| death | 6 ticks: a ring that expands and fades, with 3 small pieces |
| ad appear | 6 ticks, snapped, no easing |
| damage number | 30 ticks, rising 12 px, fading in the last 10, scaled by the size of the hit |

No tweening curves anywhere. Windows 95 did not ease.

### 13.5 Screen shake

Camera shake moves the whole window frame — chrome and board together — so the desktop itself shudders
rather than the play area sliding inside a static frame. It is a render-transform offset only: it never
touches hit-testing, the tooltip anchor, or the simulation, and its per-frame jitter is seeded from the
sim tick so a replay is identical.

| Trigger | Amplitude |
|---|---|
| boss death | 4 px |
| leak (costs integrity) | 5 px + a 60 ms freeze-frame |
| Toggle gate slams shut | 3 px |
| ad closed | 2 px |
| pointer crit | 1 px (2 px on a weak point or the mark) |
| tower goes offline (hit points run out) | 3 px |

Amplitude decays to nothing over about 200 ms and is hard-capped at 400 ms. A shake marks something
the player would say out loud — a boss falling, a leak, a gate slamming, a crit landing, a tower going
dark — never the dozens of ordinary deaths and hits that happen every wave. Those pop and spark
instead. A **Screen shake** toggle in the View menu persists in the profile like sound and volume, and
defaults **off** for users who prefer reduced motion (`prefers-reduced-motion: reduce`).

### 13.6 Art pipeline (see also `docs/ART-STYLE.md`, the visual style guide for artists)

Fixed art — enemy bodies, tower plinths and barrels, branch marks, the board tiles, combat effect
sprites (muzzle flashes, hit sparks, shield arcs, death rings) and the UI glyphs (the cursor, the
window controls, the check, the shutters) — ships as hand-editable SVG files under `public/art/`.

Because the cursor is drawn art, the OS pointer is hidden over the game (`cursor: none !important`
on `#app` and its canvas, since Pixi re-applies an inline cursor when it wires up events). A tower's
own cursor is drawn at the same 16 px as the player's, so the field never shows a miniature arrow
standing in for a real one.
What stays code is the geometry that depends on state: window chrome and bevels, buttons, panels,
ads, health bars, range rings, shields, route dots, damage numbers, tooltips, menus and dialogs are
composed per frame from state and have no fixed form to hand over.

`src/view/art.ts` holds the manifest of every asset, fetches each SVG once, decodes it into an `Image`,
and rasterises it into an offscreen canvas at the exact device-pixel size the sprite needs, so the
vector stays crisp at any DPI. A missing or malformed file logs a warning and falls back to the
procedural drawing for that kind, so a half-finished art pass degrades instead of crashing. The
naming table, the 32×32 viewBox rule, the base/turret layer rule and the turret pivot convention are
documented in [`public/art/README.md`](../public/art/README.md), which is the handover an artist works
to.

The load is asynchronous and does not block the first frame: the board draws the procedural fallback
until the SVGs decode, then the completion signal invalidates its cached art and the next frame
re-reads the texture lookup, so the SVG art appears without a resize. A device-pixel-ratio change
re-rasterises through the same invalidation path, dropping the cached textures and redrawing crisp at
the new density.

---

## 14. Audio

Generated with WebAudio oscillators and noise buffers, so the build stays asset-free.

| Sound | Design |
|---|---|
| Gun | short noise click, 60 ms |
| Cannon | low sine thump, 140 ms |
| Taser | 200 Hz buzz, 90 ms |
| Laser | descending sweep, 120 ms |
| kill | two-tone blip, rising with the combo |
| leak | the Win95 "ding", because the joke is right there |
| ad | short chirp, distinct from kills |
| ad close | coin |
| wave start / clear | two-note fanfare, 400 ms |
| hover | nothing. Silence is part of the aesthetic |

One master volume, remembered in `localStorage`. No music at launch.

---

## 15. UX and onboarding

- **First sixty seconds:** the game starts in build phase with 60 salvage, the status bar says *"Pick
  a tower, then click a tile"*, and the Gun button pulses once. No modal, no text wall.
- **Errors are explained where they happen.** Placing on the path, sealing the route, insufficient
  salvage — each has its own status-bar sentence.
- **Legible at a glance:** route length, integrity, salvage, wave, kills by source.
- **Pause** on `P`, **×2 fast forward** on `Space` once wave 1 is cleared, **×3** after wave 50.
- **No confirmation dialogs.** Selling is reversible by rebuilding.
- Keyboard: `1–9` select a tower, `Esc` cancels, `Enter` starts the wave.

### 15.1 Boss bars

When a boss is on the field it announces itself the way a Minecraft boss does: its name across the top
of the field, with a bar under it, so a player always knows which enemy is the boss and how much is
left. The name is the boss's, uppercased and letter-spaced; under it sits a **health bar** (a near-black
track with a deep-red fill and a pale "damage lag" segment that drains to the true value over about
400 ms), and a **shield bar** above that (cyan) when the boss has one. A Bastion's shield bar is
**segmented per layer** — three segments, one per remaining layer, with stripped segments left as a dim
outline so the player can see what is left.

The bars sit in a **panel pinned to the top of the window**, centred over the field: it starts at the
window title strip and grows down into the menu strip, and it is clamped so its last row stops above
`client.y` — the field's first row of pixels. Nothing it draws can sit on a tile, which is the point:
the old placement floated the bars over the top rows of the board. The panel is a raised grey face
around a sunken near-black well, matching the chrome, and its text is white on that well so it stays
legible whatever the field behind it is doing. It is at most `min(460, fieldWidth − 16)` wide, so it
never touches the board edges.

Rows are laid out name-then-bars: an 11 px name line, then the shield bar (4 px) and the health bar
(5 px), 20 px per boss. Up to **three** bosses are tracked, ordered by spawn time; a fourth drops the
oldest rather than shrinking the rest. How many rows actually appear depends on the chrome height —
at 1280×720 the title and menu strips hold two rows — and a boss that does not fit is tracked but not
drawn. A row appears over 150 ms and fades out 600 ms after its boss dies or leaves. The first-appearance
subtitle is drawn right-aligned on the name line, in grey, so it costs no extra height.

The **first time a boss type appears in a profile** the bar is the teaching moment: the frame flashes
once, the name carries a `NEW` tag for 2.5 s, and a one-line subtitle names the gimmick in plain words —
the Sergeant *shrugs off damage*, the Pacer makes *anything near it keep pace*, the Bastion wears
*three layers of shielding*. Later appearances show the bar with no flourish. With screen shake off
(`prefers-reduced-motion`) there is no flash and no drain — the bar shows the true value.

These are **runtime chrome**, not SVG assets: their geometry is state-driven (which bosses are alive,
their hp and shield), so there is no fixed form to hand over.

---

## 16. Technical

| Concern | Decision |
|---|---|
| Language | TypeScript, strict, `noUnusedLocals`, `noUnusedParameters` |
| Renderer | PixiJS 8, WebGL/WebGPU, fixed art as SVGs rasterised to sprites, runtime effects through `Graphics` |
| Resolution | `devicePixelRatio` is read live and re-applied on ratio change (display move, OS scale, browser zoom), so the backing store stays `round(css × dpr)` and text re-rasterises crisp |
| Bundler | Vite 8, `base: /pointer-defense/` |
| Hosting | GitHub Pages, `.github/workflows/deploy.yml` on push to `main` |
| Simulation | fixed 60 Hz accumulator; rendering interpolates; the sim never sees a frame delta |
| Determinism | no `Math.random` in the sim: a seeded PRNG in state, seeded per run. The AA's missile launch directions are drawn from the same seeded stream, keyed by `(tick, tower id, salvo index)`, so they never touch the run's crit stream |
| Projectiles | the AA's Flak shells and missiles are real sim entities, not hitscan: `Projectile { id, kind, x, y, vx, vy, targetId, damage, lifetime }`, ticked with the fixed 60 Hz timestep and removed on hit or expiry |
| Persistence | one `localStorage` key, `pointer-defense/save`, versioned, schema-checked on load |
| Structure | `src/core` pure and testable; `src/view` draws only; `src/input` translates |
| Tests | `npm run smoke`: core scenarios, determinism at 23/60/144 Hz, and a balance harness |
| Performance | 60 fps with 400 enemies and 60 towers on integrated graphics; the sim budget is 4 ms/tick |

The **balance harness** matters more than the rest of the tests: a headless scripted player — builds
greedily, clicks at a fixed rate, reboots at wave 60 — printing leaks, salvage and route length per
wave across five scenarios (standard, a no-support control, the early-call run, an all-at-once call
stress test, and the 25/50/75% early-call sweep, §8.5). Balance changes are judged by its output, not
by feel.

The scripted player also **repairs** like a player now. Between waves, once its normal build policy has
spent what it can, it repairs a non-wall tower that is offline or below 35% HP — the most valuable one
first — paying out of the salvage it cannot otherwise spend and never touching a wall. A repair takes
the tower off the field, so it is never started mid-wave; the reserve guard keeps enough salvage for
the next tower the bot still wants. Without this the Breacher's turret compounds into a death spiral a
human would simply repair out of.

---

## 17. Production order

| Version | Scope | Exit criterion |
|---|---|---|
| 0.2 | mazing, flyers, route length in the HUD | a detour wall measurably lengthens the route and cannot be sealed |
| 0.3 | towers 4–6, branches, selling | two players build visibly different boards |
| 0.4 | ads, combo, achievements, prestige | a run can end in a reboot that makes the next one faster |
| 0.5 | waves 11–100, bosses, modifiers, endless | the harness clears 100 waves with zero leaks on a good build and fails a bad one |
| 0.6 | audio, motion polish, onboarding | a first-time player starts wave 1 without being told anything |

---

## 18. Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| **Mazing makes balance fragile** | one wall can double the route | harness; visible route length; blocked tiles cap the extremes |
| **One half dominates** | the hybrid collapses into one genre | kill attribution is the tuning dial; the harness reports tower vs pointer damage share |
| **Clicking fatigue** | the clicker half becomes a chore by wave 50 | the combo rewards aiming; stage 4 hands the mouse back |
| **Ads are annoying** | an interrupt becomes a penalty | 8 s lifetime, one at a time, never in build phase, never on a quiet board |
| **Numbers get silly** | 1.4e9 reads as noise | abbreviate above a million, never below; wave 100 lands around 10⁵–10⁶ |
| **Prestige feels like losing** | the reboot punishes the player | specs are visible immediately and the first upgrade is affordable after one reboot |

---

## 19. Open questions, with the default I would ship

| Question | Default |
|---|---|
| One map or several? | four authored maps ship; the level id is chosen before wave 1 and carries through the run |
| Co-op? | no. A shared board with two pointers is a different game |
| Mobile? | no. Mazing and clicking both want a mouse |
| Leaderboard? | no server; a local best-run table only |
| Daily challenge? | after 0.6: one seeded run per day, same board and waves for everyone |
| Selling during a wave? | yes, 70 %, and it re-paths immediately |

---

## 20. Main menu, the map editor, and the `PD2.` share code

The game is serverless, so the whole exchange between Sydney (authoring maps) and the shipped game
must fit in a string a person can paste into a chat message. Three pieces, in order: a menu that makes
the editor reachable, an editor that produces a valid `Level`, and a codec that turns that level into a
short share code and back.

### 20.1 Main menu

A screen shown on load, before a run starts, in the same Windows 95 chrome as the rest of the game.
Three raised buttons, with keyboard equivalents:

| Button | Key | What it does |
|---|---|---|
| **Play** | `Enter` or `P` | the existing game, exactly as it is today — a fresh run, no behaviour change |
| **Editor** | `E` | the map editor (§20.2) |
| **Load code** | `L` | a text field: paste a `PD2.` code, validate it, play it immediately |

The load-code dialog has its own status line. Errors appear there in plain words — *"that code is from
a newer version"*, *"no route from start to exit"*, *"that code is incomplete"* — never a stack trace
and never silently nothing. A bad code starts nothing.

The profile remembers the last choice, so a returning player lands where they left off; a fresh
profile defaults to **Play** (a run starts at once, unchanged from before this feature). `Esc` from a
run returns to the menu; a run started by the editor's **Test** button returns to the editor instead,
drawing intact.

### 20.2 The editor

The same 20 × 12 board and the same cell size as play, so what you draw is what you play. A palette on
the left, the board on the right, a toolbar underneath, and a status line that names the first
validation problem as you draw — before you press anything.

Palette (single-click select, drag to paint, right-click erases):

| Tool | Paints |
|---|---|
| Floor | buildable floor |
| Wall | terrain wall (`#`), not buildable, not walkable |
| Shutter | a toggle wall; click it again to edit `periodTicks` / `openTicks` / `phaseTicks` in small numeric steppers |
| Start | exactly one; painting a second moves it |
| Exit | exactly one; same rule |
| Eraser | floor |

Toolbar: **Undo** / **Redo** (at least 50 steps), **Clear**, **Test** (starts a run on the drawing,
with a way back that keeps it), **Copy code** (writes the share code to the clipboard).

Constraints are enforced while you draw, not after: exactly one start, exactly one exit, at most
`MAX_TOGGLES` shutters, and **a route must exist from start to exit through floor and open shutter
tiles**. The editor reuses `validateLevel` and the pathfield code — it does not carry a second answer
to "is this map legal". If `validateLevel` cannot express a case, it is extended there so the game and
the editor always agree.

### 20.3 The `PD2.` codec

A share code is `PD2.` followed by the base64url of a byte string, no padding. Every multi-byte field
is little-endian. This table is the contract the artist and Sydney use, and it matches the code
exactly:

| Byte(s) | Field | Type |
|---|---|---|
| 0 | version | `uint8`, always `2` |
| 1 | `cols` | `uint8` |
| 2 | `rows` | `uint8` |
| 3 … 3 + ⌈cols·rows/4⌉ − 1 | bitfield | 2 bits per tile, 4 tiles per byte, row-major, low 2 bits first; `0` floor, `1` wall, `2` shutter, `3` reserved |
| next 2 | start `col` | `uint16` |
| next 2 | start `row` | `uint16` |
| next 2 | exit `col` | `uint16` |
| next 2 | exit `row` | `uint16` |
| next 1 | shutter count | `uint8` |
| next 10 × count | per shutter: `col`, `row`, `periodTicks`, `openTicks`, `phaseTicks` | each `uint16` |
| next 1 | name length (bytes) | `uint8` |
| next length | name | UTF-8, printable characters, at most 24 bytes |
| last 1 | checksum | `uint8`, `sum of all preceding bytes mod 251` |

Design rules:

- **version** — byte 0 is `2`. A `PD1.` code or a version above `2` fails with a plain message, never
  a parse error.
- **dimensions** — `cols`/`rows` are carried so the format is not welded to 20 × 12; the current game
  only accepts the 20 × 12 board and rejects other sizes as a newer version.
- **bitfield** — one tile per 2 bits, row-major, 4 tiles per byte, padded at the end. `3` is reserved
  and rejected as a newer version.
- **start / exit** — `col, row` pairs, exactly one each.
- **shutter table** — a count, then per shutter `col, row, periodTicks, openTicks, phaseTicks`, each
  `uint16`. Durations are whole ticks, matching `LevelToggle`.
- **name** — length-prefixed UTF-8, capped at 24 bytes and sanitised to printable characters. A name
  is a convenience, never a reason to reject a map.
- **checksum** — one byte, the sum of all preceding bytes mod 251, so a truncated paste is rejected
  with *"that code is incomplete"* rather than producing a corrupted map.

Round-trip is exact: `decode(encode(level))` reproduces every shipped map and a generated fixture, and
an empty 20 × 12 map codes to under 110 characters. `LEVELS` in `src/core/levels.ts` keeps its four
maps untouched; the loader accepts a custom `Level` produced by the codec with the rest of the sim
unchanged. A smoke test decodes a fixed, hand-written code string and asserts the exact level it
produces, so the format has a frozen example.

---

## 21. The Help viewer

The menu bar's **Help** menu gains a **Show Help** item. It opens a fixed Windows 95 window styled like
the CHM help viewer — a draggable title bar, a close box, a contents tree on the left, a page on the
right, a toolbar strip and a status line. It is a *viewer*, not a pause: the game clock keeps ticking,
the run keeps going behind it, and it never stops a wave.

### 21.1 Window behaviour

- **One instance.** Choosing Show Help again focuses the open window; it never opens a second.
- **Draggable by the title bar**, clamped so it can never be dragged fully off the client area. It
  opens centred the first time and keeps its position for the session. It is a fixed window — no
  resize, honest about being a viewer.
- **A working close box** in the title bar, and Escape closes it while it has focus. Escape unwinds in
  order: a modal dialog or an open dropdown first, then the help viewer, then the run itself.
- **Layering.** It sits above the board and the HUD, below the modal dialogs (Restart Windows, New Run)
  and below an open desktop ad. Clicks inside the window never reach the board, the HUD or the palette;
  clicks outside it do, so the game keeps running behind it.

### 21.2 Shape

- Win95 chrome: a 22 px title bar with the game's own border, a raised toolbar strip under it, a sunken
  tree panel on the left and a sunken page panel on the right, and an 18 px status line at the bottom.
- Toolbar: **Contents** (returns the tree to its collapsed top), **Back** and **Forward** over visited
  pages. Only a control that works is drawn — Back and Forward grey out when there is nothing to visit.
- Tree rows are 18 px, 11 px text, with the standard expand/collapse brackets for chapters. The selected
  row uses the Win95 selection (dark blue fill, white text).
- Page text is 11 px, wraps to the panel width, with a heading and short paragraphs. No scrolling: a
  page that would overflow is shortened instead.

### 21.3 Content and gating

Content is authored as data in `src/content/help.ts` — `{ id, title, category, gate, body }` where
`body` is an array of short paragraphs or bullets. The five chapters are **Getting started** and
**Mechanics** (always available), **Enemies** (one page per ordinary kind), **Bosses** (one page per
variant plus one general page) and **Towers** (one page per kind, stating its cost, range, damage, fire
interval, branches and what it is for).

Pages state **how the thing works and how to answer it**, never what is coming later. The numbers are
read from the balance tables in `towers.ts` / `enemies.ts`, not retyped, so a rebalance updates the
Help text for free.

The gates:

- **Tower pages** unlock when the player has ever unlocked the tower — `Profile.bestWave` against
  `towerUnlockWave(kind)` — so a tower seen in an earlier run stays readable after a restart.
- **Enemy pages** unlock when that enemy has been encountered — spawned on the field in any run, at
  least once. `Profile.seenEnemies` persists it the same way `seenBossKinds` does (capped, validated on
  load, bosses included).
- **Boss pages** unlock on first encounter with that variant. `seenBossKinds` is the single source of
  truth, reused by the boss bar's NEW tag, so the help gate and the boss bar cannot disagree. The one
  general "Bosses" page waits for the first boss encounter.
- **Locked rows are greyed out, labelled `Undiscovered`, and unselectable.** They never reveal the name
  — a greyed "Carrier" would be a spoiler with the serial numbers filed off. The chapter stays visible
  so the player can see there is more to learn; clicking a locked row does nothing and the status line
  says why (`Encounter this enemy to learn about it`).
- **Mechanics and Getting started are never locked.**

`Profile` gains `seenEnemies` only; nothing else is bumped. An older save without the field loads
cleanly and simply starts with everything locked that is not currently on screen.

### 21.4 Help, not spoilers — policy

The point of this window is to explain a mechanic the player has **already met**, not to preview what
is coming. Every gate exists to protect that: enemy and boss pages wait for an encounter, tower pages
wait for an unlock, locked rows hide the name, and the always-available pages never name an enemy,
boss or tower the player has not seen. This is the standing rule for any future Help page.
## 22. Cheats

A testing tool for reaching any state without grinding. It is deliberately visible now and hidden
behind an easter egg before public release, so it is built switchable from the start: one constant in
`src/core/cheats.ts`, `CHEATS_VISIBLE`, gates the whole feature. Every read goes through
`cheatsEnabled()`; flipping the constant to false removes the menu word, disables the shortcuts and
hides every trace of cheats without touching the rest of the code.

The **Cheats** menu word sits between View and Help. Its dropdown holds:

- **God Mode** — a checkable row. While on, integrity never falls (leaks still walk the lane, they
  just cost nothing, so the HUD keeps showing the real value) and salvage is topped up to a large
  ceiling before it is spent, so any purchase can be repeated forever.
- **Spawn** — a second column listing every enemy kind and every boss variant. Clicking one spawns it
  immediately at the spawn tile with the current wave's scaling, exactly as the wave had released it;
  pop-ups are included, and a cheated boss still runs the boss bar, its first-appearance NEW tag and
  `seenBossKinds`.
- **Kill All** — empties the field instantly, awarding no salvage and no achievement progress. It does
  not advance the wave: the schedule keeps running, so a wave can be killed and the next one allowed to
  come.

Keyboard shortcuts exist so testing is not a menu marathon: **Ctrl+Shift+G** toggles God Mode and
**Ctrl+Shift+K** kills all. Both read the same gate.

A run in which any cheat was used is **flagged**: no achievements fire, no `bestWave` update is
recorded, the status line shows `Cheats active — this run will not be recorded` once when the first
cheat is used, and a small CHEATS marker stays in the status line while it is active. Nothing is
persisted — the flag dies with the run. With cheats off, the simulation is byte-identical and the
wave 1–100 balance hash is unchanged.

---

## Appendix A — What four games got right

**Desktop Tower Defense** (Paul Preece, March 2007) — the path is not fixed; creeps take the shortest
route and towers block, so placement is a spatial decision as well as a purchase. It refuses to let you
seal the exit, sends flyers that ignore the maze, and its challenge modes test maze craft rather than
damage numbers. *We take mazing.*

**Bloons TD** — mutually exclusive upgrade paths, so the same tower becomes a different tower. In BTD6
there are three paths, two may reach tier 2, and only one may go beyond. *We take exclusive branches at
tier 3.*

**Cookie Clicker** (Orteil, 2013) — the exponential is the point, and two systems carry the long game:
prestige, which converts a finished run into a permanent multiplier, and golden cookies, rare timed
bonuses that reward attention without demanding it. *We take both, as Restart Windows and desktop
ads.*

**Sanctum** (Coffee Stain, 2011) — the first FPS/TD hybrid, with deliberately weak shooting: towers do
the damage and the player patches leaks and snipes priority targets. *We take the proportion: the
pointer is precision, not bulk DPS.*

---

## Appendix B — Where the build stands

| # | Deliverable | Proof |
|---|---|---|
| M0 | repository, toolchain, Pages deployment | done — the site loads |
| M1 | grid, one enemy, one tower, one wave | done — enemies walk and die |
| M2 | salvage economy, build phase, three towers | done |
| M3 | clicking, kill attribution, pointer upgrades | done — `npm run smoke` proves the 1.5× rule |
| M4 | Windows chrome, three-column layout | done |
| M5 | mazing, flyers, route length | done (0.2) — probe: 22 tiles open, 28 behind a wall, seal refused |
| M6 | six towers, branches, selling | done (0.3) — six towers, five tiers, exclusive tier-3 branches, 70 % refund |
| M7 | ads, combo, prestige | done (0.4) — weak points, ×2 combo, six ads with a Blue Screen trap, specs, ten achievements, save |
| M8 | waves 11–100, bosses, modifiers, endless | done (0.5) — generated from the wave number, bosses at 10/25/50/75/100, modifiers from 51, victory and endless |
| M9 | audio, polish, onboarding | done (0.6) — WebAudio sfx, pause, ×2/×3 speed, first-run hints |
| M10 | controls, targeting, player docs | done (0.7) — keys 1-6/Esc/U/X/Enter, per-tower targeting, README |
| M11 | every tower earns its slot | done (0.8) — retuned against the harness; a no-support control run dies at wave 40 |

### What is not built

- **Map authoring beyond the four shipped maps.** The Corridor, Dumbbell, Open Field and Turnstile
  ship; more maps are content, and a new board should change the spawn geometry rather than the palette.
- **Save mid-run.** The profile persists; a run in progress does not. Reloading restarts the wave you
  are on.
- **Touch input.** Mouse and keyboard only.
- **Difficulty selection.** The curve is the curve; prestige is the difficulty knob.
