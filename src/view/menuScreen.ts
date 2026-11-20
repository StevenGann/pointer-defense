import { Container, Graphics, Text } from 'pixi.js';
import { bevel, FONT, FONT_SIZE, PAL, pointInRect, type Layout, type Rect } from './chrome.ts';

/**
 * The main menu: a sunken field in the client area with three raised buttons — Play, Editor and
 * Load code — drawn in the same Windows 95 chrome as the rest of the game (docs/design.md §20.1).
 * The load-code dialog lives here too: a text field plus OK / Cancel, with its own status line.
 */

export type MenuButtonId = 'continue' | 'play' | 'editor' | 'load';

const BUTTON_W = 240;
const BUTTON_H = 40;
const BUTTON_GAP = 14;

export interface MenuButton {
  id: MenuButtonId;
  label: string;
  rect: Rect;
}

export interface MenuScreenLayout {
  panel: Rect;
  title: Rect;
  buttons: MenuButton[];
}

export function computeMenuScreen(l: Layout, continueLabel: string | null = null): MenuScreenLayout {
  const titleH = 40;
  const pad = 20;
  const panelW = BUTTON_W + pad * 2;
  const labels: [MenuButtonId, string][] = [];
  if (continueLabel !== null) labels.push(['continue', continueLabel]);
  labels.push(['play', 'Play'], ['editor', 'Editor'], ['load', 'Load code']);
  const count = labels.length;
  const panelH = pad + titleH + count * BUTTON_H + (count - 1) * BUTTON_GAP + pad;
  const panel: Rect = {
    x: l.client.x + Math.floor((l.client.w - panelW) / 2),
    y: l.client.y + Math.floor((l.client.h - panelH) / 2),
    w: panelW,
    h: panelH,
  };
  const title: Rect = { x: panel.x, y: panel.y + pad, w: panel.w, h: titleH };
  const buttons: MenuButton[] = labels.map(([id, label], i) => ({
    id,
    label,
    rect: {
      x: panel.x + pad,
      y: panel.y + pad + titleH + i * (BUTTON_H + BUTTON_GAP),
      w: BUTTON_W,
      h: BUTTON_H,
    },
  }));
  return { panel, title, buttons };
}

export function menuButtonAt(l: Layout, px: number, py: number, continueLabel: string | null = null): MenuButtonId | null {
  for (const b of computeMenuScreen(l, continueLabel).buttons) if (pointInRect(b.rect, px, py)) return b.id;
  return null;
}

const DLG_W = 460;
const DLG_TITLE_H = 20;
const DLG_PAD = 12;
const DLG_ROW_H = 20;
const DLG_FIELD_H = 24;
const DLG_BUTTON_W = 84;
const DLG_BUTTON_H = 28;

export interface LoadDialogLayout {
  rect: Rect;
  field: Rect;
  status: Rect;
  ok: Rect;
  cancel: Rect;
}

export function computeLoadDialog(l: Layout): LoadDialogLayout {
  const h = DLG_TITLE_H + DLG_PAD + DLG_ROW_H + DLG_FIELD_H + DLG_ROW_H + DLG_PAD + DLG_BUTTON_H + DLG_PAD;
  const w = Math.min(DLG_W, l.client.w - 40);
  const rect: Rect = {
    x: l.client.x + Math.floor((l.client.w - w) / 2),
    y: l.client.y + Math.floor((l.client.h - h) / 2),
    w,
    h,
  };
  const field: Rect = { x: rect.x + DLG_PAD, y: rect.y + DLG_TITLE_H + DLG_PAD + DLG_ROW_H, w: w - DLG_PAD * 2, h: DLG_FIELD_H };
  const status: Rect = { x: rect.x + DLG_PAD, y: field.y + field.h + 2, w: w - DLG_PAD * 2, h: DLG_ROW_H };
  const ok: Rect = { x: rect.x + w - DLG_PAD - DLG_BUTTON_W * 2 - 6, y: rect.y + h - DLG_PAD - DLG_BUTTON_H, w: DLG_BUTTON_W, h: DLG_BUTTON_H };
  const cancel: Rect = { x: ok.x + DLG_BUTTON_W + 6, y: ok.y, w: DLG_BUTTON_W, h: DLG_BUTTON_H };
  return { rect, field, status, ok, cancel };
}

export function loadDialogButtonAt(l: Layout, px: number, py: number): 'ok' | 'cancel' | null {
  const d = computeLoadDialog(l);
  if (pointInRect(d.ok, px, py)) return 'ok';
  if (pointInRect(d.cancel, px, py)) return 'cancel';
  return null;
}

function makeText(text: string, fill: number, bold = false, size: number = FONT_SIZE.body): Text {
  return new Text({
    text,
    style: { fontFamily: FONT, fontSize: size, fill, fontWeight: bold ? 'bold' : 'normal' },
  });
}

export class MenuScreenView {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly title: Text;
  private readonly buttonTexts: Text[] = [];

  constructor() {
    this.root.addChild(this.g);
    this.title = makeText('Pointer Defense', PAL.title, true, 20);
    this.title.anchor.set(0.5, 0.5);
    this.root.addChild(this.title);
    for (let i = 0; i < 4; i++) {
      const t = makeText('', PAL.text, true);
      t.anchor.set(0.5, 0.5);
      this.buttonTexts.push(t);
      this.root.addChild(t);
    }
  }

  draw(l: Layout, hover: MenuButtonId | null, continueLabel: string | null = null): void {
    const g = this.g;
    g.clear();
    const m = computeMenuScreen(l, continueLabel);
    bevel(g, m.panel, false, PAL.face);

    this.title.text = 'Pointer Defense';
    this.title.position.set(m.title.x + m.title.w / 2, m.title.y + m.title.h / 2);

    for (let i = 0; i < this.buttonTexts.length; i++) {
      const b = m.buttons[i];
      const t = this.buttonTexts[i];
      if (!b) {
        t.text = '';
        continue;
      }
      bevel(g, b.rect, true, hover === b.id ? PAL.highlight : PAL.face);
      t.text = b.label;
      t.style.fill = PAL.text;
      t.position.set(b.rect.x + b.rect.w / 2, b.rect.y + b.rect.h / 2);
    }
  }
}

export class LoadDialogView {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly title: Text;
  private readonly field: Text;
  private readonly status: Text;
  private readonly ok: Text;
  private readonly cancel: Text;

  constructor() {
    this.title = makeText('Load code', PAL.titleInverse, true);
    this.field = makeText('', PAL.text);
    this.status = makeText('', PAL.maroon);
    this.ok = makeText('OK', PAL.text);
    this.cancel = makeText('Cancel', PAL.text);
    this.title.anchor.set(0, 0.5);
    this.field.anchor.set(0, 0.5);
    this.status.anchor.set(0, 0.5);
    this.ok.anchor.set(0.5, 0.5);
    this.cancel.anchor.set(0.5, 0.5);
    this.root.addChild(this.g, this.title, this.field, this.status, this.ok, this.cancel);
  }

  draw(l: Layout, text: string, status: string, hover: 'ok' | 'cancel' | null): void {
    const g = this.g;
    g.clear();
    const d = computeLoadDialog(l);

    g.rect(l.client.x, l.client.y, l.client.w, l.client.h).fill({ color: PAL.dark, alpha: 0.4 });
    bevel(g, d.rect, true, PAL.face);
    g.rect(d.rect.x + 2, d.rect.y + 2, d.rect.w - 4, DLG_TITLE_H).fill(PAL.title);

    this.title.text = 'Load code';
    this.title.position.set(d.rect.x + 6, d.rect.y + 2 + DLG_TITLE_H / 2);

    bevel(g, d.field, false, PAL.highlight);
    this.field.text = text;
    this.field.position.set(d.field.x + 4, d.field.y + d.field.h / 2);

    this.status.text = status;
    this.status.position.set(d.status.x, d.status.y + d.status.h / 2);

    bevel(g, d.ok, true, hover === 'ok' ? PAL.highlight : PAL.face);
    bevel(g, d.cancel, true, hover === 'cancel' ? PAL.highlight : PAL.face);
    this.ok.text = 'OK';
    this.ok.position.set(d.ok.x + d.ok.w / 2, d.ok.y + d.ok.h / 2);
    this.cancel.text = 'Cancel';
    this.cancel.position.set(d.cancel.x + d.cancel.w / 2, d.cancel.y + d.cancel.h / 2);
  }
}
