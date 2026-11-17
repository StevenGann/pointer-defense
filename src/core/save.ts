/**
 * The meta-game persistence layer: one localStorage key holding the permanent profile — spec
 * levels, banked specs, achievements, best wave and the reboot count.
 *
 * Everything here is defensive: a missing, unparsable or unknown-version save falls back to the
 * default profile, and a localStorage that throws (private browsing, quota) degrades to an
 * in-memory copy so a broken store never stops the game from running.
 */

export const SAVE_KEY = 'pointer-defense/save';

/** Bump this when the schema changes in a way an older build could not read. */
export const SAVE_VERSION = 1;

export type SpecKind = 'cpu' | 'ram' | 'gpu' | 'disk';

/** Master volume step, remembered next to the profile (docs/design.md §14). */
export type VolumeLevel = 'low' | 'med' | 'high';

export interface SpecLevels {
  cpu: number;
  ram: number;
  gpu: number;
  disk: number;
}

export interface Profile {
  version: number;
  specs: SpecLevels;
  unspentSpecs: number;
  achievements: string[];
  bestWave: number;
  reboots: number;
  /** Whether sound effects play at all. */
  soundOn: boolean;
  /** Master volume step. */
  volume: VolumeLevel;
  /** Auto-wave: start the next wave 1.5 s after the board clears. */
  autoWave: boolean;
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
    unspentSpecs: 0,
    achievements: [],
    bestWave: 0,
    reboots: 0,
    soundOn: true,
    volume: 'med',
    autoWave: false,
  };
}

export function cloneProfile(p: Profile): Profile {
  return {
    version: p.version,
    specs: { cpu: p.specs.cpu, ram: p.specs.ram, gpu: p.specs.gpu, disk: p.specs.disk },
    unspentSpecs: p.unspentSpecs,
    achievements: [...p.achievements],
    bestWave: p.bestWave,
    reboots: p.reboots,
    soundOn: p.soundOn,
    volume: p.volume,
    autoWave: p.autoWave,
  };
}

/** The specs a reboot banks from a run's lifetime salvage, per docs/design.md §12. */
export function specGain(totalSalvageEarned: number): number {
  return Math.floor(Math.sqrt(totalSalvageEarned / 500));
}

/** Total specs owned: everything spent into levels plus the unspent bank. */
export function totalSpecs(p: Profile): number {
  return p.specs.cpu + p.specs.ram + p.specs.gpu + p.specs.disk + p.unspentSpecs;
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

/** Parse a stored value into a valid profile, or null when it is not usable. */
function parseProfile(raw: string): Profile | null {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null) return null;
  const o = data as Record<string, unknown>;
  if (o.version !== SAVE_VERSION) return null;

  const specsRaw = (typeof o.specs === 'object' && o.specs !== null ? o.specs : {}) as Record<string, unknown>;
  const specs: SpecLevels = {
    cpu: sanitizeSpecLevel(specsRaw.cpu, SPEC_CAPS.cpu),
    ram: sanitizeSpecLevel(specsRaw.ram, SPEC_CAPS.ram),
    gpu: sanitizeSpecLevel(specsRaw.gpu, SPEC_CAPS.gpu),
    disk: sanitizeSpecLevel(specsRaw.disk, SPEC_CAPS.disk),
  };
  const unspentSpecs =
    typeof o.unspentSpecs === 'number' && Number.isFinite(o.unspentSpecs)
      ? Math.max(0, Math.floor(o.unspentSpecs))
      : 0;
  const achievements = Array.isArray(o.achievements)
    ? o.achievements.filter((a): a is string => typeof a === 'string')
    : [];
  const bestWave =
    typeof o.bestWave === 'number' && Number.isFinite(o.bestWave) ? Math.max(0, Math.floor(o.bestWave)) : 0;
  const reboots =
    typeof o.reboots === 'number' && Number.isFinite(o.reboots) ? Math.max(0, Math.floor(o.reboots)) : 0;
  const soundOn = typeof o.soundOn === 'boolean' ? o.soundOn : true;
  const volume: VolumeLevel = o.volume === 'low' || o.volume === 'high' ? o.volume : 'med';
  const autoWave = typeof o.autoWave === 'boolean' ? o.autoWave : false;

  return { version: SAVE_VERSION, specs, unspentSpecs, achievements, bestWave, reboots, soundOn, volume, autoWave };
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
    fallback = cloneProfile(parsed);
    return parsed;
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
