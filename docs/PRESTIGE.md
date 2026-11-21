# Tower licences — prestige unlocks

Status: spec, not built. Owner: Guppy. Written 2026-11-21. Queue position 2.

Towers unlock with the wave, inside a run: Gun and Wall from the start, Cannon at wave 4, AA at 5,
Frost at 6, Beacon at 8, Laser at 11, Taser at 14, Repair at 18, Cursor at 24. A player who wants a
Frost wall on wave 1 has to survive to wave 6 first.

A **licence** is a permanent, RP-priced unlock that grants one tower kind from the first build phase of
every run. Eight licences, one per gated tower, priced by how late that tower normally arrives. They
live in the existing Restore window, so there is no new screen, no new currency, and no new save field
for ownership — buying one is buying a node.

## The set

| Licence | Tower | Normally at | Tier | Level gate | Cost |
|---|---|---|---|---|---|
| Cannon Licence | Cannon | wave 4 | 1 | 0 | 3 RP |
| AA Licence | AA | wave 5 | 1 | 0 | 4 RP |
| Frost Licence | Frost | wave 6 | 2 | 8 | 5 RP |
| Beacon Licence | Beacon | wave 8 | 2 | 8 | 6 RP |
| Laser Licence | Laser | wave 11 | 2 | 8 | 8 RP |
| Taser Licence | Taser | wave 14 | 3 | 20 | 10 RP |
| Repair Licence | Repair | wave 18 | 3 | 20 | 12 RP |
| Cursor Licence | Cursor | wave 24 | 4 | 40 | 16 RP |

Total if bought one at a time: **64 RP**. Gun and Wall already start unlocked and have no licence.

Why these numbers: the price is a function of the unlock wave, so the ladder is monotonic (3, 4, 5, 6,
8, 10, 12, 16) and each step is explainable in one sentence. For scale, `rpGain` is
`2.2 × sqrt(salvage / 900)`: a first run that earns ~3,000 salvage banks about 4 RP, so a Cannon
Licence is a first-session purchase and a Cursor Licence is a deep-run goal. The early tier gates at
level 0 on purpose — the two cheapest licences are meant to be reachable before the tree opens up.

## Early Access is removed

`early-access` (tier 3, level 20, 30 RP, `unlockAllTowers`) is deleted by this change. Eight licences
that each give one tower are a better shape than one node that gives all eight: they are cheaper per
tower, reachable from meta level 0, and they make the player choose which tower matters to their build.
Keeping both would leave the eight licences permanently dominated by a 30 RP node that grants more.

Removing a node that people have bought needs a migration, not just a deletion:

- **Profile.** On load, if `profile.tree` contains `early-access`, drop it and add all eight licence
  ids, then mark the profile dirty so the exchange is written back. Nobody loses what they paid for,
  and the Restore window shows eight owned licences where the one owned node used to be.
- **A run in flight.** A mid-run save written before the change carries `unlockAllTowers: true` in
  `treeEffects`. When that save is restored, treat the legacy flag as "every licence is owned" so the
  run does not lose access to the towers it was already using at wave 1. The flag is then not written
  again.
- **Code.** Delete the node, the `unlockAllTowers` effect, its branch in `effectsFor`, the field in
  `TreeEffects` and in `parseTreeEffects`'s required list, and the `tree.earlyAccess.*` keys from all
  seven catalogues. A legacy `unlockAllTowers` in an old save is simply an unknown key and is ignored —
  which is why the parser must stay tolerant of extra fields.

## Data model

No new profile field: `Profile.tree` already stores bought node ids, and buying a node is an existing
path (`buyTreeNode`). What is new is one effect on `TreeEffects`.

```ts
// src/core/tree.ts
export interface TreeEffect {
  // ...existing fields...
  /** A tower kind this node unlocks from the first build phase of every run. */
  unlockTower?: TowerKind;
}

export interface TreeEffects {
  // ...existing fields...
  /** Tower kinds granted at wave 1 by owned licences. Empty when none are owned. */
  unlockedTowers: TowerKind[];
}
```

`effectsFor` unions `unlockTower` into `unlockedTowers` (order of `profile.tree` is irrelevant; sort
before returning so a snapshot is deterministic). `IDENTITY_EFFECTS.unlockedTowers` is `[]`.

The live check is one line in `src/core/state.ts`:

```ts
export function towerUnlocked(s: RunState, kind: TowerKind): boolean {
  return (
    s.treeEffects.unlockAllTowers ||
    s.treeEffects.unlockedTowers.includes(kind) ||
    isTowerUnlocked(kind, s.wave)
  );
}
```

That is the only gate: the palette, `canPlace`, the build menu's disabled state and the tooltip all
already route through `towerUnlocked`, so nothing else needs to know licences exist.

## Save compatibility

`treeEffects` is serialized into the mid-run save (`runsave.ts`, `parseTreeEffects`). The parser
currently returns null when any field is missing, and `restoreRun` rejects a save whose `v` is not
`RUN_SAVE_VERSION`.

- Add `unlockedTowers` to the writer.
- In `parseTreeEffects`, read it **tolerantly**: a missing key means `[]`, an unknown or non-string
  entry is dropped, and a value that is not an array is treated as absent. Only then does an old
  in-progress run keep restoring.
- **Do not bump `RUN_SAVE_VERSION`.** A version bump throws away every saved run in flight, and this
  feature does not need it.

The profile needs no migration: `tree` is a list of ids and `save.ts` already drops ids it does not
recognise (`treeNodeById` returns undefined and `effectsFor` skips them), so a save written before the
licences shipped simply has none.

## UI

The Restore window already renders every tier and lists its nodes as rows with a price column
(`src/view/restore.ts`). The licences appear in their tier with no layout change.

- Row title: the licence name. Price: the RP cost, as every other row.
- Description: two sentences, in the tooltip — "Cannon towers are available from the first build phase
  of every run. They still cost salvage to build."
- Owned licences show the existing owned state; there is no `Covered` state any more, because nothing
  grants all eight at once.
- Tier headers are unchanged; a licence that is not yet reachable by level is hidden behind its tier
  exactly like the existing nodes.

## Localization

Sixteen new keys per catalogue — `tree.cannonLicence.name` / `.description` and one pair per kind — in
all seven locales, non-English behind `draft: true`. The tower names already exist as
`tower.<kind>.name`; the licence name should compose from them rather than repeat the word, so a
translator fixes one string, not eight.

## Tests

- `effectsFor` on a profile owning `cannon-licence` reports `unlockedTowers: ['cannon']`, and owning two
  reports both, sorted and without duplicates.
- `towerUnlocked` at wave 1 is true for a licensed kind and false for the same kind without the licence;
  at wave 1 the unlicensed Cursor is still locked.
- Buying a licence through the existing purchase path deducts exactly its cost, refuses when RP is
  short, and refuses when already owned.
- Round trip: a profile with licences saves and loads back with the same set; a `treeEffects` object
  written before this feature loads with `unlockedTowers: []` and does not fail `restoreRun`.
- Migration: a profile whose `tree` contains `early-access` loads with that id gone and all eight
  licences present, and the saved profile is rewritten; a mid-run save carrying
  `unlockAllTowers: true` restores with every kind unlocked and does not fail.
- i18n: every catalogue carries all sixteen keys, and `i18n:check` passes.

## Out of scope

- Selling or refunding licences.
- A licence for Gun or Wall (already free).
- Anything that changes `TOWER_UNLOCK_WAVE` itself; the wave curve stays the default experience and the
  licence is the way around it. Fast Boot's `startingWave` remains additive and unrelated.

## Open questions, with a proposed answer

- **Should licences apply to the Daily?** Yes. The Daily already inherits the whole Restore tree
  (salvage, integrity, starting wave), so excluding licences would be the inconsistent choice, and the
  Daily's comparability is already profile-relative by design.
- **Eight nodes in four tiers, or one new tier of their own?** Keep them in the existing tiers. A sixth
  tier would need a layout change to the Restore window and would read as a new progression axis, which
  this is not.
