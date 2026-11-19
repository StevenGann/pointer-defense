import { spend } from './economy.ts';
import type { RunState } from './state.ts';

/**
 * Global upgrades: expensive, one-shot, per-run purchases paid in salvage (docs/GLOBAL-UPGRADES.md).
 *
 * They live on `RunState`, never on the profile, so a reboot, a new run or a level change clears
 * them. A row exists only once the run has reached its wave. Every purchase goes through
 * `buyUpgrade`, so the smoke harness can drive them without the view. Pixi-free.
 */

export type UpgradeId =
  | 'salvage-contract' | 'emergency-patch' | 'wide-reticle' | 'double-buffer'
  | 'compound-interest' | 'autoloader' | 'shutter-licence' | 'bulk-requisition'
  | 'ballistic-telemetry' | 'structural-warranty' | 'chain-reaction'
  | 'bounty-board' | 'system-tray' | 'coolant';

export type UpgradeGroup = 'pointer' | 'towers' | 'economy' | 'board' | 'system';

export interface UpgradeDef {
  readonly id: UpgradeId;
  readonly name: string;
  readonly group: UpgradeGroup;
  /** The wave at which the row appears, and its purchase gate. */
  readonly wave: number;
  /** Salvage price. */
  readonly cost: number;
  /** One line for the row (<= 46 chars). */
  readonly line: string;
  /** Two or three sentences for the tooltip. */
  readonly detail: string;
}

/** The order groups are drawn in the dialog. */
export const UPGRADE_GROUPS: readonly UpgradeGroup[] = ['pointer', 'towers', 'economy', 'board', 'system'];

/** The bold header each group draws in the dialog. */
export const UPGRADE_GROUP_TITLES: Readonly<Record<UpgradeGroup, string>> = {
  pointer: 'POINTER',
  towers: 'TOWERS',
  economy: 'ECONOMY',
  board: 'BOARD',
  system: 'SYSTEM',
};

// --- Knobs (docs/GLOBAL-UPGRADES.md §4) ------------------------------------------------------------

/** Salvage Contract: tower-sourced kill value multiplier. */
export const SALVAGE_CONTRACT_MULT = 1.25;
/** Emergency Patch: the integrity a killing leak leaves behind. */
export const EMERGENCY_PATCH_INTEGRITY = 1;
/** Wide Reticle: extra click hit-test slack, in tiles. */
export const WIDE_RETICLE_SLACK = 0.2;
/** Double-Buffered Click: click and hold damage multiplier. */
export const DOUBLE_BUFFER_MULT = 2;
/** Compound Interest: the share of banked salvage paid at each wave clear. */
export const COMPOUND_INTEREST_RATE = 0.015;
/** Autoloader: tower fire interval multiplier. */
export const AUTOLOADER_INTERVAL_MULT = 0.87;
/** Bulk Requisition: discount per owned copy of the kind, and the discount cap. */
export const BULK_DISCOUNT_PER_COPY = 0.04;
export const BULK_DISCOUNT_CAP = 0.4;
/** Ballistic Telemetry: share of a projectile's damage repeated on a second flyer, and its reach. */
export const TELEMETRY_SPLASH_MULT = 0.5;
export const TELEMETRY_SPLASH_RANGE = 1;
/** Structural Warranty: tower damage taken and repair duration multipliers. */
export const WARRANTY_DAMAGE_MULT = 0.5;
export const WARRANTY_REPAIR_MULT = 0.5;
/** Chain Reaction: share of the killing blow, neighbours hit, and radius in tiles. */
export const CHAIN_SPLASH_MULT = 0.25;
export const CHAIN_TARGETS = 2;
export const CHAIN_RADIUS = 1.5;
/** Bounty Board: boss kill value and spawn HP multipliers. */
export const BOUNTY_VALUE_MULT = 2;
export const BOUNTY_HP_MULT = 1.1;
/** Coolant Loop: the run-local overclock cap. */
export const COOLANT_OVERCLOCK_CAP = 16;

export const GLOBAL_UPGRADES: readonly UpgradeDef[] = [
  // Pointer
  {
    id: 'wide-reticle',
    name: 'Wide Reticle',
    group: 'pointer',
    wave: 25,
    cost: 2200,
    line: 'Clicks land 0.2 tiles wider.',
    detail:
      'The click hit test gets 0.2 tiles of slack in every direction. Small flyers stop slipping out from under the pointer.',
  },
  {
    id: 'double-buffer',
    name: 'Double-Buffered Click',
    group: 'pointer',
    wave: 30,
    cost: 3000,
    line: 'Click and hold damage ×2.',
    detail:
      'Every click and every tick of held-reticle damage is doubled. Multiplies with overclock and the crit, so it is worth most on a built pointer.',
  },
  {
    id: 'chain-reaction',
    name: 'Chain Reaction',
    group: 'pointer',
    wave: 50,
    cost: 12000,
    line: 'Killing clicks splash 25% to two neighbours.',
    detail:
      'A click that kills deals a quarter of the killing blow to the two nearest enemies within 1.5 tiles. The splash cannot crit, cannot carry the mark bonus, and cannot chain again.',
  },
  {
    id: 'coolant',
    name: 'Coolant Loop',
    group: 'pointer',
    wave: 60,
    cost: 25000,
    line: 'Overclock cap 12 → 16 this run.',
    detail:
      'Four extra overclock levels for the rest of the run. The milestone multipliers on the ladder still apply, so this is the most expensive damage in the game.',
  },
  // Towers
  {
    id: 'salvage-contract',
    name: 'Salvage Contract',
    group: 'towers',
    wave: 20,
    cost: 1200,
    line: 'Tower kills pay +25% salvage.',
    detail:
      "The idle half starts paying. It does not touch the pointer's 1.5× bonus, so clicking is still the better rate — just no longer the only one.",
  },
  {
    id: 'autoloader',
    name: 'Autoloader',
    group: 'towers',
    wave: 35,
    cost: 4000,
    line: 'All towers fire 15% faster.',
    detail:
      "Every tower's fire interval is multiplied by 0.87, to a floor of one tick. Applies to beams and projectiles alike.",
  },
  {
    id: 'ballistic-telemetry',
    name: 'Ballistic Telemetry',
    group: 'towers',
    wave: 45,
    cost: 8000,
    // The spec's line ("…splash to a second flyer.") is 48 chars, over its own 46-char limit.
    line: 'AA shells and missiles splash a second flyer.',
    detail:
      'Each shell or missile that connects deals half its damage again to the nearest other flyer within one tile. Anti-air stops being single-target.',
  },
  {
    id: 'structural-warranty',
    name: 'Structural Warranty',
    group: 'towers',
    wave: 45,
    cost: 8500,
    // The spec's line is 51 chars, over its own 46-char limit.
    line: 'Towers take half damage, repair twice as fast.',
    detail:
      "Breachers and pop-ups do half damage to towers, and repair downtime halves. Stacks with Cooling Loop's 25 %, which lands at 37.5 % of the base time.",
  },
  // Economy
  {
    id: 'compound-interest',
    name: 'Compound Interest',
    group: 'economy',
    wave: 30,
    cost: 3200,
    line: '+1.5% of banked salvage at each wave clear.',
    detail:
      'Every cleared wave pays 1.5 % of what you are holding. It rewards not spending, which is the only upgrade that argues with the others.',
  },
  {
    id: 'bulk-requisition',
    name: 'Bulk Requisition',
    group: 'economy',
    wave: 40,
    cost: 6000,
    line: 'Each copy of a tower costs 4% less, to −40%.',
    detail:
      'The discount counts the copies you already own of that kind, so going tall on one tower is cheaper than spreading out. Walls do not count.',
  },
  {
    id: 'bounty-board',
    name: 'Bounty Board',
    group: 'economy',
    wave: 50,
    cost: 12500,
    line: 'Bosses pay double, with 10% more HP.',
    detail: 'Boss salvage doubles. They also arrive with a tenth more health, so the bonus is paid for in the fight.',
  },
  // Board
  {
    id: 'emergency-patch',
    name: 'Emergency Patch',
    group: 'board',
    wave: 25,
    cost: 2000,
    line: 'Once per run, a killing leak leaves you at 1.',
    detail:
      'The first leak that would take integrity to zero leaves you at one instead. It is consumed whether or not you were already going to lose.',
  },
  {
    id: 'shutter-licence',
    name: 'Shutter Licence',
    group: 'board',
    wave: 35,
    cost: 4200,
    // The spec's line is 57 chars, over its own 46-char limit, and it gives no detail text.
    line: 'Walls toggle instantly and never block a wave.',
    detail:
      'Toggle gates skip their three-second lock, so a shutter can be flipped as often as you can click it. A freshly toggled gate never holds up the next wave.',
  },
  // System
  {
    id: 'system-tray',
    name: 'System Tray',
    group: 'system',
    wave: 55,
    cost: 18000,
    line: 'Rare System Update pop-ups grant 20 s buffs.',
    detail:
      'Deep in a run the tray starts offering gifts: a pop-up that, clicked, doubles fire rate, doubles click damage, or adds 25 % kill salvage for twenty seconds. One at a time.',
  },
];

const DEFS_BY_ID: ReadonlyMap<UpgradeId, UpgradeDef> = new Map(GLOBAL_UPGRADES.map((d) => [d.id, d]));

/** The definition for an id, or undefined for an unknown id. */
export function upgradeDef(id: UpgradeId): UpgradeDef | undefined {
  return DEFS_BY_ID.get(id);
}

/** Minimal slice of RunState the helpers read, so callers and tests need not build a full run. */
type UpgradeState = Pick<RunState, 'upgrades' | 'wave' | 'economy' | 'clock' | 'buff'>;

/** True when the run owns `id`. */
export function hasUpgrade(s: Pick<RunState, 'upgrades'>, id: UpgradeId): boolean {
  return s.upgrades.includes(id);
}

/** Every def the run has reached (`def.wave <= s.wave`), in `GLOBAL_UPGRADES` order. */
export function revealedUpgrades(s: Pick<RunState, 'wave'>): UpgradeDef[] {
  return GLOBAL_UPGRADES.filter((d) => d.wave <= s.wave);
}

/** Revealed, not yet owned, and affordable right now. */
export function upgradesAvailable(s: Pick<RunState, 'wave' | 'upgrades' | 'economy'>): UpgradeDef[] {
  return revealedUpgrades(s).filter((d) => !hasUpgrade(s, d.id) && s.economy.salvage >= d.cost);
}

/**
 * Buy a global upgrade. Refuses an unknown or unrevealed id, a repeat purchase, or a purchase the
 * run cannot afford; otherwise subtracts exactly `def.cost` and records the id once.
 */
export function buyUpgrade(s: UpgradeState & Partial<Pick<RunState, 'salvageSpent'>>, id: UpgradeId): boolean {
  const def = DEFS_BY_ID.get(id);
  if (!def) return false;
  if (def.wave > s.wave) return false;
  if (hasUpgrade(s, id)) return false;
  if (!spend(s.economy, def.cost)) return false;
  if (typeof s.salvageSpent === 'number') s.salvageSpent += def.cost;
  s.upgrades.push(id);
  return true;
}

/** The active System Tray buff, or null once it has expired (compared against the sim clock). */
export function upgradeBuff(s: Pick<RunState, 'buff' | 'clock'>): RunState['buff'] {
  if (s.buff === null || s.clock >= s.buff.until) return null;
  return s.buff;
}
