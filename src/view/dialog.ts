import { Container, Graphics, Text } from 'pixi.js';
import { bevel, FONT, PAL, pointInRect, type Layout, type Rect } from './chrome.ts';

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

const TITLE_H = 18;
const ROW_H = 14;
const PAD = 10;
const BUTTON_W = 76;
const BUTTON_H = 22;
const BUTTON_GAP = 6;

export function computeDialog(l: Layout, model: DialogModel): DialogLayout {
  const titleW = model.title.length * 7 + 24;
  const buttonsW = model.buttons.length * BUTTON_W + Math.max(0, model.buttons.length - 1) * BUTTON_GAP;
  const bodyW = Math.max(titleW, 160, ...model.rows.map((r) => r.text.length * 6 + 20), buttonsW + 8);
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
    style: { fontFamily: FONT, fontSize: 11, fill, fontWeight: bold ? 'bold' : 'normal' },
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
    for (let i = 0; i < 16; i++) {
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
      t.position.set(d.rect.x + 12, d.rect.y + 2 + TITLE_H + PAD + i * ROW_H + ROW_H / 2);
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
