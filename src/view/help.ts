import { Container, Graphics, Sprite, Text } from 'pixi.js';
import {
  bevel,
  CONTROL_BOX_H,
  CONTROL_BOX_W,
  dottedLine,
  drawStatusBar,
  drawTabStrip,
  drawWindowChrome,
  FONT,
  FONT_SIZE,
  PAL,
  pointInRect,
  TITLE_H,
  type Layout,
  type Rect,
  type StatusPanel,
} from './chrome.ts';
import {
  HELP_CATEGORIES,
  HELP_PAGES,
  lockedReason,
  pageById,
  pageUnlocked,
  type HelpCategory,
  type HelpPage,
} from '../content/help.ts';
import type { Profile } from '../core/save.ts';
import { ENEMY_ART_BODY, HELP_REFERENCE_CELL } from './board.ts';
import { artSpriteSize, frameTexture } from './art.ts';
import { ENEMY_STATS, type EnemyKind } from '../core/enemies.ts';
import {
  ART_GAP,
  HEADING_H,
  helpMeasure,
  ITEM_GAP,
  layoutHelpBlocks,
  LINE_H,
  parseHelpMarkdown,
  type HelpLayout as HelpPageLayout,
} from './helpMarkdown.ts';

/**
 * The Help viewer (docs/VISUAL-PASS.md §4): a CHM help file read at a glance. A 720 x 470 window
 * with a six-button toolbar, a draggable 200 px navigation pane (Contents / Index / Search tabs at
 * its foot), a 4 px splitter clamped to 140-320 px, a white sunken page pane with a navy heading
 * rule and a proportional scrollbar, and a topic-path status bar.
 *
 * The model is Pixi-free so the smoke harness can assert the geometry, the gates and the search; the
 * `HelpView` class at the bottom turns it into Graphics/Text calls.
 */

export const HELP_W = 720;
export const HELP_H = 470;
export const HELP_TOOLBAR_H = 28;
export const HELP_STATUS_H = 18;
export const HELP_NAV_W = 200;
export const HELP_NAV_MIN = 140;
export const HELP_NAV_MAX = 320;
export const HELP_SPLIT_W = 4;
export const HELP_TREE_ROW_H = 18;
export const HELP_PAGE_PAD = 8;
export const HELP_TREE_PAD = 4;
export const HELP_LINE_H = LINE_H;
export const HELP_HEADING_H = HEADING_H;
/** Column reserved on the page panel's right edge for the scrollbar track. */
export const HELP_SCROLL_W = 12;
/** Width of the scrollbar track itself, inside the reserved column. */
export const HELP_SCROLL_TRACK_W = 8;
/** Lines the page scrolls per mouse-wheel notch. */
export const HELP_SCROLL_LINES = 3;
/** The vertical gap left after each page body entry (4 px, as the original layout did). */
export const HELP_ITEM_GAP = ITEM_GAP;
/** Inset of the art preview box from the page text area's right and top edges (docs/HELP-ART.md). */
export const HELP_ART_INSET = 8;
/** Gap between a body line wrapped around the art box and the box's left edge. */
export const HELP_ART_GAP = ART_GAP;
/** Padding inside the art preview box around the sprite (`box = maxPreview + 2 * HELP_ART_PAD`). */
export const HELP_ART_PAD = 6;
export { helpMeasure };
/** The tree indents one level per 12 px (chapter expander, then page icon). */
const HELP_TREE_INDENT = 12;
const HELP_MIN_VISIBLE = 32;

export type HelpToolbarAction = 'nav' | 'back' | 'forward' | 'home' | 'print' | 'options';
export type HelpNavTab = 'contents' | 'index' | 'search';

export interface HelpLayout {
  window: Rect;
  title: Rect;
  close: Rect;
  toolbar: Rect;
  navToggle: Rect;
  back: Rect;
  forward: Rect;
  home: Rect;
  print: Rect;
  options: Rect;
  /** Back-compat alias for the hide-nav button (the old "Contents" toolbar slot). */
  contents: Rect;
  splitter: Rect;
  treePanel: Rect;
  navTabStrip: Rect;
  navTabs: { id: HelpNavTab; label: string; rect: Rect; active: boolean }[];
  searchField: Rect;
  searchButton: Rect;
  indexList: Rect;
  pagePanel: Rect;
  pageText: Rect;
  status: Rect;
  statusPanels: StatusPanel[];
}

/** The window geometry at a top-left position and a nav-pane width, derived so drawing and hit-testing agree. */
export function computeHelpLayout(x: number, y: number, navW: number = HELP_NAV_W): HelpLayout {
  const win: Rect = { x, y, w: HELP_W, h: HELP_H };
  const title: Rect = { x: x + 2, y: y + 2, w: HELP_W - 4, h: TITLE_H };
  const close: Rect = {
    x: title.x + title.w - 2 - CONTROL_BOX_W,
    y: title.y + Math.floor((TITLE_H - CONTROL_BOX_H) / 2),
    w: CONTROL_BOX_W,
    h: CONTROL_BOX_H,
  };
  const toolbar: Rect = { x: x + 2, y: title.y + title.h, w: HELP_W - 4, h: HELP_TOOLBAR_H };
  const status: Rect = { x: x + 2, y: y + HELP_H - 2 - HELP_STATUS_H, w: HELP_W - 4, h: HELP_STATUS_H };
  const clientTop = toolbar.y + toolbar.h;
  const clientBottom = status.y;

  const btnW = 24;
  let bx = toolbar.x + 6;
  const mkBtn = (): Rect => {
    const r: Rect = { x: bx, y: toolbar.y + Math.floor((HELP_TOOLBAR_H - btnW) / 2), w: btnW, h: btnW };
    bx += btnW + 24;
    return r;
  };
  const navToggle = mkBtn();
  const back = mkBtn();
  const forward = mkBtn();
  const home = mkBtn();
  const print = mkBtn();
  const options = mkBtn();

  const treePanel: Rect = { x: x + 2, y: clientTop, w: navW, h: clientBottom - clientTop };
  const splitter: Rect = { x: treePanel.x + treePanel.w, y: clientTop, w: HELP_SPLIT_W, h: clientBottom - clientTop };
  const pagePanel: Rect = {
    x: splitter.x + splitter.w,
    y: clientTop,
    w: x + HELP_W - 2 - (splitter.x + splitter.w),
    h: clientBottom - clientTop,
  };
  const pageText: Rect = {
    x: pagePanel.x + HELP_PAGE_PAD,
    y: pagePanel.y + HELP_PAGE_PAD,
    w: pagePanel.w - HELP_PAGE_PAD * 2 - HELP_SCROLL_W,
    h: pagePanel.h - HELP_PAGE_PAD * 2,
  };

  // The nav pane foot: Contents | Index | Search.
  const navTabStrip: Rect = { x: treePanel.x + 2, y: treePanel.y + treePanel.h - 20, w: treePanel.w - 4, h: 18 };
  const navTabs = computeHelpNavTabs(navTabStrip);
  const searchField: Rect = { x: treePanel.x + 8, y: treePanel.y + 6, w: treePanel.w - 16, h: 20 };
  const searchButton: Rect = { x: searchField.x + searchField.w - 46, y: searchField.y + 1, w: 44, h: 18 };
  const indexList: Rect = { x: treePanel.x + 4, y: treePanel.y + 4, w: treePanel.w - 8, h: navTabStrip.y - 4 - (treePanel.y + 4) };
  const statusPanels = computeStatusBarRects(status, [0, 110]);

  return {
    window: win,
    title,
    close,
    toolbar,
    navToggle,
    back,
    forward,
    home,
    print,
    options,
    contents: navToggle,
    splitter,
    treePanel,
    navTabStrip,
    navTabs,
    searchField,
    searchButton,
    indexList,
    pagePanel,
    pageText,
    status,
    statusPanels,
  };
}

function computeHelpNavTabs(strip: Rect): { id: HelpNavTab; label: string; rect: Rect; active: boolean }[] {
  const labels: [HelpNavTab, string][] = [['contents', 'Contents'], ['index', 'Index'], ['search', 'Search']];
  const w = Math.floor(strip.w / 3);
  return labels.map(([id, label], i) => ({ id, label, rect: { x: strip.x + i * w, y: strip.y, w, h: strip.h }, active: false }));
}

function computeStatusBarRects(rect: Rect, widths: readonly number[]): StatusPanel[] {
  const fixed = widths.reduce((a, b) => a + (b > 0 ? b : 0), 0);
  const flexW = (rect.w - fixed) / widths.filter((w) => w <= 0).length;
  const out: StatusPanel[] = [];
  let x = rect.x;
  for (const w of widths) {
    const pw = w > 0 ? w : flexW;
    out.push({ x, y: rect.y, w: pw, h: rect.h });
    x += pw;
  }
  return out;
}

/** Clamp a window position so it can never be dragged fully off the client area. */
export function clampHelpPosition(layout: Layout, x: number, y: number): { x: number; y: number } {
  const c = layout.client;
  const minX = c.x - HELP_W + HELP_MIN_VISIBLE;
  const maxX = c.x + c.w - HELP_MIN_VISIBLE;
  const minY = c.y - HELP_H + HELP_MIN_VISIBLE;
  const maxY = c.y + c.h - HELP_MIN_VISIBLE;
  return {
    x: Math.max(minX, Math.min(maxX, x)),
    y: Math.max(minY, Math.min(maxY, y)),
  };
}

/** The first-open position: centred in the client area, clamped so it fits. */
export function defaultHelpPosition(layout: Layout): { x: number; y: number } {
  return clampHelpPosition(
    layout,
    layout.client.x + Math.floor((layout.client.w - HELP_W) / 2),
    layout.client.y + Math.floor((layout.client.h - HELP_H) / 2),
  );
}

/** The art preview box a page draws, and the sprite sizes that fit inside it. */
export interface HelpArtLayout {
  /** Preview sprite size for the base texture, in px. */
  readonly basePx: number;
  /** Preview sprite size for the turret texture, in px (0 = no turret). */
  readonly turretPx: number;
  /** The sunken box, relative to the page text area's top-left corner. */
  readonly box: Rect;
}

/**
 * The preview sprite sizes for a page, derived from the same constants the board draws with
 * (docs/HELP-ART.md §2): twice the board's sprite size, rounded up to whole px.
 *
 * - An enemy (or boss) body is `artSpriteSize(ENEMY_ART_BODY[kind] * radius * cell)` on the board, so
 *   the preview is `2 * artSpriteSize(ENEMY_ART_BODY[kind] * ENEMY_STATS[kind].radius * cell)`.
 * - A tower body and turret are drawn at exactly `cell` on the board, so both preview at `2 * cell`.
 */
export function helpArtLayout(page: HelpPage, maxWidth: number): HelpArtLayout | null {
  if (!page.art) return null;

  const gate = page.gate;
  let basePx: number;
  let turretPx = 0;
  if (gate.kind === 'tower') {
    basePx = Math.ceil(2 * HELP_REFERENCE_CELL);
    if (page.art.turret !== undefined) turretPx = basePx;
  } else if (gate.kind === 'enemy' || gate.kind === 'boss') {
    basePx = enemyPreviewPx(gate.enemy);
  } else {
    // An art-bearing page is always an enemy, boss or tower page.
    return null;
  }

  const size = Math.max(basePx, turretPx) + 2 * HELP_ART_PAD;
  const box: Rect = { x: maxWidth - HELP_ART_INSET - size, y: HELP_ART_INSET, w: size, h: size };
  return { basePx, turretPx, box };
}

/** Twice the board's sprite size for an enemy or boss body, rounded up to a whole pixel. */
function enemyPreviewPx(kind: EnemyKind): number {
  return Math.ceil(2 * artSpriteSize(ENEMY_ART_BODY[kind] * ENEMY_STATS[kind].radius * HELP_REFERENCE_CELL));
}

/**
 * The single layout of a page's body (docs/HELP-ART.md §3, docs/HELP-MARKDOWN.md): parsed Markdown
 * blocks laid out into positioned runs and tables. The view draws from this and `pageBodyHeight`
 * reads its height, so the wrap/table logic lives in exactly one place. The title is drawn separately.
 */
function helpPageLayout(page: HelpPage, maxWidth: number): HelpPageLayout {
  const blocks = parseHelpMarkdown(page.body);
  const art = helpArtLayout(page, maxWidth);
  return layoutHelpBlocks(blocks, maxWidth, art !== null ? art.box : null, helpMeasure);
}

/** The pixel height a page needs at a given text width — exactly the height the layout produced. */
export function pageBodyHeight(page: HelpPage, maxWidth: number): number {
  return helpPageLayout(page, maxWidth).height;
}

/** The scroll geometry for a page: how far it can scroll, plus the track and thumb rectangles. */
export interface HelpScroll {
  maxScroll: number;
  scroll: number;
  scrollbar: Rect;
  thumb: Rect;
}

export function computeHelpScroll(page: HelpPage | undefined, pageText: Rect, scroll: number): HelpScroll {
  const contentH = page ? pageBodyHeight(page, pageText.w) : 0;
  const maxScroll = Math.max(0, contentH - pageText.h);
  const s = Math.min(Math.max(0, scroll), maxScroll);
  const scrollbar: Rect = {
    x: pageText.x + pageText.w + 2,
    y: pageText.y,
    w: HELP_SCROLL_TRACK_W,
    h: pageText.h,
  };
  const trackH = scrollbar.h;
  const thumbH = maxScroll > 0 ? Math.max(14, Math.round(trackH * (pageText.h / Math.max(1, contentH)))) : trackH;
  const thumbY = maxScroll > 0 ? Math.round((trackH - thumbH) * (s / maxScroll)) : 0;
  const thumb: Rect = { x: scrollbar.x, y: scrollbar.y + thumbY, w: scrollbar.w, h: thumbH };
  return { maxScroll, scroll: s, scrollbar, thumb };
}

// ---------------------------------------------------------------------------------------------
// The contents tree and the index / search lists

export interface HelpChapterRow {
  readonly kind: 'chapter';
  readonly index: number;
  readonly title: string;
  readonly expanded: boolean;
}

export interface HelpPageRow {
  readonly kind: 'page';
  readonly chapterIndex: number;
  readonly page: HelpPage;
  readonly locked: boolean;
}

export type HelpRow = HelpChapterRow | HelpPageRow;

/** The flat tree rows for the current expansion state. At most one chapter is expanded at a time. */
export function helpRows(profile: Profile, expanded: number | null): HelpRow[] {
  const rows: HelpRow[] = [];
  HELP_CATEGORIES.forEach((cat, i) => {
    rows.push({ kind: 'chapter', index: i, title: cat.title, expanded: expanded === i });
    if (expanded === i) {
      for (const page of HELP_PAGES) {
        if (page.category !== cat.id) continue;
        rows.push({ kind: 'page', chapterIndex: i, page, locked: !pageUnlocked(page, profile) });
      }
    }
  });
  return rows;
}

/** The label a tree row renders: "Undiscovered" for a locked page, so the name is never revealed. */
export function treeRowLabel(row: HelpRow): string {
  if (row.kind === 'chapter') return row.title;
  return row.locked ? 'Undiscovered' : row.page.title;
}

/** The Index tab's scrollable A-Z list: every unlocked page title, sorted alphabetically. */
export function helpIndexList(profile: Profile): HelpPage[] {
  return HELP_PAGES.filter((p) => pageUnlocked(p, profile)).sort((a, b) => a.title.localeCompare(b.title));
}

/** The Search tab's live filter: unlocked pages whose title contains the substring (case-insensitive). */
export function helpSearchResults(text: string, profile: Profile): HelpPage[] {
  const q = text.trim().toLowerCase();
  if (q === '') return [];
  return HELP_PAGES.filter((p) => pageUnlocked(p, profile) && p.title.toLowerCase().includes(q));
}

export type HelpHit =
  | { type: 'close' }
  | { type: 'title' }
  | { type: 'toolbar'; action: HelpToolbarAction }
  | { type: 'tree'; row: number }
  | { type: 'index'; row: number }
  | { type: 'search-field' }
  | { type: 'nav-tab'; tab: HelpNavTab }
  | { type: 'splitter' }
  | { type: 'page' }
  | { type: 'window' }
  | null;

function treeRowAt(hl: HelpLayout, rows: readonly HelpRow[], y: number): number {
  const top = hl.treePanel.y + HELP_TREE_PAD;
  const rel = y - top;
  if (rel < 0) return -1;
  const index = Math.floor(rel / HELP_TREE_ROW_H);
  return index >= 0 && index < rows.length ? index : -1;
}

/** What the pointer is over inside the help window, or null when it is outside. */
export function helpHitAt(hl: HelpLayout, rows: readonly HelpRow[], x: number, y: number): HelpHit {
  if (!pointInRect(hl.window, x, y)) return null;
  if (pointInRect(hl.close, x, y)) return { type: 'close' };
  if (pointInRect(hl.title, x, y)) return { type: 'title' };
  if (pointInRect(hl.navToggle, x, y)) return { type: 'toolbar', action: 'nav' };
  if (pointInRect(hl.back, x, y)) return { type: 'toolbar', action: 'back' };
  if (pointInRect(hl.forward, x, y)) return { type: 'toolbar', action: 'forward' };
  if (pointInRect(hl.home, x, y)) return { type: 'toolbar', action: 'home' };
  if (pointInRect(hl.print, x, y)) return { type: 'toolbar', action: 'print' };
  if (pointInRect(hl.options, x, y)) return { type: 'toolbar', action: 'options' };
  if (pointInRect(hl.splitter, x, y)) return { type: 'splitter' };
  for (const t of hl.navTabs) {
    if (pointInRect(t.rect, x, y)) return { type: 'nav-tab', tab: t.id };
  }
  if (pointInRect(hl.treePanel, x, y)) {
    if (pointInRect(hl.searchField, x, y)) return { type: 'search-field' };
    return { type: 'tree', row: treeRowAt(hl, rows, y) };
  }
  if (pointInRect(hl.pagePanel, x, y)) return { type: 'page' };
  return { type: 'window' };
}

/** The nav-pane hit for the Index/Search tabs (rows in the list, or the search field). */
export function helpNavHitAt(hl: HelpLayout, navTab: HelpNavTab, listLength: number, x: number, y: number): { type: 'index'; row: number } | { type: 'search-field' } | null {
  if (!pointInRect(hl.treePanel, x, y)) return null;
  if (pointInRect(hl.searchField, x, y)) return { type: 'search-field' };
  if (navTab === 'index') {
    const rel = y - hl.indexList.y;
    const row = Math.floor(rel / HELP_TREE_ROW_H);
    return row >= 0 && row < listLength ? { type: 'index', row } : null;
  }
  return null;
}

/** The row under a point in the Search tab's result list, or -1. */
export function helpSearchRowAt(hl: HelpLayout, results: readonly HelpPage[], x: number, y: number): number {
  if (!pointInRect(hl.treePanel, x, y)) return -1;
  const top = hl.searchField.y + hl.searchField.h + 6;
  const rel = y - top;
  if (rel < 0) return -1;
  const row = Math.floor(rel / HELP_TREE_ROW_H);
  return row >= 0 && row < results.length ? row : -1;
}

// ---------------------------------------------------------------------------------------------
// Session state (single instance, draggable, splitter, nav tabs, visited-page history)

export class HelpSession {
  open = false;
  x = 0;
  y = 0;
  pageId: string | null = HELP_PAGES[0].id;
  expanded: number | null = null;
  status = '';
  dragging = false;
  navTab: HelpNavTab = 'contents';
  searchText = '';
  navW = HELP_NAV_W;
  navVisible = true;
  /** Every page id the player has opened this session (for the shadow-clippy rule). */
  readonly visited = new Set<string>([HELP_PAGES[0].id]);
  /** True once a drag pushed the window against the clamped edge (for the shadow-drag rule). */
  draggedToEdge = false;
  /** Vertical scroll offset of the open page, in pixels (clamped when read). */
  scroll = 0;
  /** Vertical scroll offset of the Index list, in rows. */
  indexScroll = 0;

  private history: string[] = [HELP_PAGES[0].id];
  private index = 0;
  private centered = false;
  private dragDx = 0;
  private dragDy = 0;

  /** How many currently-unlocked pages have been opened this session. */
  visitedCount(profile: Profile): number {
    let n = 0;
    for (const p of HELP_PAGES) if (pageUnlocked(p, profile) && this.visited.has(p.id)) n++;
    return n;
  }

  /** Open the window (no second instance): it centres on first open, then keeps its position. */
  show(layout: Layout): void {
    if (this.open) return;
    this.open = true;
    this.dragging = false;
    if (!this.centered) {
      const p = defaultHelpPosition(layout);
      this.x = p.x;
      this.y = p.y;
      this.centered = true;
    } else {
      this.reclamp(layout);
    }
  }

  hide(): void {
    this.open = false;
    this.dragging = false;
  }

  startDrag(x: number, y: number): void {
    this.dragging = true;
    this.dragDx = x - this.x;
    this.dragDy = y - this.y;
  }

  dragTo(layout: Layout, x: number, y: number): void {
    if (!this.dragging) return;
    const rx = x - this.dragDx;
    const ry = y - this.dragDy;
    const p = clampHelpPosition(layout, rx, ry);
    if (p.x !== rx || p.y !== ry) this.draggedToEdge = true;
    this.x = p.x;
    this.y = p.y;
  }

  endDrag(): void {
    this.dragging = false;
  }

  /** Keep the window inside a (possibly resized) client area. */
  reclamp(layout: Layout): void {
    const p = clampHelpPosition(layout, this.x, this.y);
    this.x = p.x;
    this.y = p.y;
  }

  back(): void {
    if (this.index <= 0) return;
    this.index -= 1;
    this.pageId = this.history[this.index];
    this.scroll = 0;
  }

  forward(): void {
    if (this.index >= this.history.length - 1) return;
    this.index += 1;
    this.pageId = this.history[this.index];
    this.scroll = 0;
  }

  home(): void {
    this.select(HELP_PAGES[0].id);
  }

  canBack(): boolean {
    return this.index > 0;
  }

  canForward(): boolean {
    return this.index < this.history.length - 1;
  }

  /** Collapse the tree back to its chapter headings (the "top" of the contents). */
  contents(): void {
    this.expanded = null;
  }

  setNavTab(tab: HelpNavTab): void {
    this.navTab = tab;
  }

  toggleNav(): void {
    this.navVisible = !this.navVisible;
  }

  /** Drag the splitter to a client-relative width, clamped to 140-320 px. */
  dragSplitter(navW: number): void {
    this.navW = Math.max(HELP_NAV_MIN, Math.min(HELP_NAV_MAX, navW));
  }

  /** Scroll the open page by `dy` pixels, clamped to the page's range. */
  scrollBy(dy: number, hl: HelpLayout): void {
    const page = this.pageId ? pageById(this.pageId) : undefined;
    this.scroll = computeHelpScroll(page, hl.pageText, this.scroll + dy).scroll;
  }

  /** Scroll one panel height up (dir < 0) or down (dir > 0). */
  scrollPage(dir: number, hl: HelpLayout): void {
    this.scrollBy(dir * hl.pageText.h, hl);
  }

  private select(id: string): void {
    this.visited.add(id);
    if (this.history[this.index] === id) return;
    this.history = this.history.slice(0, this.index + 1);
    this.history.push(id);
    this.index = this.history.length - 1;
    this.pageId = id;
    this.scroll = 0;
  }

  /** Open a page by id, whether from the tree, the index or the search list. */
  openPageId(id: string): void {
    const page = pageById(id);
    if (!page) return;
    this.status = '';
    this.select(id);
  }

  /**
   * Open the viewer at a specific page (docs/CONTEXT-HELP.md): selects it in the nav panel, scrolled
   * to the top. Returns false — and changes nothing — when the page does not exist or is locked.
   */
  openAt(pageId: string, profile: Profile, layout: Layout): boolean {
    const page = pageById(pageId);
    if (!page || !pageUnlocked(page, profile)) return false;
    this.show(layout);
    const chapter = HELP_CATEGORIES.findIndex((c) => c.id === page.category);
    if (chapter >= 0) this.expanded = chapter;
    this.status = '';
    this.select(pageId);
    return true;
  }

  /** Handle a click on a tree row: chapters toggle, locked pages explain, unlocked pages open. */
  clickTree(row: HelpRow): void {
    if (row.kind === 'chapter') {
      this.expanded = this.expanded === row.index ? null : row.index;
      return;
    }
    if (row.locked) {
      this.status = lockedReason(row.page.gate) ?? '';
      return;
    }
    this.status = '';
    this.select(row.page.id);
  }
}

// ---------------------------------------------------------------------------------------------
// View

function makeText(text: string, size: number, bold = false, fill: number): Text {
  return new Text({
    text,
    style: { fontFamily: FONT, fontSize: size, fill, fontWeight: bold ? 'bold' : 'normal' },
  });
}

function chapterTitle(category: HelpCategory): string {
  return HELP_CATEGORIES.find((c) => c.id === category)?.title ?? category;
}

/** The status-bar topic path: "Category › Page", or the title alone when the two coincide. */
export function helpTopicPath(page: HelpPage | undefined): string {
  if (!page) return 'Select a topic from the contents';
  const cat = chapterTitle(page.category);
  return cat === page.title ? page.title : `${cat} › ${page.title}`;
}

export class HelpView {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly titleText: Text;
  private readonly statusText: Text;
  private readonly heading: Text;
  private readonly searchFieldText: Text;
  private readonly treeTexts: Text[] = [];
  private readonly bodyTexts: Text[] = [];
  private readonly navTexts: Text[] = [];
  private readonly pageLayer = new Container();
  private readonly pageMask = new Graphics();
  /** The sunken frame + paper fill of the art preview box, drawn in the page layer so it scrolls. */
  private readonly artFrame = new Graphics();
  /** Table rules and header fills, drawn in the page layer so they scroll with the body. */
  private readonly tableG = new Graphics();
  /** The pooled preview sprites: one base and one turret, reused every frame (docs/HELP-ART.md §5). */
  private readonly artBase = new Sprite();
  private readonly artTurret = new Sprite();

  constructor() {
    this.titleText = makeText('Pointer Defense Help', FONT_SIZE.body, true, PAL.titleInverse);
    this.titleText.anchor.set(0, 0.5);
    this.statusText = makeText('', FONT_SIZE.small, false, PAL.text);
    this.statusText.anchor.set(0, 0.5);
    this.heading = makeText('', FONT_SIZE.body, true, PAL.text);
    this.heading.anchor.set(0, 0);
    this.searchFieldText = makeText('', FONT_SIZE.small, false, PAL.text);
    this.searchFieldText.anchor.set(0, 0.5);

    this.artBase.anchor.set(0.5, 0.5);
    this.artTurret.anchor.set(0.5, 0.5);

    this.root.addChild(this.g, this.titleText, this.statusText, this.searchFieldText);
    this.pageLayer.addChild(this.heading, this.artFrame, this.tableG, this.artBase, this.artTurret);
    this.pageLayer.mask = this.pageMask;
    this.root.addChild(this.pageLayer);

    for (let i = 0; i < 24; i++) {
      const t = makeText('', FONT_SIZE.small, false, PAL.text);
      t.anchor.set(0, 0.5);
      this.treeTexts.push(t);
      this.root.addChild(t);
    }
    for (let i = 0; i < 40; i++) {
      const t = makeText('', FONT_SIZE.small, false, PAL.text);
      t.anchor.set(0, 0);
      this.bodyTexts.push(t);
      this.pageLayer.addChild(t);
    }
  }

  private treeTextAt(index: number): Text {
    let t = this.treeTexts[index];
    if (!t) {
      t = makeText('', FONT_SIZE.small, false, PAL.text);
      t.anchor.set(0, 0.5);
      this.treeTexts.push(t);
      this.root.addChild(t);
    }
    return t;
  }

  private navTextAt(index: number): Text {
    let t = this.navTexts[index];
    if (!t) {
      t = makeText('', FONT_SIZE.small, false, PAL.text);
      t.anchor.set(0, 0.5);
      this.navTexts.push(t);
      this.root.addChild(t);
    }
    return t;
  }

  private bodyTextAt(index: number): Text {
    let t = this.bodyTexts[index];
    if (!t) {
      t = makeText('', FONT_SIZE.small, false, PAL.text);
      t.anchor.set(0, 0);
      this.bodyTexts.push(t);
      this.pageLayer.addChild(t);
    }
    return t;
  }

  draw(session: HelpSession, profile: Profile, hoverX: number, hoverY: number, clock: number): void {
    const g = this.g;
    g.clear();
    if (!session.open) {
      this.titleText.text = '';
      this.statusText.text = '';
      this.heading.text = '';
      this.searchFieldText.text = '';
      this.artFrame.clear();
      this.tableG.clear();
      this.artBase.visible = false;
      this.artTurret.visible = false;
      for (const t of this.treeTexts) t.text = '';
      for (const t of this.bodyTexts) t.text = '';
      for (const t of this.navTexts) t.text = '';
      return;
    }

    const hl = computeHelpLayout(session.x, session.y, session.navW);
    const rows = helpRows(profile, session.expanded);
    const hover = helpHitAt(hl, rows, hoverX, hoverY);

    // Frame, title bar and close box.
    drawWindowChrome(g, hl.window, { close: true, minimize: false, maximize: false });
    this.titleText.text = 'Pointer Defense Help';
    this.titleText.position.set(hl.title.x + 6, hl.title.y + Math.floor(TITLE_H / 2));

    // Toolbar: six flat 24 px buttons with drawn glyphs.
    g.rect(hl.toolbar.x, hl.toolbar.y, hl.toolbar.w, hl.toolbar.h).fill(PAL.face);
    const canBack = session.canBack();
    const canForward = session.canForward();
    this.drawToolbarGlyph(g, 'nav', hl.navToggle, true);
    this.drawToolbarGlyph(g, 'back', hl.back, canBack);
    this.drawToolbarGlyph(g, 'forward', hl.forward, canForward);
    this.drawToolbarGlyph(g, 'home', hl.home, true);
    this.drawToolbarGlyph(g, 'print', hl.print, false);
    this.drawToolbarGlyph(g, 'options', hl.options, true);

    // Nav pane + splitter + page pane.
    bevel(g, hl.treePanel, false, PAL.highlight);
    g.rect(hl.splitter.x, hl.splitter.y, hl.splitter.w, hl.splitter.h).fill(PAL.face);
    g.rect(hl.splitter.x, hl.splitter.y, 1, hl.splitter.h).fill(PAL.highlight);
    g.rect(hl.splitter.x + hl.splitter.w - 1, hl.splitter.y, 1, hl.splitter.h).fill(PAL.shadow);
    g.rect(hl.splitter.x + Math.floor(hl.splitter.w / 2) - 1, hl.splitter.y + Math.floor(hl.splitter.h / 2) - 8, 2, 16).fill(PAL.shadow);
    bevel(g, hl.pagePanel, false, PAL.highlight);

    // Nav pane content.
    if (session.navTab === 'contents') this.drawContents(g, hl, rows, session, hover);
    else if (session.navTab === 'index') this.drawIndex(g, hl, profile, session);
    else this.drawSearch(g, hl, profile, session);

    // Nav tab strip at the foot.
    const activeIdx = session.navTab === 'contents' ? 0 : session.navTab === 'index' ? 1 : 2;
    drawTabStrip(g, hl.navTabStrip, ['Contents', 'Index', 'Search'], activeIdx);
    let tabX = hl.navTabStrip.x;
    const tabW = Math.floor(hl.navTabStrip.w / 3);
    for (let i = 0; i < 3; i++) {
      const t = this.navTextAt(24 + i);
      t.text = ['Contents', 'Index', 'Search'][i];
      t.style.fontWeight = 'normal';
      t.style.fill = i === activeIdx ? PAL.text : PAL.text;
      t.anchor.set(0.5, 0.5);
      t.position.set(tabX + tabW / 2, hl.navTabStrip.y + Math.floor(hl.navTabStrip.h / 2));
      tabX += tabW;
    }

    // Page pane.
    const page = session.pageId ? pageById(session.pageId) : undefined;
    const scroll = computeHelpScroll(page, hl.pageText, session.scroll);
    this.pageMask.clear();
    this.pageMask.rect(hl.pageText.x, hl.pageText.y, hl.pageText.w, hl.pageText.h).fill(0xffffff);
    if (scroll.maxScroll > 0) {
      g.rect(scroll.scrollbar.x, scroll.scrollbar.y, scroll.scrollbar.w, scroll.scrollbar.h).fill(PAL.shadow);
      bevel(g, scroll.thumb, true, PAL.face);
    }
    this.drawPage(hl, session, scroll.scroll, clock);

    // Status bar: topic path left, Page n of m right.
    drawStatusBar(g, hl.status, [0, 110]);
    const path = helpTopicPath(page);
    const pageIndex = page ? HELP_PAGES.indexOf(page) + 1 : 0;
    this.statusText.text = path;
    this.statusText.position.set(hl.statusPanels[0].x + 4, hl.status.y + Math.floor(HELP_STATUS_H / 2));
    const pageNo = this.navTextAt(30);
    pageNo.text = `Page ${pageIndex} of ${HELP_PAGES.length}`;
    pageNo.style.fontWeight = 'normal';
    pageNo.style.fill = PAL.text;
    pageNo.anchor.set(0, 0.5);
    pageNo.position.set(hl.statusPanels[1].x + 4, hl.status.y + Math.floor(HELP_STATUS_H / 2));
    for (let i = 31; i < this.navTexts.length; i++) this.navTexts[i].text = '';
  }

  private drawToolbarGlyph(g: Graphics, action: HelpToolbarAction, r: Rect, enabled: boolean): void {
    const color = enabled ? PAL.text : PAL.shadow;
    const cx = r.x + Math.floor(r.w / 2);
    const cy = r.y + Math.floor(r.h / 2);
    if (action === 'nav') {
      g.rect(cx - 7, cy - 7, 14, 14).stroke({ width: 1, color });
      g.rect(cx - 7, cy - 7, 3, 14).fill(color);
    } else if (action === 'back') {
      g.poly([cx + 4, cy - 6, cx + 4, cy + 6, cx - 4, cy]).fill(color);
    } else if (action === 'forward') {
      g.poly([cx - 4, cy - 6, cx - 4, cy + 6, cx + 4, cy]).fill(color);
    } else if (action === 'home') {
      g.poly([cx, cy - 7, cx - 7, cy, cx + 7, cy]).fill(color);
      g.rect(cx - 4, cy, 8, 7).fill(color);
    } else if (action === 'print') {
      g.rect(cx - 6, cy - 6, 12, 9).fill(color);
      g.rect(cx - 3, cy - 9, 6, 5).fill(color);
    } else {
      g.circle(cx, cy, 5).stroke({ width: 1, color });
      g.circle(cx, cy, 2).fill(color);
    }
  }

  private drawContents(g: Graphics, hl: HelpLayout, rows: readonly HelpRow[], session: HelpSession, hover: HelpHit): void {
    const hoverRow = hover?.type === 'tree' ? hover.row : -1;
    // Dotted guide line connecting the page rows under the one expanded chapter.
    let guideX = -1;
    let firstPageY = -1;
    let lastPageY = -1;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const text = this.treeTextAt(i);
      const y = hl.treePanel.y + HELP_TREE_PAD + i * HELP_TREE_ROW_H;
      const selected = row.kind === 'page' && !row.locked && session.pageId === row.page.id;
      const rowHovered = i === hoverRow;

      if (selected) g.rect(hl.treePanel.x + 2, y, hl.treePanel.w - 4, HELP_TREE_ROW_H).fill(PAL.title);
      else if (rowHovered && (row.kind === 'chapter' || !row.locked)) g.rect(hl.treePanel.x + 2, y, hl.treePanel.w - 4, HELP_TREE_ROW_H).fill(PAL.highlight);

      if (row.kind === 'chapter') {
        const bx = hl.treePanel.x + 4;
        const by = y + 4;
        // The 9x9 [+]/[-] box: a 1 px black border with a drawn plus or minus.
        g.rect(bx, by, 9, 9).fill(PAL.highlight);
        g.rect(bx, by, 9, 9).stroke({ width: 1, color: PAL.dark });
        const bxc = bx + 4.5;
        const byc = by + 4.5;
        g.moveTo(bxc - 2, byc).lineTo(bxc + 2, byc).stroke({ width: 1, color: PAL.dark });
        if (!row.expanded) g.moveTo(bxc, byc - 2).lineTo(bxc, byc + 2).stroke({ width: 1, color: PAL.dark });
        text.text = row.title;
        text.style.fill = PAL.text;
        text.position.set(bx + 13, y + Math.floor(HELP_TREE_ROW_H / 2));
      } else {
        const px = hl.treePanel.x + 4 + HELP_TREE_INDENT;
        const iconX = px - 10;
        g.rect(iconX, y + 5, 8, 8).stroke({ width: 1, color: row.locked ? PAL.shadow : PAL.text });
        if (guideX < 0) guideX = iconX + 4;
        if (firstPageY < 0) firstPageY = y + 9;
        lastPageY = y + 9;
        text.text = treeRowLabel(row);
        text.style.fill = row.locked ? PAL.shadow : selected ? PAL.titleInverse : PAL.text;
        text.position.set(px, y + Math.floor(HELP_TREE_ROW_H / 2));
      }
    }
    if (guideX >= 0 && lastPageY > firstPageY) dottedLine(g, guideX, firstPageY, guideX, lastPageY, PAL.shadow);
    for (let i = rows.length; i < this.treeTexts.length; i++) this.treeTexts[i].text = '';
  }

  private drawIndex(g: Graphics, hl: HelpLayout, profile: Profile, session: HelpSession): void {
    const list = helpIndexList(profile);
    for (let i = 0; i < list.length; i++) {
      const y = hl.indexList.y + i * HELP_TREE_ROW_H;
      if (y + HELP_TREE_ROW_H > hl.navTabStrip.y) break;
      const selected = session.pageId === list[i].id;
      if (selected) g.rect(hl.treePanel.x + 2, y, hl.treePanel.w - 4, HELP_TREE_ROW_H).fill(PAL.title);
      const t = this.treeTextAt(i);
      t.text = list[i].title;
      t.style.fill = selected ? PAL.titleInverse : PAL.text;
      t.position.set(hl.treePanel.x + 8, y + Math.floor(HELP_TREE_ROW_H / 2));
    }
    for (let i = list.length; i < this.treeTexts.length; i++) this.treeTexts[i].text = '';
  }

  private drawSearch(g: Graphics, hl: HelpLayout, profile: Profile, session: HelpSession): void {
    bevel(g, hl.searchField, false, PAL.highlight);
    this.searchFieldText.text = session.searchText;
    this.searchFieldText.position.set(hl.searchField.x + 4, hl.searchField.y + Math.floor(hl.searchField.h / 2));
    bevel(g, hl.searchButton, true, PAL.face);
    const bt = this.navTextAt(20);
    bt.text = 'Search';
    bt.style.fontWeight = 'normal';
    bt.style.fill = PAL.text;
    bt.anchor.set(0.5, 0.5);
    bt.position.set(hl.searchButton.x + hl.searchButton.w / 2, hl.searchButton.y + Math.floor(hl.searchButton.h / 2));

    const results = helpSearchResults(session.searchText, profile);
    let y = hl.searchField.y + hl.searchField.h + 6;
    for (let i = 0; i < results.length; i++) {
      if (y + HELP_TREE_ROW_H > hl.navTabStrip.y) break;
      const selected = session.pageId === results[i].id;
      if (selected) g.rect(hl.treePanel.x + 2, y, hl.treePanel.w - 4, HELP_TREE_ROW_H).fill(PAL.title);
      const t = this.treeTextAt(i);
      t.text = results[i].title;
      t.style.fill = selected ? PAL.titleInverse : PAL.text;
      t.position.set(hl.treePanel.x + 8, y + Math.floor(HELP_TREE_ROW_H / 2));
      y += HELP_TREE_ROW_H;
    }
    for (let i = results.length; i < this.treeTexts.length; i++) this.treeTexts[i].text = '';
  }

  private drawPage(hl: HelpLayout, session: HelpSession, scrollOffset: number, clock: number): void {
    const page = session.pageId ? pageById(session.pageId) : undefined;
    if (!page) {
      this.heading.text = '';
      this.artFrame.clear();
      this.tableG.clear();
      this.artBase.visible = false;
      this.artTurret.visible = false;
      for (const t of this.bodyTexts) t.text = '';
      return;
    }

    this.heading.text = page.title;
    this.heading.style.fill = PAL.navy;
    this.heading.style.fontWeight = 'bold';
    this.heading.style.fontSize = 16;
    this.heading.position.set(hl.pageText.x, hl.pageText.y - scrollOffset);

    // The art preview box: a sunken 1 px frame with a paper fill, its sprite(s) clipped to the page.
    this.drawArtBox(page, hl, scrollOffset, clock);

    const layout = helpPageLayout(page, hl.pageText.w);
    const g = this.tableG;
    g.clear();
    let textIdx = 0;
    const placeRun = (run: { text: string; bold: boolean; italic: boolean; code: boolean; x: number; y: number }): void => {
      const t = this.bodyTextAt(textIdx++);
      t.text = run.text;
      t.style.fill = PAL.text;
      t.style.fontWeight = run.bold ? 'bold' : 'normal';
      t.style.fontStyle = run.italic ? 'italic' : 'normal';
      t.style.fontFamily = run.code ? 'Courier New, monospace' : FONT;
      t.style.fontSize = FONT_SIZE.body;
      t.position.set(hl.pageText.x + run.x, hl.pageText.y + run.y - scrollOffset);
    };

    for (const item of layout.items) {
      if (item.kind === 'text') {
        for (const run of item.runs) placeRun(run);
      } else {
        const ox = hl.pageText.x + item.x;
        const oy = hl.pageText.y + item.y - scrollOffset;
        g.rect(ox, oy, item.width, item.headerHeight).fill(PAL.face);
        for (const ry of item.ruleY) g.rect(ox, hl.pageText.y + ry - scrollOffset, item.width, 1).fill(PAL.shadow);
        for (const cx of item.columnX) g.rect(hl.pageText.x + cx, oy, 1, item.height).fill(PAL.shadow);
        g.rect(ox + item.width - 1, oy, 1, item.height).fill(PAL.shadow);
        for (const row of item.cells) for (const cell of row) for (const run of cell) placeRun(run);
      }
    }
    for (let i = textIdx; i < this.bodyTexts.length; i++) this.bodyTexts[i].text = '';
  }

  /** Draw the art preview box and its pooled sprites, hidden when the page has no art. */
  private drawArtBox(page: HelpPage, hl: HelpLayout, scrollOffset: number, clock: number): void {
    const art = helpArtLayout(page, hl.pageText.w);
    const g = this.artFrame;
    g.clear();
    if (art === null || !page.art) {
      this.artBase.visible = false;
      this.artTurret.visible = false;
      return;
    }

    const bx = hl.pageText.x + art.box.x;
    const by = hl.pageText.y + art.box.y - scrollOffset;
    const box = art.box;

    // Sunken 1 px frame over a paper fill.
    g.rect(bx, by, box.w, box.h).fill(PAL.highlight);
    g.rect(bx, by, box.w, 1).fill(PAL.shadow);
    g.rect(bx, by, 1, box.h).fill(PAL.shadow);
    g.rect(bx, by + box.h - 1, box.w, 1).fill(PAL.light);
    g.rect(bx + box.w - 1, by, 1, box.h).fill(PAL.light);

    const cx = bx + box.w / 2;
    const cy = by + box.h / 2;

    // Base first, then the turret at angle 0 (facing right), both centred in the box.
    const baseTex = frameTexture(page.art.base, art.basePx, clock, 0);
    if (baseTex !== null) {
      this.artBase.texture = baseTex;
      this.artBase.visible = true;
      this.artBase.width = art.basePx;
      this.artBase.height = art.basePx;
      this.artBase.tint = 0xffffff;
      this.artBase.rotation = 0;
      this.artBase.alpha = 1;
      this.artBase.position.set(cx, cy);
    } else {
      this.artBase.visible = false;
    }

    if (art.turretPx > 0 && page.art.turret !== undefined) {
      const turretTex = frameTexture(page.art.turret, art.turretPx, clock, 0);
      if (turretTex !== null) {
        this.artTurret.texture = turretTex;
        this.artTurret.visible = true;
        this.artTurret.width = art.turretPx;
        this.artTurret.height = art.turretPx;
        this.artTurret.tint = 0xffffff;
        this.artTurret.rotation = 0;
        this.artTurret.alpha = 1;
        this.artTurret.position.set(cx, cy);
      } else {
        this.artTurret.visible = false;
      }
    } else {
      this.artTurret.visible = false;
    }
  }
}
