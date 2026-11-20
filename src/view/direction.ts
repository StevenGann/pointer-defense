import type { Rect } from './chrome.ts';

/**
 * One source of truth for the writing direction (docs/RTL.md).
 *
 * `src/i18n/boot.ts` installs the direction from `localeMeta(code).dir` before any view module is
 * evaluated, so every view that asks gets the same answer. Nothing may read the locale code to infer
 * direction; ask here instead. The default is LTR, which is what the headless smoke harness sees when
 * it imports view modules without going through `boot.ts`.
 */
let direction: 'ltr' | 'rtl' = 'ltr';

export function setDirection(dir: 'ltr' | 'rtl'): void {
  direction = dir;
}

export function isRtl(): boolean {
  return direction === 'rtl';
}

/** `rect` mirrored horizontally inside `outer`: same size and y, its x flipped about `outer`'s centre. */
export function mirrorX(rect: Rect, outer: Rect): Rect {
  return {
    x: outer.x + outer.w - (rect.x - outer.x) - rect.w,
    y: rect.y,
    w: rect.w,
    h: rect.h,
  };
}

/** `mirrorX` when the locale reads right-to-left, otherwise the rect unchanged. */
export function mirrorIfRtl(rect: Rect, outer: Rect): Rect {
  return isRtl() ? mirrorX(rect, outer) : rect;
}

/** The Pixi text anchor and its default 6 px indent for an alignment, honouring the direction. */
export function textAnchor(align: 'start' | 'center' | 'end'): { anchor: { x: number }; x: number } {
  if (align === 'center') return { anchor: { x: 0.5 }, x: 0 };
  const right = (align === 'start') === isRtl();
  return { anchor: { x: right ? 1 : 0 }, x: 6 };
}

/** The anchor and concrete x position to align text to an edge of `rect`, indented `pad` from it. */
export function textX(rect: Rect, align: 'start' | 'center' | 'end', pad = 6): { anchor: number; x: number } {
  if (align === 'center') return { anchor: 0.5, x: rect.x + rect.w / 2 };
  const right = (align === 'start') === isRtl();
  return right ? { anchor: 1, x: rect.x + rect.w - pad } : { anchor: 0, x: rect.x + pad };
}
