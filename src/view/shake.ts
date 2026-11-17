import { TICK_MS } from '../core/time.ts';
import type { GameEvent } from '../core/state.ts';

/**
 * Camera shake: a render-only offset applied to the scene root so the whole window frame — chrome,
 * board, HUD, cursor, tooltip — moves as one, as if the desktop itself is shuddering. It never
 * touches the simulation: the sim's tick is only read as a seed, so a replay produces the same
 * shake and the balance harness is untouched.
 *
 * Amplitudes are in CSS pixels and decay over ~200 ms, hard-capped at 400 ms, so the small events
 * read as weight and only the rare ones (boss death, leak, a shutter slamming) earn a real move.
 */

export const SHAKE_AMPLITUDE = {
  enemyDeath: 1,
  towerHit: 1,
  popupClose: 2,
  bossDeath: 4,
  leak: 5,
  toggleShut: 3,
} as const;

/** A leak also freezes the frame for a beat so the integrity loss lands. */
export const SHAKE_LEAK_FREEZE_MS = 60;

/** A shake decays to nothing in 12 ticks (200 ms). */
export const SHAKE_DECAY_TICKS = 12;
/** Hard cap: a single impulse never shakes for longer than 24 ticks (400 ms). */
export const SHAKE_MAX_TICKS = 24;

export interface ShakeImpulse {
  amplitude: number;
  freezeMs: number;
}

/** The impulse a sim event should add to the camera, or null when it shakes nothing. */
export function shakeImpulseFor(ev: GameEvent): ShakeImpulse | null {
  switch (ev.type) {
    case 'kill':
      return ev.kind === 'boss'
        ? { amplitude: SHAKE_AMPLITUDE.bossDeath, freezeMs: 0 }
        : { amplitude: SHAKE_AMPLITUDE.enemyDeath, freezeMs: 0 };
    case 'wallDamaged':
    case 'wallDestroyed':
      return { amplitude: SHAKE_AMPLITUDE.towerHit, freezeMs: 0 };
    case 'popupDismissed':
      return { amplitude: SHAKE_AMPLITUDE.popupClose, freezeMs: 0 };
    case 'leak':
      return { amplitude: SHAKE_AMPLITUDE.leak, freezeMs: SHAKE_LEAK_FREEZE_MS };
    case 'toggleChanged':
      return ev.open ? null : { amplitude: SHAKE_AMPLITUDE.toggleShut, freezeMs: 0 };
    default:
      return null;
  }
}

/** A deterministic unit float in [0, 1) for a given integer seed (mulberry32-style hash). */
function hashUnit(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
}

export class CameraShake {
  enabled = true;
  private magnitude = 0;
  private startTick = 0;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Add an impulse. `freezeMs` holds the offset at zero for that long before the shake starts. */
  impulse(amplitude: number, tick: number, freezeMs = 0): void {
    const freezeTicks = freezeMs > 0 ? Math.round(freezeMs / TICK_MS) : 0;
    this.magnitude = Math.max(this.magnitude, amplitude);
    this.startTick = Math.max(this.startTick, tick + freezeTicks);
  }

  /** The render-space offset for the given sim tick, in CSS pixels. */
  offset(tick: number): { x: number; y: number } {
    if (!this.enabled || this.magnitude <= 0) return { x: 0, y: 0 };
    const age = tick - this.startTick;
    if (age < 0 || age >= SHAKE_MAX_TICKS) return { x: 0, y: 0 };
    const m = this.magnitude * Math.max(0, 1 - age / SHAKE_DECAY_TICKS);
    if (m <= 0.01) return { x: 0, y: 0 };
    const angle = hashUnit(tick) * Math.PI * 2;
    const radial = 0.75 + 0.25 * hashUnit(tick ^ 0x9e3779b9);
    const r = m * radial;
    return { x: Math.cos(angle) * r, y: Math.sin(angle) * r };
  }
}
