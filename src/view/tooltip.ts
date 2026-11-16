import { Container, Graphics, Text } from 'pixi.js';
import { FONT } from './chrome.ts';
import type { TooltipLine, TooltipSegment } from './tooltipText.ts';

/**
 * Windows 95 tooltips, drawn as Pixi objects in the same scene (no DOM).
 *
 * The HUD and board report what is under the pointer each frame; this module owns the hover delay
 * (so a tooltip never flickers while the pointer crosses the screen), the follow/flip placement,
 * and the drawing. It never participates in hit-testing, so tooltips cannot intercept input.
 *
 * The *text* lives in tooltipText.ts (Pixi-free, so the smoke harness can assert it). A line may be
 * a plain string or a list of segments; segments carry an optional colour, used to paint the
 * "after" number of a spend delta.
 */

export { paletteTooltipLines, towerTooltipLines } from './tooltipText.ts';

const FILL = 0xffffe1;
const TEXT_COLOR = 0x000000;
const HOVER_DELAY_MS = 250;
const OFFSET = 14;
const PAD_X = 6;
const PAD_Y = 4;

function segmentsOf(line: TooltipLine): TooltipSegment[] {
  return typeof line === 'string' ? [{ text: line }] : line;
}

export interface TooltipTarget {
  /** Stable id of the hovered thing (a palette kind, a tower id, or a HUD control), or null. */
  key: string | null;
  lines: TooltipLine[];
}

export class TooltipView {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly rows: { container: Container; texts: Text[] }[] = [];
  private key: string | null = null;
  private lines: TooltipLine[] = [];
  private hoverStart = -1;

  constructor() {
    this.root.addChild(this.g);
  }

  /** Called once per frame with the current hover target and the pointer/viewport geometry. */
  update(target: TooltipTarget, x: number, y: number, viewportW: number, viewportH: number): void {
    if (target.key === null) {
      this.key = null;
      this.lines = [];
      this.hoverStart = -1;
      this.g.clear();
      for (const r of this.rows) r.container.visible = false;
      return;
    }

    const now = performance.now();
    if (target.key !== this.key) {
      this.key = target.key;
      this.hoverStart = now;
    }
    // Refresh the lines every frame: a purchase can change the numbers under a steady pointer
    // (e.g. buying a spec), and a tooltip must not drift from the sim.
    this.lines = target.lines;

    if (this.hoverStart < 0 || now - this.hoverStart < HOVER_DELAY_MS) {
      this.g.clear();
      for (const r of this.rows) r.container.visible = false;
      return;
    }

    this.draw(x, y, viewportW, viewportH);
  }

  private draw(x: number, y: number, viewportW: number, viewportH: number): void {
    const g = this.g;
    g.clear();

    const n = this.lines.length;
    this.ensureRows(n);

    let boxW = 0;
    let lineH = 12;
    for (let i = 0; i < n; i++) {
      const segments = segmentsOf(this.lines[i]);
      const row = this.rows[i];
      let rowW = 0;
      for (let j = 0; j < segments.length; j++) {
        const t = this.ensureText(row, j);
        t.text = segments[j].text;
        t.style.fill = segments[j].color ?? TEXT_COLOR;
        t.visible = true;
        t.position.set(rowW, 0);
        rowW += t.width;
        lineH = Math.max(lineH, t.height);
      }
      for (let j = segments.length; j < row.texts.length; j++) row.texts[j].visible = false;
      boxW = Math.max(boxW, rowW);
    }
    boxW += PAD_X * 2;
    const boxH = lineH * n + PAD_Y * 2;

    // Follow the pointer at a 14px offset, flipping to the other side near the right/bottom edges.
    let tx = x + OFFSET;
    let ty = y + OFFSET;
    if (tx + boxW > viewportW) tx = x - OFFSET - boxW;
    if (ty + boxH > viewportH) ty = y - OFFSET - boxH;
    if (tx < 0) tx = 0;
    if (ty < 0) ty = 0;

    g.rect(tx, ty, boxW, boxH).fill(FILL);
    g.rect(tx, ty, boxW, boxH).stroke({ width: 1, color: TEXT_COLOR });

    for (let i = 0; i < n; i++) {
      const row = this.rows[i];
      row.container.visible = true;
      row.container.position.set(tx + PAD_X, ty + PAD_Y + i * lineH + lineH / 2);
    }
  }

  private ensureText(row: { container: Container; texts: Text[] }, index: number): Text {
    while (row.texts.length <= index) {
      const t = new Text({
        text: '',
        style: { fontFamily: FONT, fontSize: 11, fill: TEXT_COLOR },
      });
      t.anchor.set(0, 0.5);
      row.texts.push(t);
      row.container.addChild(t);
    }
    return row.texts[index];
  }

  private ensureRows(n: number): void {
    while (this.rows.length < n) {
      const container = new Container();
      this.rows.push({ container, texts: [] });
      this.root.addChild(container);
    }
    for (let i = 0; i < this.rows.length; i++) this.rows[i].container.visible = i < n;
  }
}
