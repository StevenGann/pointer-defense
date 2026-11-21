import { FONT_SIZE, type Rect } from './chrome.ts';
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
export const MAP_GRID_ROWS = 2;
export const MAP_NAME_SIZE = FONT_SIZE.body;
export const MAP_HISTORY_SIZE = FONT_SIZE.small;

export interface MapCardRect {
  /** The LEVELS index this card represents. */
  index: number;
  rect: Rect;
}

/** The six cards centred in the client area. In RTL the columns read right to left; nothing else moves. */
export function computeMapCards(client: Rect, count: number): MapCardRect[] {
  const gridW = MAP_GRID_COLS * MAP_CARD_W + (MAP_GRID_COLS - 1) * MAP_CARD_GAP;
  const gridH = MAP_GRID_ROWS * MAP_CARD_H + (MAP_GRID_ROWS - 1) * MAP_CARD_GAP;
  const ox = client.x + Math.floor((client.w - gridW) / 2);
  const oy = client.y + Math.floor((client.h - gridH) / 2);
  const cards: MapCardRect[] = [];
  for (let i = 0; i < count; i++) {
    const col = i % MAP_GRID_COLS;
    const row = Math.floor(i / MAP_GRID_COLS);
    const visualCol = isRtl() ? MAP_GRID_COLS - 1 - col : col;
    cards.push({
      index: i,
      rect: {
        x: ox + visualCol * (MAP_CARD_W + MAP_CARD_GAP),
        y: oy + row * (MAP_CARD_H + MAP_CARD_GAP),
        w: MAP_CARD_W,
        h: MAP_CARD_H,
      },
    });
  }
  return cards;
}

/** The LEVELS index under a point, or null when the point is not on a card. */
export function mapCardAt(client: Rect, x: number, y: number, count: number): number | null {
  for (const c of computeMapCards(client, count)) {
    if (x >= c.rect.x && x < c.rect.x + c.rect.w && y >= c.rect.y && y < c.rect.y + c.rect.h) return c.index;
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
  if (nc < 0 || nc >= MAP_GRID_COLS || nr < 0 || nr >= MAP_GRID_ROWS) return focus;
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
export function mapGalleryKey(focus: number, key: string): { focus: number; action: MapGalleryAction } {
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
    case 'home':
      return { focus: 0, action: null };
    case 'end':
      return { focus: LEVELS.length - 1, action: null };
    default:
      return { focus, action: null };
  }
}
