import { Container, Graphics, Text } from 'pixi.js';
import { bevel, FONT, FONT_SIZE, PAL, pointInRect, type Layout, type Rect } from './chrome.ts';
import { canAfford, POINTER_KILL_BONUS } from '../core/economy.ts';
import { formatNumber } from '../core/format.ts';
import { clickDamage, comboMultiplier, nextPointerCost, overclockCeiling, pointerInfo } from '../core/pointer.ts';
import { autoWaveStatus, canCycleLevel, currentPath, isFinalWave, pointerDamageMult, selectedTower, STARTING_INTEGRITY, type RunState } from '../core/state.ts';
import { levelById } from '../core/levels.ts';
import {
  cursorClickDamage,
  cursorClickRate,
  cursorRadius,
  effectiveStats,
  isRepairing,
  repairCost,
  repairHpToRestore,
  repairRemainingSeconds,
  sellValue,
  TOWER_KINDS,
  TOWER_STATS,
  upgradeCost,
  type Branch,
  type TowerKind,
} from '../core/towers.ts';
import { earlyCallBonus, MODIFIER_NAMES, waveDef, WAVE_COUNT, waveModifiers } from '../core/waves.ts';
import {
  SPEC_CAPS,
  SPEC_KINDS,
  SPEC_NAMES,
  specEffectCompactText,
  specEffectText,
  type SpecKind,
} from '../core/save.ts';
import { branchName, fmtClickDamage, targetModeDisplay } from './tooltipText.ts';

/**
 * The HUD: status-bar text (hint / wave / salvage), the integrity readout, the pointer stage and
 * upgrade button, the build palette or selected-tower detail, the Start Wave button, and the
 * end-of-run modal.
 */

export type HudAction =
  | TowerKind
  | 'pointer'
  | 'override'
  | 'auto'
  | 'wave'
  | 'map'
  | 'upgrade'
  | 'sell'
  | 'repair'
  | 'target'
  | 'branchA'
  | 'branchB'
  | 'branchC'
  | 'buyCpu'
  | 'buyRam'
  | 'buyGpu'
  | 'buyDisk';

const SPEC_ACTION: Readonly<Record<SpecKind, HudAction>> = {
  cpu: 'buyCpu',
  ram: 'buyRam',
  gpu: 'buyGpu',
  disk: 'buyDisk',
};

const NOTICE_TICKS = 150;

const SPEC_FONT_SIZE = FONT_SIZE.small;
const SPEC_BUTTON_PAD = 12;
const SPEC_BUTTON_MIN = 48;
const SPEC_BUTTON_MAX = 64;
const SPEC_LABEL_GAP = 6;
const SPEC_LABEL_MIN = 44;

let metricsText: Text | null = null;

const TEXT_WIDTH_CACHE_MAX = 256;
const textWidthCache = new Map<string, number>();

/** Measure a string with the same font the HUD draws with, without adding it to the scene. */
function textWidth(text: string, size: number): number {
  const key = `${size}|${text}`;
  const cached = textWidthCache.get(key);
  if (cached !== undefined) return cached;

  if (!metricsText) {
    metricsText = new Text({
      text: '',
      style: { fontFamily: FONT, fontSize: size, fill: PAL.text },
    });
  }
  metricsText.style.fontSize = size;
  metricsText.text = text;
  const width = metricsText.width;

  if (textWidthCache.size >= TEXT_WIDTH_CACHE_MAX) textWidthCache.clear();
  textWidthCache.set(key, width);
  return width;
}

function fitButtonText(preferred: string, fallbacks: readonly string[]): string {
  for (const candidate of [preferred, ...fallbacks]) {
    if (Math.ceil(textWidth(candidate, SPEC_FONT_SIZE)) + SPEC_BUTTON_PAD <= SPEC_BUTTON_MAX) {
      return candidate;
    }
  }
  return fallbacks[fallbacks.length - 1] ?? preferred;
}

function truncateText(text: string, maxWidth: number): string {
  if (Math.ceil(textWidth(text, SPEC_FONT_SIZE)) <= maxWidth) return text;
  const chars = Array.from(text);
  while (chars.length > 0) {
    chars.pop();
    const candidate = `${chars.join('')}…`;
    if (Math.ceil(textWidth(candidate, SPEC_FONT_SIZE)) <= maxWidth) return candidate;
  }
  return '…';
}

function fitSpecLabel(verbose: string, compact: string, width: number): string {
  if (Math.ceil(textWidth(verbose, SPEC_FONT_SIZE)) <= width) return verbose;
  if (Math.ceil(textWidth(compact, SPEC_FONT_SIZE)) <= width) return compact;
  return truncateText(compact, Math.max(SPEC_LABEL_MIN, width));
}

interface BranchButton {
  branch: Branch;
  rect: Rect;
}

interface TowerDetailLayout {
  box: Rect;
  name: Rect;
  stats: Rect;
  route: Rect;
  target: Rect | null;
  upgrade: Rect | null;
  branches: BranchButton[];
  repair: Rect | null;
  sell: Rect;
}

interface SpecRow {
  kind: SpecKind;
  label: Rect;
  button: Rect;
  labelText: string;
  buttonText: string;
}

interface SpecShopLayout {
  header: Rect;
  rows: SpecRow[];
}

interface MapRow {
  row: Rect;
  next: Rect;
}

interface HudLayout {
  integrity: Rect;
  route: Rect | null;
  detail: TowerDetailLayout | null;
  pointerPanel: Rect;
  pointerUpgrade: Rect;
  pointerOverride: Rect | null;
  towers: ReadonlyArray<{ kind: TowerKind; rect: Rect }>;
  wave: Rect;
  autoWave: Rect;
  map: MapRow | null;
  specs: SpecShopLayout | null;
}

function computeHud(l: Layout, s: RunState): HudLayout {
  const pad = 6;
  const x = l.leftPanel.x + pad;
  const w = l.leftPanel.w - pad * 2;
  const y = l.leftPanel.y + pad;

  let cy = y;
  const integrity: Rect = { x, y: cy, w, h: 26 };
  cy += 26 + 4;

  const tower = selectedTower(s);

  let route: Rect | null = null;
  if (!tower) {
    route = { x, y: cy, w, h: 18 };
    cy += 18 + 6;
  }

  let towers: { kind: TowerKind; rect: Rect }[] = [];
  let detail: TowerDetailLayout | null = null;

  if (!tower) {
    towers = TOWER_KINDS.map((kind) => {
      const rect: Rect = { x, y: cy, w, h: 24 };
      cy += 24 + 6;
      return { kind, rect };
    });
  } else {
    const boxTop = cy;
    const innerX = x + 4;
    const innerW = w - 8;
    cy += 6;
    const name: Rect = { x: x + 6, y: cy, w: w - 12, h: 20 };
    cy += 20;
    const stats: Rect = { x: x + 6, y: cy, w: w - 12, h: 18 };
    cy += 18;
    const routeRow: Rect = { x: x + 6, y: cy, w: w - 12, h: 18 };
    cy += 18 + 4;

    // Walls never target, so they have no target-mode row.
    const target: Rect | null = tower.kind === 'wall' ? null : { x: innerX, y: cy, w: innerW, h: 24 };
    if (target) cy += 24 + 4;

    const cost = upgradeCost(tower);
    let upgrade: Rect | null = null;
    if (tower.tier !== 2 && cost !== null) {
      upgrade = { x: innerX, y: cy, w: innerW, h: 24 };
      cy += 24 + 4;
    }

    const branches: BranchButton[] = [];
    if (tower.tier === 2) {
      const gap = 4;
      const list: Branch[] = tower.kind === 'wall' ? ['A', 'B', 'C'] : ['A', 'B'];
      const bw = Math.floor((innerW - gap * (list.length - 1)) / list.length);
      list.forEach((branch, i) => {
        const x = innerX + i * (bw + gap);
        const w = i === list.length - 1 ? innerX + innerW - x : bw;
        branches.push({ branch, rect: { x, y: cy, w, h: 24 } });
      });
      cy += 24 + 4;
    }

    // A tower with hit points (a wall) gains a Repair button above Sell. The action is refused at
    // full health and while a repair runs, but the row always exists so its disabled reason shows.
    const repair: Rect | null = tower.maxHp > 0 ? { x: innerX, y: cy, w: innerW, h: 24 } : null;
    if (repair) cy += 24 + 4;

    const sell: Rect = { x: innerX, y: cy, w: innerW, h: 24 };
    cy += 24;
    const box: Rect = { x, y: boxTop, w, h: cy - boxTop + 6 };
    detail = { box, name, stats, route: routeRow, target, upgrade, branches, repair, sell };
    cy = box.y + box.h + 6;
  }

  const pointerPanel: Rect = { x, y: cy, w, h: 76 };
  const pointerUpgrade: Rect = { x: x + 4, y: cy + 24, w: w - 8, h: 22 };
  // The Manual Override checkbox is only offered once the reticle exists (stage 2).
  const pointerOverride: Rect | null = s.pointer.stage >= 2 ? { x: x + 4, y: cy + 50, w: w - 8, h: 22 } : null;
  cy += 76 + 8;

  let map: MapRow | null = null;
  if (canCycleLevel(s)) {
    const row: Rect = { x, y: cy, w, h: 22 };
    const nextW = 44;
    const next: Rect = { x: row.x + row.w - nextW, y: row.y + 1, w: nextW, h: 20 };
    map = { row, next };
    cy += 22 + 6;
  }

  const wave: Rect = { x, y: cy, w, h: 32 };
  cy += 32 + 6;
  const autoWave: Rect = { x: x + 4, y: cy, w: w - 8, h: 22 };
  cy += 22 + 6;

  let specs: SpecShopLayout | null = null;
  if (s.phase === 'build') {
    const header: Rect = { x, y: cy, w, h: 18 };
    cy += 18 + 4;
    const rows = SPEC_KINDS.map((kind) => {
      const row: Rect = { x, y: cy, w, h: 22 };
      cy += 22 + 3;

      const level = s.specs[kind];
      const cap = SPEC_CAPS[kind];
      const capped = level >= cap;

      const buttonText = capped
        ? fitButtonText('FULL', [])
        : fitButtonText('Buy (1 spec)', ['Buy 1', 'BUY']);
      const buttonW = Math.min(
        SPEC_BUTTON_MAX,
        Math.max(SPEC_BUTTON_MIN, Math.ceil(textWidth(buttonText, SPEC_FONT_SIZE)) + SPEC_BUTTON_PAD),
      );
      const button: Rect = { x: row.x + row.w - buttonW, y: row.y + 1, w: buttonW, h: 20 };

      const labelX = row.x + 2;
      const label: Rect = {
        x: labelX,
        y: row.y,
        w: Math.max(0, button.x - labelX - SPEC_LABEL_GAP),
        h: row.h,
      };

      const verbose = `${SPEC_NAMES[kind]} ${level}/${cap}  ${specEffectText(kind, level)}`;
      const compact = `${SPEC_NAMES[kind]} ${level}/${cap} ${specEffectCompactText(kind, level)}`;
      const labelText = fitSpecLabel(verbose, compact, label.w);

      return { kind, label, button, labelText, buttonText };
    });
    specs = { header, rows };
  }

  return { integrity, route, detail, pointerPanel, pointerUpgrade, pointerOverride, towers, wave, autoWave, map, specs };
}

/**
 * The build-palette tower button under a point, regardless of whether it is currently affordable.
 * Returns null when a placed tower is selected for inspection (the palette is replaced by detail),
 * so the tooltip does not report a tower button that is not on screen.
 */
export function paletteTowerAt(l: Layout, s: RunState, px: number, py: number): TowerKind | null {
  if (selectedTower(s)) return null;
  const h = computeHud(l, s);
  for (const t of h.towers) {
    if (pointInRect(t.rect, px, py)) return t.kind;
  }
  return null;
}

export interface HudControlHit {
  action: HudAction;
  enabled: boolean;
}

/**
 * The HUD control under a point, hit-tested whether or not it is currently clickable. Tooltips use
 * this so a disabled control can still explain why it is disabled; `hudButtonAt` filters it down to
 * the clickable set.
 */
export function hudControlAt(l: Layout, s: RunState, px: number, py: number): HudControlHit | null {
  const h = computeHud(l, s);

  {
    const cost = nextPointerCost(s.pointer);
    const enabled = cost !== null && canAfford(s.economy, cost);
    if (pointInRect(h.pointerUpgrade, px, py)) return { action: 'pointer', enabled };
  }

  if (h.pointerOverride && pointInRect(h.pointerOverride, px, py)) {
    return { action: 'override', enabled: true };
  }

  const tower = selectedTower(s);
  if (h.detail && tower) {
    const upgradePrice = upgradeCost(tower);
    const affordable = upgradePrice !== null && canAfford(s.economy, upgradePrice);
    if (h.detail.target && pointInRect(h.detail.target, px, py)) {
      return { action: 'target', enabled: TOWER_STATS[tower.kind].targetLock === null && tower.kind !== 'cursor' };
    }
    if (h.detail.upgrade && pointInRect(h.detail.upgrade, px, py)) return { action: 'upgrade', enabled: affordable };
    for (const b of h.detail.branches) {
      if (pointInRect(b.rect, px, py)) {
        const action = b.branch === 'A' ? 'branchA' : b.branch === 'B' ? 'branchB' : 'branchC';
        return { action, enabled: affordable };
      }
    }
    if (h.detail.repair && pointInRect(h.detail.repair, px, py)) {
      const repairing = isRepairing(tower, s.clock);
      const full = repairHpToRestore(tower) <= 0;
      const affordableRepair = canAfford(s.economy, repairCost(tower));
      return { action: 'repair', enabled: !repairing && !full && affordableRepair };
    }
    if (pointInRect(h.detail.sell, px, py)) return { action: 'sell', enabled: true };
  } else {
    for (const t of h.towers) {
      if (pointInRect(t.rect, px, py)) {
        return { action: t.kind, enabled: canAfford(s.economy, TOWER_STATS[t.kind].cost) };
      }
    }
  }

  if (h.map && pointInRect(h.map.next, px, py)) return { action: 'map', enabled: true };

  if (s.phase === 'build' || s.phase === 'wave') {
    if (pointInRect(h.wave, px, py)) return { action: 'wave', enabled: !isFinalWave(s) };
    if (pointInRect(h.autoWave, px, py)) return { action: 'auto', enabled: true };
  }

  if (h.specs) {
    for (const row of h.specs.rows) {
      if (pointInRect(row.button, px, py)) {
        const capped = s.specs[row.kind] >= SPEC_CAPS[row.kind];
        return { action: SPEC_ACTION[row.kind], enabled: !capped && s.unspentSpecs > 0 };
      }
    }
  }

  return null;
}

export function hudButtonAt(l: Layout, s: RunState, px: number, py: number): HudAction | null {
  const hit = hudControlAt(l, s, px, py);
  return hit && hit.enabled ? hit.action : null;
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
  const h = 26;
  return { x: m.x + Math.floor((m.w - w) / 2), y: m.y + m.h - h - 10, w, h };
}

export function modalRestartAt(l: Layout, s: RunState, px: number, py: number): boolean {
  if (s.phase !== 'halted') return false;
  return pointInRect(restartRect(modalRect(l)), px, py);
}

function victoryModalRect(l: Layout): Rect {
  const w = 320;
  const h = 172;
  return {
    x: l.client.x + Math.floor((l.client.w - w) / 2),
    y: l.client.y + Math.floor((l.client.h - h) / 2),
    w,
    h,
  };
}

interface VictoryButtons {
  endless: Rect;
  restart: Rect;
}

function victoryButtons(m: Rect): VictoryButtons {
  const bh = 26;
  const pad = 10;
  const gap = 6;
  const restartW = 118;
  const endlessW = 68;
  const y = m.y + m.h - bh - pad;
  const restart: Rect = { x: m.x + m.w - pad - restartW, y, w: restartW, h: bh };
  const endless: Rect = { x: restart.x - gap - endlessW, y, w: endlessW, h: bh };
  return { endless, restart };
}

export type VictoryAction = 'endless' | 'restart';

export function victoryButtonAt(l: Layout, s: RunState, px: number, py: number): VictoryAction | null {
  if (s.phase !== 'victory') return null;
  const b = victoryButtons(victoryModalRect(l));
  if (pointInRect(b.endless, px, py)) return 'endless';
  if (pointInRect(b.restart, px, py)) return 'restart';
  return null;
}

function hintFor(s: RunState): string {
  if (s.selected) return `Click a tile to place ${TOWER_STATS[s.selected].name} — right-click to cancel`;
  if (selectedTower(s)) return 'Click Upgrade, choose a branch, or sell — right-click to deselect';
  switch (s.phase) {
    case 'build':
      return s.towers.length === 0 ? 'Pick a tower, then click a tile' : 'Click Start Wave when you are ready';
    case 'wave':
      return s.calledEarly
        ? 'Click enemies to shoot — aim for the notch'
        : 'Call the next wave early for a salvage bonus — two waves at once';
    case 'halted':
      return 'The lane broke. Click Restart to try again';
    case 'victory':
      return 'All waves cleared!';
  }
}

function makeText(text: string, bold = false): Text {
  return new Text({
    text,
    style: { fontFamily: FONT, fontSize: FONT_SIZE.body, fill: PAL.text, fontWeight: bold ? 'bold' : 'normal' },
  });
}

export class HudView {
  readonly root = new Container();
  private readonly g = new Graphics();
  private readonly modalG = new Graphics();

  private readonly statusHint = makeText('');
  private readonly statusWave = makeText('');
  private readonly statusSalvage = makeText('');
  private readonly statusSpeed = makeText('');
  private readonly statusPaused = makeText('', true);
  private readonly integrity = makeText('');
  private readonly route = makeText('');
  private readonly towerName = makeText('', true);
  private readonly towerStats = makeText('');
  private readonly towerRoute = makeText('');
  private readonly upgradeButton = makeText('');
  private readonly branchButtons: Text[] = [makeText(''), makeText(''), makeText('')];
  private readonly repairButton = makeText('');
  private readonly sellButton = makeText('');
  private readonly targetButton = makeText('');
  private readonly targetValue = makeText('');
  private readonly pointerLabel = makeText('');
  private notice = '';
  private noticeUntilTick = 0;
  private lastTick = 0;
  private readonly pointerButton = makeText('');
  private readonly pointerOverrideButton = makeText('');
  private readonly towerButtons: Text[];
  private readonly waveButton = makeText('', true);
  private readonly autoWaveButton = makeText('');
  private readonly mapLabel = makeText('');
  private readonly mapNext = makeText('');
  private readonly modalTitle = makeText('', true);
  private readonly modalMessage = makeText('');
  private readonly modalRestart = makeText('Restart');
  private readonly modalButton2 = makeText('');
  private readonly nextWaveTitle = makeText('NEXT WAVE', true);
  private readonly nextWaveRows: Text[] = [makeText(''), makeText(''), makeText(''), makeText(''), makeText('')];
  private readonly killsTitle = makeText('KILLS', true);
  private readonly killsRows: Text[] = [makeText(''), makeText(''), makeText('')];
  private readonly comboText = makeText('', true);
  private readonly pointerTitle = makeText('POINTER', true);
  private readonly pointerRows: Text[] = [makeText(''), makeText(''), makeText(''), makeText('')];
  private readonly specHeader = makeText('SPECS', true);
  private readonly specLabels: Text[] = SPEC_KINDS.map(() => makeText(''));
  private readonly specButtons: Text[] = SPEC_KINDS.map(() => makeText(''));

  constructor() {
    this.towerButtons = TOWER_KINDS.map(() => makeText(''));
    this.root.addChild(this.g);
    for (const t of [
      this.statusHint,
      this.statusWave,
      this.statusSalvage,
      this.statusSpeed,
      this.statusPaused,
      this.integrity,
      this.route,
      this.towerName,
      this.towerStats,
      this.towerRoute,
      this.upgradeButton,
      ...this.branchButtons,
      this.repairButton,
      this.sellButton,
      this.targetButton,
      this.targetValue,
      this.pointerLabel,
      this.pointerButton,
      this.pointerOverrideButton,
      ...this.towerButtons,
      this.waveButton,
      this.autoWaveButton,
      this.mapLabel,
      this.mapNext,
      this.nextWaveTitle,
      ...this.nextWaveRows,
      this.killsTitle,
      ...this.killsRows,
      this.pointerTitle,
      ...this.pointerRows,
      this.comboText,
      this.specHeader,
      ...this.specLabels,
      ...this.specButtons,
    ]) {
      t.anchor.set(0, 0.5);
      this.root.addChild(t);
    }
    for (const t of this.branchButtons) t.anchor.set(0.5, 0.5);
    this.targetValue.anchor.set(1, 0.5);
    this.mapNext.anchor.set(0.5, 0.5);
    for (const t of this.specLabels) t.style.fontSize = FONT_SIZE.small;
    for (const t of this.specButtons) {
      t.style.fontSize = FONT_SIZE.small;
      t.anchor.set(0.5, 0.5);
    }
    this.root.addChild(this.modalG);
    for (const t of [this.modalTitle, this.modalMessage, this.modalRestart, this.modalButton2]) {
      t.anchor.set(0, 0.5);
      this.root.addChild(t);
    }
    this.modalTitle.style.fill = PAL.titleInverse;
    this.modalRestart.anchor.set(0.5, 0.5);
    this.modalButton2.anchor.set(0.5, 0.5);
    this.comboText.style.fill = PAL.title;
    this.statusPaused.style.fill = PAL.title;
  }

  showNotice(message: string, ticks = NOTICE_TICKS): void {
    this.notice = message;
    this.noticeUntilTick = this.lastTick + ticks;
  }

  draw(s: RunState, l: Layout, hoverHud: HudAction | null): void {
    const g = this.g;
    g.clear();

    // Status bar text.
    const sp = l.statusPanes;
    this.lastTick = s.tick;
    if (this.notice !== '' && s.tick >= this.noticeUntilTick) this.notice = '';

    // A paused run shows a sunken PAUSED box and keeps the speed readout; otherwise the hint shows.
    if (s.paused) {
      const pr: Rect = { x: sp.left.x + 4, y: sp.left.y + 2, w: 64, h: sp.left.h - 4 };
      bevel(g, pr, false, PAL.face);
      this.statusPaused.text = 'PAUSED';
      this.statusPaused.position.set(pr.x + 6, pr.y + Math.floor(pr.h / 2));
      this.statusHint.text = '';
    } else {
      this.statusPaused.text = '';
      this.statusHint.text = this.notice || autoWaveStatus(s) || hintFor(s);
      this.statusHint.position.set(sp.left.x + 4, sp.left.y + Math.floor(sp.left.h / 2));
    }

    const displayWave = s.phase === 'build' ? s.wave + 1 : s.wave;
    this.statusWave.text = s.endless ? `Wave ${displayWave}` : `Wave ${displayWave} / ${WAVE_COUNT}`;
    this.statusWave.position.set(sp.middle.x + 4, sp.middle.y + Math.floor(sp.middle.h / 2));
    this.statusSpeed.text = `×${s.speed}`;
    this.statusSpeed.position.set(sp.speed.x + 4, sp.speed.y + Math.floor(sp.speed.h / 2));
    this.statusSalvage.text =
      s.modifiers.includes('blackout') && s.phase === 'wave' ? '---' : `$${formatNumber(s.economy.salvage)}`;
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
    const pointerName = pointerInfo(s.pointer).name;
    this.pointerLabel.text =
      s.pointer.stage >= 2
        ? `Overclock ${s.pointer.clickLevel} / ${overclockCeiling(s.wave)}`
        : `Pointer: ${pointerName}`;
    this.pointerLabel.position.set(h.pointerPanel.x + 6, h.pointerPanel.y + 13);

    const cost = nextPointerCost(s.pointer);
    const pointerEnabled = cost !== null && canAfford(s.economy, cost);
    this.pointerButton.text = cost === null ? 'Max level' : `Upgrade $${formatNumber(cost)}`;
    drawButton(g, h.pointerUpgrade, pointerEnabled, hoverHud === 'pointer');
    this.pointerButton.style.fill = pointerEnabled ? PAL.text : PAL.shadow;
    this.pointerButton.position.set(
      h.pointerUpgrade.x + 6,
      h.pointerUpgrade.y + Math.floor(h.pointerUpgrade.h / 2),
    );

    if (h.pointerOverride) {
      drawCheckbox(g, h.pointerOverride, s.pointer.manualOverride);
      this.pointerOverrideButton.text = 'Override';
      this.pointerOverrideButton.style.fill = PAL.text;
      this.pointerOverrideButton.position.set(
        h.pointerOverride.x + 20,
        h.pointerOverride.y + Math.floor(h.pointerOverride.h / 2),
      );
    } else {
      this.pointerOverrideButton.text = '';
    }

    if (h.map) {
      const name = levelById(s.levelId).name;
      drawButton(g, h.map.next, true, hoverHud === 'map');
      this.mapNext.text = 'Next';
      this.mapNext.style.fill = PAL.text;
      this.mapNext.position.set(h.map.next.x + h.map.next.w / 2, h.map.next.y + Math.floor(h.map.next.h / 2));
      this.mapLabel.text = `MAP  ${name}`;
      this.mapLabel.position.set(h.map.row.x + 6, h.map.row.y + Math.floor(h.map.row.h / 2));
    } else {
      this.mapLabel.text = '';
      this.mapNext.text = '';
    }

    if (s.phase === 'build' || s.phase === 'wave') {
      const enabled = !isFinalWave(s);
      drawButton(g, h.wave, enabled, hoverHud === 'wave');
      this.waveButton.text =
        s.phase === 'build'
          ? `Start Wave ${s.wave + 1}`
          : `Call Wave ${s.wave + 1}  +$${earlyCallBonus(s.waveTick, s.wave + 1)}`;
      this.waveButton.style.fill = enabled ? PAL.text : PAL.shadow;
      this.waveButton.position.set(h.wave.x + 6, h.wave.y + Math.floor(h.wave.h / 2));

      drawCheckbox(g, h.autoWave, s.autoWave);
      this.autoWaveButton.text = 'Auto';
      this.autoWaveButton.style.fill = PAL.text;
      this.autoWaveButton.position.set(h.autoWave.x + 20, h.autoWave.y + Math.floor(h.autoWave.h / 2));
    } else {
      this.waveButton.text = '';
      this.autoWaveButton.text = '';
    }

    this.drawSpecShop(s, h);

    this.drawRightPanel(s, l);

    // End-of-run modal.
    this.modalG.clear();
    if (s.phase === 'halted' || s.phase === 'victory') {
      this.drawModal(s, l);
    } else {
      this.modalTitle.text = '';
      this.modalMessage.text = '';
      this.modalRestart.text = '';
      this.modalButton2.text = '';
    }
  }

  private drawTowerControls(s: RunState, h: HudLayout, hoverHud: HudAction | null): void {
    const g = this.g;
    const tower = selectedTower(s);

    if (h.detail && tower) {
      const d = h.detail;
      for (const text of this.towerButtons) text.visible = false;

      g.rect(d.box.x, d.box.y, d.box.w, d.box.h).fill(PAL.face);
      bevel(g, d.box, true, PAL.face);

      this.towerName.visible = true;
      this.towerStats.visible = true;
      this.towerRoute.visible = true;
      this.upgradeButton.visible = true;
      this.sellButton.visible = true;
      this.repairButton.visible = d.repair !== null;
      this.targetButton.visible = d.target !== null;
      this.targetValue.visible = d.target !== null;
      for (const text of this.branchButtons) text.visible = true;

      const branch = tower.branch === null ? '' : ` - ${branchName(tower.kind, tower.branch)}`;
      this.towerName.text = `${TOWER_STATS[tower.kind].name}  T${tower.tier}${branch}`;
      this.towerName.position.set(d.name.x, d.name.y + Math.floor(d.name.h / 2));

      if (tower.kind === 'wall') {
        this.towerStats.text = tower.branch === null ? `HP ${Math.ceil(tower.hp)}` : `HP ${Math.ceil(tower.hp)}/${tower.maxHp}`;
      } else if (tower.kind === 'cursor') {
        const rate = cursorClickRate(tower);
        const radius = cursorRadius(tower);
        const dmg = cursorClickDamage(tower, clickDamage(s.pointer), pointerDamageMult(s.specs));
        this.towerStats.text = `${rate.toFixed(1)}/s  dmg ${fmtClickDamage(dmg)}  rng ${radius.toFixed(1)}`;
      } else {
        const st = effectiveStats(tower);
        const damage = st.damage * tower.auraDamage;
        const range = st.range + tower.auraRange;
        this.towerStats.text = `dmg ${damage.toFixed(1)}  rng ${range.toFixed(1)}`;
      }
      this.towerStats.position.set(d.stats.x, d.stats.y + Math.floor(d.stats.h / 2));

      this.towerRoute.text = `Route: ${currentPath(s).length} tiles`;
      this.towerRoute.position.set(d.route.x, d.route.y + Math.floor(d.route.h / 2));

      if (d.target) {
        const fixed = TOWER_STATS[tower.kind].targetLock !== null || tower.kind === 'cursor';
        drawButton(g, d.target, !fixed, hoverHud === 'target' && !fixed);
        this.targetButton.text = 'Target';
        this.targetButton.style.fill = fixed ? PAL.shadow : PAL.text;
        this.targetButton.position.set(d.target.x + 6, d.target.y + Math.floor(d.target.h / 2));
        this.targetValue.text = targetModeDisplay(tower);
        this.targetValue.style.fill = fixed ? PAL.shadow : PAL.text;
        this.targetValue.position.set(d.target.x + d.target.w - 6, d.target.y + Math.floor(d.target.h / 2));
      } else {
        this.targetButton.text = '';
        this.targetValue.text = '';
      }

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
        drawButton(
          g,
          b.rect,
          enabled,
          hoverHud === (b.branch === 'A' ? 'branchA' : b.branch === 'B' ? 'branchB' : 'branchC'),
        );
        text.text = branchName(tower.kind, b.branch);
        text.style.fill = enabled ? PAL.text : PAL.shadow;
        text.position.set(b.rect.x + b.rect.w / 2, b.rect.y + Math.floor(b.rect.h / 2));
      }

      if (d.repair) {
        const repairing = isRepairing(tower, s.clock);
        const hp = repairHpToRestore(tower);
        const cost = repairCost(tower);
        const enabled = !repairing && hp > 0 && canAfford(s.economy, cost);
        drawButton(g, d.repair, enabled, hoverHud === 'repair');
        this.repairButton.text = repairing
          ? `Repairing — ${repairRemainingSeconds(tower, s.clock).toFixed(1)} s`
          : hp <= 0
            ? 'No damage'
            : `Repair ${Math.ceil(hp)} HP  $${formatNumber(cost)}`;
        this.repairButton.style.fill = enabled ? PAL.text : PAL.shadow;
        this.repairButton.position.set(d.repair.x + 6, d.repair.y + Math.floor(d.repair.h / 2));
      } else {
        this.repairButton.text = '';
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
    this.repairButton.text = '';
    this.sellButton.text = '';
    this.targetButton.text = '';
    this.targetValue.text = '';
    this.towerName.visible = false;
    this.towerStats.visible = false;
    this.towerRoute.visible = false;
    this.upgradeButton.visible = false;
    this.repairButton.visible = false;
    this.sellButton.visible = false;
    this.targetButton.visible = false;
    this.targetValue.visible = false;
    for (const text of this.branchButtons) {
      text.text = '';
      text.visible = false;
    }

    for (let i = 0; i < h.towers.length; i++) {
      this.towerButtons[i].visible = true;
      const { kind, rect } = h.towers[i];
      const enabled = canAfford(s.economy, TOWER_STATS[kind].cost);
      const armed = s.selected === kind;
      // Onboarding: on a fresh profile the Gun button pulses every 2 s until the first placement.
      const pulse =
        kind === 'gun' && s.onboarding && !s.placedFirstTower && enabled && s.tick % 120 < 24;
      drawButton(g, rect, enabled, hoverHud === kind, armed);
      if (pulse) {
        g.rect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2).stroke({ width: 2, color: PAL.title });
      }
      const t = this.towerButtons[i];
      t.text = `${TOWER_STATS[kind].name}  $${formatNumber(TOWER_STATS[kind].cost)}`;
      t.style.fill = enabled ? (armed ? PAL.title : PAL.text) : PAL.shadow;
      t.position.set(rect.x + 6, rect.y + Math.floor(rect.h / 2));
    }
  }

  private drawSpecShop(s: RunState, h: HudLayout): void {
    const g = this.g;
    if (!h.specs) {
      this.specHeader.text = '';
      for (const t of this.specLabels) t.text = '';
      for (const t of this.specButtons) t.text = '';
      return;
    }

    const banked = s.unspentSpecs;
    this.specHeader.text = `SPECS  banked ${banked}`;
    this.specHeader.position.set(h.specs.header.x + 2, h.specs.header.y + Math.floor(h.specs.header.h / 2));

    for (let i = 0; i < h.specs.rows.length; i++) {
      const row = h.specs.rows[i];
      const level = s.specs[row.kind];
      const cap = SPEC_CAPS[row.kind];
      const capped = level >= cap;
      const enabled = !capped && banked > 0;

      this.specLabels[i].text = row.labelText;
      this.specLabels[i].position.set(row.label.x, row.label.y + Math.floor(row.label.h / 2));

      drawButton(g, row.button, enabled, false);
      this.specButtons[i].text = row.buttonText;
      this.specButtons[i].style.fill = enabled ? PAL.text : PAL.shadow;
      this.specButtons[i].position.set(
        row.button.x + Math.floor(row.button.w / 2),
        row.button.y + Math.floor(row.button.h / 2),
      );
    }
  }

  private drawRightPanel(s: RunState, l: Layout): void {
    const g = this.g;
    const pad = 6;
    const x = l.rightPanel.x + pad;
    const w = l.rightPanel.w - pad * 2;
    let y = l.rightPanel.y + pad;

    // Combo readout: visible while the multiplier is above x1, so the timer ticking down is legible.
    const mult = comboMultiplier(s.pointer);
    if (mult > 1) {
      this.comboText.text = `COMBO x${mult.toFixed(1)}`;
      this.comboText.position.set(x + 2, y + 10);
      this.comboText.visible = true;
      y += 20;
    } else {
      this.comboText.text = '';
      this.comboText.visible = false;
    }

    const wave = s.wave + 1;
    const def = waveDef(wave);
    const composition = def ? def.groups.map((grp) => `${grp.count} x ${grp.kind}`) : [];
    const mods = waveModifiers(wave);
    if (mods.length > 0) composition.unshift(`mod: ${mods.map((m) => MODIFIER_NAMES[m]).join(' + ')}`);
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
      const branch = tower.branch === null ? 'none' : branchName(tower.kind, tower.branch);
      const contents = [
        `tier: T${tower.tier}`,
        `branch: ${branch}`,
        `kills: ${tower.kills}`,
        `earned: $${formatNumber(tower.earned)}`,
      ];
      this.drawInfoBox(g, this.pointerTitle, this.pointerRows, x, y, w, contents);
    } else {
      this.pointerTitle.text = 'POINTER';
      const cost = nextPointerCost(s.pointer);
      const name = pointerInfo(s.pointer).name;
      const pointer = [
        s.pointer.stage >= 2 ? `${name} L${s.pointer.clickLevel}` : name,
        cost === null ? 'Max level' : `Upgrade $${formatNumber(cost)}`,
      ];
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
    const titleH = 18;
    const rowH = 18;
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
    if (s.phase === 'victory') {
      this.drawVictoryModal(s, l);
      return;
    }
    const m = modalRect(l);
    g.rect(l.client.x, l.client.y, l.client.w, l.client.h).fill({ color: PAL.dark, alpha: 0.4 });

    bevel(g, m, true, PAL.face);
    g.rect(m.x + 2, m.y + 2, m.w - 4, 20).fill(PAL.title);
    this.modalTitle.text = 'Game Over';
    this.modalTitle.position.set(m.x + 6, m.y + 2 + 10);

    this.modalMessage.text = `The lane broke at wave ${s.wave}.`;
    this.modalMessage.position.set(m.x + 12, m.y + 2 + 20 + 16);
    this.modalButton2.text = '';

    const r = restartRect(m);
    bevel(g, r, true, PAL.face);
    this.modalRestart.text = 'Restart';
    this.modalRestart.position.set(r.x + r.w / 2, r.y + r.h / 2);
  }

  private drawVictoryModal(s: RunState, l: Layout): void {
    const g = this.modalG;
    const m = victoryModalRect(l);
    g.rect(l.client.x, l.client.y, l.client.w, l.client.h).fill({ color: PAL.dark, alpha: 0.4 });

    bevel(g, m, true, PAL.face);
    g.rect(m.x + 2, m.y + 2, m.w - 4, 20).fill(PAL.title);
    this.modalTitle.text = 'Victory';
    this.modalTitle.position.set(m.x + 6, m.y + 2 + 10);

    this.modalMessage.text = [
      'All one hundred waves cleared.',
      `Kills — towers ${s.economy.kills.tower} · pointer ${s.economy.kills.pointer}`,
      `Salvage earned: $${formatNumber(s.economy.earned)}`,
      `Integrity remaining: ${s.integrity}`,
    ].join('\n');
    this.modalMessage.position.set(m.x + 12, m.y + 2 + 20 + 16);

    const b = victoryButtons(m);
    bevel(g, b.endless, true, PAL.face);
    this.modalButton2.text = 'Endless';
    this.modalButton2.position.set(b.endless.x + b.endless.w / 2, b.endless.y + b.endless.h / 2);

    bevel(g, b.restart, true, PAL.face);
    this.modalRestart.text = 'Restart Windows';
    this.modalRestart.position.set(b.restart.x + b.restart.w / 2, b.restart.y + b.restart.h / 2);
  }
}

/** A Windows checkbox: a white sunken box with the standard tick glyph when checked. */
function drawCheckbox(g: Graphics, r: Rect, checked: boolean): void {
  const box: Rect = { x: r.x, y: r.y + Math.floor((r.h - 12) / 2), w: 12, h: 12 };
  bevel(g, box, false, PAL.highlight);
  if (checked) {
    g.moveTo(box.x + 2, box.y + 6).lineTo(box.x + 5, box.y + 9).lineTo(box.x + 10, box.y + 3).stroke({ width: 1, color: PAL.text });
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
