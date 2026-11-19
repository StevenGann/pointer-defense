import { Container, Graphics, Text } from 'pixi.js';
import {
  bevel,
  CONTROL_BOX_H,
  CONTROL_BOX_W,
  FONT,
  FONT_SIZE,
  PAL,
  TITLE_H,
  pointInRect,
  type Layout,
  type Rect,
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

/**
 * The Help viewer: a fixed, draggable Windows 95 window that looks like the CHM help viewer.
 *
 * The model here (layout, hit-testing, tree building, the session) is Pixi-free so the smoke
 * harness can assert the window geometry, the gates and the "one page per kind" contract. The
 * `HelpView` class at the bottom turns that model into Graphics/Text calls.
 *
 * It is a viewer, not a pause: the game clock keeps ticking and the run keeps going behind it.
 */

export const HELP_W = 620;
export const HELP_H = 400;
export const HELP_TOOLBAR_H = 28;
export const HELP_STATUS_H = 18;
export const HELP_TREE_W = 190;
export const HELP_TREE_ROW_H = 18;
export const HELP_PAGE_PAD = 8;
export const HELP_TREE_PAD = 4;
export const HELP_LINE_H = 15;
export const HELP_HEADING_H = 20;
/** Column reserved on the page panel's right edge for the scrollbar track. */
export const HELP_SCROLL_W = 12;
/** Width of the scrollbar track itself, inside the reserved column. */
export const HELP_SCROLL_TRACK_W = 8;
/** Lines the page scrolls per mouse-wheel notch. */
export const HELP_SCROLL_LINES = 3;
const HELP_INDENT = 14;
const HELP_MIN_VISIBLE = 32;

export interface HelpLayout {
  window: Rect;
  title: Rect;
  close: Rect;
  toolbar: Rect;
  back: Rect;
  forward: Rect;
  contents: Rect;
  treePanel: Rect;
  pagePanel: Rect;
  pageText: Rect;
  status: Rect;
}

/** The fixed window geometry at a given top-left position, derived so drawing and hit-testing agree. */
export function computeHelpLayout(x: number, y: number): HelpLayout {
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
  const treePanel: Rect = { x: x + 2, y: clientTop, w: HELP_TREE_W, h: clientBottom - clientTop };
  const pagePanel: Rect = {
    x: treePanel.x + treePanel.w + 2,
    y: clientTop,
    w: x + HELP_W - 2 - (treePanel.x + treePanel.w + 2),
    h: clientBottom - clientTop,
  };
  const pageText: Rect = {
    x: pagePanel.x + HELP_PAGE_PAD,
    y: pagePanel.y + HELP_PAGE_PAD,
    w: pagePanel.w - HELP_PAGE_PAD * 2 - HELP_SCROLL_W,
    h: pagePanel.h - HELP_PAGE_PAD * 2,
  };

  const bh = 22;
  let bx = toolbar.x + 6;
  const back: Rect = { x: bx, y: toolbar.y + Math.floor((HELP_TOOLBAR_H - bh) / 2), w: 56, h: bh };
  bx += 56 + 4;
  const forward: Rect = { x: bx, y: back.y, w: 56, h: bh };
  bx += 56 + 4;
  const contents: Rect = { x: bx, y: back.y, w: 76, h: bh };

  return { window: win, title, close, toolbar, back, forward, contents, treePanel, pagePanel, pageText, status };
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

/** The width estimate used to wrap page text, conservative so a page never clips. */
export function estimateTextWidth(text: string, size: number): number {
  return Math.ceil(text.length * size * 0.6);
}

/** Greedy word-wrap to a pixel width, using the conservative width estimate. */
export function wrapText(text: string, maxWidth: number, size = FONT_SIZE.small): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const cand = cur.length === 0 ? w : `${cur} ${w}`;
    if (estimateTextWidth(cand, size) <= maxWidth) {
      cur = cand;
    } else {
      if (cur.length > 0) lines.push(cur);
      cur = w;
    }
  }
  if (cur.length > 0) lines.push(cur);
  return lines.length > 0 ? lines : [''];
}

/** The pixel height a page needs at a given text width, mirroring exactly what the view draws. */
export function pageBodyHeight(page: HelpPage, maxWidth: number): number {
  let h = HELP_HEADING_H;
  for (const item of page.body) {
    const bullet = item.startsWith('• ');
    const text = bullet ? item.slice(2) : item;
    const width = bullet ? maxWidth - HELP_INDENT : maxWidth;
    h += wrapText(text, width).length * HELP_LINE_H + 4;
  }
  return h;
}

/** The scroll geometry for a page: how far it can scroll, plus the track and thumb rectangles. */
export interface HelpScroll {
  /** The maximum scroll offset in pixels (0 when the page fits its panel). */
  maxScroll: number;
  /** The scroll offset, clamped to 0..maxScroll. */
  scroll: number;
  /** The sunken track on the page panel's right edge. */
  scrollbar: Rect;
  /** The proportional thumb inside the track. */
  thumb: Rect;
}

/**
 * The page's scroll range and thumb geometry. `maxScroll` is the page height minus the panel height,
 * so scrolling clamps at the first line (offset 0) and at the last line plus the panel's height.
 */
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
// The contents tree

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

/**
 * The flat tree rows for the current expansion state. At most one chapter is expanded at a time, so
 * the fixed-height tree never needs a scrollbar.
 */
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

export type HelpHit =
  | { type: 'close' }
  | { type: 'title' }
  | { type: 'toolbar'; action: 'back' | 'forward' | 'contents' }
  | { type: 'tree'; row: number }
  | { type: 'page' }
  | { type: 'window' }
  | null;

/** The tree row index under a y coordinate, or -1 for the panel padding. */
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
  if (pointInRect(hl.contents, x, y)) return { type: 'toolbar', action: 'contents' };
  if (pointInRect(hl.back, x, y)) return { type: 'toolbar', action: 'back' };
  if (pointInRect(hl.forward, x, y)) return { type: 'toolbar', action: 'forward' };
  if (pointInRect(hl.treePanel, x, y)) return { type: 'tree', row: treeRowAt(hl, rows, y) };
  if (pointInRect(hl.pagePanel, x, y)) return { type: 'page' };
  return { type: 'window' };
}

// ---------------------------------------------------------------------------------------------
// Session state (single instance, draggable, visited-page history)

export class HelpSession {
  open = false;
  x = 0;
  y = 0;
  pageId: string | null = HELP_PAGES[0].id;
  expanded: number | null = null;
  status = '';
  dragging = false;
  /** Every page id the player has opened this session (for the shadow-clippy rule). */
  readonly visited = new Set<string>([HELP_PAGES[0].id]);
  /** True once a drag pushed the window against the clamped edge (for the shadow-drag rule). */
  draggedToEdge = false;
  /** Vertical scroll offset of the open page, in pixels (clamped when read). */
  scroll = 0;

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

const MAX_TREE_ROWS = 12;
const MAX_BODY_LINES = 30;

export class HelpView {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly titleText: Text;
  private readonly toolbarBack: Text;
  private readonly toolbarForward: Text;
  private readonly toolbarContents: Text;
  private readonly statusText: Text;
  private readonly heading: Text;
  private readonly treeTexts: Text[] = [];
  private readonly bodyTexts: Text[] = [];
  /** The heading and body lines, scrolled and clipped as one block to the page panel. */
  private readonly pageLayer = new Container();
  private readonly pageMask = new Graphics();

  constructor() {
    this.titleText = makeText('Pointer Defense Help', FONT_SIZE.body, true, PAL.titleInverse);
    this.titleText.anchor.set(0, 0.5);
    this.toolbarBack = makeText('Back', FONT_SIZE.small, false, PAL.text);
    this.toolbarBack.anchor.set(0.5, 0.5);
    this.toolbarForward = makeText('Forward', FONT_SIZE.small, false, PAL.text);
    this.toolbarForward.anchor.set(0.5, 0.5);
    this.toolbarContents = makeText('Contents', FONT_SIZE.small, false, PAL.text);
    this.toolbarContents.anchor.set(0.5, 0.5);
    this.statusText = makeText('', FONT_SIZE.small, false, PAL.text);
    this.statusText.anchor.set(0, 0.5);
    this.heading = makeText('', FONT_SIZE.body, true, PAL.text);
    this.heading.anchor.set(0, 0);

    this.root.addChild(this.g, this.titleText, this.toolbarBack, this.toolbarForward, this.toolbarContents, this.statusText);
    this.pageLayer.addChild(this.heading);
    this.pageLayer.mask = this.pageMask;
    this.root.addChild(this.pageLayer);

    for (let i = 0; i < MAX_TREE_ROWS; i++) {
      const t = makeText('', FONT_SIZE.small, false, PAL.text);
      t.anchor.set(0, 0.5);
      this.treeTexts.push(t);
      this.root.addChild(t);
    }
    for (let i = 0; i < MAX_BODY_LINES; i++) {
      const t = makeText('', FONT_SIZE.small, false, PAL.text);
      t.anchor.set(0, 0);
      this.bodyTexts.push(t);
      this.pageLayer.addChild(t);
    }
  }

  draw(session: HelpSession, profile: Profile, hoverX: number, hoverY: number): void {
    const g = this.g;
    g.clear();
    if (!session.open) {
      this.titleText.text = '';
      this.toolbarBack.text = '';
      this.toolbarForward.text = '';
      this.toolbarContents.text = '';
      this.statusText.text = '';
      this.heading.text = '';
      for (const t of this.treeTexts) t.text = '';
      for (const t of this.bodyTexts) t.text = '';
      return;
    }

    const hl = computeHelpLayout(session.x, session.y);
    const rows = helpRows(profile, session.expanded);
    const hover = helpHitAt(hl, rows, hoverX, hoverY);

    // Frame, title bar and close box.
    bevel(g, hl.window, true, PAL.face);
    g.rect(hl.title.x, hl.title.y, hl.title.w, hl.title.h).fill(PAL.title);
    this.titleText.text = 'Pointer Defense Help';
    this.titleText.position.set(hl.title.x + 6, hl.title.y + Math.floor(TITLE_H / 2));

    bevel(g, hl.close, true, PAL.face);
    const cx = hl.close.x + Math.floor(hl.close.w / 2);
    const cy = hl.close.y + Math.floor(hl.close.h / 2);
    g.moveTo(cx - 4, cy - 4).lineTo(cx + 4, cy + 4).stroke({ width: 1, color: PAL.text });
    g.moveTo(cx + 4, cy - 4).lineTo(cx - 4, cy + 4).stroke({ width: 1, color: PAL.text });

    // Toolbar strip.
    g.rect(hl.toolbar.x, hl.toolbar.y, hl.toolbar.w, hl.toolbar.h).fill(PAL.face);
    this.drawToolbarButton(g, hl.back, this.toolbarBack, 'Back', session.canBack(), hover?.type === 'toolbar' && hover.action === 'back');
    this.drawToolbarButton(g, hl.forward, this.toolbarForward, 'Forward', session.canForward(), hover?.type === 'toolbar' && hover.action === 'forward');
    this.drawToolbarButton(g, hl.contents, this.toolbarContents, 'Contents', true, hover?.type === 'toolbar' && hover.action === 'contents');

    // Sunken panels and status line.
    bevel(g, hl.treePanel, false, PAL.face);
    bevel(g, hl.pagePanel, false, PAL.face);
    bevel(g, hl.status, false, PAL.face);

    this.drawTree(g, hl, rows, session, hover);

    const page = session.pageId ? pageById(session.pageId) : undefined;
    const scroll = computeHelpScroll(page, hl.pageText, session.scroll);
    this.pageMask.clear();
    this.pageMask.rect(hl.pageText.x, hl.pageText.y, hl.pageText.w, hl.pageText.h).fill(0xffffff);
    if (scroll.maxScroll > 0) {
      g.rect(scroll.scrollbar.x, scroll.scrollbar.y, scroll.scrollbar.w, scroll.scrollbar.h).fill(PAL.shadow);
      bevel(g, scroll.thumb, true, PAL.face);
    }
    this.drawPage(hl, session, scroll.scroll);

    const status = session.status !== '' ? session.status : page ? chapterTitle(page.category) : 'Select a topic from the contents';
    this.statusText.text = status;
    this.statusText.position.set(hl.status.x + 4, hl.status.y + Math.floor(HELP_STATUS_H / 2));
  }

  private drawToolbarButton(g: Graphics, r: Rect, text: Text, label: string, enabled: boolean, hovered: boolean): void {
    if (enabled) bevel(g, r, true, PAL.face);
    else {
      g.rect(r.x, r.y, r.w, r.h).fill(PAL.face);
      g.rect(r.x, r.y, r.w, r.h).stroke({ width: 1, color: PAL.shadow });
    }
    if (hovered && enabled) g.rect(r.x + 2, r.y + 2, r.w - 4, r.h - 4).stroke({ width: 1, color: PAL.dark });
    text.text = label;
    text.style.fill = enabled ? PAL.text : PAL.shadow;
    text.position.set(r.x + r.w / 2, r.y + r.h / 2);
  }

  /**
   * The tree text for row `index`, grown on demand. The pool is a render-time cache, not a limit on the
   * content: expanding a chapter adds rows, and a fixed pool threw inside the render tick the moment a
   * chapter held more pages than the pool had slots - the window froze with the tree half drawn.
   */
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

  /** The body line for `index`, grown on demand for the same reason as the tree rows. */
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

  private drawTree(g: Graphics, hl: HelpLayout, rows: readonly HelpRow[], session: HelpSession, hover: HelpHit): void {
    const hoverRow = hover?.type === 'tree' ? hover.row : -1;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const text = this.treeTextAt(i);
      const y = hl.treePanel.y + HELP_TREE_PAD + i * HELP_TREE_ROW_H;
      const selected = row.kind === 'page' && !row.locked && session.pageId === row.page.id;
      const rowHovered = i === hoverRow;

      if (selected) {
        g.rect(hl.treePanel.x + 2, y, hl.treePanel.w - 4, HELP_TREE_ROW_H).fill(PAL.title);
      } else if (rowHovered && (row.kind === 'chapter' || !row.locked)) {
        g.rect(hl.treePanel.x + 2, y, hl.treePanel.w - 4, HELP_TREE_ROW_H).fill(PAL.highlight);
      }

      if (row.kind === 'chapter') {
        const bx = hl.treePanel.x + 4;
        const by = y + 4;
        bevel(g, { x: bx, y: by, w: 9, h: 9 }, true, PAL.face);
        const bxc = bx + 4.5;
        const byc = by + 4.5;
        g.moveTo(bxc - 2, byc).lineTo(bxc + 2, byc).stroke({ width: 1, color: PAL.text });
        if (!row.expanded) g.moveTo(bxc, byc - 2).lineTo(bxc, byc + 2).stroke({ width: 1, color: PAL.text });
        text.text = row.title;
        text.style.fill = PAL.text;
        text.position.set(bx + 13, y + Math.floor(HELP_TREE_ROW_H / 2));
      } else {
        text.text = treeRowLabel(row);
        text.style.fill = row.locked ? PAL.shadow : selected ? PAL.titleInverse : PAL.text;
        text.position.set(hl.treePanel.x + 4 + HELP_INDENT, y + Math.floor(HELP_TREE_ROW_H / 2));
      }
    }
    for (let i = rows.length; i < this.treeTexts.length; i++) this.treeTexts[i].text = '';
  }

  private drawPage(hl: HelpLayout, session: HelpSession, scrollOffset: number): void {
    const page = session.pageId ? pageById(session.pageId) : undefined;
    if (!page) {
      this.heading.text = '';
      for (const t of this.bodyTexts) t.text = '';
      return;
    }

    this.heading.text = page.title;
    this.heading.position.set(hl.pageText.x, hl.pageText.y - scrollOffset);

    let lineIndex = 0;
    let y = hl.pageText.y + HELP_HEADING_H - scrollOffset;
    for (const item of page.body) {
      const bullet = item.startsWith('• ');
      const text = bullet ? item.slice(2) : item;
      const width = bullet ? hl.pageText.w - HELP_INDENT : hl.pageText.w;
      const lines = wrapText(text, width);
      lines.forEach((ln, i) => {
        const t = this.bodyTextAt(lineIndex++);
        t.text = (bullet && i === 0 ? '• ' : '') + ln;
        t.style.fill = PAL.text;
        t.position.set(hl.pageText.x + (bullet ? HELP_INDENT : 0), y);
        y += HELP_LINE_H;
      });
      y += 4;
    }
    for (let i = lineIndex; i < this.bodyTexts.length; i++) this.bodyTexts[i].text = '';
  }
}
