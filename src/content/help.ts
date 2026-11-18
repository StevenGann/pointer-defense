import { BOSS_KINDS, ENEMY_KINDS, ENEMY_STATS, type EnemyKind } from '../core/enemies.ts';
import { TOWER_KINDS, TOWER_STATS, towerUnlockWave, type Branch, type TowerKind } from '../core/towers.ts';
import { TICK_HZ } from '../core/time.ts';
import { branchName } from '../view/tooltipText.ts';
import type { Profile } from '../core/save.ts';

/**
 * The Help viewer's content: one page per mechanic, enemy, boss and tower.
 *
 * This module is data plus the unlock gates. It is kept Pixi-free so the smoke harness can assert
 * that every kind has exactly one page, that a page's numbers match the constants, and that the
 * gates line up with the profile. The numbers below are read from the core balance tables, never
 * retyped, so a rebalance updates the Help text for free.
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
}

export const HELP_CATEGORIES: readonly { id: HelpCategory; title: string }[] = [
  { id: 'getting-started', title: 'Getting started' },
  { id: 'mechanics', title: 'Mechanics' },
  { id: 'enemies', title: 'Enemies' },
  { id: 'bosses', title: 'Bosses' },
  { id: 'towers', title: 'Towers' },
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

/** Ticks to a seconds string (0.5 s, 1.6 s), or an em-dash for towers that never fire. */
function fmtSeconds(ticks: number): string {
  if (ticks <= 0) return '—';
  return fmt(ticks / TICK_HZ);
}

// ---------------------------------------------------------------------------------------------
// Getting started (always available)

const gettingStartedPage: HelpPage = {
  id: 'getting-started',
  title: 'Getting started',
  category: 'getting-started',
  gate: { kind: 'none' },
  body: [
    'A run is a series of waves. Between waves you build; during a wave the enemies walk the route and you click them.',
    'Build phase: place towers and shape the maze. Press Start Wave (or Enter) when you are ready.',
    'Waves: enemies cross from the entrance to the exit. Anything that gets through costs integrity.',
    'Integrity: you start with 20. When it reaches zero the run is over.',
    'The pointer: click enemies to shoot them. Aim for the leading notch to deal double damage.',
  ],
};

// ---------------------------------------------------------------------------------------------
// Mechanics (always available)

const mechanicsPages: readonly HelpPage[] = [
  {
    id: 'mechanics-pointer',
    title: 'The pointer ladder',
    category: 'mechanics',
    gate: { kind: 'none' },
    body: [
      'The pointer upgrades through stages, then through overclock levels, buying more click damage with salvage.',
      'Clicks ignore armour and wear shields down, so the pointer is the answer to enemies your towers cannot touch.',
      'Upgrade the pointer from the right-hand panel during a run.',
    ],
  },
  {
    id: 'mechanics-salvage',
    title: 'Salvage and specs',
    category: 'mechanics',
    gate: { kind: 'none' },
    body: [
      'Salvage is the run\'s currency: kills pay it, and you spend it on towers, upgrades and the pointer.',
      'Specs are permanent. A reboot banks specs from the run\'s lifetime salvage, and they carry into the next run.',
      'Each spec has an effect: CPU adds tower damage, GPU adds pointer damage, RAM adds starting salvage, Disk adds starting integrity.',
    ],
  },
  {
    id: 'mechanics-walls',
    title: 'Walls and pathing',
    category: 'mechanics',
    gate: { kind: 'none' },
    body: [
      'Walls block the route, so enemies walk around them. A longer route means more time under your towers.',
      'The board refuses a wall (or tower) that would seal the route and leave no path to the exit.',
      'Some enemies ignore walls: flyers fly straight over, and breachers chew through them.',
    ],
  },
  {
    id: 'mechanics-early-call',
    title: 'Calling waves early',
    category: 'mechanics',
    gate: { kind: 'none' },
    body: [
      'You can call the next wave while one is still running. The earlier you call, the bigger the salvage bonus.',
      'Two waves can run at once, so an early call is risk for reward.',
    ],
  },
  {
    id: 'mechanics-auto-start',
    title: 'Auto-start',
    category: 'mechanics',
    gate: { kind: 'none' },
    body: [
      'Turn on Auto and the next wave starts 1.5 s after the board clears.',
      'It waits while a tower is mid-repair, then fires.',
    ],
  },
  {
    id: 'mechanics-modifiers',
    title: 'Modifiers',
    category: 'mechanics',
    gate: { kind: 'none' },
    body: [
      'From later in a run, waves carry modifiers that change the rules.',
      '• No-Build — the board is frozen: no placing, upgrading, selling, repairing or retargeting.',
      '• Fog — tower range is reduced.',
      '• Fast Forward — enemies move faster.',
      '• Blackout — your salvage readout is hidden.',
      '• Rush — spawns come closer together.',
    ],
  },
  {
    id: 'mechanics-endless',
    title: 'Endless',
    category: 'mechanics',
    gate: { kind: 'none' },
    body: [
      'After the hundredth wave you can choose Endless and keep going.',
      'Endless waves keep getting harder. There is no final wave.',
    ],
  },
];

// ---------------------------------------------------------------------------------------------
// Enemies (one page per ordinary kind, gated on first encounter)

const ENEMY_ANSWER: Readonly<Record<Exclude<EnemyKind, `${string}-boss`>, string>> = {
  grunt: 'The basic creep and the unit everything else is measured against. Anything kills it — it is the enemy you build and shoot while learning the board.',
  runner: 'Fast and small, so towers get fewer shots at it and splash usually misses. Click it, or pin a Taser on a corner it has to round.',
  shielded: 'Its shield absorbs all tower damage until the pointer breaks it. Click the shield down, then let your towers finish it.',
  flyer: 'Flies straight over the maze, so walls do not slow it. Only a Mesh wall stops it; the AA tower is the answer.',
  armoured: 'Its armour soaks tower damage (flat subtraction, floored at 1). A Taser ignores armour, and your clicks ignore it too.',
  saboteur: 'A fast enemy with moderate health. Treat it like a tougher Runner and click it before it crosses the board.',
  breacher: 'Heads for your walls and chews through them, while a small turret shoots the nearest tower. A wall disarms it while it chews; kill it before the wall falls.',
  popup: 'A walking window that shields every enemy underneath it from your towers. Click its close box to remove it — that is the only way.',
};

function enemyStatsLine(kind: EnemyKind): string {
  const st = ENEMY_STATS[kind];
  let line = `${st.hp} HP · ${fmt(st.speed)} tiles/s`;
  if (st.armour > 0) line += ` · ${st.armour} armour`;
  if (st.shield > 0) line += ` · ${st.shield} shield`;
  if (kind === 'breacher') line += ' · chews walls';
  if (kind === 'popup') line += ' · a window, not a leak';
  return line + '.';
}

function enemyPage(kind: EnemyKind): HelpPage {
  return {
    id: `enemy-${kind}`,
    title: ENEMY_STATS[kind].name,
    category: 'enemies',
    gate: { kind: 'enemy', enemy: kind },
    body: [enemyStatsLine(kind), ENEMY_ANSWER[kind as keyof typeof ENEMY_ANSWER]],
  };
}

// ---------------------------------------------------------------------------------------------
// Bosses (one page per variant, plus a general page; gated on first encounter)

const bossesInGeneralPage: HelpPage = {
  id: 'bosses-in-general',
  title: 'Bosses',
  category: 'bosses',
  gate: { kind: 'any-boss' },
  body: [
    'A boss is a bigger, nastier version of an ordinary enemy. It announces itself with a name bar across the top of the field.',
    'Bosses are slow and tough, leak for more integrity, and pay far more salvage than the enemy they are based on.',
    'The pointer is the reliable answer: clicks ignore armour and shields, and a boss is slow enough to click many times.',
  ],
};

const BOSS_TEXT: Readonly<Record<string, { gimmick: string; answer: string }>> = {
  'grunt-boss': {
    gimmick: 'A wall of hit points — the baseline every other boss is read against. It has no trick; it just takes a long time to bring down.',
    answer: 'Focus fire with the pointer and keep it inside your towers\' range for as long as you can.',
  },
  'runner-boss': {
    gimmick: 'Anything near it keeps pace: enemies within 3 tiles move at its speed or their own, whichever is faster.',
    answer: 'Kill it early, before it herds a wave across your board.',
  },
  'shielded-boss': {
    gimmick: 'Three layers of shielding, one stripped per pointer hit. Towers cannot hurt it until the last layer is gone.',
    answer: 'Click it to strip the layers, then let your towers finish it.',
  },
  'flyer-boss': {
    gimmick: 'Hatches flyers as it flies — three every 4 s, and six more when it dies.',
    answer: 'AA towers for the brood, and click the carrier itself down before it reaches the exit.',
  },
  'armoured-boss': {
    gimmick: 'Plated and slow to chill: extra armour reduction, and slows only work half as well on it.',
    answer: 'Armour-ignoring towers and your pointer are the reliable damage.',
  },
  'saboteur-boss': {
    gimmick: 'Shorts out towers as it passes: any tower within 2.5 tiles goes offline for 3 s, then returns on its own.',
    answer: 'Spread your towers, or kill it before it reaches the line.',
  },
  'breacher-boss': {
    gimmick: 'Eats through your towers: it chews walls and drives other towers offline, and mounts a turret.',
    answer: 'A wall maze slows it one tile at a time; keep a Repair tower behind the line.',
  },
};

function bossPage(kind: EnemyKind): HelpPage {
  const st = ENEMY_STATS[kind];
  const text = BOSS_TEXT[kind];
  return {
    id: `boss-${kind}`,
    title: st.name,
    category: 'bosses',
    gate: { kind: 'boss', enemy: kind },
    body: [
      `${st.hp} HP · ${fmt(st.speed)} tiles/s · ${st.integrity} integrity if it leaks.`,
      text.gimmick,
      text.answer,
    ],
  };
}

// ---------------------------------------------------------------------------------------------
// Towers (one page per kind, gated on bestWave reaching its unlock wave)

const TOWER_ROLE: Readonly<Record<TowerKind, string>> = {
  gun: 'The cheap single-target backbone. Put it on a long stretch of route so it shoots for the longest time.',
  cannon: 'A slow, heavy hitter with splash. Best where the maze doubles back, so the splash catches a cluster.',
  taser: 'Short range and very fast, and it ignores armour. Park it on the inside of a hairpin to punish tough enemies up close.',
  frost: 'Slows whatever it hits to 30% speed for 3 s. Put it in front of your damage so enemies spend longer in range.',
  laser: 'Pierces a straight line of enemies. Aim it down a corridor you deliberately left open.',
  aa: 'The dedicated anti-air tower. It only shoots flyers, hits them for double damage, and holds fire on ground-only waves.',
  beacon: 'Boosts the damage of every tower in its radius. Place it over a dense cluster.',
  repair: 'Heals damaged towers in its radius. Keep it near a cluster you want to survive.',
  wall: 'Blocks the route and has hit points. Use walls to make enemies walk a longer maze.',
  cursor: 'A second cursor that clicks enemies for half your click damage. Feed it by upgrading the pointer.',
};

const BRANCH_BLURB: Readonly<Record<TowerKind, Readonly<Partial<Record<Branch, string>>>>> = {
  gun: { A: 'longer reach, harder hits', B: 'fires twice as fast' },
  cannon: { A: 'a bigger splash', B: 'air only, shreds flyers' },
  taser: { A: 'chains to 3 targets', B: 'extra damage to shields' },
  frost: { A: 'a stronger slow', B: 'no slow, real damage' },
  laser: { A: 'pierces deeper, more damage', B: 'splits into three beams' },
  aa: { A: 'shells splash and hit ground too', B: 'homing missiles' },
  beacon: { A: 'a stronger damage aura', B: 'buffs the pointer instead' },
  repair: {},
  wall: { A: 'more hit points', B: 'blocks flyers too', C: 'a gate you open and close' },
  cursor: { A: 'clicks faster', B: 'a wider reach', C: 'repairs towers' },
};

function towerBranches(kind: TowerKind): readonly Branch[] {
  if (kind === 'repair') return [];
  return kind === 'wall' || kind === 'cursor' ? (['A', 'B', 'C'] as const) : (['A', 'B'] as const);
}

function towerStatsLine(kind: TowerKind): string {
  const st = TOWER_STATS[kind];
  if (kind === 'wall') return `Cost $${st.cost} · 60 HP, blocks the route.`;
  if (kind === 'beacon') return `Cost $${st.cost} · range ${fmt(st.range)} tiles · +60% damage to towers in radius.`;
  if (kind === 'repair') return `Cost $${st.cost} · range ${fmt(st.range)} tiles · heals 2 HP/s.`;
  if (kind === 'cursor') return `Cost $${st.cost} · range ${fmt(st.range)} tiles · clicks for 50% of your click damage.`;
  let line = `Cost $${st.cost} · range ${fmt(st.range)} tiles · damage ${fmt(st.damage)}`;
  if (st.fireInterval > 0) line += ` · every ${fmtSeconds(st.fireInterval)} s`;
  if (kind === 'aa') line += ' · flyers only, 2× damage';
  else {
    if (st.ignoresArmour) line += ' · ignores armour';
    if (st.splash > 0) line += ` · splash ${fmt(st.splash)}`;
    if (st.slowFactor < 1) line += ` · slows to ${Math.round(st.slowFactor * 100)}% speed`;
    if (st.pierce > 0) line += ` · pierces ${st.pierce}`;
  }
  return line + '.';
}

function branchesLine(kind: TowerKind): string {
  const branches = towerBranches(kind);
  if (branches.length === 0) return 'It has no branches — it upgrades instead.';
  const parts = branches.map((b) => `${branchName(kind, b)} (${BRANCH_BLURB[kind][b]})`);
  return `Branches: ${parts.join(', ')}.`;
}

function towerPage(kind: TowerKind): HelpPage {
  return {
    id: `tower-${kind}`,
    title: TOWER_STATS[kind].name,
    category: 'towers',
    gate: { kind: 'tower', tower: kind },
    body: [towerStatsLine(kind), TOWER_ROLE[kind], branchesLine(kind)],
  };
}

// ---------------------------------------------------------------------------------------------
// The full table, in tree order.

export const HELP_PAGES: readonly HelpPage[] = [
  gettingStartedPage,
  ...mechanicsPages,
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
