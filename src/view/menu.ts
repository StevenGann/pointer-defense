import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { bevel, FONT, FONT_SIZE, menuIndex, menuWordRects, PAL, pointInRect, type MenuName, type Rect } from './chrome.ts';
import { getArtTexture } from './art.ts';
import { textWidth } from './hud.ts';

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
  name: MenuName;
  entries: MenuEntry[];
  /** An optional second column drawn to the right (the Cheats menu's spawn list). */
  secondColumn?: MenuEntry[];
}

const ITEM_H = 24;
const SEP_H = 5;
const PAD = 2;

export interface MenuItemLayout {
  id: string;
  label: string;
  disabled: boolean;
  separator: boolean;
  checked: boolean;
  rect: Rect;
}

export interface MenuColumn {
  rect: Rect;
  items: MenuItemLayout[];
}

export interface MenuLayout {
  rect: Rect;
  items: MenuItemLayout[];
  /** The optional second column, or null. */
  second: MenuColumn | null;
}

function columnWidth(entries: MenuEntry[]): number {
  return Math.max(144, ...entries.map((e) => Math.ceil(textWidth(e.label, FONT_SIZE.body)) + 30 + (e.checked ? 14 : 0)));
}

function columnHeight(entries: MenuEntry[]): number {
  let h = PAD * 2;
  for (const e of entries) h += e.separator ? SEP_H : ITEM_H;
  return h;
}

function layoutColumn(entries: MenuEntry[], x: number, y: number, width: number, height: number): MenuColumn {
  let cy = y + PAD;
  const items = entries.map((e) => {
    const itemRect: Rect = { x, y: cy, w: width, h: e.separator ? SEP_H : ITEM_H };
    cy += itemRect.h;
    return {
      id: e.id,
      label: e.label,
      disabled: !!e.disabled,
      separator: !!e.separator,
      checked: !!e.checked,
      rect: itemRect,
    };
  });
  return { rect: { x, y, w: width, h: height }, items };
}

export function computeMenu(menu: Rect, open: OpenMenu): MenuLayout {
  const word = menuWordRects(menu)[menuIndex(open.name)];
  const width = columnWidth(open.entries);
  const height = columnHeight(open.entries);
  const rect: Rect = { x: word.x, y: menu.y + menu.h - 1, w: width, h: height };
  const column = layoutColumn(open.entries, rect.x, rect.y, width, height);

  let second: MenuColumn | null = null;
  if (open.secondColumn && open.secondColumn.length > 0) {
    const w2 = columnWidth(open.secondColumn);
    const h2 = columnHeight(open.secondColumn);
    const r2: Rect = { x: rect.x + rect.w, y: rect.y, w: w2, h: Math.max(h2, rect.h) };
    second = layoutColumn(open.secondColumn, r2.x, r2.y, w2, r2.h);
  }

  return { rect, items: column.items, second };
}

export function menuEntryAt(menu: Rect, open: OpenMenu, px: number, py: number): string | null {
  const m = computeMenu(menu, open);
  for (const column of [m.items, ...(m.second ? [m.second.items] : [])]) {
    for (const item of column) {
      if (item.separator) continue;
      if (pointInRect(item.rect, px, py)) return item.disabled ? null : item.id;
    }
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
  private textIndex = 0;

  constructor() {
    this.root.addChild(this.g, this.checks);
    for (let i = 0; i < 8; i++) {
      const t = makeText('');
      t.anchor.set(0, 0.5);
      this.texts.push(t);
      this.root.addChild(t);
    }
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

  /** The pooled label for the `index`-th entry drawn this frame, grown on demand. */
  private textAt(index: number): Text {
    while (this.texts.length <= index) {
      const t = makeText('');
      t.anchor.set(0, 0.5);
      this.texts.push(t);
      this.root.addChild(t);
    }
    return this.texts[index];
  }

  /** Draw one dropdown column of entries, reusing the shared label pool. */
  private drawColumn(rect: Rect, items: MenuItemLayout[], hoveredId: string | null): void {
    const g = this.g;
    bevel(g, rect, true, PAL.face);
    for (const item of items) {
      const t = this.textAt(this.textIndex++);
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
    this.textIndex = 0;
    for (const t of this.texts) t.text = '';
    if (!open) {
      for (let i = 0; i < this.checkSprites.length; i++) this.checkSprites[i].visible = false;
      return;
    }

    const m = computeMenu(menu, open);
    this.drawColumn(m.rect, m.items, hoveredId);
    if (m.second) this.drawColumn(m.second.rect, m.second.items, hoveredId);

    for (let i = this.checkIndex; i < this.checkSprites.length; i++) this.checkSprites[i].visible = false;
  }
}
