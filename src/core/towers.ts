import { secondsToTicks } from './time.ts';

export type TowerKind = 'gun' | 'cannon' | 'taser' | 'frost' | 'laser' | 'beacon' | 'wall';

export type Branch = 'A' | 'B';

export type Tier = 1 | 2 | 3 | 4 | 5;

export type TargetMode = 'first' | 'strong' | 'close';

export interface TowerStats {
  readonly name: string;
  readonly blurb: string;
  readonly cost: number;
  /** Range in tiles, measured from the tower's centre to the enemy's hitbox edge. */
  readonly range: number;
  readonly damage: number;
  /** Ticks between shots (0 for towers that never fire). */
  readonly fireInterval: number;
  /** Degrees per second the barrel can traverse toward a target; 0 = instant (no turning time). */
  readonly turnRate: number;
  /** Splash radius in tiles around the primary target (0 = single target). */
  readonly splash: number;
  /** If true, enemy armour is not subtracted from this tower's hits. */
  readonly ignoresArmour: boolean;
  /** Movement multiplier applied to a hit enemy while slowed (1 = no slow). */
  readonly slowFactor: number;
  /** How long a hit slows, in ticks (0 = no slow). */
  readonly slowTicks: number;
  /** Enemies a single beam pierces (0 = single target, no piercing). */
  readonly pierce: number;
  /** Aura: multiplicative damage bonus granted to towers in range (0 = none). */
  readonly auraDamage: number;
  /** Aura: additive range bonus (tiles) granted to towers in range. */
  readonly auraRange: number;
}

export const TOWER_KINDS: readonly TowerKind[] = ['gun', 'cannon', 'taser', 'frost', 'laser', 'beacon', 'wall'];

/** Data, not code: balance lives here. */
export const TOWER_STATS: Readonly<Record<TowerKind, TowerStats>> = {
  gun: {
    name: 'Gun',
    blurb: 'Cheap, single target',
    cost: 25,
    range: 2.6,
    damage: 3,
    fireInterval: secondsToTicks(0.5),
    turnRate: 720,
    splash: 0,
    ignoresArmour: false,
    slowFactor: 1,
    slowTicks: 0,
    pierce: 0,
    auraDamage: 0,
    auraRange: 0,
  },
  cannon: {
    name: 'Cannon',
    blurb: 'Slow, splash',
    cost: 90,
    range: 3.0,
    damage: 5,
    fireInterval: secondsToTicks(1.6),
    turnRate: 90,
    splash: 1.0,
    ignoresArmour: false,
    slowFactor: 1,
    slowTicks: 0,
    pierce: 0,
    auraDamage: 0,
    auraRange: 0,
  },
  taser: {
    name: 'Taser',
    blurb: 'Short range, fast, ignores armour',
    cost: 80,
    range: 1.6,
    damage: 1,
    fireInterval: secondsToTicks(0.12),
    turnRate: 0,
    splash: 0,
    ignoresArmour: true,
    slowFactor: 1,
    slowTicks: 0,
    pierce: 0,
    auraDamage: 0,
    auraRange: 0,
  },
  frost: {
    name: 'Frost',
    blurb: 'Slows enemies',
    cost: 70,
    range: 2.2,
    damage: 1,
    fireInterval: secondsToTicks(0.6),
    turnRate: 0,
    splash: 0,
    ignoresArmour: false,
    slowFactor: 0.3,
    slowTicks: secondsToTicks(3.0),
    pierce: 0,
    auraDamage: 0,
    auraRange: 0,
  },
  laser: {
    name: 'Laser',
    blurb: 'Pierces a straight line',
    cost: 70,
    range: 3.4,
    damage: 11,
    fireInterval: secondsToTicks(0.8),
    turnRate: 150,
    splash: 0,
    ignoresArmour: false,
    slowFactor: 1,
    slowTicks: 0,
    pierce: 8,
    auraDamage: 0,
    auraRange: 0,
  },
  beacon: {
    name: 'Beacon',
    blurb: 'Aura: +damage to towers in radius',
    cost: 90,
    range: 3.5,
    damage: 0,
    fireInterval: 0,
    turnRate: 0,
    splash: 0,
    ignoresArmour: false,
    slowFactor: 1,
    slowTicks: 0,
    pierce: 0,
    auraDamage: 0.6,
    auraRange: 0,
  },
  wall: {
    name: 'Wall',
    blurb: 'Blocks the route, has hit points',
    cost: 8,
    range: 0,
    damage: 0,
    fireInterval: 0,
    turnRate: 0,
    splash: 0,
    ignoresArmour: false,
    slowFactor: 1,
    slowTicks: 0,
    pierce: 0,
    auraDamage: 0,
    auraRange: 0,
  },
};

/** A wall's hit points at each tier, before the tier-3 branch doubling. */
const WALL_HP_BY_TIER: Readonly<Record<Tier, number>> = { 1: 60, 2: 180, 3: 540, 4: 540, 5: 540 };

/** The wall's hit points at its current tier and branch (both tier-3 branches double it). */
export function wallMaxHp(tier: Tier, branch: Branch | null): number {
  const base = WALL_HP_BY_TIER[tier];
  return tier >= 3 && branch !== null ? base * 2 : base;
}

/** True when the tower is a wall — the only tower kind with hit points. */
export function isWall(tower: Tower): boolean {
  return tower.kind === 'wall';
}

/** True when this wall blocks flyers (the Mesh branch at tier 3). */
export function wallBlocksFlyers(tower: Tower): boolean {
  return tower.kind === 'wall' && tower.tier >= 3 && tower.branch === 'B';
}

/**
 * Re-derive a wall's hit-point total after a tier or branch change, preserving the damage it has
 * already taken (lost hit points carry across the upgrade rather than being healed away).
 */
export function refreshWallHp(tower: Tower): void {
  if (tower.kind !== 'wall') return;
  const lost = tower.maxHp - tower.hp;
  const next = wallMaxHp(tower.tier, tower.branch);
  tower.maxHp = next;
  tower.hp = Math.max(1, next - lost);
}

export interface Tower {
  readonly id: number;
  readonly kind: TowerKind;
  readonly col: number;
  readonly row: number;
  tier: Tier;
  branch: Branch | null;
  /** Total salvage spent on this tower, including the purchase price. */
  spent: number;
  /** Multiplicative damage bonus from beacon auras (1 = none). */
  auraDamage: number;
  /** Additive range bonus (tiles) from beacon auras. */
  auraRange: number;
  /** Current barrel facing in radians; 0 = north, increasing clockwise. */
  angle: number;
  /** Ticks until the tower may fire again. */
  cooldown: number;
  /** Enemies this tower landed the killing blow on. */
  kills: number;
  /** Salvage this tower earned from those kills. */
  earned: number;
  /** HP damage this tower has actually dealt, for the balance harness's damage share. */
  damageDealt: number;
  /** Which enemy in range this tower prefers. */
  targetMode: TargetMode;
  /** Current hit points (walls only; every other tower is invulnerable and unused). */
  hp: number;
  /** Hit points at full health (walls only; 0 for every other tower). */
  maxHp: number;
}

export function createTower(id: number, kind: TowerKind, col: number, row: number): Tower {
  return {
    id,
    kind,
    col,
    row,
    tier: 1,
    branch: null,
    spent: TOWER_STATS[kind].cost,
    auraDamage: 1,
    auraRange: 0,
    angle: 0,
    cooldown: 0,
    kills: 0,
    earned: 0,
    damageDealt: 0,
    targetMode: 'first',
    hp: kind === 'wall' ? wallMaxHp(1, null) : 0,
    maxHp: kind === 'wall' ? wallMaxHp(1, null) : 0,
  };
}

/** Cost of the next upgrade step (base x factor), or null at tier 5. */
const UPGRADE_COST_FACTOR: Readonly<Record<Tier, number | null>> = {
  1: 0.9,
  2: 1.6,
  3: 2.9,
  4: 5.2,
  5: null,
};

export function upgradeCost(tower: Tower): number | null {
  if (tower.kind === 'wall') {
    // Walls are a three-tier tower: tier 2 costs 12, the tier-3 branch costs 20, then it is done.
    if (tower.tier === 1) return 12;
    if (tower.tier === 2) return 20;
    return null;
  }
  const factor = UPGRADE_COST_FACTOR[tower.tier];
  return factor === null ? null : Math.round(TOWER_STATS[tower.kind].cost * factor);
}

/** Salvage returned when a tower is sold: 70% of everything spent, rounded down. Walls pay nothing. */
export function sellValue(tower: Tower): number {
  if (tower.kind === 'wall') return 0;
  return Math.floor(tower.spent * 0.7);
}

/**
 * Recompute every tower's beacon aura bonuses. Idempotent; called whenever the set of towers
 * changes. Each tower starts at 1x damage / +0 range, then beacons in range multiply/add.
 */
export function recomputeAuras(towers: Tower[]): void {
  for (const t of towers) {
    t.auraDamage = 1;
    t.auraRange = 0;
  }
  for (const b of towers) {
    const st = effectiveStats(b);
    if (st.auraDamage <= 0 && st.auraRange <= 0) continue;
    const r = st.range;
    for (const t of towers) {
      if (t.id === b.id) continue;
      const d2 = (t.col + 0.5 - (b.col + 0.5)) ** 2 + (t.row + 0.5 - (b.row + 0.5)) ** 2;
      if (d2 <= r * r) {
        t.auraDamage *= 1 + st.auraDamage;
        t.auraRange += st.auraRange;
      }
    }
  }
}

/**
 * Branch effects, applied on top of the tier-2 buff at tier 3. Tiers 4 and 5 re-apply the numeric
 * multipliers/adders at 50% strength each (strength 1.5 then 2.0); discrete values (pierce, beams,
 * chain counts, aura magnitudes, targeting flags) are fixed for tiers 3-5.
 */
interface BranchEffect {
  readonly damageMul?: number;
  readonly rangeMul?: number;
  readonly intervalMul?: number;
  readonly splashAdd?: number;
  readonly damageAdd?: number;
  readonly flyerDamageMul?: number;
  readonly shieldedDamageMul?: number;
  readonly slowFactor?: number;
  readonly slowTicks?: number;
  readonly pierce?: number;
  readonly beams?: number;
  readonly beamDamage?: number;
  readonly targetsFlyersOnly?: boolean;
  readonly chainCount?: number;
  readonly chainDamage?: number;
  readonly auraDamage?: number;
  readonly auraRange?: number;
  readonly auraPointerDamage?: number;
  readonly auraPointerRange?: number;
}

const BRANCH_EFFECTS: Readonly<Record<TowerKind, Readonly<Record<Branch, BranchEffect>>>> = {
  gun: {
    A: { rangeMul: 1.6, damageMul: 1.8 },
    B: { intervalMul: 0.5, damageAdd: -1 },
  },
  cannon: {
    A: { splashAdd: 1, damageMul: 1.5, intervalMul: 1.33 },
    B: { targetsFlyersOnly: true, intervalMul: 0.33, flyerDamageMul: 2 },
  },
  taser: {
    A: { chainCount: 3, chainDamage: 0.6 },
    B: { shieldedDamageMul: 2.5 },
  },
  frost: {
    A: { slowFactor: 0.4, slowTicks: secondsToTicks(2.5) },
    B: { slowFactor: 1, damageMul: 4, splashAdd: 0.6 },
  },
  laser: {
    A: { pierce: 8, damageMul: 1.5 },
    B: { beams: 3, beamDamage: 0.6 },
  },
  beacon: {
    A: { auraDamage: 0.3, auraRange: 0 },
    B: { auraPointerDamage: 0.5, auraPointerRange: 0.75 },
  },
  // Walls carry their branch in hit points (and Mesh's flyer block), not in combat stats, so the
  // branch effect table is empty. It must exist so effectiveStats can look up a branched wall.
  wall: {
    A: {},
    B: {},
  },
};

export interface EffectiveStats {
  readonly range: number;
  readonly damage: number;
  readonly fireInterval: number;
  readonly turnRate: number;
  readonly splash: number;
  readonly ignoresArmour: boolean;
  readonly slowFactor: number;
  readonly slowTicks: number;
  readonly pierce: number;
  readonly beams: number;
  readonly beamDamage: number;
  readonly targetsFlyersOnly: boolean;
  readonly flyerDamageMult: number;
  readonly shieldedDamageMult: number;
  readonly chainCount: number;
  readonly chainDamage: number;
  readonly auraDamage: number;
  readonly auraRange: number;
  readonly auraPointerDamage: number;
  readonly auraPointerRange: number;
}

/** A multiplier `m` reapplied at `strength` (1 = full branch, 1.5 = +50%, 2 = doubled). */
function scaledMultiplier(multiplier: number, strength: number): number {
  return 1 + (multiplier - 1) * strength;
}

/** The tower's live combat stats, including the tier-2 buff, branch and branch depth. */
export function effectiveStats(tower: Tower): EffectiveStats {
  const base = TOWER_STATS[tower.kind];
  let range = base.range;
  let damage = base.damage;
  let fireInterval = base.fireInterval;
  let splash = base.splash;
  let slowFactor = base.slowFactor;
  let slowTicks = base.slowTicks;
  let pierce = base.pierce;
  let beams = 1;
  let beamDamage = 1;
  let targetsFlyersOnly = false;
  let flyerDamageMult = 1;
  let shieldedDamageMult = 1;
  let chainCount = 0;
  let chainDamage = 0;
  let auraDamage = base.auraDamage;
  let auraRange = base.auraRange;
  let auraPointerDamage = 0;
  let auraPointerRange = 0;

  if (tower.tier >= 2) {
    damage *= 1.25;
    range *= 1.02;
  }

  if (tower.branch !== null && tower.tier >= 3) {
    const strength = 1 + 0.5 * (tower.tier - 3);
    const e = BRANCH_EFFECTS[tower.kind][tower.branch];
    if (e.damageMul !== undefined) damage *= scaledMultiplier(e.damageMul, strength);
    if (e.rangeMul !== undefined) range *= scaledMultiplier(e.rangeMul, strength);
    if (e.intervalMul !== undefined) fireInterval *= scaledMultiplier(e.intervalMul, strength);
    if (e.splashAdd !== undefined) splash += e.splashAdd * strength;
    if (e.damageAdd !== undefined) damage += e.damageAdd * strength;
    if (e.flyerDamageMul !== undefined) flyerDamageMult = scaledMultiplier(e.flyerDamageMul, strength);
    if (e.shieldedDamageMul !== undefined) shieldedDamageMult = scaledMultiplier(e.shieldedDamageMul, strength);
    if (e.slowFactor !== undefined) slowFactor = e.slowFactor;
    if (e.slowTicks !== undefined) slowTicks = e.slowTicks;
    if (e.pierce !== undefined) pierce = e.pierce;
    if (e.beams !== undefined) beams = e.beams;
    if (e.beamDamage !== undefined) beamDamage = e.beamDamage;
    if (e.targetsFlyersOnly !== undefined) targetsFlyersOnly = e.targetsFlyersOnly;
    if (e.chainCount !== undefined) chainCount = e.chainCount;
    if (e.chainDamage !== undefined) chainDamage = e.chainDamage;
    if (e.auraDamage !== undefined) auraDamage = e.auraDamage;
    if (e.auraRange !== undefined) auraRange = e.auraRange;
    if (e.auraPointerDamage !== undefined) auraPointerDamage = e.auraPointerDamage;
    if (e.auraPointerRange !== undefined) auraPointerRange = e.auraPointerRange;
  }

  return {
    range,
    damage,
    fireInterval,
    turnRate: base.turnRate,
    splash,
    ignoresArmour: base.ignoresArmour,
    slowFactor,
    slowTicks,
    pierce,
    beams,
    beamDamage,
    targetsFlyersOnly,
    flyerDamageMult,
    shieldedDamageMult,
    chainCount,
    chainDamage,
    auraDamage,
    auraRange,
    auraPointerDamage,
    auraPointerRange,
  };
}
