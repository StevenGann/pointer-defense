import { secondsToTicks, TICK_HZ } from './time.ts';

export type TowerKind = 'gun' | 'cannon' | 'taser' | 'frost' | 'laser' | 'beacon' | 'repair' | 'wall' | 'cursor';

export type Branch = 'A' | 'B' | 'C';

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
  /** Fixed targeting priority this kind is locked to, overriding the player's choice (null = player's). */
  readonly targetLock: TargetMode | null;
}

export const TOWER_KINDS: readonly TowerKind[] = ['gun', 'cannon', 'taser', 'frost', 'laser', 'beacon', 'repair', 'wall', 'cursor'];

/**
 * The run wave at which each tower kind becomes available. Gun and Wall are the starting pair,
 * available from the initial build phase (wave 0); every other kind unlocks at the listed wave and
 * never re-locks for the rest of the run (endless included). See docs/design.md §6.10.
 */
export const TOWER_UNLOCK_WAVE: Readonly<Record<TowerKind, number>> = {
  gun: 0,
  cannon: 4,
  taser: 14,
  frost: 6,
  laser: 11,
  beacon: 8,
  repair: 18,
  wall: 0,
  cursor: 24,
};

/** The wave a tower kind unlocks at (0 for the starting pair). */
export function towerUnlockWave(kind: TowerKind): number {
  return TOWER_UNLOCK_WAVE[kind];
}

/** True when a tower kind is unlocked at the given run wave. Unlocks are permanent: wave only grows. */
export function isTowerUnlocked(kind: TowerKind, wave: number): boolean {
  return wave >= TOWER_UNLOCK_WAVE[kind];
}

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
    targetLock: null,
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
    targetLock: 'strong',
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
    targetLock: 'close',
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
    targetLock: 'close',
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
    targetLock: 'first',
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
    targetLock: null,
  },
  repair: {
    name: 'Repair',
    blurb: 'Heals damaged towers in radius',
    cost: 220,
    range: 4.5,
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
    targetLock: null,
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
    targetLock: null,
  },
  cursor: {
    name: 'Cursor',
    blurb: 'Clicks enemies for a share of your click damage',
    cost: 200,
    range: 3.0,
    damage: 0,
    fireInterval: secondsToTicks(1.5),
    turnRate: 0,
    splash: 0,
    ignoresArmour: true,
    slowFactor: 1,
    slowTicks: 0,
    pierce: 0,
    auraDamage: 0,
    auraRange: 0,
    targetLock: null,
  },
};

// ---------------------------------------------------------------------------------------------
// Cursor tower: the one tower whose damage is derived from the pointer ladder. It never fires
// through the normal damage path — the sim moves a flying cursor and applies pointer-sourced click
// damage itself (state.ts). These accessors give the view and tooltips the same numbers the sim
// uses, so a displayed number always matches what happens on the board.

/** Fraction of the player's current click damage a cursor click deals (before its branch). */
export const CURSOR_CLICK_DAMAGE_FACTOR = 0.5;
/** Cursor flight speed toward a target, in tiles per second. */
export const CURSOR_TRAVEL_SPEED = 6;
/** Idle wander speed, in tiles per second. */
export const CURSOR_WANDER_SPEED = 2;
/** Distance in tiles at which the cursor is close enough to click its target. */
export const CURSOR_CLICK_RANGE = 0.6;
/** A Maintenance cursor only repairs towers below this fraction of their maximum hit points. */
export const CURSOR_REPAIR_THRESHOLD = 0.8;

/** Radius (tiles) at each tier, before the Wide Search branch multiplier. */
const CURSOR_RADIUS_BY_TIER: Readonly<Record<Tier, number>> = { 1: 3.0, 2: 4.0, 3: 4.75, 4: 4.75, 5: 4.75 };
/** Clicks per second at each tier, before any branch multiplier. */
const CURSOR_RATE_BY_TIER: Readonly<Record<Tier, number>> = { 1: 1.5, 2: 2.0, 3: 2.75, 4: 2.75, 5: 2.75 };

/** Branch depth: tiers 4 and 5 re-apply the branch multipliers at 1.5x and 2x strength. */
function cursorBranchStrength(tier: Tier): number {
  return 1 + 0.5 * (tier - 3);
}

/** The cursor's operational radius in tiles, including the Wide Search branch. */
export function cursorRadius(t: Tower): number {
  const base = CURSOR_RADIUS_BY_TIER[t.tier];
  if (t.tier < 3 || t.branch !== 'B') return base;
  return base * scaledMultiplier(1.35, cursorBranchStrength(t.tier));
}

/** Clicks per second, including the Overclock (faster) and Wide Search (slower) branches. */
export function cursorClickRate(t: Tower): number {
  const base = CURSOR_RATE_BY_TIER[t.tier];
  if (t.tier < 3) return base;
  if (t.branch === 'A') return base * scaledMultiplier(1.8, cursorBranchStrength(t.tier));
  if (t.branch === 'B') return base * scaledMultiplier(0.7, cursorBranchStrength(t.tier));
  return base;
}

/** Fixed ticks between cursor clicks (the clock gate). */
export function cursorClickIntervalTicks(t: Tower): number {
  return Math.max(1, Math.round(TICK_HZ / cursorClickRate(t)));
}

/** Multiplier on a cursor click's damage from the Overclock branch (1 = no branch). */
export function cursorClickDamageFactor(t: Tower): number {
  if (t.tier < 3 || t.branch !== 'A') return 1;
  return scaledMultiplier(0.6, cursorBranchStrength(t.tier));
}

/**
 * A cursor click's damage: half the player's current click damage, scaled by the spec multiplier
 * and any Overclock branch. The player's click damage and GPU spec multiplier are passed in so this
 * stays pure and free of pointer/state imports.
 */
export function cursorClickDamage(t: Tower, playerClickDamage: number, specMult: number): number {
  return CURSOR_CLICK_DAMAGE_FACTOR * playerClickDamage * specMult * cursorClickDamageFactor(t);
}

/** A wall's hit points at each tier, before the tier-3 branch doubling. */
const WALL_HP_BY_TIER: Readonly<Record<Tier, number>> = { 1: 60, 2: 180, 3: 540, 4: 540, 5: 540 };

/** The wall's hit points at its current tier and branch (Bulwark and Mesh double the tier-3 total). */
export function wallMaxHp(tier: Tier, branch: Branch | null): number {
  const base = WALL_HP_BY_TIER[tier];
  return tier >= 3 && branch !== null && branch !== 'C' ? base * 2 : base;
}

/** True when the tower is a wall. */
export function isWall(tower: Tower): boolean {
  return tower.kind === 'wall';
}

/**
 * True when a non-wall tower's hit points have run out: it is offline, not gone. It stays on the
 * board and can still be repaired, but it no longer fires, projects auras or accepts upgrades.
 * Walls are the exception — a wall at 0 HP is destroyed outright, so it is never "offline".
 */
export function isOffline(tower: Tower): boolean {
  return !isWall(tower) && tower.maxHp > 0 && tower.hp <= 0;
}

/**
 * The hit-point pool of every non-wall tower. Walls use `wallMaxHp` (tier and branch dependent);
 * every other kind keeps this fixed pool for its whole life, so an upgrade never changes its
 * ceiling — it only has to not reset current HP.
 */
const TOWER_HP: Readonly<Record<TowerKind, number>> = {
  gun: 100,
  cannon: 140,
  taser: 120,
  laser: 120,
  frost: 90,
  beacon: 80,
  repair: 90,
  wall: 0, // walls resolve through wallMaxHp
  cursor: 80,
};

/** The hit-point ceiling for a kind at a given tier and branch. */
export function towerMaxHp(kind: TowerKind, tier: Tier, branch: Branch | null): number {
  return kind === 'wall' ? wallMaxHp(tier, branch) : TOWER_HP[kind];
}

/**
 * A repair tower's heal rate (HP/s) and radius (tiles) at each tier. It is a three-tier tower that
 * stops at tier 3, so tiers 4 and 5 mirror tier 3 rather than being reachable.
 */
const REPAIR_HEAL_BY_TIER: Readonly<Record<Tier, number>> = { 1: 2, 2: 2, 3: 3, 4: 3, 5: 3 };
const REPAIR_RADIUS_BY_TIER: Readonly<Record<Tier, number>> = { 1: 4.5, 2: 5.0, 3: 5.0, 4: 5.0, 5: 5.0 };

/** The repair tower's live heal rate in HP per second. */
export function repairHealRate(t: Tower): number {
  return REPAIR_HEAL_BY_TIER[t.tier];
}

/** The repair tower's live radius in tiles. */
export function repairRadius(t: Tower): number {
  return REPAIR_RADIUS_BY_TIER[t.tier];
}

/**
 * The damaged towers a repair tower is healing right now: any tower inside its radius that is
 * missing hit points, except the healer itself and any tower mid-repair (which is off the field).
 * A tower at zero HP is already destroyed and never counted.
 */
export function repairHealTargets(towers: readonly Tower[], healer: Tower, clock: number): Tower[] {
  if (healer.kind !== 'repair') return [];
  if (isOffline(healer)) return []; // an offline repair tower projects no aura
  if (isRepairing(healer, clock)) return []; // a repair tower mid-repair is off the field too
  const r = repairRadius(healer);
  const r2 = r * r;
  const out: Tower[] = [];
  for (const t of towers) {
    if (t.id === healer.id) continue;
    if (t.maxHp <= 0 || t.hp >= t.maxHp) continue; // an offline tower (hp 0) is healed, not skipped
    if (isRepairing(t, clock)) continue;
    const dx = t.col + 0.5 - (healer.col + 0.5);
    const dy = t.row + 0.5 - (healer.row + 0.5);
    if (dx * dx + dy * dy <= r2) out.push(t);
  }
  return out;
}

/** How many damaged towers the repair tower is healing (0 when none or at full health). */
export function repairHealingCount(towers: readonly Tower[], healer: Tower, clock: number): number {
  return repairHealTargets(towers, healer, clock).length;
}

/** True for kinds that offer a branch choice at tier 3 (the repair tower currently does not). */
export function hasBranches(kind: TowerKind): boolean {
  return kind !== 'repair';
}

/** True when this wall blocks flyers (the Mesh branch at tier 3). */
export function wallBlocksFlyers(tower: Tower): boolean {
  return tower.kind === 'wall' && tower.tier >= 3 && tower.branch === 'B';
}

/** True when this tower is a Toggle-branch wall — the tier-3 branch that flips open and closed. */
export function isToggleGate(tower: Tower): boolean {
  return tower.kind === 'wall' && tower.branch === 'C';
}

/** True when this Toggle gate is currently open (walkable, cannot be attacked). */
export function isGateOpen(tower: Tower): boolean {
  return isToggleGate(tower) && tower.open;
}

/** A successful gate flip locks that gate for three seconds (180 fixed ticks). */
export const TOGGLE_LOCK_TICKS = secondsToTicks(3);

/** A full repair (0 HP to max) takes this many seconds; duration scales with the damage restored. */
export const REPAIR_SECONDS = 5;

/** True while this Toggle gate's flip cooldown has not elapsed at the given simulation clock. */
export function isGateLocked(tower: Tower, clock: number): boolean {
  return isToggleGate(tower) && clock < tower.toggleReadyAt;
}

/** Ticks left on a Toggle gate's lock at the given simulation clock (0 when it can flip). */
export function gateLockRemainingTicks(tower: Tower, clock: number): number {
  if (!isToggleGate(tower)) return 0;
  return Math.max(0, tower.toggleReadyAt - clock);
}

/** Seconds left on a Toggle gate's lock, for the status bar and tooltip. */
export function gateLockRemainingSeconds(tower: Tower, clock: number): number {
  return gateLockRemainingTicks(tower, clock) / TICK_HZ;
}

/** Hit points missing from the tower's current total (0 at full health). */
export function repairHpToRestore(tower: Tower): number {
  if (tower.maxHp <= 0) return 0;
  return Math.max(0, tower.maxHp - tower.hp);
}

/**
 * The cost to fully repair the tower's current damage: half its spent value, pro rata for the
 * fraction of hit points missing, rounded up. Restoring a damaged tower is always cheaper than
 * rebuilding it, and much cheaper the earlier the repair is started.
 */
export function repairCost(tower: Tower): number {
  if (tower.maxHp <= 0) return 0;
  const missing = repairHpToRestore(tower);
  if (missing <= 0) return 0;
  return Math.ceil(0.5 * tower.spent * (missing / tower.maxHp));
}

/** How many fixed ticks a full repair of the current damage takes (scales with damage restored). */
export function repairDurationTicks(tower: Tower): number {
  if (tower.maxHp <= 0) return 0;
  const fraction = Math.max(0, Math.min(1, repairHpToRestore(tower) / tower.maxHp));
  return secondsToTicks(REPAIR_SECONDS * fraction);
}

/** True while this tower's repair job is still running at the given simulation clock. */
export function isRepairing(tower: Tower, clock: number): boolean {
  return tower.repairReadyAt !== 0 && clock < tower.repairReadyAt;
}

/** Ticks left on a running repair at the given clock (0 when idle or just finished). */
export function repairRemainingTicks(tower: Tower, clock: number): number {
  if (!isRepairing(tower, clock)) return 0;
  return tower.repairReadyAt - clock;
}

/** Seconds left on a running repair, for the button and tooltip. */
export function repairRemainingSeconds(tower: Tower, clock: number): number {
  return repairRemainingTicks(tower, clock) / TICK_HZ;
}

/** Repair progress 0..1 at the given clock (0 when idle), for the progress bar. */
export function repairProgress(tower: Tower, clock: number): number {
  if (!isRepairing(tower, clock) || tower.repairDurationTicks <= 0) return 0;
  const remaining = tower.repairReadyAt - clock;
  return Math.max(0, Math.min(1, (tower.repairDurationTicks - remaining) / tower.repairDurationTicks));
}

/**
 * Re-derive a tower's hit-point total after a tier or branch change. The HP fraction is preserved,
 * so an upgrade raises the ceiling without healing the tower: a tower at half health stays at half
 * of the new maximum.
 */
export function refreshTowerHp(tower: Tower): void {
  const next = towerMaxHp(tower.kind, tower.tier, tower.branch);
  const fraction = tower.maxHp > 0 ? tower.hp / tower.maxHp : 1;
  tower.maxHp = next;
  tower.hp = Math.min(next, next * fraction);
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
  /** Current hit points; every tower has a pool now, though nothing damages them yet. */
  hp: number;
  /** Hit points at full health (the kind's fixed pool, or a wall's tier/branch total). */
  maxHp: number;
  /** Toggle gates only: true while the gate is open (walkable, cannot be attacked). */
  open: boolean;
  /** Toggle gates only: simulation tick before which another flip is refused. */
  toggleReadyAt: number;
  /** Repair: 0 when idle, otherwise the clock tick the repair completes. */
  repairReadyAt: number;
  /** Hit points at the moment the current repair started (drives the constant restore rate). */
  repairStartHp: number;
  /** Hit points missing when the current repair started (maxHp - startHp). */
  repairMissing: number;
  /** Length of the current repair in fixed ticks. */
  repairDurationTicks: number;
  /** Cursor only: the flying cursor's position in world units (tiles). */
  cursorX: number;
  cursorY: number;
  /** Cursor only: the enemy id the cursor is flying toward and clicking, or null while wandering. */
  cursorTargetId: number | null;
  /** Cursor only: the tower id a Maintenance cursor is flying toward to repair, or null. */
  cursorRepairTowerId: number | null;
  /** Cursor only: ticks until the cursor may click again (the clock gate). */
  cursorCooldown: number;
  /** Cursor only: PRNG state for the deterministic wander path. */
  cursorWanderSeed: number;
  /** Cursor only: current wander heading in radians. */
  cursorWanderAngle: number;
  /** Cursor only: ticks remaining on the click-ring effect (8 on a click, 0 idle). */
  cursorClickFx: number;
  /** Cursor only: the world point the last click landed on, for the ring effect. */
  cursorClickX: number;
  cursorClickY: number;
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
    hp: towerMaxHp(kind, 1, null),
    maxHp: towerMaxHp(kind, 1, null),
    open: false,
    toggleReadyAt: 0,
    repairReadyAt: 0,
    repairStartHp: 0,
    repairMissing: 0,
    repairDurationTicks: 0,
    cursorX: col + 0.5,
    cursorY: row + 0.5,
    cursorTargetId: null,
    cursorRepairTowerId: null,
    cursorCooldown: 0,
    cursorWanderSeed: 0,
    cursorWanderAngle: 0,
    cursorClickFx: 0,
    cursorClickX: col + 0.5,
    cursorClickY: row + 0.5,
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
  if (tower.kind === 'cursor') {
    // The cursor's tier-2 upgrade and tier-3 branch are priced explicitly; tiers 4 and 5 keep the
    // standard ladder's deepening shape, scaled up from the branch cost.
    if (tower.tier === 1) return 150;
    if (tower.tier === 2) return 260;
    if (tower.tier === 3) return 471;
    if (tower.tier === 4) return 845;
    return null;
  }
  if (tower.kind === 'repair') {
    // The repair tower is a three-tier tower with no branch: tier 2 widens the radius, tier 3
    // deepens the heal, and then it is done.
    if (tower.tier === 1) return 140;
    if (tower.tier === 2) return 260;
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
 * True when the tower has nothing left to buy: a branched tower at its final tier. A standard tower
 * or cursor is finished at tier 5, a wall the moment its tier-3 branch is chosen (walls branch once),
 * and the repair tower at tier 3 (it never branches). A further upgrade that exists but is
 * unaffordable does not count — this is "nothing left to buy", not "you cannot afford the next thing".
 */
export function isFullyUpgraded(tower: Tower): boolean {
  if (tower.kind === 'repair') return tower.tier >= 3;
  return tower.branch !== null && upgradeCost(tower) === null;
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
    if (isOffline(b)) continue; // an offline beacon projects no aura
    const st = effectiveStats(b);
    if (st.auraDamage <= 0 && st.auraRange <= 0) continue;
    const r = st.range;
    for (const t of towers) {
      if (t.id === b.id) continue;
      if (t.kind === 'cursor') continue; // pointer-derived damage; tower auras never reach it
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

const BRANCH_EFFECTS: Readonly<Record<TowerKind, Readonly<Partial<Record<Branch, BranchEffect>>>>> = {
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
  // The repair tower has no branch yet, so its entry is empty; it must exist so effectiveStats can
  // look up a repair tower at tier 3+.
  repair: {
    A: {},
    B: {},
  },
  // Walls carry their branch in hit points (Mesh's flyer block, Toggle's open/closed gate), not in
  // combat stats, so the branch effect table is empty. It must exist so effectiveStats can look up
  // a branched wall.
  wall: {
    A: {},
    B: {},
    C: {},
  },
  // The cursor's branches (Overclock / Wide Search) are applied by the cursorRadius / cursorClickRate
  // / cursorClickDamageFactor accessors above, not by effectiveStats, so this table stays empty too.
  cursor: {
    A: {},
    B: {},
    C: {},
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
    if (e !== undefined) {
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
