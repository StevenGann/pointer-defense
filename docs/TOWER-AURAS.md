# Tower auras

Towers change state — being healed, standing in a Beacon's aura, dropping their own priority for
Manual Override, knocked offline by a Wirecutter's EMP — and none of it is visible. The player sees
hit points move and fire rates change and has to infer why.

These are placeholder effects. An artist will replace the artwork and add real animation later; what
this pass owes them is a slot in the art pipeline, a layer, and a status model describing when each
one is on.

## What is drawn

Four auras, one per status. Each is an `fx/` asset drawn on the tower's tile centre at the tower's own
sprite size, cycling while the status holds.

| Asset | Status | Placeholder look |
|---|---|---|
| `fx/aura-heal` | a Repair tower is healing this tower | three green plus signs rising and fading, 4 frames, loop |
| `fx/aura-beacon` | this tower is inside a Beacon's aura | a gold ring, gold at the rim fading to transparent at the centre, pulsing, 4 frames, loop |
| `fx/aura-override` | Manual Override is on, a target is marked, and this tower is in range of it | a cyan reticle: four corner brackets tightening, 4 frames, loop |
| `fx/aura-emp` | the tower is disabled — Wirecutter EMP or Blue Screen | violet static: broken arcs flickering around the rim, 4 frames, loop |

- 32x32 viewBox, fills not hairlines, per `public/art/README.md`.
- Each asset ships its frames plus a `.json` with `fps`, `loop: "loop"`, `randomStart: true`, so a
  row of them does not pulse in lockstep.
- The manifest is generated at build (`npm run art:manifest`), so new files under `public/art/fx/`
  are picked up without a manifest edit.

## Status model

The view asks the core, never guesses. Add three pure helpers, each returning what it says:

- `healedTowerIds(s)` — ids of towers a Repair tower healed this tick.
- `towerAuraSources(s)` — a map from tower id to the set of buffs on it: `beacon` when a Beacon's
  aura reaches it, `override` when Manual Override has a marked target in range of that tower.
- `disabledTowerIds(s)` — towers currently under a Wirecutter EMP or Blue Screen.

They read the same state the effects read (`empUntilTick`, `towerDisabled`, the aura source and the
repair target the tick already computed), so a visual can never claim something the sim is not doing.

## Drawing

- A new `auras` layer in `BOARD_LAYER_ORDER`, after `towers` and before `wrenches`: over the plinth so
  the tower reads as affected, under anything that floats above it.
- One pooled sprite per status per tower, so a full board costs no more than the tower count times
  four and nothing is created per frame.
- A status off means the sprite is hidden, not destroyed.
- Alpha and scale come from the asset's animation; the view adds only position.
- Auras never take pointer events: `hudButtonAt`, `enemyAt` and tower selection keep working through
  them.

## Tests

1. Each helper returns exactly the towers the sim is acting on: a Repair tower marks its target, a
   Beacon marks every tower in radius and nothing outside it, an EMP marks the towers inside it, and
   Manual Override marks only towers within range of the marked enemy.
2. Each helper returns nothing when the status is absent.
3. `BOARD_LAYER_ORDER` puts `auras` after `towers` and before `wrenches`.
4. Exactly one sprite per active status, none for an inactive one, and pooled sprites hide.
5. The four assets exist, have at least four frames, and pass the manifest checks the smoke run
   already applies to every asset.
