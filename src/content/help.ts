import { enemyName, towerName } from '../i18n/names.ts';
import { t } from '../i18n/index.ts';
import { BOSS_KINDS, ENEMY_KINDS, ENEMY_STATS, waveHpScale, type EnemyKind, PACER_AURA_RADIUS, CARRIER_BROOD_COUNT, CARRIER_BROOD_INTERVAL_TICKS, CARRIER_DEATH_BROOD_COUNT, WIRECUTTER_EMP_RADIUS, WIRECUTTER_EMP_TICKS, DREADNOUGHT_SLOW_RESIST } from '../core/enemies.ts';
import {
  TOWER_KINDS,
  TOWER_STATS,
  towerUnlockWave,
  createTower,
  effectiveStats,
  upgradeCost,
  wallMaxHp,
  repairHealRate,
  cursorRadius,
  cursorClickRate,
  CURSOR_REPAIR_THRESHOLD,
  MINE_INTERVAL_TICKS,
  MINE_ARM_TICKS,
  MINE_EXPIRE_TICKS,
  MINE_LIVE_CAP,
  MINE_DAMAGE,
  MINE_BLAST_RADIUS,
  MAX_TIER,
  kindMaxTier,
  BRANCH_TIER,
  CURSOR_CLICK_DAMAGE_FACTOR,
  type Branch,
  type Tier,
  type Tower,
  type TowerKind,
} from '../core/towers.ts';
import { TICK_HZ } from '../core/time.ts';
import { AA_SALVO_COUNT } from '../core/projectiles.ts';
import { AA_HOLD_CAP, AA_HOLD_WINDOW } from '../core/synergy.ts';
import { RAM_SALVAGE_PER_POINT, STARTING_INTEGRITY } from '../core/state.ts';
import {
  CRIT_BASE_CHANCE,
  CRIT_MARKED_CHANCE,
  CRIT_MULTIPLIER,
  CRIT_WEAK_CHANCE,
  MARKED_DAMAGE_MULT,
  MAX_OVERCLOCK_LEVEL,
  OVERCLOCK_DAMAGE_GROWTH,
  OVERCLOCK_MILESTONES,
  OVERCLOCK_WAVE_DIVISOR,
  POINTER_STAGES,
} from '../core/pointer.ts';
import { SPEC_CAPS, rpGain, specLevelCost, specEffectCompactText, type Profile } from '../core/save.ts';
import { earlyCallBonus, EARLY_CALL_FLOOR, WAVE_COUNT } from '../core/waves.ts';
import { ACHIEVEMENTS } from '../core/achievements.ts';
import { DAILY_WAVES } from '../core/daily.ts';
import { LEVELS } from '../core/levels.ts';
import { TREE_NODES } from '../core/tree.ts';
import { branchName } from '../view/tooltipText.ts';
import { artNameForEnemy, artNameForTowerBase, artNameForTowerTurret } from '../view/art.ts';

/**
 * The Help viewer's content: one page per mechanic, enemy, boss and tower.
 *
 * This module is data plus the unlock gates. It is kept Pixi-free so the smoke harness can assert
 * that every kind has exactly one page, that a page's numbers match the constants, and that the
 * gates line up with the profile. The bodies are Markdown (docs/HELP-MARKDOWN.md); every number is
 * read from the core balance tables — never retyped — so a rebalance updates the Help for free.
 *
 * "Help, not spoilers": a page exists to explain a mechanic the player has already met. Enemy and
 * boss pages only unlock once the kind has been encountered, tower pages once the tower has been
 * unlocked, and the always-available pages never name an enemy, boss or tower that the player has
 * not seen.
 */

export type HelpCategory = 'getting-started' | 'mechanics' | 'enemies' | 'bosses' | 'towers';

export type HelpGate =
  | { kind: 'none' }
  | { kind: 'enemy'; enemy: EnemyKind }
  | { kind: 'boss'; enemy: EnemyKind }
  | { kind: 'any-boss' }
  | { kind: 'tower'; tower: TowerKind };

export interface HelpPage {
  readonly id: string;
  readonly title: string;
  readonly category: HelpCategory;
  readonly gate: HelpGate;
  readonly body: readonly string[];
  /** The page's subject art (docs/HELP-ART.md): an enemy sprite, or a tower's base (and turret). */
  readonly art?: HelpPageArt;
}

/** The two textures a Help page's preview box shows, at twice the board's in-game size. */
export interface HelpPageArt {
  /** The body texture: the enemy sprite, or a tower's base. */
  readonly base: string;
  /** A tower's turret, drawn over the base. Absent for enemies and for art with no turret split. */
  readonly turret?: string;
}

export const HELP_CATEGORIES: readonly { id: HelpCategory; title: string }[] = [
  { id: 'getting-started', title: t('help.category.getting-started') },
  { id: 'mechanics', title: t('help.category.mechanics') },
  { id: 'enemies', title: t('help.category.enemies') },
  { id: 'bosses', title: t('help.category.bosses') },
  { id: 'towers', title: t('help.category.towers') },
];

/** Whether a page is readable right now, given what the profile has seen and reached. */
export function pageUnlocked(page: HelpPage, profile: Profile): boolean {
  switch (page.gate.kind) {
    case 'none':
      return true;
    case 'enemy':
      return profile.seenEnemies.includes(page.gate.enemy);
    case 'boss':
      return profile.seenBossKinds.includes(page.gate.enemy);
    case 'any-boss':
      return profile.seenBossKinds.length > 0;
    case 'tower':
      return profile.bestWave >= towerUnlockWave(page.gate.tower);
  }
}

/** The status-line reason a locked page cannot be opened, or null when it is readable. */
export function lockedReason(gate: HelpGate): string | null {
  switch (gate.kind) {
    case 'none':
      return null;
    case 'enemy':
      return 'Encounter this enemy to learn about it';
    case 'boss':
      return 'Encounter this boss to learn about it';
    case 'any-boss':
      return 'Encounter a boss to learn about it';
    case 'tower':
      return 'Unlock this tower to learn about it';
  }
}

// ---------------------------------------------------------------------------------------------
// Number formatting shared by the generated pages.

/** Trim a value to at most two decimals, dropping trailing zeroes (3.0 -> "3", 0.55 -> "0.55"). */
function fmt(n: number): string {
  return n.toFixed(2).replace(/\.?0+$/, '');
}

/** A value to exactly two decimals (3 -> "3.00", 0.5 -> "0.50"). */
function fmt2(n: number): string {
  return n.toFixed(2);
}

/** A multiplier to at most two decimals, no trailing zeroes (0.1 -> "0.1", 2 -> "2"). */
function fmtMult(n: number): string {
  return fmt(n);
}

/** A fraction as a whole percentage (0.6 -> "60%"). */
function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/** Damage per second at a given damage and fire interval (ticks), or an em-dash when it never fires. */
function fmtDps(damage: number, fireTicks: number): string {
  return fireTicks <= 0 ? '—' : fmt2((damage * TICK_HZ) / fireTicks);
}

// ---------------------------------------------------------------------------------------------
// Getting started (always available)

const gettingStartedPage: HelpPage = {
  id: 'getting-started',
  title: t('help.page.getting-started.title'),
  category: 'getting-started',
  gate: { kind: 'none' },
  body: [
    t('help.getting-started.1'),
    t('help.getting-started.2'),
    t('help.getting-started.3'),
    t('help.getting-started.4', { integrity: STARTING_INTEGRITY }),
    t('help.getting-started.5'),
    t('help.getting-started.6', { maxTier: MAX_TIER }),
  ],
};

// ---------------------------------------------------------------------------------------------
// Mechanics (always available)

/** The lowest and highest RP price across the eight tower-licence nodes (docs/PRESTIGE.md). */
function licencePriceRange(): { low: number; high: number } {
  const costs = TREE_NODES.filter((n) => n.effect.unlockTower !== undefined).map((n) => n.cost);
  return { low: Math.min(...costs), high: Math.max(...costs) };
}

const mechanicsPages: readonly HelpPage[] = [
  {
    id: 'mechanics-pointer',
    title: t('help.page.mechanics-pointer.title'),
    category: 'mechanics',
    gate: { kind: 'none' },
    body: [
      t('help.mechanics-pointer.1', {
        click: fmt(POINTER_STAGES[1].clickDamage),
        reticle: fmt(POINTER_STAGES[2].clickDamage),
        hold: fmt(POINTER_STAGES[2].holdDps),
      }),
      t('help.mechanics-pointer.2', {
        growth: fmt(OVERCLOCK_DAMAGE_GROWTH),
        milestones: OVERCLOCK_MILESTONES.map(([level, mult]) => `×${mult} at level ${level}`).join(' and '),
        maxLevel: MAX_OVERCLOCK_LEVEL,
        divisor: OVERCLOCK_WAVE_DIVISOR,
      }),
      t('help.mechanics-pointer.3', {
        crit: fmt(CRIT_MULTIPLIER),
        base: fmtPct(CRIT_BASE_CHANCE),
        marked: fmtPct(CRIT_MARKED_CHANCE),
        weak: fmtPct(CRIT_WEAK_CHANCE),
        mark: fmtPct(MARKED_DAMAGE_MULT - 1),
      }),
      t('help.mechanics-pointer.4'),
      t('help.mechanics-pointer.5'),
    ],
  },
  {
    id: 'mechanics-salvage',
    title: t('help.page.mechanics-salvage.title'),
    category: 'mechanics',
    gate: { kind: 'none' },
    body: [
      t('help.mechanics-salvage.1'),
      t('help.mechanics-salvage.2'),
      t('help.mechanics-salvage.3', {
        cpu: specEffectCompactText('cpu', 1),
        gpu: specEffectCompactText('gpu', 1),
        ram: RAM_SALVAGE_PER_POINT,
        disk: specEffectCompactText('disk', 1),
        caps: `${SPEC_CAPS.cpu}/${SPEC_CAPS.ram}/${SPEC_CAPS.gpu}/${SPEC_CAPS.disk}`,
      }),
      t('help.mechanics-salvage.4', {
        cost0: specLevelCost(0),
        cost1: specLevelCost(1),
        cost2: specLevelCost(2),
        cost3: specLevelCost(3),
      }),
      t('help.mechanics-salvage.5', {
        gain20k: rpGain(20000),
        gain60k: rpGain(60000),
      }),
    ],
  },
  {
    id: 'mechanics-walls',
    title: t('help.page.mechanics-walls.title'),
    category: 'mechanics',
    gate: { kind: 'none' },
    body: [
      t('help.mechanics-walls.1'),
      t('help.mechanics-walls.2'),
      t('help.mechanics-walls.3'),
    ],
  },
  {
    id: 'mechanics-early-call',
    title: t('help.page.mechanics-early-call.title'),
    category: 'mechanics',
    gate: { kind: 'none' },
    body: [
      t('help.mechanics-early-call.1'),
      t('help.mechanics-early-call.2', { bonus: earlyCallBonus(0, 2), floor: EARLY_CALL_FLOOR }),
      t('help.mechanics-early-call.3'),
    ],
  },
  {
    id: 'mechanics-auto-start',
    title: t('help.page.mechanics-auto-start.title'),
    category: 'mechanics',
    gate: { kind: 'none' },
    body: [
      t('help.mechanics-auto-start.1'),
      t('help.mechanics-auto-start.2'),
    ],
  },
  {
    id: 'mechanics-modifiers',
    title: t('help.page.mechanics-modifiers.title'),
    category: 'mechanics',
    gate: { kind: 'none' },
    body: [
      t('help.mechanics-modifiers.1'),
      t('help.mechanics-modifiers.2'),
      t('help.mechanics-modifiers.3'),
      t('help.mechanics-modifiers.4'),
      t('help.mechanics-modifiers.5'),
      t('help.mechanics-modifiers.6'),
    ],
  },
  {
    id: 'mechanics-endless',
    title: t('help.page.mechanics-endless.title'),
    category: 'mechanics',
    gate: { kind: 'none' },
    body: [
      t('help.mechanics-endless.1', { final: WAVE_COUNT }),
      t('help.mechanics-endless.2'),
    ],
  },
  {
    id: 'mechanics-licences',
    title: t('help.page.mechanics-licences.title'),
    category: 'mechanics',
    gate: { kind: 'none' },
    body: [
      t('help.mechanics-licences.1'),
      t('help.mechanics-licences.2'),
      t('help.mechanics-licences.3', licencePriceRange()),
      t('help.mechanics-licences.4'),
    ],
  },
  {
    id: 'mechanics-maps',
    title: t('help.page.mechanics-maps.title'),
    category: 'mechanics',
    gate: { kind: 'none' },
    body: [
      t('help.mechanics-maps.1', { maps: LEVELS.length }),
      t('help.mechanics-maps.2'),
      t('help.mechanics-maps.3'),
    ],
  },
  {
    id: 'mechanics-global-upgrades',
    title: t('help.page.mechanics-global-upgrades.title'),
    category: 'mechanics',
    gate: { kind: 'none' },
    body: [
      t('help.mechanics-global-upgrades.1'),
      t('help.mechanics-global-upgrades.2'),
      t('help.mechanics-global-upgrades.3'),
    ],
  },
  {
    id: 'mechanics-daily',
    title: t('help.page.mechanics-daily.title'),
    category: 'mechanics',
    gate: { kind: 'none' },
    body: [
      t('help.mechanics-daily.1'),
      t('help.mechanics-daily.2', { waves: DAILY_WAVES }),
      t('help.mechanics-daily.3'),
    ],
  },
  {
    id: 'mechanics-achievements',
    title: t('help.page.mechanics-achievements.title'),
    category: 'mechanics',
    gate: { kind: 'none' },
    body: [
      t('help.mechanics-achievements.1', { count: ACHIEVEMENTS.length }),
      t('help.mechanics-achievements.2'),
      t('help.mechanics-achievements.3'),
    ],
  },
  {
    id: 'mechanics-editor',
    title: t('help.page.mechanics-editor.title'),
    category: 'mechanics',
    gate: { kind: 'none' },
    body: [
      t('help.mechanics-editor.1'),
      t('help.mechanics-editor.2'),
      t('help.mechanics-editor.3'),
    ],
  },
];

// ---------------------------------------------------------------------------------------------
// Synergies (always available; docs/SYNERGIES.md §6)

const synergyPage: HelpPage = {
  id: 'synergy',
  title: t('help.synergy.title'),
  category: 'mechanics',
  gate: { kind: 'none' },
  body: [
    t('help.synergy.1'),
    t('help.synergy.2', { interval: Math.round(TOWER_STATS.aa.fireInterval) }),
    t('help.synergy.3', { window: AA_HOLD_WINDOW, cap: AA_HOLD_CAP }),
    t('help.synergy.4'),
    t('synergy.spotter.name') + ' — ' + t('synergy.spotter.description'),
    t('synergy.chill.name') + ' — ' + t('synergy.chill.description'),
    t('synergy.interlock.name') + ' — ' + t('synergy.interlock.description'),
    t('synergy.shatter.name') + ' — ' + t('synergy.shatter.description'),
    t('synergy.buttress.name') + ' — ' + t('synergy.buttress.description'),
  ],
};

// ---------------------------------------------------------------------------------------------
// Enemies (one page per ordinary kind, gated on first encounter)

/** The wave 1 / 25 / 50 / 75 / 100 hit-point table, straight from `waveHpScale` and the base HP. */
function hpTable(kind: EnemyKind): string[] {
  const base = ENEMY_STATS[kind].hp;
  const wave = t('help.table.wave');
  const hp = t('help.table.hp');
  return [
    `| ${wave} | ${hp} |`,
    '|---|--:|',
    ...[1, 25, 50, 75, 100].map((w) => `| ${w} | ${Math.round(base * waveHpScale(w))} |`),
  ];
}

function enemyStatsLine(kind: EnemyKind): string {
  const st = ENEMY_STATS[kind];
  const params: Record<string, string | number> = { hp: st.hp, speed: fmt(st.speed) };
  if (st.armour > 0) params.armour = st.armour;
  if (st.shield > 0) params.shield = st.shield;
  return t(`help.enemy-${kind}.1`, params);
}

function enemyPage(kind: EnemyKind): HelpPage {
  const artName = artNameForEnemy(kind);
  return {
    id: `enemy-${kind}`,
    title: enemyName(kind),
    category: 'enemies',
    gate: { kind: 'enemy', enemy: kind },
    body: [enemyStatsLine(kind), ...hpTable(kind), t(`help.enemy-${kind}.2`)],
    ...(artName !== null ? { art: { base: artName } } : {}),
  };
}

// ---------------------------------------------------------------------------------------------
// Bosses (one page per variant, plus a general page; gated on first encounter)

const bossesInGeneralPage: HelpPage = {
  id: 'bosses-in-general',
  title: t('help.page.bosses-in-general.title'),
  category: 'bosses',
  gate: { kind: 'any-boss' },
  body: [
    t('help.bosses-in-general.1'),
    t('help.bosses-in-general.2'),
    t('help.bosses-in-general.3'),
  ],
};

/** A boss gimmick line's numbers, read from the sim constants. */
function bossGimmickParams(kind: EnemyKind): Record<string, string | number> {
  if (kind === 'runner-boss') return { radius: PACER_AURA_RADIUS };
  if (kind === 'flyer-boss') {
    return { brood: CARRIER_BROOD_COUNT, interval: fmt(CARRIER_BROOD_INTERVAL_TICKS / TICK_HZ), death: CARRIER_DEATH_BROOD_COUNT };
  }
  if (kind === 'saboteur-boss') {
    return { radius: fmt(WIRECUTTER_EMP_RADIUS), duration: fmt(WIRECUTTER_EMP_TICKS / TICK_HZ) };
  }
  if (kind === 'armoured-boss') return { resist: fmt(DREADNOUGHT_SLOW_RESIST) };
  return {};
}

function bossPage(kind: EnemyKind): HelpPage {
  const st = ENEMY_STATS[kind];
  const artName = artNameForEnemy(kind);
  return {
    id: `boss-${kind}`,
    title: enemyName(kind),
    category: 'bosses',
    gate: { kind: 'boss', enemy: kind },
    body: [
      t(`help.boss-${kind}.1`, { hp: st.hp, speed: fmt(st.speed), integrity: st.integrity }),
      ...hpTable(kind),
      t(`help.boss-${kind}.2`, bossGimmickParams(kind)),
      t(`help.boss-${kind}.3`),
    ],
    ...(artName !== null ? { art: { base: artName } } : {}),
  };
}

// ---------------------------------------------------------------------------------------------
// Towers (one page per kind, gated on bestWave reaching its unlock wave)

function towerBranches(kind: TowerKind): readonly Branch[] {
  if (kind === 'repair') return [];
  return kind === 'wall' || kind === 'cursor' ? (['A', 'B', 'C'] as const) : (['A', 'B'] as const);
}

/** A synthetic tower at a tier and branch, so the block reads exactly what the sim would use. */
function synthTower(kind: TowerKind, tier: Tier, branch: Branch | null): Tower {
  const t = createTower(0, kind, 0, 0);
  t.tier = tier;
  t.branch = branch;
  return t;
}

/** The price of the upgrade after the given tier and branch, or null at the top of the ladder. */
function nextUpgradeCost(kind: TowerKind, tier: Tier, branch: Branch | null): number | null {
  return upgradeCost(synthTower(kind, tier, branch));
}

/**
 * A branch column's headline stat (docs/HELP-MARKDOWN.md): DPS for damage towers, hit points for a
 * Wall, heal rate for Repair, clicks per second for the Cursor, aura bonus for the Beacon.
 */
function headlineCell(kind: TowerKind, tier: Tier, branch: Branch | null): string {
  if (kind === 'wall') return String(wallMaxHp(tier, branch));
  if (kind === 'repair') return fmt(repairHealRate(synthTower(kind, tier, branch)));
  if (kind === 'cursor') return fmt(cursorClickRate(synthTower(kind, tier, branch)));
  if (kind === 'beacon') return `+${fmtPct(effectiveStats(synthTower(kind, tier, branch)).auraDamage)}`;
  const eff = effectiveStats(synthTower(kind, tier, branch));
  return fmtDps(eff.damage, eff.fireInterval);
}

/** The tier ladder as a pipe table: one column per branch (or one headline column for Repair). */
function towerTable(kind: TowerKind): string[] {
  const branches = towerBranches(kind);
  const head = [t('help.table.tier'), t('help.table.cost'), ...branches.map((b) => branchName(kind, b))];
  if (branches.length === 0) head.push(t('help.table.heal'));
  const lines: string[] = [];
  lines.push(`| ${head.join(' | ')} |`);
  lines.push(`|${head.map((_, i) => (i === 0 ? '---' : '--:')).join('|')}|`);

  const maxTier = kindMaxTier(kind);
  for (let tier = 1; tier <= maxTier; tier++) {
    const cells: string[] = [String(tier)];
    cells.push(tier === 1 ? '—' : `$${upgradeCost(synthTower(kind, (tier - 1) as Tier, null))}`);
    if (branches.length === 0) {
      cells.push(headlineCell(kind, tier as Tier, null));
    } else {
      for (const b of branches) {
        cells.push(tier <= 2 ? (b === branches[0] ? headlineCell(kind, tier as Tier, null) : '—') : headlineCell(kind, tier as Tier, b));
      }
    }
    lines.push(`| ${cells.join(' | ')} |`);
  }
  return lines;
}

/** The line a branch bullet ends on, counting the prose lines of the tower page (line 1 = cost line). */
function branchBulletKey(kind: TowerKind, branch: Branch): string {
  const n = branch === 'A' ? 3 : branch === 'B' ? 4 : 5;
  return `help.tower-${kind}.${n}`;
}

/** A branch's "what it does": the numbers read from the sim's functions, in the bullet's placeholders. */
function branchEffectParams(kind: TowerKind, branch: Branch): Record<string, string | number> {
  if (kind === 'cannon' && branch === 'B') {
    return {
      interval: fmt2(MINE_INTERVAL_TICKS / TICK_HZ),
      arm: fmt2(MINE_ARM_TICKS / TICK_HZ),
      cap: MINE_LIVE_CAP,
      damage: MINE_DAMAGE,
      blast: fmt2(MINE_BLAST_RADIUS),
      expire: fmt2(MINE_EXPIRE_TICKS / TICK_HZ),
    };
  }
  if (kind === 'aa' && branch === 'B') {
    return { salvo: AA_SALVO_COUNT, pct: fmtPct(1 / AA_SALVO_COUNT) };
  }
  if (kind === 'taser' && branch === 'A') {
    return { chain: effectiveStats(synthTower('taser', BRANCH_TIER, branch)).chainCount };
  }
  if (kind === 'wall') {
    return { hp: wallMaxHp(3, branch) };
  }
  if (kind === 'cursor') {
    const t = synthTower('cursor', 3, branch);
    if (branch === 'C') return { pct: fmtPct(CURSOR_REPAIR_THRESHOLD) };
    return { rate: fmt(cursorClickRate(t)), radius: fmt(cursorRadius(t)) };
  }
  if (kind === 'beacon') {
    const eff = effectiveStats(synthTower('beacon', 3, branch));
    if (branch === 'A') return { aura: fmtPct(eff.auraDamage) };
    return { aura: fmtPct(eff.auraDamage), pointerDamage: fmtPct(eff.auraPointerDamage), pointerRange: fmtMult(eff.auraPointerRange) };
  }
  return {};
}

/** One bullet per branch: its name, price and what it does. */
function branchBullets(kind: TowerKind): string[] {
  return towerBranches(kind).map((b) => {
    return t(branchBulletKey(kind, b), {
      name: branchName(kind, b),
      cost: `$${nextUpgradeCost(kind, 2, null)}`,
      ...branchEffectParams(kind, b),
    });
  });
}

/** The role line's numbers, read from the sim where the sentence needs them. */
function roleLineParams(kind: TowerKind): Record<string, string | number> {
  if (kind === 'frost') {
    return { slow: fmtPct(TOWER_STATS.frost.slowFactor), duration: fmt(TOWER_STATS.frost.slowTicks / TICK_HZ) };
  }
  if (kind === 'aa') {
    return { mult: fmtMult(TOWER_STATS.aa.flyerDamageMult ?? 1) };
  }
  if (kind === 'cursor') {
    return { pct: fmtPct(CURSOR_CLICK_DAMAGE_FACTOR) };
  }
  return {};
}

function towerPage(kind: TowerKind): HelpPage {
  const base = artNameForTowerBase(kind);
  const turret = artNameForTowerTurret(kind);
  const st = TOWER_STATS[kind];
  const unlock = Math.max(1, towerUnlockWave(kind));
  const body: string[] = [
    t(`help.tower-${kind}.1`, { cost: `$${st.cost}`, unlock }),
    ...towerTable(kind),
  ];
  if (towerBranches(kind).length > 0) body.push(t(`help.tower-${kind}.2`, { branchTier: BRANCH_TIER }));
  body.push(...branchBullets(kind));
  const roleLine = towerBranches(kind).length === 0 ? 2 : towerBranches(kind).length === 3 ? 6 : 5;
  body.push(t(`help.tower-${kind}.${roleLine}`, roleLineParams(kind)));
  return {
    id: `tower-${kind}`,
    title: towerName(kind),
    category: 'towers',
    gate: { kind: 'tower', tower: kind },
    body,
    ...(base !== null ? { art: { base, ...(turret !== null ? { turret } : {}) } } : {}),
  };
}

// ---------------------------------------------------------------------------------------------
// The full table, in tree order.

export const HELP_PAGES: readonly HelpPage[] = [
  gettingStartedPage,
  ...mechanicsPages,
  synergyPage,
  ...(ENEMY_KINDS as readonly EnemyKind[]).map(enemyPage),
  bossesInGeneralPage,
  ...(BOSS_KINDS as readonly EnemyKind[]).map(bossPage),
  ...TOWER_KINDS.map(towerPage),
];

/** The page with a given id, or undefined. */
export function pageById(id: string): HelpPage | undefined {
  return HELP_PAGES.find((p) => p.id === id);
}

/** The pages in one chapter, in tree order. */
export function pagesForCategory(category: HelpCategory): readonly HelpPage[] {
  return HELP_PAGES.filter((p) => p.category === category);
}
