import { Container, Graphics, Sprite, Text } from 'pixi.js';
import {
  bevel,
  computeListView,
  computeStatusBar,
  computeTabStrip,
  CONTROL_BOX_H,
  CONTROL_BOX_W,
  drawListView,
  drawStatusBar,
  drawTabStrip,
  drawWindowChrome,
  dottedLine,
  FONT,
  FONT_SIZE,
  PAL,
  TAB_H,
  TITLE_H,
  pointInRect,
  type Layout,
  type ListColumn,
  type ListViewGeom,
  type Rect,
  type StatusPanel,
} from './chrome.ts';
import { getArtTexture, UPGRADE_PLACEHOLDER } from './art.ts';
import { textWidth } from './hud.ts';
import { formatNumber } from '../core/format.ts';
import type { RunState } from '../core/state.ts';
import {
  GLOBAL_UPGRADES,
  hasUpgrade,
  revealedUpgrades,
  type UpgradeDef,
  type UpgradeId,
} from '../core/upgrades.ts';

/**
 * The Global Upgrades dialog (docs/VISUAL-PASS.md §2): an Add/Remove Programs property sheet, 660 x
 * 430, with a toolbar (buy / info / scroll), an Available/Owned tab strip, a list view with column
 * headers and a scrollbar, a description strip, OK/Cancel and a status bar. The model is Pixi-free so
 * the smoke harness can assert it; `UpgradesView` draws it.
 */

export const UPGRADES_W = 660;
export const UPGRADES_H = 430;
export const UPGRADE_ROW_H = 22;
export const UPGRADE_ICON = 20;
const ICON_COL_W = 44;
const TOOLBAR_H = 28;
const DESC_H = 18;
const BUTTON_H = 28;
const BUTTON_W = 84;

export type UpgradesTab = 'available' | 'owned';

export interface UpgradeRow {
  def: UpgradeDef;
  owned: boolean;
  affordable: boolean;
  rect: Rect;
  icon: Rect;
}

export interface UpgradesLayout {
  window: Rect;
  titleBar: Rect;
  close: Rect;
  toolbar: Rect;
  toolbarButtons: { id: 'buy' | 'info' | 'scroll'; rect: Rect }[];
  tabStrip: Rect;
  tabs: { id: UpgradesTab; label: string; rect: Rect; active: boolean }[];
  listField: Rect;
  list: ListViewGeom;
  columns: ListColumn[];
  rows: UpgradeRow[];
  descStrip: Rect;
  ok: Rect;
  cancel: Rect;
  statusBar: Rect;
  status: StatusPanel[];
}

export function computeUpgradesLayout(l: Layout, s: RunState, tab: UpgradesTab = 'available', scroll = 0): UpgradesLayout {
  const w = Math.min(UPGRADES_W, l.client.w - 40);
  const h = Math.min(UPGRADES_H, l.client.h - 16);
  const window: Rect = {
    x: l.client.x + Math.floor((l.client.w - w) / 2),
    y: l.client.y + Math.floor((l.client.h - h) / 2),
    w,
    h,
  };
  const titleBar: Rect = { x: window.x + 2, y: window.y + 2, w: w - 4, h: TITLE_H };
  const close: Rect = {
    x: titleBar.x + titleBar.w - 2 - CONTROL_BOX_W,
    y: titleBar.y + Math.floor((TITLE_H - CONTROL_BOX_H) / 2),
    w: CONTROL_BOX_W,
    h: CONTROL_BOX_H,
  };

  const toolbar: Rect = { x: window.x + 2, y: titleBar.y + titleBar.h, w: w - 4, h: TOOLBAR_H };
  const btnH = 24;
  let bx = toolbar.x + 6;
  const tbBtn = (id: 'buy' | 'info' | 'scroll'): { id: 'buy' | 'info' | 'scroll'; rect: Rect } => {
    const rect: Rect = { x: bx, y: toolbar.y + Math.floor((TOOLBAR_H - btnH) / 2), w: 24, h: btnH };
    bx += 24 + 4;
    return { id, rect };
  };
  const toolbarButtons = [tbBtn('buy'), tbBtn('info'), tbBtn('scroll')];

  const tabStrip: Rect = { x: window.x + 2, y: toolbar.y + toolbar.h, w: w - 4, h: TAB_H };
  const tabLabels = ['Available', 'Owned'];
  const activeIdx = tab === 'available' ? 0 : 1;
  const tabs = computeTabStrip(tabStrip, tabLabels, activeIdx).map((t, i) => ({
    id: (i === 0 ? 'available' : 'owned') as UpgradesTab,
    label: t.label,
    rect: { x: t.x, y: t.y, w: t.w, h: t.h },
    active: t.active,
  }));

  const statusBar: Rect = { x: window.x + 2, y: window.y + h - 2 - 22, w: w - 4, h: 22 };
  const buttonRowY = statusBar.y - 8 - BUTTON_H;
  const cancel: Rect = { x: statusBar.x + statusBar.w - BUTTON_W - 6, y: buttonRowY, w: BUTTON_W, h: BUTTON_H };
  const ok: Rect = { x: cancel.x - BUTTON_W - 6, y: buttonRowY, w: BUTTON_W, h: BUTTON_H };
  const descStrip: Rect = { x: window.x + 8, y: buttonRowY - 6 - DESC_H, w: w - 16, h: DESC_H };

  const listField: Rect = { x: window.x + 8, y: tabStrip.y + TAB_H, w: w - 16, h: descStrip.y - 4 - (tabStrip.y + TAB_H) };

  const revealed = revealedUpgrades(s);
  const ownedList = revealed.filter((d) => hasUpgrade(s, d.id));
  const availableList = revealed.filter((d) => !hasUpgrade(s, d.id));
  const defs = tab === 'available' ? availableList : ownedList;

  const columns: ListColumn[] =
    tab === 'available'
      ? [
          { title: 'Icon', w: ICON_COL_W },
          { title: 'Upgrade', w: 150 },
          { title: 'Unlocks', w: 250 },
          { title: 'Cost', w: 70 },
          { title: 'Status', w: 114 },
        ]
      : [
          { title: 'Icon', w: ICON_COL_W },
          { title: 'Upgrade', w: 170 },
          { title: 'Unlocks', w: 300 },
          { title: 'Status', w: 114 },
        ];

  const list = computeListView(listField, columns, UPGRADE_ROW_H, defs.length, scroll);

  const rows: UpgradeRow[] = defs.map((def, i) => ({
    def,
    owned: hasUpgrade(s, def.id),
    affordable: s.economy.salvage >= def.cost,
    rect: { x: list.body.x, y: list.body.y + i * UPGRADE_ROW_H, w: list.body.w, h: UPGRADE_ROW_H },
    icon: { x: list.colX[0] + 4, y: list.body.y + i * UPGRADE_ROW_H + 1, w: UPGRADE_ICON, h: UPGRADE_ICON },
  }));

  const status = computeStatusBar(statusBar, [0, 150]);

  return { window, titleBar, close, toolbar, toolbarButtons, tabStrip, tabs, listField, list, columns, rows, descStrip, ok, cancel, statusBar, status };
}

/** Whether a row's cart button is live: not owned and affordable right now. */
export function upgradeRowBuyable(row: Pick<UpgradeRow, 'owned' | 'affordable'>): boolean {
  return !row.owned && row.affordable;
}

/** The cart's caption: `Buy 1,200`, or `OWNED`. */
export function upgradeButtonText(row: Pick<UpgradeRow, 'def' | 'owned'>): string {
  return row.owned ? 'OWNED' : `Buy ${formatNumber(row.def.cost)}`;
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
  | { type: 'tab'; tab: UpgradesTab }
  | { type: 'toolbar'; action: 'buy' | 'info' | 'scroll' }
  | { type: 'row'; id: UpgradeId }
  | { type: 'ok' }
  | { type: 'cancel' }
  | { type: 'window' }
  | null;

/** What a point in the dialog lands on. A disabled toolbar button is still reported (the caller gates it). */
export function upgradesHitAt(ul: UpgradesLayout, x: number, y: number): UpgradesHit {
  if (!pointInRect(ul.window, x, y)) return null;
  if (pointInRect(ul.close, x, y)) return { type: 'close' };
  for (const tb of ul.toolbarButtons) {
    if (pointInRect(tb.rect, x, y)) return { type: 'toolbar', action: tb.id };
  }
  for (const t of ul.tabs) {
    if (pointInRect(t.rect, x, y)) return { type: 'tab', tab: t.id };
  }
  for (const row of ul.rows) {
    if (pointInRect(row.rect, x, y)) return { type: 'row', id: row.def.id };
  }
  if (pointInRect(ul.ok, x, y)) return { type: 'ok' };
  if (pointInRect(ul.cancel, x, y)) return { type: 'cancel' };
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

/** Keyboard/tab/scroll selection state for the dialog. */
export class UpgradesSession {
  open = false;
  selected = 0;
  tab: UpgradesTab = 'available';
  scroll = 0;

  show(): void {
    this.open = true;
    this.selected = 0;
    this.tab = 'available';
    this.scroll = 0;
  }

  hide(): void {
    this.open = false;
  }

  setTab(tab: UpgradesTab): void {
    if (this.tab === tab) return;
    this.tab = tab;
    this.selected = 0;
    this.scroll = 0;
  }

  /** Move the selection by `delta` rows, clamped to the list. */
  move(delta: number, rowCount: number): void {
    if (rowCount <= 0) {
      this.selected = 0;
      return;
    }
    this.selected = Math.max(0, Math.min(rowCount - 1, this.selected + delta));
  }

  /** Scroll by `delta` rows, clamped to the list's range. */
  scrollBy(delta: number, ul: UpgradesLayout): void {
    this.scroll = Math.max(0, Math.min(ul.list.scrollMax, this.scroll + delta));
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
  private readonly headerTexts: Text[] = [];
  private readonly rowTexts: Text[] = [];
  private readonly descText: Text;
  private readonly okText: Text;
  private readonly cancelText: Text;
  private readonly statusTexts: Text[] = [];
  private readonly icons: Sprite[] = [];
  private readonly iconLayer = new Container();

  constructor() {
    this.titleText = makeText('Global Upgrades', FONT_SIZE.body, true, PAL.titleInverse);
    this.descText = makeText('', FONT_SIZE.small, false, PAL.text);
    this.descText.style.fontStyle = 'italic';
    this.okText = makeText('OK', FONT_SIZE.body, false, PAL.text);
    this.okText.anchor.set(0.5, 0.5);
    this.cancelText = makeText('Cancel', FONT_SIZE.body, false, PAL.text);
    this.cancelText.anchor.set(0.5, 0.5);
    this.root.addChild(this.g, this.iconLayer, this.titleText, this.descText, this.okText, this.cancelText);
  }

  private headerTextAt(index: number): Text {
    let t = this.headerTexts[index];
    if (!t) {
      t = makeText('', FONT_SIZE.small, true, PAL.text);
      this.headerTexts.push(t);
      this.root.addChild(t);
    }
    return t;
  }

  private rowTextAt(index: number): Text {
    let t = this.rowTexts[index];
    if (!t) {
      t = makeText('', FONT_SIZE.small, false, PAL.text);
      this.rowTexts.push(t);
      this.root.addChild(t);
    }
    return t;
  }

  private statusTextAt(index: number): Text {
    let t = this.statusTexts[index];
    if (!t) {
      t = makeText('', FONT_SIZE.small, false, PAL.text);
      this.statusTexts.push(t);
      this.root.addChild(t);
    }
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

  draw(open: boolean, s: RunState, l: Layout, session: UpgradesSession): void {
    const g = this.g;
    g.clear();
    if (!open) {
      this.titleText.text = '';
      this.descText.text = '';
      this.okText.text = '';
      this.cancelText.text = '';
      for (const t of this.headerTexts) t.text = '';
      for (const t of this.rowTexts) t.text = '';
      for (const t of this.statusTexts) t.text = '';
      for (const sp of this.icons) sp.visible = false;
      return;
    }

    const ul = computeUpgradesLayout(l, s, session.tab, session.scroll);

    drawWindowChrome(g, ul.window, { close: true, minimize: false, maximize: false });
    this.titleText.text = 'Global Upgrades';
    this.titleText.position.set(ul.titleBar.x + 6, ul.titleBar.y + TITLE_H / 2);

    // Toolbar.
    g.rect(ul.toolbar.x, ul.toolbar.y, ul.toolbar.w, ul.toolbar.h).fill(PAL.face);
    const selectedRow = ul.rows[session.selected];
    const buyEnabled = selectedRow !== undefined && upgradeRowBuyable(selectedRow);
    const scrollEnabled = ul.list.overflow;
    for (const tb of ul.toolbarButtons) {
      const enabled = tb.id === 'buy' ? buyEnabled : tb.id === 'scroll' ? scrollEnabled : false;
      if (enabled) bevel(g, tb.rect, true, PAL.face);
      else g.rect(tb.rect.x, tb.rect.y, tb.rect.w, tb.rect.h).fill(PAL.face);
      drawToolbarGlyph(g, tb.id, tb.rect, enabled ? PAL.text : PAL.shadow);
      // raised divider between buttons
      g.rect(tb.rect.x + tb.rect.w + 2, tb.rect.y + 2, 2, tb.rect.h - 4).fill(PAL.highlight);
    }

    // Tabs.
    drawTabStrip(g, ul.tabStrip, ['Available', 'Owned'], session.tab === 'available' ? 0 : 1);

    // List view.
    drawListView(g, ul.listField, ul.columns, UPGRADE_ROW_H, ul.rows.length, session.selected, session.scroll);
    // Header titles.
    for (let i = 0; i < ul.columns.length; i++) {
      const t = this.headerTextAt(i);
      t.text = ul.columns[i].title;
      t.position.set(ul.list.colX[i] + 4, ul.list.header.y + Math.floor(ul.list.header.h / 2));
    }
    // Rows.
    let ti = 0;
    let ii = 0;
    for (let i = 0; i < ul.rows.length; i++) {
      const row = ul.rows[i];
      if (i < ul.list.firstRow || i >= ul.list.firstRow + ul.list.rowsVisible) continue;
      const midY = row.rect.y + Math.floor(UPGRADE_ROW_H / 2);
      const selected = i === session.selected;
      const textColor = selected ? PAL.titleInverse : row.owned && session.tab === 'available' ? PAL.shadow : PAL.text;

      const tex = getArtTexture(row.def.id, UPGRADE_ICON) ?? getArtTexture(UPGRADE_PLACEHOLDER, UPGRADE_ICON);
      const sp = this.iconAt(ii++);
      if (tex) {
        sp.texture = tex;
        sp.width = UPGRADE_ICON;
        sp.height = UPGRADE_ICON;
        sp.position.set(row.icon.x, row.icon.y);
        sp.alpha = session.tab === 'owned' || row.affordable ? 1 : 0.5;
        sp.visible = true;
      } else {
        sp.visible = false;
        bevel(g, row.icon, true, PAL.face);
      }

      // Name.
      const name = this.rowTextAt(ti++);
      name.text = row.def.name;
      name.style.fill = textColor;
      name.style.fontWeight = 'bold';
      name.position.set(ul.list.colX[1] + 4, midY);

      // Unlocks.
      const unlocksW = ul.list.colX[2] + ul.columns[2].w - ul.list.colX[2] - 8;
      const unlocks = this.rowTextAt(ti++);
      unlocks.text = truncateToWidth(row.def.line, unlocksW, FONT_SIZE.small);
      unlocks.style.fill = textColor;
      unlocks.style.fontWeight = 'normal';
      unlocks.position.set(ul.list.colX[2] + 4, midY);

      if (session.tab === 'available') {
        const cost = this.rowTextAt(ti++);
        cost.text = formatNumber(row.def.cost);
        cost.style.fill = textColor;
        cost.style.fontWeight = 'normal';
        cost.position.set(ul.list.colX[3] + 4, midY);

        const status = this.rowTextAt(ti++);
        status.text = 'Available';
        status.style.fill = textColor;
        status.style.fontWeight = 'normal';
        status.position.set(ul.list.colX[4] + 4, midY);
      } else {
        const status = this.rowTextAt(ti++);
        status.text = 'Owned';
        status.style.fill = textColor;
        status.style.fontWeight = 'normal';
        status.position.set(ul.list.colX[3] + 4, midY);
      }
    }
    for (let i = ti; i < this.rowTexts.length; i++) this.rowTexts[i].text = '';
    for (let i = ii; i < this.icons.length; i++) this.icons[i].visible = false;

    // Description strip.
    bevel(g, ul.descStrip, false, PAL.face);
    const descDef = ul.rows[session.selected]?.def;
    this.descText.text = descDef ? descDef.detail : '';
    this.descText.position.set(ul.descStrip.x + 4, ul.descStrip.y + Math.floor(ul.descStrip.h / 2));

    // OK / Cancel.
    bevel(g, ul.ok, true, PAL.face);
    dottedLine(g, ul.ok.x + 2, ul.ok.y + 2, ul.ok.x + ul.ok.w - 2, ul.ok.y + 2, PAL.dark);
    dottedLine(g, ul.ok.x + ul.ok.w - 2, ul.ok.y + 2, ul.ok.x + ul.ok.w - 2, ul.ok.y + ul.ok.h - 2, PAL.dark);
    dottedLine(g, ul.ok.x + ul.ok.w - 2, ul.ok.y + ul.ok.h - 2, ul.ok.x + 2, ul.ok.y + ul.ok.h - 2, PAL.dark);
    dottedLine(g, ul.ok.x + 2, ul.ok.y + ul.ok.h - 2, ul.ok.x + 2, ul.ok.y + 2, PAL.dark);
    bevel(g, ul.cancel, true, PAL.face);
    this.okText.position.set(ul.ok.x + ul.ok.w / 2, ul.ok.y + ul.ok.h / 2);
    this.cancelText.position.set(ul.cancel.x + ul.cancel.w / 2, ul.cancel.y + ul.cancel.h / 2);

    // Status bar.
    const panels = drawStatusBar(g, ul.statusBar, [0, 150]);
    const ownedCount = revealedUpgrades(s).filter((d) => hasUpgrade(s, d.id)).length;
    this.statusTextAt(0).text = `${GLOBAL_UPGRADES.length} upgrades · ${ownedCount} owned`;
    this.statusTextAt(0).position.set(panels[0].x + 4, panels[0].y + Math.floor(panels[0].h / 2));
    this.statusTextAt(1).text = `Salvage ${formatNumber(s.economy.salvage)}`;
    this.statusTextAt(1).position.set(panels[1].x + 4, panels[1].y + Math.floor(panels[1].h / 2));
    for (let i = 2; i < this.statusTexts.length; i++) this.statusTexts[i].text = '';
  }
}

function drawToolbarGlyph(g: Graphics, id: 'buy' | 'info' | 'scroll', r: Rect, color: number): void {
  const cx = r.x + Math.floor(r.w / 2);
  const cy = r.y + Math.floor(r.h / 2);
  if (id === 'buy') {
    g.rect(cx - 7, cy - 4, 10, 8).stroke({ width: 1, color });
    g.moveTo(cx + 2, cy + 4).lineTo(cx - 6, cy + 7).lineTo(cx - 6, cy + 4).stroke({ width: 1, color });
    g.circle(cx + 2, cy + 7, 1).fill(color);
    g.circle(cx - 5, cy + 9, 1).fill(color);
  } else if (id === 'info') {
    g.circle(cx, cy, 7).stroke({ width: 1, color });
    g.rect(cx - 1, cy - 4, 2, 3).fill(color);
    g.rect(cx - 1, cy + 1, 2, 2).fill(color);
  } else {
    g.poly([cx, cy + 6, cx - 6, cy - 2, cx + 6, cy - 2]).fill(color);
  }
}
