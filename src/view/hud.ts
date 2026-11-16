import { Container, Graphics, Text } from 'pixi.js';
import { bevel, FONT, PAL, pointInRect, type Layout, type Rect } from './chrome.ts';
import { canAfford, POINTER_KILL_BONUS } from '../core/economy.ts';
import { formatNumber } from '../core/format.ts';
import { nextStageCost, pointerInfo } from '../core/pointer.ts';
import { currentPath, selectedTower, STARTING_INTEGRITY, type RunState } from '../core/state.ts';
import {
  effectiveStats,
  sellValue,
  TOWER_KINDS,
  TOWER_STATS,
  upgradeCost,
  type Branch,
  type TowerKind,
} from '../core/towers.ts';
import { WAVES, WAVE_COUNT } from '../core/waves.ts';

/**
 * The HUD: status-bar text (hint / wave / salvage), the integrity readout, the pointer stage and
 * upgrade button, the build palette or selected-tower detail, the Start Wave button, and the
 * end-of-run modal.
 */

export type HudAction =
  | TowerKind
  | 'pointer'
  | 'wave'
  | 'upgrade'
  | 'sell'
  | 'branchA'
  | 'branchB';

const NOTICE_TICKS = 150;

const BRANCH_NAMES: Readonly<Record<TowerKind, Readonly<Record<Branch, string>>>> = {
  gun: { A: 'Marksman', B: 'Repeater' },
  cannon: { A: 'Mortar', B: 'Flak' },
  taser: { A: 'Arc', B: 'Overload' },
  frost: { A: 'Deep Freeze', B: 'Shard' },
  laser: { A: 'Focus', B: 'Prism' },
  beacon: { A: 'Command', B: 'Relay' },
};

interface BranchButton {
  branch: Branch;
  rect: Rect;
}

interface TowerDetailLayout {
  box: Rect;
  name: Rect;
  stats: Rect;
  route: Rect;
  upgrade: Rect | null;
  branches: BranchButton[];
  sell: Rect;
}

interface HudLayout {
  integrity: Rect;
  route: Rect | null;
  detail: TowerDetailLayout | null;
  pointerPanel: Rect;
  pointerUpgrade: Rect;
  towers: ReadonlyArray<{ kind: TowerKind; rect: Rect }>;
  wave: Rect;
}

function computeHud(l: Layout, s: RunState): HudLayout {
  const pad = 6;
  const x = l.leftPanel.x + pad;
  const w = l.leftPanel.w - pad * 2;
  const y = l.leftPanel.y + pad;

  let cy = y;
  const integrity: Rect = { x, y: cy, w, h: 22 };
  cy += 22 + 4;

  const tower = selectedTower(s);

  let route: Rect | null = null;
  if (!tower) {
    route = { x, y: cy, w, h: 14 };
    cy += 14 + 6;
  }

  let towers: { kind: TowerKind; rect: Rect }[] = [];
  let detail: TowerDetailLayout | null = null;

  if (!tower) {
    towers = TOWER_KINDS.map((kind) => {
      const rect: Rect = { x, y: cy, w, h: 20 };
      cy += 20 + 6;
      return { kind, rect };
    });
  } else {
    const boxTop = cy;
    const innerX = x + 4;
    const innerW = w - 8;
    cy += 6;
    const name: Rect = { x: x + 6, y: cy, w: w - 12, h: 16 };
    cy += 16;
    const stats: Rect = { x: x + 6, y: cy, w: w - 12, h: 14 };
    cy += 14;
    const routeRow: Rect = { x: x + 6, y: cy, w: w - 12, h: 14 };
    cy += 14 + 4;

    const cost = upgradeCost(tower);
    let upgrade: Rect | null = null;
    if (tower.tier !== 2 && cost !== null) {
      upgrade = { x: innerX, y: cy, w: innerW, h: 20 };
      cy += 20 + 4;
    }

    const branches: BranchButton[] = [];
    if (tower.tier === 2) {
      const gap = 4;
      const half = Math.floor((innerW - gap) / 2);
      branches.push({ branch: 'A', rect: { x: innerX, y: cy, w: half, h: 20 } });
      branches.push({
        branch: 'B',
        rect: { x: innerX + half + gap, y: cy, w: innerW - half - gap, h: 20 },
      });
      cy += 20 + 4;
    }

    const sell: Rect = { x: innerX, y: cy, w: innerW, h: 20 };
    cy += 20;
    const box: Rect = { x, y: boxTop, w, h: cy - boxTop + 6 };
    detail = { box, name, stats, route: routeRow, upgrade, branches, sell };
    cy = box.y + box.h + 6;
  }

  const pointerPanel: Rect = { x, y: cy, w, h: 44 };
  const pointerUpgrade: Rect = { x: x + 4, y: cy + 22, w: w - 8, h: 18 };
  cy += 44 + 8;
  const wave: Rect = { x, y: cy, w, h: 28 };

  return { integrity, route, detail, pointerPanel, pointerUpgrade, towers, wave };
}

export function hudButtonAt(l: Layout, s: RunState, px: number, py: number): HudAction | null {
  const h = computeHud(l, s);
  const cost = nextStageCost(s.pointer);
  if (cost !== null && canAfford(s.economy, cost) && pointInRect(h.pointerUpgrade, px, py)) return 'pointer';

  const tower = selectedTower(s);
  if (h.detail && tower) {
    const upgradePrice = upgradeCost(tower);
    const affordable = upgradePrice !== null && canAfford(s.economy, upgradePrice);
    if (h.detail.upgrade && affordable && pointInRect(h.detail.upgrade, px, py)) return 'upgrade';
    for (const b of h.detail.branches) {
      if (affordable && pointInRect(b.rect, px, py)) return b.branch === 'A' ? 'branchA' : 'branchB';
    }
    if (pointInRect(h.detail.sell, px, py)) return 'sell';
  } else {
    for (const t of h.towers) {
      if (canAfford(s.economy, TOWER_STATS[t.kind].cost) && pointInRect(t.rect, px, py)) return t.kind;
    }
  }

  if (s.phase === 'build' && pointInRect(h.wave, px, py)) return 'wave';
  return null;
}

function modalRect(l: Layout): Rect {
  const w = 300;
  const h = 132;
  return {
    x: l.client.x + Math.floor((l.client.w - w) / 2),
    y: l.client.y + Math.floor((l.client.h - h) / 2),
    w,
    h,
  };
}

function restartRect(m: Rect): Rect {
  const w = 96;
  const h = 24;
  return { x: m.x + Math.floor((m.w - w) / 2), y: m.y + m.h - h - 10, w, h };
}

export function modalRestartAt(l: Layout, s: RunState, px: number, py: number): boolean {
  if (s.phase !== 'halted' && s.phase !== 'victory') return false;
  return pointInRect(restartRect(modalRect(l)), px, py);
}

function hintFor(s: RunState): string {
  if (s.selected) return `Click a tile to place ${TOWER_STATS[s.selected].name} — right-click to cancel`;
  if (selectedTower(s)) return 'Click Upgrade, choose a branch, or sell — right-click to deselect';
  switch (s.phase) {
    case 'build':
      return 'Place towers, then start the wave';
    case 'wave':
      return 'Click enemies to shoot — hold for the reticle';
    case 'halted':
      return 'The lane broke. Click Restart to try again';
    case 'victory':
      return 'All waves cleared!';
  }
}

function makeText(text: string, bold = false): Text {
  return new Text({
    text,
    style: { fontFamily: FONT, fontSize: 11, fill: PAL.text, fontWeight: bold ? 'bold' : 'normal' },
  });
}

export class HudView {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly modalG = new Graphics();

  private readonly statusHint = makeText('');
  private readonly statusWave = makeText('');
  private readonly statusSalvage = makeText('');
  private readonly integrity = makeText('');
  private readonly route = makeText('');
  private readonly towerName = makeText('', true);
  private readonly towerStats = makeText('');
  private readonly towerRoute = makeText('');
  private readonly upgradeButton = makeText('');
  private readonly branchButtons: Text[] = [makeText(''), makeText('')];
  private readonly sellButton = makeText('');
  private readonly pointerLabel = makeText('');
  private notice = '';
  private noticeUntilTick = 0;
  private lastTick = 0;
  private readonly pointerButton = makeText('');
  private readonly towerButtons: Text[];
  private readonly waveButton = makeText('', true);
  private readonly modalTitle = makeText('', true);
  private readonly modalMessage = makeText('');
  private readonly modalRestart = makeText('Restart');
  private readonly nextWaveTitle = makeText('NEXT WAVE', true);
  private readonly nextWaveRows: Text[] = [makeText(''), makeText(''), makeText('')];
  private readonly killsTitle = makeText('KILLS', true);
  private readonly killsRows: Text[] = [makeText(''), makeText(''), makeText('')];
  private readonly pointerTitle = makeText('POINTER', true);
  private readonly pointerRows: Text[] = [makeText(''), makeText(''), makeText(''), makeText('')];

  constructor() {
    this.towerButtons = TOWER_KINDS.map(() => makeText(''));
    this.root.addChild(this.g);
    for (const t of [
      this.statusHint,
      this.statusWave,
      this.statusSalvage,
      this.integrity,
      this.route,
      this.towerName,
      this.towerStats,
      this.towerRoute,
      this.upgradeButton,
      ...this.branchButtons,
      this.sellButton,
      this.pointerLabel,
      this.pointerButton,
      ...this.towerButtons,
      this.waveButton,
      this.nextWaveTitle,
      ...this.nextWaveRows,
      this.killsTitle,
      ...this.killsRows,
      this.pointerTitle,
      ...this.pointerRows,
    ]) {
      t.anchor.set(0, 0.5);
      this.root.addChild(t);
    }
    for (const t of this.branchButtons) t.anchor.set(0.5, 0.5);
    this.root.addChild(this.modalG);
    for (const t of [this.modalTitle, this.modalMessage, this.modalRestart]) {
      t.anchor.set(0, 0.5);
      this.root.addChild(t);
    }
    this.modalTitle.style.fill = PAL.titleInverse;
    this.modalRestart.anchor.set(0.5, 0.5);
  }

  showNotice(message: string): void {
    this.notice = message;
    this.noticeUntilTick = this.lastTick + NOTICE_TICKS;
  }

  draw(s: RunState, l: Layout, hoverHud: HudAction | null): void {
    const g = this.g;
    g.clear();

    // Status bar text.
    const sp = l.statusPanes;
    this.lastTick = s.tick;
    if (this.notice !== '' && s.tick >= this.noticeUntilTick) this.notice = '';
    this.statusHint.text = this.notice || hintFor(s);
    this.statusHint.position.set(sp.left.x + 4, sp.left.y + Math.floor(sp.left.h / 2));
    this.statusWave.text = `Wave ${s.phase === 'build' ? s.wave + 1 : s.wave} / ${WAVE_COUNT}`;
    this.statusWave.position.set(sp.middle.x + 4, sp.middle.y + Math.floor(sp.middle.h / 2));
    this.statusSalvage.text = `$${formatNumber(s.economy.salvage)}`;
    this.statusSalvage.position.set(sp.right.x + 4, sp.right.y + Math.floor(sp.right.h / 2));

    // Toolbar.
    const h = computeHud(l, s);

    bevel(g, h.integrity, false, PAL.face);
    this.integrity.text = `Integrity: ${s.integrity}/${STARTING_INTEGRITY}`;
    this.integrity.position.set(h.integrity.x + 6, h.integrity.y + Math.floor(h.integrity.h / 2));

    this.drawTowerControls(s, h, hoverHud);

    if (h.route) {
      this.route.text = `Route: ${currentPath(s).length} tiles`;
      this.route.position.set(h.route.x + 6, h.route.y + Math.floor(h.route.h / 2));
    } else {
      this.route.text = '';
    }

    bevel(g, h.pointerPanel, true, PAL.face);
    this.pointerLabel.text = `Pointer: ${pointerInfo(s.pointer).name}`;
    this.pointerLabel.position.set(h.pointerPanel.x + 6, h.pointerPanel.y + 11);

    const cost = nextStageCost(s.pointer);
    const pointerEnabled = cost !== null && canAfford(s.economy, cost);
    this.pointerButton.text = cost === null ? 'Max level' : `Upgrade $${formatNumber(cost)}`;
    drawButton(g, h.pointerUpgrade, pointerEnabled, hoverHud === 'pointer');
    this.pointerButton.style.fill = pointerEnabled ? PAL.text : PAL.shadow;
    this.pointerButton.position.set(
      h.pointerUpgrade.x + 6,
      h.pointerUpgrade.y + Math.floor(h.pointerUpgrade.h / 2),
    );

    if (s.phase === 'build') {
      drawButton(g, h.wave, true, hoverHud === 'wave');
      this.waveButton.text = `Start Wave ${s.wave + 1}`;
      this.waveButton.style.fill = PAL.text;
      this.waveButton.position.set(h.wave.x + 6, h.wave.y + Math.floor(h.wave.h / 2));
    } else {
      this.waveButton.text = '';
    }

    this.drawRightPanel(s, l);

    // End-of-run modal.
    this.modalG.clear();
    if (s.phase === 'halted' || s.phase === 'victory') {
      this.drawModal(s, l);
    } else {
      this.modalTitle.text = '';
      this.modalMessage.text = '';
      this.modalRestart.text = '';
    }
  }

  private drawTowerControls(s: RunState, h: HudLayout, hoverHud: HudAction | null): void {
    const g = this.g;
    const tower = selectedTower(s);

    if (h.detail && tower) {
      const d = h.detail;
      bevel(g, d.box, false, PAL.face);

      const branch = tower.branch === null ? '' : ` - ${BRANCH_NAMES[tower.kind][tower.branch]}`;
      this.towerName.text = `${TOWER_STATS[tower.kind].name}  T${tower.tier}${branch}`;
      this.towerName.position.set(d.name.x, d.name.y + Math.floor(d.name.h / 2));

      const st = effectiveStats(tower);
      const damage = st.damage * tower.auraDamage;
      const range = st.range + tower.auraRange;
      this.towerStats.text = `dmg ${damage.toFixed(1)}  rng ${range.toFixed(1)}`;
      this.towerStats.position.set(d.stats.x, d.stats.y + Math.floor(d.stats.h / 2));

      this.towerRoute.text = `Route: ${currentPath(s).length} tiles`;
      this.towerRoute.position.set(d.route.x, d.route.y + Math.floor(d.route.h / 2));

      const price = upgradeCost(tower);
      if (d.upgrade && price !== null) {
        const enabled = canAfford(s.economy, price);
        drawButton(g, d.upgrade, enabled, hoverHud === 'upgrade');
        this.upgradeButton.text = `Upgrade $${formatNumber(price)}`;
        this.upgradeButton.style.fill = enabled ? PAL.text : PAL.shadow;
        this.upgradeButton.position.set(d.upgrade.x + 6, d.upgrade.y + Math.floor(d.upgrade.h / 2));
      } else {
        this.upgradeButton.text = '';
      }

      for (let i = 0; i < this.branchButtons.length; i++) {
        const text = this.branchButtons[i];
        const b = d.branches[i];
        if (!b) {
          text.text = '';
          continue;
        }
        const enabled = price !== null && canAfford(s.economy, price);
        drawButton(g, b.rect, enabled, hoverHud === (b.branch === 'A' ? 'branchA' : 'branchB'));
        text.text = BRANCH_NAMES[tower.kind][b.branch];
        text.style.fill = enabled ? PAL.text : PAL.shadow;
        text.position.set(b.rect.x + b.rect.w / 2, b.rect.y + Math.floor(b.rect.h / 2));
      }

      drawButton(g, d.sell, true, hoverHud === 'sell');
      this.sellButton.text = `Sell $${formatNumber(sellValue(tower))}`;
      this.sellButton.style.fill = PAL.text;
      this.sellButton.position.set(d.sell.x + 6, d.sell.y + Math.floor(d.sell.h / 2));
      return;
    }

    this.towerName.text = '';
    this.towerStats.text = '';
    this.towerRoute.text = '';
    this.upgradeButton.text = '';
    this.sellButton.text = '';
    for (const text of this.branchButtons) text.text = '';

    for (let i = 0; i < h.towers.length; i++) {
      const { kind, rect } = h.towers[i];
      const enabled = canAfford(s.economy, TOWER_STATS[kind].cost);
      const armed = s.selected === kind;
      drawButton(g, rect, enabled, hoverHud === kind, armed);
      const t = this.towerButtons[i];
      t.text = `${TOWER_STATS[kind].name}  $${formatNumber(TOWER_STATS[kind].cost)}`;
      t.style.fill = enabled ? (armed ? PAL.title : PAL.text) : PAL.shadow;
      t.position.set(rect.x + 6, rect.y + Math.floor(rect.h / 2));
    }
  }

  private drawRightPanel(s: RunState, l: Layout): void {
    const g = this.g;
    const pad = 6;
    const x = l.rightPanel.x + pad;
    const w = l.rightPanel.w - pad * 2;
    let y = l.rightPanel.y + pad;

    const wave = s.phase === 'build' ? s.wave + 1 : s.wave;
    const def = WAVES[wave - 1];
    const composition = def ? def.groups.map((grp) => `${grp.count} x ${grp.kind}`) : [];
    y = this.drawInfoBox(g, this.nextWaveTitle, this.nextWaveRows, x, y, w, composition);

    const kills = [
      `by towers: ${s.economy.kills.tower}`,
      `by pointer: ${s.economy.kills.pointer}`,
      `x${POINTER_KILL_BONUS} on pointer kills`,
    ];
    y = this.drawInfoBox(g, this.killsTitle, this.killsRows, x, y, w, kills);

    const tower = selectedTower(s);
    if (tower) {
      this.pointerTitle.text = 'TOWER';
      const branch = tower.branch === null ? 'none' : BRANCH_NAMES[tower.kind][tower.branch];
      const contents = [
        `tier: T${tower.tier}`,
        `branch: ${branch}`,
        `kills: ${tower.kills}`,
        `earned: $${formatNumber(tower.earned)}`,
      ];
      this.drawInfoBox(g, this.pointerTitle, this.pointerRows, x, y, w, contents);
    } else {
      this.pointerTitle.text = 'POINTER';
      const cost = nextStageCost(s.pointer);
      const pointer = [pointerInfo(s.pointer).name, cost === null ? 'Max level' : `Upgrade $${formatNumber(cost)}`];
      this.drawInfoBox(g, this.pointerTitle, this.pointerRows, x, y, w, pointer);
    }
  }

  private drawInfoBox(
    g: Graphics,
    title: Text,
    rows: Text[],
    x: number,
    y: number,
    w: number,
    contents: string[],
  ): number {
    const titleH = 16;
    const rowH = 13;
    const padTop = 6;
    const padBottom = 6;
    const h = padTop + titleH + contents.length * rowH + padBottom;
    const rect: Rect = { x, y, w, h };
    bevel(g, rect, false, PAL.face);
    title.position.set(x + 6, y + padTop + titleH / 2);
    for (let i = 0; i < rows.length; i++) {
      rows[i].text = i < contents.length ? contents[i] : '';
      rows[i].position.set(x + 6, y + padTop + titleH + i * rowH + rowH / 2);
    }
    return y + h + 6;
  }

  private drawModal(s: RunState, l: Layout): void {
    const g = this.modalG;
    const m = modalRect(l);
    g.rect(l.client.x, l.client.y, l.client.w, l.client.h).fill({ color: PAL.dark, alpha: 0.4 });

    bevel(g, m, true, PAL.face);
    g.rect(m.x + 2, m.y + 2, m.w - 4, 18).fill(PAL.title);
    this.modalTitle.text = s.phase === 'victory' ? 'Victory' : 'Game Over';
    this.modalTitle.position.set(m.x + 6, m.y + 2 + 9);

    this.modalMessage.text =
      s.phase === 'victory' ? 'You cleared all ten waves.' : `The lane broke at wave ${s.wave}.`;
    this.modalMessage.position.set(m.x + 12, m.y + 2 + 18 + 16);

    const r = restartRect(m);
    bevel(g, r, true, PAL.face);
    this.modalRestart.text = 'Restart';
    this.modalRestart.position.set(r.x + r.w / 2, r.y + r.h / 2);
  }
}

function drawButton(g: Graphics, r: Rect, enabled: boolean, hovered: boolean, pressed = false): void {
  if (enabled) {
    bevel(g, r, !pressed, PAL.face);
  } else {
    g.rect(r.x, r.y, r.w, r.h).fill(PAL.face);
    g.rect(r.x, r.y, r.w, r.h).stroke({ width: 1, color: PAL.shadow });
  }
  if (hovered && enabled) {
    g.rect(r.x + 2, r.y + 2, r.w - 4, r.h - 4).stroke({ width: 1, color: PAL.dark });
  }
}
