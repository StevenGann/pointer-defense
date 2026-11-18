import {
  CURSOR_REPAIR_THRESHOLD,
  cursorClickDamage,
  cursorClickDamageFactor,
  cursorClickRate,
  cursorRadius,
  effectiveStats,
  gateLockRemainingSeconds,
  isFullyUpgraded,
  isGateLocked,
  isRepairing,
  isTowerUnlocked,
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
  nextOverclockCost,
  nextStageCost,
  overclockCeiling,
  overclockUnlockWave,
  pointerInfo,
  type PointerState,
  type PointerStage,
} from '../core/pointer.ts';
import { SPEC_CAPS, SPEC_NAMES, specEffectText, type SpecKind, type SpecLevels } from '../core/save.ts';
import { pointerDamageMult } from '../core/state.ts';
import { TICK_HZ } from '../core/time.ts';
import { ENEMY_STATS, type Enemy } from '../core/enemies.ts';

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
  gun: { A: 'Marksman', B: 'Repeater' },
  cannon: { A: 'Mortar', B: 'Flak' },
  taser: { A: 'Arc', B: 'Overload' },
  frost: { A: 'Deep Freeze', B: 'Shard' },
  laser: { A: 'Focus', B: 'Prism' },
  aa: { A: 'Flak', B: 'Missile' },
  beacon: { A: 'Command', B: 'Relay' },
  repair: {},
  wall: { A: 'Bulwark', B: 'Mesh', C: 'Toggle' },
  cursor: { A: 'Overclock', B: 'Wide Search', C: 'Maintenance' },
};

/** The display name of a branch, falling back to the key so an unknown branch still reads. */
export function branchName(kind: TowerKind, branch: Branch): string {
  return BRANCH_NAMES[kind][branch] ?? branch;
}

export const TARGET_LABEL: Readonly<Record<TargetMode, string>> = {
  first: 'First',
  strong: 'Strong',
  close: 'Close',
};

/** The fixed-label wording for a locked mode; "close" reads "Closest" to name the behaviour. */
const TARGET_LOCK_LABEL: Readonly<Record<TargetMode, string>> = {
  first: 'First',
  strong: 'Strong',
  close: 'Closest',
};

/** The target row's display value: a locked kind reads "<Mode> (fixed)", the cursor reads the
 *  compact "Shield first", and others read the stored mode. */
export function targetModeDisplay(tower: Tower): string {
  if (tower.kind === 'cursor') return 'Shield first';
  const lock = TOWER_STATS[tower.kind].targetLock;
  return lock !== null ? `${TARGET_LOCK_LABEL[lock]} (fixed)` : TARGET_LABEL[tower.targetMode];
}

/** The one-sentence reason a locked tower cannot be re-targeted, or null for a configurable kind. */
export function targetLockReason(kind: TowerKind): string | null {
  if (kind === 'cursor') return 'Shielded enemies first, then the nearest; this cannot be changed. The marked enemy overrides it.';
  if (kind === 'frost') return 'Frost always targets the closest enemy.';
  switch (TOWER_STATS[kind].targetLock) {
    case 'close':
      return 'A Tesla coil discharges into whatever is nearest.';
    case 'first':
      return 'A laser fires down the lane at the leading edge.';
    case 'strong':
      return 'A cannon swings at the biggest thing it can see.';
    default:
      return null;
  }
}

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

/** The "Unlocks at wave N" line for a build-palette tower that is still locked, or null. */
export function lockedPaletteLine(kind: TowerKind, wave: number): string | null {
  return isTowerUnlocked(kind, wave) ? null : `Unlocks at wave ${towerUnlockWave(kind)}`;
}

/** Tooltip lines for a build-palette button (the tower's base, un-upgraded stats). */
export function paletteTooltipLines(kind: TowerKind): string[] {
  if (kind === 'cursor') {
    return ['Cursor  $200', 'a cursor that clicks for 50% of your click damage, 3.0 tiles'];
  }
  if (kind === 'repair') {
    return ['Repair  $220', 'heals 2 HP/s to towers within 4.5 tiles'];
  }
  if (kind === 'aa') {
    return ['AA  $40', 'anti-air: flyers only, 2x damage to flyers', 'Range 3.4 · Damage 2.6 · 1.8/s', 'Holds fire on ground-only waves'];
  }
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
export function towerTooltipLines(
  tower: Tower,
  clock: number,
  pointer?: PointerState,
  specs?: SpecLevels,
  healedCount = 0,
  maintenanceStatus: string | null = null,
): string[] {
  if (tower.kind === 'cursor') {
    const lines =
      pointer && specs ? cursorTooltipLines(tower, pointer, specs, maintenanceStatus) : [`Cursor T${tower.tier}`];
    if (isFullyUpgraded(tower)) lines.push('Fully upgraded');
    return lines;
  }
  const branch = tower.branch === null ? '' : ` — ${branchName(tower.kind, tower.branch)}`;
  const name = `${TOWER_STATS[tower.kind].name} T${tower.tier}${branch}`;

  if (tower.kind === 'repair') {
    const heal = repairHealRate(tower);
    const radius = repairRadius(tower);
    const lines = [
      name,
      `Heals ${heal.toFixed(1)} HP/s · Radius ${radius.toFixed(1)}`,
      `Healing ${healedCount} towers`,
      `Sell $${formatNumber(sellValue(tower))}`,
    ];
    if (isFullyUpgraded(tower)) lines.push('Fully upgraded');
    return lines;
  }

  if (tower.kind === 'wall') {
    const hp = tower.branch === null ? `HP ${Math.ceil(tower.hp)}` : `HP ${Math.ceil(tower.hp)}/${tower.maxHp}`;
    const locked = isGateLocked(tower, clock);
    const blocks =
      tower.branch === 'B'
        ? 'Blocks ground and flyers'
        : locked
          ? `Gate locked — ${gateLockRemainingSeconds(tower, clock).toFixed(1)} s`
          : tower.branch === 'C'
            ? tower.open
              ? 'Open — ground passes through'
              : 'Closed — blocks ground'
            : 'Blocks ground only';
    const lines = [name, hp, blocks, `Sell $${formatNumber(sellValue(tower))}`];
    if (isFullyUpgraded(tower)) lines.push('Fully upgraded');
    return lines;
  }

  if (tower.kind === 'aa') {
    const st = effectiveStats(tower);
    const damage = st.damage * tower.auraDamage;
    const range = st.range + tower.auraRange;
    const rate = st.fireInterval > 0 ? TICK_HZ / st.fireInterval : 0;
    const dps = damage * rate * 2; // 2x against flyers
    const behaviour =
      tower.branch === 'A'
        ? 'Flak: shells burst, full to flyers, half to ground'
        : tower.branch === 'B'
          ? 'Missile: 4 homing missiles per salvo'
          : 'Flyers only — never shoots ground';
    const lines = [
      name,
      `Damage ${damage.toFixed(1)} (2x vs flyers) · Range ${range.toFixed(1)}`,
      `Rate ${rate.toFixed(1)}/s · DPS ${dps.toFixed(1)} (vs flyers)`,
      behaviour,
      `Target: ${targetModeDisplay(tower)}`,
      turnText(st.turnRate),
      `Sell $${formatNumber(sellValue(tower))}`,
    ];
    if (isFullyUpgraded(tower)) lines.push('Fully upgraded');
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
    `Damage ${damage.toFixed(1)} · Range ${range.toFixed(1)}`,
    `Rate ${firing ? rate.toFixed(1) + '/s' : '—'} · DPS ${firing ? dps.toFixed(1) : '—'}`,
    `Target: ${targetModeDisplay(tower)}`,
    turnText(st.turnRate),
    `Sell $${formatNumber(sellValue(tower))}`,
  ];
  if (isFullyUpgraded(tower)) lines.push('Fully upgraded');
  return lines;
}

/** Tooltip lines for a placed cursor tower: its rate, radius and the ladder-derived click damage. */
export function cursorTooltipLines(
  tower: Tower,
  pointer: PointerState,
  specs: SpecLevels,
  maintenanceStatus: string | null = null,
): string[] {
  const branch = tower.branch === null ? '' : ` — ${branchName('cursor', tower.branch)}`;
  const name = `Cursor T${tower.tier}${branch}`;

  if (tower.tier >= 3 && tower.branch === 'C') {
    const pct = Math.round(CURSOR_REPAIR_THRESHOLD * 100);
    return [
      name,
      'Repairs damaged towers when its radius is clear',
      `Below ${pct}% HP${maintenanceStatus ? ` · ${maintenanceStatus}` : ''}`,
      'No combat boost — an Overclock clicks 1.8× faster',
      `Sell $${formatNumber(sellValue(tower))}`,
    ];
  }

  const rate = cursorClickRate(tower);
  const radius = cursorRadius(tower);
  const player = clickDamage(pointer);
  const dmg = cursorClickDamage(tower, player, pointerDamageMult(specs));
  return [
    name,
    `Rate ${rate.toFixed(1)}/s · Radius ${radius.toFixed(1)}`,
    `Click damage ${fmtClickDamage(dmg)} (50% of ${fmtClickDamage(player)})`,
    `Target: ${targetModeDisplay(tower)}`,
    `Sell $${formatNumber(sellValue(tower))}`,
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
    { text: `Cursor T${tower.tier} → T${next} — rate ${fmt1(beforeRate)} → ` },
    good(`${fmt1(afterRate)}/s`),
  ];
  if (afterRng !== beforeRng) segments.push({ text: ` · rng ${fmt1(beforeRng)} → ` }, good(fmt1(afterRng)));
  segments.push({ text: `, $${formatNumber(cost)}` });
  return [segments];
}

/** Tooltip for a cursor's tier-3 branch button: rate, radius and click-damage changes. */
export function cursorBranchTooltipLines(tower: Tower, branch: Branch, salvage: number): TooltipLine[] {
  const cost = upgradeCost(tower);
  if (cost === null) return [];
  if (salvage < cost) return [cannotAffordText(salvage, cost)];
  const name = branchName('cursor', branch);

  if (branch === 'C') {
    const pct = Math.round(CURSOR_REPAIR_THRESHOLD * 100);
    return [[
      { text: `${name} — repairs damaged towers below ${pct}% HP when its radius is clear; ` },
      { text: 'no Overclock damage boost' },
      { text: `, $${formatNumber(cost)}` },
    ]];
  }

  const beforeRate = cursorClickRate(tower);
  const afterRate = cursorClickRate({ ...tower, tier: 3, branch });
  const beforeRng = cursorRadius(tower);
  const afterRng = cursorRadius({ ...tower, tier: 3, branch });
  const beforeDmg = cursorClickDamageFactor(tower);
  const afterDmg = cursorClickDamageFactor({ ...tower, tier: 3, branch });
  const segments: TooltipSegment[] = [
    { text: `${name} — rate ${fmt1(beforeRate)} → ` },
    good(`${fmt1(afterRate)}/s`),
  ];
  if (afterRng !== beforeRng) segments.push({ text: ` · rng ${fmt1(beforeRng)} → ` }, good(fmt1(afterRng)));
  if (afterDmg !== beforeDmg) segments.push({ text: ` · click dmg ×${fmt1(beforeDmg)} → ` }, good(`×${fmt1(afterDmg)}`));
  segments.push({ text: `, $${formatNumber(cost)}` });
  return [segments];
}

/** Disabled-reason text for a purchase the player cannot yet afford. */
export function cannotAffordText(salvage: number, cost: number): string {
  return `Cannot afford ($${formatNumber(salvage)} of $${formatNumber(cost)})`;
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
  const segments: TooltipSegment[] = [{ text: `Repair T${tower.tier} → T${next} — ` }];
  if (afterRng !== beforeRng) segments.push({ text: `rng ${fmt1(beforeRng)} → ` }, good(fmt1(afterRng)));
  if (afterHeal !== beforeHeal) {
    if (segments.length > 1) segments.push({ text: ' · ' });
    segments.push({ text: `heal ${fmt1(beforeHeal)} → ` }, good(`${fmt1(afterHeal)} HP/s`));
  }
  segments.push({ text: `, $${formatNumber(cost)}` });
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

  if (tower.kind === 'wall') {
    const before = wallMaxHp(tower.tier, tower.branch);
    const after = wallMaxHp(next, tower.branch);
    return [[
      { text: `Wall T${next} — HP ${fmtHp(before)} → ` },
      good(fmtHp(after)),
      { text: `, $${formatNumber(cost)}` },
    ]];
  }

  const name = TOWER_STATS[tower.kind].name;
  const before = effectiveStats(tower);
  const after = effectiveStats({ ...tower, tier: next });
  return [[
    { text: `${name} T${tower.tier} → T${next} — dmg ${fmt1(before.damage * tower.auraDamage)} → ` },
    good(fmt1(after.damage * tower.auraDamage)),
    { text: ` · rng ${fmt1(before.range + tower.auraRange)} → ` },
    good(fmt1(after.range + tower.auraRange)),
    { text: `, $${formatNumber(cost)}` },
  ]];
}

/** Behaviour words for branches that change what the tower does rather than just how hard it hits. */
const BRANCH_BEHAVIOUR: Readonly<Partial<Record<TowerKind, Readonly<Partial<Record<Branch, string>>>>>> = {
  cannon: { B: 'air only' },
  aa: { A: 'shells burst, half damage to ground', B: '4 homing missiles per salvo' },
  taser: { A: 'chains to 3' },
  frost: { B: 'no slow' },
  laser: { B: 'splits into 3' },
  beacon: { B: 'buff the pointer' },
  wall: { B: 'blocks flyers', C: 'click to open/close' },
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

  if (tower.kind === 'wall') {
    const before = wallMaxHp(tower.tier, tower.branch);
    const after = wallMaxHp(3, branch);
    const segments: TooltipSegment[] = [
      { text: `${name} — HP ${fmtHp(before)} → ` },
      good(fmtHp(after)),
    ];
    const behaviour = BRANCH_BEHAVIOUR.wall?.[branch];
    if (behaviour) segments.push({ text: `, ${behaviour}` });
    segments.push({ text: `, $${formatNumber(cost)}` });
    return [segments];
  }

  const before = effectiveStats(tower);
  const after = effectiveStats({ ...tower, tier: 3, branch });
  const segments: TooltipSegment[] = [{ text: `${name} — ` }];

  const push = (label: string, a: string, b: string): void => {
    if (segments.length > 1) segments.push({ text: ' · ' });
    segments.push({ text: `${label} ${a} → ` }, good(b));
  };

  if (after.damage !== before.damage) {
    push('dmg', fmt1(before.damage * tower.auraDamage), fmt1(after.damage * tower.auraDamage));
  }
  const rateBefore = before.fireInterval > 0 ? TICK_HZ / before.fireInterval : 0;
  const rateAfter = after.fireInterval > 0 ? TICK_HZ / after.fireInterval : 0;
  if (rateAfter !== rateBefore) {
    push('rate', fmt1(rateBefore), `${fmt1(rateAfter)}/s`);
  }
  if (after.range !== before.range) {
    push('rng', fmt1(before.range + tower.auraRange), fmt1(after.range + tower.auraRange));
  }

  const behaviour = BRANCH_BEHAVIOUR[tower.kind]?.[branch];
  if (behaviour) segments.push({ text: `${segments.length > 1 ? ', ' : ''}${behaviour}` });
  segments.push({ text: `${segments.length > 1 ? ', ' : ''}$${formatNumber(cost)}` });
  return [segments];
}

/**
 * Tooltip for a boss variant the pointer is resting on: its name, live hit points and — for the
 * Bastion — how many shield layers remain. Boss variants are the only enemies with a tooltip so far.
 */
export function enemyTooltipLines(e: Enemy): TooltipLine[] {
  const name = ENEMY_STATS[e.kind].name;
  const hp = `${Math.ceil(e.hp)} / ${e.maxHp} HP`;
  if (e.kind === 'shielded-boss') return [name, hp, `Shield layers: ${e.shieldsRemaining}`];
  return [name, hp];
}

/** Format a click-damage value: whole numbers stay bare, fractions keep one decimal. */
export function fmtClickDamage(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Tooltip for the pointer Upgrade button: the next stage or overclock level's click damage and cost. */
export function pointerTooltipLines(p: PointerState, salvage: number, wave: number): TooltipLine[] {
  const stageCost = nextStageCost(p);
  if (stageCost !== null) {
    if (salvage < stageCost) return [cannotAffordText(salvage, stageCost)];
    const next = (p.stage + 1) as PointerStage;
    const before = pointerInfo(p).clickDamage;
    const after = pointerInfo({ ...p, stage: next }).clickDamage;
    return [[
      { text: `Pointer T${p.stage} → T${next} — click damage ${before} → ` },
      good(String(after)),
      { text: `, $${formatNumber(stageCost)}` },
    ]];
  }

  if (p.clickLevel >= MAX_OVERCLOCK_LEVEL) return ['Max level'];

  const nextLevel = p.clickLevel + 1;
  if (nextLevel > overclockCeiling(wave)) {
    return [`Wave ${overclockUnlockWave(nextLevel)} unlocks overclock ${nextLevel}`];
  }

  const cost = nextOverclockCost(p);
  if (cost === null) return ['Max level'];
  if (salvage < cost) return [cannotAffordText(salvage, cost)];
  const before = fmtClickDamage(clickDamage(p));
  const after = fmtClickDamage(clickDamage({ ...p, clickLevel: nextLevel }));
  return [[
    { text: `Click damage ${before} → ` },
    good(after),
    { text: `, $${formatNumber(cost)}` },
  ]];
}

/** Tooltip for the Sell button: the refund and the 70% rule, or the wall's nothing-refunded rule. */
export function sellTooltipLines(tower: Tower): TooltipLine[] {
  const value = sellValue(tower);
  if (tower.kind === 'wall') return ['Sell for $0 (walls refund nothing)'];
  return [`Sell for $${formatNumber(value)} (70% of $${formatNumber(tower.spent)} spent)`];
}

/** Tooltip for the Repair button: the amount restored, its price, and how long the job takes. */
export function repairTooltipLines(tower: Tower, clock: number, salvage: number): TooltipLine[] {
  if (isRepairing(tower, clock)) {
    return [`Repairing — ${repairRemainingSeconds(tower, clock).toFixed(1)} s`];
  }
  const hp = repairHpToRestore(tower);
  if (hp <= 0) return ['No damage to repair'];
  const cost = repairCost(tower);
  if (salvage < cost) return [cannotAffordText(salvage, cost)];
  const duration = repairDurationTicks(tower) / TICK_HZ;
  return [`Repair ${Math.ceil(hp)} HP — $${formatNumber(cost)}, ${duration.toFixed(1)} s`];
}

/** Tooltip for a spec shop row: the effect the game actually applies at the next level. */
export function specTooltipLines(kind: SpecKind, level: number, banked: number): TooltipLine[] {
  const cap = SPEC_CAPS[kind];
  if (level >= cap) return [`${SPEC_NAMES[kind]} maxed at ${cap}`];
  if (banked <= 0) return ['Needs 1 spec'];
  return [[
    { text: `${SPEC_NAMES[kind]} ${level} → ${level + 1} (${specEffectText(kind, level)} → ` },
    good(specEffectText(kind, level + 1)),
    { text: '), 1 spec' },
  ]];
}
