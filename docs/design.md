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
- **Spawn** on the left edge, **exit** on the right edge, both on row 6.
- Roughly ten **blocked** tiles: desk objects sitting on the field, impassable and never buildable.
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
Flyers are purple chevrons with motion ticks, and the next-wave preview names them.

---

## 6. Towers

Six towers. Each has a role, a tier ladder, and **two exclusive branches** at tier 3.

### 6.1 The six

| Tower | Cost | Range | Damage | Interval | Role | Wants |
|---|---|---|---|---|---|---|
| **Gun** | 25 | 2.6 | 3 | 0.50 s | cheap single-target backbone | the longest stretch of route it can reach |
| **Cannon** | 90 | 3.0 | 5 + splash 1.0 | 1.60 s | clusters and corners | where the maze doubles back |
| **Taser** | 80 | 1.6 | 1, ignores armour | 0.12 s | armour, speed, close work | the inside of a hairpin |
| **Frost** | 70 | 2.2 | 1, slows to 30 % speed for 3.0 s | 0.60 s | utility | in front of the damage |
| **Laser** | 70 | 3.4 | 11, pierces 8 | 0.80 s | straight lines | corridors you deliberately left open |
| **Beacon** | 90 | 3.5 | none | — | +60 % damage to towers in radius | a dense cluster worth buffing |

Four damage answers and two that are useless alone. That is how placement stays interesting without
becoming opaque.

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

### 6.3 Branches

| Tower | Branch A | Branch B |
|---|---|---|
| Gun | **Marksman** — +60 % range, +80 % damage to its current target | **Repeater** — double fire rate, −1 damage |
| Cannon | **Mortar** — +1 splash, +50 % damage, −25 % fire rate | **Flak** — air only, triple fire rate, double damage to flyers |
| Taser | **Arc** — chains to 3 targets | **Overload** — +150 % damage to shielded enemies |
| Frost | **Deep Freeze** — 60 % slow for 2.5 s | **Shard** — no slow; damage ×4, splash 0.6 |
| Laser | **Focus** — pierce 8, +50 % damage | **Prism** — splits into 3 short beams at −40 % damage |
| Beacon | **Command** — +30 % damage aura, no range bonus | **Relay** — extends pointer reach, +50 % pointer damage in radius |

The tensions are deliberate. Mortar or Flak is "ground or air". Command or Relay is "your towers or
you" — the one place the pointer gets a tower's help, and the reason a clicker-minded player and a
tower-minded player build different boards from the same pieces.

### 6.4 Selling

Refund **70 %** of everything spent, rounded down. Selling is how mazing recovers from a mistake, so it
has to stay cheap enough to actually use.

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

Armour is **flat subtraction** on tower hits, floored at 1. Clicks ignore armour entirely. Shields
absorb tower damage completely until broken, and only the pointer can break them. That is pillar 1
stated as arithmetic.

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
| Pressure | 6–20 | flyers, shielded, the first real maze |
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

---

## 9. The pointer

The OS cursor is hidden; a drawn arrow replaces it, hotspot at the tip.

### 9.1 Stages

| Stage | Name | Cost | Click damage | Effect |
|---|---|---|---|---|
| 1 | **Click** | — | 3 | a bare click |
| 2 | **Reticle** | 80 | 4 | hold to lock: 10 dps on the locked target |
| 3 | **Designator** | 220 | 5 | the marked target takes +25 % tower damage |
| 4 | **Drone** | 600 | 6 | auto-clicks the reticle target twice a second |
| 5 | **Swarm** | 1,600 | 8 | three drones; the player directs instead of clicking |

From stage 4 the hands leave the mouse. The swarm works, and what the player spends attention on
becomes targeting rather than rate — the idle promise kept honestly instead of an offline multiplier.

### 9.2 Precision

Every enemy carries a **weak point**: a 25 % arc on its leading edge, drawn as a small notch. Clicking
it deals **×2** damage and marks the kill for the 2× payout. Clicking elsewhere deals normal damage.
Missing does nothing and breaks the combo.

**Combo:** consecutive weak-point hits add **+10 %** each, capped at **×2**. Missing, or five seconds
without a hit, resets to ×1.

The combo is the clicker half's skill expression. It exists so that clicking is *aiming* rather than
*spamming* — the Sanctum lesson, applied to the mouse.

### 9.3 What the pointer is for

Precision and utility, not bulk damage. If clicks ever out-damage an equivalent spend in towers, the
design has failed: tower kills do the work, pointer kills pay the bonus.

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
| Shielded | hexagon with an outer ring while shielded |
| Flyer | chevron with two motion ticks |
| Armoured | square with a thick outline |
| Saboteur | circle with a spark |
| Boss | large hexagon with a double ring |
| Gun | small square with a barrel |
| Cannon | circle with a thick barrel |
| Taser | diamond with a coil |
| Frost | hexagon with a snow cross |
| Laser | long bar |
| Beacon | ring with a dot |

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
greedily, clicks at a fixed rate, reboots at wave 60, 80 and 100 — printing leaks, salvage and route
length per wave. Balance changes are judged by its output, not by feel.

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
| One map or several? | one board at launch; wallpapers reskin it, they do not change the layout |
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
| M5 | mazing, flyers, route length | in progress (0.2) |
| M6 | six towers, branches, selling | not started (0.3) |
| M7 | pop-ups, combo, prestige | not started (0.4) |
| M8 | waves 11–100, bosses, modifiers, endless | not started (0.5) |
| M9 | audio, polish, onboarding | not started (0.6) |
