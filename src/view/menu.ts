import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { bevel, FONT, FONT_SIZE, menuWordRects, PAL, pointInRect, type Rect } from './chrome.ts';
import { getArtTexture } from './art.ts';

/**
 * Windows 95 dropdown menus for the File and Help menu words. Drawn in Pixi like the rest of the
 * chrome; geometry is derived from the menu bar so the hit-test and the drawing share one layout.
 */

export interface MenuEntry {
  id: string;
  label: string;
  disabled?: boolean;
  separator?: boolean;
  /** Draw a leading check mark (used by the Help menu's volume radio row). */
  checked?: boolean;
}

export interface OpenMenu {
  name: 'file' | 'view' | 'help';
  entries: MenuEntry[];
}

/** Menu word index in the chrome's MENU_ITEMS list. */
export const MENU_INDEX: Readonly<Record<OpenMenu['name'], number>> = { file: 0, view: 1, help: 2 };

const ITEM_H = 24;
const SEP_H = 5;
const PAD = 2;

export interface MenuLayout {
  rect: Rect;
  items: { id: string; label: string; disabled: boolean; separator: boolean; checked: boolean; rect: Rect }[];
}

export function computeMenu(menu: Rect, open: OpenMenu): MenuLayout {
  const word = menuWordRects(menu)[MENU_INDEX[open.name]];
  const width = Math.max(144, ...open.entries.map((e) => e.label.length * 7 + 30 + (e.checked ? 14 : 0)));
  let h = PAD * 2;
  for (const e of open.entries) h += e.separator ? SEP_H : ITEM_H;
  const rect: Rect = { x: word.x, y: menu.y + menu.h - 1, w: width, h };

  let y = rect.y + PAD;
  const items: MenuLayout['items'] = open.entries.map((e) => {
    const itemRect: Rect = { x: rect.x, y, w: width, h: e.separator ? SEP_H : ITEM_H };
    y += itemRect.h;
    return {
      id: e.id,
      label: e.label,
      disabled: !!e.disabled,
      separator: !!e.separator,
      checked: !!e.checked,
      rect: itemRect,
    };
  });

  return { rect, items };
}

export function menuEntryAt(menu: Rect, open: OpenMenu, px: number, py: number): string | null {
  const m = computeMenu(menu, open);
  for (const item of m.items) {
    if (item.separator) continue;
    if (pointInRect(item.rect, px, py)) return item.disabled ? null : item.id;
  }
  return null;
}

function makeText(text: string): Text {
  return new Text({ text, style: { fontFamily: FONT, fontSize: FONT_SIZE.body, fill: PAL.text } });
}

export class MenuView {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly checks = new Container();
  readonly checkSprites: Sprite[] = [];
  private readonly texts: Text[] = [];
  private checkIndex = 0;

  constructor() {
    this.root.addChild(this.g, this.checks);
    for (let i = 0; i < 8; i++) {
      const t = makeText('');
      t.anchor.set(0, 0.5);
      this.texts.push(t);
      this.root.addChild(t);
    }
  }

  /**
   * The pooled text object for row `index`, grown on demand. The pool used to be a fixed eight, which
   * was fine until the Help menu grew past it: the ninth row threw inside the render tick and killed the
   * frame, so the dropdown never appeared and the game looked frozen. A menu is data; its row pool grows
   * with it.
   */
  private textAt(index: number): Text {
    let t = this.texts[index];
    if (!t) {
      t = makeText('');
      t.anchor.set(0, 0.5);
      this.texts.push(t);
      this.root.addChild(t);
    }
    return t;
  }

  /** The pooled tick sprite for the `index`-th checked entry, grown on demand. */
  private checkSprite(index: number): Sprite {
    let s = this.checkSprites[index];
    if (!s) {
      s = new Sprite();
      s.anchor.set(0.5, 0.5);
      this.checkSprites.push(s);
      this.checks.addChild(s);
    }
    s.visible = true;
    return s;
  }

  /** A small Win95 check mark for a selected menu entry, tinted to the text colour. */
  private drawCheck(x: number, cy: number, color: number): void {
    const spr = this.checkSprite(this.checkIndex++);
    const tex = getArtTexture('check', 12);
    if (tex !== null) {
      spr.texture = tex;
      spr.width = 12;
      spr.height = 12;
      spr.position.set(x + 3.5, cy);
      spr.rotation = 0;
      spr.alpha = 1;
      spr.tint = color;
    } else {
      spr.visible = false;
      this.g.moveTo(x, cy).lineTo(x + 2, cy + 3).lineTo(x + 7, cy - 3).stroke({ width: 1, color });
    }
  }

  draw(menu: Rect, open: OpenMenu | null, hoveredId: string | null): void {
    const g = this.g;
    g.clear();
    this.checkIndex = 0;
    for (const t of this.texts) t.text = '';
    if (!open) {
      for (let i = 0; i < this.checkSprites.length; i++) this.checkSprites[i].visible = false;
      return;
    }

    const m = computeMenu(menu, open);
    bevel(g, m.rect, true, PAL.face);

    for (let i = 0; i < m.items.length; i++) {
      const item = m.items[i];
      const t = this.textAt(i);
      if (item.separator) {
        g.moveTo(item.rect.x + 2, item.rect.y + Math.floor(item.rect.h / 2))
          .lineTo(item.rect.x + item.rect.w - 2, item.rect.y + Math.floor(item.rect.h / 2))
          .stroke({ width: 1, color: PAL.shadow });
        continue;
      }
      if (hoveredId === item.id && !item.disabled) {
        g.rect(item.rect.x + 2, item.rect.y, item.rect.w - 4, item.rect.h).fill(PAL.title);
      }
      const textColor = item.disabled ? PAL.shadow : hoveredId === item.id ? PAL.titleInverse : PAL.text;
      if (item.checked) this.drawCheck(item.rect.x + 5, item.rect.y + Math.floor(item.rect.h / 2), textColor);
      t.text = item.label;
      t.style.fill = textColor;
      t.position.set(item.rect.x + 6 + (item.checked ? 14 : 0), item.rect.y + Math.floor(item.rect.h / 2));
    }

    for (let i = this.checkIndex; i < this.checkSprites.length; i++) this.checkSprites[i].visible = false;
  }
}
