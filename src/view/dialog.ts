import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { bevel, FONT, FONT_SIZE, PAL, pointInRect, type Layout, type Rect } from './chrome.ts';
import { t } from '../i18n/index.ts';
import { ACHIEVEMENTS } from '../core/achievements.ts';
import { getArtTexture } from './art.ts';
import { isRtl, mirrorX, textX } from './direction.ts';

/**
 * A small Windows 95 modal dialog, drawn in Pixi: a navy title bar, a body of text rows and one or
 * more buttons along the bottom. Used for the Restart Windows / New Run confirmations and the Help
 * Achievements / About windows. Only one dialog is ever open at a time.
 */

export interface DialogRow {
  text: string;
  /** Greyed rows draw in the shadow colour, for locked achievements. */
  greyed?: boolean;
}

export interface DialogButton {
  id: string;
  label: string;
}

export interface DialogModel {
  title: string;
  rows: DialogRow[];
  buttons: DialogButton[];
}

export interface DialogLayout {
  rect: Rect;
  buttons: { id: string; rect: Rect }[];
}

const TITLE_H = 20;
const ROW_H = 20;
const PAD = 12;
const BUTTON_W = 84;
const BUTTON_H = 28;
const BUTTON_GAP = 6;

export function computeDialog(l: Layout, model: DialogModel): DialogLayout {
  const titleW = model.title.length * 8 + 24;
  const buttonsW = model.buttons.length * BUTTON_W + Math.max(0, model.buttons.length - 1) * BUTTON_GAP;
  const bodyW = Math.max(titleW, 180, ...model.rows.map((r) => r.text.length * 7 + 20), buttonsW + 8);
  const w = Math.min(bodyW, l.client.w - 40);
  const h = TITLE_H + PAD + model.rows.length * ROW_H + PAD + BUTTON_H + PAD;
  const rect: Rect = {
    x: l.client.x + Math.floor((l.client.w - w) / 2),
    y: l.client.y + Math.floor((l.client.h - h) / 2),
    w,
    h,
  };

  let bx = rect.x + rect.w - PAD;
  const buttons: { id: string; rect: Rect }[] = [];
  for (let i = model.buttons.length - 1; i >= 0; i--) {
    bx -= BUTTON_W;
    buttons.unshift({ id: model.buttons[i].id, rect: { x: bx, y: rect.y + rect.h - PAD - BUTTON_H, w: BUTTON_W, h: BUTTON_H } });
    bx -= BUTTON_GAP;
  }
  // RTL reverses the buttons left-to-right, keeping the default button first in reading order.
  if (isRtl()) {
    for (const b of buttons) b.rect = mirrorX(b.rect, rect);
  }

  return { rect, buttons };
}

export function dialogButtonAt(l: Layout, model: DialogModel, px: number, py: number): string | null {
  const d = computeDialog(l, model);
  for (const b of d.buttons) if (pointInRect(b.rect, px, py)) return b.id;
  return null;
}

function makeText(text: string, fill: number, bold = false): Text {
  return new Text({
    text,
    style: { fontFamily: FONT, fontSize: FONT_SIZE.body, fill, fontWeight: bold ? 'bold' : 'normal' },
  });
}

export class DialogView {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly title: Text;
  private readonly rows: Text[] = [];
  private readonly buttons: Text[] = [];

  constructor() {
    this.root.addChild(this.g);
    this.title = makeText('', PAL.titleInverse, true);
    this.title.anchor.set(0, 0.5);
    this.root.addChild(this.title);
    for (let i = 0; i < 32; i++) {
      const t = makeText('', PAL.text);
      t.anchor.set(0, 0.5);
      this.rows.push(t);
      this.root.addChild(t);
    }
    for (let i = 0; i < 4; i++) {
      const t = makeText('', PAL.text);
      t.anchor.set(0.5, 0.5);
      this.buttons.push(t);
      this.root.addChild(t);
    }
  }

  draw(model: DialogModel | null, l: Layout): void {
    const g = this.g;
    g.clear();
    if (!model) {
      this.title.text = '';
      for (const t of this.rows) t.text = '';
      for (const t of this.buttons) t.text = '';
      return;
    }

    const d = computeDialog(l, model);
    bevel(g, d.rect, true, PAL.face);
    g.rect(d.rect.x + 2, d.rect.y + 2, d.rect.w - 4, TITLE_H).fill(PAL.title);

    this.title.text = model.title;
    this.title.position.set(d.rect.x + 6, d.rect.y + 2 + TITLE_H / 2);

    for (let i = 0; i < this.rows.length; i++) {
      const t = this.rows[i];
      const row = model.rows[i];
      if (!row) {
        t.text = '';
        continue;
      }
      t.text = row.text;
      t.style.fill = row.greyed ? PAL.shadow : PAL.text;
      const rx = textX(d.rect, 'start', 12);
      t.anchor.x = rx.anchor;
      t.position.set(rx.x, d.rect.y + 2 + TITLE_H + PAD + i * ROW_H + ROW_H / 2);
    }

    for (let i = 0; i < this.buttons.length; i++) {
      const t = this.buttons[i];
      const b = d.buttons[i];
      if (!b) {
        t.text = '';
        continue;
      }
      bevel(g, b.rect, true, PAL.face);
      t.text = model.buttons[i].label;
      t.style.fill = PAL.text;
      t.position.set(b.rect.x + b.rect.w / 2, b.rect.y + b.rect.h / 2);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// The achievements grid (docs/ACHIEVEMENTS.md "The grid")
//
// The achievements dialog is a grid, not the list it replaced: 560 px wide, eight columns of 52 px
// cells with a 6 px gutter, a 44 px icon centred on each beveled tile, and a filter row plus the
// `earned / total · shadow` summary. Hidden achievements have no cell until they fire.

export const ACH_WINDOW_W = 560;
export const ACH_COLUMNS = 8;
export const ACH_CELL = 52;
export const ACH_GUTTER = 6;
export const ACH_ICON = 44;
export const ACH_PAD = 12;
export const ACH_TITLE_H = 20;
export const ACH_SUMMARY_H = 18;
export const ACH_FILTER_H = 22;
export const ACH_BUTTON_H = 28;
export const ACH_BUTTON_W = 64;
/** Tooltip panel, matching the cream box the palette and tower tooltips use. */
const TOOLTIP_FILL = 0xffffe1;
const TOOLTIP_TEXT = 0x000000;
const TOOLTIP_STATUS = 0x555555;
const TOOLTIP_MAX_W = 230;
const TOOLTIP_MIN_W = 130;

export type AchievementFilter = 'all' | 'earned' | 'locked';

export interface AchievementGridEntry {
  id: string;
  name: string;
  description: string;
  earned: boolean;
  earnedDate: string | null;
}

export interface AchievementGridModel {
  /** The visible cells, already filtered and with hidden-unearned achievements removed. */
  entries: AchievementGridEntry[];
  /** The stored total (118), which never moves when a shadow becomes visible. */
  total: number;
  earnedCount: number;
  /** How many shadow achievements have fired (the `· N shadow` figure). */
  shadowCount: number;
  filter: AchievementFilter;
  selectedId: string | null;
  hoveredId: string | null;
  scroll: number;
}

export interface AchievementGridLayout {
  window: Rect;
  title: Rect;
  summary: Rect;
  filterAll: Rect;
  filterEarned: Rect;
  filterLocked: Rect;
  close: Rect;
  /** The clipped grid viewport (cells scroll inside it). */
  grid: Rect;
  /** The content origin; cell rows sit below it, offset by `-scroll`. */
  contentX: number;
  contentY: number;
  /** One cell rect per entry, in window coordinates (contentY already includes scroll). */
  cells: { id: string; rect: Rect }[];
  maxScroll: number;
  /** The scroll track beside the grid, and the thumb inside it. Sized by the scroll fraction. */
  scrollbar: Rect;
  thumb: Rect;
}

/** The number of grid rows a cell count needs at eight columns. */
export function gridRowCount(cells: number): number {
  return cells <= 0 ? 0 : Math.ceil(cells / ACH_COLUMNS);
}

/** A cell's rectangle at the given content origin, in content (unclipped) coordinates. */
export function gridCellRect(contentX: number, contentY: number, col: number, row: number): Rect {
  return {
    x: contentX + col * (ACH_CELL + ACH_GUTTER),
    y: contentY + row * (ACH_CELL + ACH_GUTTER),
    w: ACH_CELL,
    h: ACH_CELL,
  };
}

/**
 * The visible cells for a profile. A non-hidden achievement always has a cell; a hidden one only
 * once it has fired, exactly like Cookie Clicker hides its shadows. The filter then narrows the set.
 */
export function buildAchievementGrid(
  earnedIds: readonly string[],
  earnedDates: Readonly<Record<string, string>>,
  filter: AchievementFilter,
): AchievementGridModel {
  const earned = new Set(earnedIds);
  const allEntries = ACHIEVEMENTS.filter((a) => !a.hidden || earned.has(a.id));
  const filterFn =
    filter === 'earned' ? (a: (typeof ACHIEVEMENTS)[number]) => earned.has(a.id)
    : filter === 'locked' ? (a: (typeof ACHIEVEMENTS)[number]) => !earned.has(a.id)
    : () => true;
  const entries = allEntries.filter(filterFn).map((a) => ({
    id: a.id,
    name: a.name,
    description: a.description,
    earned: earned.has(a.id),
    earnedDate: earned.has(a.id) ? (earnedDates[a.id] ?? null) : null,
  }));
  return {
    entries,
    total: ACHIEVEMENTS.length,
    earnedCount: ACHIEVEMENTS.filter((a) => earned.has(a.id)).length,
    shadowCount: ACHIEVEMENTS.filter((a) => a.hidden && earned.has(a.id)).length,
    filter,
    selectedId: null,
    hoveredId: null,
    scroll: 0,
  };
}

/** The fixed geometry for a grid model, derived so drawing and hit-testing always agree. */
export function computeAchievementGrid(model: AchievementGridModel, client: Rect): AchievementGridLayout {
  const rows = gridRowCount(model.entries.length);
  const gridContentH = rows > 0 ? rows * ACH_CELL + (rows - 1) * ACH_GUTTER : 0;
  const fixedH = ACH_TITLE_H + ACH_PAD + ACH_SUMMARY_H + ACH_FILTER_H + ACH_PAD + ACH_PAD + ACH_BUTTON_H + ACH_PAD;
  const maxGridH = Math.max(0, client.h - 24 - fixedH);
  const gridH = Math.min(gridContentH, maxGridH);
  const windowH = fixedH + gridH;
  const window: Rect = {
    x: client.x + Math.floor((client.w - ACH_WINDOW_W) / 2),
    y: client.y + Math.floor((client.h - windowH) / 2),
    w: ACH_WINDOW_W,
    h: windowH,
  };
  const title: Rect = { x: window.x + 2, y: window.y + 2, w: window.w - 4, h: ACH_TITLE_H };
  const summary: Rect = { x: window.x + ACH_PAD, y: title.y + title.h + ACH_PAD, w: window.w - ACH_PAD * 2, h: ACH_SUMMARY_H };
  const filterY = summary.y + summary.h;
  const filterAll: Rect = { x: summary.x, y: filterY, w: ACH_BUTTON_W, h: ACH_FILTER_H };
  const filterEarned: Rect = { x: filterAll.x + ACH_BUTTON_W + 6, y: filterY, w: ACH_BUTTON_W, h: ACH_FILTER_H };
  const filterLocked: Rect = { x: filterEarned.x + ACH_BUTTON_W + 6, y: filterY, w: ACH_BUTTON_W, h: ACH_FILTER_H };
  const grid: Rect = {
    x: window.x + ACH_PAD,
    y: filterY + ACH_FILTER_H + ACH_PAD,
    w: window.w - ACH_PAD * 2,
    h: gridH,
  };
  const contentW = ACH_COLUMNS * ACH_CELL + (ACH_COLUMNS - 1) * ACH_GUTTER;
  const contentX = grid.x + Math.floor((grid.w - contentW) / 2);
  const maxScroll = Math.max(0, gridContentH - gridH);
  const scroll = Math.min(Math.max(0, model.scroll), maxScroll);
  const contentY = grid.y - scroll;
  // The scrollbar sits in the spare width right of the centred columns, so it never covers a tile.
  const scrollbar: Rect = { x: contentX + contentW + 10, y: grid.y + 1, w: 8, h: Math.max(0, grid.h - 2) };
  const trackH = scrollbar.h;
  const thumbH = maxScroll > 0 ? Math.max(18, Math.round(trackH * (gridH / Math.max(1, gridContentH)))) : trackH;
  const thumbY = maxScroll > 0 ? Math.round((trackH - thumbH) * (scroll / maxScroll)) : 0;
  const thumb: Rect = { x: scrollbar.x, y: scrollbar.y + thumbY, w: scrollbar.w, h: thumbH };
  const close: Rect = {
    x: window.x + window.w - ACH_PAD - ACH_BUTTON_W,
    y: window.y + window.h - ACH_PAD - ACH_BUTTON_H,
    w: ACH_BUTTON_W,
    h: ACH_BUTTON_H,
  };
  const cells = model.entries.map((e, i) => ({
    id: e.id,
    rect: gridCellRect(contentX, contentY, i % ACH_COLUMNS, Math.floor(i / ACH_COLUMNS)),
  }));
  return { window, title, summary, filterAll, filterEarned, filterLocked, close, grid, contentX, contentY, cells, maxScroll, scrollbar, thumb };
}

export type AchievementGridHit =
  | { type: 'close' }
  | { type: 'filter'; filter: AchievementFilter }
  | { type: 'cell'; id: string }
  | { type: 'window' }
  | null;

/** What the pointer is over inside the grid window, or null when it is outside. */
export function achievementGridHitAt(l: AchievementGridLayout, model: AchievementGridModel, x: number, y: number): AchievementGridHit {
  if (!pointInRect(l.window, x, y)) return null;
  if (pointInRect(l.close, x, y)) return { type: 'close' };
  if (pointInRect(l.filterAll, x, y)) return { type: 'filter', filter: 'all' };
  if (pointInRect(l.filterEarned, x, y)) return { type: 'filter', filter: 'earned' };
  if (pointInRect(l.filterLocked, x, y)) return { type: 'filter', filter: 'locked' };
  if (!pointInRect(l.grid, x, y)) return { type: 'window' };
  const pitch = ACH_CELL + ACH_GUTTER;
  const col = Math.floor((x - l.contentX) / pitch);
  const row = Math.floor((y - l.contentY) / pitch);
  if (col < 0 || col >= ACH_COLUMNS || row < 0) return { type: 'window' };
  const idx = row * ACH_COLUMNS + col;
  if (idx < 0 || idx >= model.entries.length) return { type: 'window' };
  const r = l.cells[idx].rect;
  if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return { type: 'cell', id: model.entries[idx].id };
  return { type: 'window' };
}

/** Session state for the grid (single instance, no second window). */
export class AchievementSession {
  open = false;
  filter: AchievementFilter = 'all';
  selectedId: string | null = null;
  hoveredId: string | null = null;
  scroll = 0;

  show(): void {
    if (this.open) return;
    this.open = true;
    this.filter = 'all';
    this.selectedId = null;
    this.hoveredId = null;
    this.scroll = 0;
  }

  hide(): void {
    this.open = false;
  }

  setFilter(filter: AchievementFilter): void {
    this.filter = filter;
    this.selectedId = null;
    this.scroll = 0;
  }

  clickCell(id: string): void {
    this.selectedId = this.selectedId === id ? null : id;
  }

  scrollBy(dy: number, layout: AchievementGridLayout): void {
    this.scroll = Math.min(Math.max(0, this.scroll + dy), layout.maxScroll);
  }

  /** Arrow-key navigation moves the selection one cell, and scrolls it into view. */
  moveSelection(dx: number, dy: number, entries: readonly AchievementGridEntry[], layout: AchievementGridLayout): void {
    let idx = this.selectedId === null ? -1 : entries.findIndex((e) => e.id === this.selectedId);
    if (idx < 0) {
      idx = 0;
    } else {
      const col = idx % ACH_COLUMNS + dx;
      const row = Math.floor(idx / ACH_COLUMNS) + dy;
      if (col < 0 || col >= ACH_COLUMNS || row < 0) return;
      const next = row * ACH_COLUMNS + col;
      if (next >= entries.length) return;
      idx = next;
    }
    this.selectedId = entries[idx].id;
    const cell = layout.cells[idx];
    const top = layout.grid.y;
    const bottom = layout.grid.y + layout.grid.h;
    if (cell.rect.y < top) this.scroll = Math.max(0, this.scroll - (top - cell.rect.y));
    else if (cell.rect.y + cell.rect.h > bottom) this.scroll = Math.min(layout.maxScroll, this.scroll + (cell.rect.y + cell.rect.h - bottom));
  }
}

// ---------------------------------------------------------------------------------------------
// View

const ACH_MAX_ICONS = 96;

export class AchievementGridView {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly icons = new Container();
  private readonly iconSprites: Sprite[] = [];
  private readonly titleText: Text;
  private readonly summaryText: Text;
  private readonly filterTexts: Text[] = [];
  private readonly closeText: Text;
  /**
   * The tooltip owns a layer of its own, added last. It used to be painted into the same Graphics as
   * the grid, which is the *first* child of the root — so its box was drawn under the icon sprites
   * and only the text showed, floating over the tiles with no panel behind it.
   */
  private readonly tooltipLayer = new Container();
  private readonly tooltipG = new Graphics();
  private readonly tooltipTexts: Text[] = [];

  constructor() {
    this.root.addChild(this.g, this.icons);
    for (let i = 0; i < ACH_MAX_ICONS; i++) {
      const s = new Sprite();
      s.anchor.set(0.5, 0.5);
      s.visible = false;
      this.iconSprites.push(s);
      this.icons.addChild(s);
    }
    this.titleText = makeText(t('dlg.achievements.title'), PAL.titleInverse, true);
    this.titleText.anchor.set(0, 0.5);
    this.root.addChild(this.titleText);
    this.summaryText = makeText('', PAL.text);
    this.summaryText.anchor.set(0, 0.5);
    this.root.addChild(this.summaryText);
    for (const label of [t('dlg.achievements.filterAll'), t('dlg.achievements.filterEarned'), t('dlg.achievements.filterLocked')]) {
      const t = makeText(label, PAL.text);
      t.anchor.set(0.5, 0.5);
      this.filterTexts.push(t);
      this.root.addChild(t);
    }
    this.closeText = makeText(t('dlg.achievements.close'), PAL.text);
    this.closeText.anchor.set(0.5, 0.5);
    this.root.addChild(this.closeText);
    this.tooltipLayer.addChild(this.tooltipG);
    for (let i = 0; i < 3; i++) {
      const t = makeText('', PAL.text);
      t.anchor.set(0, 0);
      this.tooltipTexts.push(t);
      this.tooltipLayer.addChild(t);
    }
    // Last in the root: a tooltip is never under the thing it describes.
    this.root.addChild(this.tooltipLayer);
  }

  draw(model: AchievementGridModel | null, l: Layout): void {
    const g = this.g;
    g.clear();
    if (!model) {
      this.titleText.text = '';
      this.summaryText.text = '';
      for (const s of this.iconSprites) s.visible = false;
      for (const t of this.tooltipTexts) t.text = '';
      this.tooltipG.clear();
      for (const t of this.filterTexts) t.visible = false;
      this.closeText.visible = false;
      return;
    }

    const al = computeAchievementGrid(model, l.client);
    bevel(g, al.window, true, PAL.face);
    g.rect(al.title.x, al.title.y, al.title.w, al.title.h).fill(PAL.title);
    this.titleText.text = t('dlg.achievements.title');
    this.titleText.position.set(al.title.x + 6, al.title.y + ACH_TITLE_H / 2);

    this.summaryText.text = t('dlg.achievements.summary', { earned: model.earnedCount, total: model.total, shadow: model.shadowCount });
    this.summaryText.position.set(al.summary.x, al.summary.y + ACH_SUMMARY_H / 2);

    const filters: { rect: Rect; value: AchievementFilter }[] = [
      { rect: al.filterAll, value: 'all' },
      { rect: al.filterEarned, value: 'earned' },
      { rect: al.filterLocked, value: 'locked' },
    ];
    for (let i = 0; i < filters.length; i++) {
      const f = filters[i];
      // Every tab is a button; the active one is pressed in, the way a Win95 control shows state.
      bevel(g, f.rect, model.filter !== f.value, PAL.face);
      const t = this.filterTexts[i];
      t.style.fill = model.filter === f.value ? PAL.text : PAL.shadow;
      t.position.set(f.rect.x + f.rect.w / 2, f.rect.y + f.rect.h / 2);
      t.visible = true;
    }

    bevel(g, al.grid, false, PAL.face);

    let visible = 0;
    for (let i = 0; i < model.entries.length; i++) {
      const e = model.entries[i];
      const r = al.cells[i].rect;
      // Only a cell that fits inside the viewport is drawn. A partially scrolled cell used to be
      // painted in full, which overflowed the grid onto the Close button and the status bar; without
      // a scissor the cheapest correct answer is to drop the partial row and let `maxScroll` carry
      // the rest.
      if (r.y < al.grid.y || r.y + r.h > al.grid.y + al.grid.h) continue;
      const spr = this.iconSprites[visible];
      if (!spr) break;
      const raised = e.earned || model.selectedId === e.id;
      bevel(g, r, raised, PAL.face);
      const tex = getArtTexture(e.id, ACH_ICON) ?? getArtTexture('_placeholder', ACH_ICON);
      if (tex !== null) {
        spr.texture = tex;
        spr.width = ACH_ICON;
        spr.height = ACH_ICON;
        spr.position.set(r.x + ACH_CELL / 2, r.y + ACH_CELL / 2);
        spr.tint = e.earned ? 0xffffff : 0x4d4d4d;
        spr.visible = true;
      } else {
        spr.visible = false;
      }
      visible++;
    }
    for (let i = visible; i < this.iconSprites.length; i++) this.iconSprites[i].visible = false;

    if (al.maxScroll > 0) {
      g.rect(al.scrollbar.x, al.scrollbar.y, al.scrollbar.w, al.scrollbar.h).fill(PAL.shadow);
      bevel(g, al.thumb, true, PAL.face);
    }

    bevel(g, al.close, true, PAL.face);
    this.closeText.position.set(al.close.x + al.close.w / 2, al.close.y + al.close.h / 2);
    this.closeText.visible = true;

    const hovered = model.hoveredId === null ? null : model.entries.find((e) => e.id === model.hoveredId);
    if (hovered) {
      const r = al.cells.find((c) => c.id === hovered.id)?.rect;
      if (r) this.drawTooltip(hovered, r, al);
      else this.clearTooltip();
    } else {
      this.clearTooltip();
    }
  }

  private drawTooltip(entry: AchievementGridEntry, cell: Rect, al: AchievementGridLayout): void {
    const g = this.tooltipG;
    g.clear();

    const [nameT, descT, statusT] = this.tooltipTexts;
    const padX = 6;
    const padY = 4;
    nameT.text = entry.name;
    nameT.style.fill = TOOLTIP_TEXT;
    statusT.text = entry.earned ? (entry.earnedDate ? t('dlg.achievements.tooltipEarnedDate', { date: entry.earnedDate }) : t('dlg.achievements.tooltipEarned')) : t('dlg.achievements.tooltipLocked');
    statusT.style.fill = TOOLTIP_STATUS;

    // The panel is sized from the name and the status line, then the description wraps *into* that
    // width. Sizing from the description first made it wrap at its own measured width, which is a
    // circle — the box came out two words wide.
    const width = Math.min(
      TOOLTIP_MAX_W,
      Math.max(TOOLTIP_MIN_W, Math.ceil(Math.max(nameT.width, statusT.width)) + padX * 2 + 4),
    );
    descT.style.wordWrap = true;
    descT.style.fill = TOOLTIP_TEXT;
    descT.style.wordWrapWidth = width - padX * 2;
    descT.text = entry.description;
    const descH = Math.max(12, descT.height);
    const height = padY + nameT.height + 2 + descH + 3 + statusT.height + padY;

    let tx = cell.x + cell.w + 6;
    if (tx + width > al.window.x + al.window.w - 4) tx = cell.x - width - 6;
    if (tx < al.window.x + 4) tx = cell.x + cell.w + 6;
    const ty = Math.min(Math.max(al.window.y + 4, cell.y), al.window.y + al.window.h - height - 4);

    // The same cream panel the rest of the game uses, so a tooltip reads as a tooltip.
    g.rect(tx, ty, width, height).fill(TOOLTIP_FILL);
    g.rect(tx, ty, width, height).stroke({ width: 1, color: TOOLTIP_TEXT });

    nameT.position.set(tx + padX, ty + padY);
    descT.position.set(tx + padX, ty + padY + nameT.height + 2);
    statusT.position.set(tx + padX, ty + padY + nameT.height + 2 + descH + 3);
  }

  private clearTooltip(): void {
    this.tooltipG.clear();
    for (const t of this.tooltipTexts) t.text = '';
  }
}
