import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { bevel, FONT, FONT_SIZE, PAL, pointInRect, type Layout, type Rect } from './chrome.ts';
import { getArtTexture } from './art.ts';
import { canAfford, POINTER_KILL_BONUS } from '../core/economy.ts';
import { formatNumber } from '../core/format.ts';
import { BUFF_NAMES, buffSecondsLeft, hasUpgrade, revealedUpgrades, upgradeBuff } from '../core/upgrades.ts';
import { clickDamage, comboMultiplier, critChance, overclockCeiling, pointerInfo, pointerUpgradeState } from '../core/pointer.ts';
import { autoWaveStatus, canCycleLevel, currentPath, cursorMaintenanceStatus, isFinalWave, noBuildActive, NO_BUILD_MESSAGE, overclockCap, pointerDamageMult, selectedTower, STARTING_INTEGRITY, towerCost, towerUnlocked, type RunState } from '../core/state.ts';

import {
  cursorClickDamage,
  cursorClickRate,
  cursorRadius,
  effectiveStats,
  hasBranches,
  isOffline,
  isRepairing,
  repairCost,
  repairHealRate,
  repairHealingCount,
  repairHpToRestore,
  repairRadius,
  repairRemainingSeconds,
  sellValue,
  TOWER_KINDS,
  TOWER_STATS,
  upgradeCost,
  type Branch,
  type TowerKind,
} from '../core/towers.ts';
import { earlyCallBonus, MODIFIER_NAMES, typeBossKindForWave, waveDef, WAVE_COUNT, waveModifiers } from '../core/waves.ts';
import { ENEMY_STATS } from '../core/enemies.ts';
import { branchName, fmtClickDamage, targetModeDisplay } from './tooltipText.ts';

/**
 * The HUD: status-bar text (hint / wave / speed), the integrity and salvage readouts, the pointer stage and
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
  | 'repairTower'
  | 'target'
  | 'branchA'
  | 'branchB'
  | 'branchC'
  | 'restore'
  | 'upgrades';

const NOTICE_TICKS = 150;

const SPEC_FONT_SIZE = FONT_SIZE.small;
const SPEC_BUTTON_PAD = 12;
const SPEC_BUTTON_MAX = 64;

/** The left panel's sunken readouts (integrity, salvage) share one text size. */
export const READOUT_FONT_SIZE = FONT_SIZE.body;

/** The salvage readout's value: `$1,234`, or `---` while a Blackout wave masks it. */
export function salvageReadoutText(s: RunState): string {
  return s.modifiers.includes('blackout') && s.phase === 'wave' ? '---' : `$${formatNumber(s.economy.salvage)}`;
}

let metricsText: Text | null = null;

const TEXT_WIDTH_CACHE_MAX = 256;
const textWidthCache = new Map<string, number>();

/** Measure a string with the same font the HUD draws with, without adding it to the scene. */
export function textWidth(text: string, size: number): number {
  const key = `${size}|${text}`;
  const cached = textWidthCache.get(key);
  if (cached !== undefined) return cached;

  // Headless (the smoke harness) has no canvas to rasterize text; estimate from the glyph count so
  // the layout model can still be computed without a renderer.
  if (typeof document === 'undefined') {
    const estimate = Math.ceil(text.length * size * 0.6);
    if (textWidthCache.size >= TEXT_WIDTH_CACHE_MAX) textWidthCache.clear();
    textWidthCache.set(key, estimate);
    return estimate;
  }

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

function fitButtonText(preferred: string, fallbacks: readonly string[], maxWidth = SPEC_BUTTON_MAX): string {
  for (const candidate of [preferred, ...fallbacks]) {
    if (Math.ceil(textWidth(candidate, SPEC_FONT_SIZE)) + SPEC_BUTTON_PAD <= maxWidth) {
      return candidate;
    }
  }
  return fallbacks[fallbacks.length - 1] ?? preferred;
}

/** Short button labels for branch names too long for a full-width row; the tooltip keeps the full
 *  name and description. */
const BRANCH_LABEL_FALLBACKS: Readonly<Partial<Record<TowerKind, Readonly<Partial<Record<Branch, string>>>>>> = {
  cursor: { B: 'Wide' },
};

/** The label a branch button shows: the full name, or a short form when the full name overflows. */
function branchButtonLabel(kind: TowerKind, branch: Branch, maxWidth: number): string {
  const preferred = branchName(kind, branch);
  const fallback = BRANCH_LABEL_FALLBACKS[kind]?.[branch];
  return fallback === undefined ? preferred : fitButtonText(preferred, [fallback], maxWidth);
}

interface BranchButton {
  branch: Branch;
  label: string;
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

interface MapRow {
  row: Rect;
  next: Rect;
}

interface HudLayout {
  integrity: Rect;
  /** The sunken salvage readout: under the integrity block, above the route line and the shop. */
  salvage: Rect;
  route: Rect | null;
  detail: TowerDetailLayout | null;
  towers: ReadonlyArray<{ kind: TowerKind; rect: Rect }>;
  wave: Rect;
  autoWave: Rect;
  map: MapRow | null;
}

/** One framed info section in the right panel (title bar plus 13 px rows). */
export interface InfoSection {
  rect: Rect;
  title: string;
  rows: string[];
}

/** The pointer's own section: title, three info rows, the upgrade button and the Override box. */
export interface PointerSection {
  rect: Rect;
  rows: { rect: Rect; text: string }[];
  upgrade: Rect;
  upgradeText: string;
  upgradeEnabled: boolean;
  override: Rect | null;
}

/**
 * GLOBAL UPGRADES: two clickable rows. The first opens the Restore dialog (its only entry point), the
 * second the run's Global Upgrades dialog (docs/GLOBAL-UPGRADES.md §6.1).
 */
export interface GlobalUpgradesSection extends InfoSection {
  restore: Rect;
  upgrades: Rect;
  /** The System Tray buff readout while a buff is live; display only, not a link. */
  buff: Rect | null;
}

export interface RightPanelLayout {
  nextWave: InfoSection;
  kills: InfoSection;
  pointer: PointerSection;
  globalUpgrades: GlobalUpgradesSection;
}

/** The System Tray buff row while a buff is live (`Turbo — 14 s`), or null when none is. */
export function buffRowText(s: RunState): string | null {
  const b = upgradeBuff(s);
  return b ? `${BUFF_NAMES[b.kind]} — ${buffSecondsLeft(s)} s` : null;
}

/** Revealed upgrades the run does not own yet — affordable or not. Drives the Upgrades row's text
 *  and its colour, so the two can never disagree. */
export function upgradesNewCount(s: Pick<RunState, 'wave' | 'upgrades'>): number {
  return revealedUpgrades(s).filter((d) => !hasUpgrade(s, d.id)).length;
}

/** The Upgrades row's text: how many revealed upgrades are not owned yet, or why there are none. */
export function upgradesRowText(s: RunState): string {
  if (revealedUpgrades(s).length === 0) return 'Upgrades — none yet';
  const fresh = upgradesNewCount(s);
  if (fresh === 0) return 'Upgrades — all owned';
  return `Upgrades — ${fresh} new`;
}

export function computeHud(l: Layout, s: RunState): HudLayout {
  const pad = 6;
  const x = l.leftPanel.x + pad;
  const w = l.leftPanel.w - pad * 2;
  const y = l.leftPanel.y + pad;

  let cy = y;
  const integrity: Rect = { x, y: cy, w, h: 26 };
  cy += 26 + 4;
  // Salvage sits directly above the shop (or the detail view), present in both layouts.
  const salvage: Rect = { x, y: cy, w, h: 26 };
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

    // Walls and the repair tower never target, so they have no target-mode row.
    const target: Rect | null = tower.kind === 'wall' || tower.kind === 'repair' ? null : { x: innerX, y: cy, w: innerW, h: 24 };
    if (target) cy += 24 + 4;

    const cost = upgradeCost(tower);
    let upgrade: Rect | null = null;
    if (cost !== null && (tower.tier !== 2 || !hasBranches(tower.kind))) {
      upgrade = { x: innerX, y: cy, w: innerW, h: 24 };
      cy += 24 + 4;
    }

    const branches: BranchButton[] = [];
    if (tower.tier === 2 && hasBranches(tower.kind)) {
      const gap = 4;
      const list: Branch[] = tower.kind === 'wall' || tower.kind === 'cursor' ? ['A', 'B', 'C'] : ['A', 'B'];
      if (list.length > 2) {
        // A three-branch tower (wall, cursor) stacks its choices vertically — one full-width button
        // per row — so a long branch name shrinks to fit instead of overprinting its neighbour.
        for (const branch of list) {
          branches.push({
            branch,
            label: branchButtonLabel(tower.kind, branch, innerW),
            rect: { x: innerX, y: cy, w: innerW, h: 24 },
          });
          cy += 24 + 4;
        }
      } else {
        const bw = Math.floor((innerW - gap * (list.length - 1)) / list.length);
        list.forEach((branch, i) => {
          const x = innerX + i * (bw + gap);
          const w = i === list.length - 1 ? innerX + innerW - x : bw;
          branches.push({ branch, label: branchName(tower.kind, branch), rect: { x, y: cy, w, h: 24 } });
        });
        cy += 24 + 4;
      }
    }

    // A tower with hit points gains a Repair button above Sell. The action is refused at full health
    // and while a repair runs, but the row always exists so its disabled reason shows.
    const repair: Rect | null = tower.maxHp > 0 ? { x: innerX, y: cy, w: innerW, h: 24 } : null;
    if (repair) cy += 24 + 4;

    const sell: Rect = { x: innerX, y: cy, w: innerW, h: 24 };
    cy += 24;
    const box: Rect = { x, y: boxTop, w, h: cy - boxTop + 6 };
    detail = { box, name, stats, route: routeRow, target, upgrade, branches, repair, sell };
    cy = box.y + box.h + 6;
  }

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

  return { integrity, salvage, route, detail, towers, wave, autoWave, map };
}

const SECTION_TITLE_H = 18;
const SECTION_ROW_H = 18;
const SECTION_PAD_TOP = 6;
const SECTION_PAD_BOTTOM = 6;
const SECTION_GAP = 6;

function infoSectionHeight(rows: number): number {
  return SECTION_PAD_TOP + SECTION_TITLE_H + rows * SECTION_ROW_H + SECTION_PAD_BOTTOM;
}

function pct(fraction: number): number {
  return Math.round(fraction * 100);
}

/**
 * The right column: NEXT WAVE, KILLS, POINTER (the pointer's full home), then GLOBAL UPGRADES with
 * its Restore and Upgrades rows. Sections stack by measured height, so rows can be added to any
 * section later without re-measuring the others.
 */
export function computeRightPanel(l: Layout, s: RunState): RightPanelLayout {
  const pad = 6;
  const x = l.rightPanel.x + pad;
  const w = l.rightPanel.w - pad * 2;
  let y = l.rightPanel.y + pad;

  // The combo readout floats above the first section while the multiplier is above x1.
  if (comboMultiplier(s.pointer) > 1) y += 20;

  const wave = s.wave + 1;
  const def = waveDef(wave);
  const composition = def ? def.groups.map((grp) => `${grp.count} x ${grp.kind}`) : [];
  const mods = waveModifiers(wave);
  if (mods.length > 0) composition.unshift(`mod: ${mods.map((m) => MODIFIER_NAMES[m]).join(' + ')}`);
  // Name the type boss ahead of time so its first appearance is telegraphed before it spawns.
  const typeBoss = typeBossKindForWave(wave);
  if (typeBoss) composition.unshift(`BOSS: ${ENEMY_STATS[typeBoss].name}`);

  const nextWave: InfoSection = {
    rect: { x, y, w, h: infoSectionHeight(composition.length) },
    title: 'NEXT WAVE',
    rows: composition,
  };
  y += nextWave.rect.h + SECTION_GAP;

  const kills: InfoSection = {
    rect: { x, y, w, h: infoSectionHeight(3) },
    title: 'KILLS',
    rows: [
      `by towers: ${s.economy.kills.tower}`,
      `by pointer: ${s.economy.kills.pointer}`,
      `x${POINTER_KILL_BONUS} on pointer kills`,
    ],
  };
  y += kills.rect.h + SECTION_GAP;

  const pointer = computePointerSection(s, x, y, w);
  y += pointer.rect.h + SECTION_GAP;

  const rowY = (i: number): number => y + SECTION_PAD_TOP + SECTION_TITLE_H + i * SECTION_ROW_H;
  // A live System Tray buff adds a third, non-clickable row under the two links.
  const buff = buffRowText(s);
  const globalRows = [`Restore — ${formatNumber(s.rp)} RP`, upgradesRowText(s)];
  if (buff) globalRows.push(buff);
  const globalUpgrades: GlobalUpgradesSection = {
    rect: { x, y, w, h: infoSectionHeight(globalRows.length) },
    title: 'GLOBAL UPGRADES',
    rows: globalRows,
    restore: { x: x + 2, y: rowY(0), w: w - 4, h: SECTION_ROW_H },
    upgrades: { x: x + 2, y: rowY(1), w: w - 4, h: SECTION_ROW_H },
    buff: buff ? { x: x + 2, y: rowY(2), w: w - 4, h: SECTION_ROW_H } : null,
  };

  return { nextWave, kills, pointer, globalUpgrades };
}

function computePointerSection(s: RunState, x: number, y: number, w: number): PointerSection {
  const name = pointerInfo(s.pointer).name;
  const dmg = fmtClickDamage(clickDamage(s.pointer));
  const stage = s.pointer.stage;
  const overclock =
    stage >= 2 ? `Overclock ${s.pointer.clickLevel} / ${overclockCeiling(s.wave, overclockCap(s))}` : 'Overclock —';
  const crit = `Crit ${pct(critChance(false, false))}% · mark ${pct(critChance(true, false))}% · weak ${pct(critChance(false, true))}%`;

  const rows = [`${name} · click ${dmg}`, overclock, crit];

  const hasOverride = stage >= 2;
  const innerX = x + 4;
  const innerW = w - 8;
  const h =
    SECTION_PAD_TOP + SECTION_TITLE_H + rows.length * SECTION_ROW_H + 24 + (hasOverride ? 22 : 0) + SECTION_PAD_BOTTOM;
  const rect: Rect = { x, y, w, h };

  const rowRects = rows.map((text, i) => ({
    rect: { x: x + 6, y: y + SECTION_PAD_TOP + SECTION_TITLE_H + i * SECTION_ROW_H, w: w - 12, h: SECTION_ROW_H },
    text,
  }));

  const upgradeY = y + SECTION_PAD_TOP + SECTION_TITLE_H + rows.length * SECTION_ROW_H;
  const upgrade: Rect = { x: innerX, y: upgradeY, w: innerW, h: 24 };
  const override: Rect | null = hasOverride ? { x: innerX, y: upgradeY + 24, w: innerW, h: 22 } : null;

  const state = pointerUpgradeState(s.wave, overclockCap(s), s.pointer);
  const cost = state.cost;
  const upgradeEnabled = state.block === null && cost !== null && canAfford(s.economy, cost);
  const upgradeText = cost === null ? 'Max level' : `Upgrade $${formatNumber(cost)}`;

  return { rect, rows: rowRects, upgrade, upgradeText, upgradeEnabled, override };
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
  const right = computeRightPanel(l, s);

  if (pointInRect(right.pointer.upgrade, px, py)) {
    return { action: 'pointer', enabled: right.pointer.upgradeEnabled };
  }
  if (right.pointer.override && pointInRect(right.pointer.override, px, py)) {
    return { action: 'override', enabled: true };
  }

  const frozen = noBuildActive(s);
  const tower = selectedTower(s);
  if (h.detail && tower) {
    const upgradePrice = upgradeCost(tower);
    const affordable = upgradePrice !== null && canAfford(s.economy, upgradePrice);
    if (h.detail.target && pointInRect(h.detail.target, px, py)) {
      return { action: 'target', enabled: !frozen && TOWER_STATS[tower.kind].targetLock === null && tower.kind !== 'cursor' };
    }
    if (h.detail.upgrade && pointInRect(h.detail.upgrade, px, py)) return { action: 'upgrade', enabled: !frozen && affordable };
    for (const b of h.detail.branches) {
      if (pointInRect(b.rect, px, py)) {
        const action = b.branch === 'A' ? 'branchA' : b.branch === 'B' ? 'branchB' : 'branchC';
        return { action, enabled: !frozen && affordable };
      }
    }
    if (h.detail.repair && pointInRect(h.detail.repair, px, py)) {
      const repairing = isRepairing(tower, s.clock);
      const full = repairHpToRestore(tower) <= 0;
      const affordableRepair = canAfford(s.economy, repairCost(tower));
      return { action: 'repairTower', enabled: !frozen && !repairing && !full && affordableRepair };
    }
    if (pointInRect(h.detail.sell, px, py)) return { action: 'sell', enabled: !frozen };
  } else {
    for (const t of h.towers) {
      if (pointInRect(t.rect, px, py)) {
        return { action: t.kind, enabled: !frozen && towerUnlocked(s, t.kind) && canAfford(s.economy, towerCost(s, t.kind)) };
      }
    }
  }

  if (h.map && pointInRect(h.map.next, px, py)) return { action: 'map', enabled: true };

  if (s.phase === 'build' || s.phase === 'wave') {
    if (pointInRect(h.wave, px, py)) return { action: 'wave', enabled: !isFinalWave(s) };
    if (pointInRect(h.autoWave, px, py)) return { action: 'auto', enabled: true };
  }

  if (pointInRect(right.globalUpgrades.upgrades, px, py)) return { action: 'upgrades', enabled: true };
  if (right.globalUpgrades.buff && pointInRect(right.globalUpgrades.buff, px, py)) return null;
  if (pointInRect(right.globalUpgrades.rect, px, py)) return { action: 'restore', enabled: true };

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
  private readonly checks = new Container();
  readonly checkSprites: Sprite[] = [];
  private checkIndex = 0;

  private readonly statusHint = makeText('');
  private readonly statusWave = makeText('');
  private readonly statusSpeed = makeText('');
  private readonly statusPaused = makeText('', true);
  private readonly cheatMarker = makeText('');
  private readonly integrity = makeText('');
  private readonly salvage = makeText('');
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
  private readonly globalTitle = makeText('GLOBAL UPGRADES', true);
  private readonly globalRows: Text[] = [makeText(''), makeText(''), makeText('')];

  constructor() {
    this.towerButtons = TOWER_KINDS.map(() => makeText(''));
    this.root.addChild(this.g, this.checks);
    for (const t of [
      this.statusHint,
      this.statusWave,
      this.statusSpeed,
      this.statusPaused,
      this.cheatMarker,
      this.integrity,
      this.salvage,
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
      this.globalTitle,
      ...this.globalRows,
      this.comboText,
    ]) {
      t.anchor.set(0, 0.5);
      this.root.addChild(t);
    }
    for (const t of this.branchButtons) t.anchor.set(0.5, 0.5);
    this.targetValue.anchor.set(1, 0.5);
    this.salvage.anchor.set(1, 0.5);
    this.integrity.style.fontSize = READOUT_FONT_SIZE;
    this.salvage.style.fontSize = READOUT_FONT_SIZE;
    this.mapNext.anchor.set(0.5, 0.5);
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
    this.cheatMarker.style.fill = PAL.maroon;
  }

  showNotice(message: string, ticks = NOTICE_TICKS): void {
    this.notice = message;
    this.noticeUntilTick = this.lastTick + ticks;
  }

  /** The pooled tick sprite for the `index`-th checkbox, grown on demand. */
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

  /** A Windows checkbox: a white sunken box with the standard tick glyph when checked. */
  private drawCheckbox(g: Graphics, r: Rect, checked: boolean): void {
    const box: Rect = { x: r.x, y: r.y + Math.floor((r.h - 12) / 2), w: 12, h: 12 };
    bevel(g, box, false, PAL.highlight);
    if (checked) {
      const spr = this.checkSprite(this.checkIndex++);
      const tex = getArtTexture('check', 12);
      if (tex !== null) {
        spr.texture = tex;
        spr.width = 12;
        spr.height = 12;
        spr.position.set(box.x + 6, box.y + 6);
        spr.rotation = 0;
        spr.alpha = 1;
        spr.tint = PAL.text;
      } else {
        spr.visible = false;
        g.moveTo(box.x + 2, box.y + 6).lineTo(box.x + 5, box.y + 9).lineTo(box.x + 10, box.y + 3).stroke({ width: 1, color: PAL.text });
      }
    }
  }

  draw(s: RunState, l: Layout, hoverHud: HudAction | null): void {
    const g = this.g;
    g.clear();
    this.checkIndex = 0;

    // Status bar text.
    const sp = l.statusPanes;
    this.lastTick = s.tick;
    if (this.notice !== '' && s.tick >= this.noticeUntilTick) this.notice = '';

    // A small sunken CHEATS chip sits on the right of the hint pane while a cheat is active.
    if (s.cheatsUsed) {
      const cr: Rect = { x: sp.left.x + sp.left.w - 64 - 4, y: sp.left.y + 2, w: 64, h: sp.left.h - 4 };
      bevel(g, cr, false, PAL.face);
      this.cheatMarker.text = 'CHEATS';
      this.cheatMarker.position.set(cr.x + 6, cr.y + Math.floor(cr.h / 2));
    } else {
      this.cheatMarker.text = '';
    }

    // A paused run shows a sunken PAUSED box and keeps the speed readout; otherwise the hint shows.
    if (s.paused) {
      const pr: Rect = { x: sp.left.x + 4, y: sp.left.y + 2, w: 64, h: sp.left.h - 4 };
      bevel(g, pr, false, PAL.face);
      this.statusPaused.text = 'PAUSED';
      this.statusPaused.position.set(pr.x + 6, pr.y + Math.floor(pr.h / 2));
      this.statusHint.text = '';
    } else {
      this.statusPaused.text = '';
      this.statusHint.text = this.notice || autoWaveStatus(s) || (noBuildActive(s) ? NO_BUILD_MESSAGE : hintFor(s));
      this.statusHint.position.set(sp.left.x + 4, sp.left.y + Math.floor(sp.left.h / 2));
    }

    const displayWave = s.phase === 'build' ? s.wave + 1 : s.wave;
    let waveLabel = s.endless ? `Wave ${displayWave}` : `Wave ${displayWave} / ${WAVE_COUNT}`;
    if (s.phase === 'wave' && s.modifiers.length > 0) {
      waveLabel += ` · ${s.modifiers.map((m) => MODIFIER_NAMES[m]).join(' + ')}`;
    }
    this.statusWave.text = waveLabel;
    this.statusWave.position.set(sp.middle.x + 4, sp.middle.y + Math.floor(sp.middle.h / 2));
    this.statusSpeed.text = `×${s.speed}`;
    this.statusSpeed.position.set(sp.speed.x + 4, sp.speed.y + Math.floor(sp.speed.h / 2));

    // Toolbar.
    const h = computeHud(l, s);

    bevel(g, h.integrity, false, PAL.face);
    this.integrity.text = `Integrity: ${s.integrity}/${STARTING_INTEGRITY}`;
    this.integrity.position.set(h.integrity.x + 6, h.integrity.y + Math.floor(h.integrity.h / 2));

    bevel(g, h.salvage, false, PAL.face);
    this.salvage.text = salvageReadoutText(s);
    this.salvage.position.set(h.salvage.x + h.salvage.w - 6, h.salvage.y + Math.floor(h.salvage.h / 2));

    this.drawTowerControls(s, h, hoverHud);

    if (h.route) {
      this.route.text = `Route: ${currentPath(s).length} tiles`;
      this.route.position.set(h.route.x + 6, h.route.y + Math.floor(h.route.h / 2));
    } else {
      this.route.text = '';
    }

    if (h.map) {
      const name = s.level.name;
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

      this.drawCheckbox(g, h.autoWave, s.autoWave);
      this.autoWaveButton.text = 'Auto';
      this.autoWaveButton.style.fill = PAL.text;
      this.autoWaveButton.position.set(h.autoWave.x + 20, h.autoWave.y + Math.floor(h.autoWave.h / 2));
    } else {
      this.waveButton.text = '';
      this.autoWaveButton.text = '';
    }

    this.drawRightPanel(s, l, hoverHud);

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

    for (let i = this.checkIndex; i < this.checkSprites.length; i++) this.checkSprites[i].visible = false;
  }

  private drawTowerControls(s: RunState, h: HudLayout, hoverHud: HudAction | null): void {
    const g = this.g;
    const frozen = noBuildActive(s);
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
      this.towerName.text = `${TOWER_STATS[tower.kind].name}  T${tower.tier}${branch}${isOffline(tower) ? ' — OFFLINE' : ''}`;
      this.towerName.position.set(d.name.x, d.name.y + Math.floor(d.name.h / 2));

      if (tower.kind === 'wall') {
        this.towerStats.text = tower.branch === null ? `HP ${Math.ceil(tower.hp)}` : `HP ${Math.ceil(tower.hp)}/${tower.maxHp}`;
      } else if (tower.kind === 'cursor') {
        if (tower.tier >= 3 && tower.branch === 'C') {
          this.towerStats.text = cursorMaintenanceStatus(s, tower) ?? 'Idle';
        } else {
          const rate = cursorClickRate(tower);
          const radius = cursorRadius(tower);
          const dmg = cursorClickDamage(tower, clickDamage(s.pointer), pointerDamageMult(s));
          this.towerStats.text = `${rate.toFixed(1)}/s  dmg ${fmtClickDamage(dmg)}  rng ${radius.toFixed(1)}`;
        }
      } else if (tower.kind === 'repair') {
        const heal = repairHealRate(tower);
        const radius = repairRadius(tower);
        const healed = repairHealingCount(s.towers, tower, s.clock);
        this.towerStats.text = `${heal.toFixed(1)} HP/s  rng ${radius.toFixed(1)}  healing ${healed}`;
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
        const fixed = frozen || TOWER_STATS[tower.kind].targetLock !== null || tower.kind === 'cursor';
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
        const enabled = !frozen && canAfford(s.economy, price);
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
        const enabled = !frozen && price !== null && canAfford(s.economy, price);
        drawButton(
          g,
          b.rect,
          enabled,
          hoverHud === (b.branch === 'A' ? 'branchA' : b.branch === 'B' ? 'branchB' : 'branchC'),
        );
        text.text = b.label;
        text.style.fill = enabled ? PAL.text : PAL.shadow;
        text.position.set(b.rect.x + b.rect.w / 2, b.rect.y + Math.floor(b.rect.h / 2));
      }

      if (d.repair) {
        const repairing = isRepairing(tower, s.clock);
        const hp = repairHpToRestore(tower);
        const cost = repairCost(tower);
        const enabled = !frozen && !repairing && hp > 0 && canAfford(s.economy, cost);
        drawButton(g, d.repair, enabled, hoverHud === 'repairTower');
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

      drawButton(g, d.sell, !frozen, hoverHud === 'sell');
      this.sellButton.text = `Sell $${formatNumber(sellValue(tower, s.treeEffects.sellRefund))}`;
      this.sellButton.style.fill = frozen ? PAL.shadow : PAL.text;
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
      const enabled = !frozen && towerUnlocked(s, kind) && canAfford(s.economy, towerCost(s, kind));
      const armed = s.selected === kind;
      // Onboarding: on a fresh profile the Gun button pulses every 2 s until the first placement.
      const pulse =
        kind === 'gun' && s.onboarding && !s.placedFirstTower && enabled && s.tick % 120 < 24;
      drawButton(g, rect, enabled, hoverHud === kind, armed);
      if (pulse) {
        g.rect(rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2).stroke({ width: 2, color: PAL.title });
      }
      const t = this.towerButtons[i];
      t.text = `${TOWER_STATS[kind].name}  $${formatNumber(towerCost(s, kind))}`;
      t.style.fill = enabled ? (armed ? PAL.title : PAL.text) : PAL.shadow;
      t.position.set(rect.x + 6, rect.y + Math.floor(rect.h / 2));
    }
  }

  private drawRightPanel(s: RunState, l: Layout, hoverHud: HudAction | null): void {
    const g = this.g;
    const rp = computeRightPanel(l, s);

    // Combo readout: visible while the multiplier is above x1, so the timer ticking down is legible.
    const mult = comboMultiplier(s.pointer);
    if (mult > 1) {
      this.comboText.text = `COMBO x${mult.toFixed(1)}`;
      this.comboText.position.set(rp.nextWave.rect.x + 2, rp.nextWave.rect.y - 10);
      this.comboText.visible = true;
    } else {
      this.comboText.text = '';
      this.comboText.visible = false;
    }

    this.drawInfoSection(g, this.nextWaveTitle, this.nextWaveRows, rp.nextWave);
    this.drawInfoSection(g, this.killsTitle, this.killsRows, rp.kills);

    // POINTER: the pointer's home — stage, click damage, overclock, crits, the upgrade and Override.
    bevel(g, rp.pointer.rect, false, PAL.face);
    this.pointerTitle.text = 'POINTER';
    this.pointerTitle.position.set(
      rp.pointer.rect.x + 6,
      rp.pointer.rect.y + SECTION_PAD_TOP + SECTION_TITLE_H / 2,
    );
    for (let i = 0; i < this.pointerRows.length; i++) {
      const row = rp.pointer.rows[i];
      if (row) {
        this.pointerRows[i].text = row.text;
        this.pointerRows[i].style.fill = PAL.text;
        this.pointerRows[i].position.set(row.rect.x, row.rect.y + Math.floor(row.rect.h / 2));
      } else {
        this.pointerRows[i].text = '';
      }
    }
    drawButton(g, rp.pointer.upgrade, rp.pointer.upgradeEnabled, hoverHud === 'pointer');
    this.pointerButton.text = rp.pointer.upgradeText;
    this.pointerButton.style.fill = rp.pointer.upgradeEnabled ? PAL.text : PAL.shadow;
    this.pointerButton.position.set(
      rp.pointer.upgrade.x + 6,
      rp.pointer.upgrade.y + Math.floor(rp.pointer.upgrade.h / 2),
    );
    if (rp.pointer.override) {
      this.drawCheckbox(g, rp.pointer.override, s.pointer.manualOverride);
      this.pointerOverrideButton.text = 'Override';
      this.pointerOverrideButton.style.fill = PAL.text;
      this.pointerOverrideButton.position.set(
        rp.pointer.override.x + 20,
        rp.pointer.override.y + Math.floor(rp.pointer.override.h / 2),
      );
    } else {
      this.pointerOverrideButton.text = '';
    }

    // GLOBAL UPGRADES: the Restore row and the Upgrades row, each a link to its dialog.
    this.drawInfoSection(g, this.globalTitle, this.globalRows, rp.globalUpgrades);
    this.globalRows[0].style.fill = PAL.title;
    this.globalRows[1].style.fill = upgradesNewCount(s) > 0 ? PAL.title : PAL.text;
    this.globalRows[2].style.fill = PAL.text;
  }

  private drawInfoSection(g: Graphics, title: Text, rows: Text[], section: InfoSection): void {
    const rect = section.rect;
    bevel(g, rect, false, PAL.face);
    title.text = section.title;
    title.position.set(rect.x + 6, rect.y + SECTION_PAD_TOP + SECTION_TITLE_H / 2);
    for (let i = 0; i < rows.length; i++) {
      rows[i].text = i < section.rows.length ? section.rows[i] : '';
      rows[i].position.set(
        rect.x + 6,
        rect.y + SECTION_PAD_TOP + SECTION_TITLE_H + i * SECTION_ROW_H + SECTION_ROW_H / 2,
      );
    }
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
