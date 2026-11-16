import { TICK_HZ } from './time.ts';

/**
 * The pointer as a weapon. Stages follow docs/design.md; this slice implements 1 and 2.
 *
 * Stage 1: a bare click — fixed damage on the enemy under the cursor.
 * Stage 2: a targeting reticle — additionally, the last enemy you clicked becomes the held target
 *          and takes damage over time while the mouse button is held down on the board.
 *
 * Click damage ignores armour and is the only thing that can break shields.
 */

export type PointerStage = 1 | 2;
export const MAX_POINTER_STAGE: PointerStage = 2;

export interface PointerStageInfo {
  readonly name: string;
  /** Cost to reach this stage from the previous one (0 for stage 1). */
  readonly cost: number;
  readonly clickDamage: number;
  /** Damage per second applied to the held target. */
  readonly holdDps: number;
}

export const POINTER_STAGES: Readonly<Record<PointerStage, PointerStageInfo>> = {
  1: { name: 'Click', cost: 0, clickDamage: 3, holdDps: 0 },
  2: { name: 'Reticle', cost: 80, clickDamage: 4, holdDps: 10 },
};

export interface PointerState {
  stage: PointerStage;
  /** Enemy the reticle is locked on (stage 2+), or null. */
  targetId: number | null;
  /** Whether the button is held on the board; reticle DoT only ticks while held. */
  held: boolean;
  /** Last known cursor position in world units (tiles). */
  x: number;
  y: number;
}

export function createPointer(): PointerState {
  return { stage: 1, targetId: null, held: false, x: -10, y: -10 };
}

/** Distance (tiles) the cursor may drift off a locked target before the reticle lets go. */
export const RETICLE_STICKY = 0.6;

export function pointerInfo(p: PointerState): PointerStageInfo {
  return POINTER_STAGES[p.stage];
}

/** Cost of the next stage, or null at the top of this slice's stage list. */
export function nextStageCost(p: PointerState): number | null {
  if (p.stage >= MAX_POINTER_STAGE) return null;
  return POINTER_STAGES[(p.stage + 1) as PointerStage].cost;
}

export function holdDamagePerTick(p: PointerState): number {
  return pointerInfo(p).holdDps / TICK_HZ;
}

/** Radius of slack (tiles) added to enemy hitboxes for click hit tests, so tiny runners are fair. */
export const CLICK_SLACK = 0.15;
