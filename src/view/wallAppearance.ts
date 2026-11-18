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
  /** The wall's tier (1..3 today), which picks the base face plate. Defaults to 1 for the ghost. */
  readonly tier?: number;
  /** A Toggle gate whose flip cooldown is still running: draw it as a disabled button. */
  readonly locked?: boolean;
  /** A wall mid-repair: draw it as a disabled button with a diagonal hatch over the face. */
  readonly repairing?: boolean;
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
  /** Repair: draw a diagonal hatch over the whole face. */
  readonly hatched: boolean;
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

/**
 * The wall's button spec *before* damage is applied: the face shade and bevel for the wall's live
 * state (plain / branched / open gate / locked / repairing). Damage is drawn separately — as the
 * three `wall-damaged-*` overlays in the art path, or as the bevel change below in the procedural
 * fallback — so the two never fight over the same shade.
 */
export function wallButtonSpec(wall: WallState): WallSpec {
  const branch = wall.branch;
  const open = wall.open;
  const locked = wall.locked === true;
  const repairing = wall.repairing === true;

  let face = WALL_FACE;
  let tl: readonly [number, number] = RAISED_TL;
  let br: readonly [number, number] = RAISED_BR;

  if (repairing) {
    // A mid-repair wall is off the field: a disabled button under a diagonal hatch, so the player
    // reads "out of service" at a glance and the progress bar owns the health readout.
    face = WALL_FACE_DISABLED;
    tl = DISABLED_TL;
    br = DISABLED_BR;
  } else if (branch === null || locked) {
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
  }

  return {
    face,
    tl,
    br,
    innerRim: !repairing && branch === 'A',
    crosshatch: !repairing && branch === 'B',
    hatched: repairing,
  };
}

export function wallSpec(wall: WallState): WallSpec {
  const spec = wallButtonSpec(wall);
  const repairing = wall.repairing === true;
  const locked = wall.locked === true;
  const pressed = wall.branch === 'C' && wall.open;

  // Damage reads through the bevel. An open gate cannot be damaged, and a repair has already painted
  // its own state, so neither participates in the damage read.
  if (!repairing && wall.hp < wall.maxHp && !pressed && !locked) {
    const ratio = wall.maxHp > 0 ? wall.hp / wall.maxHp : 0;
    if (ratio < 1 / 3) {
      return { ...spec, face: WALL_FACE_PRESSED, tl: PRESSED_TL, br: PRESSED_BR };
    }
    if (ratio <= 2 / 3) {
      const fade = 2 - 3 * ratio; // 1 at one third, 0 at two thirds
      return { ...spec, tl: [lerpColor(spec.tl[0], spec.face, fade), spec.tl[1]] };
    }
  }

  return spec;
}

/**
 * The damage stage, in integer thirds, so the boundary never flickers: stage 1 is the top third of
 * health (light scuffs), stage 2 the middle third, stage 3 the bottom third. A full wall is stage 0.
 * Integer comparisons (`3·hp` against `maxHp` and `2·maxHp`) keep the cut lines exact, so a wall at
 * exactly one- or two-thirds of its pool lands on the same stage every tick.
 */
export function wallDamageStage(hp: number, maxHp: number): number {
  if (maxHp <= 0 || hp >= maxHp) return 0;
  if (hp * 3 < maxHp) return 3;
  if (hp * 3 < maxHp * 2) return 2;
  return 1;
}

/** The art a wall draws: a single tier face plate plus zero or more overlays, in draw order. */
export interface WallArt {
  /** The base face asset name (`wall-t1`..`wall-t5`), tinted to the live button grey. */
  readonly face: string;
  /** Overlay asset names in draw order: a branch mark, then a damage stage or the repair hatch. */
  readonly overlays: readonly string[];
}

/**
 * Resolve a wall to its art names, independent of the texture loader so the smoke test can check it
 * headlessly. The face is the wall's tier plate (`wall-t1`..`wall-t5`; tiers 4 and 5 are reserved
 * placeholders the wall never reaches). Bulwark and Mesh add their branch mark as an overlay; a
 * repairing wall adds the hatch instead of any branch mark or damage; damage is the integer-third
 * stage above.
 */
export function wallArt(wall: WallState): WallArt {
  const tier = Math.min(Math.max(wall.tier ?? 1, 1), 5);
  const branch = wall.branch;
  const repairing = wall.repairing === true;
  const locked = wall.locked === true;
  const pressed = branch === 'C' && wall.open;

  const overlays: string[] = [];
  if (!repairing) {
    if (branch === 'A') overlays.push('wall-bulwark');
    else if (branch === 'B') overlays.push('wall-mesh');
  }
  if (repairing) {
    overlays.push('wall-repairing');
  } else if (wall.hp < wall.maxHp && !pressed && !locked) {
    const stage = wallDamageStage(wall.hp, wall.maxHp);
    if (stage > 0) overlays.push(`wall-damaged-${stage}`);
  }

  return { face: `wall-t${tier}`, overlays };
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
