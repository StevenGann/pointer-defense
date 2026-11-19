# Global upgrades

Expensive, one-shot, per-run upgrades bought with salvage — the Cookie Clicker upgrade layer of
Pointer Defense. They are the answer to "my economy has outgrown my board": a run that reaches wave
50 has towers it wants and cash it cannot spend, and this is where that cash goes.

This document is the implementation contract. It fixes the rules, the fourteen items, the exact
numbers, the UI, the art, and the tests. Where it names a file and a function, that is the hook
point; where it does not, the rule still binds.

---

## 1. The rules

- **Per run.** Owned upgrades live on `RunState`, not the profile. A reboot, a new run, or a level
  change clears them. Nothing about them persists.
- **One-shot.** An upgrade is bought once and is owned for the rest of the run. No levels, no
  stacking, no repeat purchases. Repeatable percentages are SPECS; this is not a second spec tree.
- **Hidden until earned.** A row appears only once `run.wave >= def.wave`. Before that the row does
  not exist — not greyed, not "???". A footer line says *"More appear as the run goes deeper."*
- **Paid in salvage**, the run currency, never RP. RP belongs to the meta layer.
- **Buyable at any time** during a run, build phase or wave — the decision is meant to be live. The
  dialog is never openable over another modal.
- **Cheats do not interact.** Cheated runs already record nothing meta; upgrades are run-local and
  need no special case.

## 2. Data model

New module `src/core/upgrades.ts`, Pixi-free, imported by the sim and by the smoke harness.

```ts
export type UpgradeId =
  | 'salvage-contract' | 'emergency-patch' | 'wide-reticle' | 'double-buffer'
  | 'compound-interest' | 'autoloader' | 'shutter-licence' | 'bulk-requisition'
  | 'ballistic-telemetry' | 'structural-warranty' | 'chain-reaction'
  | 'bounty-board' | 'system-tray' | 'coolant';

export type UpgradeGroup = 'pointer' | 'towers' | 'economy' | 'board' | 'system';

export interface UpgradeDef {
  readonly id: UpgradeId;
  readonly name: string;
  readonly group: UpgradeGroup;
  /** The wave at which the row appears, and its purchase gate. */
  readonly wave: number;
  /** Salvage price. */
  readonly cost: number;
  /** One line for the row (<= 46 chars). */
  readonly line: string;
  /** Two or three sentences for the tooltip. */
  readonly detail: string;
}

export const GLOBAL_UPGRADES: readonly UpgradeDef[] = [ /* §4 */ ];
```

`RunState` gains:

```ts
/** Global upgrades bought this run, in purchase order. Cleared by createRunState. */
upgrades: UpgradeId[];
/** Emergency Patch: set once it has eaten a killing leak. */
emergencyPatchSpent: boolean;
/**
 * System Tray's active buff. `until` is a sim clock tick, not wall time, so pause and speed are
 * free. Phase 2 — see §5.
 */
buff: { kind: 'turbo' | 'overdrive' | 'windfall'; until: number } | null;
```

Helper API (all exported from `upgrades.ts`):

| Function | Contract |
|---|---|
| `hasUpgrade(s, id)` | true when `s.upgrades` contains `id` |
| `revealedUpgrades(s)` | defs with `def.wave <= s.wave`, in `GLOBAL_UPGRADES` order |
| `upgradesAvailable(s)` | revealed, not owned, and affordable |
| `buyUpgrade(s, id)` | false if unrevealed, owned, or unaffordable; otherwise subtract salvage and push the id |
| `upgradeBuff(s)` | active buff or null (expiry compares `s.clock`) |

Purchases **must** go through `buyUpgrade` so the smoke harness can drive them without the view.

## 3. How the effects hook in

Line numbers are from the commit that introduced this document; treat the function names as the
contract, not the offsets.

| Upgrade | Hook |
|---|---|
| `salvage-contract` | the kill payout in `state.ts` (`POINTER_KILL_BONUS` / `WEAK_POINT_KILL_BONUS` neighbourhood): only when the killing source is `tower`, multiply the final value by 1.25, floor after rounding |
| `emergency-patch` | the leak branch in `state.ts` (`s.integrity = Math.max(0, s.integrity - …)`) |
| `wide-reticle` | `pointerDown`'s `enemyAt(s, x, y, CLICK_SLACK + relay.slack)` call: add 0.2 to the slack when owned |
| `double-buffer` | `pointerDown`'s `base` (click damage) **and** the held-reticle DPS tick |
| `compound-interest` | the wave-clear payout, immediately after the clear bonus is credited and before the phase returns to build |
| `autoloader` | `fireInterval` consumption in `state.ts`'s tower fire pass: `max(1, floor(interval * 0.87))` |
| `shutter-licence` | `toggleGate` (skip the 3 s lock) and the wave-start guard that refuses on a recently toggled gate |
| `bulk-requisition` | `towerCost(s, kind)` |
| `ballistic-telemetry` | projectile resolution (`shell` and `missile` hits) |
| `structural-warranty` | tower damage application, and `startRepair`'s duration |
| `chain-reaction` | `damageEnemy` when the source is `pointer` and the hit kills |
| `bounty-board` | `enemyKillValue` at kill time (bosses ×2) and `createEnemy`'s HP (`hpMult` ×1.1 for bosses) |
| `coolant` | `MAX_OVERCLOCK_LEVEL` in `pointer.ts` — the run-local cap becomes 16 |
| `system-tray` | a new spawner in the wave tick plus `closePopupEnemy`'s sibling |

## 4. The fourteen

Costs are tuned against the measured income curve (cumulative salvage: ~6.3k by wave 20, ~42k by 50,
~60k by 60, ~107k by 80, ~177k by 100). Owning all fourteen costs **109,800**, deliberately just
above the overclock ladder's ~100k, so a run cannot own everything. Knobs are listed per item.

### Pointer

**`wide-reticle` — Wide Reticle** · wave 25 · 2,200
> *Line:* "Clicks land 0.2 tiles wider."
> *Detail:* "The click hit test gets 0.2 tiles of slack in every direction. Small flyers stop
> slipping out from under the pointer."
> **Effect:** `CLICK_SLACK + 0.2` on the click test only. Tower range, splash and the Cursor's reach
> are untouched.
> **Knob:** 0.2 (design range 0.15–0.3).

**`double-buffer` — Double-Buffered Click** · wave 30 · 3,000
> *Line:* "Click and hold damage ×2."
> *Detail:* "Every click and every tick of held-reticle damage is doubled. Multiplies with overclock
> and the crit, so it is worth most on a built pointer."
> **Effect:** ×2 on click damage and on hold DPS.
> **Knob:** 2.0.

**`chain-reaction` — Chain Reaction** · wave 50 · 12,000
> *Line:* "Killing clicks splash 25% to two neighbours."
> *Detail:* "A click that kills deals a quarter of the killing blow to the two nearest enemies
> within 1.5 tiles. The splash cannot crit, cannot carry the mark bonus, and cannot chain again."
> **Effect:** 25 % of the killing blow, up to 2 enemies, radius 1.5 tiles, source `pointer`.
> **Knob:** 0.25 / 2 / 1.5. Guard against re-entry with a parameter or a module-level depth flag —
> a chain must never trigger a second chain.

**`coolant` — Coolant Loop** · wave 60 · 25,000
> *Line:* "Overclock cap 12 → 16 this run."
> *Detail:* "Four extra overclock levels for the rest of the run. The milestone multipliers on the
> ladder still apply, so this is the most expensive damage in the game."
> **Effect:** the run-local overclock cap is 16 instead of `MAX_OVERCLOCK_LEVEL` (12).
> **Knob:** +4 levels.

### Towers

**`salvage-contract` — Salvage Contract** · wave 20 · 1,200
> *Line:* "Tower kills pay +25% salvage."
> *Detail:* "The idle half starts paying. It does not touch the pointer's 1.5× bonus, so clicking is
> still the better rate — just no longer the only one."
> **Effect:** ×1.25 on tower-sourced kill value, applied after wave scaling and rounding.
> **Knob:** 0.25.

**`autoloader` — Autoloader** · wave 35 · 4,000
> *Line:* "All towers fire 15% faster."
> *Detail:* "Every tower's fire interval is multiplied by 0.87, to a floor of one tick. Applies to
> beams and projectiles alike."
> **Effect:** `max(1, floor(interval * 0.87))`.
> **Knob:** 0.87.

**`ballistic-telemetry` — Ballistic Telemetry** · wave 45 · 8,000
> *Line:* "AA shells and missiles splash to a second flyer."
> *Detail:* "Each shell or missile that connects deals half its damage again to the nearest other
> flyer within one tile. Anti-air stops being single-target."
> **Effect:** 50 % of the projectile's damage to the nearest other flyer within 1.0 tile.
> **Knob:** 0.5 / 1.0.

**`structural-warranty` — Structural Warranty** · wave 45 · 8,500
> *Line:* "Towers take half damage; repairs are twice as fast."
> *Detail:* "Breachers and pop-ups do half damage to towers, and repair downtime halves. Stacks with
> Cooling Loop's 25 %, which lands at 37.5 % of the base time."
> **Effect:** tower damage ×0.5; repair duration ×0.5.
> **Knob:** both 0.5.

### Economy

**`compound-interest` — Compound Interest** · wave 30 · 3,200
> *Line:* "+1.5% of banked salvage at each wave clear."
> *Detail:* "Every cleared wave pays 1.5 % of what you are holding. It rewards not spending, which
> is the only upgrade that argues with the others."
> **Effect:** at wave clear, `gain = floor(salvage * 0.015)`, added to both `salvage` and `earned`.
> **Knob:** 0.015. If it runs away, halve before capping.

**`bulk-requisition` — Bulk Requisition** · wave 40 · 6,000
> *Line:* "Each copy of a tower costs 4% less, to −40%."
> *Detail:* "The discount counts the copies you already own of that kind, so going tall on one tower
> is cheaper than spreading out. Walls do not count."
> **Effect:** `towerCost = floor(base * (1 - min(0.4, 0.04 * copiesOfKind)))`.
> **Knob:** 0.04 / 0.40.

**`bounty-board` — Bounty Board** · wave 50 · 12,500
> *Line:* "Bosses pay double, with 10% more HP."
> *Detail:* "Boss salvage doubles. They also arrive with a tenth more health, so the bonus is paid
> for in the fight."
> **Effect:** boss kill value ×2; boss HP ×1.1 at spawn.
> **Knob:** 2.0 / 1.1.

### Board

**`emergency-patch` — Emergency Patch** · wave 25 · 2,000
> *Line:* "Once per run, a killing leak leaves you at 1."
> *Detail:* "The first leak that would take integrity to zero leaves you at one instead. It is
> consumed whether or not you were already going to lose."
> **Effect:** at the leak site, if the result would be `<= 0` and `!emergencyPatchSpent`, set
> integrity to 1 and `emergencyPatchSpent = true`.
> **Knob:** the starting value of 1.

**`shutter-licence` — Shutter Licence** · wave 35 · 4,200
> *Line:* "Walls toggle instantly, and toggling never blocks a wave."
> **Effect:** `toggleGate` skips the 3 s lock; the wave-start refusal on a recently toggled gate is
> bypassed.
> **Knob:** none — it is a switch.

### System

**`system-tray` — System Tray** · wave 55 · 18,000 — **phase 2**
> *Line:* "Rare System Update pop-ups grant 20 s buffs."
> *Detail:* "Deep in a run the tray starts offering gifts: a pop-up that, clicked, doubles fire rate,
> doubles click damage, or adds 25 % kill salvage for twenty seconds. One at a time."
> **Effect:** see §5.

## 5. System Tray (phase 2)

Implement last, after everything else lands and passes smoke. It needs a spawner, a clickable
window, a buff clock and a HUD line, so a partial landing must not block the rest.

- While `system-tray` is owned and `phase === 'wave'`, roll once per second (60 ticks): **1.5 %**
  chance to spawn, at most one on screen, never in the first 5 s of a wave.
- The pop-up is a small windows-95 window drawn by the existing pop-up/ad machinery, 120×64, parked
  in the top-right of the field. It closes itself after **12 s**.
- Clicking it picks one of three buffs, uniformly at random, for **20 s** (1200 ticks):
  - **Turbo** — tower fire interval ×0.6
  - **Overdrive** — click and hold damage ×2
  - **Windfall** — kill salvage ×1.25
- One buff at a time: a new buff replaces the old one outright. `buff.until` is compared against
  `s.clock`, so pause and ×2/×3 speed behave.
- The HUD's GLOBAL UPGRADES section shows the active buff's name and remaining seconds while one is
  live.
- Knobs: 0.015 chance, 12 s lifetime, 20 s duration, ×0.6 / ×2 / ×1.25.

## 6. UI

### 6.1 The HUD section

`hud.ts` already reserves a GLOBAL UPGRADES section with one dim row and currently routes a click on
it to `{ action: 'restore' }`. That section becomes **two rows**, both clickable:

1. `Restore — {profile.rp} RP` → opens the Restore dialog (unchanged behaviour, now labelled).
2. `Upgrades — {n} available` → opens the new dialog. When nothing is revealed yet the line reads
   `Upgrades — none yet`; when every revealed one is owned, `Upgrades — all owned`.

- Add `'upgrades'` to the `HudAction` union and a per-row hit rect; the section is measured by
  height already, so two rows must not overlap the section below it.
- `main.ts` gets a `case 'upgrades'` alongside `'restore'`, and its tooltip line.
- Restore must remain reachable — it currently has no other entry point.

### 6.2 The dialog

New `src/view/upgrades.ts`, modelled on `restore.ts` (same header, close box, row-text pooling).

- **Size:** 560 wide, height clamped to the client area, vertically centred.
- **Header:** `GLOBAL UPGRADES` left, `Salvage: {n}` right.
- **Groups**, in this order, each with a bold header row: POINTER, TOWERS, ECONOMY, BOARD, SYSTEM.
  A group with no revealed rows draws nothing, header included.
- **Row:** 20 px tall. 20×20 icon from the 44 px artwork (`getArtTexture(id, 20)`), name on the
  left, `def.line` in dim immediately after it (truncate with no ellipsis if it will not fit),
  and a buy button 88 px wide at the right: `Buy 1,200`, or `OWNED` greyed and unfilled.
  Unaffordable rows keep their button but draw it disabled.
- **Hidden rows do not exist.** Below the last group, one dim footer line:
  `More appear as the run goes deeper.`
- **Tooltip:** hovering a row shows `def.detail` (and the price when unaffordable, e.g.
  `Need 4,800 more`). Reuse the shared tooltip.
- **Input:** click a row's button to buy; `U` opens and `Esc` closes; `Up`/`Down` move the
  selection and `Enter` buys. Buying plays the existing purchase blip.
- **Empty state:** with nothing revealed, the dialog shows only the footer line.

## 7. Art

### 7.1 The contract

- Folder: `public/art/upgrades/`.
- One file per upgrade: `<id>.svg`, `viewBox="0 0 44 44"`, exactly like the achievement icons, and
  the raised Windows 95 frame is **baked into the artwork** the same way.
- `public/art/upgrades/_upgrade-placeholder.svg` is the fallback. Its bare name differs from the
  achievements' `_placeholder`, so it resolves by the ordinary bare-name lookup like every other asset.
- `scripts/upgrade-art.mjs` mirrors `ach-art.mjs`: for every `GLOBAL_UPGRADES` id, copy the
  placeholder into place **only if the file does not exist**. Never overwrite. Wire it into `predev`
  and `prebuild` before `art:manifest`, and export `runUpgradeArt(artDir)` for the harness. Add it
  to `package.json` as `upgrade-art`, and to the `predev`/`prebuild` chain as `ach-art` is.
- `art-manifest.mjs` scans directories recursively, so `upgrades/` needs no manifest change.

### 7.2 The placeholder

`_upgrade-placeholder.svg` is a 44×44 tile with the standard frame and a centred dark-grey glyph: a gear over three stacked
horizontal bars, at `#808080` on `#c0c0c0`, black 1 px outline. It must read as "not drawn yet" and
must never be mistaken for one of the real icons.

### 7.3 Artist brief, one line per icon

Style: period icon art, hard black outline, one identity colour, legible at 20 px, rewarding at
64 px (see `docs/ART-STYLE.md`). Each is framed as an achievement icon is.

| Id | Icon |
|---|---|
| `salvage-contract` | a signed paper contract with a dollar glyph, stamped with a tiny tower silhouette; cream paper on the grey frame |
| `emergency-patch` | a bandage patch over a cracked pane, the crack still visible at the corner; white patch, navy crack |
| `wide-reticle` | a crosshair with a second, larger ring outside it and four short arrows pointing outward; navy |
| `double-buffer` | two overlapping pointer arrows with two click ripples, one behind the other; grey and navy |
| `compound-interest` | a stack of three coins with a small rising line graph above it; gold `#ffcc00` and green `#00a000` |
| `autoloader` | a cartridge belt feeding into a barrel mouth, one round half-seated; brass and gunmetal |
| `shutter-licence` | a key overlapping a half-closed shutter grille; gold key, grey grille |
| `bulk-requisition` | a crate with three identical miniature towers inside, seen from above; cardboard brown and grey |
| `ballistic-telemetry` | a radar screen showing one arc splitting into two impact blips; green phosphor on black |
| `structural-warranty` | a shield with a wrench and a checkmark, one rivet at each corner; steel blue and green |
| `chain-reaction` | a click spark throwing two lightning arcs to two small enemy dots; yellow on navy |
| `bounty-board` | a wanted poster with a boss silhouette and a coin pinned to the corner; cream, navy, gold |
| `system-tray` | the system tray corner of a taskbar with a glowing bulb above it; grey chrome, warm yellow glow |
| `coolant` | a blue snowflake on a CPU chip with two pipes running off the edge; ice blue `#3399cc` |

Do **not** draw text, numbers or UI labels into the icons — the game draws every label.

## 8. Tests (smoke)

Add a numbered block to `scripts/smoke.mjs`:

1. `GLOBAL_UPGRADES` has exactly 14 entries with unique ids, and every id has a matching
   `public/art/upgrades/<id>.svg`.
2. Every def's `wave` is between 20 and 60 and every cost is between 1,000 and 30,000.
3. `revealedUpgrades` hides everything above the current wave and reveals at exactly `def.wave`.
4. `buyUpgrade` refuses an unrevealed id, refuses a second purchase, refuses when short of salvage,
   and on success subtracts exactly `def.cost` and records the id once.
5. A fresh `createRunState` has `upgrades: []`, `emergencyPatchSpent: false`, `buff: null`.
6. `towerCost` drops 4 % per owned copy under `bulk-requisition`, floors at −40 %, and ignores walls.
7. A killing leak with `emergency-patch` leaves integrity at 1 and spends the patch; a second leak
   behaves normally.
8. `compound-interest` pays `floor(salvage * 0.015)` once per cleared wave and not on a build-phase
   tick.
9. `autoloader` shortens a known tower's interval by 13 % and never below one tick.
10. `coolant` raises the run-local overclock cap to 16 and leaves it at 12 without it.
11. `chain-reaction` splashes two neighbours on a killing click and does not chain further.
12. `bounty-board` doubles a boss's kill value and multiplies its spawn HP by 1.1.
13. `runUpgradeArt` copies only missing files and is idempotent on a throwaway directory (mirror the
    existing `ach-art` test).
14. Every upgrade's `line` is 46 characters or fewer and every `detail` is non-empty.

## 9. Definition of done

- `npm run build` and `npm run smoke` pass, with the new block green.
- The 14 placeholder icons exist and every one is reachable in the dialog once its wave is reached.
- The HUD section shows both rows, and Restore is still reachable from it.
- `docs/design.md` gains a §23 pointing at this document, and the HUD section comment about an
  "empty reserved section" is gone.
- No behaviour changes when no upgrade is owned: the first run is byte-identical in the harness.

## 10. Out of scope

- Persisting upgrades across a reboot, or selling them back.
- Any upgrade that changes wave composition (the wave hash stays stable).
- New achievements for owning upgrades.
- Steam/Electron surface: nothing here touches it.
