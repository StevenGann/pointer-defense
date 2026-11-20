# Tower Synergies

Status: spec, not built. Owner: Guppy. Written 2026-11-20.

Two towers of the right kinds standing next to each other should do something together, and the
board should say so without a tooltip: a translucent line joins the pair, coloured by what the pair
is doing for each other.

A synergy is not automatically a buff. This one is a behaviour: adjacent AAs fire as one, and a
player who wants the rhythm builds for it.

This document specifies the mechanism, the first synergy (AA), how it enters the simulation without
breaking determinism or saves, how it is drawn, and what proves it works.

## 1. Vocabulary

**Synergy** — a rule that gives two adjacent towers of specific kinds an effect neither has alone.

**Edge** — one adjacency between two towers that satisfies a synergy rule. Edges are what get drawn.

**Dominant / submissive** — of an edge, the tower whose firing the other one waits for, and the one
that waits. These words belong in this document and in code comments only. The game never says
them: player-facing text says *leads* and *follows*, and the code names the pair `lead` / `follow`
with a `leads()` predicate, so nobody has to ship the vocabulary of a design note to a player.

Adjacency is **orthogonal only** — north, south, east, west. No diagonals. Diagonal clustering makes
the board read as a blob, makes the connecting lines cross cells the player did not think of as
joined, and turns a two-tower rule into a four-tower rule at every corner.

## 2. What this is not

No new tower, no new currency, no new upgrade tier, no cost. A synergy is a property of a layout, so
it cannot be bought — it is earned by where you put things, and lost when you sell or lose one of
the pair.

Synergies are **derived state**. Nothing about them is stored in a save, an editor map, a record or
a daily seed. They are recomputed from tower positions, so an old save loads into the current rules.

## 3. The catalogue

Each entry is a pair of kinds (the same kind with itself is allowed), a colour, a dash pattern, and a
rule for which tower of an edge leads. The table is data (`SYNERGIES` in `src/core/synergy.ts`) so a
second synergy is a row plus its effect, not a fork of the mechanism.

- `aa-sync` — **AA ↔ AA** — *Synchronized Fire* — amber `0xffe14d`, dashed 4 on / 3 off

### 3.1 `aa-sync` — Synchronized Fire

Adjacent AAs fire as one.

1. **The faster tower leads.** On an edge, the tower with the shorter fire interval leads and the
   other one follows. A plain AA and a Missile AA are both 33 ticks; Flak is slower at every tier, so
   a branch choice decides the direction of an edge as well as the damage.
2. **Ties break north, then west.** Equal intervals — the common case, two plain AAs — are settled by
   position: the tower in the smaller row leads; in the same row, the smaller column leads. That
   tie-break is universal: any future synergy that cannot separate two towers by its own condition
   falls back to it.
3. **A follower holds its fire.** A follower that is ready, aimed and has a target does not shoot
   until its leader fires in that same tick. Then it fires with it.

That is the whole effect. Synchronized Fire changes *when* AA fires and nothing else: no damage
multiplier, no rate change, no range change. Targeting, turn rate, armour handling, flak shells and
missile salvos are untouched, and a synchronized shot deals exactly the damage the tower's stats say
it deals.

Why holding instead of a shared clock: a shared clock hands every member the fastest member's rate,
so a Flak tower beside a plain AA would fire 3.5× as often as it is allowed to — not a synergy, a
stealth buff to the branch that deliberately trades rate for punch. Holding costs a follower at most
one leader cycle and never grants anyone a faster weapon. It also means a synergy **never rewrites a
cooldown**, so it cannot be used to pull a shot forward by rebuilding a tower.

Why dominance per edge instead of searching a cluster: an edge is a local fact, and its direction is
decided by comparing its own two ends. No cluster walk, no ordering ambiguity, no dependence on which
tower happens to be first in the array. A chain of five AAs resolves in one pass because the lead
relation is transitive by construction — see §4.3.

Tuning constants, all in `src/core/synergy.ts`:

- `AA_MIN_CLUSTER = 2`
- `AA_HOLD_WINDOW = 33` ticks — how far ahead a follower will wait for a leader's shot
- `AA_HOLD_CAP = 66` ticks — the backstop: longest a follower may hold, ever

Reference numbers today: plain AA is 2.6 damage, 33-tick interval (0.55 s), 3.4 range, 40 salvage,
×2 against flyers — 5.2 per shot, about 9.4 DPS. At tier 20, Flak (branch A) is 117 ticks at 14.8
damage and Missile (branch B) is 33 ticks at 11.8.

## 4. Simulation contract

### 4.1 Where it hooks

`fireTowers(s)` in `src/core/state.ts` already walks every tower, ticks its cooldown, aims it and
fires. Clustered AAs are removed from that per-tower walk and handled once per cluster; an AA with no
synergetic neighbour keeps the existing path byte for byte. That split matters: every tower that is
not in a cluster must behave exactly as it does today, or the change reaches into balance everywhere
instead of only where the player built a pair.

### 4.2 One tick, one cluster

1. Tick every member's cooldown once, exactly as today. No cooldown is ever written by the synergy.
2. Process the members in lead order (§4.3) — a single pass, leaders before followers.
3. A member fires if it is ready, aimed, has a target, **and** either it has no live leader or one of
   its leaders has already fired this tick.
4. A ready follower with a target whose leader has not fired yet **holds** when the leader is live
   and its own cooldown is within `AA_HOLD_WINDOW`; it fires anyway when the leader is offline,
   disabled, EMP'd, has no target in range, or is further away than that window.
5. Any follower that has held for `AA_HOLD_CAP` consecutive ticks fires regardless. This is the
   backstop that stops a rule about waiting from becoming a tower that never shoots.

Nothing about the shot changes when it lands: same damage, same projectile, same targeting. The only
observable difference is the tick it happens on.

Holding is a runtime fact, not a saved one: `holdSince` is a per-tower-id map cleared whenever
clusters are rebuilt. A save taken mid-hold resumes with nobody holding, which costs at most one
extra shot and cannot be farmed, because loading a save is not something a player can repeat inside
a wave.

### 4.3 Lead order, and why it cannot loop

The comparison used to decide an edge is: shorter interval first; then smaller row; then smaller
column. That is a lexicographic comparison over a total order, so it is itself a strict total order
on towers. Sorting a cluster by it puts every leader before every one of its followers, which makes
the single pass in §4.2 correct with no cycle detection.

A total order cannot contain a cycle, so a chain, a ring, or a branch of AAs always has a tower that
leads and one that follows, and a ring still fires in one pass. This is worth stating because the
obvious alternative — "the partner with the higher rate leads", with no positional tie-break —
divides by zero on the common case of two identical towers, and a ring of equal-rate towers would
have no consistent direction at all.

Roles are recomputed whenever towers change: place, sell, destroy, upgrade, branch change, or save
load. Upgrading a plain AA into a Flak slows it, which can flip its role in a pair mid-wave. That is
intended and safe, because nothing about the role is stored.

### 4.4 Determinism

- Clusters are built by iterating `s.towers` in array order; within a cluster, members are sorted by
  the §4.3 comparison. No Map iteration order, no object key order.
- No RNG is consumed. A seeded run replays identically, and the existing non-flyer regression hash
  must not move for towers that are not clustered.
- Cluster sets are memoised on a revision counter bumped by every mutation listed in §4.3, so the
  O(n²) adjacency scan does not run sixty times a second.

### 4.5 Edge cases, decided

- **Building or selling mid-wave.** Clusters rebuild on the revision bump; roles and holds are
  recomputed. No cooldown is touched, so nothing can be reset by rebuilding.
- **A member destroyed mid-hold.** Its followers see no live leader on the next tick and fire.
- **Offline, EMP'd or disabled members.** They still form edges — the line stays drawn, dimmed — but
  they cannot fire or act as a live leader.
- **Mixed branches and tiers.** Legal: two plain AAs volley every 33 ticks; a Flak AA beside a plain
  one fires on the first plain-AA beat after it is ready, and counts toward `n` when it does.
- **Walls and other kinds between.** They simply do not form edges, and a chain cannot pass through
  them because the chain only follows AA-to-AA adjacency.
- **Population limits.** Clusters are bounded by the tower cap; no special case.

## 5. Rendering

- **Layer.** New `synergy` layer in `BOARD_LAYER_ORDER`, inserted immediately before `towerSprites`
  — below every tower base, above the tiles, the path and the enemy shadows. The line belongs to the
  ground, not to the towers.
- **Geometry.** One line per edge, never per cluster: the line joins the two cell centres, trimmed by
  `0.28 × cell` at each end so it emerges from under the tower art instead of crossing it. A chain of
  five AAs draws four lines; a ring draws its ring.
- **Look.** `0xffe14d` at alpha `0.38`, width 2, dashed 4 on / 3 off, with a slow ±0.10 alpha pulse
  at about 1.1 Hz driven by `state.clock`, so no new timer exists to fall out of step.
- **Direction.** The dash offset drifts from leader to follower. This is the only place a pair's
  direction is visible, and it costs one animated offset per line rather than any new glyph.
- **Quality.** `full` and `no-shadows` draw the pulse. `lean` draws the same lines flat at alpha
  `0.30`, no drift — the governor may simplify presentation, never the information.
- **Toggle.** View → **Synergy lines**, default on, session-only.
- **Colour is never the only signal.** The dash pattern differs per synergy, so the amber dashed AA
  line stays distinguishable under deuteranopia. Greyscale screenshot check is part of review.
- **RTL.** The board never mirrors; these lines live in world space and ignore `isRtl()` entirely.

## 6. Player-facing text

- Help → a new **Synergies** page: the rule in one paragraph and the AA row in plain words
  ("adjacent AA towers fire as one — the faster one leads and the others fire with it; a
  synchronized shot is exactly as strong as an unsynchronized one, it just lands with the rest").
- Tower detail panel for an AA in a cluster: one line, `Synced · 3 towers`. It states the
  connection, not a number, because there is no number.
- Tooltip for a lone AA: `No adjacent AA — not synchronized`. It states the opportunity once and
  does not nag.
- All new strings go through the catalogue under `help.synergy.*` and `hud.synergy.*`, with numbers
  computed at the call site from the same constants the simulation uses.

## 7. What proves it works

Smoke groups, in the existing harness:

1. Adjacency: orthogonal pairs form edges; diagonal pairs do not.
2. Direction: the shorter interval leads; equal intervals resolve north, then west.
3. Order: sorting a ring and a chain by the §4.3 comparison puts every leader before its followers,
   and the comparison is total — no two distinct towers compare equal.
4. Propagation: a chain of five fires all five on one tick, in one pass.
5. Holding: a ready follower with a live, in-window leader does not fire.
6. Abandonment: a follower fires anyway when its leader is offline, has no target, is outside the
   window, or has held past `AA_HOLD_CAP`.
7. Rate preservation: a clustered Flak AA still fires on its own interval, never the leader's.
8. No multiplier: a synchronized shot deals exactly `effectiveStats(t).damage`, compared against a
   lone tower's shot on the same target, to the last decimal.
9. No cooldown rewriting: a tower's cooldown sequence is identical with and without a neighbour,
   apart from the ticks it spends holding.
10. Isolation: a lone AA's cooldown, aim and damage are unchanged; the non-flyer determinism hash
    does not move.
11. Save round-trip mid-hold: the restored run resumes with no follower stuck holding.
12. Role flip: upgrading a partner into a Flak flips the edge's direction on the next rebuild.
13. Layer order: `synergy` sits below `towerSprites` and above `path`; the layer list stays frozen.
14. Lean quality still draws flat lines; `full` pulses.
15. RTL: edge positions are byte-identical under `he`.

## 8. Balance note

This synergy does not raise DPS, and it should not be sold as if it does. Two plain AAs pay the
alignment once — after that they share a 33-tick clock and lose nothing — so the pair is exactly as
strong as two unpaired towers that happen to be in step.

The case with a real cost is a Flak follower: 117 ticks against a 33-tick leader, so it can wait up
to 33 ticks per cycle, which is up to 28% of that tower's rate. That is the price of the rhythm and
it is worth watching in playtests. If it reads as a nerf rather than a choice, the fix is to scale
`AA_HOLD_WINDOW` down to a fraction of the follower's own interval, which weakens alignment for
mixed-rate pairs but bounds the tax.

No balance change to the base AA is implied by this feature, and none should be made to compensate
for it.

Records set before this ships are not comparable with records set after; that was already true of
every balance change and is not worth a migration.

## 9. Future rows, not built

Written down so the mechanism is checked against more than one case before it is built. Each note
says what its lead rule would be, because that is the part this document is really about:

- **Frost ↔ Frost** — overlapping slow fields merge into one larger field. Lead: the larger field
  radius; ties north/west.
- **Beacon ↔ Laser** — a beacon's aura ignores the beam tower's range penalty. Lead: the beacon,
  because the aura is the thing being extended; ties are irrelevant.
- **Repair ↔ Wall** — a repairing wall repairs its neighbours too. Lead: whichever is repairing.
- **Cursor ↔ Gun** — the cursor's kill credit pays the gun a small cut. Lead: the cursor, always.

None of these are in the table. `SYNERGIES` starts with one row on purpose: build the mechanism
against the one case we can playtest, then add rows without touching the mechanism.
