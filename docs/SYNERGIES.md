# Tower Synergies

Status: spec, not built. Owner: Guppy. Written 2026-11-20.

Two towers of the right kinds standing next to each other should be worth more than the same two
towers standing apart, and the board should say so without a tooltip: a translucent line joins the
pair, coloured by what the pair is doing for each other.

This document specifies the mechanism, the first synergy (AA), how it enters the simulation without
breaking determinism or saves, how it is drawn, and what proves it works.

## 1. Vocabulary

**Synergy** — a rule that gives two adjacent towers of specific kinds an effect neither has alone.

**Edge** — one adjacency between two towers that satisfies a synergy rule. Edges are what get drawn.

**Cluster** — a connected set of towers joined by edges of the same synergy, i.e. one connected
component of that synergy's graph. Four AAs in a row are one cluster; two separate pairs are two
clusters with the same rules applied to each.

Adjacency is **orthogonal only** (shares an edge, not a corner). Diagonal clustering makes the
board read as a blob and makes the connecting lines cross cells the player did not think of as
joined. If a later synergy wants diagonals it opts in per rule.

## 2. What this is not

No new tower, no new currency, no new upgrade tier, no cost. A synergy is a property of a layout,
so it also cannot be bought — it is earned by where you put things, and lost when you sell or lose
one of the pair.

Synergies are **derived state**. Nothing about them is stored in a save, an editor map, a record or
a daily seed. They are recomputed from tower positions, so an old save loads into the current rules.

## 3. The catalogue

Each entry is a pair of kinds (the same kind with itself is allowed), a colour, a dash pattern, and
an effect. The table is data (`SYNERGIES` in `src/core/synergy.ts`) so a second synergy is a row
plus its effect function, not a fork of the mechanism.

- `aa-sync` — **AA ↔ AA** — *Synchronized Fire* — amber `0xffe14d`, dashed 4 on / 3 off

### 3.1 `aa-sync` — Synchronized Fire

Two or more adjacent AA towers form a cluster that fires as one gun.

1. **Phase, not rate.** Every tower in a cluster keeps its own fire interval and its own cooldown.
   What the cluster shares is *when in the cycle it fires*: when a cluster forms, its members'
   cooldowns are aligned to the most-ready member, so equal-interval towers pull the trigger on the
   same tick from then on. No tower is made faster than the game already lets it be.
2. **One moment.** A tick on which two or more cluster members fire is a volley.
3. **Concentrated.** Each additional member firing in the same volley adds 6% damage to every shot
   in that volley, capped at +24% from four or more shooters. A pair hits 6% harder; a long line
   hits 24% harder.

Targeting, range, turn rate, armour handling, flak shells and missile salvos are all untouched.
Synchronized Fire changes *when* AA fires and *how hard* a volley lands, never *at what*.

Why phase alignment instead of a shared clock: a shared clock hands every member the fastest
member's rate, and AA does not work that way — a plain AA fires every 33 ticks and a tier-20 Flak
AA every 117, for 5.7× the damage per shell. Running both at 33 ticks would not be a synergy, it
would be a free 3.5× rate on the branch that already trades rate for punch. Aligning phase gives the player the volley
fantasy with no hidden rate multiplier, and it never has to be re-tuned when a branch changes.

Tuning constants, all in `src/core/synergy.ts`:

- `AA_VOLLEY_BONUS = 0.06` per extra simultaneous shooter
- `AA_VOLLEY_BONUS_CAP = 0.24`
- `AA_MIN_CLUSTER = 2`

Reference numbers today: plain AA is 2.6 damage, 33-tick interval (0.55 s), 3.4 range, 40 salvage,
×2 against flyers — 5.2 per shot, about 9.4 DPS. At tier 20, Flak (branch A) is 117 ticks at 14.8
damage and Missile (branch B) is 33 ticks at 11.8.

## 4. Simulation contract

### 4.1 Where it hooks

`fireTowers(s)` in `src/core/state.ts` already walks every tower, ticks its cooldown, aims it and
fires. Clustered AAs are removed from that per-tower walk and handled once per cluster; an AA with
no synergetic neighbour keeps the existing path byte for byte. That split matters: every tower that
is not in a cluster must behave exactly as it does today, or the change reaches into balance
everywhere instead of only where the player built a pair.

Per tick, for each AA cluster of size ≥ 2:

1. Decrement each member's cooldown once — same arithmetic as today, no shared clock.
2. Collect the members whose cooldown has reached zero, that have a target in range, and that can
   aim at it this tick. Members still turning or without a target are skipped, exactly as a lone
   tower is skipped today.
3. If the collection is empty, nothing happens.
4. Otherwise every collected member fires. The damage multiplier for all of them is
   `1 + min(AA_VOLLEY_BONUS_CAP, AA_VOLLEY_BONUS × (n − 1))`, where `n` is how many fired on this
   tick. Each then resets its own cooldown to its own interval minus one.

The multiplier is computed once per volley from the count, so a 3-tower volley applies +12% to all
three shots rather than compounding tower by tower.

### 4.2 Alignment, and where it lives

Alignment is applied when a cluster is (re)built: every member's `cooldown` is set to the smallest
cooldown in the cluster. `cooldown` is already a saved field (`runsave.ts`), so a mid-run save
carries each tower's phase with no format change and no new field to forget; a loaded save rebuilds
its clusters and re-aligns them.

One consequence to state plainly: because alignment snaps to the *most-ready* member, forming a
cluster can bring a volley forward by up to one interval. That is a one-off, it cannot be repeated
without selling and rebuilding a tower, and it is the same class of generosity as the first shot of
a fresh tower. If it ever matters in play, the fix is to align to the *least*-ready member instead;
the mechanism does not change.

No `SAVE_VERSION` bump. No editor, record or daily change.

### 4.3 Determinism

- Clusters are built by iterating `s.towers` in array order; no Map iteration, no object key order,
  no sorting by anything but tower id where a tie-break is needed.
- No RNG is consumed. A seeded run replays identically, and the existing non-flyer regression hash
  must not move for towers that are not clustered.
- Cluster sets are memoised on a revision counter bumped by place, sell, destroy, upgrade-kind and
  save-load, so the O(n²) adjacency scan does not run sixty times a second.

### 4.4 Edge cases, decided

- **Building or selling mid-wave.** Clusters are rebuilt on the revision bump and re-aligned. The
  survivors keep the clock they had, minus the alignment snap described above.
- **A member destroyed.** Same as selling.
- **Offline, EMP'd or disabled members.** They stay in the cluster for connectivity but cannot join
  a volley while down. The line dims for that member.
- **Mixed branches and tiers.** Legal, and the alignment does the visible work: two plain AAs volley
  together every 33 ticks; a Flak AA beside them joins on the beats where its own 117-tick cycle
  lands, and counts toward `n` when it does.
- **Walls and other kinds between.** They simply do not form edges, and a chain cannot pass through
  them because the chain only follows AA-to-AA adjacency.
- **Population limits.** Clusters are bounded by the tower cap; no special case.

## 5. Rendering

- **Layer.** New `synergy` layer in `BOARD_LAYER_ORDER`, inserted immediately before
  `towerSprites` — below every tower base, above the tiles, the path and the enemy shadows. The
  line belongs to the ground, not to the towers.
- **Geometry.** One line per edge, never per cluster: the line joins the two cell centres, trimmed
  by `0.28 × cell` at each end so it emerges from under the tower art instead of crossing it. A
  chain of five AAs draws four lines; a ring draws its ring.
- **Look.** `0xffe14d` at alpha `0.38`, width 2, dashed 4 on / 3 off. A slow pulse of ±0.10 alpha
  at about 1.1 Hz, driven by `state.clock` so it is deterministic and needs no new timer.
- **Quality.** `full` and `no-shadows` draw the pulse. `lean` draws the same lines flat at alpha
  `0.30`, no pulse — the governor may simplify the presentation, never the information.
- **Toggle.** View → **Synergy lines**, default on, session-only. It exists because eight edges on a
  crowded board is visual noise to some players, not because the lines are expensive.
- **Colour is never the only signal.** The dash pattern differs per synergy, so the amber dashed AA
  line stays distinguishable under deuteranopia. Greyscale screenshot check is part of review.
- **RTL.** The board never mirrors; these lines live in world space and ignore `isRtl()` entirely.

## 6. Player-facing text

- Help → a new **Synergies** page: the rule in one paragraph, the AA row, and the tuning in plain
  words ("adjacent AA towers fire as one; a bigger volley hits harder").
- Tower detail panel for an AA in a cluster: one extra line, `Synced · 3 towers · +12% volley`.
- Tooltip for a lone AA: `No adjacent AA — not synchronized`. It states the opportunity once and
  does not nag.
- All new strings go through the catalogue under `help.synergy.*` and `hud.synergy.*`, with numbers
  computed at the call site from the same constants the simulation uses.

## 7. What proves it works

Smoke groups, in the existing harness:

1. Adjacency: orthogonal pairs cluster, diagonal pairs do not.
2. Chains and rings: five in a row is one cluster of five; two pairs are two clusters of two.
3. Split: sell the middle of a chain, the cluster becomes two, and both halves stay aligned.
4. Rate is preserved: a clustered plain AA fires every 33 ticks, a clustered Flak AA every 117 —
   never the fastest member's rate.
5. Alignment: a freshly clustered pair fires its first volley on one tick, not two.
6. Volley maths: 2 shooters +6%, 3 +12%, 5 +24% and no further, checked against the constants.
7. Isolated member: a tower that cannot aim this tick fires on its next ready tick, uncapped and
   alone.
8. Isolation: a lone AA's cooldown, aim and damage are unchanged; the non-flyer determinism hash
   does not move.
9. Save round-trip mid-volley: the restored run resumes in phase.
10. Layer order: `synergy` sits below `towerSprites` and above `path`; the layer list stays frozen.
11. Lean quality still draws flat lines; `full` pulses.
12. RTL: edge positions are byte-identical under `he`.

## 8. Balance note

A base pair goes from about 18.9 DPS spread across two towers to the same 18.9 landing in volleys
at +6%, so roughly 20 DPS and a distinct thump. The real payoff is the cap: a line of five AAs
lands +24% while keeping every tower's own rate. If testers report AA trivialising flyer waves, cut
`AA_VOLLEY_BONUS_CAP` first, then the per-member bonus; do not touch the base AA stats, which are
load-bearing for the existing flyer-wave tuning.

Records set before this ships are not comparable with records set after; that was already true of
every balance change and is not worth a migration.

## 9. Future rows, not built

Written down so the mechanism is checked against more than one case before it is built:

- **Frost ↔ Frost** — overlapping slow fields merge into one larger field.
- **Beacon ↔ Laser** — a beacon's aura ignores the beam tower's range penalty.
- **Repair ↔ Wall** — a repairing wall repairs its neighbours too.
- **Cursor ↔ Gun** — the cursor's kill credit pays the gun a small cut.

None of these are in the table. `SYNERGIES` starts with one row on purpose: build the mechanism
against the one case we can playtest, then add rows without touching the mechanism.
