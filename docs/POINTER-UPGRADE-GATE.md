# The pointer upgrade button tells the truth

Tester note: "grey out the upgrade button if you have enough cash but not enough wave levels was
confusing for a sec."

The Overclock ladder buys one level per eight waves. The HUD enables the Upgrade button on
affordability alone, so a player with the cash and a wave ceiling in the way gets a live-looking
button that silently refuses the purchase. `buyOverclock` guards it
(`clickLevel + 1 > overclockCeiling(...)`), but nothing on screen says so.

## Fix

One pure helper owns the answer, next to the ladder it describes:

```ts
export type PointerUpgradeBlock = 'maxed' | 'wave' | null;

export interface PointerUpgradeState {
  /** Cost of the next purchase, or null when there is nothing left to buy. */
  readonly cost: number | null;
  readonly block: PointerUpgradeBlock;
  /** The wave that lifts a 'wave' block, or null when the block is not a wave block. */
  readonly unlockWave: number | null;
}

export function pointerUpgradeState(wave: number, cap: number, p: PointerState): PointerUpgradeState;
```

- Stage 1 to 2: `{ cost: 80, block: null, unlockWave: null }`.
- Stage 2, an overclock level left under the ceiling: `{ cost, block: null, unlockWave: null }`.
- Stage 2, the next level is above the ceiling: `{ cost, block: 'wave', unlockWave: overclockUnlockWave(clickLevel + 1) }`.
- At the ladder's top: `{ cost: null, block: 'maxed', unlockWave: null }`.

## HUD

- The Upgrade button draws disabled whenever `block !== null`, not merely when the price is out of
  reach. Same greyed look and same non-clickable hit-test the shop uses for towers you cannot afford.
- The label keeps the price. The button's tooltip gains a line: `Needs wave 16 — one overclock level
  every 8 waves.` Blue.
- The Overclock row already prints `Overclock 2 / 2`, which reads as "at the ceiling". Leave it.
- Nothing else changes: owning Coolant Loop raises the cap and the button re-enables on the next
  frame, because the helper asks the same `overclockCap(s)` the purchase does.

## Tests

1. Wave 7, stage 2, clickLevel 0: block `wave`, unlockWave 8, cost 1845.
2. Wave 8, same state: block `null`.
3. clickLevel at the cap: block `maxed`, cost null.
4. With Coolant Loop's raised cap, a level above 12 is blocked by `wave` rather than `maxed`.
5. `hudButtonAt` over the pointer's Upgrade rect reports `enabled: false` when the block is `wave`,
   and `true` once the wave arrives.
6. The tooltip line names the unlocking wave.
