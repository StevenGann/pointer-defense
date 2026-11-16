# Pointer Defense — design

Status: pre-alpha, 2026-11-15. The document that the code is written against.

## The game in one line

Tower defense where clicking is the economy and towers are the time to click.

## The problem this design solves

Merging a tower defense game with a clicker usually breaks one half. Clicking scales like a clicker
and erases the towers; towers scale like a tower defense game and the player becomes decoration. Most
hybrids nerf one side until it is ornament.

The fix is a single rule: **every kill pays salvage, and it pays more if the player landed the blow.**

- No clicking means slow kills, which means late upgrades.
- No towers means no time to click, which means the wave reaches the end.

The player does not choose between building and clicking. They allocate attention between earning and
surviving, every wave, for the whole run.

## The pointer is a character

The cursor is the weapon and it upgrades in stages, which is where the clicker fantasy earns its
place:

| Stage | What the pointer is | Cost |
|---|---|---|
| 1 | a bare click | — |
| 2 | a targeting reticle: damage over time to whatever it is held on | cheap |
| 3 | a designator: marks a target so all towers hit it harder | moderate |
| 4 | a drone: clicks on its own, slowly | expensive |
| 5 | a swarm: the player directs instead of clicking | endgame |

By stage 4 the player's hands are leaving the mouse, and the idle promise is kept honestly rather
than faked with an offline multiplier.

## Enemies force both halves

| Enemy | Answer | Why |
|---|---|---|
| Swarm | towers | too many to click |
| Shielded | clicks | immune to tower fire until the shield is broken |
| Runner | clicks | outruns the towers |
| Armoured | towers | click damage is negligible |
| Boss | both | phases alternate which half can hurt it |

If an enemy could be handled equally by either half, it is not doing its job.

## Waves

100 waves to a prestige.

| Band | What changes |
|---|---|
| 1–10 | one lane, towers teach, clicking is a nudge |
| 11–30 | two lanes, first shielded enemy |
| 31–60 | three lanes, armour, the first real economy decision |
| 61–100 | all of it, plus modifiers: fog, no-build zones, fast forward |

Numbers get large. Abbreviate above a million, never below.

## Idle behaviour

- **Auto-defense** while the tab is closed or the player is idle: towers fight at a reduced rate and
  salvage accrues slowly, capped at four hours.
- **Live**: full rate, and the player handles what the towers cannot.

## Art direction

**Desktop Tower Defense** for the board: a clean top-down grid, readable silhouettes, everything
legible at a glance. **Windows 95** for the chrome: bevelled panels, a title bar per window, the
teal desktop, a status bar, MS Sans-style type.

Everything is vector, drawn at runtime with Pixi's Graphics API. No sprite sheets, no raster assets
except nothing. It scales to any DPI and the whole game weighs less than one photograph.

The joke is that the field is a desktop and the towers are icons. Windows that open, a title bar that
says where you are, a "Start"-shaped button that does something. It should feel like a 1997 program
that happens to be a defense game.

## Tone

Personal-computer era optimism, played straight. No irony about the era, no fake CRT filter, no
"retro" winking. The Windows look is the game's world, not a costume.

## Economy and pacing

| Wave | Salvage per kill | Notes |
|---|---|---|
| 1–10 | small | towers cost 2–3 waves of income |
| 11–30 | medium | the first choice between coverage and upgrades |
| 31–60 | large | pointer upgrades compete with towers |
| 61+ | huge | the numbers are the reward |

## Open questions

| Question | Default |
|---|---|
| Map | one fixed grid per run, hand-made, 20 × 12 |
| Placement | towers on tiles, and towers block the path |
| Lives | no lives; a leak costs income and a tower |
| Prestige | at wave 100, keeps a permanent multiplier |
| Mobile | no; mouse and keyboard |


## What four games got right, and what we take

### Desktop Tower Defense (Paul Preece, March 2007)

Fifteen million plays in four months, and the reason is one design decision: **the path is not
fixed**. Creeps take the shortest route to the exit, towers block, so every placement is a spatial
decision as well as a purchase. Preece built it because he thought tower defense games lacked proper
"mazing". The rest of the design follows from that: it refuses to let you seal the exit, it sends
flyers that ignore the maze entirely, and its challenge modes ("The 100", "3K Fixed") exist to test
maze craft rather than damage numbers.

**We take mazing.** It is the change that turns a placement checklist into a puzzle, and it makes the
two halves agree: a longer maze is more time to click.

### Bloons TD

Each tower has upgrade paths that are mutually exclusive, so the same tower becomes a different tower
depending on the branch. In *BTD6* there are three paths, two may be taken to tier 2, and only one may
go beyond that. That is a large amount of depth drawn from a small number of assets.

**We take exclusive branches.** A second upgrade axis, chosen at tier 3, that specialises the tower
instead of making it bigger.

### Cookie Clicker (Orteil, 2013)

The exponential is the point, and two systems carry the long game: **prestige** (heavenly chips, which
convert a finished run into a permanent multiplier) and **golden cookies** (rare, timed, clickable
bonuses that reward attention without demanding it).

**We take both, translated into the motif.** Prestige becomes *Restart Windows*: the run ends, the
machine reboots, and the next run is faster because the system is better. Golden cookies become
desktop pop-ups: a dialog box appears mid-wave, and dismissing it pays.

### Sanctum (Coffee Stain, 2011)

The first FPS/tower-defense hybrid. Its shooting is deliberately weak: the towers do the damage and
the player patches leaks and snipes priority targets. The lesson is about proportion, not novelty.

**We take the proportion.** The pointer is precision and utility — shields, runners, elites, boss
phases — not a second source of bulk DPS. That is also what keeps "clicks are the economy" honest:
tower kills do the work, pointer kills pay the bonus.

## The thesis, restated for a full game

- The **board** is a maze you build.
- The **towers** are characters that branch.
- The **cursor** is an attention economy: your kills pay more, and the desktop occasionally offers
  something worth dropping everything for.
- The **run** ends in a reboot that makes the next run faster.
- Your **clicking** is precision, not volume.

## Roadmap

| Version | Name | The work | Why it is next |
|---|---|---|---|
| 0.2 | Maze | free pathing with a cost field, towers block, placement validated by flood fill, flyers that ignore the maze | it is the structural change; everything else is content |
| 0.3 | Branches | two exclusive upgrade paths per tower at tier 3, one path to tier 5 | depth from assets we already have |
| 0.4 | Desktop | pop-up events, precision combo, achievements, prestige with a permanent multiplier, endless mode after victory | the clicker half earns its genre |
| 0.5 | Content | 100 waves, boss waves, modifiers, sound | the shell around a game that already works |

## Milestones

| # | Deliverable | Proof |
|---|---|---|
| M0 | repository, toolchain, Pages deployment | done — the site loads |
| M1 | grid, path, one enemy, one tower, one wave | done — enemies walk and die |
| M2 | salvage economy, build phase, three towers | done |
| M3 | clicking damage, kill attribution, pointer upgrades | done — `npm run smoke` proves the 1.5x rule |
| M4 | enemy families, 100 waves, prestige | ten waves in; the other ninety and prestige to go |
| M5 | Windows chrome, sound, polish | chrome done; sound and polish to go |
