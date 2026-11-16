import { POPUP_H, POPUP_W, type Enemy } from '../core/enemies.ts';

/**
 * Geometry for the pop-up enemy's Win95 window, kept Pixi-free so the smoke test can check the
 * close box and the draw order without a renderer. Positions are canvas pixels; the board origin
 * and pixels-per-tile are supplied by the view and the input layer.
 */

export const POPUP_TITLE_H = 16; // px
export const POPUP_CLOSE_W = 14; // px
export const POPUP_CLOSE_H = 12; // px

export interface PopupBoard {
  x: number;
  y: number;
  cell: number;
}

export interface PopupRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function popupWindowRect(e: Enemy, board: PopupBoard): PopupRect {
  const cx = board.x + e.x * board.cell;
  const cy = board.y + e.y * board.cell;
  const w = POPUP_W * board.cell;
  const h = POPUP_H * board.cell;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

export function popupTitleH(r: PopupRect): number {
  return Math.min(POPUP_TITLE_H, r.h);
}

/** The close box: a 14x12 px hit target in the top-right of the title bar. */
export function popupCloseRect(e: Enemy, board: PopupBoard): PopupRect {
  const r = popupWindowRect(e, board);
  const titleH = popupTitleH(r);
  return {
    x: r.x + r.w - POPUP_CLOSE_W - 2,
    y: r.y + (titleH - POPUP_CLOSE_H) / 2,
    w: POPUP_CLOSE_W,
    h: POPUP_CLOSE_H,
  };
}

export function popupCloseHit(e: Enemy, board: PopupBoard, px: number, py: number): boolean {
  const c = popupCloseRect(e, board);
  return px >= c.x && px < c.x + c.w && py >= c.y && py < c.y + c.h;
}

/** Pop-up windows draw beneath every other enemy, so anything standing over them stays visible. */
export function enemyDrawOrder(enemies: readonly Enemy[]): { popups: Enemy[]; others: Enemy[] } {
  const popups: Enemy[] = [];
  const others: Enemy[] = [];
  for (const e of enemies) (e.kind === 'popup' ? popups : others).push(e);
  return { popups, others };
}
