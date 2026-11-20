import { Container, Graphics, Text } from 'pixi.js';
import { bevel, FONT, FONT_SIZE, PAL, pointInRect, type Layout, type Rect } from './chrome.ts';
import type { EditorMapEntry } from '../core/editorstore.ts';
import type { Level } from '../core/levels.ts';

/**
 * The editor's map library dialog (docs/EDITOR-LIBRARY.md): a list of saved maps — name, date and
 * size — with Load / Delete / Cancel in "open" mode, or Replace / Cancel when the 51st save needs a
 * victim. A small name dialog sits beside it for naming a new Save.
 */

export type MapLibraryMode = 'open' | 'replace';

const DLG_W = 460;
const DLG_TITLE_H = 20;
const DLG_PAD = 12;
const DLG_ROW_H = 26;
const DLG_LIST_H = 260;
const DLG_BUTTON_W = 84;
const DLG_BUTTON_H = 28;
const DLG_BUTTON_GAP = 6;
const DLG_SCROLL_W = 10;

/** A compact "size" for a map row: its walls, plus its shutters when it has any. */
export function mapSizeText(level: Level): string {
  const walls = level.walls.length;
  const toggles = (level.toggles ?? []).length;
  return toggles > 0 ? `${walls} walls, ${toggles} shutters` : `${walls} walls`;
}

/** An ISO timestamp collapsed to the local date, for the row's date column. */
export function formatSavedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export interface MapLibraryLayout {
  rect: Rect;
  list: Rect;
  /** The visible rows, newest first, already clipped to the viewport and offset by scroll. */
  rows: { id: string; rect: Rect }[];
  primary: Rect;
  del: Rect | null;
  cancel: Rect;
  maxScroll: number;
  scrollbar: Rect;
  thumb: Rect;
  contentY: number;
}

export function computeMapLibrary(l: Layout, maps: readonly EditorMapEntry[], mode: MapLibraryMode, scroll = 0): MapLibraryLayout {
  const w = Math.min(DLG_W, l.client.w - 40);
  const h = DLG_TITLE_H + DLG_PAD + DLG_LIST_H + DLG_PAD + DLG_BUTTON_H + DLG_PAD;
  const rect: Rect = {
    x: l.client.x + Math.floor((l.client.w - w) / 2),
    y: l.client.y + Math.floor((l.client.h - h) / 2),
    w,
    h,
  };
  const list: Rect = { x: rect.x + DLG_PAD, y: rect.y + DLG_TITLE_H + DLG_PAD, w: w - DLG_PAD * 2, h: DLG_LIST_H };

  const rowW = list.w - DLG_SCROLL_W;
  const contentH = maps.length * DLG_ROW_H;
  const maxScroll = Math.max(0, contentH - list.h);
  const clampedScroll = Math.min(Math.max(0, scroll), maxScroll);
  const contentY = list.y - clampedScroll;
  const rows = maps.map((m, i) => ({
    id: m.id,
    rect: { x: list.x, y: contentY + i * DLG_ROW_H, w: rowW, h: DLG_ROW_H },
  }));

  const btnY = rect.y + h - DLG_PAD - DLG_BUTTON_H;
  let bx = rect.x + w - DLG_PAD;
  const cancel: Rect = { x: bx - DLG_BUTTON_W, y: btnY, w: DLG_BUTTON_W, h: DLG_BUTTON_H };
  bx -= DLG_BUTTON_W + DLG_BUTTON_GAP;
  let del: Rect | null = null;
  if (mode === 'open') {
    del = { x: bx - DLG_BUTTON_W, y: btnY, w: DLG_BUTTON_W, h: DLG_BUTTON_H };
    bx -= DLG_BUTTON_W + DLG_BUTTON_GAP;
  }
  const primary: Rect = { x: bx - DLG_BUTTON_W, y: btnY, w: DLG_BUTTON_W, h: DLG_BUTTON_H };

  const scrollbar: Rect = { x: list.x + list.w - DLG_SCROLL_W + 1, y: list.y + 1, w: DLG_SCROLL_W - 2, h: Math.max(0, list.h - 2) };
  const trackH = scrollbar.h;
  const thumbH = maxScroll > 0 ? Math.max(18, Math.round(trackH * (list.h / Math.max(1, contentH)))) : trackH;
  const thumbY = maxScroll > 0 ? Math.round((trackH - thumbH) * (clampedScroll / maxScroll)) : 0;
  const thumb: Rect = { x: scrollbar.x, y: scrollbar.y + thumbY, w: scrollbar.w, h: thumbH };

  return { rect, list, rows, primary, del, cancel, maxScroll, scrollbar, thumb, contentY };
}

export type MapLibraryHit =
  | { type: 'row'; id: string }
  | { type: 'load' }
  | { type: 'delete' }
  | { type: 'cancel' }
  | { type: 'list' }
  | { type: 'window' }
  | null;

export function mapLibraryHitAt(l: Layout, maps: readonly EditorMapEntry[], mode: MapLibraryMode, x: number, y: number, scroll = 0): MapLibraryHit {
  const d = computeMapLibrary(l, maps, mode, scroll);
  if (!pointInRect(d.rect, x, y)) return null;
  if (pointInRect(d.cancel, x, y)) return { type: 'cancel' };
  if (d.del && pointInRect(d.del, x, y)) return { type: 'delete' };
  if (pointInRect(d.primary, x, y)) return { type: 'load' };
  if (pointInRect(d.list, x, y)) {
    for (const r of d.rows) if (pointInRect(r.rect, x, y)) return { type: 'row', id: r.id };
    return { type: 'list' };
  }
  return { type: 'window' };
}

function makeText(text: string, fill: number, bold = false, size: number = FONT_SIZE.body): Text {
  return new Text({
    text,
    style: { fontFamily: FONT, fontSize: size, fill, fontWeight: bold ? 'bold' : 'normal' },
  });
}

const MAX_ROWS = 12;

export class MapLibraryView {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly title: Text;
  private readonly nameTexts: Text[] = [];
  private readonly metaTexts: Text[] = [];
  private readonly loadText: Text;
  private readonly deleteText: Text;
  private readonly cancelText: Text;

  constructor() {
    this.root.addChild(this.g);
    this.title = makeText('Open map', PAL.titleInverse, true);
    this.title.anchor.set(0, 0.5);
    this.root.addChild(this.title);
    for (let i = 0; i < MAX_ROWS; i++) {
      const n = makeText('', PAL.text, true);
      n.anchor.set(0, 0.5);
      this.nameTexts.push(n);
      const m = makeText('', PAL.shadow, false, FONT_SIZE.small);
      m.anchor.set(1, 0.5);
      this.metaTexts.push(m);
      this.root.addChild(n, m);
    }
    this.loadText = makeText('Load', PAL.text);
    this.loadText.anchor.set(0.5, 0.5);
    this.deleteText = makeText('Delete', PAL.text);
    this.deleteText.anchor.set(0.5, 0.5);
    this.cancelText = makeText('Cancel', PAL.text);
    this.cancelText.anchor.set(0.5, 0.5);
    this.root.addChild(this.loadText, this.deleteText, this.cancelText);
  }

  draw(
    l: Layout,
    maps: readonly EditorMapEntry[],
    mode: MapLibraryMode,
    selectedId: string | null,
    hover: MapLibraryHit,
    scroll: number,
  ): void {
    const g = this.g;
    g.clear();

    const d = computeMapLibrary(l, maps, mode, scroll);
    g.rect(l.client.x, l.client.y, l.client.w, l.client.h).fill({ color: PAL.dark, alpha: 0.4 });
    bevel(g, d.rect, true, PAL.face);
    g.rect(d.rect.x + 2, d.rect.y + 2, d.rect.w - 4, DLG_TITLE_H).fill(PAL.title);

    this.title.text = mode === 'open' ? 'Open map' : 'Library full — choose a map to replace';
    this.title.position.set(d.rect.x + 6, d.rect.y + 2 + DLG_TITLE_H / 2);

    bevel(g, d.list, false, PAL.face);

    // Only fully-visible rows are drawn, like the achievements grid.
    let visible = 0;
    for (let i = 0; i < maps.length; i++) {
      const entry = maps[i];
      const r = d.rows[i].rect;
      if (r.y < d.list.y || r.y + r.h > d.list.y + d.list.h) continue;
      if (visible >= MAX_ROWS) break;
      const selected = entry.id === selectedId;
      const rowHovered = hover?.type === 'row' && hover.id === entry.id;
      bevel(g, r, !selected, selected || rowHovered ? PAL.highlight : PAL.face);
      const nameT = this.nameTexts[visible];
      const metaT = this.metaTexts[visible];
      nameT.text = entry.name;
      nameT.style.fill = selected ? PAL.titleInverse : PAL.text;
      nameT.position.set(r.x + 6, r.y + r.h / 2);
      metaT.text = `${formatSavedAt(entry.savedAt)}  \u00b7  ${mapSizeText(entry.level)}`;
      metaT.style.fill = selected ? PAL.titleInverse : PAL.shadow;
      metaT.position.set(r.x + r.w - 6, r.y + r.h / 2);
      visible++;
    }
    for (let i = visible; i < MAX_ROWS; i++) {
      this.nameTexts[i].text = '';
      this.metaTexts[i].text = '';
    }

    if (d.maxScroll > 0) {
      g.rect(d.scrollbar.x, d.scrollbar.y, d.scrollbar.w, d.scrollbar.h).fill(PAL.shadow);
      bevel(g, d.thumb, true, PAL.face);
    }

    const primaryLabel = mode === 'open' ? 'Load' : 'Replace';
    const primaryHover = hover?.type === 'load';
    const delHover = hover?.type === 'delete';
    const cancelHover = hover?.type === 'cancel';
    const primaryEnabled = selectedId !== null;
    bevel(g, d.primary, true, primaryHover ? PAL.highlight : PAL.face);
    this.loadText.text = primaryLabel;
    this.loadText.style.fill = primaryEnabled ? PAL.text : PAL.shadow;
    this.loadText.position.set(d.primary.x + d.primary.w / 2, d.primary.y + d.primary.h / 2);
    if (d.del) {
      bevel(g, d.del, true, delHover ? PAL.highlight : PAL.face);
      this.deleteText.text = 'Delete';
      this.deleteText.style.fill = selectedId !== null ? PAL.text : PAL.shadow;
      this.deleteText.position.set(d.del.x + d.del.w / 2, d.del.y + d.del.h / 2);
    } else {
      this.deleteText.text = '';
    }
    bevel(g, d.cancel, true, cancelHover ? PAL.highlight : PAL.face);
    this.cancelText.text = 'Cancel';
    this.cancelText.style.fill = PAL.text;
    this.cancelText.position.set(d.cancel.x + d.cancel.w / 2, d.cancel.y + d.cancel.h / 2);
  }
}

// --- Name dialog ------------------------------------------------------------------------------

const NAME_W = 360;
const NAME_TITLE_H = 20;
const NAME_PAD = 12;
const NAME_FIELD_H = 24;
const NAME_BUTTON_W = 84;
const NAME_BUTTON_H = 28;

export interface NameDialogLayout {
  rect: Rect;
  field: Rect;
  ok: Rect;
  cancel: Rect;
}

export function computeNameDialog(l: Layout): NameDialogLayout {
  const h = NAME_TITLE_H + NAME_PAD + NAME_FIELD_H + NAME_PAD + NAME_BUTTON_H + NAME_PAD;
  const w = Math.min(NAME_W, l.client.w - 40);
  const rect: Rect = {
    x: l.client.x + Math.floor((l.client.w - w) / 2),
    y: l.client.y + Math.floor((l.client.h - h) / 2),
    w,
    h,
  };
  const field: Rect = { x: rect.x + NAME_PAD, y: rect.y + NAME_TITLE_H + NAME_PAD, w: w - NAME_PAD * 2, h: NAME_FIELD_H };
  const ok: Rect = { x: rect.x + w - NAME_PAD - NAME_BUTTON_W * 2 - 6, y: rect.y + h - NAME_PAD - NAME_BUTTON_H, w: NAME_BUTTON_W, h: NAME_BUTTON_H };
  const cancel: Rect = { x: ok.x + NAME_BUTTON_W + 6, y: ok.y, w: NAME_BUTTON_W, h: NAME_BUTTON_H };
  return { rect, field, ok, cancel };
}

export function nameDialogButtonAt(l: Layout, px: number, py: number): 'ok' | 'cancel' | null {
  const d = computeNameDialog(l);
  if (pointInRect(d.ok, px, py)) return 'ok';
  if (pointInRect(d.cancel, px, py)) return 'cancel';
  return null;
}

export class NameDialogView {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly title: Text;
  private readonly field: Text;
  private readonly ok: Text;
  private readonly cancel: Text;

  constructor() {
    this.title = makeText('Save map', PAL.titleInverse, true);
    this.field = makeText('', PAL.text);
    this.ok = makeText('OK', PAL.text);
    this.cancel = makeText('Cancel', PAL.text);
    this.title.anchor.set(0, 0.5);
    this.field.anchor.set(0, 0.5);
    this.ok.anchor.set(0.5, 0.5);
    this.cancel.anchor.set(0.5, 0.5);
    this.root.addChild(this.g, this.title, this.field, this.ok, this.cancel);
  }

  draw(l: Layout, text: string, hover: 'ok' | 'cancel' | null): void {
    const g = this.g;
    g.clear();
    const d = computeNameDialog(l);

    g.rect(l.client.x, l.client.y, l.client.w, l.client.h).fill({ color: PAL.dark, alpha: 0.4 });
    bevel(g, d.rect, true, PAL.face);
    g.rect(d.rect.x + 2, d.rect.y + 2, d.rect.w - 4, NAME_TITLE_H).fill(PAL.title);

    this.title.text = 'Save map';
    this.title.position.set(d.rect.x + 6, d.rect.y + 2 + NAME_TITLE_H / 2);

    bevel(g, d.field, false, PAL.highlight);
    this.field.text = text;
    this.field.position.set(d.field.x + 4, d.field.y + d.field.h / 2);

    bevel(g, d.ok, true, hover === 'ok' ? PAL.highlight : PAL.face);
    bevel(g, d.cancel, true, hover === 'cancel' ? PAL.highlight : PAL.face);
    this.ok.text = 'OK';
    this.ok.position.set(d.ok.x + d.ok.w / 2, d.ok.y + d.ok.h / 2);
    this.cancel.text = 'Cancel';
    this.cancel.position.set(d.cancel.x + d.cancel.w / 2, d.cancel.y + d.cancel.h / 2);
  }
}
