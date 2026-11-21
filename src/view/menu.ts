import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { bevel, FONT, FONT_SIZE, menuIndex, menuWordRects, PAL, pointInRect, type Layout, type MenuName, type Rect } from './chrome.ts';
import { getArtTexture } from './art.ts';
import { textWidth } from './hud.ts';
import { isRtl } from './direction.ts';

/**
 * Windows 95 dropdown menus for the File and Help menu words. Drawn in Pixi like the rest of the
 * chrome; geometry is derived from the menu bar so the hit-test and the drawing share one layout.
 * A menu entry may carry a nested submenu (the Cheats menu's Spawn list), drawn as a flyout to the
 * side rather than a permanent second column.
 */

export interface MenuEntry {
  id: string;
  label: string;
  disabled?: boolean;
  separator?: boolean;
  /** Draw a leading check mark (used by the Help menu's volume radio row). */
  checked?: boolean;
  /** A nested submenu; a parent with an empty or missing submenu behaves as a normal item. */
  submenu?: MenuEntry[];
}

export interface OpenMenu {
  name: MenuName;
  entries: MenuEntry[];
  /** The id of the parent entry whose submenu flyout is open, or null. */
  submenuParentId: string | null;
}

const ITEM_H = 24;
const SEP_H = 5;
const PAD = 2;
/** The chevron column reserved at the right edge of a submenu parent (left edge under RTL). */
export const CHEVRON_W = 14;
/** How long the pointer must rest on a submenu parent before its flyout opens. */
export const SUBMENU_OPEN_MS = 250;

export interface MenuItemLayout {
  id: string;
  label: string;
  disabled: boolean;
  separator: boolean;
  checked: boolean;
  hasSubmenu: boolean;
  rect: Rect;
}

export interface MenuColumn {
  rect: Rect;
  items: MenuItemLayout[];
}

export interface MenuLayout {
  rect: Rect;
  items: MenuItemLayout[];
  /** The open submenu flyout, or null. */
  submenu: { rect: Rect; items: MenuItemLayout[]; parentId: string } | null;
}

/** True when an entry carries a non-empty submenu (and therefore a chevron). */
function hasSubmenu(e: MenuEntry): boolean {
  return e.submenu !== undefined && e.submenu.length > 0;
}

function columnWidth(entries: MenuEntry[]): number {
  return Math.max(
    144,
    ...entries.map((e) => Math.ceil(textWidth(e.label, FONT_SIZE.body)) + 30 + (e.checked ? 14 : 0) + (hasSubmenu(e) ? CHEVRON_W : 0)),
  );
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
      hasSubmenu: hasSubmenu(e),
      rect: itemRect,
    };
  });
  return { rect: { x, y, w: width, h: height }, items };
}

/** Lay out a submenu flyout beside its parent row, flipped and clamped to the window. */
function computeFlyout(
  layout: Layout,
  parentRect: Rect,
  parentItemRect: Rect,
  entries: MenuEntry[],
  parentId: string,
): { rect: Rect; items: MenuItemLayout[]; parentId: string } {
  const window = layout.window;
  const rtl = isRtl();
  const w = columnWidth(entries);
  const h = columnHeight(entries);

  // Open on the parent menu's far edge, mirrored under RTL; flip to the near side at the window edge.
  let fx = rtl ? parentRect.x - w : parentRect.x + parentRect.w;
  const crosses = rtl ? fx < window.x : fx + w > window.x + window.w;
  if (crosses) fx = rtl ? parentRect.x + parentRect.w : parentRect.x - w;

  // Top-aligned with the parent row, clamped up inside the window, never above the menu bar.
  let fy = parentItemRect.y;
  if (fy + h > window.y + window.h) {
    fy = window.y + window.h - h;
    if (fy < layout.menu.y) fy = layout.menu.y;
  }

  // A list taller than the whole client area splits into two balanced columns in one flyout.
  if (h > layout.client.h) {
    const leftCount = Math.ceil(entries.length / 2);
    const left = entries.slice(0, leftCount);
    const right = entries.slice(leftCount);
    const splitH = Math.max(columnHeight(left), columnHeight(right));
    const leftColumn = layoutColumn(left, fx, fy, w, splitH);
    const rightColumn = layoutColumn(right, fx + w, fy, w, splitH);
    return { rect: { x: fx, y: fy, w: w * 2, h: splitH }, items: [...leftColumn.items, ...rightColumn.items], parentId };
  }

  const column = layoutColumn(entries, fx, fy, w, h);
  return { rect: { x: fx, y: fy, w, h }, items: column.items, parentId };
}

export function computeMenu(layout: Layout, open: OpenMenu): MenuLayout {
  const menu = layout.menu;
  const word = menuWordRects(menu)[menuIndex(open.name)];
  const width = columnWidth(open.entries);
  const height = columnHeight(open.entries);
  // RTL aligns the dropdown's right edge with the word's right edge (docs/RTL.md).
  const x = isRtl() ? word.x + word.w - width : word.x;
  const rect: Rect = { x, y: menu.y + menu.h - 1, w: width, h: height };
  const column = layoutColumn(open.entries, rect.x, rect.y, width, height);

  let submenu: MenuLayout['submenu'] = null;
  if (open.submenuParentId !== null) {
    const parentEntry = open.entries.find((e) => e.id === open.submenuParentId);
    const parentItem = column.items.find((it) => it.id === open.submenuParentId);
    if (parentEntry && parentItem && hasSubmenu(parentEntry)) {
      submenu = computeFlyout(layout, rect, parentItem.rect, parentEntry.submenu!, parentEntry.id);
    }
  }

  return { rect, items: column.items, submenu };
}

/** The id of the entry under a point, from a computed layout (parent menu first, then the flyout). */
export function menuItemIdAt(m: MenuLayout, px: number, py: number): string | null {
  const columns = m.submenu ? [m.items, m.submenu.items] : [m.items];
  for (const column of columns) {
    for (const item of column) {
      if (item.separator) continue;
      if (pointInRect(item.rect, px, py)) return item.disabled ? null : item.id;
    }
  }
  return null;
}

export function menuEntryAt(layout: Layout, open: OpenMenu, px: number, py: number): string | null {
  return menuItemIdAt(computeMenu(layout, open), px, py);
}

/** The armed state of the submenu hover timer (a parent row and the time the pointer entered it). */
export interface SubmenuTimerState {
  parentId: string | null;
  startedAt: number;
}

export interface SubmenuTransition {
  submenuParentId: string | null;
  timer: SubmenuTimerState;
}

/**
 * Pure submenu hover/close state machine. `parentRowId` is the submenu parent row under the pointer
 * (or null); `inFlyout` is whether the pointer is inside the open flyout rect. Hovering a parent for
 * SUBMENU_OPEN_MS opens it; leaving before then closes it; moving into the flyout keeps it open.
 */
export function advanceSubmenu(
  submenuParentId: string | null,
  timer: SubmenuTimerState,
  parentRowId: string | null,
  inFlyout: boolean,
  now: number,
): SubmenuTransition {
  if (parentRowId !== null) {
    if (submenuParentId === parentRowId) {
      return { submenuParentId, timer: { parentId: null, startedAt: 0 } };
    }
    if (timer.parentId !== parentRowId) {
      return { submenuParentId: null, timer: { parentId: parentRowId, startedAt: now } };
    }
    if (now - timer.startedAt >= SUBMENU_OPEN_MS) {
      return { submenuParentId: parentRowId, timer: { parentId: null, startedAt: 0 } };
    }
    return { submenuParentId: null, timer };
  }
  if (inFlyout) {
    return { submenuParentId, timer: { parentId: null, startedAt: 0 } };
  }
  return { submenuParentId: null, timer: { parentId: null, startedAt: 0 } };
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

  /** A 4 px chevron pointing toward the flyout, dimmed on a disabled parent. */
  private drawChevron(item: MenuItemLayout, color: number): void {
    const cy = item.rect.y + Math.floor(item.rect.h / 2);
    const g = this.g;
    if (isRtl()) {
      const cx = item.rect.x + CHEVRON_W / 2;
      g.poly([cx + 2, cy - 2, cx + 2, cy + 2, cx - 2, cy]).fill(color);
    } else {
      const cx = item.rect.x + item.rect.w - CHEVRON_W / 2;
      g.poly([cx - 2, cy - 2, cx - 2, cy + 2, cx + 2, cy]).fill(color);
    }
  }

  /** Draw one dropdown column of entries, reusing the shared label pool. */
  private drawColumn(rect: Rect, items: MenuItemLayout[], highlightId: string | null, parentOpenId: string | null): void {
    const g = this.g;
    const rtl = isRtl();
    bevel(g, rect, true, PAL.face);
    for (const item of items) {
      const t = this.textAt(this.textIndex++);
      if (item.separator) {
        g.moveTo(item.rect.x + 2, item.rect.y + Math.floor(item.rect.h / 2))
          .lineTo(item.rect.x + item.rect.w - 2, item.rect.y + Math.floor(item.rect.h / 2))
          .stroke({ width: 1, color: PAL.shadow });
        continue;
      }
      const highlighted = !item.disabled && (highlightId === item.id || parentOpenId === item.id);
      if (highlighted) {
        g.rect(item.rect.x + 2, item.rect.y, item.rect.w - 4, item.rect.h).fill(PAL.title);
      }
      const textColor = item.disabled ? PAL.shadow : highlighted ? PAL.titleInverse : PAL.text;
      if (item.checked) {
        const cx = rtl ? item.rect.x + item.rect.w - 5 - 12 : item.rect.x + 5;
        this.drawCheck(cx, item.rect.y + Math.floor(item.rect.h / 2), textColor);
      }
      t.text = item.label;
      t.style.fill = textColor;
      if (rtl) {
        t.anchor.x = 1;
        t.position.set(item.rect.x + item.rect.w - 6 - (item.checked ? 14 : 0), item.rect.y + Math.floor(item.rect.h / 2));
      } else {
        t.anchor.x = 0;
        t.position.set(item.rect.x + 6 + (item.checked ? 14 : 0), item.rect.y + Math.floor(item.rect.h / 2));
      }
      if (item.hasSubmenu) this.drawChevron(item, item.disabled ? PAL.shadow : PAL.text);
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

  draw(layout: Layout, open: OpenMenu | null, hoveredId: string | null, keyboardId: string | null): void {
    const g = this.g;
    g.clear();
    this.checkIndex = 0;
    this.textIndex = 0;
    for (const t of this.texts) t.text = '';
    if (!open) {
      for (let i = 0; i < this.checkSprites.length; i++) this.checkSprites[i].visible = false;
      return;
    }

    const m = computeMenu(layout, open);
    const highlightId = keyboardId ?? hoveredId;
    this.drawColumn(m.rect, m.items, highlightId, open.submenuParentId);
    if (m.submenu) this.drawColumn(m.submenu.rect, m.submenu.items, highlightId, null);

    for (let i = this.checkIndex; i < this.checkSprites.length; i++) this.checkSprites[i].visible = false;
  }
}
