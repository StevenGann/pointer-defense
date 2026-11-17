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

## 6. Towers

Eight towers. Each has a role, a tier ladder, and **two exclusive branches** at tier 3.

### 6.1 The eight

| Tower | Cost | Range | Damage | Interval | Turn rate | Targeting | Role | Wants |
|---|---|---|---|---|---|---|---|---|
| **Gun** | 25 | 2.6 | 3 | 0.50 s | 720°/s | player's choice | cheap single-target backbone | the longest stretch of route it can reach |
| **Cannon** | 90 | 3.0 | 5 + splash 1.0 | 1.60 s | 90°/s | strongest (fixed) | clusters and corners | where the maze doubles back |
| **Taser** | 80 | 1.6 | 1, ignores armour | 0.12 s | instant | closest (fixed) | armour, speed, close work | the inside of a hairpin |
| **Frost** | 70 | 2.2 | 1, slows to 30 % speed for 3.0 s | 0.60 s | instant | — | utility | in front of the damage |
| **Laser** | 70 | 3.4 | 11, pierces 8 | 0.80 s | 150°/s | first (fixed) | straight lines | corridors you deliberately left open |
| **Beacon** | 90 | 3.5 | none | — | — (still) | — | +60 % damage to towers in radius | a dense cluster worth buffing |
| **Wall** | 8 | — | none | — | — (still) | — | blocks the route, has hit points | a long maze made cheap |
| **Cursor** | 250 | 2.5 | ½ your click damage | 1.0 s | — (still) | shielded, then nearest (fixed) | an autonomous hand that clicks for you | a pointer ladder worth feeding |

Three towers are **locked** to one targeting mode and ignore the player's choice. The **Taser** always
fires at the nearest enemy in range — a Tesla coil discharges into whatever is nearest, so its
placement is the decision, not its priority. The **Laser** always fires at the leading edge of the
column, which reads correctly when its Focus beam pierces along that line. The **Cannon** always
swings at the strongest thing it can see and lives with its two-second traverse. The **Cursor** carries
its own fixed rule rather than one of the three named modes: it hunts shielded enemies first, then the
nearest enemy to its home tile (§6.7). The **Gun** stays fully configurable — it obeys the player — and
Frost and Beacon have no targeting mode to lock. **Manual Override** (§9.5), the player's explicit
mark, wins over every lock: while the marked enemy is in range, a locked tower fires at it, which is
the only way to aim a locked tower at something specific.

Four damage answers and three that are useless alone, plus the Cursor, which is a damage answer that
borrows its strength from the pointer ladder (§6.7). That is how placement stays interesting without
becoming opaque.

Walls are the asymmetry: every other tower is invulnerable and cannot be targeted, but a wall can be
destroyed and then it is gone for good. It carries 60 hit points at tier 1, 180 at tier 2 and 540 at
tier 3; the Bulwark and Mesh branches double that, while the Toggle branch keeps the base total and
pays in control instead. A destroyed wall is removed, the route is recomputed in the same tick, and
nothing is refunded.

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

### 6.3 Branches

| Tower | Branch A | Branch B |
|---|---|---|
| Gun | **Marksman** — +60 % range, +80 % damage to its current target | **Repeater** — double fire rate, −1 damage |
| Cannon | **Mortar** — +1 splash, +50 % damage, −25 % fire rate | **Flak** — air only, triple fire rate, double damage to flyers |
| Taser | **Arc** — chains to 3 targets | **Overload** — +150 % damage to shielded enemies |
| Frost | **Deep Freeze** — 60 % slow for 2.5 s | **Shard** — no slow; damage ×4, splash 0.6 |
| Laser | **Focus** — pierce 8, +50 % damage | **Prism** — splits into 3 short beams at −40 % damage |
| Beacon | **Command** — +30 % damage aura, no range bonus | **Relay** — extends pointer reach, +50 % pointer damage in radius |
| Wall | **Bulwark** — hit points doubled again | **Mesh** — hit points doubled and it blocks flyers |
| Cursor | **Overclock** — rate ×1.8, per-click damage ×0.6 | **Wide Search** — radius ×1.35, rate ×0.7 |

Walls are the one tower with a third branch: **Toggle** (`C`). A Toggle wall is a gate — left-clicking
it opens it (walkable, cannot be attacked, no ground block) or closes it (blocks exactly like a plain
wall); closing is refused when it would seal the route. A successful flip locks that gate for **3
seconds (180 ticks)** on the simulation clock; another flip while locked does nothing and the status
bar says *"Gate locked for 1.4 s"*, with the remaining lock in seconds. The lock is per gate, so two
gates can be flipped in turn. While a gate is locked it is drawn in the disabled wall style rather
than its live style, and its tooltip reads *"Gate locked — 1.4 s"*.

The tensions are deliberate. Mortar or Flak is "ground or air". Command or Relay is "your towers or
you" — the one place the pointer gets a tower's help, and the reason a clicker-minded player and a
tower-minded player build different boards from the same pieces.

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

A tower with hit points — today only the Wall — can be repaired. The mechanic is written tower-generic
so any future tower with HP gets it for free, but the Wall is its only customer.

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
the duration. While repairing, the wall draws with a hatched face and a small progress bar in place
of its health bar, and the route line shows it as walkable the moment the repair begins.

### 6.7 The Cursor tower

The **Cursor** is the one tower whose damage is not its own. It cannot fire; instead it carries a
second cursor — the classic white arrow — that wanders around its home tile and clicks enemies for
you. Every click deals **half the player's current click damage**, ladder and spec multipliers
included, and is treated as pointer damage: it ignores armour and wears shields down exactly as the
player's own clicks do. The tower's radius (2.5 → 3.5 → 4.5 tiles) and its click clock (1.0 → 1.6 →
2.2 clicks/s) are its only stats, and at tier 3 it branches into **Overclock** (more, weaker clicks)
or **Wide Search** (a wider reach, clicking less often).

The relationship is the point. The pointer ladder was a personal weapon; the Cursor makes it *board*
value. A click level that adds damage to your hand now adds half that to every Cursor on the field,
so the ladder is worth buying partly because of these towers — a clicker-minded player climbs the
ladder and a tower-minded player's Cursors still benefit, which is what keeps the two halves feeding
each other instead of drifting apart. Cursors never crit, never mark, and ignore held pointer, combo
and weak points: the ladder feeds them through click damage and nothing else.

A cursor's targeting is fixed, not a player choice. It clicks the nearest shielded enemy to its home
tile — a **Shielded** or a **Boss**, whose shield is above zero — and with no shielded enemy in radius
it clicks the nearest enemy to its home tile. An enemy hidden under a Pop-up window is never a
candidate. **Manual Override** (§9.5) still wins over this rule, exactly as it beats the Taser's lock:
while the marked enemy is in range and targetable, the cursor clicks it instead.

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
| **Boss** | 900 | 0.8 t/s | 0.55 | 6 | 120 | 120 | both halves: towers strip armour, pointer breaks the shield |
| **Breacher** | 55 | 0.6 t/s | 0.42 | 0 | 0 | 14 | walks into walls and breaks them — a gun in front of the wall, or walls behind walls |
| **Pop-up** | 60 | 0.7 t/s | 0.40 | 0 | 0 | 18 | click its close box — a window that shields every enemy under it from towers |

Armour is **flat subtraction** on tower hits, floored at 1. Clicks ignore armour entirely. Shields
absorb tower damage completely until broken, and only the pointer can break them. That is pillar 1
stated as arithmetic.

Shield damage is visible, not a silent clock: every enemy whose shield is above zero draws a cyan
shield ring whose alpha tracks the fraction remaining (a Boss entering at 120 reads as heavily
protected, one nearly stripped as faint), and every hit the shield absorbs pops a cyan `SHD` floater
with a short arc at the impact, so a fully absorbed click still shows something happening.

The pop-up window is a **spatial shield**, not a stat: any enemy whose centre is inside its rectangle
is untargetable by towers, and no tower damage — including flak bursts — reaches it while the window
lives. The pointer is unaffected and can still shoot those enemies; the window itself only dies when
its close box is clicked, which pays the normal salvage and releases whatever it was covering.

If an enemy could be answered equally well by either half, it is not doing its job.

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
| Siege | 61–80 | boss at 70, dense flyer waves |
| Endgame | 81–100 | everything, modifiers stack, boss at 100 |

Boss waves at **10, 25, 50, 75, 100**. A boss is one large enemy plus escorts and does not pause the
wave timer.

### 8.3 Scaling

```
hpScale(w)    = 1 + 0.18·(w−1)          for w ≤ 20
              = 4.42 · 1.015^(w−20)     for 20 < w ≤ 60
              = 8.02 · 1.001^(w−60)     for w > 60
valueScale(w) = 1 + 0.06·(w−1)          for w ≤ 50
              = 3.94 · 1.012^(w−50)     for w > 50
```

HP outgrows value on purpose. The curve bends twice: it steepens through the Specialists and Attrition
bands, then flattens past wave 60 so that one reboot's worth of specs is enough to carry a competent
player to wave 100. Without the reboot the same player runs out of integrity somewhere in the Siege band.

From wave 51 each wave takes one modifier from a small pool: **fog** (range −20 %), **no-build band**
(one row cannot be built on), **fast forward** (speed +15 %), **blackout** (salvage hidden until the
wave ends), **rush** (spawn interval −25 %, value +10 %).

### 8.4 Victory and endless

Clearing wave 100 grants victory and unlocks **endless**: procedural composition from a weighted pool,
scaling continues, modifiers stack. Endless exists for players who do not want to reboot yet.

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
recent wave started" (pop-ups and the bonus read it) and resets on every start, early ones included.

`startWave` is allowed from **build** (a normal call, no bonus) or from **wave** (an early call). It
is refused at wave 100 in a normal run. Starting increments the wave number, pushes a `WaveRun`, sets
phase to wave, resets `waveTick`, applies the new wave's modifiers and no-build row, and — on an early
call — pays the bonus.

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
bonus    = clamp(round(0.25 × waveKillValue(nextWave) × fraction), 5, waveKillValue(nextWave))
```

`waveKillValue(wave)` sums each enemy's base value scaled to that wave — the same per-enemy value
`createEnemy` assigns, so the bonus cannot drift from the economy. `nextWave` is the wave being called,
not the one currently running; `span` is measured from the wave that just started (the current one,
`nextWave − 1`). The 0.25 coefficient means a full-early call pays a quarter of the next wave's worth —
12 at wave 2, 162 at wave 30, 440 at wave 60, 1,272 at wave 100 — and later calls decay to a floor of
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
cost(level)  = round(120 × 1.95^level)   // buying level+1 from level
damage       = 4 × 1.25^level            // the reticle's base click, compounded
holdDps      = damage × 2.5              // so the reticle keeps pace with the click
ceiling(wave) = clamp(floor(wave / 8), 0, 12)
```

The 1.25 growth is a coarse, measured constant, not a fit. It lands the click at **~37 by
level 10** and **~58 by level 12** (against ~55 and ~93 under the old 1.30). It is not tuned any
further: the cost curve, crit chances and the marked multiplier stay as written.

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
  marked and plus 8 % when the click lands on the weak point. A crit pops a loud `CRIT` so a lucky
  streak is visible.

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

During a wave a **pop-up window** docks in the right panel column, at the top, with a title bar and a
close box. It is inset 6 px from the panel's left edge, spans the panel width less 12 px, is 54 px
tall, and stacks downward from the top of the panel. It lives **8 seconds**. Clicking its close box
dismisses it and pays.

| Pop-up | Weight | Effect |
|---|---|---|
| *Defrag complete* | 30 | +8 % of current salvage |
| *AutoUpdate* | 20 | towers +40 % damage for 10 s |
| *Time Zone Change* | 15 | enemies −50 % speed for 6 s |
| *Freeware* | 15 | a free Gun appears on a random buildable tile |
| *Screensaver* | 10 | all enemies take 25 damage and are briefly stunned |
| *Blue Screen* | 10 | a trap: dismissing pays nothing and disables a random tower for 3 s |

- At most **one** pop-up on screen at a time.
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
| pop-up | as listed in §10 |

| Sink | Amount |
|---|---|
| tower | §6.1 |
| upgrade | base × {0.9, 1.6, 2.9, 5.2} |
| pointer stage | §9.1 |
| sell | refunds 70 % |

Starting salvage **60** — two Guns or one Cannon. Starting integrity **20**; a leak costs 1, a boss
leak costs **3**. Integrity never regenerates: the run's mistake budget is spent, not healed.

---

## 12. Meta: Restart Windows

After wave 50 the player may **Restart Windows**. The run ends, the machine reboots, and progress
converts into **specs**:

```
specs = floor( sqrt( totalSalvageEarned / 500 ) )
```

Specs buy permanent upgrades, stored in `localStorage` next to the achievements:

| Spec | Effect per point | Cap |
|---|---|---|
| **CPU** | +2 % tower damage | 20 |
| **RAM** | +5 starting salvage | 20 |
| **GPU** | +2 % pointer damage | 20 |
| **Disk** | +1 starting integrity | 10 |

Twenty points is a ×1.4 multiplier. The walls are deliberately low: prestige is about *starting
better*, not about removing the game. Each reboot unlocks a new desktop wallpaper — a palette variant
of the same board, for the achievement wall.

**Achievements** (ten at launch, all cheap): first blood · a route over 50 tiles · a zero-leak wave at
40+ · 100 weak-point hits in one run · five tier-5 towers · a full board of Beacons · a boss killed by
the pointer alone · ten pop-ups in one run · endless wave 150 · reboot with 50+ specs.

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
| maroon | `#800000` | Cannon, Shielded |
| olive | `#808000` | Taser |
| purple | `#800080` | Runner, Flyer |
| grey-blue | `#406080` | Armoured |
| amber | `#806000` | Boss |

Everything is a vector drawn at runtime. No image assets, no sprite sheets, no external fonts. The
whole game weighs less than one photograph and scales to any DPI.

### 13.2 Shape grammar

Shape carries meaning before colour does — readability, and colour-blind players:

| Thing | Shape |
|---|---|
| Grunt | circle |
| Runner | triangle, pointing along its heading |
| Shielded | hexagon with a cyan outer ring while shielded (alpha tracks shield remaining) |
| Flyer | chevron with two motion ticks |
| Armoured | square with a thick outline |
| Saboteur | circle with a spark |
| Boss | large hexagon with a double ring |
| Breacher | square with a forward battering ram |
| Pop-up | Win95 window with a title bar and close box |
| Gun | small square with a barrel |
| Cannon | circle with a thick barrel |
| Taser | diamond with a coil |
| Frost | hexagon with a snow cross |
| Laser | long bar |
| Beacon | ring with a dot |
| Wall | Windows push button — raised, pressed, or disabled, with Bulwark's inner rim and Mesh's crosshatch |

### 13.3 Type and layout

Tahoma / MS Sans Serif, **11 px and 13 px only**. Chrome geometry is derived from one window rect:
title bar 18, menu bar 18, client well, status bar 18, all inset 2, left and right edges identical.

### 13.4 Motion

Short and mechanical, measured in ticks at 60 Hz:

| Event | Length |
|---|---|
| muzzle flash | 4 ticks |
| tracer | 6 ticks |
| hit flash | 3 ticks |
| shield hit | cyan arc at the impact (8 ticks) plus a cyan `SHD` floater (30 ticks) |
| death | 8 ticks, the shape collapsing to a point |
| pop-up appear | 6 ticks, snapped, no easing |
| damage number | 30 ticks, rising 12 px, fading in the last 10 |

No tweening curves anywhere. Windows 95 did not ease.

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
| pop-up | short chirp, distinct from kills |
| pop-up close | coin |
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
- Keyboard: `1–6` select a tower, `Esc` cancels, `Enter` starts the wave.

---

## 16. Technical

| Concern | Decision |
|---|---|
| Language | TypeScript, strict, `noUnusedLocals`, `noUnusedParameters` |
| Renderer | PixiJS 8, WebGL/WebGPU, everything through `Graphics` |
| Bundler | Vite 8, `base: /pointer-defense/` |
| Hosting | GitHub Pages, `.github/workflows/deploy.yml` on push to `main` |
| Simulation | fixed 60 Hz accumulator; rendering interpolates; the sim never sees a frame delta |
| Determinism | no `Math.random` in the sim: a seeded PRNG in state, seeded per run |
| Persistence | one `localStorage` key, `pointer-defense/save`, versioned, schema-checked on load |
| Structure | `src/core` pure and testable; `src/view` draws only; `src/input` translates |
| Tests | `npm run smoke`: core scenarios, determinism at 23/60/144 Hz, and a balance harness |
| Performance | 60 fps with 400 enemies and 60 towers on integrated graphics; the sim budget is 4 ms/tick |

The **balance harness** matters more than the rest of the tests: a headless scripted player — builds
greedily, clicks at a fixed rate, reboots at wave 60 — printing leaks, salvage and route length per
wave across five scenarios (standard, a no-support control, the early-call run, an all-at-once call
stress test, and the 25/50/75% early-call sweep, §8.5). Balance changes are judged by its output, not
by feel.

---

## 17. Production order

| Version | Scope | Exit criterion |
|---|---|---|
| 0.2 | mazing, flyers, route length in the HUD | a detour wall measurably lengthens the route and cannot be sealed |
| 0.3 | towers 4–6, branches, selling | two players build visibly different boards |
| 0.4 | pop-ups, combo, achievements, prestige | a run can end in a reboot that makes the next one faster |
| 0.5 | waves 11–100, bosses, modifiers, endless | the harness clears 100 waves with zero leaks on a good build and fails a bad one |
| 0.6 | audio, motion polish, onboarding | a first-time player starts wave 1 without being told anything |

---

## 18. Risks

| Risk | Why it matters | Mitigation |
|---|---|---|
| **Mazing makes balance fragile** | one wall can double the route | harness; visible route length; blocked tiles cap the extremes |
| **One half dominates** | the hybrid collapses into one genre | kill attribution is the tuning dial; the harness reports tower vs pointer damage share |
| **Clicking fatigue** | the clicker half becomes a chore by wave 50 | the combo rewards aiming; stage 4 hands the mouse back |
| **Pop-ups are annoying** | an interrupt becomes a penalty | 8 s lifetime, one at a time, never in build phase, never on a quiet board |
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
pop-ups.*

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
| M7 | pop-ups, combo, prestige | done (0.4) — weak points, ×2 combo, six pop-ups with a Blue Screen trap, specs, ten achievements, save |
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
