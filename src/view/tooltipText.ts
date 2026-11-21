import { towerName, enemyName } from '../i18n/names.ts';
import {
  BRANCHES,
  CURSOR_REPAIR_THRESHOLD,
  cursorClickDamage,
  cursorClickDamageFactor,
  cursorClickRate,
  cursorRadius,
  effectiveStats,
  gateLockRemainingSeconds,
  isFullyUpgraded,
  isGateLocked,
  isMinesweeper,
  isRepairing,
  isTowerUnlocked,
  kindMaxTier,
  MINE_BLAST_RADIUS,
  MINE_DAMAGE,
  MINE_EXPIRE_TICKS,
  MINE_LIVE_CAP,
  repairCost,
  repairDurationTicks,
  repairHealRate,
  repairHpToRestore,
  repairRadius,
  repairRemainingSeconds,
  sellValue,
  TOWER_STATS,
  towerUnlockWave,
  upgradeCost,
  wallMaxHp,
  type Branch,
  type TargetMode,
  type Tier,
  type Tower,
  type TowerKind,
} from '../core/towers.ts';
import { formatNumber } from '../core/format.ts';
import {
  clickDamage,
  MAX_OVERCLOCK_LEVEL,
  MAX_POINTER_STAGE,
  pointerInfo,
  pointerUpgradeState,
  type PointerState,
  type PointerStage,
} from '../core/pointer.ts';
import { TICK_HZ } from '../core/time.ts';
import type { Enemy } from '../core/enemies.ts';
import { t } from '../i18n/index.ts';

/**
 * Tooltip *text* for the spend controls, kept Pixi-free so the smoke harness can assert that a
 * tooltip's numbers match what actually happens when the purchase is applied. Everything here is a
 * pure function over the run state; `TooltipView` (tooltip.ts) owns the drawing, hover delay and
 * placement, and colours the "after" number.
 *
 * A line is either a plain string (one colour) or a list of segments. The segments let the view
 * paint the "after" number of a delta in a distinct colour; `tooltipText` flattens a line back to
 * its plain text for assertions.
 */

export const TOOLTIP_GOOD = 0x008000;
/** The tooltip colour for a wave-gated purchase: the navy link blue. */
export const TOOLTIP_BLUE = 0x000080;

export interface TooltipSegment {
  text: string;
  color?: number;
}

export type TooltipLine = string | TooltipSegment[];

/** The plain-text form of a tooltip line, for tests and for anything that needs a string. */
export function tooltipText(line: TooltipLine): string {
  return typeof line === 'string' ? line : line.map((s) => s.text).join('');
}

export const BRANCH_NAMES: Readonly<Record<TowerKind, Readonly<Partial<Record<Branch, string>>>>> = {
  gun: { A: t('tooltip.branch.gunA'), B: t('tooltip.branch.gunB') },
  cannon: { A: t('tooltip.branch.cannonA'), B: t('tooltip.branch.cannonB') },
  taser: { A: t('tooltip.branch.taserA'), B: t('tooltip.branch.taserB') },
  frost: { A: t('tooltip.branch.frostA'), B: t('tooltip.branch.frostB') },
  laser: { A: t('tooltip.branch.laserA'), B: t('tooltip.branch.laserB') },
  aa: { A: t('tooltip.branch.aaA'), B: t('tooltip.branch.aaB') },
  beacon: { A: t('tooltip.branch.beaconA'), B: t('tooltip.branch.beaconB') },
  repair: {},
  wall: { A: t('tooltip.branch.wallA'), B: t('tooltip.branch.wallB'), C: t('tooltip.branch.wallC') },
  cursor: { A: t('tooltip.branch.cursorA'), B: t('tooltip.branch.cursorB'), C: t('tooltip.branch.cursorC') },
};

/** The display name of a branch, falling back to the key so an unknown branch still reads. */
export function branchName(kind: TowerKind, branch: Branch): string {
  return BRANCH_NAMES[kind][branch] ?? branch;
}

export const TARGET_LABEL: Readonly<Record<TargetMode, string>> = {
  first: t('tooltip.target.first'),
  strong: t('tooltip.target.strong'),
  close: t('tooltip.target.close'),
};

/** The fixed-label wording for a locked mode; "close" reads "Closest" to name the behaviour. */
const TARGET_LOCK_LABEL: Readonly<Record<TargetMode, string>> = {
  first: t('tooltip.target.first'),
  strong: t('tooltip.target.strong'),
  close: t('tooltip.target.closest'),
};

/** The target row's display value: a locked kind reads "<Mode> (fixed)", the cursor reads the
 *  compact "Shield first", and others read the stored mode. */
export function targetModeDisplay(tower: Tower): string {
  if (tower.kind === 'cursor') return t('tooltip.target.shieldFirst');
  const lock = TOWER_STATS[tower.kind].targetLock;
  return lock !== null ? t('tooltip.target.fixed', { mode: TARGET_LOCK_LABEL[lock] }) : TARGET_LABEL[tower.targetMode];
}

/** The one-sentence reason a locked tower cannot be re-targeted, or null for a configurable kind. */
export function targetLockReason(kind: TowerKind): string | null {
  if (kind === 'cursor') return t('tooltip.target.lockCursor');
  if (kind === 'frost') return t('tooltip.target.lockFrost');
  switch (TOWER_STATS[kind].targetLock) {
    case 'close':
      return t('tooltip.target.lockClose');
    case 'first':
      return t('tooltip.target.lockFirst');
    case 'strong':
      return t('tooltip.target.lockStrong');
    default:
      return null;
  }
}

/** Shots per second for a fire interval, or an em-dash for towers that never fire. */
function rateText(fireInterval: number): string {
  return fireInterval > 0 ? t('tooltip.rate', { rate: (TICK_HZ / fireInterval).toFixed(1) }) : '—';
}

/** The traverse line: instant towers need no aiming, traversing towers name their rate. */
function turnText(turnRate: number): string {
  return turnRate <= 0 ? t('tooltip.turnsInstantly') : t('tooltip.turns', { rate: turnRate });
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
  if (st.ignoresArmour) out.push(t('tooltip.trait.ignoresArmour'));
  if (st.splash > 0) out.push(t('tooltip.trait.splash'));
  if (st.slowFactor < 1) out.push(t('tooltip.trait.slow'));
  if (st.pierce > 0) out.push(t('tooltip.trait.pierce'));
  if (st.auraDamage > 0 || st.auraRange > 0) out.push(t('tooltip.trait.aura'));
  return out;
}

/** The "Unlocks at wave N" line for a build-palette tower that is still locked, or null. */
export function lockedPaletteLine(kind: TowerKind, wave: number): string | null {
  return isTowerUnlocked(kind, wave) ? null : t('tooltip.unlocksAtWave', { wave: towerUnlockWave(kind) });
}

/** Tooltip lines for a build-palette button (the tower's base, un-upgraded stats). */
export function paletteTooltipLines(kind: TowerKind): string[] {
  if (kind === 'cursor') {
    return [t('tooltip.palette.cursor'), t('tooltip.palette.cursorDesc')];
  }
  if (kind === 'repair') {
    return [t('tooltip.palette.repair'), t('tooltip.palette.repairDesc')];
  }
  if (kind === 'beacon') {
    const b = TOWER_STATS.beacon;
    return [
      t('tooltip.palette.beacon', { cost: formatNumber(b.cost) }),
      t('tooltip.palette.beaconAura', { pct: Math.round(b.auraDamage * 100), range: b.range.toFixed(1) }),
      t('tooltip.palette.beaconNoDamage'),
      t('tooltip.palette.beaconCursors'),
    ];
  }
  if (kind === 'aa') {
    return [t('tooltip.palette.aa'), t('tooltip.palette.aaDesc'), t('tooltip.palette.aaStats'), t('tooltip.palette.aaHold')];
  }
  const b = TOWER_STATS[kind];
  const name = t('tooltip.palette.towerName', { name: b.name, cost: formatNumber(b.cost) });
  if (kind === 'wall') {
    return [name, b.blurb, t('tooltip.palette.wallBlocks'), t('tooltip.palette.wallUpgrades')];
  }
  const stats = b.fireInterval > 0
    ? t('tooltip.palette.stats', { range: b.range.toFixed(1), damage: b.damage, rate: rateText(b.fireInterval) })
    : t('tooltip.palette.statsNoRate', { range: b.range.toFixed(1), damage: b.damage });
  const list = traits(b);
  const traitsLine = list.length > 0 ? t('tooltip.palette.traits', { traits: list.join(', ') }) : t('tooltip.palette.traitsNone');
  return [name, b.blurb, stats, traitsLine, turnText(b.turnRate)];
}

/** The catalogue name key for a synergy row id; the one kebab-case id maps to a camelCase key. */
function synergyName(id: string): string {
  return id === 'aa-sync' ? t('synergy.aaSync.name') : t(`synergy.${id}.name`);
}

/** One "Synergy: {name}" tooltip line per row, in the order given. */
function synergyTooltipLines(rows: readonly string[]): string[] {
  return rows.map((row) => t('tooltip.synergy', { name: synergyName(row) }));
}

/** Tooltip lines for a placed tower: its live stats with aura bonuses, as the sim sees them. */
export function towerTooltipLines(
  tower: Tower,
  clock: number,
  pointer?: PointerState,
  specMult?: number,
  healedCount = 0,
  maintenanceStatus: string | null = null,
  synergyRows: readonly string[] = [],
): string[] {
  if (tower.kind === 'cursor') {
    const lines =
      pointer !== undefined && specMult !== undefined
        ? cursorTooltipLines(tower, pointer, specMult, maintenanceStatus)
        : [t('tooltip.cursorName', { tier: tower.tier })];
    lines.push(...synergyTooltipLines(synergyRows));
    if (isFullyUpgraded(tower)) lines.push(t('tooltip.fullyUpgraded'));
    return lines;
  }
  const branch = tower.branch === null ? '' : t('tooltip.branchSuffix', { branch: branchName(tower.kind, tower.branch) });
  const name = t('tooltip.towerName', { name: towerName(tower.kind), tier: tower.tier }) + branch;

  if (tower.kind === 'repair') {
    const heal = repairHealRate(tower);
    const radius = repairRadius(tower);
    const lines = [
      name,
      t('tooltip.repairHeals', { heal: heal.toFixed(1), radius: radius.toFixed(1) }),
      t('tooltip.repairHealing', { count: healedCount }),
      t('tooltip.sell', { amount: formatNumber(sellValue(tower)) }),
    ];
    lines.push(...synergyTooltipLines(synergyRows));
    if (isFullyUpgraded(tower)) lines.push(t('tooltip.fullyUpgraded'));
    return lines;
  }

  if (tower.kind === 'wall') {
    const hp = tower.branch === null ? t('tooltip.hp', { hp: Math.ceil(tower.hp) }) : t('tooltip.hpMax', { hp: Math.ceil(tower.hp), max: tower.maxHp });
    const locked = isGateLocked(tower, clock);
    const blocks =
      tower.branch === BRANCHES[1]
        ? t('tooltip.wallBlocksBoth')
        : locked
          ? t('tooltip.gateLocked', { seconds: gateLockRemainingSeconds(tower, clock).toFixed(1) })
          : tower.branch === BRANCHES[2]
            ? tower.open
              ? t('tooltip.gateOpen')
              : t('tooltip.gateClosed')
            : t('tooltip.wallBlocksGround');
    const lines = [name, hp, blocks, t('tooltip.sell', { amount: formatNumber(sellValue(tower)) })];
    lines.push(...synergyTooltipLines(synergyRows));
    if (isFullyUpgraded(tower)) lines.push(t('tooltip.fullyUpgraded'));
    return lines;
  }

  if (tower.kind === 'beacon') {
    const st = effectiveStats(tower);
    const radius = st.range + tower.auraRange;
    const aura = Math.round(st.auraDamage * 100);
    const lines = [
      name,
      t('tooltip.beaconAura', { pct: aura, range: radius.toFixed(1) }),
      t('tooltip.beaconNoDamage'),
    ];
    if (tower.branch === BRANCHES[1]) {
      lines.push(
        t('tooltip.beaconRelay', { pct: Math.round(st.auraPointerDamage * 100), range: st.auraPointerRange.toFixed(2) }),
      );
    } else if (tower.branch === BRANCHES[0]) {
      lines.push(t('tooltip.beaconCommand'));
    }
    lines.push(t('tooltip.sell', { amount: formatNumber(sellValue(tower)) }));
    lines.push(...synergyTooltipLines(synergyRows));
    if (isFullyUpgraded(tower)) lines.push(t('tooltip.fullyUpgraded'));
    return lines;
  }

  if (tower.kind === 'aa') {
    const st = effectiveStats(tower);
    const damage = st.damage * tower.auraDamage;
    const range = st.range + tower.auraRange;
    const rate = st.fireInterval > 0 ? TICK_HZ / st.fireInterval : 0;
    const dps = damage * rate * 2; // 2x against flyers
    const behaviour =
      tower.branch === BRANCHES[0]
        ? t('tooltip.aaFlak')
        : tower.branch === BRANCHES[1]
          ? t('tooltip.aaMissile')
          : t('tooltip.aaFlyersOnly');
    const lines = [
      name,
      t('tooltip.aaDamage', { damage: damage.toFixed(1), range: range.toFixed(1) }),
      t('tooltip.aaRate', { rate: rate.toFixed(1), dps: dps.toFixed(1) }),
      behaviour,
      t('tooltip.targetLine', { mode: targetModeDisplay(tower) }),
      turnText(st.turnRate),
      t('tooltip.sell', { amount: formatNumber(sellValue(tower)) }),
    ];
    lines.push(...synergyTooltipLines(synergyRows));
    if (isFullyUpgraded(tower)) lines.push(t('tooltip.fullyUpgraded'));
    return lines;
  }

  if (isMinesweeper(tower)) {
    const secs = (MINE_EXPIRE_TICKS / TICK_HZ).toFixed(0);
    const lines = [
      name,
      t('tooltip.minesLays'),
      t('tooltip.minesStats', { damage: MINE_DAMAGE, radius: MINE_BLAST_RADIUS.toFixed(1), max: MINE_LIVE_CAP, seconds: secs }),
      t('tooltip.sell', { amount: formatNumber(sellValue(tower)) }),
    ];
    lines.push(...synergyTooltipLines(synergyRows));
    if (isFullyUpgraded(tower)) lines.push(t('tooltip.fullyUpgraded'));
    return lines;
  }

  const st = effectiveStats(tower);
  const damage = st.damage * tower.auraDamage;
  const range = st.range + tower.auraRange;
  const firing = st.fireInterval > 0;
  const rate = firing ? TICK_HZ / st.fireInterval : 0;
  const dps = firing ? damage * rate : 0;
  const lines = [
    name,
    t('tooltip.damageRange', { damage: damage.toFixed(1), range: range.toFixed(1) }),
    t('tooltip.rateDps', { rate: firing ? rate.toFixed(1) + '/s' : '—', dps: firing ? dps.toFixed(1) : '—' }),
    t('tooltip.targetLine', { mode: targetModeDisplay(tower) }),
    turnText(st.turnRate),
    t('tooltip.sell', { amount: formatNumber(sellValue(tower)) }),
  ];
  lines.push(...synergyTooltipLines(synergyRows));
  if (isFullyUpgraded(tower)) lines.push(t('tooltip.fullyUpgraded'));
  return lines;
}

/** Tooltip lines for a placed cursor tower: its rate, radius and the ladder-derived click damage. */
export function cursorTooltipLines(
  tower: Tower,
  pointer: PointerState,
  specMult: number,
  maintenanceStatus: string | null = null,
): string[] {
  const branch = tower.branch === null ? '' : t('tooltip.branchSuffix', { branch: branchName('cursor', tower.branch) });
  const name = t('tooltip.cursorName', { tier: tower.tier }) + branch;

  if (tower.tier >= 3 && tower.branch === BRANCHES[2]) {
    const pct = Math.round(CURSOR_REPAIR_THRESHOLD * 100);
    return [
      name,
      t('tooltip.cursorRepairs'),
      t('tooltip.cursorBelowHp', { pct }) + (maintenanceStatus ? t('tooltip.cursorMaintenance', { status: maintenanceStatus }) : ''),
      t('tooltip.cursorNoCombat'),
      t('tooltip.sell', { amount: formatNumber(sellValue(tower)) }),
    ];
  }

  const rate = cursorClickRate(tower);
  const radius = cursorRadius(tower);
  const player = clickDamage(pointer);
  const dmg = cursorClickDamage(tower, player, specMult);
  return [
    name,
    t('tooltip.cursorRateRadius', { rate: rate.toFixed(1), radius: radius.toFixed(1) }),
    t('tooltip.cursorClickDamage', { damage: fmtClickDamage(dmg), player: fmtClickDamage(player) }),
    t('tooltip.targetLine', { mode: targetModeDisplay(tower) }),
    t('tooltip.sell', { amount: formatNumber(sellValue(tower)) }),
  ];
}

/** Tooltip for a cursor's Upgrade button: the rate (and radius) change for the next tier. */
export function cursorUpgradeTooltipLines(tower: Tower, salvage: number): TooltipLine[] {
  const cost = upgradeCost(tower);
  if (cost === null) return [];
  if (salvage < cost) return [cannotAffordText(salvage, cost)];
  const next = (tower.tier + 1) as Tier;
  const beforeRate = cursorClickRate(tower);
  const afterRate = cursorClickRate({ ...tower, tier: next });
  const beforeRng = cursorRadius(tower);
  const afterRng = cursorRadius({ ...tower, tier: next });
  const segments: TooltipSegment[] = [
    { text: t('tooltip.cursorUpgradeRate', { tier: tierOfMax('cursor', tower.tier), next: tierOfMax('cursor', next), before: fmt1(beforeRate) }) },
    good(fmt1(afterRate) + '/s'),
  ];
  if (afterRng !== beforeRng) segments.push({ text: t('tooltip.rngDelta', { before: fmt1(beforeRng) }) }, good(fmt1(afterRng)));
  segments.push({ text: t('tooltip.cost', { cost: formatNumber(cost) }) });
  return [segments];
}

/** Tooltip for a cursor's tier-3 branch button: rate, radius and click-damage changes. */
export function cursorBranchTooltipLines(tower: Tower, branch: Branch, salvage: number): TooltipLine[] {
  const cost = upgradeCost(tower);
  if (cost === null) return [];
  if (salvage < cost) return [cannotAffordText(salvage, cost)];
  const name = branchName('cursor', branch);

  if (branch === BRANCHES[2]) {
    const pct = Math.round(CURSOR_REPAIR_THRESHOLD * 100);
    return [[
      { text: t('tooltip.cursorBranchRepairs', { name, pct }) },
      { text: t('tooltip.cursorBranchNoBoost') },
      { text: t('tooltip.cost', { cost: formatNumber(cost) }) },
    ]];
  }

  const beforeRate = cursorClickRate(tower);
  const afterRate = cursorClickRate({ ...tower, tier: 3, branch });
  const beforeRng = cursorRadius(tower);
  const afterRng = cursorRadius({ ...tower, tier: 3, branch });
  const beforeDmg = cursorClickDamageFactor(tower);
  const afterDmg = cursorClickDamageFactor({ ...tower, tier: 3, branch });
  const segments: TooltipSegment[] = [
    { text: t('tooltip.cursorBranchRate', { name, before: fmt1(beforeRate) }) },
    good(fmt1(afterRate) + '/s'),
  ];
  if (afterRng !== beforeRng) segments.push({ text: t('tooltip.rngDelta', { before: fmt1(beforeRng) }) }, good(fmt1(afterRng)));
  if (afterDmg !== beforeDmg) segments.push({ text: t('tooltip.clickDmgDelta', { before: fmt1(beforeDmg) }) }, good('×' + fmt1(afterDmg)));
  segments.push({ text: t('tooltip.cost', { cost: formatNumber(cost) }) });
  return [segments];
}

/** Disabled-reason text for a purchase the player cannot yet afford. */
export function cannotAffordText(salvage: number, cost: number): string {
  return t('tooltip.cannotAfford', { salvage: formatNumber(salvage), cost: formatNumber(cost) });
}

function fmtHp(n: number): string {
  return String(Math.round(n));
}

function fmt1(n: number): string {
  return n.toFixed(1);
}

function good(n: string): TooltipSegment {
  return { text: n, color: TOOLTIP_GOOD };
}

/** "T{tier} of {max}" — the tier out of the kind's cap, so a combat tower reads T12 of 20. */
function tierOfMax(kind: TowerKind, tier: number): string {
  return t('tooltip.tierOfMax', { tier, max: kindMaxTier(kind) });
}

/** Tooltip for a repair tower's Upgrade button: tier 2 widens the radius, tier 3 deepens the heal. */
export function repairUpgradeTooltipLines(tower: Tower, salvage: number): TooltipLine[] {
  const cost = upgradeCost(tower);
  if (cost === null) return [];
  if (salvage < cost) return [cannotAffordText(salvage, cost)];
  const next = (tower.tier + 1) as Tier;
  const beforeHeal = repairHealRate(tower);
  const afterHeal = repairHealRate({ ...tower, tier: next });
  const beforeRng = repairRadius(tower);
  const afterRng = repairRadius({ ...tower, tier: next });
  const segments: TooltipSegment[] = [{ text: t('tooltip.repairUpgrade', { tier: tierOfMax('repair', tower.tier), next: tierOfMax('repair', next) }) }];
  if (afterRng !== beforeRng) segments.push({ text: t('tooltip.rngDeltaBare', { before: fmt1(beforeRng) }) }, good(fmt1(afterRng)));
  if (afterHeal !== beforeHeal) {
    if (segments.length > 1) segments.push({ text: ' · ' });
    segments.push({ text: t('tooltip.healDelta', { before: fmt1(beforeHeal) }) }, good(fmt1(afterHeal) + ' HP/s'));
  }
  segments.push({ text: t('tooltip.cost', { cost: formatNumber(cost) }) });
  return [segments];
}

/**
 * Tooltip for the Upgrade button on a selected tower: the result of spending the upgrade cost,
 * computed from the same `effectiveStats` / `wallMaxHp` path the purchase uses.
 */
export function upgradeTooltipLines(tower: Tower, salvage: number): TooltipLine[] {
  if (tower.kind === 'cursor') return cursorUpgradeTooltipLines(tower, salvage);
  if (tower.kind === 'repair') return repairUpgradeTooltipLines(tower, salvage);
  const cost = upgradeCost(tower);
  if (cost === null) return [];
  if (salvage < cost) return [cannotAffordText(salvage, cost)];

  const next = (tower.tier + 1) as Tier;

  if (tower.kind === 'beacon') {
    const before = effectiveStats(tower);
    const after = effectiveStats({ ...tower, tier: next, branch: tower.branch });
    return [[
      { text: t('tooltip.beaconUpgrade', { name: towerName('beacon'), tier: tierOfMax('beacon', tower.tier), next: tierOfMax('beacon', next), pct: Math.round(before.auraDamage * 100) }) },
      good('+' + Math.round(after.auraDamage * 100) + '%'),
      { text: t('tooltip.cost', { cost: formatNumber(cost) }) },
    ]];
  }

  if (tower.kind === 'wall') {
    const before = wallMaxHp(tower.tier, tower.branch);
    const after = wallMaxHp(next, tower.branch);
    return [[
      { text: t('tooltip.wallUpgradeHp', { tier: tierOfMax('wall', next), before: fmtHp(before) }) },
      good(fmtHp(after)),
      { text: t('tooltip.cost', { cost: formatNumber(cost) }) },
    ]];
  }

  if (isMinesweeper(tower)) {
    return [[
      { text: t('tooltip.minesweeperUpgrade', { tier: tierOfMax('cannon', tower.tier), next: tierOfMax('cannon', next) }) },
      { text: t('tooltip.costBare', { cost: formatNumber(cost) }) },
    ]];
  }

  const name = towerName(tower.kind);
  const before = effectiveStats(tower);
  const after = effectiveStats({ ...tower, tier: next });
  return [[
    { text: t('tooltip.upgradeDmg', { name, tier: tierOfMax(tower.kind, tower.tier), next: tierOfMax(tower.kind, next), before: fmt1(before.damage * tower.auraDamage) }) },
    good(fmt1(after.damage * tower.auraDamage)),
    { text: t('tooltip.rngDelta', { before: fmt1(before.range + tower.auraRange) }) },
    good(fmt1(after.range + tower.auraRange)),
    { text: t('tooltip.cost', { cost: formatNumber(cost) }) },
  ]];
}

/** Behaviour words for branches that change what the tower does rather than just how hard it hits. */
const BRANCH_BEHAVIOUR: Readonly<Partial<Record<TowerKind, Readonly<Partial<Record<Branch, string>>>>>> = {
  aa: { A: t('tooltip.behaviour.aaA'), B: t('tooltip.behaviour.aaB') },
  taser: { A: t('tooltip.behaviour.taserA') },
  frost: { B: t('tooltip.behaviour.frostB') },
  laser: { B: t('tooltip.behaviour.laserB') },
  beacon: { B: t('tooltip.behaviour.beaconB') },
  wall: { B: t('tooltip.behaviour.wallB'), C: t('tooltip.behaviour.wallC') },
};

/**
 * Tooltip for a tier-3 branch button: its own outcome, so a wall's Bulwark, Mesh and Toggle each
 * read differently and a branch that adds a behaviour says so in words.
 */
export function branchTooltipLines(tower: Tower, branch: Branch, salvage: number): TooltipLine[] {
  if (tower.kind === 'cursor') return cursorBranchTooltipLines(tower, branch, salvage);
  const cost = upgradeCost(tower);
  if (cost === null) return [];
  if (salvage < cost) return [cannotAffordText(salvage, cost)];

  const name = branchName(tower.kind, branch);

  if (tower.kind === 'beacon') {
    const before = effectiveStats(tower);
    const after = effectiveStats({ ...tower, tier: 3, branch });
    const segments: TooltipSegment[] = [
      { text: t('tooltip.beaconBranchAura', { name, pct: Math.round(before.auraDamage * 100) }) },
      good('+' + Math.round(after.auraDamage * 100) + '%'),
    ];
    if (branch === BRANCHES[1]) {
      segments.push({
        text: t('tooltip.beaconBranchRelay', { pct: Math.round(after.auraPointerDamage * 100), range: after.auraPointerRange.toFixed(2) }),
      });
    }
    segments.push({ text: t('tooltip.cost', { cost: formatNumber(cost) }) });
    return [segments];
  }

  if (tower.kind === 'cannon' && branch === BRANCHES[1]) {
    const secs = (MINE_EXPIRE_TICKS / TICK_HZ).toFixed(0);
    return [[
      { text: t('tooltip.branchMinesLays', { name }) },
      { text: t('tooltip.minesStats', { damage: MINE_DAMAGE, radius: MINE_BLAST_RADIUS.toFixed(1), max: MINE_LIVE_CAP, seconds: secs }) },
      { text: t('tooltip.cost', { cost: formatNumber(cost) }) },
    ]];
  }

  if (tower.kind === 'wall') {
    const before = wallMaxHp(tower.tier, tower.branch);
    const after = wallMaxHp(3, branch);
    const segments: TooltipSegment[] = [
      { text: t('tooltip.wallBranchHp', { name, before: fmtHp(before) }) },
      good(fmtHp(after)),
    ];
    const behaviour = BRANCH_BEHAVIOUR.wall?.[branch];
    if (behaviour) segments.push({ text: ', ' + behaviour });
    segments.push({ text: t('tooltip.cost', { cost: formatNumber(cost) }) });
    return [segments];
  }

  const before = effectiveStats(tower);
  const after = effectiveStats({ ...tower, tier: 3, branch });
  const segments: TooltipSegment[] = [{ text: name + ' — ' }];

  const push = (label: string, a: string, b: string): void => {
    if (segments.length > 1) segments.push({ text: ' · ' });
    segments.push({ text: t('tooltip.statDelta', { label, before: a }) }, good(b));
  };

  if (after.damage !== before.damage) {
    push('dmg', fmt1(before.damage * tower.auraDamage), fmt1(after.damage * tower.auraDamage));
  }
  const rateBefore = before.fireInterval > 0 ? TICK_HZ / before.fireInterval : 0;
  const rateAfter = after.fireInterval > 0 ? TICK_HZ / after.fireInterval : 0;
  if (rateAfter !== rateBefore) {
    push('rate', fmt1(rateBefore), fmt1(rateAfter) + '/s');
  }
  if (after.range !== before.range) {
    push('rng', fmt1(before.range + tower.auraRange), fmt1(after.range + tower.auraRange));
  }

  const sep = segments.length > 1 ? ', ' : '';
  const behaviour = BRANCH_BEHAVIOUR[tower.kind]?.[branch];
  if (behaviour) segments.push({ text: sep + behaviour });
  segments.push({ text: sep + '$' + formatNumber(cost) });
  return [segments];
}

/**
 * Tooltip for a boss variant the pointer is resting on: its name, live hit points and — for the
 * Bastion — how many shield layers remain. Boss variants are the only enemies with a tooltip so far.
 */
export function enemyTooltipLines(e: Enemy): TooltipLine[] {
  const name = enemyName(e.kind);
  const hp = t('tooltip.enemyHp', { hp: Math.ceil(e.hp), max: e.maxHp });
  if (e.kind === 'shielded-boss') return [name, hp, t('tooltip.shieldLayers', { layers: e.shieldsRemaining })];
  return [name, hp];
}

/** Format a click-damage value: whole numbers stay bare, fractions keep one decimal. */
export function fmtClickDamage(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Tooltip for the pointer Upgrade button: the next stage or overclock level's click damage and cost. */
export function pointerTooltipLines(p: PointerState, salvage: number, wave: number, cap: number = MAX_OVERCLOCK_LEVEL): TooltipLine[] {
  const state = pointerUpgradeState(wave, cap, p);

  if (p.stage < MAX_POINTER_STAGE) {
    const stageCost = state.cost;
    if (stageCost === null) return [t('tooltip.maxLevel')];
    if (salvage < stageCost) return [cannotAffordText(salvage, stageCost)];
    const next = (p.stage + 1) as PointerStage;
    const before = pointerInfo(p).clickDamage;
    const after = pointerInfo({ ...p, stage: next }).clickDamage;
    return [[
      { text: t('tooltip.pointerStage', { stage: p.stage, next, before }) },
      good(String(after)),
      { text: t('tooltip.cost', { cost: formatNumber(stageCost) }) },
    ]];
  }

  if (state.block === 'maxed') return [t('tooltip.maxLevel')];
  if (state.block === 'wave') {
    return [[{ text: t('tooltip.needsWave', { wave: state.unlockWave! }), color: TOOLTIP_BLUE }]];
  }

  const cost = state.cost;
  if (cost === null) return [t('tooltip.maxLevel')];
  if (salvage < cost) return [cannotAffordText(salvage, cost)];
  const nextLevel = p.clickLevel + 1;
  const before = fmtClickDamage(clickDamage(p));
  const after = fmtClickDamage(clickDamage({ ...p, clickLevel: nextLevel }));
  return [[
    { text: t('tooltip.pointerClickDamage', { before }) },
    good(after),
    { text: t('tooltip.cost', { cost: formatNumber(cost) }) },
  ]];
}

/** Tooltip for the Sell button: the refund and the refund rule, or the wall's nothing-refunded rule. */
export function sellTooltipLines(tower: Tower, refund = 0.7): TooltipLine[] {
  const value = sellValue(tower, refund);
  if (tower.kind === 'wall') return [t('tooltip.sellWall')];
  const pct = Math.round(refund * 100);
  return [t('tooltip.sellFor', { value: formatNumber(value), pct, spent: formatNumber(tower.spent) })];
}

/** Tooltip for the Repair button: the amount restored, its price, and how long the job takes. */
export function repairTooltipLines(tower: Tower, clock: number, salvage: number, repairSpeedMult = 1): TooltipLine[] {
  if (isRepairing(tower, clock)) {
    return [t('tooltip.repairing', { seconds: repairRemainingSeconds(tower, clock).toFixed(1) })];
  }
  const hp = repairHpToRestore(tower);
  if (hp <= 0) return [t('tooltip.noDamageRepair')];
  const cost = repairCost(tower);
  if (salvage < cost) return [cannotAffordText(salvage, cost)];
  const duration = repairDurationTicks(tower, repairSpeedMult) / TICK_HZ;
  return [t('tooltip.repair', { hp: Math.ceil(hp), cost: formatNumber(cost), seconds: duration.toFixed(1) })];
}
