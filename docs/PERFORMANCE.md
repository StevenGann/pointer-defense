# Frame budget: the wave-stacking cliff

Stacking waves is the one situation the game handles badly. The cause is not the simulation — it is
measured at **0.45 ms per tick with 984 enemies on screen** (linear, ~3 % of a frame at 60 Hz). The
cause is drawing: every enemy costs a body sprite, a shadow sprite, a health bar and effect paths,
and every frame redraws layers that did not change. This document sets out the fixes, in the order
they pay.

## What the numbers say

- Simulation: 0.18 ms/tick at 800 enemies, 0.45 ms/tick at 984. Not the problem.
- Game JS per frame at 800 enemies: board 0.38 ms, effects 0.02 ms, HUD 0.94 ms. Not the problem.
- Frame time collapses when the viewport shrinks (1280×720 → 480×270 took a 6× slower software
  renderer from 175 ms to 30 ms). The cost is **pixels and draw submissions**, not logic.

So the work is: submit fewer pixels and fewer draw calls, and stop redrawing what has not changed.

## 1. A frame-time governor (adaptive quality)

A pure state machine, `src/core/quality.ts`:

```ts
export type QualityLevel = 'full' | 'no-shadows' | 'lean';
export function nextQuality(current: QualityLevel, frameMs: number, samples: number): QualityLevel
```

- Frame time is sampled as an exponential moving average over 30 frames (one frame is noise).
- Above **22 ms** for that window, step down one level: `full → no-shadows → lean`.
- Below **14 ms** for 120 frames, step back up one level. The asymmetry (fast down, slow up) stops
  it oscillating at the boundary.
- `no-shadows` skips the shadow sprite for every enemy except bosses and the Carrier.
- `lean` additionally skips tower auras, wrenches and the frame-motion of the tip marquee.
- The governor never changes the simulation, only what is drawn. A run's outcome cannot depend on it.
- `?quality=full` pins the level for comparison; the HUD status bar shows `Q: lean` when the level is
  below full, in the same slot as the speed indicator.

## 2. Stop redrawing static layers

- **Route layer**: the route is rebuilt every frame with thick strokes over the whole board. Key it by
  `routeKey(state)` (the tile lists plus cell size) and redraw only when the key changes — on tower
  placement, sale, toggle, or a map change.
- **Health bars**: a bar is drawn only for an enemy that has taken damage (`hp < maxHp`), for a shield
  or a boss. Full-health enemies get nothing, which is most of the board in the first seconds of a
  wave.
- **Tower range overlays** already redraw only while hovered; leave them.

## 3. Submit fewer sprites

- **Shadows**: drawn for every enemy in `full`, bosses/Carrier only in `no-shadows`, none in `lean`.
- **Damage numbers** (`numbers.ts`): cap the number of live floaters at 40, oldest dropped first.
  Under a stacked wave the cap is what keeps the text layer from becoming the largest thing on
  screen.

## 4. Renderer settings

- `antialias: false` on the Pixi application. This is a pixel-art UI with vector art that is already
  rendered at device resolution; MSAA buys nothing visible here and costs fill rate on every pixel
  the game draws. Keep `resolution: devicePixelRatio` (crisp text matters more than MSAA).
- Nothing else about the renderer changes.

## 5. Dev instrumentation (kept, off by default)

- `?prof=1` accumulates per-stage draw timings into `window.__perf` (`board`, `effects`, `numbers`,
  `hud`, …), each `{sum, max, n}`.
- `?hide=route,shadows,enemies,fx` skips those layers, for bisecting a regression.
- `?fps=1` draws a frame-time readout in the HUD status bar (`16.7 ms · 60/s · Q: full`).
- None of these cost anything when the parameters are absent: the checks run once at boot.

## Tests

1. The governor steps down above 22 ms after 30 samples, steps up below 14 ms after 120, and never
   oscillates on an alternating 21/15 ms sequence.
2. A pinned level (`?quality=full`) never changes.
3. The route key changes on a tower placement and does not change across ticks with no building.
4. Health bars are drawn for damaged enemies and bosses, not for full-health grunts.
5. The damage-number cap keeps the newest 40.
6. A 900-tick determinism hash with the governor pinned to `lean` equals the one at `full`.
