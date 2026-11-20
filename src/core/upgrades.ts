import { spend } from './economy.ts';
import { rngNext } from './rng.ts';
import type { RunState } from './state.ts';
import { secondsToTicks } from './time.ts';
import { t } from '../i18n/index.ts';

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
/** System Tray (§5): spawn chance per roll, ticks between rolls, and the wave's quiet opening. */
export const TRAY_SPAWN_CHANCE = 0.015;
export const TRAY_ROLL_TICKS = secondsToTicks(1);
export const TRAY_SETTLE_TICKS = secondsToTicks(5);
/** System Tray: how long the pop-up stays up, and how long a claimed buff lasts. */
export const TRAY_LIFETIME_TICKS = secondsToTicks(12);
export const TRAY_BUFF_TICKS = secondsToTicks(20);
/** System Tray: the pop-up window's size, and its inset from the field's top-right corner. */
export const TRAY_W = 120;
export const TRAY_H = 64;
const TRAY_MARGIN = 8;
/** System Tray buffs: Turbo's fire interval, Overdrive's click/hold damage, Windfall's kill value. */
export const TURBO_INTERVAL_MULT = 0.6;
export const OVERDRIVE_MULT = 2;
export const WINDFALL_MULT = 1.25;

export const GLOBAL_UPGRADES: readonly UpgradeDef[] = [
  // Pointer
  {
    id: 'wide-reticle',
    name: t('upg.wideReticle.name'),
    group: 'pointer',
    wave: 25,
    cost: 2200,
    line: t('upg.wideReticle.blurb'),
    detail:
      t('upg.wideReticle.detail'),
  },
  {
    id: 'double-buffer',
    name: t('upg.doubleBuffer.name'),
    group: 'pointer',
    wave: 30,
    cost: 3000,
    line: t('upg.doubleBuffer.blurb'),
    detail:
      t('upg.doubleBuffer.detail'),
  },
  {
    id: 'chain-reaction',
    name: t('upg.chainReaction.name'),
    group: 'pointer',
    wave: 50,
    cost: 12000,
    line: t('upg.chainReaction.blurb'),
    detail:
      t('upg.chainReaction.detail'),
  },
  {
    id: 'coolant',
    name: t('upg.coolant.name'),
    group: 'pointer',
    wave: 60,
    cost: 25000,
    line: t('upg.coolant.blurb'),
    detail:
      t('upg.coolant.detail'),
  },
  // Towers
  {
    id: 'salvage-contract',
    name: t('upg.salvageContract.name'),
    group: 'towers',
    wave: 20,
    cost: 1200,
    line: t('upg.salvageContract.blurb'),
    detail:
      t('upg.salvageContract.detail'),
  },
  {
    id: 'autoloader',
    name: t('upg.autoloader.name'),
    group: 'towers',
    wave: 35,
    cost: 4000,
    line: t('upg.autoloader.blurb'),
    detail:
      t('upg.autoloader.detail'),
  },
  {
    id: 'ballistic-telemetry',
    name: t('upg.ballisticTelemetry.name'),
    group: 'towers',
    wave: 45,
    cost: 8000,
    // The spec's line ("…splash to a second flyer.") is 48 chars, over its own 46-char limit.
    line: t('upg.ballisticTelemetry.blurb'),
    detail:
      t('upg.ballisticTelemetry.detail'),
  },
  {
    id: 'structural-warranty',
    name: t('upg.structuralWarranty.name'),
    group: 'towers',
    wave: 45,
    cost: 8500,
    // The spec's line is 51 chars, over its own 46-char limit.
    line: t('upg.structuralWarranty.blurb'),
    detail:
      t('upg.structuralWarranty.detail'),
  },
  // Economy
  {
    id: 'compound-interest',
    name: t('upg.compoundInterest.name'),
    group: 'economy',
    wave: 30,
    cost: 3200,
    line: t('upg.compoundInterest.blurb'),
    detail:
      t('upg.compoundInterest.detail'),
  },
  {
    id: 'bulk-requisition',
    name: t('upg.bulkRequisition.name'),
    group: 'economy',
    wave: 40,
    cost: 6000,
    line: t('upg.bulkRequisition.blurb'),
    detail:
      t('upg.bulkRequisition.detail'),
  },
  {
    id: 'bounty-board',
    name: t('upg.bountyBoard.name'),
    group: 'economy',
    wave: 50,
    cost: 12500,
    line: t('upg.bountyBoard.blurb'),
    detail: t('upg.bountyBoard.detail'),
  },
  // Board
  {
    id: 'emergency-patch',
    name: t('upg.emergencyPatch.name'),
    group: 'board',
    wave: 25,
    cost: 2000,
    line: t('upg.emergencyPatch.blurb'),
    detail:
      t('upg.emergencyPatch.detail'),
  },
  {
    id: 'shutter-licence',
    name: t('upg.shutterLicence.name'),
    group: 'board',
    wave: 35,
    cost: 4200,
    // The spec's line is 57 chars, over its own 46-char limit, and it gives no detail text.
    line: t('upg.shutterLicence.blurb'),
    detail:
      t('upg.shutterLicence.detail'),
  },
  // System
  {
    id: 'system-tray',
    name: t('upg.systemTray.name'),
    group: 'system',
    wave: 55,
    cost: 18000,
    line: t('upg.systemTray.blurb'),
    detail:
      t('upg.systemTray.detail'),
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

// --- System Tray (docs/GLOBAL-UPGRADES.md §5) -----------------------------------------------------

export type BuffKind = NonNullable<RunState['buff']>['kind'];

/** The three buffs, in the order a uniform roll indexes them. */
export const BUFF_KINDS: readonly BuffKind[] = ['turbo', 'overdrive', 'windfall'];

/** The name the HUD and notices show for a buff. */
export const BUFF_NAMES: Readonly<Record<BuffKind, string>> = {
  turbo: 'Turbo',
  overdrive: 'Overdrive',
  windfall: 'Windfall',
};

/** One line for the notice shown when a buff is claimed. */
export const BUFF_LINES: Readonly<Record<BuffKind, string>> = {
  turbo: 'Turbo: towers fire faster for 20 s',
  overdrive: 'Overdrive: click damage x2 for 20 s',
  windfall: 'Windfall: kills pay +25% for 20 s',
};

/** The System Update pop-up: a small clickable window parked in the field's top-right corner. */
export interface TrayPopup {
  readonly id: number;
  /** The sim clock tick at which it closes itself. */
  readonly until: number;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** Whole seconds left on the active buff (rounded up), or 0 when none is live. */
export function buffSecondsLeft(s: Pick<RunState, 'buff' | 'clock'>): number {
  const b = upgradeBuff(s);
  return b ? Math.ceil((b.until - s.clock) / 60) : 0;
}

/**
 * Whether this tick is a System Tray roll: the upgrade is owned (and its wave reached), a wave is
 * running, the wave is past its first 5 s, it is a whole-second mark, and no pop-up is on screen.
 */
export function trayRollDue(
  s: Pick<RunState, 'upgrades' | 'wave' | 'phase' | 'waveTick' | 'tray'>,
): boolean {
  if (!hasUpgrade(s, 'system-tray')) return false;
  if (s.wave < (DEFS_BY_ID.get('system-tray')?.wave ?? Infinity)) return false;
  if (s.phase !== 'wave' || s.tray !== null) return false;
  if (s.waveTick < TRAY_SETTLE_TICKS) return false;
  return s.waveTick % TRAY_ROLL_TICKS === 0;
}

/** Open the System Update pop-up now (the roll already passed; tests call it directly). */
export function spawnTray(s: RunState): TrayPopup | null {
  if (s.tray) return null;
  const field = s.viewport.boardCol;
  const tray: TrayPopup = {
    id: s.nextId++,
    until: s.clock + TRAY_LIFETIME_TICKS,
    x: field.x + field.w - TRAY_MARGIN - TRAY_W,
    y: field.y + TRAY_MARGIN,
    w: TRAY_W,
    h: TRAY_H,
  };
  s.tray = tray;
  s.events.push({ type: 'traySpawned' });
  return tray;
}

/**
 * Called once per sim tick, in every phase. Closes an expired pop-up, drops an expired buff, and
 * on a roll tick opens a new pop-up with `TRAY_SPAWN_CHANCE`. The roll draws from the run's seeded
 * stream only when the gate is open, so a run that does not own the upgrade is untouched.
 */
export function tickSystemTray(s: RunState): void {
  if (s.tray && s.clock >= s.tray.until) s.tray = null;
  if (s.buff && s.clock >= s.buff.until) s.buff = null;
  if (!trayRollDue(s)) return;
  const r = rngNext(s.rng);
  s.rng = r.next;
  if (r.value < TRAY_SPAWN_CHANCE) spawnTray(s);
}

/**
 * Click the System Update pop-up: close it and grant one of the three buffs, chosen uniformly, for
 * 20 s of sim clock. A new buff replaces whatever was running; buffs never stack. `pick` forces the
 * buff (tests); otherwise it is drawn from the seeded stream.
 */
export function claimTray(s: RunState, id: number, pick?: BuffKind): BuffKind | null {
  if (!s.tray || s.tray.id !== id) return null;
  s.tray = null;
  let kind = pick;
  if (!kind) {
    const r = rngNext(s.rng);
    s.rng = r.next;
    kind = BUFF_KINDS[Math.min(BUFF_KINDS.length - 1, Math.floor(r.value * BUFF_KINDS.length))];
  }
  s.buff = { kind, until: s.clock + TRAY_BUFF_TICKS };
  s.events.push({ type: 'trayClaimed', kind });
  return kind;
}

/** Turbo's fire-interval multiplier (1 when it is not live). */
export function buffIntervalMult(s: Pick<RunState, 'buff' | 'clock'>): number {
  return upgradeBuff(s)?.kind === 'turbo' ? TURBO_INTERVAL_MULT : 1;
}

/** Overdrive's click and hold damage multiplier (1 when it is not live). */
export function buffPointerMult(s: Pick<RunState, 'buff' | 'clock'>): number {
  return upgradeBuff(s)?.kind === 'overdrive' ? OVERDRIVE_MULT : 1;
}

/** Windfall's kill value multiplier (1 when it is not live). */
export function buffKillMult(s: Pick<RunState, 'buff' | 'clock'>): number {
  return upgradeBuff(s)?.kind === 'windfall' ? WINDFALL_MULT : 1;
}
