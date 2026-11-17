import type { Branch } from '../core/towers.ts';

/**
 * The wall tower's Windows-button look, kept Pixi-free so the smoke test can check every state
 * (and confirm no brick strokes are produced) without a renderer. board.ts turns these specs into
 * Graphics calls; the colours are the Win95 button bevel.
 *
 * All states come from bevels: a raised button, a disabled button (softened bevel, lighter face),
 * or a pressed-in button (inverted bevel, darker face). Every state also carries a grey footprint
 * outline so the control reads at 1x. Bulwark adds an inner raised rim, Mesh adds a crosshatch, and
 * damage reads through the bevel.
 */

export const WALL_FACE = 0xc0c0c0;
export const WALL_FACE_DISABLED = 0xcccccc;
export const WALL_FACE_PRESSED = 0xb0b0b0;

/** The 1 px border that separates the whole footprint from the board tile underneath it. */
export const WALL_OUTLINE = 0x808080;

export const RAISED_TL: readonly [number, number] = [0xffffff, 0xdfdfdf];
export const RAISED_BR: readonly [number, number] = [0x404040, 0x808080];

const DISABLED_TL: readonly [number, number] = [0xe8e8e8, 0xe0e0e0];
const DISABLED_BR: readonly [number, number] = [0x909090, 0xacacac];

const PRESSED_TL: readonly [number, number] = [0x000000, 0x808080];
const PRESSED_BR: readonly [number, number] = [0xffffff, 0xdfdfdf];

export const HATCH_SPACING = 4;
export const WALL_FOCUS_INSET = 4;

/** The subset of a tower the wall look depends on, so the placement ghost can reuse the same spec. */
export interface WallState {
  readonly branch: Branch | null;
  readonly open: boolean;
  readonly hp: number;
  readonly maxHp: number;
  /** A Toggle gate whose flip cooldown is still running: draw it as a disabled button. */
  readonly locked?: boolean;
}

export interface WallSpec {
  readonly face: number;
  /** Bevel top/left colours, outer then inner. */
  readonly tl: readonly [number, number];
  /** Bevel bottom/right colours, outer then inner. */
  readonly br: readonly [number, number];
  /** Bulwark: draw a second, inner raised rim. */
  readonly innerRim: boolean;
  /** Mesh: draw a crosshatch fill. */
  readonly crosshatch: boolean;
}

/** Linear interpolation between two 0xRRGGBB colours. */
export function lerpColor(a: number, b: number, t: number): number {
  const k = Math.max(0, Math.min(1, t));
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;
  const r = Math.round(ar + (br - ar) * k);
  const g = Math.round(ag + (bg - ag) * k);
  const bl = Math.round(ab + (bb - ab) * k);
  return (r << 16) | (g << 8) | bl;
}

export function wallSpec(wall: WallState): WallSpec {
  const branch = wall.branch;
  const open = wall.open;
  const locked = wall.locked === true;

  let face = WALL_FACE;
  let tl: readonly [number, number] = RAISED_TL;
  let br: readonly [number, number] = RAISED_BR;
  let pressed = false;

  if (branch === null || locked) {
    // A plain wall is a raised but disabled button: softened bevel, a shade lighter face. A locked
    // Toggle uses the same disabled look so the player can see it is not pressable.
    face = WALL_FACE_DISABLED;
    tl = DISABLED_TL;
    br = DISABLED_BR;
  } else if (branch === 'C' && open) {
    // An open Toggle is the same button pressed in.
    face = WALL_FACE_PRESSED;
    tl = PRESSED_TL;
    br = PRESSED_BR;
    pressed = true;
  }

  // Damage reads through the bevel. An open gate cannot be damaged, but the guard keeps a dying
  // pressed wall from being read as anything else.
  if (wall.hp < wall.maxHp && !pressed && !locked) {
    const ratio = wall.maxHp > 0 ? wall.hp / wall.maxHp : 0;
    if (ratio < 1 / 3) {
      face = WALL_FACE_PRESSED;
      tl = PRESSED_TL;
      br = PRESSED_BR;
    } else if (ratio <= 2 / 3) {
      const fade = 2 - 3 * ratio; // 1 at one third, 0 at two thirds
      tl = [lerpColor(tl[0], face, fade), tl[1]];
    }
  }

  return {
    face,
    tl,
    br,
    innerRim: branch === 'A',
    crosshatch: branch === 'B',
  };
}

/** The wall footprint: `cell - 6` px, centred, so the grid lines still read around it. */
export function wallFootprintSize(cell: number): number {
  return cell - 6;
}

export interface Seg {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Both diagonal families of a 1 px crosshatch, clipped to the square and spaced `spacing` px. */
export function hatchSegments(x: number, y: number, size: number, spacing: number): Seg[] {
  const a = x;
  const b = y;
  const l = size;
  const out: Seg[] = [];

  // Down-right lines: y = x + c.
  const cMin = b - (a + l);
  const cMax = b + l - a;
  for (let c = cMin; c <= cMax; c += spacing) {
    const xin = Math.max(a, b - c);
    const xout = Math.min(a + l, b + l - c);
    if (xin < xout) out.push({ x1: xin, y1: xin + c, x2: xout, y2: xout + c });
  }

  // Down-left lines: x + y = c.
  const cStart = a + b;
  const cEnd = a + b + 2 * l;
  for (let c = cStart; c <= cEnd; c += spacing) {
    const xin = Math.max(a, c - (b + l));
    const xout = Math.min(a + l, c - b);
    if (xin < xout) out.push({ x1: xin, y1: c - xin, x2: xout, y2: c - xout });
  }

  return out;
}

/** The dotted focus rectangle, inset `WALL_FOCUS_INSET` px from the tile edge, centred on the tile. */
export function wallFocusRect(cx: number, cy: number, cell: number): { x: number; y: number; w: number; h: number } {
  const w = cell - WALL_FOCUS_INSET * 2;
  return { x: cx - w / 2, y: cy - w / 2, w, h: w };
}
