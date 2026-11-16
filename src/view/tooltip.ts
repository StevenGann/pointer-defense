import { Container, Graphics, Text } from 'pixi.js';
import { FONT } from './chrome.ts';
import { effectiveStats, sellValue, TOWER_STATS, type Tower, type TowerKind } from '../core/towers.ts';
import { formatNumber } from '../core/format.ts';
import { TICK_HZ } from '../core/time.ts';
import { BRANCH_NAMES, TARGET_LABEL } from './hud.ts';

/**
 * Windows 95 tooltips, drawn as Pixi objects in the same scene (no DOM).
 *
 * The HUD and board report what is under the pointer each frame; this module owns the hover delay
 * (so a tooltip never flickers while the pointer crosses the screen), the follow/flip placement,
 * and the drawing. It never participates in hit-testing, so tooltips cannot intercept input.
 */

const FILL = 0xffffe1;
const TEXT_COLOR = 0x000000;
const HOVER_DELAY_MS = 250;
const OFFSET = 14;
const PAD_X = 6;
const PAD_Y = 4;

/** Shots per second for a fire interval, or an em-dash for towers that never fire. */
function rateText(fireInterval: number): string {
  return fireInterval > 0 ? `${(TICK_HZ / fireInterval).toFixed(1)}/s` : '—';
}

/** The traverse line: instant towers need no aiming, traversing towers name their rate. */
function turnText(turnRate: number): string {
  return turnRate <= 0 ? 'Turns instantly' : `Turns ${turnRate}°/s`;
}

/** The named special traits on a tower's stats (docs/design.md §6.1). */
function traits(st: {
  ignoresArmour: boolean;
  splash: number;
  slowFactor: number;
  pierce: number;
  auraDamage: number;
  auraRange: number;
}): string[] {
  const out: string[] = [];
  if (st.ignoresArmour) out.push('ignores armour');
  if (st.splash > 0) out.push('splash');
  if (st.slowFactor < 1) out.push('slow');
  if (st.pierce > 0) out.push('pierce');
  if (st.auraDamage > 0 || st.auraRange > 0) out.push('aura');
  return out;
}

/** Tooltip lines for a build-palette button (the tower's base, un-upgraded stats). */
export function paletteTooltipLines(kind: TowerKind): string[] {
  const b = TOWER_STATS[kind];
  const name = `${b.name}  $${formatNumber(b.cost)}`;
  if (kind === 'wall') {
    return [name, b.blurb, 'Blocks the route · 60 HP', 'Upgrades add hit points'];
  }
  const stats = b.fireInterval > 0
    ? `Range ${b.range.toFixed(1)} · Damage ${b.damage} · ${rateText(b.fireInterval)}`
    : `Range ${b.range.toFixed(1)} · Damage ${b.damage}`;
  const list = traits(b);
  const traitsLine = list.length > 0 ? `Traits: ${list.join(', ')}` : 'Traits: none';
  return [name, b.blurb, stats, traitsLine, turnText(b.turnRate)];
}

/** Tooltip lines for a placed tower: its live stats with aura bonuses, as the sim sees them. */
export function towerTooltipLines(tower: Tower): string[] {
  const branch = tower.branch === null ? '' : ` — ${BRANCH_NAMES[tower.kind][tower.branch]}`;
  const name = `${TOWER_STATS[tower.kind].name} T${tower.tier}${branch}`;

  if (tower.kind === 'wall') {
    const hp = tower.branch === null ? `HP ${Math.ceil(tower.hp)}` : `HP ${Math.ceil(tower.hp)}/${tower.maxHp}`;
    const blocks = tower.branch === 'B' ? 'Blocks ground and flyers' : 'Blocks ground only';
    return [name, hp, blocks, `Sell $${formatNumber(sellValue(tower))}`];
  }

  const st = effectiveStats(tower);
  const damage = st.damage * tower.auraDamage;
  const range = st.range + tower.auraRange;
  const firing = st.fireInterval > 0;
  const rate = firing ? TICK_HZ / st.fireInterval : 0;
  const dps = firing ? damage * rate : 0;
  return [
    name,
    `Damage ${damage.toFixed(1)} · Range ${range.toFixed(1)}`,
    `Rate ${firing ? rate.toFixed(1) + '/s' : '—'} · DPS ${firing ? dps.toFixed(1) : '—'}`,
    `Target: ${TARGET_LABEL[tower.targetMode]}`,
    turnText(st.turnRate),
    `Sell $${formatNumber(sellValue(tower))}`,
  ];
}

export interface TooltipTarget {
  /** Stable id of the hovered thing (a palette kind or a tower id), or null for nothing. */
  key: string | null;
  lines: string[];
}

export class TooltipView {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly rows: Text[] = [];
  private key: string | null = null;
  private lines: string[] = [];
  private hoverStart = -1;

  constructor() {
    this.root.addChild(this.g);
  }

  /** Called once per frame with the current hover target and the pointer/viewport geometry. */
  update(target: TooltipTarget, x: number, y: number, viewportW: number, viewportH: number): void {
    if (target.key === null) {
      this.key = null;
      this.lines = [];
      this.hoverStart = -1;
      this.g.clear();
      for (const r of this.rows) r.visible = false;
      return;
    }

    const now = performance.now();
    if (target.key !== this.key) {
      this.key = target.key;
      this.lines = target.lines;
      this.hoverStart = now;
    }

    if (this.hoverStart < 0 || now - this.hoverStart < HOVER_DELAY_MS) {
      this.g.clear();
      for (const r of this.rows) r.visible = false;
      return;
    }

    this.draw(x, y, viewportW, viewportH);
  }

  private draw(x: number, y: number, viewportW: number, viewportH: number): void {
    const g = this.g;
    g.clear();

    const n = this.lines.length;
    this.ensureRows(n);

    let boxW = 0;
    let lineH = 12;
    for (let i = 0; i < n; i++) {
      const t = this.rows[i];
      t.text = this.lines[i];
      boxW = Math.max(boxW, t.width);
      lineH = Math.max(lineH, t.height);
    }
    boxW += PAD_X * 2;
    const boxH = lineH * n + PAD_Y * 2;

    // Follow the pointer at a 14px offset, flipping to the other side near the right/bottom edges.
    let tx = x + OFFSET;
    let ty = y + OFFSET;
    if (tx + boxW > viewportW) tx = x - OFFSET - boxW;
    if (ty + boxH > viewportH) ty = y - OFFSET - boxH;
    if (tx < 0) tx = 0;
    if (ty < 0) ty = 0;

    g.rect(tx, ty, boxW, boxH).fill(FILL);
    g.rect(tx, ty, boxW, boxH).stroke({ width: 1, color: TEXT_COLOR });

    for (let i = 0; i < n; i++) {
      const t = this.rows[i];
      t.visible = true;
      t.position.set(tx + PAD_X, ty + PAD_Y + i * lineH + lineH / 2);
    }
  }

  private ensureRows(n: number): void {
    while (this.rows.length < n) {
      const t = new Text({
        text: '',
        style: { fontFamily: FONT, fontSize: 11, fill: TEXT_COLOR },
      });
      t.anchor.set(0, 0.5);
      this.rows.push(t);
      this.root.addChild(t);
    }
    for (let i = 0; i < this.rows.length; i++) this.rows[i].visible = i < n;
  }
}
