import { BOSS_KINDS, ENEMY_KINDS, ENEMY_STATS, type EnemyKind } from '../core/enemies.ts';
import {
  TOWER_KINDS,
  TOWER_STATS,
  towerUnlockWave,
  createTower,
  effectiveStats,
  upgradeCost,
  wallMaxHp,
  repairHealRate,
  repairRadius,
  cursorRadius,
  cursorClickRate,
  cursorClickDamageFactor,
  CURSOR_CLICK_DAMAGE_FACTOR,
  CURSOR_REPAIR_THRESHOLD,
  MINE_INTERVAL_TICKS,
  MINE_ARM_TICKS,
  MINE_EXPIRE_TICKS,
  MINE_LIVE_CAP,
  MINE_DAMAGE,
  MINE_BLAST_RADIUS,
  type Branch,
  type EffectiveStats,
  type Tier,
  type Tower,
  type TowerKind,
} from '../core/towers.ts';
import { TICK_HZ } from '../core/time.ts';
import { AA_SALVO_COUNT } from '../core/projectiles.ts';
import { FLYER_OFF_KIND_DAMAGE, RAM_SALVAGE_PER_POINT } from '../core/state.ts';
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
import { earlyCallBonus } from '../core/waves.ts';
import { branchName } from '../view/tooltipText.ts';

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

/** A value to exactly two decimals (3 -> "3.00", 0.5 -> "0.50") for the stat block. */
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

/** Fire interval and shots-per-second as one phrase, or an em-dash when the tower never fires. */
function fmtFire(fireTicks: number): string {
  return fireTicks <= 0 ? '—' : `${fmt2(fireTicks / TICK_HZ)} s (${fmt2(TICK_HZ / fireTicks)}/s)`;
}

/** Turn rate as whole degrees per second, or "instant" for towers that need no aiming. */
function fmtTurn(turnRate: number): string {
  return turnRate > 0 ? `${turnRate} °/s` : 'instant';
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
      `A bare click deals ${fmt(POINTER_STAGES[1].clickDamage)} damage; the Reticle deals ${fmt(POINTER_STAGES[2].clickDamage)} and holds for ${fmt(POINTER_STAGES[2].holdDps)} damage per second.`,
      `Overclock levels multiply click damage by ${fmt(OVERCLOCK_DAMAGE_GROWTH)} each, ${OVERCLOCK_MILESTONES.map(([level, mult]) => `×${mult} at level ${level}`).join(' and ')}, capped at ${MAX_OVERCLOCK_LEVEL}; one unlocks every ${OVERCLOCK_WAVE_DIVISOR} waves.`,
      `A click crits for ${fmt(CRIT_MULTIPLIER)}× — ${fmtPct(CRIT_BASE_CHANCE)} base, +${fmtPct(CRIT_MARKED_CHANCE)} on a marked enemy, +${fmtPct(CRIT_WEAK_CHANCE)} on the weak point. The mark adds ${fmtPct(MARKED_DAMAGE_MULT - 1)} damage.`,
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
      'Specs are permanent. A reboot banks Restore Points from the run\'s lifetime salvage, and they carry into the next run.',
      `Each spec has an effect: CPU ${specEffectCompactText('cpu', 1)} tower damage, GPU ${specEffectCompactText('gpu', 1)} pointer damage, RAM +${RAM_SALVAGE_PER_POINT} starting salvage, Disk ${specEffectCompactText('disk', 1)} starting integrity (caps ${SPEC_CAPS.cpu}/${SPEC_CAPS.ram}/${SPEC_CAPS.gpu}/${SPEC_CAPS.disk}).`,
      `A spec level costs ${specLevelCost(0)} Restore Points at level 0, ${specLevelCost(1)} at level 1, ${specLevelCost(2)} at level 2, ${specLevelCost(3)} at level 3, and keeps climbing.`,
      `A reboot banks ${rpGain(20000)} Restore Points at 20,000 lifetime salvage and ${rpGain(60000)} at 60,000.`,
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
      `A full-early call pays ${earlyCallBonus(0, 2)} salvage at wave 2, decaying toward a floor of 5 the later you wait.`,
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

/** Special traits shared by the six combat towers, joined with a middle dot (or an em-dash). */
function combatTraits(kind: TowerKind, eff: EffectiveStats): string {
  const parts: string[] = [];
  if (eff.splash > 0) parts.push(`Splash ${fmt2(eff.splash)}`);
  if (eff.pierce > 0) parts.push(`Pierce ${eff.pierce}`);
  if (eff.ignoresArmour) parts.push('Ignores armour');
  if (eff.slowFactor < 1) parts.push(`Slows to ${fmtPct(eff.slowFactor)} for ${fmt2(eff.slowTicks / TICK_HZ)} s`);
  if (eff.targetsFlyersOnly) parts.push('Flyers only');
  if (eff.flyerDamageMult !== 1) parts.push(`${fmtMult(eff.flyerDamageMult)}× vs flyers`);
  if (kind === 'gun') parts.push(`${fmtMult(FLYER_OFF_KIND_DAMAGE)}× vs flyers`);
  if (eff.chainCount > 0) parts.push(`Chains to ${eff.chainCount} at ${fmtPct(eff.chainDamage)}`);
  if (eff.beams > 1) parts.push(`${eff.beams} beams at ${fmtPct(eff.beamDamage)}`);
  if (eff.shieldedDamageMult !== 1) parts.push(`${fmtMult(eff.shieldedDamageMult)}× vs shields`);
  return parts.length > 0 ? parts.join(' · ') : '—';
}

/** The block for the six combat towers: base stats, traits, DPS, tier 2 and both branch ladders. */
function combatStatBlock(kind: TowerKind, lines: string[]): void {
  const base = effectiveStats(synthTower(kind, 1, null));
  lines.push(`Range ${fmt2(base.range)} · Damage ${fmt2(base.damage)} · Fire ${fmtFire(base.fireInterval)} · Turn ${fmtTurn(base.turnRate)}`);
  lines.push(combatTraits(kind, base));
  lines.push(`DPS ${fmtDps(base.damage, base.fireInterval)}`);

  const t2 = effectiveStats(synthTower(kind, 2, null));
  lines.push(`Tier 2 — $${nextUpgradeCost(kind, 1, null)}: range ${fmt2(t2.range)} · damage ${fmt2(t2.damage)} · DPS ${fmtDps(t2.damage, t2.fireInterval)}`);

  const branchCost = nextUpgradeCost(kind, 2, null);
  for (const branch of towerBranches(kind)) {
    lines.push(`${branchName(kind, branch)} — $${branchCost}`);
    if (kind === 'cannon' && branch === 'B') {
      lines.push(`Lays a mine every ${fmt2(MINE_INTERVAL_TICKS / TICK_HZ)} s · arms in ${fmt2(MINE_ARM_TICKS / TICK_HZ)} s · ${MINE_LIVE_CAP} live cap · ${MINE_DAMAGE} damage in a ${fmt2(MINE_BLAST_RADIUS)} blast · expires in ${fmt2(MINE_EXPIRE_TICKS / TICK_HZ)} s`);
      continue;
    }
    if (kind === 'aa' && branch === 'B') {
      lines.push(`${AA_SALVO_COUNT} homing missiles per salvo · each ${fmtPct(1 / AA_SALVO_COUNT)} of a hit`);
    }
    for (const tier of [3, 4, 5] as const) {
      const eff = effectiveStats(synthTower(kind, tier, branch));
      const label = tier === 3 ? 'Tier 3:' : `Tier ${tier} — $${nextUpgradeCost(kind, (tier - 1) as Tier, branch)}:`;
      lines.push(`${label} range ${fmt2(eff.range)} · damage ${fmt2(eff.damage)} · fire ${fmtFire(eff.fireInterval)} · DPS ${fmtDps(eff.damage, eff.fireInterval)}`);
    }
  }
}

function beaconStatBlock(lines: string[]): void {
  const base = effectiveStats(synthTower('beacon', 1, null));
  lines.push(`Range ${fmt2(base.range)} · +${fmtPct(base.auraDamage)} damage to towers in radius`);
  const t2 = effectiveStats(synthTower('beacon', 2, null));
  lines.push(`Tier 2 — $${nextUpgradeCost('beacon', 1, null)}: range ${fmt2(t2.range)}`);
  const branchCost = nextUpgradeCost('beacon', 2, null);
  const command = effectiveStats(synthTower('beacon', 3, 'A'));
  lines.push(`Command — $${branchCost}: +${fmtPct(command.auraDamage)} damage to towers in radius`);
  const relay = effectiveStats(synthTower('beacon', 3, 'B'));
  lines.push(`Relay — $${branchCost}: +${fmtPct(relay.auraDamage)} damage to towers · +${fmtPct(relay.auraPointerDamage)} pointer damage · +${fmtMult(relay.auraPointerRange)} pointer range`);
}

function repairStatBlock(lines: string[]): void {
  const t1 = synthTower('repair', 1, null);
  lines.push(`Heals ${fmt2(repairHealRate(t1))} HP/s · radius ${fmt2(repairRadius(t1))} tiles`);
  const t2 = synthTower('repair', 2, null);
  lines.push(`Tier 2 — $${nextUpgradeCost('repair', 1, null)}: heals ${fmt2(repairHealRate(t2))} HP/s · radius ${fmt2(repairRadius(t2))} tiles`);
  const t3 = synthTower('repair', 3, null);
  lines.push(`Tier 3 — $${nextUpgradeCost('repair', 2, null)}: heals ${fmt2(repairHealRate(t3))} HP/s · radius ${fmt2(repairRadius(t3))} tiles`);
}

function wallStatBlock(lines: string[]): void {
  lines.push(`${wallMaxHp(1, null)} HP · blocks the route`);
  lines.push(`Tier 2 — $${nextUpgradeCost('wall', 1, null)}: ${wallMaxHp(2, null)} HP`);
  const branchCost = nextUpgradeCost('wall', 2, null);
  lines.push(`Bulwark — $${branchCost}: ${wallMaxHp(3, 'A')} HP`);
  lines.push(`Mesh — $${branchCost}: ${wallMaxHp(3, 'B')} HP · blocks flyers`);
  lines.push(`Toggle — $${branchCost}: ${wallMaxHp(3, 'C')} HP · a gate you open and close`);
}

function cursorStatBlock(lines: string[]): void {
  const t1 = synthTower('cursor', 1, null);
  lines.push(`${fmt2(cursorClickRate(t1))} clicks/s · radius ${fmt2(cursorRadius(t1))} tiles · ${fmtPct(CURSOR_CLICK_DAMAGE_FACTOR)} of your click damage`);
  const t2 = synthTower('cursor', 2, null);
  lines.push(`Tier 2 — $${nextUpgradeCost('cursor', 1, null)}: ${fmt2(cursorClickRate(t2))} clicks/s · radius ${fmt2(cursorRadius(t2))} tiles`);
  const branchCost = nextUpgradeCost('cursor', 2, null);
  const overclock = synthTower('cursor', 3, 'A');
  lines.push(`Overclock — $${branchCost}: ${fmt2(cursorClickRate(overclock))} clicks/s · ${fmtPct(CURSOR_CLICK_DAMAGE_FACTOR * cursorClickDamageFactor(overclock))} of your click damage`);
  const wide = synthTower('cursor', 3, 'B');
  lines.push(`Wide Search — $${branchCost}: ${fmt2(cursorClickRate(wide))} clicks/s · radius ${fmt2(cursorRadius(wide))} tiles`);
  const maintenance = synthTower('cursor', 3, 'C');
  lines.push(`Maintenance — $${branchCost}: ${fmt2(cursorClickRate(maintenance))} clicks/s · radius ${fmt2(cursorRadius(maintenance))} tiles · repairs towers below ${fmtPct(CURSOR_REPAIR_THRESHOLD)}`);
}

/** The numeric stat block for a tower kind, built entirely from the sim's functions. */
function towerStatBlock(kind: TowerKind): string[] {
  const st = TOWER_STATS[kind];
  const unlock = Math.max(1, towerUnlockWave(kind));
  const lines: string[] = [`Cost $${st.cost} · unlocks wave ${unlock}`];
  switch (kind) {
    case 'beacon':
      beaconStatBlock(lines);
      break;
    case 'repair':
      repairStatBlock(lines);
      break;
    case 'wall':
      wallStatBlock(lines);
      break;
    case 'cursor':
      cursorStatBlock(lines);
      break;
    default:
      combatStatBlock(kind, lines);
      break;
  }
  return lines;
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
    body: [...towerStatBlock(kind), TOWER_ROLE[kind], branchesLine(kind)],
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
