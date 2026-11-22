import { FONT_SIZE, LIST_SCROLL_W, type Rect } from './chrome.ts';
import { isRtl } from './direction.ts';
import { LEVELS, type Level } from '../core/levels.ts';

/**
 * The map-selection gallery's pure model (docs/MAP-SELECT.md): the card grid, hit-testing, focus
 * navigation and the one keypress decision. Pixi-free so the smoke harness can assert the layout and
 * the focus order without a renderer; `MapsScreenView` (mapsScreen.ts) draws it and `main.ts` wires
 * the returned action to `startRun`.
 */

export const MAP_CARD_W = 196;
export const MAP_CARD_H = 146;
export const MAP_CARD_GAP = 12;
export const MAP_GRID_COLS = 3;
export const MAP_NAME_SIZE = FONT_SIZE.body;
export const MAP_HISTORY_SIZE = FONT_SIZE.small;

/** The gallery reserves the list view's scrollbar column, so the two scrollbars match (docs/MAP-SELECT.md). */
export const MAP_SCROLL_W = LIST_SCROLL_W;

/** The gap below the "Select a map" title (centred at client.y + 14) to the first card row. */
const MAP_VIEW_TOP = 28;
/** The gap above the client's bottom edge the last visible row keeps clear. */
const MAP_VIEW_BOTTOM = 8;

export interface MapCardRect {
  /** The LEVELS index this card represents. */
  index: number;
  rect: Rect;
}

export interface MapGrid {
  /** Cards with the scroll offset already applied; `index` is the LEVELS index. */
  cards: MapCardRect[];
  /** The clipping rect the cards live in. */
  view: Rect;
  /** ceil(count / MAP_GRID_COLS). */
  rows: number;
  /** floor((view.h + gap) / (cardH + gap)) full rows that fit in the view. */
  rowsVisible: number;
  /** The clamped scroll position, in rows. */
  firstRow: number;
  /** max(0, rows - rowsVisible). */
  scrollMax: number;
  /** True when the grid overflows and needs a scrollbar. */
  overflow: boolean;
  /** The scrollbar track; zero-sized when not overflowing. */
  scrollbar: Rect;
  /** The raised thumb; zero-sized when not overflowing. */
  thumb: Rect;
}

/** The scalar geometry shared by card placement, hit-testing and the scrollbar draw. */
export interface MapGridMetrics {
  view: Rect;
  /** x of the leftmost visual card (RTL flips which array column lands here). */
  ox: number;
  /** y of the first (scrolled) row. */
  oy: number;
  /** cardW + gap, the horizontal column pitch. */
  colStep: number;
  /** cardH + gap, the vertical row pitch. */
  rowStep: number;
  rows: number;
  rowsVisible: number;
  firstRow: number;
  scrollMax: number;
  overflow: boolean;
  scrollbar: Rect;
  thumb: Rect;
}

export function clampMapScroll(firstRow: number, scrollMax: number): number {
  return Math.max(0, Math.min(firstRow, scrollMax));
}

/**
 * The row the grid must scroll to so `index`'s row is fully visible, leaving the scroll alone when it
 * already is. Never exceeds `scrollMax`.
 */
export function scrollForFocus(index: number, scrollMax: number, currentFirstRow: number, rowsVisible: number): number {
  const row = Math.floor(index / MAP_GRID_COLS);
  const lo = Math.max(0, row - (rowsVisible - 1));
  const hi = Math.min(scrollMax, row);
  const next = currentFirstRow < lo ? lo : currentFirstRow > hi ? hi : currentFirstRow;
  return clampMapScroll(next, scrollMax);
}

/** The scrollable grid's geometry, without the per-card array (so the view draws allocation-free). */
export function mapGridMetrics(client: Rect, count: number, firstRowRaw: number): MapGridMetrics {
  const view: Rect = {
    x: client.x,
    y: client.y + MAP_VIEW_TOP,
    w: client.w,
    h: client.h - MAP_VIEW_TOP - MAP_VIEW_BOTTOM,
  };
  const rowStep = MAP_CARD_H + MAP_CARD_GAP;
  const colStep = MAP_CARD_W + MAP_CARD_GAP;
  const rows = Math.ceil(count / MAP_GRID_COLS);
  // Never report zero visible rows: a gallery that can scroll must still fit one card (docs/UI-SCALE-FLOOR.md).
  const rowsVisible = Math.max(1, Math.floor((view.h + MAP_CARD_GAP) / rowStep));
  const scrollMax = Math.max(0, rows - rowsVisible);
  const firstRow = clampMapScroll(firstRowRaw, scrollMax);
  const overflow = scrollMax > 0;

  const scrollbar: Rect = overflow
    ? { x: isRtl() ? view.x : view.x + view.w - MAP_SCROLL_W, y: view.y, w: MAP_SCROLL_W, h: view.h }
    : { x: view.x, y: view.y, w: 0, h: 0 };

  // The thumb is proportional to the visible fraction with the list scrollbar's 14 px minimum, and its
  // travel is the track height minus the thumb height so row 0 and scrollMax reach the two ends.
  const thumbH = overflow ? Math.max(14, Math.round(view.h * (rowsVisible / rows))) : 0;
  const thumbY = overflow && scrollMax > 0 ? Math.round((view.h - thumbH) * (firstRow / scrollMax)) : 0;
  const thumb: Rect = overflow
    ? { x: scrollbar.x + 1, y: view.y + thumbY, w: MAP_SCROLL_W - 2, h: thumbH }
    : { x: 0, y: 0, w: 0, h: 0 };

  // The card column reserves the scrollbar's column on the opposite side, so a map keeps its grid
  // position as the set grows and cards never slide under the scrollbar.
  const gridW = MAP_GRID_COLS * MAP_CARD_W + (MAP_GRID_COLS - 1) * MAP_CARD_GAP;
  const contentW = view.w - MAP_SCROLL_W;
  const contentX = isRtl() ? view.x + MAP_SCROLL_W : view.x;
  const ox = contentX + Math.floor((contentW - gridW) / 2);
  const oy = view.y - firstRow * rowStep;

  return { view, ox, oy, colStep, rowStep, rows, rowsVisible, firstRow, scrollMax, overflow, scrollbar, thumb };
}

/** The full grid model, with every card positioned against the scroll offset. */
export function computeMapGrid(client: Rect, count: number, firstRow: number): MapGrid {
  const m = mapGridMetrics(client, count, firstRow);
  const cards: MapCardRect[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % MAP_GRID_COLS;
    const row = Math.floor(i / MAP_GRID_COLS);
    const visualCol = isRtl() ? MAP_GRID_COLS - 1 - col : col;
    cards.push({
      index: i,
      rect: {
        x: m.ox + visualCol * m.colStep,
        y: m.oy + row * m.rowStep,
        w: MAP_CARD_W,
        h: MAP_CARD_H,
      },
    });
  }
  return {
    cards,
    view: m.view,
    rows: m.rows,
    rowsVisible: m.rowsVisible,
    firstRow: m.firstRow,
    scrollMax: m.scrollMax,
    overflow: m.overflow,
    scrollbar: m.scrollbar,
    thumb: m.thumb,
  };
}

/** The LEVELS index under a point, or null when the point is off the view or on a scrolled-out card. */
export function mapCardAt(client: Rect, x: number, y: number, count: number, firstRow: number): number | null {
  const grid = computeMapGrid(client, count, firstRow);
  const v = grid.view;
  if (x < v.x || x >= v.x + v.w || y < v.y || y >= v.y + v.h) return null;
  for (const c of grid.cards) {
    const r = c.rect;
    // A partly visible card is hit-testable only over the slice still inside the view.
    const x0 = Math.max(r.x, v.x);
    const x1 = Math.min(r.x + r.w, v.x + v.w);
    const y0 = Math.max(r.y, v.y);
    const y1 = Math.min(r.y + r.h, v.y + v.h);
    if (x >= x0 && x < x1 && y >= y0 && y < y1) return c.index;
  }
  return null;
}

export type MapFocusDir = 'left' | 'right' | 'up' | 'down';

/**
 * Move focus one card in a visual direction. Focus is a LEVELS index; the cards are placed in array
 * order but mirrored in RTL, so a physical left/right step maps to the opposite array column there —
 * the arrows follow what the player sees, never the underlying array order (docs/RTL.md).
 */
export function moveMapFocus(focus: number, dir: MapFocusDir, count: number): number {
  const col = focus % MAP_GRID_COLS;
  const row = Math.floor(focus / MAP_GRID_COLS);
  let dc = 0;
  let dr = 0;
  if (dir === 'left') dc = isRtl() ? 1 : -1;
  else if (dir === 'right') dc = isRtl() ? -1 : 1;
  else if (dir === 'up') dr = -1;
  else dr = 1;
  const nc = col + dc;
  const nr = row + dr;
  if (nc < 0 || nc >= MAP_GRID_COLS || nr < 0) return focus;
  const next = nr * MAP_GRID_COLS + nc;
  return next < count ? next : focus;
}

/** The level a focused card starts: the exact `level` argument `startRun` receives. */
export function mapLevelAt(index: number): Level {
  return LEVELS[index];
}

/** The focus index for a remembered map id, clamped to the shipped set (0 when absent or stale). */
export function mapFocusForId(id: string | null): number {
  if (id === null) return 0;
  const i = LEVELS.findIndex((l) => l.id === id);
  return i < 0 ? 0 : i;
}

export type MapGalleryAction = 'start' | 'back' | null;

/** One gallery keypress: the new focus plus the action the wiring must perform. */
export function mapGalleryKey(focus: number, key: string, pageRows = 2): { focus: number; action: MapGalleryAction } {
  switch (key) {
    case 'enter':
      return { focus, action: 'start' };
    case 'escape':
      return { focus, action: 'back' };
    case 'arrowleft':
      return { focus: moveMapFocus(focus, 'left', LEVELS.length), action: null };
    case 'arrowright':
      return { focus: moveMapFocus(focus, 'right', LEVELS.length), action: null };
    case 'arrowup':
      return { focus: moveMapFocus(focus, 'up', LEVELS.length), action: null };
    case 'arrowdown':
      return { focus: moveMapFocus(focus, 'down', LEVELS.length), action: null };
    case 'pageup':
      return { focus: Math.max(0, focus - pageRows * MAP_GRID_COLS), action: null };
    case 'pagedown':
      return { focus: Math.min(LEVELS.length - 1, focus + pageRows * MAP_GRID_COLS), action: null };
    case 'home':
      return { focus: 0, action: null };
    case 'end':
      return { focus: LEVELS.length - 1, action: null };
    default:
      return { focus, action: null };
  }
}
