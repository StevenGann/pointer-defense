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
import type { Profile, RunRecord } from '../core/save.ts';
import { bestByMap, runTotals } from '../core/runs.ts';
import { t } from '../i18n/index.ts';

/**
 * The Records viewer (docs/RUN-RECORDS.md): a fixed Windows 95 window reachable from the main menu
 * and the View menu. It is a viewer, not a pause — the game clock keeps ticking behind it. The model
 * here is Pixi-free so the smoke harness can assert the ranking, the totals line and the layout.
 */

export const RECORDS_W = 520;
export const RECORDS_H = 340;
export const RECORDS_ROW_H = 16;
export const RECORDS_HEADER_H = 18;
export const RECORDS_FOOTER_H = 18;
const PAD = 12;
const COL_RANK = 28;
const COL_WAVE = 48;
const COL_OUTCOME = 72;
const COL_DATE = 84;
const SCROLL_W = 8;
/** The gold fill behind the rank-1 row. */
const RANK_GOLD = 0xd4a017;

export type RecordsRowKind = 'ranked' | 'separator' | 'date';

export interface RecordsRow {
  kind: RecordsRowKind;
  /** 1..5 for a ranked row, 0 otherwise. */
  rank: number;
  record: RunRecord | null;
}

/**
 * The table rows: the top five runs by wave (descending, date as a tie-break) ranked first, then —
 * under an `Earlier` separator — the rest in date order (the array is already newest first).
 */
export function buildRecordsRows(runs: readonly RunRecord[]): RecordsRow[] {
  if (runs.length === 0) return [];
  const ranked = [...runs]
    .sort((a, b) => b.wave - a.wave || (a.at < b.at ? 1 : -1))
    .slice(0, 5);
  const rows: RecordsRow[] = ranked.map((record, i) => ({ kind: 'ranked' as const, rank: i + 1, record }));
  const rest = runs.filter((r) => !ranked.includes(r));
  if (rest.length > 0) {
    rows.push({ kind: 'separator', rank: 0, record: null });
    for (const r of rest) rows.push({ kind: 'date', rank: 0, record: r });
  }
  return rows;
}

/** The totals header line; `Runs 0` when nothing has been recorded. */
export function totalsLine(runs: readonly RunRecord[], bestWave: number): string {
  if (runs.length === 0) return t('dlg.records.emptyRuns');
  const totals = runTotals(runs);
  return t('dlg.records.totals', { runs: totals.runs, wins: totals.wins, defeats: totals.defeats, reboots: totals.reboots, bestWave });
}

/** The best-by-map footer line, computed from the records alone. */
export function bestByMapLine(runs: readonly RunRecord[]): string {
  const best = bestByMap(runs);
  if (best.length === 0) return '';
  const parts = best.map((b) => b.mapName + ' ' + b.wave).join(', ');
  return t('dlg.records.bestByMap', { maps: parts });
}

export function outcomeLabel(outcome: RunRecord['outcome']): string {
  if (outcome === 'victory') return t('dlg.records.victory');
  if (outcome === 'defeat') return t('dlg.records.defeat');
  if (outcome === 'reboot') return t('dlg.records.reboot');
  return t('dlg.records.daily');
}

/** The compact date for a record's ISO timestamp: `2026-11-20T…` -> `2026-11-20`. */
export function formatRecordDate(at: string): string {
  const m = /^\d{4}-\d{2}-\d{2}/.exec(at);
  return m ? m[0] : at.slice(0, 10);
}

export interface RecordsLayout {
  window: Rect;
  title: Rect;
  close: Rect;
  totals: Rect;
  table: Rect;
  headerRow: Rect;
  data: Rect;
  footer: Rect;
  rows: RecordsRow[];
  colMap: number;
  scroll: number;
  maxScroll: number;
  scrollbar: Rect;
  thumb: Rect;
  empty: boolean;
}

/** The fixed geometry at the client area, derived so drawing and hit-testing agree. */
export function computeRecordsLayout(l: Layout, runs: readonly RunRecord[], scroll: number): RecordsLayout {
  const window: Rect = {
    x: l.client.x + Math.floor((l.client.w - RECORDS_W) / 2),
    y: l.client.y + Math.floor((l.client.h - RECORDS_H) / 2),
    w: RECORDS_W,
    h: RECORDS_H,
  };
  const title: Rect = { x: window.x + 2, y: window.y + 2, w: window.w - 4, h: TITLE_H };
  const close: Rect = {
    x: title.x + title.w - 2 - CONTROL_BOX_W,
    y: title.y + Math.floor((TITLE_H - CONTROL_BOX_H) / 2),
    w: CONTROL_BOX_W,
    h: CONTROL_BOX_H,
  };
  const totals: Rect = { x: window.x + PAD, y: title.y + title.h + 4, w: window.w - PAD * 2, h: RECORDS_HEADER_H };
  const footer: Rect = { x: window.x + PAD, y: window.y + window.h - 2 - RECORDS_FOOTER_H, w: window.w - PAD * 2, h: RECORDS_FOOTER_H };
  const headerRow: Rect = { x: window.x + PAD, y: totals.y + totals.h, w: window.w - PAD * 2, h: RECORDS_ROW_H };
  const table: Rect = {
    x: window.x + PAD,
    y: headerRow.y,
    w: window.w - PAD * 2,
    h: Math.max(0, footer.y - 2 - headerRow.y),
  };
  const data: Rect = { x: table.x, y: table.y + RECORDS_ROW_H, w: table.w, h: Math.max(0, table.h - RECORDS_ROW_H) };

  const rows = buildRecordsRows(runs);
  const contentH = rows.length * RECORDS_ROW_H;
  const maxScroll = Math.max(0, contentH - data.h);
  const s = Math.min(Math.max(0, scroll), maxScroll);

  const colMap = Math.max(40, data.w - SCROLL_W - COL_RANK - COL_WAVE - COL_OUTCOME - COL_DATE);

  const scrollbar: Rect = { x: data.x + data.w - SCROLL_W, y: data.y + 1, w: SCROLL_W, h: Math.max(0, data.h - 2) };
  const trackH = scrollbar.h;
  const thumbH = maxScroll > 0 ? Math.max(14, Math.round(trackH * (data.h / Math.max(1, contentH)))) : trackH;
  const thumbY = maxScroll > 0 ? Math.round((trackH - thumbH) * (s / maxScroll)) : 0;
  const thumb: Rect = { x: scrollbar.x, y: scrollbar.y + thumbY, w: scrollbar.w, h: thumbH };

  return {
    window,
    title,
    close,
    totals,
    table,
    headerRow,
    data,
    footer,
    rows,
    colMap,
    scroll: s,
    maxScroll,
    scrollbar,
    thumb,
    empty: runs.length === 0,
  };
}

export type RecordsHit = 'close' | 'window' | null;

/** What the pointer is over inside the window, or null when it is outside. */
export function recordsHitAt(rl: RecordsLayout, x: number, y: number): RecordsHit {
  if (!pointInRect(rl.window, x, y)) return null;
  if (pointInRect(rl.close, x, y)) return 'close';
  return 'window';
}

/** Session state for the window (single instance, no second window). */
export class RecordsSession {
  open = false;
  scroll = 0;

  show(): void {
    if (this.open) return;
    this.open = true;
    this.scroll = 0;
  }

  hide(): void {
    this.open = false;
    this.scroll = 0;
  }

  scrollBy(dy: number, layout: RecordsLayout): void {
    this.scroll = Math.min(Math.max(0, this.scroll + dy), layout.maxScroll);
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

/** The fixed column headers, drawn once above the scrolling data. */
const HEADER_LABELS = [t('dlg.records.colRank'), t('dlg.records.colWave'), t('dlg.records.colMap'), t('dlg.records.colOutcome'), t('dlg.records.colDate')] as const;

export class RecordsView {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly titleText: Text;
  private readonly totalsText: Text;
  private readonly footerText: Text;
  private readonly emptyText: Text;
  private readonly headerTexts: Text[] = [];
  /** The scrolling data rows, clipped to the data panel. */
  private readonly dataLayer = new Container();
  private readonly dataMask = new Graphics();
  private readonly cells: Text[] = [];

  constructor() {
    this.titleText = makeText(t('dlg.records.title'), FONT_SIZE.body, true, PAL.titleInverse);
    this.titleText.anchor.set(0, 0.5);
    this.totalsText = makeText('', FONT_SIZE.small, false, PAL.text);
    this.totalsText.anchor.set(0, 0.5);
    this.footerText = makeText('', FONT_SIZE.small, false, PAL.text);
    this.footerText.anchor.set(0, 0.5);
    this.emptyText = makeText('', FONT_SIZE.small, false, PAL.shadow);
    this.emptyText.anchor.set(0.5, 0.5);
    this.root.addChild(this.g, this.titleText, this.totalsText, this.footerText);
    for (const label of HEADER_LABELS) {
      const t = makeText(label, FONT_SIZE.small, true, PAL.text);
      t.anchor.set(0, 0.5);
      this.headerTexts.push(t);
      this.root.addChild(t);
    }
    this.dataLayer.addChild(this.emptyText);
    this.dataLayer.mask = this.dataMask;
    this.root.addChild(this.dataLayer);
  }

  private cellAt(index: number): Text {
    let t = this.cells[index];
    if (!t) {
      t = makeText('', FONT_SIZE.small, false, PAL.text);
      t.anchor.set(0, 0.5);
      this.cells.push(t);
      this.dataLayer.addChild(t);
    }
    return t;
  }

  draw(session: RecordsSession, profile: Profile, l: Layout): void {
    const g = this.g;
    g.clear();
    if (!session.open) {
      this.titleText.text = '';
      this.totalsText.text = '';
      this.footerText.text = '';
      this.emptyText.text = '';
      for (const t of this.headerTexts) t.text = '';
      for (const t of this.cells) t.text = '';
      return;
    }

    const runs = profile.runs;
    const rl = computeRecordsLayout(l, runs, session.scroll);

    bevel(g, rl.window, true, PAL.face);
    g.rect(rl.title.x, rl.title.y, rl.title.w, rl.title.h).fill(PAL.title);
    this.titleText.text = t('dlg.records.title');
    this.titleText.position.set(rl.title.x + 6, rl.title.y + 2 + TITLE_H / 2);

    // Close box glyph.
    bevel(g, rl.close, true, PAL.face);
    const cx = rl.close.x + Math.floor(rl.close.w / 2);
    const cy = rl.close.y + Math.floor(rl.close.h / 2);
    g.moveTo(cx - 4, cy - 4).lineTo(cx + 4, cy + 4).stroke({ width: 1, color: PAL.text });
    g.moveTo(cx + 4, cy - 4).lineTo(cx - 4, cy + 4).stroke({ width: 1, color: PAL.text });

    this.totalsText.text = totalsLine(runs, profile.bestWave);
    this.totalsText.position.set(rl.totals.x, rl.totals.y + Math.floor(rl.totals.h / 2));

    this.footerText.text = bestByMapLine(runs);
    this.footerText.position.set(rl.footer.x, rl.footer.y + Math.floor(rl.footer.h / 2));

    // Sunken table with a fixed header row.
    bevel(g, rl.table, false, PAL.face);
    const x0 = rl.data.x;
    const xWave = x0 + COL_RANK;
    const xMap = xWave + COL_WAVE;
    const xOutcome = xMap + rl.colMap;
    const xDate = xOutcome + COL_OUTCOME;
    const headerY = rl.headerRow.y + Math.floor(RECORDS_ROW_H / 2);
    this.headerTexts[0].position.set(x0, headerY);
    this.headerTexts[1].position.set(xWave, headerY);
    this.headerTexts[2].position.set(xMap, headerY);
    this.headerTexts[3].position.set(xOutcome, headerY);
    this.headerTexts[4].position.set(xDate, headerY);

    // Clip the scrolling rows to the data panel.
    this.dataMask.clear();
    this.dataMask.rect(rl.data.x, rl.data.y, rl.data.w, rl.data.h).fill(0xffffff);

    if (rl.empty) {
      this.emptyText.text = t('dlg.records.empty');
      this.emptyText.position.set(rl.data.x + rl.data.w / 2, rl.data.y + rl.data.h / 2);
      for (const t of this.cells) t.text = '';
    } else {
      this.emptyText.text = '';
      let cellIndex = 0;
      for (let i = 0; i < rl.rows.length; i++) {
        const row = rl.rows[i];
        const y = rl.data.y + i * RECORDS_ROW_H - rl.scroll;
        if (y + RECORDS_ROW_H <= rl.data.y || y >= rl.data.y + rl.data.h) continue;
        const cy = y + Math.floor(RECORDS_ROW_H / 2);

        if (row.kind === 'separator') {
          const sep = this.cellAt(cellIndex++);
          sep.text = t('dlg.records.earlier');
          sep.style.fill = PAL.title;
          sep.style.fontWeight = 'bold';
          sep.position.set(x0, cy);
          continue;
        }

        const record = row.record!;
        if (row.kind === 'ranked' && row.rank === 1) {
          g.rect(rl.data.x, y, rl.data.w, RECORDS_ROW_H).fill(RANK_GOLD);
        }
        const rankT = this.cellAt(cellIndex++);
        rankT.text = row.kind === 'ranked' ? String(row.rank) : '';
        rankT.style.fill = row.rank === 1 ? PAL.highlight : PAL.text;
        rankT.style.fontWeight = 'bold';
        rankT.position.set(x0, cy);

        const waveT = this.cellAt(cellIndex++);
        waveT.text = String(record.wave);
        waveT.style.fill = row.rank === 1 ? PAL.highlight : PAL.text;
        waveT.style.fontWeight = row.rank === 1 ? 'bold' : 'normal';
        waveT.position.set(xWave, cy);

        const mapT = this.cellAt(cellIndex++);
        mapT.text = record.mapName;
        mapT.style.fill = row.rank === 1 ? PAL.highlight : PAL.text;
        mapT.style.fontWeight = 'normal';
        mapT.position.set(xMap, cy);

        const outT = this.cellAt(cellIndex++);
        outT.text = outcomeLabel(record.outcome);
        outT.style.fill = row.rank === 1 ? PAL.highlight : PAL.text;
        outT.style.fontWeight = 'normal';
        outT.position.set(xOutcome, cy);

        const dateT = this.cellAt(cellIndex++);
        dateT.text = formatRecordDate(record.at);
        dateT.style.fill = row.rank === 1 ? PAL.highlight : PAL.text;
        dateT.style.fontWeight = 'normal';
        dateT.position.set(xDate, cy);
      }
      for (let i = cellIndex; i < this.cells.length; i++) this.cells[i].text = '';
    }

    if (rl.maxScroll > 0) {
      g.rect(rl.scrollbar.x, rl.scrollbar.y, rl.scrollbar.w, rl.scrollbar.h).fill(PAL.shadow);
      bevel(g, rl.thumb, true, PAL.face);
    }
  }
}
