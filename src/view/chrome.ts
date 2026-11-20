import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { COLS, ROWS } from '../core/grid.ts';
import { cheatsEnabled } from '../core/cheats.ts';
import { getArtTexture } from './art.ts';

/**
 * Windows 95 chrome primitives and the single window model.
 *
 * Every rectangle derives from one outer rect so nothing can drift:
 *
 *   window:     x, y, w, h
 *     frame:    2px raised bevel around the whole window
 *     title:    x+2, y+2,          w-4, 22    navy #000080
 *     menu:     x+2, y+24,         w-4, 22    face #c0c0c0
 *     client:   x+2, y+46,         w-4, h-72  three columns: a 168px build palette, a sunken
 *                                             board well, and a 168px info panel, each split by
 *                                             a 2px separator
 *     status:   x+2, y+h-24,       w-4, 22    sunken panes
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
  /** Slightly lighter than face, for a hovered button's bottom-right bevel. */
  slight: 0xe0e0e0,
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

/**
 * The type scale: body / list rows / tooltips at 13 px, section labels / small rows / stats at
 * 11 px, and the tiny board labels at 10 px. Everything keeps Tahoma and the existing palette.
 */
export const FONT_SIZE = {
  body: 13,
  small: 11,
  board: 10,
} as const;

export const TITLE_H = 22;
const MENU_H = 22;
const STATUS_H = 22;
const WINDOW_MARGIN = 24;

/** The title-bar control boxes (min/max/close): 16x14, shared by every window at full scale. */
export const CONTROL_BOX_W = 16;
export const CONTROL_BOX_H = 14;

export interface BoardGeometry {
  x: number;
  y: number;
  cell: number;
}

/** Hint | wave | speed. Salvage lives in the left panel, above the shop, not here. */
export interface StatusPanes {
  left: Rect;
  middle: Rect;
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
  const menu: Rect = { x: win.x + 2, y: win.y + 2 + TITLE_H, w: win.w - 4, h: MENU_H };
  const client: Rect = {
    x: win.x + 2,
    y: win.y + 2 + TITLE_H + MENU_H,
    w: win.w - 4,
    h: win.h - 4 - TITLE_H - MENU_H - 2 - STATUS_H,
  };
  const status: Rect = { x: win.x + 2, y: win.y + win.h - 2 - STATUS_H, w: win.w - 4, h: STATUS_H };

  const PANEL_W = 168;
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

  const speed: Rect = { x: status.x + status.w - 44, y: status.y, w: 44, h: status.h };
  const middle: Rect = { x: speed.x - 180, y: status.y, w: 178, h: status.h };
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
    statusPanes: { left, middle, speed },
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

export type MenuName = 'file' | 'view' | 'cheats' | 'help';

interface MenuItem {
  name: MenuName;
  label: string;
}

/** The menu-bar words. Cheats is inserted after View, only while the cheats gate is open. */
export function menuItems(): readonly MenuItem[] {
  if (cheatsEnabled()) {
    return [
      { name: 'file', label: 'File' },
      { name: 'view', label: 'View' },
      { name: 'cheats', label: 'Cheats' },
      { name: 'help', label: 'Help' },
    ];
  }
  return [
    { name: 'file', label: 'File' },
    { name: 'view', label: 'View' },
    { name: 'help', label: 'Help' },
  ];
}

/** Hit rectangles for the menu words, left-padded 8px, left at x+6. */
export function menuWordRects(menu: Rect): Rect[] {
  const out: Rect[] = [];
  let x = menu.x + 6;
  for (const item of menuItems()) {
    const width = item.label.length * 7;
    out.push({ x, y: menu.y, w: width, h: menu.h });
    x += width + 8;
  }
  return out;
}

export function menuItemAt(menu: Rect, px: number, py: number): number {
  if (py < menu.y || py >= menu.y + menu.h) return -1;
  return menuWordRects(menu).findIndex((r) => pointInRect(r, px, py));
}

/** The menu name under a point, or null when the point is not on a menu word. */
export function menuNameAt(menu: Rect, px: number, py: number): MenuName | null {
  const i = menuItemAt(menu, px, py);
  return i < 0 ? null : menuItems()[i].name;
}

/** The menu-bar index of a named menu word, for laying its dropdown out under the word. */
export function menuIndex(name: MenuName): number {
  return menuItems().findIndex((item) => item.name === name);
}

function drawArrowIcon(g: Graphics, x: number, y: number): void {
  g.poly([x + 1, y + 1, x + 1, y + 12, x + 4, y + 9, x + 6, y + 14, x + 9, y + 12, x + 6, y + 8, x + 11, y + 8])
    .fill(PAL.titleInverse);
}

function drawControlGlyph(g: Graphics, spr: Sprite, r: Rect, kind: 'min' | 'max' | 'close'): void {
  const cx = r.x + Math.floor(r.w / 2);
  const cy = r.y + Math.floor(r.h / 2);
  const name = kind === 'min' ? 'glyph-minimize' : kind === 'max' ? 'glyph-maximize' : 'glyph-close';
  const size = kind === 'min' ? 10 : kind === 'max' ? 12 : 14;
  const tex = getArtTexture(name, size);
  if (tex !== null) {
    spr.texture = tex;
    spr.width = size;
    spr.height = size;
    spr.rotation = 0;
    spr.alpha = 1;
    spr.tint = 0xffffff;
    spr.visible = true;
    spr.position.set(cx, kind === 'min' ? r.y + r.h - 4 : cy);
  } else {
    spr.visible = false;
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
}

function drawControlButtons(g: Graphics, sprites: readonly Sprite[], title: Rect): void {
  const bw = CONTROL_BOX_W;
  const bh = CONTROL_BOX_H;
  const y = title.y + Math.floor((title.h - bh) / 2);
  const right = title.x + title.w - 2;
  const close: Rect = { x: right - bw, y, w: bw, h: bh };
  const maxi: Rect = { x: close.x - 2 - bw, y, w: bw, h: bh };
  const mini: Rect = { x: maxi.x - 2 - bw, y, w: bw, h: bh };
  const boxes = [
    [mini, 'min'],
    [maxi, 'max'],
    [close, 'close'],
  ] as const;
  for (let i = 0; i < boxes.length; i++) {
    const [r, kind] = boxes[i];
    bevel(g, r, true);
    drawControlGlyph(g, sprites[i], r, kind);
  }
}

export class ChromeView {
  readonly root = new Container();
  private readonly frame = new Graphics();
  private readonly glyphs = new Container();
  readonly arrowIcon = new Sprite();
  readonly controlGlyphs: Sprite[] = [new Sprite(), new Sprite(), new Sprite()];
  private readonly titleText: Text;
  private readonly menuTexts: Text[];

  constructor() {
    this.root.addChild(this.frame, this.glyphs);
    this.arrowIcon.anchor.set(0.5, 0.5);
    this.arrowIcon.visible = false;
    for (const s of this.controlGlyphs) {
      s.anchor.set(0.5, 0.5);
      s.visible = false;
    }
    this.glyphs.addChild(this.arrowIcon, ...this.controlGlyphs);
    this.titleText = new Text({
      text: 'Pointer Defense',
      style: { fontFamily: FONT, fontSize: FONT_SIZE.body, fontWeight: 'bold', fill: PAL.titleInverse },
    });
    this.titleText.anchor.set(0, 0.5);
    this.root.addChild(this.titleText);
    this.menuTexts = menuItems().map(
      (item) => new Text({ text: item.label, style: { fontFamily: FONT, fontSize: FONT_SIZE.body, fill: PAL.text } }),
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
    const arrowTex = getArtTexture('arrow-left', 16);
    if (arrowTex !== null) {
      this.arrowIcon.texture = arrowTex;
      this.arrowIcon.width = 16;
      this.arrowIcon.height = 16;
      this.arrowIcon.position.set(iconX + 6, iconY + 7.5);
      this.arrowIcon.rotation = 0;
      this.arrowIcon.alpha = 1;
      this.arrowIcon.tint = 0xffffff;
      this.arrowIcon.visible = true;
    } else {
      this.arrowIcon.visible = false;
      drawArrowIcon(g, iconX, iconY);
    }
    this.titleText.position.set(iconX + 16 + 2, l.title.y + Math.floor(l.title.h / 2));
    drawControlButtons(g, this.controlGlyphs, l.title);

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
  }
}

// ---------------------------------------------------------------------------------------------
// Shared window chrome (docs/VISUAL-PASS.md §0)

/** A 1px dotted line: 2px on, 3px off. */
export function dottedLine(g: Graphics, x1: number, y1: number, x2: number, y2: number, color: number): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return;
  for (let d = 0; d < len; d += 5) {
    const t0 = d / len;
    const t1 = Math.min(1, (d + 2) / len);
    g.moveTo(x1 + dx * t0, y1 + dy * t0).lineTo(x1 + dx * t1, y1 + dy * t1);
  }
  g.stroke({ width: 1, color });
}

export interface WindowChromeOpts {
  /** The close box is live (dark glyph); otherwise it is drawn disabled. */
  close?: boolean;
  /** The minimise box is live; otherwise disabled. */
  minimize?: boolean;
  /** The maximise box is live; otherwise disabled. */
  maximize?: boolean;
}

export interface WindowChromeGeom {
  titleBar: Rect;
  minimize: Rect;
  maximize: Rect;
  close: Rect;
  /** Anchor for the title text: 3 px indent, vertically centred in the bar. */
  titleX: number;
  titleY: number;
}

/** The classic title-bar control glyph, drawn into `g` (minimise, maximise or close). */
function drawControlBoxGlyph(g: Graphics, r: Rect, kind: 'min' | 'max' | 'close', color: number): void {
  const cx = r.x + Math.floor(r.w / 2);
  const cy = r.y + Math.floor(r.h / 2);
  if (kind === 'min') {
    g.rect(cx - 3, r.y + r.h - 5, 6, 2).fill(color);
  } else if (kind === 'max') {
    g.rect(cx - 4, cy - 4, 9, 8).stroke({ width: 1, color });
    g.rect(cx - 4, cy - 4, 9, 2).fill(color);
  } else {
    g.moveTo(cx - 4, cy - 4).lineTo(cx + 4, cy + 4).stroke({ width: 1, color });
    g.moveTo(cx + 4, cy - 4).lineTo(cx - 4, cy + 4).stroke({ width: 1, color });
  }
}

/**
 * The outer raised face, the navy title bar with a 1 px highlight top bevel, and the three 16x14
 * control boxes (minimise / maximise / close) with the classic glyph marks. The title text itself is
 * the caller's job (a `Graphics` cannot draw text); `titleX` / `titleY` give the 3 px-indent anchor.
 */
export function drawWindowChrome(g: Graphics, rect: Rect, opts: WindowChromeOpts = {}): WindowChromeGeom {
  bevel(g, rect, true, PAL.face);
  const titleBar: Rect = { x: rect.x + 2, y: rect.y + 2, w: rect.w - 4, h: TITLE_H };
  g.rect(titleBar.x, titleBar.y, titleBar.w, titleBar.h).fill(PAL.title);
  g.rect(titleBar.x, titleBar.y, titleBar.w, 1).fill(PAL.highlight);

  const by = titleBar.y + Math.floor((TITLE_H - CONTROL_BOX_H) / 2);
  const right = titleBar.x + titleBar.w - 2;
  const close: Rect = { x: right - CONTROL_BOX_W, y: by, w: CONTROL_BOX_W, h: CONTROL_BOX_H };
  const maximize: Rect = { x: close.x - 2 - CONTROL_BOX_W, y: by, w: CONTROL_BOX_W, h: CONTROL_BOX_H };
  const minimize: Rect = { x: maximize.x - 2 - CONTROL_BOX_W, y: by, w: CONTROL_BOX_W, h: CONTROL_BOX_H };

  for (const [r, kind, live] of [
    [minimize, 'min', opts.minimize],
    [maximize, 'max', opts.maximize],
    [close, 'close', opts.close],
  ] as const) {
    bevel(g, r, true, PAL.face);
    drawControlBoxGlyph(g, r, kind, live ? PAL.text : PAL.shadow);
  }

  return {
    titleBar,
    minimize,
    maximize,
    close,
    titleX: titleBar.x + 3,
    titleY: titleBar.y + Math.floor(TITLE_H / 2),
  };
}

/** The height of a property-sheet tab (the active tab is 2 px taller and lifted 2 px). */
export const TAB_H = 18;

export interface TabRect {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  active: boolean;
}

/** The property-sheet tab row laid out left to right; the active tab is lifted and 2 px taller. */
export function computeTabStrip(rect: Rect, labels: readonly string[], active: number): TabRect[] {
  const tabs: TabRect[] = [];
  let x = rect.x + 2;
  for (let i = 0; i < labels.length; i++) {
    const w = labels[i].length * 7 + 22;
    const isActive = i === active;
    const y = isActive ? rect.y - 2 : rect.y;
    const h = isActive ? TAB_H + 2 : TAB_H;
    tabs.push({ x, y, w, h, label: labels[i], active: isActive });
    x += w + 2;
  }
  return tabs;
}

/**
 * Draw the property-sheet tab row: raised tabs with a highlight top-left bevel and a shadow
 * bottom-right, the active tab 2 px taller and joined to the sheet below (no bottom bevel).
 */
export function drawTabStrip(g: Graphics, rect: Rect, labels: readonly string[], active: number): TabRect[] {
  const tabs = computeTabStrip(rect, labels, active);
  for (const t of tabs) {
    g.rect(t.x, t.y, t.w, t.h).fill(PAL.face);
    hline(g, t.x, t.x + t.w, t.y + 0.5, PAL.highlight);
    vline(g, t.x + 0.5, t.y, t.y + t.h, PAL.highlight);
    vline(g, t.x + t.w - 0.5, t.y, t.y + t.h, PAL.dark);
    if (!t.active) hline(g, t.x, t.x + t.w, t.y + t.h - 0.5, PAL.dark);
  }
  return tabs;
}

/** The width reserved for a list view's vertical scrollbar. */
export const LIST_SCROLL_W = 12;
/** The height of a list view's raised header band. */
export const LIST_HEADER_H = 18;

export interface ListColumn {
  title: string;
  w: number;
}

export interface ListViewGeom {
  field: Rect;
  header: Rect;
  body: Rect;
  rowH: number;
  /** Left edge of each column, in field coordinates (the first is `body.x`). */
  colX: number[];
  /** Width of each column. */
  colW: number[];
  /** The first visible row (scrolled). */
  firstRow: number;
  /** How many full rows fit in the body. */
  rowsVisible: number;
  /** Maximum scroll offset in rows (0 when the list fits). */
  scrollMax: number;
  /** True when the list overflows and needs a scrollbar. */
  overflow: boolean;
  scrollbar: Rect;
  thumb: Rect;
}

/**
 * The geometry of a list view: a sunken white field, a raised header band, a body of `rowH` rows and
 * an optional right-edge scrollbar. Pure, so hit-testing and drawing share one layout.
 */
export function computeListView(field: Rect, columns: readonly ListColumn[], rowH: number, rowCount: number, scroll: number): ListViewGeom {
  const header: Rect = { x: field.x + 2, y: field.y + 2, w: field.w - 4, h: LIST_HEADER_H };
  const body: Rect = { x: field.x + 2, y: header.y + header.h, w: field.w - 4, h: field.h - 4 - header.h };
  const colX: number[] = [];
  const colW: number[] = columns.map((c) => c.w);
  let x = body.x;
  for (const c of columns) {
    colX.push(x);
    x += c.w;
  }
  const rowsVisible = Math.floor(body.h / rowH);
  const scrollMax = Math.max(0, rowCount - rowsVisible);
  const firstRow = Math.max(0, Math.min(scroll, scrollMax));
  const overflow = scrollMax > 0;
  const scrollbar: Rect = { x: body.x + body.w - LIST_SCROLL_W, y: body.y, w: LIST_SCROLL_W, h: body.h };
  const thumbH = overflow ? Math.max(14, Math.round(scrollbar.h * (rowsVisible / rowCount))) : scrollbar.h;
  const thumbY = overflow && scrollMax > 0 ? Math.round((scrollbar.h - thumbH) * (firstRow / scrollMax)) : 0;
  const thumb: Rect = { x: scrollbar.x + 1, y: scrollbar.y + thumbY, w: scrollbar.w - 2, h: thumbH };
  return { field, header, body, rowH, colX, colW, firstRow, rowsVisible, scrollMax, overflow, scrollbar, thumb };
}

/**
 * Draw a list view: the sunken white field, the raised header band with beveled column separators,
 * zebra rows, the navy selected row, and a vertical scrollbar when the list overflows. Column titles
 * and row text are the caller's job (a `Graphics` cannot draw text); `colX` gives their positions.
 */
export function drawListView(g: Graphics, field: Rect, columns: readonly ListColumn[], rowH: number, rowCount: number, selected: number, scroll: number): ListViewGeom {
  const geom = computeListView(field, columns, rowH, rowCount, scroll);
  bevel(g, geom.field, false, PAL.highlight);
  bevel(g, geom.header, true, PAL.face);
  for (let i = 1; i < geom.colX.length; i++) {
    const sx = geom.colX[i] - 1;
    vline(g, sx - 0.5, geom.header.y + 1, geom.header.y + geom.header.h - 1, PAL.shadow);
    vline(g, sx + 0.5, geom.header.y + 1, geom.header.y + geom.header.h - 1, PAL.highlight);
  }
  const usableW = geom.body.w - (geom.overflow ? LIST_SCROLL_W : 0);
  for (let i = 0; i < geom.rowsVisible; i++) {
    const rowIdx = geom.firstRow + i;
    if (rowIdx >= rowCount) break;
    const ry = geom.body.y + i * rowH;
    if (rowIdx === selected) g.rect(geom.body.x, ry, usableW, rowH).fill(PAL.title);
    else if (i % 2 === 1) g.rect(geom.body.x, ry, usableW, rowH).fill(PAL.light);
  }
  if (geom.overflow) drawScrollbar(g, geom.scrollbar, geom.rowsVisible / rowCount, geom.scrollMax > 0 ? geom.firstRow / geom.scrollMax : 0, false);
  return geom;
}

/** A proportional scrollbar: sunken track, raised arrows with drawn triangles, a raised thumb with a 2 px grip. */
export function drawScrollbar(g: Graphics, rect: Rect, thumbFrac: number, thumbStart: number, hovered: boolean): void {
  bevel(g, rect, false, PAL.face);
  const arrowH = rect.w;
  const topArrow: Rect = { x: rect.x, y: rect.y, w: rect.w, h: arrowH };
  const bottomArrow: Rect = { x: rect.x, y: rect.y + rect.h - arrowH, w: rect.w, h: arrowH };
  const scrollH = rect.h - arrowH * 2;
  const thumbH = Math.max(14, Math.round(Math.min(1, Math.max(0, thumbFrac)) * scrollH));
  const thumb: Rect = {
    x: rect.x + 1,
    y: rect.y + arrowH + Math.round(Math.min(1, Math.max(0, thumbStart)) * (scrollH - thumbH)),
    w: rect.w - 2,
    h: thumbH,
  };

  bevel(g, topArrow, true, PAL.face);
  const tcx = topArrow.x + Math.floor(topArrow.w / 2);
  const tcy = topArrow.y + Math.floor(topArrow.h / 2);
  g.poly([tcx, tcy - 3, tcx - 4, tcy + 2, tcx + 4, tcy + 2]).fill(PAL.text);

  bevel(g, bottomArrow, true, PAL.face);
  const bcx = bottomArrow.x + Math.floor(bottomArrow.w / 2);
  const bcy = bottomArrow.y + Math.floor(bottomArrow.h / 2);
  g.poly([bcx, bcy + 3, bcx - 4, bcy - 2, bcx + 4, bcy - 2]).fill(PAL.text);

  if (thumbH < scrollH) {
    bevel(g, thumb, true, hovered ? PAL.highlight : PAL.face);
    const gy = thumb.y + Math.floor(thumb.h / 2) - 1;
    g.rect(thumb.x + 2, gy, thumb.w - 4, 2).fill(PAL.shadow);
  }
}

export interface StatusPanel {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A two- or three-panel status bar; a width of `0` flexes to fill the remaining rect. */
export function computeStatusBar(rect: Rect, widths: readonly number[]): StatusPanel[] {
  const panels: StatusPanel[] = [];
  const fixed = widths.reduce((a, b) => a + (b > 0 ? b : 0), 0);
  const flexCount = widths.filter((w) => w <= 0).length;
  const flexW = flexCount > 0 ? (rect.w - fixed) / flexCount : 0;
  let x = rect.x;
  for (const w of widths) {
    const pw = w > 0 ? w : flexW;
    panels.push({ x, y: rect.y, w: pw, h: rect.h });
    x += pw;
  }
  return panels;
}

/** Draw the status bar: raised separators, a 1 px sunken groove at the top of each panel. Text is the caller's job. */
export function drawStatusBar(g: Graphics, rect: Rect, widths: readonly number[]): StatusPanel[] {
  const panels = computeStatusBar(rect, widths);
  for (const p of panels) {
    g.rect(p.x, p.y, p.w, p.h).fill(PAL.face);
    g.rect(p.x + 2, p.y + 1, p.w - 4, 1).fill(PAL.shadow);
    g.rect(p.x + 2, p.y + 2, p.w - 4, 1).fill(PAL.highlight);
  }
  for (let i = 1; i < panels.length; i++) {
    const sx = panels[i].x;
    vline(g, sx - 1.5, rect.y + 1, rect.y + rect.h - 1, PAL.highlight);
    vline(g, sx - 0.5, rect.y + 1, rect.y + rect.h - 1, PAL.shadow);
  }
  return panels;
}
