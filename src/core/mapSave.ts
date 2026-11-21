import type { StorageLike } from './save.ts';

/**
 * The map chosen last from the gallery, remembered under `pd.map.v1` (docs/MAP-SELECT.md).
 *
 * Selection is remembered, never enforced: the value only sets the gallery's initial focus, and a
 * missing or unknown id falls back to the first card (`mapFocusForId`). The id itself is a shipped
 * map id and is never localised, so the key stores the raw identifier untouched.
 */
export const MAP_SAVE_KEY = 'pd.map.v1';

function browserStorage(): StorageLike | null {
  try {
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage;
    return ls ?? null;
  } catch {
    return null;
  }
}

/** Remember the last map started from the gallery, never throwing. */
export function rememberMap(id: string, storage?: StorageLike | null): void {
  const store = storage === undefined ? browserStorage() : storage;
  try {
    store?.setItem(MAP_SAVE_KEY, id);
  } catch {
    // Storage unavailable: the choice just is not carried to the next launch.
  }
}

/** Read the remembered map id, or null when absent or storage is unavailable. */
export function readRememberedMap(storage?: StorageLike | null): string | null {
  const store = storage === undefined ? browserStorage() : storage;
  try {
    return store?.getItem(MAP_SAVE_KEY) ?? null;
  } catch {
    return null;
  }
}
