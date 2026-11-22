/**
 * The meta-game persistence layer: one localStorage key holding the permanent profile — spec
 * levels, banked specs, achievements, best wave and the reboot count.
 *
 * Everything here is defensive: a missing, unparsable or unknown-version save falls back to the
 * default profile, and a localStorage that throws (private browsing, quota) degrades to an
 * in-memory copy so a broken store never stops the game from running.
 */

import { BOSS_KINDS, ENEMY_KINDS, isBossVariant, isEnemyKind, type EnemyKind } from './enemies.ts';
import { TOWER_KINDS, towerUnlockWave } from './towers.ts';
import { isTreeNodeId, LICENCE_IDS } from './tree.ts';

export const SAVE_KEY = 'pointer-defense/save';

/** Bump this when the schema changes in a way an older build could not read. */
export const SAVE_VERSION = 3;

/** How many finished runs the profile remembers, newest first (docs/RUN-RECORDS.md). */
export const MAX_RUNS = 50;

/** How a run ended: cleared the final wave, integrity reached zero, Restart Windows, or a daily. */
export type RunOutcome = 'victory' | 'defeat' | 'reboot' | 'daily';

/** One finished run, appended at the moment it ends (docs/RUN-RECORDS.md). */
export interface RunRecord {
  id: string;
  /** ISO date the run ended, stamped when the record is written. */
  at: string;
  mapId: string;
  mapName: string;
  /** The highest wave reached (the last wave started). */
  wave: number;
  clearedWaves: number;
  integrity: number;
  pointerStage: number;
  /** Lifetime salvage earned over the run — the run's score. */
  salvage: number;
  durationTicks: number;
  outcome: RunOutcome;
  victory: boolean;
  /** The daily's date and seed, carried only on a daily record (docs/DAILY.md). */
  dailyDate?: string;
  dailySeed?: number;
}

/** The last daily's result, mirrored to the profile so the menu can read it without the history. */
export interface DailyResult {
  date: string;
  wave: number;
  clearedWaves: number;
  outcome: RunOutcome;
  at: string;
}

/** The oldest schema version still readable; any version from here up migrates to the current one. */
const MIGRATABLE_VERSION = 1;

export type SpecKind = 'cpu' | 'ram' | 'gpu' | 'disk';

/** Master volume step, remembered next to the profile (docs/design.md §14). */
export type VolumeLevel = 'low' | 'med' | 'high';

/** The main-menu choice a returning player lands on (docs/design.md §20.1). */
export type MenuChoice = 'play' | 'editor' | 'load';

export interface SpecLevels {
  cpu: number;
  ram: number;
  gpu: number;
  disk: number;
}

export interface Profile {
  version: number;
  specs: SpecLevels;
  /** Unspent Restore Points — the currency spent on tree nodes and spec levels. */
  rp: number;
  /** Lifetime Restore Points earned — the prestige level, which never falls. */
  rpEarned: number;
  /** Ids of the Restore-tree nodes bought so far (permanent across reboots). */
  tree: string[];
  /** The salvage the last rebooted run earned, for Restore Point's 10% carry. */
  lastSalvage: number;
  achievements: string[];
  /** The local date (YYYY-MM-DD) each achievement fired, for the grid tooltip. */
  achievementDates: Record<string, string>;
  /** Authored map ids a wave has been cleared on, across all runs (for the every-map shadow). */
  mapsCleared: string[];
  /** Bosses killed by the pointer's final blow, across all runs (for the boss-hunter meta). */
  lifetimeBossKillsByPointer: number;
  bestWave: number;
  reboots: number;
  /** Finished runs, newest first, capped at MAX_RUNS (docs/RUN-RECORDS.md). */
  runs: RunRecord[];
  /** The last daily's result, so the menu can disable the Daily button until the next date. */
  daily: DailyResult | null;
  /** Whether sound effects play at all. */
  soundOn: boolean;
  /** Master volume step. */
  volume: VolumeLevel;
  /** Auto-wave: start the next wave 1.5 s after the board clears. */
  autoWave: boolean;
  /** Screen shake. Defaults off for users who prefer reduced motion. */
  shakeOn: boolean;
  /** Boss kinds already announced (first appearance), so a type's teaching moment fires once. */
  seenBossKinds: EnemyKind[];
  /** Enemy kinds (bosses included) already encountered on the field, for the Help viewer gates. */
  seenEnemies: EnemyKind[];
  /** The main-menu button the player last used; the boot lands here, Play for a fresh profile. */
  lastChoice: MenuChoice;
  /** Whether the Cheats menu is unlocked (the Konami code); hidden until the player finds it. */
  cheatsUnlocked: boolean;
}

export const SPEC_KINDS: readonly SpecKind[] = ['cpu', 'ram', 'gpu', 'disk'];

/** How many points each spec may hold. */
export const SPEC_CAPS: Readonly<Record<SpecKind, number>> = {
  cpu: 20,
  ram: 20,
  gpu: 20,
  disk: 10,
};

export const SPEC_NAMES: Readonly<Record<SpecKind, string>> = {
  cpu: 'CPU',
  ram: 'RAM',
  gpu: 'GPU',
  disk: 'Disk',
};

/** The bonus text for a spec at its current level, for the shop row. */
export function specEffectText(kind: SpecKind, level: number): string {
  switch (kind) {
    case 'cpu':
      return `+${level * 2}% dmg`;
    case 'ram':
      return `+${level * 5} sal`;
    case 'gpu':
      return `+${level * 2}% dmg`;
    case 'disk':
      return `+${level} int`;
  }
}

/** The compact bonus text, with the unit dropped, for a shop row too narrow for the verbose form. */
export function specEffectCompactText(kind: SpecKind, level: number): string {
  switch (kind) {
    case 'cpu':
      return `+${level * 2}%`;
    case 'ram':
      return `+${level * 5}`;
    case 'gpu':
      return `+${level * 2}%`;
    case 'disk':
      return `+${level}`;
  }
}

export function defaultProfile(): Profile {
  return {
    version: SAVE_VERSION,
    specs: { cpu: 0, ram: 0, gpu: 0, disk: 0 },
    rp: 0,
    rpEarned: 0,
    tree: [],
    lastSalvage: 0,
    achievements: [],
    achievementDates: {},
    mapsCleared: [],
    lifetimeBossKillsByPointer: 0,
    bestWave: 0,
    reboots: 0,
    runs: [],
    daily: null,
    soundOn: true,
    volume: 'med',
    autoWave: false,
    shakeOn: !prefersReducedMotion(),
    seenBossKinds: [],
    seenEnemies: [],
    lastChoice: 'play',
    cheatsUnlocked: false,
  };
}

/** Whether the user has asked the OS to reduce motion (false headless or when unsupported). */
export function prefersReducedMotion(): boolean {
  try {
    const w = globalThis as { matchMedia?: (query: string) => { matches: boolean } };
    if (typeof w.matchMedia !== 'function') return false;
    return w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function cloneProfile(p: Profile): Profile {
  return {
    version: p.version,
    specs: { cpu: p.specs.cpu, ram: p.specs.ram, gpu: p.specs.gpu, disk: p.specs.disk },
    rp: p.rp,
    rpEarned: p.rpEarned,
    tree: [...p.tree],
    lastSalvage: p.lastSalvage,
    achievements: [...p.achievements],
    achievementDates: { ...p.achievementDates },
    mapsCleared: [...p.mapsCleared],
    lifetimeBossKillsByPointer: p.lifetimeBossKillsByPointer,
    bestWave: p.bestWave,
    reboots: p.reboots,
    runs: p.runs.map((r) => ({ ...r })),
    daily: p.daily === null ? null : { ...p.daily },
    soundOn: p.soundOn,
    volume: p.volume,
    autoWave: p.autoWave,
    shakeOn: p.shakeOn,
    seenBossKinds: [...p.seenBossKinds],
    seenEnemies: [...p.seenEnemies],
    lastChoice: p.lastChoice,
    cheatsUnlocked: p.cheatsUnlocked,
  };
}

/** The Restore Points a reboot banks from a run's lifetime salvage, per docs/design.md §12.1. */
export function rpGain(totalSalvageEarned: number): number {
  return Math.floor(2.2 * Math.sqrt(totalSalvageEarned / 900));
}

/** The RP cost of raising a spec from `level` to `level + 1`, per docs/design.md §12.2. */
export function specLevelCost(level: number): number {
  return Math.ceil(2 * Math.pow(1.28, level));
}

/**
 * Whether every page in the Help viewer is readable. A page unlocks from a mix of what has been
 * encountered (enemies, bosses) and how far a run has reached (bestWave), so the whole library is
 * open once every enemy kind, every boss kind and every tower kind has been met.
 */
export function allHelpUnlocked(p: Profile): boolean {
  return (
    ENEMY_KINDS.every((k) => p.seenEnemies.includes(k)) &&
    BOSS_KINDS.every((k) => p.seenBossKinds.includes(k)) &&
    TOWER_KINDS.every((k) => p.bestWave >= towerUnlockWave(k))
  );
}

/**
 * Evaluate the profile-only achievements (the ones that depend on what has been met across runs,
 * not on the live run state) and record them in the profile, returning the ids just unlocked. The
 * live-run achievements are handled by `checkAchievements` in state.ts; this covers the rest.
 */
export function checkProfileAchievements(p: Profile): string[] {
  const unlocked: string[] = [];
  const add = (id: string): void => {
    if (!p.achievements.includes(id)) {
      p.achievements.push(id);
      unlocked.push(id);
    }
  };
  if (p.reboots >= 2) add('two-reboots');
  if (p.reboots >= 10) add('reboot-10');
  if (allHelpUnlocked(p)) add('all-help');
  return unlocked;
}

/** Record enemy kinds the player has encountered, returning true when anything new was added. */
export function addSeenEnemies(profile: Profile, kinds: readonly EnemyKind[]): boolean {
  let changed = false;
  for (const k of kinds) {
    if (!profile.seenEnemies.includes(k)) {
      profile.seenEnemies.push(k);
      changed = true;
    }
  }
  return changed;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The in-memory fallback used when localStorage is unavailable or throws. */
let fallback: Profile = defaultProfile();

function browserStorage(): StorageLike | null {
  try {
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage;
    return ls ?? null;
  } catch {
    return null;
  }
}

function sanitizeSpecLevel(value: unknown, cap: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(cap, Math.max(0, Math.floor(value)));
}

function nonNegInt(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0
    ? value
    : null;
}

/**
 * Parse one run record, or null when it is corrupt. A bad entry is dropped on its own — never the
 * whole profile — so a single malformed row cannot stop the game loading (docs/RUN-RECORDS.md).
 */
function parseRunRecord(value: unknown): RunRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const o = value as Record<string, unknown>;
  if (typeof o.id !== 'string' || typeof o.at !== 'string') return null;
  if (typeof o.mapId !== 'string' || typeof o.mapName !== 'string') return null;
  const wave = nonNegInt(o.wave);
  const clearedWaves = nonNegInt(o.clearedWaves);
  const integrity = nonNegInt(o.integrity);
  const pointerStage = nonNegInt(o.pointerStage);
  const salvage = nonNegInt(o.salvage);
  const durationTicks = nonNegInt(o.durationTicks);
  if (wave === null || clearedWaves === null || integrity === null || pointerStage === null || salvage === null || durationTicks === null) {
    return null;
  }
  const outcome: RunOutcome | null =
    o.outcome === 'victory' || o.outcome === 'defeat' || o.outcome === 'reboot' || o.outcome === 'daily' ? o.outcome : null;
  if (outcome === null) return null;
  let dailyDate: string | undefined;
  if (typeof o.dailyDate === 'string') dailyDate = o.dailyDate;
  let dailySeed: number | undefined;
  if (o.dailySeed !== undefined) {
    const seed = nonNegInt(o.dailySeed);
    if (seed === null) return null;
    dailySeed = seed;
  }
  return {
    id: o.id,
    at: o.at,
    mapId: o.mapId,
    mapName: o.mapName,
    wave,
    clearedWaves,
    integrity,
    pointerStage,
    salvage,
    durationTicks,
    outcome,
    // Derived from the outcome, never trusted from storage, so the two can never disagree.
    victory: outcome === 'victory',
    ...(dailyDate !== undefined ? { dailyDate } : {}),
    ...(dailySeed !== undefined ? { dailySeed } : {}),
  };
}

/** Parse the last daily's result, or null when it is absent or corrupt. */
function parseDaily(value: unknown): DailyResult | null {
  if (typeof value !== 'object' || value === null) return null;
  const o = value as Record<string, unknown>;
  const date = typeof o.date === 'string' ? o.date : null;
  const wave = nonNegInt(o.wave);
  const clearedWaves = nonNegInt(o.clearedWaves);
  const at = typeof o.at === 'string' ? o.at : null;
  if (date === null || wave === null || clearedWaves === null || at === null) return null;
  const outcome: RunOutcome | null =
    o.outcome === 'victory' || o.outcome === 'defeat' || o.outcome === 'reboot' || o.outcome === 'daily' ? o.outcome : null;
  if (outcome === null) return null;
  return { date, wave, clearedWaves, outcome, at };
}

/** Parse the run history, dropping corrupt entries individually and capping at MAX_RUNS. */
function parseRuns(value: unknown): RunRecord[] {
  if (!Array.isArray(value)) return [];
  const out: RunRecord[] = [];
  for (const entry of value) {
    const record = parseRunRecord(entry);
    if (record !== null) out.push(record);
  }
  if (out.length > MAX_RUNS) out.length = MAX_RUNS;
  return out;
}

/** Parse a stored value into a valid profile, or null when it is not usable. */
function parseProfile(raw: string): { profile: Profile; migrated: boolean } | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const o = data as Record<string, unknown>;
  // Any version from the migratable floor up to the current one loads (migrating as needed); a newer
  // or older version than the code knows falls back to a fresh profile.
  if (typeof o.version !== 'number' || o.version < MIGRATABLE_VERSION || o.version > SAVE_VERSION) return null;

  const specsRaw = (typeof o.specs === 'object' && o.specs !== null ? o.specs : {}) as Record<string, unknown>;
  const specs: SpecLevels = {
    cpu: sanitizeSpecLevel(specsRaw.cpu, SPEC_CAPS.cpu),
    ram: sanitizeSpecLevel(specsRaw.ram, SPEC_CAPS.ram),
    gpu: sanitizeSpecLevel(specsRaw.gpu, SPEC_CAPS.gpu),
    disk: sanitizeSpecLevel(specsRaw.disk, SPEC_CAPS.disk),
  };
  // Restore Points and the tree shipped after the spec-bank era. A version-1 save keeps its banked
  // points: `unspentSpecs` was the old currency and converts one-for-one into Restore Points.
  const banked = typeof o.unspentSpecs === 'number' && Number.isFinite(o.unspentSpecs)
    ? Math.max(0, Math.floor(o.unspentSpecs)) : 0;
  const rp =
    typeof o.rp === 'number' && Number.isFinite(o.rp) ? Math.max(0, Math.floor(o.rp)) : banked;
  // A migrated save's banked points were earned, so they count toward the prestige level as well as
  // the balance — otherwise a returning player would own a balance but sit at level 0.
  const rpEarned =
    typeof o.rpEarned === 'number' && Number.isFinite(o.rpEarned)
      ? Math.max(0, Math.floor(o.rpEarned))
      : rp;
  const lastSalvage =
    typeof o.lastSalvage === 'number' && Number.isFinite(o.lastSalvage)
      ? Math.max(0, Math.floor(o.lastSalvage))
      : 0;
  // The removed `early-access` node granted every licence; migrate it to the eight licence ids so a
  // player who bought it keeps all eight towers. `treeNodeById` already drops ids it no longer knows.
  const rawTree = Array.isArray(o.tree) ? o.tree : [];
  const tree = [...new Set(rawTree.filter((id): id is string => typeof id === 'string' && isTreeNodeId(id)))];
  if (rawTree.includes('early-access')) {
    for (const id of LICENCE_IDS) if (!tree.includes(id)) tree.push(id);
  }
  const achievements = Array.isArray(o.achievements)
    ? o.achievements.filter((a): a is string => typeof a === 'string')
    : [];
  const achievementDates: Record<string, string> = {};
  if (typeof o.achievementDates === 'object' && o.achievementDates !== null) {
    for (const [k, v] of Object.entries(o.achievementDates as Record<string, unknown>)) {
      if (typeof v === 'string') achievementDates[k] = v;
    }
  }
  const bestWave =
    typeof o.bestWave === 'number' && Number.isFinite(o.bestWave) ? Math.max(0, Math.floor(o.bestWave)) : 0;
  const reboots =
    typeof o.reboots === 'number' && Number.isFinite(o.reboots) ? Math.max(0, Math.floor(o.reboots)) : 0;
  const soundOn = typeof o.soundOn === 'boolean' ? o.soundOn : true;
  const volume: VolumeLevel = o.volume === 'low' || o.volume === 'high' ? o.volume : 'med';
  const autoWave = typeof o.autoWave === 'boolean' ? o.autoWave : false;
  const shakeOn = typeof o.shakeOn === 'boolean' ? o.shakeOn : !prefersReducedMotion();
  // Cap the set at the boss kinds that exist, and drop duplicates: an old save simply records none.
  const seenBossKinds = Array.isArray(o.seenBossKinds)
    ? [...new Set(o.seenBossKinds.filter((k): k is EnemyKind => typeof k === 'string' && isBossVariant(k as EnemyKind)))]
    : [];
  // Same cap-and-validate shape for encountered enemies (bosses included); an older save without the
  // field simply loads an empty list, so every Help page that is not on screen starts locked.
  const seenEnemies = Array.isArray(o.seenEnemies)
    ? [...new Set(o.seenEnemies.filter((k): k is EnemyKind => typeof k === 'string' && isEnemyKind(k as EnemyKind)))]
    : [];
  const lastChoice: MenuChoice = o.lastChoice === 'editor' || o.lastChoice === 'load' ? o.lastChoice : 'play';
  // A save written before cheats shipped has no field; it simply loads locked rather than rejected.
  const cheatsUnlocked = typeof o.cheatsUnlocked === 'boolean' ? o.cheatsUnlocked : false;
  // Cross-run achievement counters, migration-safe: absent on older saves, so they default empty.
  const mapsCleared = Array.isArray(o.mapsCleared)
    ? [...new Set(o.mapsCleared.filter((m): m is string => typeof m === 'string'))]
    : [];
  const lifetimeBossKillsByPointer =
    typeof o.lifetimeBossKillsByPointer === 'number' && Number.isFinite(o.lifetimeBossKillsByPointer)
      ? Math.max(0, Math.floor(o.lifetimeBossKillsByPointer))
      : 0;
  // Run history (docs/RUN-RECORDS.md): an older save without the field loads an empty list, and
  // corrupt entries are dropped one at a time rather than failing the load.
  const runs = parseRuns(o.runs);
  // The last daily's result (docs/DAILY.md); an older save without the field simply has none played.
  const daily = parseDaily(o.daily);

  const profile: Profile = { version: SAVE_VERSION, specs, rp, rpEarned, tree, lastSalvage, achievements, achievementDates, mapsCleared, lifetimeBossKillsByPointer, bestWave, reboots, runs, daily, soundOn, volume, autoWave, shakeOn, seenBossKinds, seenEnemies, lastChoice, cheatsUnlocked };
  return { profile, migrated: rawTree.includes('early-access') };
}

/**
 * Load the profile, never throwing. A missing, unparsable or unknown-version save returns the
 * default profile. A storage failure returns whatever was last held in memory.
 */
export function loadProfile(storage?: StorageLike | null): Profile {
  const store = storage === undefined ? browserStorage() : storage;
  if (!store) return cloneProfile(fallback);
  try {
    const raw = store.getItem(SAVE_KEY);
    if (raw === null) return cloneProfile(defaultProfile());
    const parsed = parseProfile(raw);
    if (parsed === null) return cloneProfile(defaultProfile());
    fallback = cloneProfile(parsed.profile);
    // A migration rewrites the profile so the exchange (early-access -> eight licences) is persisted,
    // and so loading twice is idempotent.
    if (parsed.migrated) {
      try {
        store.setItem(SAVE_KEY, JSON.stringify(parsed.profile));
      } catch {
        // The in-memory copy is already migrated; the write-back is best-effort.
      }
    }
    return parsed.profile;
  } catch {
    return cloneProfile(fallback);
  }
}

/** Write the profile back, never throwing. Always keeps the in-memory copy current. */
export function saveProfile(profile: Profile, storage?: StorageLike | null): void {
  const store = storage === undefined ? browserStorage() : storage;
  fallback = cloneProfile(profile);
  try {
    store?.setItem(SAVE_KEY, JSON.stringify(profile));
  } catch {
    // Private browsing or quota: the in-memory copy above still keeps the game running.
  }
}
