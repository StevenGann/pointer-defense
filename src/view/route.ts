/**
 * Geometry for the route line: the dash pattern and the per-route offset.
 *
 * Kept separate from board.ts so the pure geometry can be checked without a Pixi renderer. Every
 * segment is axis-aligned because the path steps between neighbouring tile centres.
 */

export const ROUTE_DASH = 4;
export const ROUTE_GAP = 4;
export const ROUTE_THICK = 3;
export const ROUTE_SPREAD = 0.22;

export interface RoutePoint {
  x: number;
  y: number;
}

export interface DashRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RouteSegment {
  a: RoutePoint;
  b: RoutePoint;
}

/** Route `index` of `count` sits this many pixels from the shared tile centreline. */
export function routeOffset(index: number, count: number, cell: number): number {
  return (index - (count - 1) / 2) * cell * ROUTE_SPREAD;
}

/**
 * Offset a segment perpendicular to travel by `offset` pixels. Horizontal runs use the right-hand
 * side of travel (below when heading east, above when heading west); vertical runs use the same
 * right-hand side so a route keeps one consistent side through every turn.
 */
export function offsetSegment(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  offset: number,
): RouteSegment {
  if (ay === by) {
    const dir = bx >= ax ? 1 : -1;
    return {
      a: { x: ax, y: ay + offset * dir },
      b: { x: bx, y: by + offset * dir },
    };
  }
  const dir = by >= ay ? 1 : -1;
  return {
    a: { x: ax - offset * dir, y: ay },
    b: { x: bx - offset * dir, y: by },
  };
}

/**
 * The rectangles that make up one dashed segment. The pattern starts at (x0, y0) and walks toward
 * (x1, y1), so a segment running up or left draws exactly as many dashes as its reverse. The final
 * dash is clipped to the segment length, leaving the pattern aligned to the corner it starts from.
 */
export function dashRects(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  dash: number,
  gap: number,
  thick: number,
): DashRect[] {
  const half = Math.floor(thick / 2);
  const out: DashRect[] = [];

  if (y0 === y1) {
    const dir = x1 >= x0 ? 1 : -1;
    const length = Math.abs(x1 - x0);
    const y = Math.round(y0);
    for (let d = 0; d < length; d += dash + gap) {
      const w = Math.min(dash, length - d);
      const x = dir > 0 ? x0 + d : x0 - d - w;
      out.push({ x: Math.round(x), y: y - half, w, h: thick });
    }
  } else {
    const dir = y1 >= y0 ? 1 : -1;
    const length = Math.abs(y1 - y0);
    const x = Math.round(x0);
    for (let d = 0; d < length; d += dash + gap) {
      const h = Math.min(dash, length - d);
      const y = dir > 0 ? y0 + d : y0 - d - h;
      out.push({ x: x - half, y: Math.round(y), w: thick, h });
    }
  }

  return out;
}
