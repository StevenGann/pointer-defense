import { POPUP_H, POPUP_W, isBossKind, isFlyerKind, type Enemy } from '../core/enemies.ts';
import { CONTROL_BOX_H, CONTROL_BOX_W, TITLE_H } from './chrome.ts';

/**
 * Geometry for the pop-up enemy's Win95 window. The window keeps its tile footprint, but its title
 * bar, close box and caption are drawn at the main window's full chrome scale (a 22 px title bar and
 * a 16x14 close box), not a shrunken copy. Positions are canvas pixels; the board origin and
 * pixels-per-tile are supplied by the view and the input layer.
 */

export const POPUP_TITLE_H = TITLE_H; // px, the same 22 px as the main window
export const POPUP_CLOSE_W = CONTROL_BOX_W; // px, 16
export const POPUP_CLOSE_H = CONTROL_BOX_H; // px, 14

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

/**
 * Where an enemy sits in the draw order. Bosses draw over regular enemies so a boss is never hidden
 * behind the crowd escorting it, and flyers draw over everything because they are above the board — a
 * flyer boss is a flyer first and a boss second. Ties keep spawn order (the sort is stable), so the
 * crowd still reads front-to-back.
 */
function drawRank(e: Enemy): number {
  if (isFlyerKind(e.kind)) return 2;
  return isBossKind(e.kind) ? 1 : 0;
}

/** Pop-up windows draw beneath every other enemy, so anything standing over them stays visible. */
export function enemyDrawOrder(enemies: readonly Enemy[]): { popups: Enemy[]; others: Enemy[] } {
  const popups: Enemy[] = [];
  const others: Enemy[] = [];
  for (const e of enemies) (e.kind === 'popup' ? popups : others).push(e);
  others.sort((a, b) => drawRank(a) - drawRank(b));
  return { popups, others };
}
