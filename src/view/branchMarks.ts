import { isRepairing, type Branch, type Tower, type TowerKind } from '../core/towers.ts';

/**
 * Branch marks and the fully-upgraded pip, kept Pixi-free so the smoke test can assert that every
 * branch carries a distinct mark and that a damaged wall's pip never collides with its health bar.
 * board.ts turns these specs into Graphics calls, exactly as it turns wallAppearance's specs into
 * button bevels.
 *
 * Marks are drawn with the tower's own fill and outline colours — shape, not colour, carries the
 * identity, so the grey Windows palette cannot wash a branch out. Coordinates are cell fractions
 * relative to the tower centre (1.0 = one tile), y increasing downward; board.ts multiplies by the
 * live cell size. Every mark is small and sits on the body so it never crowds the barrel.
 */

export interface MarkRect {
  type: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MarkLine {
  type: 'line';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface MarkPoly {
  type: 'poly';
  pts: number[];
}

export interface MarkRing {
  type: 'ring';
  x: number;
  y: number;
  r: number;
}

export interface MarkArc {
  type: 'arc';
  x: number;
  y: number;
  r: number;
  a0: number;
  a1: number;
}

export type MarkPrimitive = MarkRect | MarkLine | MarkPoly | MarkRing | MarkArc;

export interface BranchMarkSpec {
  readonly kind: TowerKind;
  readonly branch: Branch;
  readonly primitives: readonly MarkPrimitive[];
}

/** The mark primitives for each branched kind. Walls carry their identity in wallSpec, not here. */
const MARK_PRIMITIVES: Readonly<Record<TowerKind, Readonly<Partial<Record<Branch, readonly MarkPrimitive[]>>>>> = {
  gun: {
    // Marksman: one long barrel with a sight notch above it.
    A: [
      { type: 'line', x1: -0.05, y1: -0.54, x2: 0, y2: -0.62 },
      { type: 'line', x1: 0.05, y1: -0.54, x2: 0, y2: -0.62 },
    ],
    // Repeater: two short barrels side by side.
    B: [
      { type: 'rect', x: -0.14, y: -0.18, w: 0.08, h: 0.12 },
      { type: 'rect', x: 0.06, y: -0.18, w: 0.08, h: 0.12 },
    ],
  },
  cannon: {
    // Mortar: a short fat tube tilted up with a wide muzzle.
    A: [
      { type: 'poly', pts: [-0.06, -0.02, 0.04, -0.18, 0.2, -0.02, 0.1, 0.14] },
      { type: 'rect', x: 0.13, y: -0.22, w: 0.13, h: 0.05 },
    ],
    // Flak (until Minesweeper lands): keeps the tilted tube, no hatch and no wide muzzle.
    B: [
      { type: 'poly', pts: [-0.02, -0.02, 0.02, -0.18, 0.14, -0.02, 0.1, 0.14] },
    ],
  },
  taser: {
    // Arc: two prongs with a two-pixel spark between them.
    A: [
      { type: 'line', x1: -0.08, y1: -0.04, x2: -0.08, y2: -0.26 },
      { type: 'line', x1: 0.08, y1: -0.04, x2: 0.08, y2: -0.26 },
      { type: 'rect', x: -0.02, y: -0.28, w: 0.04, h: 0.04 },
    ],
    // Overload: one heavy coil with a ring around its base.
    B: [
      { type: 'rect', x: -0.06, y: -0.12, w: 0.12, h: 0.24 },
      { type: 'ring', x: 0, y: 0.16, r: 0.07 },
    ],
  },
  frost: {
    // Deep Freeze: a six-spoke snowflake emblem.
    A: [
      { type: 'line', x1: -0.14, y1: 0, x2: 0.14, y2: 0 },
      { type: 'line', x1: -0.07, y1: -0.12, x2: 0.07, y2: 0.12 },
      { type: 'line', x1: -0.07, y1: 0.12, x2: 0.07, y2: -0.12 },
    ],
    // Shard: three angled shards.
    B: [
      { type: 'line', x1: 0, y1: 0.02, x2: 0, y2: -0.22 },
      { type: 'line', x1: 0, y1: 0.02, x2: -0.12, y2: -0.16 },
      { type: 'line', x1: 0, y1: 0.02, x2: 0.12, y2: -0.16 },
    ],
  },
  laser: {
    // Focus: a lens ring around the muzzle.
    A: [
      { type: 'ring', x: 0, y: -0.36, r: 0.05 },
    ],
    // Prism: a small triangle in front of the muzzle.
    B: [
      { type: 'poly', pts: [0, -0.44, -0.06, -0.36, 0.06, -0.36] },
    ],
  },
  beacon: {
    // Command: a four-point star on the cap.
    A: [
      { type: 'poly', pts: [0, 0.02, 0.09, 0.12, 0, 0.22, -0.09, 0.12] },
    ],
    // Relay: two nested arcs above the cap.
    B: [
      { type: 'arc', x: 0, y: 0.2, r: 0.07, a0: Math.PI, a1: Math.PI * 2 },
      { type: 'arc', x: 0, y: 0.2, r: 0.13, a0: Math.PI, a1: Math.PI * 2 },
    ],
  },
  // Walls and cursors carry their branch identity elsewhere: the wall's button states and the
  // cursor's flying-arrow behaviour. No mark is drawn for them.
  wall: {},
  cursor: {},
};

/** The mark for a tower's branch, or null when the branch (or kind) has no mark. */
export function branchMarkSpec(kind: TowerKind, branch: Branch | null): BranchMarkSpec | null {
  if (branch === null) return null;
  const primitives = MARK_PRIMITIVES[kind][branch];
  if (primitives === undefined) return null;
  return { kind, branch, primitives };
}

export const PIP_SIZE = 4;
/** The pip's saturated green fill — the only saturated colour on the board. */
export const PIP_FILL = 0x008000;
/** The pip's 1 px top-left highlight. */
export const PIP_HIGHLIGHT = 0x00ff00;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The wall health/progress bar rectangle (drawn above the tile), for the pip's collision rule. */
export function healthBarRect(cx: number, cy: number, cell: number): Rect {
  const w = Math.round(cell * 0.8);
  const x0 = Math.round(cx - w / 2);
  const y0 = Math.round(cy - cell * 0.5 - 6);
  return { x: x0, y: y0, w, h: 3 };
}

/** The fully-upgraded pip rectangle: 4x4 in the top-right corner, or bottom-right when `bottom`. */
export function pipRect(cx: number, cy: number, cell: number, bottom: boolean): Rect {
  const tx = cx - cell / 2;
  const ty = cy - cell / 2;
  const x = Math.round(tx + cell - PIP_SIZE - 1);
  const y = Math.round(bottom ? ty + cell - PIP_SIZE - 1 : ty + 1);
  return { x, y, w: PIP_SIZE, h: PIP_SIZE };
}

/** True when the pip must use the bottom corner to stay clear of a damaged wall's health bar. */
export function pipUsesBottomCorner(tower: Tower, clock: number): boolean {
  return tower.kind === 'wall' && tower.maxHp > 0 && tower.hp < tower.maxHp && !isRepairing(tower, clock);
}
