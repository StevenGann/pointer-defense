import { towerName, enemyName, pointerName, modifierName } from '../i18n/names.ts';
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { bevel, CONTROL_BOX_H, CONTROL_BOX_W, FONT, FONT_SIZE, PAL, pointInRect, type Layout, type Rect } from './chrome.ts';
import { getArtTexture } from './art.ts';
import { canAfford, POINTER_KILL_BONUS } from '../core/economy.ts';
import { formatNumber } from '../core/format.ts';
import { BUFF_NAMES, buffSecondsLeft, hasUpgrade, revealedUpgrades, upgradeBuff } from '../core/upgrades.ts';
import { clickDamage, comboMultiplier, critChance, overclockCeiling, pointerUpgradeState } from '../core/pointer.ts';
import { autoWaveStatus, canCycleLevel, currentPath, cursorMaintenanceStatus, isFinalWave, noBuildActive, NO_BUILD_MESSAGE, overclockCap, pointerDamageMult, selectedTower, STARTING_INTEGRITY, towerCost, towerUnlocked, type RunState } from '../core/state.ts';

import {
  BRANCHES,
  cursorClickDamage,
  cursorClickRate,
  cursorRadius,
  effectiveStats,
  hasBranches,
  isOffline,
  isRepairing,
  kindMaxTier,
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
import { earlyCallBonus, typeBossKindForWave, waveDef, waveModifiers } from '../core/waves.ts';
import type { QualityLevel } from '../core/quality.ts';
import { branchName, fmtClickDamage, targetModeDisplay } from './tooltipText.ts';
import { t } from '../i18n/index.ts';
import { isRtl, textX } from './direction.ts';

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
  | 'closeTower'
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
  return s.modifiers.includes('blackout') && s.phase === 'wave' ? '---' : t('hud.salvage', { amount: formatNumber(s.economy.salvage) });
}

/**
 * The status-bar wave label: `Wave 12 / 30 · Daily` in a daily, `Wave 12 / 100` in a normal run,
 * `Wave 101` in endless, with the active modifiers appended mid-wave.
 */
export function waveLabel(s: RunState): string {
  const displayWave = s.phase === 'build' ? s.wave + 1 : s.wave;
  let label: string;
  if (s.daily !== null) label = t('hud.waveDaily', { wave: displayWave, total: s.waveLimit });
  else if (s.endless) label = t('hud.wave', { wave: displayWave });
  else label = t('hud.waveOf', { wave: displayWave, total: s.waveLimit });
  if (s.phase === 'wave' && s.modifiers.length > 0) {
    label += t('hud.waveModifiers', { modifiers: s.modifiers.map((m) => modifierName(m)).join(' + ') });
  }
  return label;
}

/** What the governor's current state contributes to the status-bar speed slot. */
export interface HudPerf {
  quality: QualityLevel;
  /** The smoothed frame time in ms, for the `?fps=1` readout. */
  frameMs: number;
  /** Frames per second, derived from `frameMs`, for the `?fps=1` readout. */
  fps: number;
  /** Whether `?fps=1` is enabled; the readout costs nothing when it is off. */
  showFps: boolean;
}

/** The status-bar speed slot: the multiplier alone. The perf readout has its own slot. */
export function speedStatusText(speed: number): string {
  return t('hud.speed', { speed });
}

/**
 * The `?fps=1` readout and the quality indicator, right-aligned against the wave pane: the speed
 * pane is 44 px wide and cannot hold it. Empty when there is nothing to report.
 */
export function statusPerfText(perf: HudPerf | null): string {
  if (perf === null) return '';
  const parts: string[] = [];
  if (perf.showFps) parts.push(t('hud.perfFrameMs', { ms: perf.frameMs.toFixed(1) }), t('hud.perfFps', { fps: perf.fps }));
  if (perf.quality !== 'full' || perf.showFps) parts.push(t('hud.perfQuality', { quality: perf.quality }));
  return parts.join(' · ');
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
  cursor: { B: t('hud.branchWide') },
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
  close: Rect;
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
  return b ? t('hud.buffRow', { name: BUFF_NAMES[b.kind], seconds: buffSecondsLeft(s) }) : null;
}

/** Revealed upgrades the run does not own yet — affordable or not. Drives the Upgrades row's text
 *  and its colour, so the two can never disagree. */
export function upgradesNewCount(s: Pick<RunState, 'wave' | 'upgrades'>): number {
  return revealedUpgrades(s).filter((d) => !hasUpgrade(s, d.id)).length;
}

/** The Upgrades row's text: how many revealed upgrades are not owned yet, or why there are none. */
export function upgradesRowText(s: RunState): string {
  if (revealedUpgrades(s).length === 0) return t('hud.upgradesNone');
  const fresh = upgradesNewCount(s);
  if (fresh === 0) return t('hud.upgradesAllOwned');
  return t('hud.upgradesNew', { count: fresh });
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
    // The detail pane's title row carries a Win95 close box on its outer edge, the same control the
    // help window uses, so the shop list is one click away instead of a click on the board.
    const close: Rect = {
      x: isRtl() ? name.x : name.x + name.w - CONTROL_BOX_W,
      y: name.y + Math.floor((name.h - CONTROL_BOX_H) / 2),
      w: CONTROL_BOX_W,
      h: CONTROL_BOX_H,
    };
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
      const list: readonly Branch[] = tower.kind === 'wall' || tower.kind === 'cursor' ? BRANCHES : BRANCHES.slice(0, 2);
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
    detail = { box, name, close, stats, route: routeRow, target, upgrade, branches, repair, sell };
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
  const composition = def ? def.groups.map((grp) => t('hud.compositionEntry', { count: grp.count, kind: enemyName(grp.kind) })) : [];
  const mods = waveModifiers(wave);
  if (mods.length > 0) composition.unshift(t('hud.compositionMods', { modifiers: mods.map((m) => modifierName(m)).join(' + ') }));
  // Name the type boss ahead of time so its first appearance is telegraphed before it spawns.
  const typeBoss = typeBossKindForWave(wave);
  if (typeBoss) composition.unshift(t('hud.compositionBoss', { name: enemyName(typeBoss) }));

  const nextWave: InfoSection = {
    rect: { x, y, w, h: infoSectionHeight(composition.length) },
    title: t('hud.nextWaveTitle'),
    rows: composition,
  };
  y += nextWave.rect.h + SECTION_GAP;

  const kills: InfoSection = {
    rect: { x, y, w, h: infoSectionHeight(3) },
    title: t('hud.killsTitle'),
    rows: [
      t('hud.killsByTower', { count: s.economy.kills.tower }),
      t('hud.killsByPointer', { count: s.economy.kills.pointer }),
      t('hud.killsPointerBonus', { bonus: POINTER_KILL_BONUS }),
    ],
  };
  y += kills.rect.h + SECTION_GAP;

  const pointer = computePointerSection(s, x, y, w);
  y += pointer.rect.h + SECTION_GAP;

  const rowY = (i: number): number => y + SECTION_PAD_TOP + SECTION_TITLE_H + i * SECTION_ROW_H;
  // A live System Tray buff adds a third, non-clickable row under the two links.
  const buff = buffRowText(s);
  const globalRows = [t('hud.restoreRow', { rp: formatNumber(s.rp) }), upgradesRowText(s)];
  if (buff) globalRows.push(buff);
  const globalUpgrades: GlobalUpgradesSection = {
    rect: { x, y, w, h: infoSectionHeight(globalRows.length) },
    title: t('hud.globalUpgradesTitle'),
    rows: globalRows,
    restore: { x: x + 2, y: rowY(0), w: w - 4, h: SECTION_ROW_H },
    upgrades: { x: x + 2, y: rowY(1), w: w - 4, h: SECTION_ROW_H },
    buff: buff ? { x: x + 2, y: rowY(2), w: w - 4, h: SECTION_ROW_H } : null,
  };

  return { nextWave, kills, pointer, globalUpgrades };
}

/** Split a row at its ` · ` separators so no line is wider than `maxWidth`; never breaks a part. */
export function wrapRowText(text: string, maxWidth: number, size: number): string[] {
  if (Math.ceil(textWidth(text, size)) <= maxWidth) return [text];
  const parts = text.split(' · ');
  const out: string[] = [];
  let current = '';
  for (const part of parts) {
    const next = current === '' ? part : current + ' · ' + part;
    if (current !== '' && Math.ceil(textWidth(next, size)) > maxWidth) {
      out.push(current);
      current = part;
    } else {
      current = next;
    }
  }
  if (current !== '') out.push(current);
  return out;
}

function computePointerSection(s: RunState, x: number, y: number, w: number): PointerSection {
  const name = pointerName(s.pointer.stage);
  const dmg = fmtClickDamage(clickDamage(s.pointer));
  const stage = s.pointer.stage;
  const overclock =
    stage >= 2 ? t('hud.pointerOverclock', { level: s.pointer.clickLevel, ceiling: overclockCeiling(s.wave, overclockCap(s)) }) : t('hud.pointerOverclockNone');
  const crit = t('hud.pointerCrit', {
    crit: pct(critChance(false, false)),
    mark: pct(critChance(true, false)),
    weak: pct(critChance(false, true)),
  });

  // The right column is 156 px wide: the crit line is too long to fit on one row, so every row is
  // wrapped at its separators rather than clipped or shrunk.
  const rowWidth = w - 12 - 4;
  const rows = [t('hud.pointerNameClick', { name, damage: dmg }), overclock, crit].flatMap((text) =>
    wrapRowText(text, rowWidth, FONT_SIZE.body),
  );

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
  const upgradeText = cost === null ? t('hud.maxLevel') : t('hud.pointerUpgrade', { cost: formatNumber(cost) });

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
    if (pointInRect(h.detail.close, px, py)) return { action: 'closeTower', enabled: true };
    const upgradePrice = upgradeCost(tower);
    const affordable = upgradePrice !== null && canAfford(s.economy, upgradePrice);
    if (h.detail.target && pointInRect(h.detail.target, px, py)) {
      return { action: 'target', enabled: !frozen && TOWER_STATS[tower.kind].targetLock === null && tower.kind !== 'cursor' };
    }
    if (h.detail.upgrade && pointInRect(h.detail.upgrade, px, py)) return { action: 'upgrade', enabled: !frozen && affordable };
    for (const b of h.detail.branches) {
      if (pointInRect(b.rect, px, py)) {
        const action = b.branch === BRANCHES[0] ? 'branchA' : b.branch === BRANCHES[1] ? 'branchB' : 'branchC';
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

export function modalRect(l: Layout): Rect {
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

export function victoryModalRect(l: Layout): Rect {
  const w = 320;
  const h = 172;
  return {
    x: l.client.x + Math.floor((l.client.w - w) / 2),
    y: l.client.y + Math.floor((l.client.h - h) / 2),
    w,
    h,
  };
}

/**
 * Top edge of the end-of-run message block. The message is top-anchored and starts under the title
 * bar; it used to be centre-anchored, which made a four-line victory message grow upward into the bar.
 */
export function modalMessageTop(m: Rect): number {
  return m.y + 2 + 20 + 6;
}

export interface VictoryButtons {
  endless: Rect;
  restart: Rect;
}

export function victoryButtons(m: Rect): VictoryButtons {
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
  if (s.daily === null && pointInRect(b.endless, px, py)) return 'endless';
  if (pointInRect(b.restart, px, py)) return 'restart';
  return null;
}

/** The status-bar hint while the context-help mode is on (docs/CONTEXT-HELP.md). */
export const CONTEXT_HELP_HINT = t('status.contextHelp');

function hintFor(s: RunState): string {
  if (s.selected) return t('status.placeTower', { name: towerName(s.selected) });
  if (selectedTower(s)) return t('status.inspectTower');
  switch (s.phase) {
    case 'build':
      return s.towers.length === 0 ? t('status.pickTower') : t('status.startWave');
    case 'wave':
      return s.calledEarly
        ? t('status.shoot')
        : t('status.callEarly');
    case 'halted':
      return t('status.laneBroke');
    case 'victory':
      return t('status.victory');
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
  private readonly statusPerf: Text = makeText('');
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
  private readonly modalRestart = makeText(t('hud.restart'));
  private readonly modalButton2 = makeText('');
  private readonly nextWaveTitle = makeText(t('hud.nextWaveTitle'), true);
  private readonly nextWaveRows: Text[] = [makeText(''), makeText(''), makeText(''), makeText(''), makeText('')];
  private readonly killsTitle = makeText(t('hud.killsTitle'), true);
  private readonly killsRows: Text[] = [makeText(''), makeText(''), makeText('')];
  private readonly comboText = makeText('', true);
  private readonly pointerTitle = makeText(t('hud.pointerTitle'), true);
  private readonly pointerRows: Text[] = [makeText(''), makeText(''), makeText(''), makeText(''), makeText(''), makeText('')];
  private readonly globalTitle = makeText(t('hud.globalUpgradesTitle'), true);
  private readonly globalRows: Text[] = [makeText(''), makeText(''), makeText('')];

  constructor() {
    this.statusPerf.anchor.set(1, 0.5);
    this.towerButtons = TOWER_KINDS.map(() => makeText(''));
    this.root.addChild(this.g, this.checks);
    for (const t of [
      this.statusHint,
      this.statusWave,
      this.statusSpeed,
      this.statusPerf,
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
    for (const t of [this.modalTitle, this.modalRestart, this.modalButton2]) {
      t.anchor.set(0, 0.5);
      this.root.addChild(t);
    }
    // The message block is top-anchored: it is one line on a game over and four on a victory, so a
    // centred anchor grew upward into the title bar as soon as the second line arrived.
    this.modalMessage.anchor.set(0, 0);
    this.root.addChild(this.modalMessage);
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
    const box: Rect = { x: isRtl() ? r.x + r.w - 12 : r.x, y: r.y + Math.floor((r.h - 12) / 2), w: 12, h: 12 };
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

  draw(s: RunState, l: Layout, hoverHud: HudAction | null, perf: HudPerf | null = null, helpMode = false): void {
    const g = this.g;
    g.clear();
    this.checkIndex = 0;

    // Status bar text.
    const sp = l.statusPanes;
    this.lastTick = s.tick;
    if (this.notice !== '' && s.tick >= this.noticeUntilTick) this.notice = '';

    // A small sunken CHEATS chip sits on the far side of the hint pane while a cheat is active.
    if (s.cheatsUsed) {
      const cr: Rect = {
        x: isRtl() ? sp.left.x + 4 : sp.left.x + sp.left.w - 64 - 4,
        y: sp.left.y + 2,
        w: 64,
        h: sp.left.h - 4,
      };
      bevel(g, cr, false, PAL.face);
      this.cheatMarker.text = t('hud.cheats');
      const cp = textX(cr, 'start');
      this.cheatMarker.anchor.x = cp.anchor;
      this.cheatMarker.position.set(cp.x, cr.y + Math.floor(cr.h / 2));
    } else {
      this.cheatMarker.text = '';
    }

    // A paused run shows a sunken PAUSED box and keeps the speed readout; otherwise the hint shows.
    if (s.paused) {
      const pr: Rect = {
        x: isRtl() ? sp.left.x + sp.left.w - 4 - 64 : sp.left.x + 4,
        y: sp.left.y + 2,
        w: 64,
        h: sp.left.h - 4,
      };
      bevel(g, pr, false, PAL.face);
      this.statusPaused.text = t('hud.paused');
      const pp = textX(pr, 'start');
      this.statusPaused.anchor.x = pp.anchor;
      this.statusPaused.position.set(pp.x, pr.y + Math.floor(pr.h / 2));
      this.statusHint.text = '';
    } else {
      this.statusPaused.text = '';
      this.statusHint.text = helpMode
        ? CONTEXT_HELP_HINT
        : this.notice || autoWaveStatus(s) || (noBuildActive(s) ? NO_BUILD_MESSAGE : hintFor(s));
      const hp = textX(sp.left, 'start', 4);
      this.statusHint.anchor.x = hp.anchor;
      this.statusHint.position.set(hp.x, sp.left.y + Math.floor(sp.left.h / 2));
    }

    this.statusWave.text = waveLabel(s);
    const wp = textX(sp.middle, 'start', 4);
    this.statusWave.anchor.x = wp.anchor;
    this.statusWave.position.set(wp.x, sp.middle.y + Math.floor(sp.middle.h / 2));
    this.statusSpeed.text = speedStatusText(s.speed);
    this.statusPerf.text = statusPerfText(perf);
    this.statusPerf.anchor.x = isRtl() ? 0 : 1;
    this.statusPerf.position.set(
      isRtl() ? sp.middle.x + sp.middle.w + 6 : sp.middle.x - 6,
      sp.middle.y + Math.floor(sp.middle.h / 2),
    );
    const spP = textX(sp.speed, 'start', 4);
    this.statusSpeed.anchor.x = spP.anchor;
    this.statusSpeed.position.set(spP.x, sp.speed.y + Math.floor(sp.speed.h / 2));

    // Toolbar.
    const h = computeHud(l, s);

    bevel(g, h.integrity, false, PAL.face);
    this.integrity.text = t('hud.integrity', { current: s.integrity, max: STARTING_INTEGRITY });
    const ip = textX(h.integrity, 'start');
    this.integrity.anchor.x = ip.anchor;
    this.integrity.position.set(ip.x, h.integrity.y + Math.floor(h.integrity.h / 2));

    bevel(g, h.salvage, false, PAL.face);
    this.salvage.text = salvageReadoutText(s);
    this.salvage.position.set(h.salvage.x + h.salvage.w - 6, h.salvage.y + Math.floor(h.salvage.h / 2));

    this.drawTowerControls(s, h, hoverHud);

    if (h.route) {
      this.route.text = t('hud.route', { count: currentPath(s).length });
      const rp = textX(h.route, 'start');
      this.route.anchor.x = rp.anchor;
      this.route.position.set(rp.x, h.route.y + Math.floor(h.route.h / 2));
    } else {
      this.route.text = '';
    }

    if (h.map) {
      const name = s.level.name;
      drawButton(g, h.map.next, true, hoverHud === 'map');
      this.mapNext.text = t('hud.mapNext');
      this.mapNext.style.fill = PAL.text;
      this.mapNext.position.set(h.map.next.x + h.map.next.w / 2, h.map.next.y + Math.floor(h.map.next.h / 2));
      this.mapLabel.text = t('hud.mapLabel', { name });
      const mp = textX(h.map.row, 'start');
      this.mapLabel.anchor.x = mp.anchor;
      this.mapLabel.position.set(mp.x, h.map.row.y + Math.floor(h.map.row.h / 2));
    } else {
      this.mapLabel.text = '';
      this.mapNext.text = '';
    }

    if (s.phase === 'build' || s.phase === 'wave') {
      const enabled = !isFinalWave(s);
      drawButton(g, h.wave, enabled, hoverHud === 'wave');
      this.waveButton.text =
        s.phase === 'build'
          ? t('hud.startWave', { wave: s.wave + 1 })
          : t('hud.callWave', { wave: s.wave + 1, bonus: earlyCallBonus(s.waveTick, s.wave + 1) });
      this.waveButton.style.fill = enabled ? PAL.text : PAL.shadow;
      const wv = textX(h.wave, 'start');
      this.waveButton.anchor.x = wv.anchor;
      this.waveButton.position.set(wv.x, h.wave.y + Math.floor(h.wave.h / 2));

      this.drawCheckbox(g, h.autoWave, s.autoWave);
      this.autoWaveButton.text = t('hud.auto');
      this.autoWaveButton.style.fill = PAL.text;
      const aw = textX(h.autoWave, 'start', 20);
      this.autoWaveButton.anchor.x = aw.anchor;
      this.autoWaveButton.position.set(aw.x, h.autoWave.y + Math.floor(h.autoWave.h / 2));
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

      const branch = tower.branch === null ? '' : t('hud.towerBranch', { branch: branchName(tower.kind, tower.branch) });
      this.towerName.text = t('hud.towerName', { name: towerName(tower.kind), tier: tower.tier, max: kindMaxTier(tower.kind) }) + branch + (isOffline(tower) ? t('hud.towerOffline') : '');
      const tn = textX(d.name, 'start');
      this.towerName.anchor.x = tn.anchor;
      this.towerName.position.set(tn.x, d.name.y + Math.floor(d.name.h / 2));

      // The detail pane's close box: a raised Win95 box with the same X glyph the help window uses.
      bevel(g, d.close, true, PAL.face);
      const ccx = d.close.x + Math.floor(d.close.w / 2);
      const ccy = d.close.y + Math.floor(d.close.h / 2);
      g.moveTo(ccx - 4, ccy - 4).lineTo(ccx + 4, ccy + 4).stroke({ width: 1, color: PAL.text });
      g.moveTo(ccx + 4, ccy - 4).lineTo(ccx - 4, ccy + 4).stroke({ width: 1, color: PAL.text });

      if (tower.kind === 'wall') {
        this.towerStats.text = tower.branch === null ? t('hud.wallHp', { hp: Math.ceil(tower.hp) }) : t('hud.wallHpMax', { hp: Math.ceil(tower.hp), max: tower.maxHp });
      } else if (tower.kind === 'cursor') {
        if (tower.tier >= 3 && tower.branch === BRANCHES[2]) {
          this.towerStats.text = cursorMaintenanceStatus(s, tower) ?? t('hud.idle');
        } else {
          const rate = cursorClickRate(tower);
          const radius = cursorRadius(tower);
          const dmg = cursorClickDamage(tower, clickDamage(s.pointer), pointerDamageMult(s));
          this.towerStats.text = t('hud.cursorStats', { rate: rate.toFixed(1), damage: fmtClickDamage(dmg), radius: radius.toFixed(1) });
        }
      } else if (tower.kind === 'repair') {
        const heal = repairHealRate(tower);
        const radius = repairRadius(tower);
        const healed = repairHealingCount(s.towers, tower, s.clock);
        this.towerStats.text = t('hud.repairStats', { heal: heal.toFixed(1), radius: radius.toFixed(1), count: healed });
      } else {
        const st = effectiveStats(tower);
        const damage = st.damage * tower.auraDamage;
        const range = st.range + tower.auraRange;
        this.towerStats.text = t('hud.combatStats', { damage: damage.toFixed(1), range: range.toFixed(1) });
      }
      const ts = textX(d.stats, 'start');
      this.towerStats.anchor.x = ts.anchor;
      this.towerStats.position.set(ts.x, d.stats.y + Math.floor(d.stats.h / 2));

      this.towerRoute.text = t('hud.route', { count: currentPath(s).length });
      const tr = textX(d.route, 'start');
      this.towerRoute.anchor.x = tr.anchor;
      this.towerRoute.position.set(tr.x, d.route.y + Math.floor(d.route.h / 2));

      if (d.target) {
        const fixed = frozen || TOWER_STATS[tower.kind].targetLock !== null || tower.kind === 'cursor';
        drawButton(g, d.target, !fixed, hoverHud === 'target' && !fixed);
        this.targetButton.text = t('hud.target');
        this.targetButton.style.fill = fixed ? PAL.shadow : PAL.text;
        const tgb = textX(d.target, 'start');
        this.targetButton.anchor.x = tgb.anchor;
        this.targetButton.position.set(tgb.x, d.target.y + Math.floor(d.target.h / 2));
        this.targetValue.text = targetModeDisplay(tower);
        this.targetValue.style.fill = fixed ? PAL.shadow : PAL.text;
        const tgv = textX(d.target, 'end');
        this.targetValue.anchor.x = tgv.anchor;
        this.targetValue.position.set(tgv.x, d.target.y + Math.floor(d.target.h / 2));
      } else {
        this.targetButton.text = '';
        this.targetValue.text = '';
      }

      const price = upgradeCost(tower);
      if (d.upgrade && price !== null) {
        const enabled = !frozen && canAfford(s.economy, price);
        drawButton(g, d.upgrade, enabled, hoverHud === 'upgrade');
        this.upgradeButton.text = t('hud.upgrade', { cost: formatNumber(price) });
        this.upgradeButton.style.fill = enabled ? PAL.text : PAL.shadow;
        const up = textX(d.upgrade, 'start');
        this.upgradeButton.anchor.x = up.anchor;
        this.upgradeButton.position.set(up.x, d.upgrade.y + Math.floor(d.upgrade.h / 2));
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
          hoverHud === (b.branch === BRANCHES[0] ? 'branchA' : b.branch === BRANCHES[1] ? 'branchB' : 'branchC'),
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
          ? t('hud.repairing', { seconds: repairRemainingSeconds(tower, s.clock).toFixed(1) })
          : hp <= 0
            ? t('hud.noDamage')
            : t('hud.repair', { hp: Math.ceil(hp), cost: formatNumber(cost) });
        this.repairButton.style.fill = enabled ? PAL.text : PAL.shadow;
        const rp = textX(d.repair, 'start');
        this.repairButton.anchor.x = rp.anchor;
        this.repairButton.position.set(rp.x, d.repair.y + Math.floor(d.repair.h / 2));
      } else {
        this.repairButton.text = '';
      }

      drawButton(g, d.sell, !frozen, hoverHud === 'sell');
      this.sellButton.text = t('hud.sell', { amount: formatNumber(sellValue(tower, s.treeEffects.sellRefund)) });
      this.sellButton.style.fill = frozen ? PAL.shadow : PAL.text;
      const sl = textX(d.sell, 'start');
      this.sellButton.anchor.x = sl.anchor;
      this.sellButton.position.set(sl.x, d.sell.y + Math.floor(d.sell.h / 2));
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
      const btn = this.towerButtons[i];
      btn.text = t('hud.towerButton', { name: towerName(kind), cost: formatNumber(towerCost(s, kind)) });
      btn.style.fill = enabled ? (armed ? PAL.title : PAL.text) : PAL.shadow;
      const bp = textX(rect, 'start');
      btn.anchor.x = bp.anchor;
      btn.position.set(bp.x, rect.y + Math.floor(rect.h / 2));
    }
  }

  private drawRightPanel(s: RunState, l: Layout, hoverHud: HudAction | null): void {
    const g = this.g;
    const rp = computeRightPanel(l, s);

    // Combo readout: visible while the multiplier is above x1, so the timer ticking down is legible.
    const mult = comboMultiplier(s.pointer);
    if (mult > 1) {
      this.comboText.text = t('hud.combo', { multiplier: mult.toFixed(1) });
      const cp = textX(rp.nextWave.rect, 'start', 2);
      this.comboText.anchor.x = cp.anchor;
      this.comboText.position.set(cp.x, rp.nextWave.rect.y - 10);
      this.comboText.visible = true;
    } else {
      this.comboText.text = '';
      this.comboText.visible = false;
    }

    this.drawInfoSection(g, this.nextWaveTitle, this.nextWaveRows, rp.nextWave);
    this.drawInfoSection(g, this.killsTitle, this.killsRows, rp.kills);

    // POINTER: the pointer's home — stage, click damage, overclock, crits, the upgrade and Override.
    bevel(g, rp.pointer.rect, false, PAL.face);
    this.pointerTitle.text = t('hud.pointerTitle');
    const pt = textX(rp.pointer.rect, 'start');
    this.pointerTitle.anchor.x = pt.anchor;
    this.pointerTitle.position.set(
      pt.x,
      rp.pointer.rect.y + SECTION_PAD_TOP + SECTION_TITLE_H / 2,
    );
    for (let i = 0; i < this.pointerRows.length; i++) {
      const row = rp.pointer.rows[i];
      if (row) {
        this.pointerRows[i].text = row.text;
        this.pointerRows[i].style.fill = PAL.text;
        const rw = textX(row.rect, 'start');
        this.pointerRows[i].anchor.x = rw.anchor;
        this.pointerRows[i].position.set(rw.x, row.rect.y + Math.floor(row.rect.h / 2));
      } else {
        this.pointerRows[i].text = '';
      }
    }
    drawButton(g, rp.pointer.upgrade, rp.pointer.upgradeEnabled, hoverHud === 'pointer');
    this.pointerButton.text = rp.pointer.upgradeText;
    this.pointerButton.style.fill = rp.pointer.upgradeEnabled ? PAL.text : PAL.shadow;
    const pb = textX(rp.pointer.upgrade, 'start');
    this.pointerButton.anchor.x = pb.anchor;
    this.pointerButton.position.set(
      pb.x,
      rp.pointer.upgrade.y + Math.floor(rp.pointer.upgrade.h / 2),
    );
    if (rp.pointer.override) {
      this.drawCheckbox(g, rp.pointer.override, s.pointer.manualOverride);
      this.pointerOverrideButton.text = t('hud.override');
      this.pointerOverrideButton.style.fill = PAL.text;
      const ov = textX(rp.pointer.override, 'start', 20);
      this.pointerOverrideButton.anchor.x = ov.anchor;
      this.pointerOverrideButton.position.set(
        ov.x,
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
    const tp = textX(rect, 'start');
    title.anchor.x = tp.anchor;
    title.position.set(tp.x, rect.y + SECTION_PAD_TOP + SECTION_TITLE_H / 2);
    for (let i = 0; i < rows.length; i++) {
      rows[i].text = i < section.rows.length ? section.rows[i] : '';
      const rp = textX(rect, 'start');
      rows[i].anchor.x = rp.anchor;
      rows[i].position.set(
        rp.x,
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
    this.modalTitle.text = t('hud.gameOver');
    this.modalTitle.position.set(m.x + 6, m.y + 2 + 10);

    this.modalMessage.text = t('hud.gameOverMessage', { wave: s.wave });
    this.modalMessage.style.wordWrap = true;
    this.modalMessage.style.wordWrapWidth = m.w - 24;
    this.modalMessage.position.set(m.x + 12, modalMessageTop(m));
    this.modalButton2.text = '';

    const r = restartRect(m);
    bevel(g, r, true, PAL.face);
    this.modalRestart.text = t('hud.restart');
    this.modalRestart.position.set(r.x + r.w / 2, r.y + r.h / 2);
  }

  private drawVictoryModal(s: RunState, l: Layout): void {
    const g = this.modalG;
    const m = victoryModalRect(l);
    g.rect(l.client.x, l.client.y, l.client.w, l.client.h).fill({ color: PAL.dark, alpha: 0.4 });

    bevel(g, m, true, PAL.face);
    g.rect(m.x + 2, m.y + 2, m.w - 4, 20).fill(PAL.title);
    this.modalTitle.text = t('hud.victory');
    this.modalTitle.position.set(m.x + 6, m.y + 2 + 10);

    this.modalMessage.text = [
      s.daily !== null ? t('hud.victoryDaily') : t('hud.victoryAll'),
      t('hud.victoryKills', { tower: s.economy.kills.tower, pointer: s.economy.kills.pointer }),
      t('hud.victorySalvage', { earned: formatNumber(s.economy.earned) }),
      t('hud.victoryIntegrity', { integrity: s.integrity }),
    ].join('\n');
    this.modalMessage.style.wordWrap = true;
    this.modalMessage.style.wordWrapWidth = m.w - 24;
    this.modalMessage.position.set(m.x + 12, modalMessageTop(m));

    const b = victoryButtons(m);
    if (s.daily === null) {
      bevel(g, b.endless, true, PAL.face);
      this.modalButton2.text = t('hud.endless');
      this.modalButton2.position.set(b.endless.x + b.endless.w / 2, b.endless.y + b.endless.h / 2);
    } else {
      this.modalButton2.text = '';
    }

    bevel(g, b.restart, true, PAL.face);
    this.modalRestart.text = t('hud.restartWindows');
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
