/**
 * The Restore tree — the permanent prestige upgrades bought with Restore Points (docs/design.md §12).
 *
 * The tree is pure data plus a handful of pure helpers, kept Pixi-free so the smoke harness can
 * assert the tier gates, exclusivity and the merged effect of a profile. A node's effect is a
 * partial `TreeEffects`; `effectsFor` folds every owned node's effect into one value that
 * `createRunState` and `restartWindows` apply.
 */

import type { Profile } from './save.ts';

export type TreeTier = 1 | 2 | 3 | 4 | 5;

/** The prestige level a tier unlocks at (docs/design.md §12.3). */
export const TIER_UNLOCK_LEVEL: Readonly<Record<TreeTier, number>> = {
  1: 0,
  2: 8,
  3: 20,
  4: 40,
  5: 70,
};

/**
 * Everything the tree can change about a run, merged into one value. Numbers are either additive
 * (summed), multiplicative (multiplied), a ceiling (max), or a flag (or-ed); see `effectsFor`.
 */
export interface TreeEffects {
  /** The wave a run begins on (the Fast Boot ladder). */
  startingWave: number;
  /** Fraction of the last run's salvage carried into the next run (Restore Point). */
  startSalvagePct: number;
  /** Flat bonus salvage at run start (Loose Change). */
  startSalvageFlat: number;
  /** Additive tower damage bonus, as a fraction (Warm Cache). */
  towerDamagePct: number;
  /** Additive pointer damage bonus, as a fraction (Steady Hand). */
  pointerDamagePct: number;
  /** Additive starting integrity (Spare Slot, Safe Mode, Blue Screen). */
  integrity: number;
  /** Multiplier on tower build cost (Bulk Discount). */
  costMultiplier: number;
  /** Fraction of a tower's spend refunded on sale (Hot Swap). */
  sellRefund: number;
  /** Multiplier on repair speed (Cooling Loop). */
  repairSpeedMult: number;
  /** Auto-wave on by default (Auto-login). */
  autoWave: boolean;
  /** Free Gun towers placed near the spawn at run start (Preload). */
  preloadGuns: number;
  /** Every tower kind unlocked from the first build phase (Early Access). */
  unlockAllTowers: boolean;
  /** The tier newly placed towers start at (New Game+). */
  startTier: number;
  /** Extra Restore Points each reboot banks (Windows Update). */
  extraSpecsPerReboot: number;
  /** Multiplier on Restore Points earned (Safe Mode, Blue Screen). */
  rpGainMult: number;
}

export type TreeEffect = Partial<TreeEffects>;

export interface TreeNode {
  readonly id: string;
  readonly name: string;
  readonly tier: TreeTier;
  readonly unlockLevel: number;
  readonly cost: number;
  readonly description: string;
  readonly effect: TreeEffect;
}

export const TREE_NODES: readonly TreeNode[] = [
  // Tier 1 — unlock at level 0
  { id: 'loose-change', name: 'Loose Change', tier: 1, unlockLevel: 0, cost: 4, description: '+200 starting salvage', effect: { startSalvageFlat: 200 } },
  { id: 'spare-slot', name: 'Spare Slot', tier: 1, unlockLevel: 0, cost: 5, description: '+2 starting integrity', effect: { integrity: 2 } },
  { id: 'fast-boot-1', name: 'Fast Boot I', tier: 1, unlockLevel: 0, cost: 5, description: 'runs begin at wave 3', effect: { startingWave: 3 } },
  { id: 'warm-cache', name: 'Warm Cache', tier: 1, unlockLevel: 0, cost: 6, description: '+10% tower damage', effect: { towerDamagePct: 0.1 } },
  { id: 'steady-hand', name: 'Steady Hand', tier: 1, unlockLevel: 0, cost: 6, description: '+10% pointer damage', effect: { pointerDamagePct: 0.1 } },

  // Tier 2 — unlock at level 8
  { id: 'auto-login', name: 'Auto-login', tier: 2, unlockLevel: 8, cost: 6, description: 'auto-wave is on by default', effect: { autoWave: true } },
  { id: 'preload', name: 'Preload', tier: 2, unlockLevel: 8, cost: 10, description: 'the run starts with two free Gun towers', effect: { preloadGuns: 2 } },
  { id: 'fast-boot-2', name: 'Fast Boot II', tier: 2, unlockLevel: 8, cost: 12, description: 'runs begin at wave 8', effect: { startingWave: 8 } },
  { id: 'cooling-loop', name: 'Cooling Loop', tier: 2, unlockLevel: 8, cost: 12, description: 'repairs are 25% faster', effect: { repairSpeedMult: 1.25 } },
  { id: 'bulk-discount', name: 'Bulk Discount', tier: 2, unlockLevel: 8, cost: 14, description: 'towers cost 8% less', effect: { costMultiplier: 0.92 } },

  // Tier 3 — unlock at level 20
  { id: 'safe-mode', name: 'Safe Mode', tier: 3, unlockLevel: 20, cost: 18, description: '+5 integrity, but -10% Restore Points earned', effect: { integrity: 5, rpGainMult: 0.9 } },
  { id: 'blue-screen', name: 'Blue Screen', tier: 3, unlockLevel: 20, cost: 18, description: '+25% Restore Points earned, but -5 integrity', effect: { integrity: -5, rpGainMult: 1.25 } },
  { id: 'bulk-discount-2', name: 'Bulk Discount II', tier: 3, unlockLevel: 20, cost: 22, description: 'a further 7% off (15% total)', effect: { costMultiplier: 0.93 } },
  { id: 'fast-boot-3', name: 'Fast Boot III', tier: 3, unlockLevel: 20, cost: 25, description: 'runs begin at wave 15', effect: { startingWave: 15 } },
  { id: 'early-access', name: 'Early Access', tier: 3, unlockLevel: 20, cost: 30, description: 'every tower is unlocked at wave 1', effect: { unlockAllTowers: true } },

  // Tier 4 — unlock at level 40
  { id: 'hot-swap', name: 'Hot Swap', tier: 4, unlockLevel: 40, cost: 30, description: 'selling refunds 90% instead of 70%', effect: { sellRefund: 0.9 } },
  { id: 'windows-update', name: 'Windows Update', tier: 4, unlockLevel: 40, cost: 35, description: 'each reboot banks one extra spec point', effect: { extraSpecsPerReboot: 1 } },
  { id: 'fast-boot-4', name: 'Fast Boot IV', tier: 4, unlockLevel: 40, cost: 45, description: 'runs begin at wave 25', effect: { startingWave: 25 } },

  // Tier 5 — unlock at level 70
  { id: 'restore-point', name: 'Restore Point', tier: 5, unlockLevel: 70, cost: 60, description: 'the run starts with 10% of the last run\'s salvage', effect: { startSalvagePct: 0.1 } },
  { id: 'fast-boot-5', name: 'Fast Boot V', tier: 5, unlockLevel: 70, cost: 80, description: 'runs begin at wave 40', effect: { startingWave: 40 } },
  { id: 'new-game-plus', name: 'New Game+', tier: 5, unlockLevel: 70, cost: 90, description: 'towers are placed at tier 2', effect: { startTier: 2 } },
];

export const TREE_NODE_IDS: readonly string[] = TREE_NODES.map((n) => n.id);

/** True when `id` is one of the authored tree nodes. */
export function isTreeNodeId(id: unknown): id is string {
  return typeof id === 'string' && TREE_NODE_IDS.includes(id);
}

/** The node with the given id, or undefined. */
export function treeNodeById(id: string): TreeNode | undefined {
  return TREE_NODES.find((n) => n.id === id);
}

/** Whether `tier` is unlocked at the given prestige level. */
export function treeTierUnlocked(level: number, tier: TreeTier): boolean {
  return level >= TIER_UNLOCK_LEVEL[tier];
}

/** Whether the profile owns the node. */
export function hasNode(profile: Profile, id: string): boolean {
  return profile.tree.includes(id);
}

/** Nodes to list: Safe Mode and Blue Screen hide the one the player already owns. */
export function visibleNodes(profile: Profile): TreeNode[] {
  return TREE_NODES.filter(
    (n) =>
      !(n.id === 'safe-mode' && hasNode(profile, 'blue-screen')) &&
      !(n.id === 'blue-screen' && hasNode(profile, 'safe-mode')),
  );
}

/**
 * Whether the node may be bought right now: the tier must be unlocked, it must not already be
 * owned, the RP balance must cover it, and Safe Mode / Blue Screen stay mutually exclusive.
 */
export function canBuy(profile: Profile, node: TreeNode): boolean {
  if (hasNode(profile, node.id)) return false;
  if (!treeTierUnlocked(profile.rpEarned, node.tier)) return false;
  if (profile.rp < node.cost) return false;
  if (node.id === 'safe-mode' && hasNode(profile, 'blue-screen')) return false;
  if (node.id === 'blue-screen' && hasNode(profile, 'safe-mode')) return false;
  return true;
}

/** Buy the node, spending the RP and recording the id. Returns whether the purchase happened. */
export function buyNode(profile: Profile, node: TreeNode): boolean {
  if (!canBuy(profile, node)) return false;
  profile.rp -= node.cost;
  profile.tree.push(node.id);
  return true;
}

const IDENTITY_EFFECTS: TreeEffects = {
  startingWave: 0,
  startSalvagePct: 0,
  startSalvageFlat: 0,
  towerDamagePct: 0,
  pointerDamagePct: 0,
  integrity: 0,
  costMultiplier: 1,
  sellRefund: 0.7,
  repairSpeedMult: 1,
  autoWave: false,
  preloadGuns: 0,
  unlockAllTowers: false,
  startTier: 1,
  extraSpecsPerReboot: 0,
  rpGainMult: 1,
};

/** Merge every owned node's effect into one `TreeEffects` value. */
export function effectsFor(profile: Profile): TreeEffects {
  const fx: TreeEffects = { ...IDENTITY_EFFECTS };
  for (const id of profile.tree) {
    const node = treeNodeById(id);
    if (!node) continue;
    const e = node.effect;
    if (e.startingWave !== undefined) fx.startingWave = Math.max(fx.startingWave, e.startingWave);
    if (e.startSalvagePct !== undefined) fx.startSalvagePct += e.startSalvagePct;
    if (e.startSalvageFlat !== undefined) fx.startSalvageFlat += e.startSalvageFlat;
    if (e.towerDamagePct !== undefined) fx.towerDamagePct += e.towerDamagePct;
    if (e.pointerDamagePct !== undefined) fx.pointerDamagePct += e.pointerDamagePct;
    if (e.integrity !== undefined) fx.integrity += e.integrity;
    if (e.costMultiplier !== undefined) fx.costMultiplier *= e.costMultiplier;
    if (e.sellRefund !== undefined) fx.sellRefund = e.sellRefund;
    if (e.repairSpeedMult !== undefined) fx.repairSpeedMult *= e.repairSpeedMult;
    if (e.autoWave !== undefined) fx.autoWave = fx.autoWave || e.autoWave;
    if (e.preloadGuns !== undefined) fx.preloadGuns += e.preloadGuns;
    if (e.unlockAllTowers !== undefined) fx.unlockAllTowers = fx.unlockAllTowers || e.unlockAllTowers;
    if (e.startTier !== undefined) fx.startTier = Math.max(fx.startTier, e.startTier);
    if (e.extraSpecsPerReboot !== undefined) fx.extraSpecsPerReboot += e.extraSpecsPerReboot;
    if (e.rpGainMult !== undefined) fx.rpGainMult *= e.rpGainMult;
  }
  return fx;
}
