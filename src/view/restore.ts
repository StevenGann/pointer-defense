import { Container, Graphics, Text } from 'pixi.js';
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
import {
  canBuy,
  hasNode,
  TIER_UNLOCK_LEVEL,
  visibleNodes,
  type TreeNode,
} from '../core/tree.ts';
import { SPEC_CAPS, SPEC_KINDS, SPEC_NAMES, specLevelCost, type Profile, type SpecKind } from '../core/save.ts';
import { formatNumber } from '../core/format.ts';

/**
 * The Restore dialog: a Windows 95 window listing the five Restore-tree tiers plus the spec shop.
 * It mirrors the Help viewer's window chrome but is fixed (centred, not draggable). Buying a node or
 * a spec level is a button press; the model here is Pixi-free so the smoke harness could assert the
 * layout, but the run-time rendering is in `RestoreView`.
 */

export const RESTORE_W = 560;
const ROW_H = 18;
const SECTION_H = 18;
const HEADER_H = 20;
const PAD = 10;
const BUY_W = 64;

export interface RestoreNodeRow {
  node: TreeNode;
  owned: boolean;
  canBuy: boolean;
  rect: Rect;
  buy: Rect;
}

export interface RestoreSpecRow {
  kind: SpecKind;
  level: number;
  cap: number;
  canBuy: boolean;
  rect: Rect;
  buy: Rect;
}

export interface RestoreLayout {
  window: Rect;
  title: Rect;
  close: Rect;
  header: Rect;
  tiers: { tier: number; header: Rect }[];
  nodes: RestoreNodeRow[];
  specsHeader: Rect;
  specs: RestoreSpecRow[];
}

export function computeRestoreLayout(l: Layout, profile: Profile): RestoreLayout {
  const nodes = visibleNodes(profile);
  const tierCounts = new Map<number, number>();
  for (const n of nodes) tierCounts.set(n.tier, (tierCounts.get(n.tier) ?? 0) + 1);

  let contentH = HEADER_H;
  for (let tier = 1; tier <= 5; tier++) {
    contentH += SECTION_H + (tierCounts.get(tier) ?? 0) * ROW_H;
  }
  contentH += SECTION_H + SPEC_KINDS.length * ROW_H;

  const h = Math.min(TITLE_H + contentH + PAD * 2, l.client.h - 16);
  const w = Math.min(RESTORE_W, l.client.w - 40);
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

  let cy = window.y + 2 + TITLE_H + PAD;
  const header: Rect = { x: window.x + PAD, y: cy, w: w - PAD * 2, h: HEADER_H };
  cy += HEADER_H;

  const tiers: { tier: number; header: Rect }[] = [];
  const nodeRows: RestoreNodeRow[] = [];
  for (let tier = 1; tier <= 5; tier++) {
    tiers.push({ tier, header: { x: window.x + PAD, y: cy, w: w - PAD * 2, h: SECTION_H } });
    cy += SECTION_H;
    for (const node of nodes) {
      if (node.tier !== tier) continue;
      const rect: Rect = { x: window.x + PAD, y: cy, w: w - PAD * 2, h: ROW_H };
      const buy: Rect = { x: rect.x + rect.w - BUY_W, y: rect.y + 1, w: BUY_W, h: ROW_H - 2 };
      nodeRows.push({
        node,
        owned: hasNode(profile, node.id),
        canBuy: canBuy(profile, node),
        rect,
        buy,
      });
      cy += ROW_H;
    }
  }

  const specsHeader: Rect = { x: window.x + PAD, y: cy, w: w - PAD * 2, h: SECTION_H };
  cy += SECTION_H;
  const specs: RestoreSpecRow[] = SPEC_KINDS.map((kind) => {
    const level = profile.specs[kind];
    const cap = SPEC_CAPS[kind];
    const rect: Rect = { x: window.x + PAD, y: cy, w: w - PAD * 2, h: ROW_H };
    const buy: Rect = { x: rect.x + rect.w - BUY_W, y: rect.y + 1, w: BUY_W, h: ROW_H - 2 };
    cy += ROW_H;
    return { kind, level, cap, canBuy: level < cap && profile.rp >= specLevelCost(level), rect, buy };
  });

  return { window, title, close, header, tiers, nodes: nodeRows, specsHeader, specs };
}

export type RestoreHit =
  | { type: 'close' }
  | { type: 'node'; id: string }
  | { type: 'spec'; kind: SpecKind }
  | null;

export function restoreHitAt(rl: RestoreLayout, x: number, y: number): RestoreHit {
  if (!pointInRect(rl.window, x, y)) return null;
  if (pointInRect(rl.close, x, y)) return { type: 'close' };
  for (const row of rl.nodes) {
    if (row.canBuy && pointInRect(row.buy, x, y)) return { type: 'node', id: row.node.id };
  }
  for (const row of rl.specs) {
    if (row.canBuy && pointInRect(row.buy, x, y)) return { type: 'spec', kind: row.kind };
  }
  return null;
}

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
  private readonly headerText: Text;
  private readonly rows: Text[] = [];

  constructor() {
    this.titleText = makeText('Restore', FONT_SIZE.body, true, PAL.titleInverse);
    this.titleText.anchor.set(0, 0.5);
    this.headerText = makeText('', FONT_SIZE.body, true, PAL.text);
    this.headerText.anchor.set(0, 0.5);
    this.root.addChild(this.g, this.titleText, this.headerText);
    // A generous pool, grown on demand exactly as the Help viewer grows its tree/body rows.
    for (let i = 0; i < 40; i++) {
      const t = makeText('', FONT_SIZE.small, false, PAL.text);
      t.anchor.set(0, 0.5);
      this.rows.push(t);
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

  draw(open: boolean, profile: Profile, l: Layout): void {
    const g = this.g;
    g.clear();
    if (!open) {
      this.titleText.text = '';
      this.headerText.text = '';
      for (const t of this.rows) t.text = '';
      return;
    }

    const rl = computeRestoreLayout(l, profile);

    bevel(g, rl.window, true, PAL.face);
    g.rect(rl.title.x, rl.title.y, rl.title.w, rl.title.h).fill(PAL.title);
    this.titleText.text = 'Restore';
    this.titleText.position.set(rl.title.x + 6, rl.title.y + 2 + TITLE_H / 2);

    // Close box glyph.
    bevel(g, rl.close, true, PAL.face);
    const cx = rl.close.x + Math.floor(rl.close.w / 2);
    const cy = rl.close.y + Math.floor(rl.close.h / 2);
    g.moveTo(cx - 4, cy - 4).lineTo(cx + 4, cy + 4).stroke({ width: 1, color: PAL.text });
    g.moveTo(cx + 4, cy - 4).lineTo(cx - 4, cy + 4).stroke({ width: 1, color: PAL.text });

    this.headerText.text = `Restore Points: ${profile.rp}   Level: ${profile.rpEarned}`;
    this.headerText.position.set(rl.header.x, rl.header.y + Math.floor(rl.header.h / 2));

    let rowIndex = 0;
    for (const tier of rl.tiers) {
      const t = this.rowTextAt(rowIndex++);
      t.text = `Tier ${tier.tier} — unlocks at level ${TIER_UNLOCK_LEVEL[tier.tier as 1 | 2 | 3 | 4 | 5]}`;
      t.style.fill = PAL.title;
      t.style.fontWeight = 'bold';
      t.position.set(tier.header.x, tier.header.y + Math.floor(tier.header.h / 2));
    }

    for (const row of rl.nodes) {
      const t = this.rowTextAt(rowIndex++);
      const locked = !hasNode(profile, row.node.id) && row.node.unlockLevel > profile.rpEarned;
      const owned = row.owned;
      const label = `${row.node.name} — ${row.node.description}`;
      t.text = label;
      t.style.fill = owned || locked ? PAL.shadow : PAL.text;
      t.style.fontWeight = 'normal';
      t.position.set(row.rect.x + 2, row.rect.y + Math.floor(row.rect.h / 2));

      const bt = this.rowTextAt(rowIndex++);
      const unlocked = !locked;
      if (owned) {
        bt.text = 'OWNED';
        bt.style.fill = PAL.shadow;
      } else if (unlocked && row.canBuy) {
        bt.text = `Buy $${formatNumber(row.node.cost)}`;
        bt.style.fill = PAL.text;
        drawBuy(g, row.buy);
      } else {
        bt.text = `Buy $${formatNumber(row.node.cost)}`;
        bt.style.fill = PAL.shadow;
        drawDisabled(g, row.buy);
      }
      bt.anchor.set(0.5, 0.5);
      bt.position.set(row.buy.x + row.buy.w / 2, row.buy.y + Math.floor(row.buy.h / 2));
    }

    const sh = this.rowTextAt(rowIndex++);
    sh.text = 'SPECS';
    sh.style.fill = PAL.title;
    sh.style.fontWeight = 'bold';
    sh.position.set(rl.specsHeader.x, rl.specsHeader.y + Math.floor(rl.specsHeader.h / 2));

    for (const row of rl.specs) {
      const t = this.rowTextAt(rowIndex++);
      const capped = row.level >= row.cap;
      const cost = capped ? 0 : specLevelCost(row.level);
      const label = `${SPEC_NAMES[row.kind]} ${row.level}/${row.cap}${capped ? '' : ` — next ${cost} RP`}`;
      t.text = label;
      t.style.fill = capped ? PAL.shadow : PAL.text;
      t.style.fontWeight = 'normal';
      t.position.set(row.rect.x + 2, row.rect.y + Math.floor(row.rect.h / 2));

      const bt = this.rowTextAt(rowIndex++);
      if (capped) {
        bt.text = 'FULL';
        bt.style.fill = PAL.shadow;
      } else if (row.canBuy) {
        bt.text = 'Buy';
        bt.style.fill = PAL.text;
        drawBuy(g, row.buy);
      } else {
        bt.text = 'Buy';
        bt.style.fill = PAL.shadow;
        drawDisabled(g, row.buy);
      }
      bt.anchor.set(0.5, 0.5);
      bt.position.set(row.buy.x + row.buy.w / 2, row.buy.y + Math.floor(row.buy.h / 2));
    }

    for (let i = rowIndex; i < this.rows.length; i++) this.rows[i].text = '';
  }
}

function drawBuy(g: Graphics, r: Rect): void {
  bevel(g, r, true, PAL.face);
}

function drawDisabled(g: Graphics, r: Rect): void {
  g.rect(r.x, r.y, r.w, r.h).fill(PAL.face);
  g.rect(r.x, r.y, r.w, r.h).stroke({ width: 1, color: PAL.shadow });
}
