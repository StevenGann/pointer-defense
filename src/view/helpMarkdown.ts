/**
 * The Markdown subset behind the Help pages (docs/HELP-MARKDOWN.md).
 *
 * Pure and Pixi-free, so the smoke harness can parse and lay out a page in Node. `parseHelpMarkdown`
 * turns the page's body lines into blocks; `layoutHelpBlocks` measures and positions every run and
 * table so the view only draws. Text measurement is injected (`measure(text, bold)`) so a Node test
 * can drive the same layout the Pixi view draws with a deterministic ruler.
 */

import { FONT_SIZE, CODE_FONT, FONT } from './chrome.ts';
import { textWidth } from './metrics.ts';

export type Align = 'left' | 'right' | 'centre';

export interface InlineRun {
  readonly text: string;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly code: boolean;
}

/** A table cell: the runs that make up one cell's text. */
export type HelpCell = readonly InlineRun[];
/** A table row: one cell per column. */
export type HelpRow = readonly HelpCell[];

export type HelpBlock =
  | { readonly kind: 'paragraph' | 'heading' | 'bullet'; readonly runs: readonly InlineRun[]; readonly level?: number }
  | { readonly kind: 'table'; readonly header: readonly string[]; readonly align: readonly Align[]; readonly rows: readonly HelpRow[] };

/** The artwork preview box, relative to the page text area's top-left. */
export interface HelpArtBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * A ruler. `bold`, `italic` and `code` describe the run that will be drawn, because a measured word
 * and a drawn word must agree to the pixel: the layout positions each word individually, so any
 * disagreement shows up as a gap between words rather than as a slightly narrow line.
 */
export type Measure = (text: string, bold: boolean, code?: boolean, italic?: boolean) => number;

// ---------------------------------------------------------------------------------------------
// Layout metrics (shared with the view; the title band is HEADING_H, body starts below it).

export const LINE_H = 17;
export const HEADING_H = 20;
/** The vertical gap left after each body block (4 px, as the original layout did). */
export const ITEM_GAP = 4;
/** Gap between a body line wrapped around the art box and the box's left edge. */
export const ART_GAP = 16;
/** Indent of bullet lines and their wrapped continuations. */
export const INDENT = 14;
/** Horizontal padding inside a table cell, each side. */
export const TABLE_CELL_PAD = 4;

/**
 * The ruler the Pixi view lays out with. It asks the same measurer the rest of the UI uses, which
 * answers with the real rasterised width in a browser and a per-glyph estimate in the Node harness.
 *
 * It used to be `length × 13 × 0.6`. That is a *guess*, and in the browser it guessed wide: Tahoma
 * averages nearer half an em, so every word was placed further right than the word before it needed,
 * and the accumulated error read as text stretched across the page with ragged gaps between words.
 */
export function helpMeasure(text: string, bold: boolean, code = false, italic = false): number {
  return textWidth(text, FONT_SIZE.body, { bold, italic, family: code ? CODE_FONT : FONT });
}

// ---------------------------------------------------------------------------------------------
// Parsing

/** Parse `**bold**`, `*italic*` and `` `code` `` runs out of one line. Unknown tokens stay literal. */
function parseInline(text: string): InlineRun[] {
  const runs: InlineRun[] = [];
  let buf = '';
  const flush = (): void => {
    if (buf.length > 0) {
      runs.push({ text: buf, bold: false, italic: false, code: false });
      buf = '';
    }
  };

  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '`') {
      const end = text.indexOf('`', i + 1);
      if (end === -1) {
        buf += ch;
        i++;
        continue;
      }
      flush();
      runs.push({ text: text.slice(i + 1, end), bold: false, italic: false, code: true });
      i = end + 1;
    } else if (ch === '*' && text[i + 1] === '*') {
      const end = text.indexOf('**', i + 2);
      if (end === -1) {
        buf += ch;
        i++;
        continue;
      }
      flush();
      runs.push({ text: text.slice(i + 2, end), bold: true, italic: false, code: false });
      i = end + 2;
    } else if (ch === '*') {
      const end = text.indexOf('*', i + 1);
      if (end === -1) {
        buf += ch;
        i++;
        continue;
      }
      flush();
      runs.push({ text: text.slice(i + 1, end), bold: false, italic: true, code: false });
      i = end + 1;
    } else {
      buf += ch;
      i++;
    }
  }
  flush();
  return runs;
}

/** Strip a pipe row's framing and split its trimmed cells. */
function splitRow(line: string): string[] {
  let s = line;
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

/** A table separator row: every cell is dashes with optional colons (`---`, `--:`, `:-:`). */
function isSeparatorRow(line: string): boolean {
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-+:?$/.test(c));
}

/** `---` / `--:` / `:-:` map to left / right / centre alignment. */
function parseAlign(line: string): Align[] {
  return splitRow(line).map((c) => {
    if (c.startsWith(':') && c.endsWith(':')) return 'centre';
    if (c.endsWith(':')) return 'right';
    return 'left';
  });
}

/**
 * Parse the page body lines into blocks. Headings, one-level bullets, paragraphs and pipe tables.
 * Anything unrecognised is a paragraph; a table row whose cell count differs from its header is a
 * parse error (thrown, never silently padded).
 */
export function parseHelpMarkdown(lines: readonly string[]): HelpBlock[] {
  const blocks: HelpBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      i++;
      continue;
    }

    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1].length, runs: parseInline(heading[2]) });
      i++;
      continue;
    }

    if (line.startsWith('- ')) {
      blocks.push({ kind: 'bullet', runs: parseInline(line.slice(2)) });
      i++;
      continue;
    }

    if (line.startsWith('|')) {
      const header = splitRow(line);
      if (i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
        const sep = splitRow(lines[i + 1]);
        if (sep.length !== header.length) {
          throw new Error(`table header has ${header.length} columns but its separator has ${sep.length}`);
        }
        const align = parseAlign(lines[i + 1]);
        const rows: InlineRun[][][] = [];
        i += 2;
        while (i < lines.length && lines[i].startsWith('|')) {
          const cells = splitRow(lines[i]);
          if (cells.length !== header.length) {
            throw new Error(`table row has ${cells.length} columns but the header has ${header.length}`);
          }
          rows.push(cells.map(parseInline));
          i++;
        }
        blocks.push({ kind: 'table', header, align, rows });
        continue;
      }
    }

    blocks.push({ kind: 'paragraph', runs: parseInline(line) });
    i++;
  }
  return blocks;
}

// ---------------------------------------------------------------------------------------------
// Layout

export interface LaidOutRun extends InlineRun {
  readonly x: number;
  readonly y: number;
  readonly width: number;
}

export interface LaidOutTextLine {
  readonly kind: 'text';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly runs: readonly LaidOutRun[];
}

export interface LaidOutTable {
  readonly kind: 'table';
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Left edge of each column, relative to the table's left edge. */
  readonly columnX: readonly number[];
  readonly columnWidth: readonly number[];
  /** Top of each row (header first), relative to the table's top. */
  readonly rowY: readonly number[];
  readonly rowHeight: readonly number[];
  readonly headerHeight: number;
  /** Horizontal rule y positions, relative to the table's top (top border, then each row's bottom). */
  readonly ruleY: readonly number[];
  /** Cell runs by [row][col]; row 0 is the header. */
  readonly cells: readonly (readonly (readonly LaidOutRun[])[])[];
}

export type LaidOutItem = LaidOutTextLine | LaidOutTable;

export interface HelpLayout {
  /** The total pixel height the body occupies, including the title band and trailing gap. */
  readonly height: number;
  readonly items: readonly LaidOutItem[];
}

interface WordToken {
  readonly text: string;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly code: boolean;
}

/** Split runs into single words, each carrying its run's style. */
function tokenize(runs: readonly InlineRun[]): WordToken[] {
  const words: WordToken[] = [];
  for (const run of runs) {
    for (const part of run.text.split(' ')) {
      if (part.length > 0) words.push({ text: part, bold: run.bold, italic: run.italic, code: run.code });
    }
  }
  return words;
}

interface PlacedRun {
  readonly text: string;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly code: boolean;
  readonly x: number;
  readonly width: number;
}

/**
 * Place a line's words one run per word, with a measured space between.
 *
 * Left to right the first word starts at the indent. Right to left — Hebrew — the first word is the
 * rightmost: the line is laid out from `maxWidth` leftwards, and the indent becomes a right margin,
 * so a paragraph is flush right and a bullet's marker sits outside it on the right. Every word is
 * still measured with the style it is drawn in; that is what keeps the spacing even.
 */
function lineRuns(
  words: readonly WordToken[],
  indent: number,
  measure: Measure,
  maxWidth: number,
  rtl: boolean,
): { runs: PlacedRun[]; width: number } {
  const runs: PlacedRun[] = [];
  const spaceW = measure(' ', false);
  const widths = words.map((w) => measure(w.text, w.bold, w.code, w.italic));
  let cursor = rtl ? maxWidth - indent : indent;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const width = widths[i];
    const x = rtl ? cursor - width : cursor;
    runs.push({ text: w.text, bold: w.bold, italic: w.italic, code: w.code, x, width });
    cursor = rtl ? x - spaceW : x + width + spaceW;
  }
  const width = widths.reduce((sum, w) => sum + w, 0) + spaceW * Math.max(0, words.length - 1);
  return { runs, width };
}

/** Whether a line's vertical band at `lineIndex` intersects the art box, narrowing its width. */
function widthForLine(art: HelpArtBox | null, startY: number, lineIndex: number, baseWidth: number, lineH: number): number {
  if (art === null) return baseWidth;
  const lineY = startY + lineIndex * lineH;
  if (lineY < art.y + art.h && lineY + lineH > art.y) return baseWidth - art.w - ART_GAP;
  return baseWidth;
}

/** Lay out one heading, paragraph or bullet into wrapped text lines. */
function layoutTextBlock(
  block: Extract<HelpBlock, { kind: 'heading' | 'paragraph' | 'bullet' }>,
  maxWidth: number,
  art: HelpArtBox | null,
  startY: number,
  measure: Measure,
  rtl: boolean,
): LaidOutTextLine[] {
  const isBullet = block.kind === 'bullet';
  const isHeading = block.kind === 'heading';
  const indent = isBullet ? INDENT : 0;
  const baseWidth = maxWidth - indent;
  const lineH = isHeading ? HEADING_H : LINE_H;
  const words = tokenize(block.runs);

  const spaceW = measure(' ', false);
  const lines: LaidOutTextLine[] = [];
  const finalize = (cur: WordToken[]): void => {
    if (cur.length === 0) return;
    const li = lines.length;
    const y = startY + li * lineH;
    const { runs, width } = lineRuns(cur, indent, measure, maxWidth, rtl);
    const placed = runs.map((r) => ({ ...r, y, bold: isHeading ? true : r.bold }));
    if (isBullet && li === 0) {
      const markerText = rtl ? '•' : '• ';
      const markerW = measure(markerText, false);
      const markerX = rtl ? maxWidth - markerW : 0;
      const marker: LaidOutRun = { text: markerText, bold: false, italic: false, code: false, x: markerX, y, width: markerW };
      lines.push({ kind: 'text', x: rtl ? 0 : indent, y, width, height: lineH, runs: [marker, ...placed] });
    } else {
      lines.push({ kind: 'text', x: rtl ? maxWidth - width : indent, y, width, height: lineH, runs: placed });
    }
  };

  // A heading is a single line at full width (never narrowed, per docs/HELP-ART.md).
  if (isHeading) {
    finalize(words);
    return lines;
  }

  let cur: WordToken[] = [];
  let curWidth = 0;
  for (const w of words) {
    const ww = measure(w.text, w.bold);
    if (cur.length > 0) {
      const avail = widthForLine(art, startY, lines.length, baseWidth, lineH);
      if (curWidth + spaceW + ww <= avail) {
        cur.push(w);
        curWidth += spaceW + ww;
        continue;
      }
      finalize(cur);
      cur = [];
      curWidth = 0;
    }
    cur.push(w);
    curWidth = ww;
  }
  finalize(cur);
  return lines;
}

function cellWidth(runs: readonly InlineRun[], measure: Measure): number {
  return runs.reduce((sum, r) => sum + measure(r.text, r.bold), 0);
}

/** Lay a table out with its top at `startY` (absolute, in page text coordinates). */
function layoutTable(block: Extract<HelpBlock, { kind: 'table' }>, startY: number, measure: Measure): LaidOutTable {
  const colCount = block.header.length;
  const headerRuns: HelpCell[] = block.header.map((h) => [{ text: h, bold: true, italic: false, code: false }]);
  const allRows: readonly HelpRow[] = [headerRuns, ...block.rows];

  const contentWidths: number[] = [];
  for (let c = 0; c < colCount; c++) {
    let m = 0;
    for (const row of allRows) m = Math.max(m, cellWidth(row[c], measure));
    contentWidths.push(m);
  }
  const columnWidth: number[] = contentWidths.map((w) => w + 2 * TABLE_CELL_PAD);
  const columnX: number[] = [];
  let x = 0;
  for (const w of columnWidth) {
    columnX.push(x);
    x += w;
  }

  const rowH = LINE_H;
  const rowCount = allRows.length;
  const rowY: number[] = [];
  let ry = 0;
  for (let r = 0; r < rowCount; r++) {
    rowY.push(ry);
    ry += rowH;
  }
  const ruleY: number[] = [0];
  for (let r = 0; r < rowCount; r++) ruleY.push(rowY[r] + rowH);

  const cells: LaidOutRun[][][] = [];
  for (let r = 0; r < rowCount; r++) {
    const rowCells: LaidOutRun[][] = [];
    for (let c = 0; c < colCount; c++) {
      const runs = allRows[r][c];
      const cw = cellWidth(runs, measure);
      const align = block.align[c];
      const textX =
        align === 'right' ? columnX[c] + columnWidth[c] - TABLE_CELL_PAD - cw
        : align === 'centre' ? columnX[c] + (columnWidth[c] - cw) / 2
        : columnX[c] + TABLE_CELL_PAD;
      const textY = rowY[r];
      let rx = textX;
      rowCells.push(runs.map((run) => {
        const w = measure(run.text, run.bold);
        const placed: LaidOutRun = { text: run.text, bold: run.bold, italic: run.italic, code: run.code, x: rx, y: textY, width: w };
        rx += w;
        return placed;
      }));
    }
    cells.push(rowCells);
  }

  return {
    kind: 'table',
    x: 0,
    y: startY,
    width: x,
    height: ry,
    columnX,
    columnWidth,
    rowY,
    rowHeight: allRows.map(() => rowH),
    headerHeight: rowH,
    ruleY,
    cells,
  };
}

/**
 * Lay out parsed blocks into positioned runs and tables. The `measure` ruler is injected so the
 * Pixi view and Node tests agree. The returned `height` is exactly what the page scrolls to.
 */
export function layoutHelpBlocks(
  blocks: readonly HelpBlock[],
  maxWidth: number,
  art: HelpArtBox | null,
  measure: Measure,
  rtl = false,
): HelpLayout {
  const items: LaidOutItem[] = [];
  let y = HEADING_H;

  for (const block of blocks) {
    if (block.kind === 'table') {
      const laid = layoutTable(block, 0, measure);
      let ty = y;
      if (art !== null && ty < art.y + art.h) ty = art.y + art.h + ITEM_GAP;
      items.push({
        ...laid,
        y: ty,
        rowY: laid.rowY.map((v) => v + ty),
        ruleY: laid.ruleY.map((v) => v + ty),
        cells: laid.cells.map((row) => row.map((cell) => cell.map((r) => ({ ...r, y: r.y + ty })))),
      });
      y = ty + laid.height + ITEM_GAP;
    } else {
      const laid = layoutTextBlock(block, maxWidth, art, y, measure, rtl);
      items.push(...laid);
      y += laid.reduce((sum, l) => sum + l.height, 0) + ITEM_GAP;
    }
  }

  return { height: y, items };
}
