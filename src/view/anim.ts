import { TICK_HZ } from '../core/time.ts';

/**
 * Frame-sequence animation clock.
 *
 * An asset's frames are driven by **simulation ticks**, never wall-clock time, so pausing the sim
 * freezes the walk cycle and a x2/x3 speed change plays it faster without the view needing to know
 * about either. The whole thing is a pure function of (ticks since spawn, fps, loop mode, holds, and
 * a per-entity offset), which is why it lives in its own module with no Pixi or DOM dependency — the
 * smoke harness imports it directly.
 *
 * A still asset is a one-frame sequence: `animFrame` returns 0 the moment `frameCount` is 1, so the
 * "still" path costs nothing and every caller (enemies, towers, effects) can run the same code.
 */

export type LoopMode = 'loop' | 'pingpong' | 'once' | 'hold0';
export type WhenMode = 'always' | 'moving';

export interface AnimMeta {
  /** Frames per second, 1..60. */
  readonly fps: number;
  /** How the sequence advances: loop, pingpong, once (stay on the last frame), or hold0 (return to 0). */
  readonly loop: LoopMode;
  /** Seconds to show frame 0 before the sequence starts (ignored when `randomStart` is true). */
  readonly hold: number;
  /** Seconds to hold the final frame before restarting (loop and pingpong only). */
  readonly holdAfter: number;
  /** Offset each instance into the sequence by a deterministic hash of its entity id. */
  readonly randomStart: boolean;
  /** `moving` plays only while the entity is actually travelling; stopped sits on frame 0. */
  readonly when: WhenMode;
}

export const DEFAULT_ANIM: AnimMeta = {
  fps: 8,
  loop: 'loop',
  hold: 0,
  holdAfter: 0,
  randomStart: true,
  when: 'always',
};

/**
 * A deterministic 32-bit hash of an entity id, used only to spread a crowd's animation phase. It
 * never touches the simulation RNG stream, so a run's balance numbers are unaffected by how many
 * enemies are on screen.
 */
export function entityOffset(entityId: number): number {
  let h = entityId >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = (h ^ (h >>> 16)) >>> 0;
  return h;
}

/** Whole ticks for a duration in seconds (0 stays 0 — a hold of zero is not a one-tick pause). */
function secondsToWholeTicks(seconds: number): number {
  return Math.round(seconds * TICK_HZ);
}

/**
 * The frame index for an animation at `ticksSinceSpawn`, ignoring `when` (the caller decides whether
 * the entity is moving and gates frame 0 through `currentAnimFrame`). Pure: same inputs, same frame.
 *
 * All loop arithmetic is done in whole "frame units" — `ticks * fps` — so a frame boundary is an
 * exact integer division and no float drift can make a 60 Hz and a 144 Hz run disagree. `fps` that
 * does not divide 60 simply yields alternating 7/8-tick frames (e.g. 8 fps = one frame per 7.5 ticks).
 */
export function animFrame(
  anim: AnimMeta,
  frameCount: number,
  ticksSinceSpawn: number,
  entityId: number,
): number {
  const n = Math.max(1, Math.floor(frameCount));
  if (n <= 1) return 0;

  const fps = Math.max(1, Math.min(60, anim.fps));
  const holdAfterUnits = secondsToWholeTicks(anim.holdAfter) * fps;

  // The full cycle length in frame units (a frame is TICK_HZ ticks). `once` and `hold0` do not loop,
  // so their "cycle" is just the one forward pass, which bounds the randomStart offset.
  let cycleUnits: number;
  if (anim.loop === 'pingpong') cycleUnits = (2 * n - 2) * TICK_HZ + holdAfterUnits;
  else if (anim.loop === 'loop') cycleUnits = n * TICK_HZ + holdAfterUnits;
  else cycleUnits = n * TICK_HZ;

  const offsetUnits = anim.randomStart ? entityOffset(entityId) % cycleUnits : 0;
  const baseTicks = anim.randomStart ? ticksSinceSpawn : ticksSinceSpawn - secondsToWholeTicks(anim.hold);
  const units = baseTicks * fps + offsetUnits;
  if (units < 0) return 0; // still inside the pre-sequence hold

  switch (anim.loop) {
    case 'once': {
      const k = Math.floor(units / TICK_HZ);
      return Math.min(k, n - 1);
    }
    case 'hold0': {
      const k = Math.floor(units / TICK_HZ);
      return k < n ? k : 0;
    }
    case 'pingpong': {
      const cycleFrames = 2 * n - 2;
      const framesUnits = cycleFrames * TICK_HZ;
      const pos = units % cycleUnits;
      const k = pos < framesUnits ? Math.floor(pos / TICK_HZ) : cycleFrames - 1;
      return k < n ? k : 2 * n - 2 - k;
    }
    case 'loop':
    default: {
      const framesUnits = n * TICK_HZ;
      const pos = units % cycleUnits;
      return pos < framesUnits ? Math.floor(pos / TICK_HZ) : n - 1;
    }
  }
}

/**
 * The frame a caller should draw: `animFrame`, but `when: "moving"` holds frame 0 whenever the entity
 * is stopped (a Breacher chewing a wall must not look like it is walking).
 */
export function currentAnimFrame(
  anim: AnimMeta,
  frameCount: number,
  ticksSinceSpawn: number,
  entityId: number,
  moving: boolean,
): number {
  if (anim.when === 'moving' && !moving) return 0;
  return animFrame(anim, frameCount, ticksSinceSpawn, entityId);
}
