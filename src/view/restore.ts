import { Container, Graphics, Text } from 'pixi.js';
import {
  bevel,
  computeListView,
  computeStatusBar,
  computeTabStrip,
  CONTROL_BOX_H,
  CONTROL_BOX_W,
  dottedLine,
  drawListView,
  drawStatusBar,
  drawTabStrip,
  drawWindowChrome,
  FONT,
  FONT_SIZE,
  PAL,
  TAB_H,
  TITLE_H,
  pointInRect,
  type Layout,
  type ListColumn,
  type Rect,
  type StatusPanel,
} from './chrome.ts';
import {
  canBuy,
  hasNode,
  TIER_UNLOCK_LEVEL,
  treeTierUnlocked,
  TREE_NODES,
  visibleNodes,
  type TreeNode,
} from '../core/tree.ts';
import { SPEC_CAPS, SPEC_KINDS, SPEC_NAMES, specLevelCost, specEffectText, type Profile, type SpecKind, type SpecLevels } from '../core/save.ts';
import { restartPointsGained, type RunState } from '../core/state.ts';
import { t } from '../i18n/index.ts';
import { formatNumber } from '../core/format.ts';
import { mirrorIfRtl, textX } from './direction.ts';
import { TOOLTIP_BLUE, type TooltipLine } from './tooltipText.ts';

/**
 * The Restore dialog (docs/VISUAL-PASS.md §3): a System Properties property sheet, 620 x 420, with
 * three tabs — Restore Point (payout text, a Restart Windows button and a segmented progress bar),
 * Specs (a list view with steppers) and Tree (a tree control with expanders, guide lines and node
 * checkboxes) — plus Apply/Close and a status bar. Changes are staged in a draft and committed on
 * Apply, so the underlying buy functions and the save format are untouched.
 */

export const RESTORE_W = 620;
export const RESTORE_H = 420;
const BUTTON_W = 84;
const BUTTON_H = 28;
const TREE_ROW_H = 20;

export type RestoreTab = 'restore' | 'specs' | 'tree';

/** Progress toward the next Restore Point, from the run's lifetime salvage (docs/design.md §12.1). */
export function restoreProgress(s: RunState): { points: number; pointsNeeded: number; fill: number } {
  const raw = 2.2 * Math.sqrt(Math.max(0, s.economy.earned) / 900);
  const points = raw - Math.floor(raw);
  const pointsNeeded = 1;
  return { points, pointsNeeded, fill: points / pointsNeeded };
}

/** The payout sentence for the Restore Point tab, with the live numbers. */
export function restorePayoutText(s: RunState, profile: Profile): string {
  return t('dlg.restore.payout', { points: restartPointsGained(s, profile) });
}

export interface RestoreSpecRow {
  kind: SpecKind;
  level: number;
  cap: number;
  baseLevel: number;
  canInc: boolean;
  canDec: boolean;
  rect: Rect;
  stepper: { minus: Rect; value: Rect; plus: Rect };
}

export interface RestoreButton {
  id: 'restart' | 'apply' | 'close';
  label: string;
  rect: Rect;
  /** The default button carries the 1 px dotted focus ring. */
  default: boolean;
}

export interface RestoreTreeRow {
  kind: 'tier' | 'node';
  tier: number;
  node: TreeNode | null;
  rect: Rect;
  expander: Rect | null;
  checkbox: Rect | null;
  owned: boolean;
  canBuy: boolean;
  expanded: boolean;
  locked: boolean;
  label: string;
  price: string;
}

/** Indents that keep a tree row's text clear of its expander, checkbox and guide line. */
const TREE_TIER_TEXT_X = 26;
const TREE_NODE_TEXT_X = 46;
const TREE_PRICE_TEXT_INSET = 6;

/** The horizontal text anchor for each tree row field (docs/TREE-TEXT-ANCHORS.md §The fix). */
export const TREE_TEXT_ANCHOR = { tier: 0, node: 0, price: 1 } as const;

/** The x of a tree row's label: tier headers sit 26 px in, node names 46 px in. */
export function treeRowTextX(row: RestoreTreeRow): number {
  return row.rect.x + (row.kind === 'tier' ? TREE_TIER_TEXT_X : TREE_NODE_TEXT_X);
}

/** The x of a tree row's price, right-aligned (anchor 1) 6 px inside the row. */
export function treePriceTextX(row: RestoreTreeRow): number {
  return row.rect.x + row.rect.w - TREE_PRICE_TEXT_INSET;
}

/**
 * Tooltip lines for a tree node row: the name as a blue header, the description, then the Restore
 * Point price — or `Owned` once the profile already owns the node. Pixi-free so the smoke harness can
 * assert it (docs/TREE-TOOLTIPS.md).
 */
export function treeNodeTooltipLines(node: TreeNode, profile: Profile): TooltipLine[] {
  const owned = hasNode(profile, node.id);
  return [
    [{ text: node.name, color: TOOLTIP_BLUE }],
    node.description,
    owned ? t('dlg.upgrades.rowOwned') : t('dlg.restore.treeCost', { cost: formatNumber(node.cost) }),
  ];
}

export interface RestoreLayout {
  window: Rect;
  titleBar: Rect;
  close: Rect;
  tabStrip: Rect;
  tabs: { id: RestoreTab; label: string; rect: Rect; active: boolean }[];
  tabBody: Rect;
  payout: Rect;
  progress: { rect: Rect; fill: number; points: number; pointsNeeded: number };
  specsField: Rect;
  specs: ListColumn[];
  specRows: RestoreSpecRow[];
  treeRows: RestoreTreeRow[];
  buttons: RestoreButton[];
  statusBar: Rect;
  status: StatusPanel[];
}

export function computeRestoreLayout(l: Layout, profile: Profile, s: RunState, session: RestoreSession): RestoreLayout {
  const w = Math.min(RESTORE_W, l.client.w - 40);
  const h = Math.min(RESTORE_H, l.client.h - 16);
  const window: Rect = {
    x: l.client.x + Math.floor((l.client.w - w) / 2),
    y: l.client.y + Math.floor((l.client.h - h) / 2),
    w,
    h,
  };
  const titleBar: Rect = { x: window.x + 2, y: window.y + 2, w: w - 4, h: TITLE_H };
  const close: Rect = mirrorIfRtl({
    x: titleBar.x + titleBar.w - 2 - CONTROL_BOX_W,
    y: titleBar.y + Math.floor((TITLE_H - CONTROL_BOX_H) / 2),
    w: CONTROL_BOX_W,
    h: CONTROL_BOX_H,
  }, titleBar);

  const tabStrip: Rect = { x: window.x + 2, y: titleBar.y + titleBar.h, w: w - 4, h: TAB_H };
  const tabLabels = [t('dlg.restore.tabRestore'), t('dlg.restore.tabSpecs'), t('dlg.restore.tabTree')];
  const activeIdx = session.tab === 'restore' ? 0 : session.tab === 'specs' ? 1 : 2;
  const tabs = computeTabStrip(tabStrip, tabLabels, activeIdx).map((t, i) => ({
    id: (i === 0 ? 'restore' : i === 1 ? 'specs' : 'tree') as RestoreTab,
    label: t.label,
    rect: { x: t.x, y: t.y, w: t.w, h: t.h },
    active: t.active,
  }));

  const statusBar: Rect = { x: window.x + 2, y: window.y + h - 2 - 22, w: w - 4, h: 22 };
  const status = computeStatusBar(statusBar, [0, 130]);
  const buttonRowY = statusBar.y - 8 - BUTTON_H;
  const cancel: Rect = { x: statusBar.x + statusBar.w - BUTTON_W - 6, y: buttonRowY, w: BUTTON_W, h: BUTTON_H };
  const apply: Rect = { x: cancel.x - BUTTON_W - 6, y: buttonRowY, w: BUTTON_W, h: BUTTON_H };

  const tabBody: Rect = { x: window.x + 8, y: tabStrip.y + TAB_H, w: w - 16, h: buttonRowY - 4 - (tabStrip.y + TAB_H) };

  // Restore Point tab.
  const payout: Rect = { x: tabBody.x, y: tabBody.y, w: tabBody.w, h: 34 };
  const restartButton: Rect = { x: tabBody.x, y: payout.y + payout.h + 10, w: 150, h: 32 };
  const buttons: RestoreButton[] = [
    { id: 'restart', label: t('dlg.restore.restart'), rect: restartButton, default: true },
    { id: 'apply', label: t('dlg.restore.apply'), rect: mirrorIfRtl(apply, window), default: false },
    { id: 'close', label: t('dlg.restore.close'), rect: mirrorIfRtl(cancel, window), default: false },
  ];
  const prog = restoreProgress(s);
  const progress = { rect: { x: tabBody.x, y: restartButton.y + restartButton.h + 16, w: tabBody.w - 40, h: 14 }, ...prog };

  // Specs tab.
  const specsField: Rect = { x: tabBody.x, y: tabBody.y, w: tabBody.w, h: tabBody.h };
  const specs: ListColumn[] = [
    { title: t('dlg.restore.colName'), w: 110 },
    { title: t('dlg.restore.colLevel'), w: 100 },
    { title: t('dlg.restore.colEffect'), w: 220 },
  ];
  const specGeom = computeListView(specsField, specs, 24, SPEC_KINDS.length, 0);
  const specColX = specGeom.colX;
  const specRows: RestoreSpecRow[] = SPEC_KINDS.map((kind, i) => {
    const level = session.draftSpecs[kind];
    const cap = SPEC_CAPS[kind];
    const baseLevel = profile.specs[kind];
    const rect: Rect = { x: specGeom.body.x, y: specGeom.body.y + i * 24, w: specGeom.body.w, h: 24 };
    const cost = level < cap ? specLevelCost(level) : Infinity;
    const canInc = level < cap && session.draftRp(profile) >= cost;
    const canDec = level > baseLevel;
    const minus: Rect = { x: specColX[1] + 4, y: rect.y + 2, w: 18, h: 20 };
    const value: Rect = { x: minus.x + 20, y: rect.y + 2, w: 40, h: 20 };
    const plus: Rect = { x: value.x + value.w + 2, y: rect.y + 2, w: 18, h: 20 };
    const stepper = { minus, value, plus };
    return { kind, level, cap, baseLevel, canInc, canDec, rect, stepper };
  });

  // Tree tab.
  const treeRows = buildTreeRows(tabBody, profile, session);

  return { window, titleBar, close, tabStrip, tabs, tabBody, payout, progress, specsField, specs, specRows, treeRows, buttons, statusBar, status };
}

function buildTreeRows(area: Rect, profile: Profile, session: RestoreSession): RestoreTreeRow[] {
  const rows: RestoreTreeRow[] = [];
  const nodes = visibleNodes(profile);
  let y = area.y + 4;
  for (let tier = 1; tier <= 5; tier++) {
    const unlocked = treeTierUnlocked(profile.rpEarned, tier as 1 | 2 | 3 | 4 | 5);
    const tierNodes = nodes.filter((n) => n.tier === tier);
    const expanded = session.expanded === tier;
    const tierRect: Rect = { x: area.x, y, w: area.w, h: TREE_ROW_H };
    const expander: Rect = { x: area.x + 4, y: y + 2, w: 16, h: 16 };
    rows.push({ kind: 'tier', tier, node: null, rect: tierRect, expander, checkbox: null, owned: false, canBuy: false, expanded, locked: !unlocked, label: t('dlg.restore.tier', { tier }), price: '' });
    y += TREE_ROW_H;
    if (expanded) {
      for (const node of tierNodes) {
        const rect: Rect = { x: area.x, y, w: area.w, h: TREE_ROW_H };
        const owned = session.draftTree.includes(node.id);
        const buyable = canBuy({ ...profile, tree: session.draftTree, rp: session.draftRp(profile) }, node);
        const checkbox: Rect = { x: area.x + 28, y: y + 4, w: 12, h: 12 };
        rows.push({ kind: 'node', tier, node, rect, expander: null, checkbox, owned, canBuy: buyable, expanded: false, locked: false, label: node.name, price: formatNumber(node.cost) });
        y += TREE_ROW_H;
      }
    }
  }
  return rows;
}

export type RestoreHit =
  | { type: 'close' }
  | { type: 'tab'; tab: RestoreTab }
  | { type: 'restart' }
  | { type: 'spec-minus'; kind: SpecKind }
  | { type: 'spec-plus'; kind: SpecKind }
  | { type: 'node'; id: string }
  | { type: 'tier'; tier: number }
  | { type: 'apply' }
  | { type: 'close-button' }
  | null;

export function restoreHitAt(rl: RestoreLayout, x: number, y: number): RestoreHit {
  if (!pointInRect(rl.window, x, y)) return null;
  if (pointInRect(rl.close, x, y)) return { type: 'close' };
  for (const t of rl.tabs) {
    if (pointInRect(t.rect, x, y)) return { type: 'tab', tab: t.id };
  }
  for (const b of rl.buttons) {
    if (b.id === 'restart') {
      if (rl.tabs[0].active && pointInRect(b.rect, x, y)) return { type: 'restart' };
    } else if (pointInRect(b.rect, x, y)) {
      return b.id === 'apply' ? { type: 'apply' } : { type: 'close-button' };
    }
  }
  if (rl.tabs[1].active) {
    for (const row of rl.specRows) {
      if (pointInRect(row.stepper.minus, x, y)) return { type: 'spec-minus', kind: row.kind };
      if (pointInRect(row.stepper.plus, x, y)) return { type: 'spec-plus', kind: row.kind };
    }
  }
  if (rl.tabs[2].active) {
    for (const row of rl.treeRows) {
      if (row.kind === 'tier' && row.expander && pointInRect(row.expander, x, y)) return { type: 'tier', tier: row.tier };
      if (row.kind === 'node' && pointInRect(row.rect, x, y)) return { type: 'node', id: row.node!.id };
    }
  }
  return null;
}

/** True once the draft differs from the profile (so Apply is enabled). */
export function restoreDirty(session: RestoreSession, profile: Profile): boolean {
  for (const k of SPEC_KINDS) if (session.draftSpecs[k] !== profile.specs[k]) return true;
  if (session.draftTree.length !== profile.tree.length) return true;
  for (const id of profile.tree) if (!session.draftTree.includes(id)) return true;
  return false;
}

export class RestoreSession {
  open = false;
  tab: RestoreTab = 'restore';
  expanded: number | null = 1;
  draftSpecs: SpecLevels = { cpu: 0, ram: 0, gpu: 0, disk: 0 };
  draftTree: string[] = [];

  show(profile: Profile): void {
    this.open = true;
    this.tab = 'restore';
    this.expanded = 1;
    this.draftSpecs = { cpu: profile.specs.cpu, ram: profile.specs.ram, gpu: profile.specs.gpu, disk: profile.specs.disk };
    this.draftTree = [...profile.tree];
  }

  hide(): void {
    this.open = false;
  }

  setTab(tab: RestoreTab): void {
    this.tab = tab;
  }

  /** The draft's spendable RP: profile.rp minus what the draft has already committed. */
  draftRp(profile: Profile): number {
    let spent = 0;
    for (const k of SPEC_KINDS) {
      const base = profile.specs[k];
      const cur = this.draftSpecs[k];
      for (let level = base; level < cur; level++) spent += specLevelCost(level);
    }
    for (const id of this.draftTree) {
      if (!profile.tree.includes(id)) {
        const node = TREE_NODE_BY_ID.get(id);
        if (node) spent += node.cost;
      }
    }
    return Math.max(0, profile.rp - spent);
  }

  toggleNode(id: string, profile: Profile): void {
    if (this.draftTree.includes(id)) {
      if (!profile.tree.includes(id)) this.draftTree = this.draftTree.filter((n) => n !== id);
      return;
    }
    const node = TREE_NODE_BY_ID.get(id);
    if (!node) return;
    const buyable = canBuy({ ...profile, tree: this.draftTree, rp: this.draftRp(profile) }, node);
    if (buyable) this.draftTree = [...this.draftTree, id];
  }

  incSpec(kind: SpecKind, profile: Profile): void {
    const level = this.draftSpecs[kind];
    if (level >= SPEC_CAPS[kind]) return;
    if (this.draftRp(profile) < specLevelCost(level)) return;
    this.draftSpecs = { ...this.draftSpecs, [kind]: level + 1 };
  }

  decSpec(kind: SpecKind, profile: Profile): void {
    if (this.draftSpecs[kind] <= profile.specs[kind]) return;
    this.draftSpecs = { ...this.draftSpecs, [kind]: this.draftSpecs[kind] - 1 };
  }
}

const TREE_NODE_BY_ID: ReadonlyMap<string, TreeNode> = new Map(TREE_NODES.map((n) => [n.id, n]));

function makeText(text: string, size: number, bold = false, fill: number): Text {
  return new Text({
    text,
    style: { fontFamily: FONT, fontSize: size, fill, fontWeight: bold ? 'bold' : 'normal' },
  });
}

export class RestoreView {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly titleText: Text;
  private readonly payoutText: Text;
  private readonly restartText: Text;
  private readonly progressText: Text;
  private readonly applyText: Text;
  private readonly cancelText: Text;
  private readonly rows: Text[] = [];
  private readonly tabTexts: Text[] = [];
  private readonly statusTexts: Text[] = [];

  constructor() {
    this.titleText = makeText(t('dlg.restore.title'), FONT_SIZE.body, true, PAL.titleInverse);
    this.titleText.anchor.set(0, 0.5);
    this.payoutText = makeText('', FONT_SIZE.small, false, PAL.text);
    this.payoutText.anchor.set(0, 0.5);
    this.restartText = makeText(t('dlg.restore.restart'), FONT_SIZE.body, true, PAL.text);
    this.restartText.anchor.set(0.5, 0.5);
    this.progressText = makeText('', FONT_SIZE.small, false, PAL.text);
    this.progressText.anchor.set(0, 0.5);
    this.applyText = makeText(t('dlg.restore.apply'), FONT_SIZE.body, false, PAL.text);
    this.applyText.anchor.set(0.5, 0.5);
    this.cancelText = makeText(t('dlg.restore.close'), FONT_SIZE.body, false, PAL.text);
    this.cancelText.anchor.set(0.5, 0.5);
    this.root.addChild(this.g, this.titleText, this.payoutText, this.restartText, this.progressText, this.applyText, this.cancelText);
    for (let i = 0; i < 40; i++) {
      const t = makeText('', FONT_SIZE.small, false, PAL.text);
      t.anchor.set(0, 0.5);
      this.rows.push(t);
      this.root.addChild(t);
    }
    for (let i = 0; i < 2; i++) {
      const t = makeText('', FONT_SIZE.small, false, PAL.text);
      t.anchor.set(0, 0.5);
      this.statusTexts.push(t);
      this.root.addChild(t);
    }
  }

  private rowTextAt(index: number): Text {
    let t = this.rows[index];
    if (!t) {
      t = makeText('', FONT_SIZE.small, false, PAL.text);
      t.anchor.set(0, 0.5);
      this.rows.push(t);
      this.root.addChild(t);
    }
    return t;
  }

  private tabTextAt(index: number): Text {
    let t = this.tabTexts[index];
    if (!t) {
      t = makeText('', FONT_SIZE.small, false, PAL.text);
      t.anchor.set(0.5, 0.5);
      this.tabTexts.push(t);
      this.root.addChild(t);
    }
    return t;
  }

  draw(open: boolean, profile: Profile, s: RunState, l: Layout, session: RestoreSession): void {
    const g = this.g;
    g.clear();
    if (!open) {
      this.titleText.text = '';
      this.payoutText.text = '';
      this.restartText.text = '';
      this.progressText.text = '';
      this.applyText.text = '';
      this.cancelText.text = '';
      for (const t of this.rows) t.text = '';
      for (const t of this.tabTexts) t.text = '';
      for (const t of this.statusTexts) t.text = '';
      return;
    }

    const rl = computeRestoreLayout(l, profile, s, session);
    drawWindowChrome(g, rl.window, { close: true, minimize: false, maximize: false });
    this.titleText.text = t('dlg.restore.title');
    const tp = textX(rl.titleBar, 'start');
    this.titleText.anchor.x = tp.anchor;
    this.titleText.position.set(tp.x, rl.titleBar.y + TITLE_H / 2);

    drawTabStrip(g, rl.tabStrip, [t('dlg.restore.tabRestore'), t('dlg.restore.tabSpecs'), t('dlg.restore.tabTree')], session.tab === 'restore' ? 0 : session.tab === 'specs' ? 1 : 2);
    for (let i = 0; i < rl.tabs.length; i++) {
      const t = this.tabTextAt(i);
      const tab = rl.tabs[i];
      t.text = tab.label;
      t.style.fill = tab.active ? PAL.text : PAL.shadow;
      t.position.set(tab.rect.x + tab.rect.w / 2, tab.rect.y + tab.rect.h / 2);
    }
    for (let i = rl.tabs.length; i < this.tabTexts.length; i++) this.tabTexts[i].text = '';

    if (session.tab === 'restore') {
      for (const t of this.rows) t.text = '';
      this.drawRestoreTab(g, rl, profile, s);
    } else if (session.tab === 'specs') {
      this.clearRestoreTabTexts();
      this.drawSpecsTab(g, rl);
    } else {
      this.clearRestoreTabTexts();
      this.drawTreeTab(g, rl);
    }

    // Apply / Close.
    const dirty = restoreDirty(session, profile);
    const applyBtn = rl.buttons.find((b) => b.id === 'apply')!;
    const closeBtn = rl.buttons.find((b) => b.id === 'close')!;
    if (dirty) bevel(g, applyBtn.rect, true, PAL.face);
    else {
      g.rect(applyBtn.rect.x, applyBtn.rect.y, applyBtn.rect.w, applyBtn.rect.h).fill(PAL.face);
      g.rect(applyBtn.rect.x, applyBtn.rect.y, applyBtn.rect.w, applyBtn.rect.h).stroke({ width: 1, color: PAL.shadow });
    }
    bevel(g, closeBtn.rect, true, PAL.face);
    this.applyText.text = applyBtn.label;
    this.applyText.style.fill = dirty ? PAL.text : PAL.shadow;
    this.applyText.position.set(applyBtn.rect.x + applyBtn.rect.w / 2, applyBtn.rect.y + applyBtn.rect.h / 2);
    this.cancelText.text = closeBtn.label;
    this.cancelText.position.set(closeBtn.rect.x + closeBtn.rect.w / 2, closeBtn.rect.y + closeBtn.rect.h / 2);

    // Status bar.
    const panels = drawStatusBar(g, rl.statusBar, [0, 130]);
    const totalSpecs = SPEC_KINDS.reduce((sum, k) => sum + profile.specs[k], 0);
    const totalCap = SPEC_KINDS.reduce((sum, k) => sum + SPEC_CAPS[k], 0);
    this.statusTexts[0].text = t('dlg.restore.statusRp', { rp: profile.rp });
    this.statusTexts[0].position.set(panels[0].x + 4, panels[0].y + Math.floor(panels[0].h / 2));
    this.statusTexts[1].text = t('dlg.restore.statusSpecs', { total: totalSpecs, cap: totalCap });
    this.statusTexts[1].position.set(panels[1].x + 4, panels[1].y + Math.floor(panels[1].h / 2));
  }

  private clearRestoreTabTexts(): void {
    this.payoutText.text = '';
    this.restartText.text = '';
    this.progressText.text = '';
  }

  private drawRestoreTab(g: Graphics, rl: RestoreLayout, profile: Profile, s: RunState): void {
    bevel(g, rl.payout, false, PAL.face);
    this.payoutText.text = restorePayoutText(s, profile);
    this.payoutText.position.set(rl.payout.x + 6, rl.payout.y + Math.floor(rl.payout.h / 2));

    const restartBtn = rl.buttons.find((b) => b.id === 'restart')!;
    bevel(g, restartBtn.rect, true, PAL.face);
    dottedLine(g, restartBtn.rect.x + 3, restartBtn.rect.y + 3, restartBtn.rect.x + restartBtn.rect.w - 3, restartBtn.rect.y + 3, PAL.dark);
    dottedLine(g, restartBtn.rect.x + restartBtn.rect.w - 3, restartBtn.rect.y + 3, restartBtn.rect.x + restartBtn.rect.w - 3, restartBtn.rect.y + restartBtn.rect.h - 3, PAL.dark);
    dottedLine(g, restartBtn.rect.x + restartBtn.rect.w - 3, restartBtn.rect.y + restartBtn.rect.h - 3, restartBtn.rect.x + 3, restartBtn.rect.y + restartBtn.rect.h - 3, PAL.dark);
    dottedLine(g, restartBtn.rect.x + 3, restartBtn.rect.y + restartBtn.rect.h - 3, restartBtn.rect.x + 3, restartBtn.rect.y + 3, PAL.dark);
    this.restartText.text = restartBtn.label;
    this.restartText.position.set(restartBtn.rect.x + restartBtn.rect.w / 2, restartBtn.rect.y + restartBtn.rect.h / 2);

    this.progressText.text = t('dlg.restore.progress');
    this.progressText.position.set(rl.progress.rect.x, rl.progress.rect.y - 16);
    drawSegmentedBar(g, rl.progress.rect, rl.progress.fill);
  }

  private drawSpecsTab(g: Graphics, rl: RestoreLayout): void {
    drawListView(g, rl.specsField, rl.specs, 24, rl.specRows.length, -1, 0);
    // The column positions mirror the LTR layout in RTL, so the text and the list separators agree.
    const colX = computeListView(rl.specsField, rl.specs, 24, rl.specRows.length, 0).colX;
    let ti = 0;
    for (let i = 0; i < rl.specs.length; i++) {
      const t = this.rowTextAt(ti++);
      t.text = rl.specs[i].title;
      t.style.fontWeight = 'bold';
      const hp = textX({ x: colX[i], y: 0, w: rl.specs[i].w, h: 0 }, 'start', 4);
      t.anchor.x = hp.anchor;
      t.position.set(hp.x, rl.specsField.y + 2 + 9);
    }
    for (const row of rl.specRows) {
      const midY = row.rect.y + Math.floor(row.rect.h / 2);
      const name = this.rowTextAt(ti++);
      name.text = SPEC_NAMES[row.kind];
      name.style.fontWeight = 'bold';
      name.style.fill = PAL.text;
      name.anchor.x = 0;
      name.position.set(colX[0] + 4, midY);

      const levelText = this.rowTextAt(ti++);
      levelText.text = String(row.level);
      levelText.style.fontWeight = 'normal';
      levelText.style.fill = PAL.text;
      levelText.anchor.set(0.5, 0.5);
      levelText.position.set(row.stepper.value.x + row.stepper.value.w / 2, midY);

      const effect = this.rowTextAt(ti++);
      effect.text = specEffectText(row.kind, row.level);
      effect.style.fontWeight = 'normal';
      effect.style.fill = PAL.shadow;
      effect.anchor.x = 0;
      effect.position.set(colX[2] + 4, midY);

      drawStepper(g, row.stepper.minus, 'minus', row.canDec);
      drawStepper(g, row.stepper.plus, 'plus', row.canInc);
    }
    for (let i = ti; i < this.rows.length; i++) this.rows[i].text = '';
  }

  private drawTreeTab(g: Graphics, rl: RestoreLayout): void {
    let ti = 0;
    let guideX = rl.tabBody.x + 34;
    let firstNodeY = -1;
    let lastNodeY = -1;
    for (const row of rl.treeRows) {
      if (row.kind === 'tier') {
        const tierText = this.rowTextAt(ti++);
        tierText.text = row.locked
          ? t('dlg.restore.tierLocked', { tier: row.tier, level: TIER_UNLOCK_LEVEL[row.tier as 1 | 2 | 3 | 4 | 5] })
          : t('dlg.restore.tier', { tier: row.tier });
        tierText.style.fontWeight = 'bold';
        tierText.style.fill = row.locked ? PAL.shadow : PAL.title;
        tierText.anchor.set(TREE_TEXT_ANCHOR.tier, 0.5);
        tierText.position.set(treeRowTextX(row), row.rect.y + Math.floor(TREE_ROW_H / 2));
        const ex = row.expander!;
        bevel(g, ex, true, PAL.face);
        g.rect(ex.x, ex.y, ex.w, ex.h).stroke({ width: 1, color: PAL.dark });
        const cx = ex.x + ex.w / 2;
        const cy = ex.y + ex.h / 2;
        g.moveTo(cx - 4, cy).lineTo(cx + 4, cy).stroke({ width: 1, color: PAL.text });
        if (!row.expanded) g.moveTo(cx, cy - 4).lineTo(cx, cy + 4).stroke({ width: 1, color: PAL.text });
      } else {
        const node = row.node!;
        const cb = row.checkbox!;
        if (row.owned) {
          g.rect(cb.x, cb.y, cb.w, cb.h).fill(PAL.navy);
          g.rect(cb.x, cb.y, cb.w, cb.h).stroke({ width: 1, color: PAL.dark });
        } else {
          bevel(g, cb, false, PAL.highlight);
        }
        if (firstNodeY < 0) firstNodeY = cb.y + 6;
        lastNodeY = cb.y + 6;
        const t = this.rowTextAt(ti++);
        t.text = node.name;
        t.style.fontWeight = 'normal';
        t.style.fill = row.owned ? PAL.shadow : PAL.text;
        t.anchor.set(TREE_TEXT_ANCHOR.node, 0.5);
        t.position.set(treeRowTextX(row), row.rect.y + Math.floor(TREE_ROW_H / 2));
        const price = this.rowTextAt(ti++);
        price.text = row.price;
        price.style.fontWeight = 'normal';
        price.style.fill = row.canBuy ? PAL.text : PAL.shadow;
        price.anchor.set(TREE_TEXT_ANCHOR.price, 0.5);
        price.position.set(treePriceTextX(row), row.rect.y + Math.floor(TREE_ROW_H / 2));
      }
    }
    if (firstNodeY >= 0 && lastNodeY > firstNodeY) dottedLine(g, guideX, firstNodeY, guideX, lastNodeY, PAL.shadow);
    for (let i = ti; i < this.rows.length; i++) this.rows[i].text = '';
  }
}

function drawStepper(g: Graphics, r: Rect, kind: 'minus' | 'plus', enabled: boolean): void {
  if (enabled) bevel(g, r, true, PAL.face);
  else bevel(g, r, false, PAL.face);
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const color = enabled ? PAL.text : PAL.shadow;
  g.moveTo(cx - 4, cy).lineTo(cx + 4, cy).stroke({ width: 1, color });
  if (kind === 'plus') g.moveTo(cx, cy - 4).lineTo(cx, cy + 4).stroke({ width: 1, color });
}

/** A Win95 segmented progress bar: 8 px blocks with 2 px gaps, navy fill. */
function drawSegmentedBar(g: Graphics, r: Rect, fill: number): void {
  bevel(g, r, false, PAL.highlight);
  const block = 8;
  const gap = 2;
  const innerX = r.x + 2;
  const innerY = r.y + 2;
  const innerW = r.w - 4;
  const blocks = Math.max(0, Math.floor((innerW + gap) / (block + gap)));
  const filled = Math.round(fill * blocks);
  for (let i = 0; i < blocks; i++) {
    const x = innerX + i * (block + gap);
    if (i < filled) g.rect(x, innerY, block, r.h - 4).fill(PAL.navy);
  }
}
