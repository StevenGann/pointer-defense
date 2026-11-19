import { Container, Graphics, Sprite, Text } from 'pixi.js';
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
import { getArtTexture, UPGRADE_PLACEHOLDER } from './art.ts';
import { textWidth } from './hud.ts';
import { formatNumber } from '../core/format.ts';
import type { RunState } from '../core/state.ts';
import {
  hasUpgrade,
  revealedUpgrades,
  UPGRADE_GROUP_TITLES,
  UPGRADE_GROUPS,
  type UpgradeDef,
  type UpgradeGroup,
  type UpgradeId,
} from '../core/upgrades.ts';

/**
 * The Global Upgrades dialog (docs/GLOBAL-UPGRADES.md §6.2): a fixed, centred Windows 95 window
 * listing every global upgrade the run has reached, grouped POINTER / TOWERS / ECONOMY / BOARD /
 * SYSTEM. Hidden rows do not exist — a group with nothing revealed draws nothing, header included —
 * and one dim footer line promises more. The layout is Pixi-free so the smoke harness can assert it;
 * `UpgradesView` draws it, modelled on the Restore dialog.
 */

export const UPGRADES_W = 560;
export const UPGRADE_ROW_H = 20;
export const UPGRADE_ICON = 20;
export const UPGRADE_BUY_W = 88;
const SECTION_H = 16;
const HEADER_H = 20;
const FOOTER_H = 18;
const PAD = 10;

export const UPGRADES_FOOTER = 'More appear as the run goes deeper.';

export interface UpgradeRow {
  def: UpgradeDef;
  owned: boolean;
  affordable: boolean;
  rect: Rect;
  icon: Rect;
  buy: Rect;
}

export interface UpgradesLayout {
  window: Rect;
  title: Rect;
  close: Rect;
  header: Rect;
  groups: { group: UpgradeGroup; header: Rect }[];
  rows: UpgradeRow[];
  footer: Rect;
}

export function computeUpgradesLayout(l: Layout, s: RunState): UpgradesLayout {
  const revealed = revealedUpgrades(s);
  const groups = UPGRADE_GROUPS.filter((g) => revealed.some((d) => d.group === g));

  const contentH = HEADER_H + groups.length * SECTION_H + revealed.length * UPGRADE_ROW_H + FOOTER_H;
  const h = Math.min(2 + TITLE_H + PAD + contentH + PAD, l.client.h - 16);
  const w = Math.min(UPGRADES_W, l.client.w - 40);
  const window: Rect = {
    x: l.client.x + Math.floor((l.client.w - w) / 2),
    y: l.client.y + Math.floor((l.client.h - h) / 2),
    w,
    h,
  };
  const title: Rect = { x: window.x + 2, y: window.y + 2, w: w - 4, h: TITLE_H };
  const close: Rect = {
    x: title.x + title.w - 2 - CONTROL_BOX_W,
    y: title.y + Math.floor((TITLE_H - CONTROL_BOX_H) / 2),
    w: CONTROL_BOX_W,
    h: CONTROL_BOX_H,
  };

  const innerX = window.x + PAD;
  const innerW = w - PAD * 2;
  let cy = window.y + 2 + TITLE_H + PAD;
  const header: Rect = { x: innerX, y: cy, w: innerW, h: HEADER_H };
  cy += HEADER_H;

  const groupRects: { group: UpgradeGroup; header: Rect }[] = [];
  const rows: UpgradeRow[] = [];
  for (const group of groups) {
    groupRects.push({ group, header: { x: innerX, y: cy, w: innerW, h: SECTION_H } });
    cy += SECTION_H;
    for (const def of revealed) {
      if (def.group !== group) continue;
      const rect: Rect = { x: innerX, y: cy, w: innerW, h: UPGRADE_ROW_H };
      rows.push({
        def,
        owned: hasUpgrade(s, def.id),
        affordable: s.economy.salvage >= def.cost,
        rect,
        icon: { x: rect.x, y: rect.y, w: UPGRADE_ICON, h: UPGRADE_ICON },
        buy: { x: rect.x + rect.w - UPGRADE_BUY_W, y: rect.y + 1, w: UPGRADE_BUY_W, h: UPGRADE_ROW_H - 2 },
      });
      cy += UPGRADE_ROW_H;
    }
  }
  const footer: Rect = { x: innerX, y: cy, w: innerW, h: FOOTER_H };
  return { window, title, close, header, groups: groupRects, rows, footer };
}

/** The buy button's caption: `Buy 1,200`, or `OWNED`. */
export function upgradeButtonText(row: Pick<UpgradeRow, 'def' | 'owned'>): string {
  return row.owned ? 'OWNED' : `Buy ${formatNumber(row.def.cost)}`;
}

/** Whether a row's button is live: not owned and affordable right now. */
export function upgradeRowBuyable(row: Pick<UpgradeRow, 'owned' | 'affordable'>): boolean {
  return !row.owned && row.affordable;
}

/** The tooltip for a row: the detail, plus the shortfall when the run cannot afford it yet. */
export function globalUpgradeTooltipLines(def: UpgradeDef, s: RunState): string[] {
  const lines = [def.detail];
  if (!hasUpgrade(s, def.id) && s.economy.salvage < def.cost) {
    lines.push(`Need ${formatNumber(def.cost - s.economy.salvage)} more`);
  }
  return lines;
}

export type UpgradesHit =
  | { type: 'close' }
  | { type: 'buy'; id: UpgradeId }
  | { type: 'row'; id: UpgradeId }
  | { type: 'window' }
  | null;

/** What a point in the dialog lands on. A disabled or owned button is just its row. */
export function upgradesHitAt(ul: UpgradesLayout, x: number, y: number): UpgradesHit {
  if (!pointInRect(ul.window, x, y)) return null;
  if (pointInRect(ul.close, x, y)) return { type: 'close' };
  for (const row of ul.rows) {
    if (upgradeRowBuyable(row) && pointInRect(row.buy, x, y)) return { type: 'buy', id: row.def.id };
    if (pointInRect(row.rect, x, y)) return { type: 'row', id: row.def.id };
  }
  return { type: 'window' };
}

/**
 * Cut `text` to fit `maxW` px at `fontSize`, with no ellipsis (the spec truncates bare). Measured
 * with the same estimator the HUD uses, so it agrees with the headless harness.
 */
export function truncateToWidth(text: string, maxW: number, fontSize: number): string {
  if (maxW <= 0) return '';
  if (textWidth(text, fontSize) <= maxW) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (textWidth(text.slice(0, mid), fontSize) <= maxW) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo).trimEnd();
}

/** Keyboard selection state for the dialog: open flag plus the highlighted row index. */
export class UpgradesSession {
  open = false;
  selected = 0;

  show(): void {
    this.open = true;
    this.selected = 0;
  }

  hide(): void {
    this.open = false;
  }

  /** Move the selection by `delta` rows, clamped to the revealed list. */
  move(delta: number, rowCount: number): void {
    if (rowCount <= 0) {
      this.selected = 0;
      return;
    }
    this.selected = Math.max(0, Math.min(rowCount - 1, this.selected + delta));
  }
}

function makeText(text: string, size: number, bold: boolean, fill: number): Text {
  const t = new Text({
    text,
    style: { fontFamily: FONT, fontSize: size, fill, fontWeight: bold ? 'bold' : 'normal' },
  });
  t.anchor.set(0, 0.5);
  return t;
}

export class UpgradesView {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly titleText: Text;
  private readonly headerText: Text;
  private readonly salvageText: Text;
  private readonly footerText: Text;
  private readonly texts: Text[] = [];
  private readonly icons: Sprite[] = [];
  private readonly iconLayer = new Container();

  constructor() {
    this.titleText = makeText('Global Upgrades', FONT_SIZE.body, true, PAL.titleInverse);
    this.headerText = makeText('GLOBAL UPGRADES', FONT_SIZE.body, true, PAL.text);
    this.salvageText = makeText('', FONT_SIZE.body, true, PAL.text);
    this.salvageText.anchor.set(1, 0.5);
    this.footerText = makeText(UPGRADES_FOOTER, FONT_SIZE.small, false, PAL.shadow);
    this.root.addChild(this.g, this.iconLayer, this.titleText, this.headerText, this.salvageText, this.footerText);
  }

  /** A pooled row text, grown on demand exactly as the Restore dialog grows its rows. */
  private textAt(index: number): Text {
    let t = this.texts[index];
    if (!t) {
      t = makeText('', FONT_SIZE.small, false, PAL.text);
      this.texts.push(t);
      this.root.addChild(t);
    }
    t.anchor.set(0, 0.5);
    return t;
  }

  private iconAt(index: number): Sprite {
    let sp = this.icons[index];
    if (!sp) {
      sp = new Sprite();
      this.icons.push(sp);
      this.iconLayer.addChild(sp);
    }
    return sp;
  }

  draw(open: boolean, s: RunState, l: Layout, selected: number): void {
    const g = this.g;
    g.clear();
    if (!open) {
      this.titleText.text = '';
      this.headerText.text = '';
      this.salvageText.text = '';
      this.footerText.text = '';
      for (const t of this.texts) t.text = '';
      for (const sp of this.icons) sp.visible = false;
      return;
    }

    const ul = computeUpgradesLayout(l, s);

    bevel(g, ul.window, true, PAL.face);
    g.rect(ul.title.x, ul.title.y, ul.title.w, ul.title.h).fill(PAL.title);
    this.titleText.text = 'Global Upgrades';
    this.titleText.position.set(ul.title.x + 6, ul.title.y + TITLE_H / 2);

    bevel(g, ul.close, true, PAL.face);
    const cx = ul.close.x + Math.floor(ul.close.w / 2);
    const cy = ul.close.y + Math.floor(ul.close.h / 2);
    g.moveTo(cx - 4, cy - 4).lineTo(cx + 4, cy + 4).stroke({ width: 1, color: PAL.text });
    g.moveTo(cx + 4, cy - 4).lineTo(cx - 4, cy + 4).stroke({ width: 1, color: PAL.text });

    const midHeader = ul.header.y + Math.floor(ul.header.h / 2);
    this.headerText.text = 'GLOBAL UPGRADES';
    this.headerText.position.set(ul.header.x, midHeader);
    this.salvageText.text = `Salvage: ${formatNumber(s.economy.salvage)}`;
    this.salvageText.position.set(ul.header.x + ul.header.w, midHeader);

    // Rows past the bottom of a clamped window are not drawn (the window never outgrows the client).
    const bottom = ul.window.y + ul.window.h - 4;
    let ti = 0;
    for (const gr of ul.groups) {
      if (gr.header.y + gr.header.h > bottom) break;
      const t = this.textAt(ti++);
      t.text = UPGRADE_GROUP_TITLES[gr.group];
      t.style.fill = PAL.title;
      t.style.fontWeight = 'bold';
      t.position.set(gr.header.x, gr.header.y + Math.floor(gr.header.h / 2));
    }

    let ii = 0;
    ul.rows.forEach((row, index) => {
      if (row.rect.y + row.rect.h > bottom) return;
      const midY = row.rect.y + Math.floor(row.rect.h / 2);
      if (index === selected) {
        g.rect(row.rect.x, row.rect.y, row.rect.w - UPGRADE_BUY_W - 4, row.rect.h).stroke({ width: 1, color: PAL.title });
      }

      const tex = getArtTexture(row.def.id, UPGRADE_ICON) ?? getArtTexture(UPGRADE_PLACEHOLDER, UPGRADE_ICON);
      const sp = this.iconAt(ii++);
      if (tex) {
        sp.texture = tex;
        sp.width = UPGRADE_ICON;
        sp.height = UPGRADE_ICON;
        sp.position.set(row.icon.x, row.icon.y);
        sp.alpha = row.owned ? 0.5 : 1;
        sp.visible = true;
      } else {
        sp.visible = false;
        bevel(g, row.icon, true, PAL.face);
      }

      const nameX = row.icon.x + UPGRADE_ICON + 6;
      const name = this.textAt(ti++);
      name.text = row.def.name;
      name.style.fill = row.owned ? PAL.shadow : PAL.text;
      name.style.fontWeight = 'bold';
      name.position.set(nameX, midY);

      const lineX = nameX + textWidth(row.def.name, FONT_SIZE.small) + 8;
      const lineW = row.buy.x - 6 - lineX;
      const line = this.textAt(ti++);
      line.text = truncateToWidth(row.def.line, lineW, FONT_SIZE.small);
      line.style.fill = PAL.shadow;
      line.style.fontWeight = 'normal';
      line.position.set(lineX, midY);

      const bt = this.textAt(ti++);
      bt.text = upgradeButtonText(row);
      bt.style.fontWeight = 'normal';
      if (row.owned) {
        bt.style.fill = PAL.shadow;
      } else if (row.affordable) {
        bt.style.fill = PAL.text;
        bevel(g, row.buy, true, PAL.face);
      } else {
        bt.style.fill = PAL.shadow;
        g.rect(row.buy.x, row.buy.y, row.buy.w, row.buy.h).fill(PAL.face);
        g.rect(row.buy.x, row.buy.y, row.buy.w, row.buy.h).stroke({ width: 1, color: PAL.shadow });
      }
      bt.anchor.set(0.5, 0.5);
      bt.position.set(row.buy.x + row.buy.w / 2, row.buy.y + Math.floor(row.buy.h / 2));
    });

    this.footerText.text = ul.footer.y + ul.footer.h <= bottom + 4 ? UPGRADES_FOOTER : '';
    this.footerText.position.set(ul.footer.x, ul.footer.y + Math.floor(ul.footer.h / 2));

    for (let i = ti; i < this.texts.length; i++) this.texts[i].text = '';
    for (let i = ii; i < this.icons.length; i++) this.icons[i].visible = false;
  }
}
