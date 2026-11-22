import { Container, Graphics, Text } from 'pixi.js';
import { bevel, FONT, FONT_SIZE, PAL, pointInRect, type Layout, type Rect } from './chrome.ts';
import { mirrorIfRtl } from './direction.ts';
import { textWidth } from './metrics.ts';
import { t } from '../i18n/index.ts';
import { COLS, ROWS } from '../core/grid.ts';
import { hatchSegments } from './wallAppearance.ts';
import {
  EDITOR_TOOLS,
  editorToggleAt,
  editorValidation,
  TOOL_NAMES,
  type EditorModel,
  type EditorTool,
} from '../core/editor.ts';

/**
 * The map editor view: a palette on the left, the 20 x 12 board on the right (the same cell size as
 * play, so what you draw is what you play), a toolbar underneath, and a status line that names the
 * first validation problem as you draw (docs/design.md §20.2).
 */

export type EditorAction = 'undo' | 'redo' | 'new' | 'open' | 'save' | 'clear' | 'test' | 'copy';

const TOOLBAR_ACTIONS: readonly EditorAction[] = ['undo', 'redo', 'new', 'open', 'save', 'clear', 'test', 'copy'];
const TOOLBAR_LABELS: Readonly<Record<EditorAction, string>> = {
  undo: t('dlg.editor.undo'),
  redo: t('dlg.editor.redo'),
  new: t('dlg.editor.new'),
  open: t('dlg.editor.open'),
  save: t('dlg.editor.save'),
  clear: t('dlg.editor.clear'),
  test: t('dlg.editor.test'),
  copy: t('dlg.editor.copy'),
};

const PALETTE_H = 30;
const PALETTE_GAP = 6;
const TOOLBAR_W = 88;
const TOOLBAR_H = 26;
const TOOLBAR_GAP = 6;
/** The Exit button in the editor's top strip: a beveled button, 18 px tall so it fits the 22 px menu strip. */
const EXIT_H = 18;
const EXIT_PAD_X = 10;

export interface ToggleFieldLayout {
  field: 'periodTicks' | 'openTicks' | 'phaseTicks';
  label: string;
  minus: Rect;
  plus: Rect;
}

export interface EditorLayout {
  palette: { tool: EditorTool; rect: Rect }[];
  toolbar: { id: EditorAction; rect: Rect }[];
  togglePanel: { rect: Rect; fields: ToggleFieldLayout[] } | null;
  /** The editor's top strip (the menu bar), which carries the Exit button at its far end. */
  topStrip: Rect;
  /** The Exit button (docs/EDITOR-EXIT.md), beveled like the editor's other controls. */
  exit: Rect;
}

export function computeEditorLayout(l: Layout, model: EditorModel): EditorLayout {
  const pad = 6;
  const palette: { tool: EditorTool; rect: Rect }[] = EDITOR_TOOLS.map((tool, i) => ({
    tool,
    rect: { x: l.leftPanel.x + pad, y: l.leftPanel.y + 10 + i * (PALETTE_H + PALETTE_GAP), w: l.leftPanel.w - pad * 2, h: PALETTE_H },
  }));

  // The seven visible buttons may shrink to keep every label readable at 1024 x 640; the width is
  // still capped at the comfortable default so the larger board keeps its full-size buttons.
  const n = TOOLBAR_ACTIONS.length;
  const toolbarW = Math.min(TOOLBAR_W, Math.floor((l.boardW - (n - 1) * TOOLBAR_GAP) / n));
  const toolbarX0 = l.board.x + Math.floor((l.boardW - (n * toolbarW + (n - 1) * TOOLBAR_GAP)) / 2);
  const toolbarY = l.board.y + l.boardH + 8;
  const toolbar = TOOLBAR_ACTIONS.map((id, i) => ({
    id,
    rect: { x: toolbarX0 + i * (toolbarW + TOOLBAR_GAP), y: toolbarY, w: toolbarW, h: TOOLBAR_H },
  }));

  // The Exit button sits in the editor's top strip (the menu bar) at its far end, mirroring in RTL.
  const topStrip: Rect = l.menu;
  const exitW = textWidth(t('menu.file.exit'), FONT_SIZE.small) + EXIT_PAD_X * 2;
  const exitLtr: Rect = {
    x: topStrip.x + topStrip.w - 6 - exitW,
    y: topStrip.y + Math.floor((topStrip.h - EXIT_H) / 2),
    w: exitW,
    h: EXIT_H,
  };
  const exit: Rect = mirrorIfRtl(exitLtr, topStrip);

  let togglePanel: EditorLayout['togglePanel'] = null;
  const shutter = model.selectedShutter;
  const timing = shutter ? editorToggleAt(model, shutter.col, shutter.row) : undefined;
  if (shutter && timing) {
    const x = l.rightPanel.x + pad;
    const w = l.rightPanel.w - pad * 2;
    const source: { field: ToggleFieldLayout['field']; label: string }[] = [
      { field: 'periodTicks', label: t('dlg.editor.togglePeriod') },
      { field: 'openTicks', label: t('dlg.editor.toggleOpen') },
      { field: 'phaseTicks', label: t('dlg.editor.togglePhase') },
    ];
    const fields: ToggleFieldLayout[] = source.map((f, i) => {
      const rowY = l.rightPanel.y + 40 + i * 30;
      return {
        field: f.field,
        label: f.label,
        minus: { x, y: rowY, w: 22, h: 22 },
        plus: { x: x + w - 22, y: rowY, w: 22, h: 22 },
      };
    });
    togglePanel = { rect: { x, y: l.rightPanel.y + 6, w, h: 40 + 3 * 30 }, fields };
  }

  return { palette, toolbar, togglePanel, topStrip, exit };
}

export function editorPaletteAt(l: Layout, model: EditorModel, px: number, py: number): EditorTool | null {
  for (const b of computeEditorLayout(l, model).palette) if (pointInRect(b.rect, px, py)) return b.tool;
  return null;
}

export function editorToolbarAt(l: Layout, model: EditorModel, px: number, py: number): EditorAction | null {
  for (const b of computeEditorLayout(l, model).toolbar) if (pointInRect(b.rect, px, py)) return b.id;
  return null;
}

export interface ToggleNudge {
  field: 'periodTicks' | 'openTicks' | 'phaseTicks';
  dir: -1 | 1;
}

export function editorToggleNudgeAt(l: Layout, model: EditorModel, px: number, py: number): ToggleNudge | null {
  const panel = computeEditorLayout(l, model).togglePanel;
  if (!panel) return null;
  for (const f of panel.fields) {
    if (pointInRect(f.minus, px, py)) return { field: f.field, dir: -1 };
    if (pointInRect(f.plus, px, py)) return { field: f.field, dir: 1 };
  }
  return null;
}

/** Whether a point is on the editor's Exit button (docs/EDITOR-EXIT.md). */
export function editorExitAt(l: Layout, model: EditorModel, px: number, py: number): boolean {
  return pointInRect(computeEditorLayout(l, model).exit, px, py);
}

function makeText(text: string, fill: number, bold = false, size: number = FONT_SIZE.body): Text {
  return new Text({
    text,
    style: { fontFamily: FONT, fontSize: size, fill, fontWeight: bold ? 'bold' : 'normal' },
  });
}

export class EditorView {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly paletteTexts: Text[];
  private readonly toolbarTexts: Text[];
  private readonly startText: Text;
  private readonly exitText: Text;
  private readonly exitButtonText: Text;
  private readonly statusText: Text;
  private readonly toggleTitle: Text;
  private readonly toggleValues: Text[] = [];

  constructor() {
    this.paletteTexts = EDITOR_TOOLS.map((t) => makeText(TOOL_NAMES[t], PAL.text));
    this.toolbarTexts = TOOLBAR_ACTIONS.map((a) => makeText(TOOLBAR_LABELS[a], PAL.text, false, FONT_SIZE.small));
    this.startText = makeText(t('dlg.editor.start'), PAL.title, true);
    this.exitText = makeText(t('dlg.editor.exit'), PAL.maroon, true);
    this.exitButtonText = makeText(t('menu.file.exit'), PAL.text, false, FONT_SIZE.small);
    this.statusText = makeText('', PAL.text, false, FONT_SIZE.small);
    this.toggleTitle = makeText(t('dlg.editor.shutter'), PAL.text, true, FONT_SIZE.small);
    for (let i = 0; i < 3; i++) this.toggleValues.push(makeText('', PAL.text, false, FONT_SIZE.small));
    this.root.addChild(this.g);
    for (const t of this.paletteTexts) {
      t.anchor.set(0.5, 0.5);
      this.root.addChild(t);
    }
    for (const t of this.toolbarTexts) {
      t.anchor.set(0.5, 0.5);
      this.root.addChild(t);
    }
    this.startText.anchor.set(0.5, 0.5);
    this.exitText.anchor.set(0.5, 0.5);
    this.exitButtonText.anchor.set(0.5, 0.5);
    this.statusText.anchor.set(0, 0.5);
    this.toggleTitle.anchor.set(0, 0.5);
    this.root.addChild(this.startText, this.exitText, this.exitButtonText, this.statusText, this.toggleTitle);
    for (const t of this.toggleValues) {
      t.anchor.set(0, 0.5);
      this.root.addChild(t);
    }
  }

  draw(l: Layout, model: EditorModel, hover: { tool: EditorTool | null; action: EditorAction | null; exit: boolean }, notice = ''): void {
    const g = this.g;
    g.clear();
    const el = computeEditorLayout(l, model);
    const cell = l.board.cell;

    // The Exit button in the top strip (docs/EDITOR-EXIT.md), beveled like the editor's other controls.
    bevel(g, el.exit, true, hover.exit ? PAL.highlight : PAL.face);
    this.exitButtonText.text = t('menu.file.exit');
    this.exitButtonText.position.set(el.exit.x + el.exit.w / 2, el.exit.y + el.exit.h / 2);

    // Board tiles.
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const px = l.board.x + col * cell;
        const py = l.board.y + row * cell;
        const idx = row * COLS + col;
        const tile = model.tiles[idx];
        drawEditorTile(g, tile, px, py, cell);
      }
    }
    // Start / exit markers.
    if (model.start) {
      this.startText.position.set(l.board.x + (model.start.col + 0.5) * cell, l.board.y + (model.start.row + 0.5) * cell);
    } else {
      this.startText.position.set(-1000, -1000);
    }
    if (model.exit) {
      this.exitText.position.set(l.board.x + (model.exit.col + 0.5) * cell, l.board.y + (model.exit.row + 0.5) * cell);
    } else {
      this.exitText.position.set(-1000, -1000);
    }

    // Palette.
    for (let i = 0; i < el.palette.length; i++) {
      const b = el.palette[i];
      const selected = model.tool === b.tool;
      bevel(g, b.rect, !selected, selected ? PAL.highlight : PAL.face);
      const t = this.paletteTexts[i];
      t.text = TOOL_NAMES[b.tool];
      t.style.fill = PAL.text;
      t.position.set(b.rect.x + b.rect.w / 2, b.rect.y + b.rect.h / 2);
    }

    // Toolbar.
    for (let i = 0; i < el.toolbar.length; i++) {
      const b = el.toolbar[i];
      const enabled = isActionEnabled(el.toolbar[i].id, model);
      drawToolbarButton(g, b.rect, enabled, hover.action === b.id);
      const t = this.toolbarTexts[i];
      t.text = TOOLBAR_LABELS[b.id];
      t.style.fill = enabled ? PAL.text : PAL.shadow;
      t.position.set(b.rect.x + b.rect.w / 2, b.rect.y + b.rect.h / 2);
    }

    // Toggle timing panel.
    this.toggleTitle.text = '';
    for (const t of this.toggleValues) t.text = '';
    if (el.togglePanel) {
      const panel = el.togglePanel;
      bevel(g, panel.rect, false, PAL.face);
      this.toggleTitle.text = t('dlg.editor.shutter');
      this.toggleTitle.position.set(panel.rect.x + 4, panel.rect.y + 14);
      const timing = editorToggleAt(model, model.selectedShutter!.col, model.selectedShutter!.row)!;
      for (let i = 0; i < panel.fields.length; i++) {
        const f = panel.fields[i];
        const value = timing[f.field];
        bevel(g, f.minus, true, PAL.face);
        bevel(g, f.plus, true, PAL.face);
        const cx = f.minus.x + f.minus.w / 2;
        const cy = f.minus.y + f.minus.h / 2;
        g.moveTo(cx - 4, cy).lineTo(cx + 4, cy).stroke({ width: 1, color: PAL.text });
        const px2 = f.plus.x + f.plus.w / 2;
        const py2 = f.plus.y + f.plus.h / 2;
        g.moveTo(px2 - 4, py2).lineTo(px2 + 4, py2).stroke({ width: 1, color: PAL.text });
        g.moveTo(px2, py2 - 4).lineTo(px2, py2 + 4).stroke({ width: 1, color: PAL.text });
        const label = this.toggleValues[i];
        label.text = t('dlg.editor.toggleValue', { label: f.label, value });
        label.position.set(f.minus.x + f.minus.w + 8, f.minus.y + f.minus.h / 2);
      }
    }

    // Status line: a transient notice first, then the first validation problem, else a ready message.
    const problem = editorValidation(model);
    if (notice !== '') {
      this.statusText.text = notice;
      this.statusText.style.fill = PAL.title;
    } else if (problem !== null) {
      this.statusText.text = problem;
      this.statusText.style.fill = PAL.maroon;
    } else if (model.tool === 'no-build') {
      this.statusText.text = t('shell.editor.tool.noBuildHint');
      this.statusText.style.fill = PAL.text;
    } else {
      this.statusText.text = t('dlg.editor.ready');
      this.statusText.style.fill = PAL.text;
    }
    this.statusText.position.set(l.statusPanes.left.x + 4, l.statusPanes.left.y + l.statusPanes.left.h / 2);
  }
}

function isActionEnabled(action: EditorAction, model: EditorModel): boolean {
  switch (action) {
    case 'undo':
      return model.undoStack.length > 0;
    case 'redo':
      return model.redoStack.length > 0;
    case 'test':
    case 'copy':
    case 'save':
      return editorValidation(model) === null;
    case 'clear':
    case 'new':
    case 'open':
      return true;
  }
}

function drawToolbarButton(g: Graphics, r: Rect, enabled: boolean, hovered: boolean): void {
  if (enabled) {
    bevel(g, r, true, hovered ? PAL.highlight : PAL.face);
  } else {
    g.rect(r.x, r.y, r.w, r.h).fill(PAL.face);
    g.rect(r.x, r.y, r.w, r.h).stroke({ width: 1, color: PAL.shadow });
  }
}

function drawEditorTile(g: Graphics, tile: 'floor' | 'wall' | 'shutter' | 'no-build', px: number, py: number, cell: number): void {
  if (tile === 'wall') {
    g.rect(px, py, cell, cell).fill(0xa0a0a0);
    edgeRect(g, px, py, cell, 0x707070);
  } else if (tile === 'shutter') {
    g.rect(px, py, cell, cell).fill(0x807060);
    edgeRect(g, px, py, cell, 0x403020);
    g.moveTo(px + 2, py + cell - 2).lineTo(px + cell - 2, py + 2).stroke({ width: 1, color: 0x403020 });
  } else {
    g.rect(px, py, cell, cell).fill(PAL.face);
    hline(g, px, px + cell, py + 0.5, PAL.highlight);
    vline(g, px + 0.5, py, py + cell, PAL.highlight);
    hline(g, px, px + cell, py + cell - 0.5, PAL.shadow);
    vline(g, px + cell - 0.5, py, py + cell, PAL.shadow);
    if (tile === 'no-build') {
      for (const seg of hatchSegments(px + 1, py + 1, cell - 2, 4)) {
        g.moveTo(seg.x1, seg.y1).lineTo(seg.x2, seg.y2).stroke({ width: 1, color: PAL.shadow, alpha: 0.14 });
      }
    }
  }
}

function hline(g: Graphics, x0: number, x1: number, y: number, color: number): void {
  g.moveTo(x0, y).lineTo(x1, y).stroke({ width: 1, color });
}

function vline(g: Graphics, x: number, y0: number, y1: number, color: number): void {
  g.moveTo(x, y0).lineTo(x, y1).stroke({ width: 1, color });
}

function edgeRect(g: Graphics, x: number, y: number, s: number, color: number): void {
  hline(g, x, x + s, y + 0.5, color);
  hline(g, x, x + s, y + s - 0.5, color);
  vline(g, x + 0.5, y, y + s, color);
  vline(g, x + s - 0.5, y, y + s, color);
}
