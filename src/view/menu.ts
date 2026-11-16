import { Container, Graphics, Text } from 'pixi.js';
import { bevel, FONT, menuWordRects, PAL, pointInRect, type Rect } from './chrome.ts';

/**
 * Windows 95 dropdown menus for the File and Help menu words. Drawn in Pixi like the rest of the
 * chrome; geometry is derived from the menu bar so the hit-test and the drawing share one layout.
 */

export interface MenuEntry {
  id: string;
  label: string;
  disabled?: boolean;
  separator?: boolean;
}

export interface OpenMenu {
  name: 'file' | 'help';
  entries: MenuEntry[];
}

/** Menu word index in the chrome's MENU_ITEMS list. */
export const MENU_INDEX: Readonly<Record<OpenMenu['name'], number>> = { file: 0, help: 2 };

const ITEM_H = 18;
const SEP_H = 5;
const PAD = 2;

export interface MenuLayout {
  rect: Rect;
  items: { id: string; label: string; disabled: boolean; separator: boolean; rect: Rect }[];
}

export function computeMenu(menu: Rect, open: OpenMenu): MenuLayout {
  const word = menuWordRects(menu)[MENU_INDEX[open.name]];
  const width = Math.max(128, ...open.entries.map((e) => e.label.length * 6 + 28));
  let h = PAD * 2;
  for (const e of open.entries) h += e.separator ? SEP_H : ITEM_H;
  const rect: Rect = { x: word.x, y: menu.y + menu.h - 1, w: width, h };

  let y = rect.y + PAD;
  const items: MenuLayout['items'] = open.entries.map((e) => {
    const itemRect: Rect = { x: rect.x, y, w: width, h: e.separator ? SEP_H : ITEM_H };
    y += itemRect.h;
    return { id: e.id, label: e.label, disabled: !!e.disabled, separator: !!e.separator, rect: itemRect };
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
  return new Text({ text, style: { fontFamily: FONT, fontSize: 11, fill: PAL.text } });
}

export class MenuView {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly texts: Text[] = [];

  constructor() {
    this.root.addChild(this.g);
    for (let i = 0; i < 8; i++) {
      const t = makeText('');
      t.anchor.set(0, 0.5);
      this.texts.push(t);
      this.root.addChild(t);
    }
  }

  draw(menu: Rect, open: OpenMenu | null, hoveredId: string | null): void {
    const g = this.g;
    g.clear();
    for (const t of this.texts) t.text = '';
    if (!open) return;

    const m = computeMenu(menu, open);
    bevel(g, m.rect, true, PAL.face);

    for (let i = 0; i < m.items.length; i++) {
      const item = m.items[i];
      const t = this.texts[i];
      if (item.separator) {
        g.moveTo(item.rect.x + 2, item.rect.y + Math.floor(item.rect.h / 2))
          .lineTo(item.rect.x + item.rect.w - 2, item.rect.y + Math.floor(item.rect.h / 2))
          .stroke({ width: 1, color: PAL.shadow });
        continue;
      }
      if (hoveredId === item.id && !item.disabled) {
        g.rect(item.rect.x + 2, item.rect.y, item.rect.w - 4, item.rect.h).fill(PAL.title);
      }
      t.text = item.label;
      t.style.fill = item.disabled ? PAL.shadow : hoveredId === item.id ? PAL.titleInverse : PAL.text;
      t.position.set(item.rect.x + 6, item.rect.y + Math.floor(item.rect.h / 2));
    }
  }
}
