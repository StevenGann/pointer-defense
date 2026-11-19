# Art loading

Live measurement, 2026-11-19, cold load of `stevengann.com/pointer-defense`:

- 231 SVG requests, 161 KB total.
- First response done at **6.9 s**, median at **31.3 s**, last at **38.0 s** after navigation.
- Median request duration 99 ms, p90 624 ms. The payload is trivial; the count is the cost.

The loader fetches and decodes **every** asset at startup, six at a time. 231 round trips at ~100 ms
each, over six lanes, is half a minute before the last achievement icon exists — long after the
player is already looking at a board drawn with procedural fallbacks.

## Goal

The first playable frame should need the art of the first playable frame, and nothing else. Everything
else loads when something asks for it, or during idle time.

## Contract

Draw calls stay synchronous. `getArtFrames(name, px)` either returns textures or an empty list, as
today; a miss is also a request. The caller keeps its procedural fallback and picks up the art on the
next invalidation. No call site changes.

## Queue

- `requestArt(name, priority)` — no-op when the asset is loaded or already queued.
- Priorities: `now` (something on screen asked for it this frame) and `idle` (speculative warm-up).
  A `now` request is served before any `idle` request, including ones already queued.
- `getArtFrames` calls `requestArt(name, 'now')` on a miss. Its cost must stay trivial: a Map lookup
  and an early return when the asset is already known, since the draw loop hits it every frame.
- `idle` work is started from `requestIdleCallback` (fallback `setTimeout(…, 200)` where it is
  missing), one asset at a time, and yields whenever a `now` request is outstanding or the idle
  deadline runs out. A busy 60fps loop can starve `requestIdleCallback`, so a 400 ms timer is armed
  alongside it; whichever fires first runs the slice and cancels the other.
- Network concurrency stays 6 (`PRELOAD_CONCURRENCY`). Decoding is main-thread CPU work, so at most
  one decode is in flight per idle slice; `now` requests may decode immediately.
- A failed asset is retried once, then left absent with one warning, as today.

## Eager set

Only the art the opening frame can show:

- board: `tile`, `path-tile`, `obstacle`, `block`
- ui: `cursor-arrow`, `offline-wrench`, `shutter-open`, `shutter-closed`

That is nine files. `preloadArt()` resolves once those are in place, so `main.ts`'s "ready" path is
unchanged, and the rest of the manifest becomes an `idle` queue.

## Invalidation

Each completed asset calls `scheduleArtInvalidate()`. The existing coalescing keeps a burst to one
callback. This is what makes a lazily loaded texture appear without a reload.

## Measurement

`preloadArt()` should record and expose, for the smoke run and for a temporary console probe:

- `artQueueLength()` — assets still queued or in flight.
- `artLoadStats()` — `{ requested, loaded, failed, firstMs, lastMs }` since page start.

These are cheap counters, not timers per asset.

## Smoke assertions

1. Requesting the same name twice queues it once.
2. A `getArtFrames` miss returns an empty list and queues the asset (fallback preserved).
3. A `now` request is served before an earlier-queued `idle` request.
4. `preloadArt()` leaves the long tail queued rather than loading it: after the eager set, the queue
   holds the remaining manifest entries.
5. A completed asset triggers exactly one invalidation.
6. Assets still absent return the same empty list as before, so no caller's fallback breaks.

## Out of scope

Sprite sheets, manifest format changes, inlining SVGs, and any change to how a texture is
rasterised per pixel size.
