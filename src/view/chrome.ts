import { Container, Graphics, Text } from 'pixi.js';
import { COLS, ROWS } from '../core/grid.ts';

/**
 * Windows 95 chrome primitives and the single window model.
 *
 * Every rectangle derives from one outer rect so nothing can drift:
 *
 *   window:     x, y, w, h
 *     frame:    2px raised bevel around the whole window
 *     title:    x+2, y+2,          w-4, 18    navy #000080
 *     menu:     x+2, y+20,         w-4, 18    face #c0c0c0
 *     client:   x+2, y+38,         w-4, h-60  three columns: a 148px build palette, a sunken
 *                                             board well, and a 148px info panel, each split by
 *                                             a 2px separator
 *     status:   x+2, y+h-20,       w-4, 18    sunken panes
 */

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const PAL = {
  desktop: 0x008080,
  face: 0xc0c0c0,
  light: 0xdfdfdf,
  highlight: 0xffffff,
  shadow: 0x808080,
  dark: 0x000000,
  titleInverse: 0xffffff,
  title: 0x000080,
  text: 0x000000,
  teal: 0x008080,
  maroon: 0x800000,
  olive: 0x808000,
  navy: 0x000080,
  purple: 0x800080,
  amber: 0x806000,
} as const;

export const FONT = 'Tahoma, Verdana, Geneva, sans-serif';

const TITLE_H = 18;
const MENU_H = 18;
const STATUS_H = 18;
const WINDOW_MARGIN = 24;

export interface BoardGeometry {
  x: number;
  y: number;
  cell: number;
}

export interface StatusPanes {
  left: Rect;
  middle: Rect;
  right: Rect;
  speed: Rect;
}

export interface Layout {
  window: Rect;
  title: Rect;
  menu: Rect;
  client: Rect;
  leftPanel: Rect;
  boardCol: Rect;
  rightPanel: Rect;
  status: Rect;
  statusPanes: StatusPanes;
  board: BoardGeometry;
  boardW: number;
  boardH: number;
}

export function computeLayout(vw: number, vh: number): Layout {
  const win: Rect = {
    x: WINDOW_MARGIN,
    y: WINDOW_MARGIN,
    w: vw - WINDOW_MARGIN * 2,
    h: vh - WINDOW_MARGIN * 2,
  };
  const title: Rect = { x: win.x + 2, y: win.y + 2, w: win.w - 4, h: TITLE_H };
  const menu: Rect = { x: win.x + 2, y: win.y + 20, w: win.w - 4, h: MENU_H };
  const client: Rect = { x: win.x + 2, y: win.y + 38, w: win.w - 4, h: win.h - 60 };
  const status: Rect = { x: win.x + 2, y: win.y + win.h - 20, w: win.w - 4, h: STATUS_H };

  const PANEL_W = 148;
  const leftPanel: Rect = { x: client.x, y: client.y, w: PANEL_W, h: client.h };
  const boardCol: Rect = {
    x: client.x + PANEL_W + 2,
    y: client.y,
    w: client.w - PANEL_W * 2 - 4,
    h: client.h,
  };
  const rightPanel: Rect = { x: client.x + client.w - PANEL_W, y: client.y, w: PANEL_W, h: client.h };

  const inner: Rect = { x: boardCol.x + 2, y: boardCol.y + 2, w: boardCol.w - 4, h: boardCol.h - 4 };
  const cell = Math.max(1, Math.floor(Math.min(inner.w / COLS, inner.h / ROWS)));
  const boardW = cell * COLS;
  const boardH = cell * ROWS;
  const ox = Math.round((inner.w - boardW) / 2);
  const oy = Math.round((inner.h - boardH) / 2);
  const board: BoardGeometry = { x: inner.x + ox, y: inner.y + oy, cell };

  const right: Rect = { x: status.x + status.w - 120, y: status.y, w: 120, h: status.h };
  const speed: Rect = { x: right.x - 46, y: status.y, w: 44, h: status.h };
  const middle: Rect = { x: speed.x - 122, y: status.y, w: 120, h: status.h };
  const left: Rect = { x: status.x, y: status.y, w: middle.x - 2 - status.x, h: status.h };

  return {
    window: win,
    title,
    menu,
    client,
    leftPanel,
    boardCol,
    rightPanel,
    status,
    statusPanes: { left, middle, right, speed },
    board,
    boardW,
    boardH,
  };
}

export function worldToPixel(l: Layout, wx: number, wy: number): { x: number; y: number } {
  return { x: l.board.x + wx * l.board.cell, y: l.board.y + wy * l.board.cell };
}

export function pixelToWorld(l: Layout, px: number, py: number): { x: number; y: number } {
  return { x: (px - l.board.x) / l.board.cell, y: (py - l.board.y) / l.board.cell };
}

export function pointInRect(r: Rect, px: number, py: number): boolean {
  return px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h;
}

function hline(g: Graphics, x0: number, x1: number, y: number, color: number): void {
  g.moveTo(x0, y).lineTo(x1, y).stroke({ width: 1, color });
}

function vline(g: Graphics, x: number, y0: number, y1: number, color: number): void {
  g.moveTo(x, y0).lineTo(x, y1).stroke({ width: 1, color });
}

/** A 2px raised or sunken bevel around `r`, filled with `face`. */
export function bevel(g: Graphics, r: Rect, raised: boolean, face: number = PAL.face): void {
  g.rect(r.x, r.y, r.w, r.h).fill(face);
  const tl = raised ? [PAL.highlight, PAL.light] : [PAL.shadow, PAL.dark];
  const br = raised ? [PAL.dark, PAL.shadow] : [PAL.highlight, PAL.light];
  const x0 = r.x;
  const y0 = r.y;
  const x1 = r.x + r.w;
  const y1 = r.y + r.h;
  hline(g, x0, x1, y0 + 0.5, tl[0]);
  hline(g, x0, x1, y0 + 1.5, tl[1]);
  hline(g, x0, x1, y1 - 1.5, br[1]);
  hline(g, x0, x1, y1 - 0.5, br[0]);
  vline(g, x0 + 0.5, y0, y1, tl[0]);
  vline(g, x0 + 1.5, y0, y1, tl[1]);
  vline(g, x1 - 1.5, y0, y1, br[1]);
  vline(g, x1 - 0.5, y0, y1, br[0]);
}

const MENU_ITEMS = ['File', 'View', 'Help'] as const;

/** Hit rectangles for the three menu words, left-padded 8px, left at x+6. */
export function menuWordRects(menu: Rect): Rect[] {
  const out: Rect[] = [];
  let x = menu.x + 6;
  for (const word of MENU_ITEMS) {
    const width = word.length * 6;
    out.push({ x, y: menu.y, w: width, h: menu.h });
    x += width + 8;
  }
  return out;
}

export function menuItemAt(menu: Rect, px: number, py: number): number {
  if (py < menu.y || py >= menu.y + menu.h) return -1;
  return menuWordRects(menu).findIndex((r) => pointInRect(r, px, py));
}

function drawArrowIcon(g: Graphics, x: number, y: number): void {
  g.poly([x + 1, y + 1, x + 1, y + 12, x + 4, y + 9, x + 6, y + 14, x + 9, y + 12, x + 6, y + 8, x + 11, y + 8])
    .fill(PAL.titleInverse);
}

function drawControlGlyph(g: Graphics, r: Rect, kind: 'min' | 'max' | 'close'): void {
  const cx = r.x + Math.floor(r.w / 2);
  const cy = r.y + Math.floor(r.h / 2);
  if (kind === 'min') {
    g.rect(cx - 3, r.y + r.h - 5, 6, 2).fill(PAL.text);
  } else if (kind === 'max') {
    g.rect(cx - 4, cy - 4, 9, 8).stroke({ width: 1, color: PAL.text });
    g.rect(cx - 4, cy - 4, 9, 2).fill(PAL.text);
  } else {
    g.moveTo(cx - 4, cy - 4).lineTo(cx + 4, cy + 4).stroke({ width: 1, color: PAL.text });
    g.moveTo(cx + 4, cy - 4).lineTo(cx - 4, cy + 4).stroke({ width: 1, color: PAL.text });
  }
}

function drawControlButtons(g: Graphics, title: Rect): void {
  const bw = 16;
  const bh = 14;
  const y = title.y + Math.floor((title.h - bh) / 2);
  const right = title.x + title.w - 2;
  const close: Rect = { x: right - bw, y, w: bw, h: bh };
  const maxi: Rect = { x: close.x - 2 - bw, y, w: bw, h: bh };
  const mini: Rect = { x: maxi.x - 2 - bw, y, w: bw, h: bh };
  for (const [r, kind] of [
    [mini, 'min'],
    [maxi, 'max'],
    [close, 'close'],
  ] as const) {
    bevel(g, r, true);
    drawControlGlyph(g, r, kind);
  }
}

export class ChromeView {
  readonly root = new Container();
  private readonly frame = new Graphics();
  private readonly titleText: Text;
  private readonly menuTexts: Text[];

  constructor() {
    this.root.addChild(this.frame);
    this.titleText = new Text({
      text: 'Pointer Defense',
      style: { fontFamily: FONT, fontSize: 11, fontWeight: 'bold', fill: PAL.titleInverse },
    });
    this.titleText.anchor.set(0, 0.5);
    this.root.addChild(this.titleText);
    this.menuTexts = MENU_ITEMS.map(
      (word) => new Text({ text: word, style: { fontFamily: FONT, fontSize: 11, fill: PAL.text } }),
    );
    for (const t of this.menuTexts) {
      t.anchor.set(0, 0.5);
      this.root.addChild(t);
    }
  }

  draw(l: Layout, hoverMenu: number): void {
    const g = this.frame;
    g.clear();

    bevel(g, l.window, true, PAL.face);

    // Title bar.
    g.rect(l.title.x, l.title.y, l.title.w, l.title.h).fill(PAL.title);
    const iconX = l.title.x + 2;
    const iconY = l.title.y + 1;
    drawArrowIcon(g, iconX, iconY);
    this.titleText.position.set(iconX + 16 + 2, l.title.y + Math.floor(l.title.h / 2));
    drawControlButtons(g, l.title);

    // Menu bar.
    g.rect(l.menu.x, l.menu.y, l.menu.w, l.menu.h).fill(PAL.face);
    const rects = menuWordRects(l.menu);
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      const hovered = i === hoverMenu;
      if (hovered) g.rect(r.x - 3, r.y, r.w + 6, r.h).fill(PAL.title);
      this.menuTexts[i].style.fill = hovered ? PAL.titleInverse : PAL.text;
      this.menuTexts[i].position.set(r.x, r.y + Math.floor(r.h / 2));
    }

    // Client area: flat build and info panels flanking the sunken board well.
    g.rect(l.leftPanel.x, l.leftPanel.y, l.leftPanel.w, l.leftPanel.h).fill(PAL.face);
    bevel(g, l.boardCol, false, PAL.face);
    g.rect(l.rightPanel.x, l.rightPanel.y, l.rightPanel.w, l.rightPanel.h).fill(PAL.face);
    vline(g, l.leftPanel.x + l.leftPanel.w + 0.5, l.client.y, l.client.y + l.client.h, PAL.shadow);
    vline(g, l.rightPanel.x - 0.5, l.client.y, l.client.y + l.client.h, PAL.shadow);

    // Status panes (sunken, 2px separators).
    bevel(g, l.statusPanes.left, false, PAL.face);
    bevel(g, l.statusPanes.middle, false, PAL.face);
    bevel(g, l.statusPanes.speed, false, PAL.face);
    bevel(g, l.statusPanes.right, false, PAL.face);
  }
}
