import { COLS, ROWS, type Tile } from './grid.ts';
import { validateLevel, type Level, type LevelToggle } from './levels.ts';
import type { EditorModel, EditorTileKind } from './editor.ts';

/**
 * The editor's persistence (docs/EDITOR-LIBRARY.md): an auto-saved draft under `pd.editor.draft.v1`
 * and a small library of saved maps under `pd.editor.lib.v1`.
 *
 * The draft is the drawing currently on the desk — its tiles, markers, toggles, name and the library
 * entry it came from — written debounced by the view layer and restored when the editor opens. The
 * library is an array of saved maps, newest first, at most 50, each entry `{ id, name, savedAt,
 * level }`. Both are read defensively: a missing, unparsable, unknown-version or otherwise doubtful
 * store never throws, and an entry whose level fails `validateLevel` is dropped on load.
 */

export const DRAFT_KEY = 'pd.editor.draft.v1';
export const LIB_KEY = 'pd.editor.lib.v1';
export const DRAFT_VERSION = 1;
export const LIB_VERSION = 1;
export const LIBRARY_MAX = 50;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The draft serialises the raw drawing, not a validated level, so an unfinished map still persists. */
export interface EditorDraft {
  v: 1;
  name: string;
  libraryId: string | null;
  tiles: EditorTileKind[];
  start: Tile | null;
  exit: Tile | null;
  toggles: LevelToggle[];
}

export interface EditorMapEntry {
  /** A small monotonic string, unique within the library (e.g. "m3"). */
  id: string;
  name: string;
  /** ISO timestamp of the last save, for the Open dialog's date column. */
  savedAt: string;
  level: Level;
}

function browserStorage(): StorageLike | null {
  try {
    return (globalThis as { localStorage?: StorageLike }).localStorage ?? null;
  } catch {
    return null;
  }
}

// --- Validation helpers ------------------------------------------------------------------------

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function int(v: unknown): number | null {
  return typeof v === 'number' && Number.isInteger(v) ? v : null;
}

function parseTile(v: unknown): Tile | null {
  if (!isObj(v)) return null;
  const col = int(v.col);
  const row = int(v.row);
  if (col === null || row === null) return null;
  return { col, row };
}

function parseTiles(v: unknown): Tile[] | null {
  if (!Array.isArray(v)) return null;
  const out: Tile[] = [];
  for (const t of v) {
    const tile = parseTile(t);
    if (tile === null) return null;
    out.push(tile);
  }
  return out;
}

function parseWalls(v: unknown): (readonly [number, number])[] | null {
  if (!Array.isArray(v)) return null;
  const out: [number, number][] = [];
  for (const w of v) {
    if (!Array.isArray(w) || w.length !== 2) return null;
    const c = int(w[0]);
    const r = int(w[1]);
    if (c === null || r === null) return null;
    out.push([c, r]);
  }
  return out;
}

function parseToggles(v: unknown): LevelToggle[] | null {
  if (!Array.isArray(v)) return null;
  const out: LevelToggle[] = [];
  for (const t of v) {
    if (!isObj(t)) return null;
    const col = int(t.col);
    const row = int(t.row);
    const periodTicks = int(t.periodTicks);
    const openTicks = int(t.openTicks);
    const phaseTicks = int(t.phaseTicks);
    if (col === null || row === null || periodTicks === null || openTicks === null || phaseTicks === null) return null;
    out.push({ col, row, periodTicks, openTicks, phaseTicks });
  }
  return out;
}

function parseLevel(v: unknown): Level | null {
  if (!isObj(v)) return null;
  const id = str(v.id);
  const name = str(v.name);
  if (id === null || name === null) return null;
  const walls = parseWalls(v.walls);
  if (walls === null) return null;
  let noBuild: readonly (readonly [number, number])[] | undefined;
  if (v.noBuild !== undefined && v.noBuild !== null) {
    const parsed = parseWalls(v.noBuild);
    if (parsed === null) return null;
    noBuild = parsed;
  }
  const starts = v.starts === undefined ? null : parseTiles(v.starts);
  if (starts === null || starts.length === 0) return null;
  const exits = v.exits === undefined ? null : parseTiles(v.exits);
  if (exits === null || exits.length === 0) return null;

  let toggles: readonly LevelToggle[] | undefined;
  if (v.toggles !== undefined && v.toggles !== null) {
    const parsed = parseToggles(v.toggles);
    if (parsed === null) return null;
    toggles = parsed;
  }

  const level: Level = {
    id,
    name,
    walls,
    starts,
    exits,
    ...(noBuild !== undefined ? { noBuild } : {}),
    ...(toggles !== undefined ? { toggles } : {}),
  };
  return level;
}

// --- Draft -------------------------------------------------------------------------------------

/** Capture the drawing as a plain object, ready to write under `pd.editor.draft.v1`. */
export function captureEditorDraft(model: EditorModel): EditorDraft {
  return {
    v: 1,
    name: model.name,
    libraryId: model.libraryId,
    tiles: model.tiles.slice(),
    start: model.start,
    exit: model.exit,
    toggles: model.toggles.map((t) => ({ ...t })),
  };
}

function parseDraft(v: unknown): EditorDraft | null {
  if (!isObj(v) || v.v !== DRAFT_VERSION) return null;
  const name = str(v.name);
  if (name === null) return null;
  const libraryId = v.libraryId === null ? null : str(v.libraryId);
  if (v.libraryId !== null && libraryId === null) return null;
  if (!Array.isArray(v.tiles) || v.tiles.length !== COLS * ROWS) return null;
  const tiles: EditorTileKind[] = [];
  for (const t of v.tiles) {
    if (t !== 'floor' && t !== 'wall' && t !== 'shutter' && t !== 'no-build') return null;
    tiles.push(t);
  }
  const start = v.start === null ? null : parseTile(v.start);
  if (v.start !== null && start === null) return null;
  const exit = v.exit === null ? null : parseTile(v.exit);
  if (v.exit !== null && exit === null) return null;
  const toggles = parseToggles(v.toggles ?? []);
  if (toggles === null) return null;
  return { v: 1, name, libraryId, tiles, start, exit, toggles };
}

/** Replace a model's drawing with the draft's, discarding any undo history and selection. */
export function applyDraft(model: EditorModel, draft: EditorDraft): void {
  model.tiles = draft.tiles.slice();
  model.start = draft.start;
  model.exit = draft.exit;
  model.toggles = draft.toggles.map((t) => ({ ...t }));
  model.name = draft.name;
  model.libraryId = draft.libraryId;
  model.selectedShutter = null;
  model.undoStack = [];
  model.redoStack = [];
}

/** Load the draft, or null when absent or doubtful (deleting a bad key). Never throws. */
export function loadEditorDraft(storage?: StorageLike | null): EditorDraft | null {
  const store = storage === undefined ? browserStorage() : storage;
  if (!store) return null;
  try {
    const raw = store.getItem(DRAFT_KEY);
    if (raw === null) return null;
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      store.removeItem(DRAFT_KEY);
      return null;
    }
    const draft = parseDraft(data);
    if (draft === null) {
      store.removeItem(DRAFT_KEY);
      return null;
    }
    return draft;
  } catch {
    try {
      store.removeItem(DRAFT_KEY);
    } catch {
      // The key may already be gone; the game must still boot.
    }
    return null;
  }
}

/** Write the draft back, never throwing. */
export function saveEditorDraft(model: EditorModel, storage?: StorageLike | null): void {
  const store = storage === undefined ? browserStorage() : storage;
  try {
    store?.setItem(DRAFT_KEY, JSON.stringify(captureEditorDraft(model)));
  } catch {
    // Private browsing or quota: the editor still works, it just cannot remember its draft.
  }
}

/** Delete the draft key (used only defensively; the draft is normally cleared by writing an empty board). */
export function clearEditorDraft(storage?: StorageLike | null): void {
  const store = storage === undefined ? browserStorage() : storage;
  try {
    store?.removeItem(DRAFT_KEY);
  } catch {
    // Nothing to clear.
  }
}

// --- Library -----------------------------------------------------------------------------------

/** The next monotonic map id, one past the largest numeric suffix already present. */
export function nextMapId(maps: readonly EditorMapEntry[]): string {
  let max = 0;
  for (const m of maps) {
    const match = /^m(\d+)$/.exec(m.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `m${max + 1}`;
}

/** A name for the map, sanitised to 1–24 printable characters; empty becomes "Untitled". */
export function sanitizeMapName(raw: string): string {
  const printable = raw.replace(/[^\x20-\x7e]/g, ' ').trim();
  const name = printable === '' ? 'Untitled' : printable;
  return name.slice(0, 24);
}

/**
 * Save the drawing into the library, newest first. `id` names an entry to update in place (a second
 * Save on the same drawing); null creates a fresh entry. The result always fits `LIBRARY_MAX`, the
 * oldest entry evicted when a new one overflows.
 */
export function saveLibraryMap(
  maps: readonly EditorMapEntry[],
  id: string | null,
  name: string,
  level: Level,
  savedAt: string,
): { maps: EditorMapEntry[]; entry: EditorMapEntry } {
  const existing = id === null ? -1 : maps.findIndex((m) => m.id === id);
  if (existing >= 0) {
    const entry: EditorMapEntry = { id: id!, name, savedAt, level };
    const rest = maps.slice();
    rest.splice(existing, 1);
    return { maps: [entry, ...rest].slice(0, LIBRARY_MAX), entry };
  }
  const entry: EditorMapEntry = { id: nextMapId(maps), name, savedAt, level };
  return { maps: [entry, ...maps].slice(0, LIBRARY_MAX), entry };
}

/** Replace one entry with the drawing, for the 51st-save flow where the player chooses a victim. */
export function replaceLibraryMap(
  maps: readonly EditorMapEntry[],
  replaceId: string,
  name: string,
  level: Level,
  savedAt: string,
): { maps: EditorMapEntry[]; entry: EditorMapEntry } {
  const entry: EditorMapEntry = { id: nextMapId(maps), name, savedAt, level };
  return { maps: [entry, ...maps.filter((m) => m.id !== replaceId)].slice(0, LIBRARY_MAX), entry };
}

/** Remove one entry, leaving the order and every other entry untouched. */
export function deleteLibraryMap(maps: readonly EditorMapEntry[], id: string): EditorMapEntry[] {
  return maps.filter((m) => m.id !== id);
}

/** Rebuild a model's drawing from a library entry, so a following Save updates it. */
export function applyMapEntry(model: EditorModel, entry: EditorMapEntry): void {
  const level = entry.level;
  const tiles: EditorTileKind[] = new Array<EditorTileKind>(COLS * ROWS).fill('floor');
  for (const [c, r] of level.walls) tiles[r * COLS + c] = 'wall';
  for (const [c, r] of level.noBuild ?? []) tiles[r * COLS + c] = 'no-build';
  const toggles = (level.toggles ?? []).map((t) => ({ ...t }));
  for (const t of toggles) tiles[t.row * COLS + t.col] = 'shutter';
  model.tiles = tiles;
  model.start = level.starts[0] ?? null;
  model.exit = level.exits[0] ?? null;
  model.toggles = toggles;
  model.name = entry.name;
  model.libraryId = entry.id;
  model.selectedShutter = null;
  model.undoStack = [];
  model.redoStack = [];
}

/**
 * Load the library, newest first. A missing, unparsable or unknown-version store is empty, an entry
 * whose level fails `validateLevel` is dropped, and the result never exceeds `LIBRARY_MAX`.
 */
export function loadLibrary(storage?: StorageLike | null): EditorMapEntry[] {
  const store = storage === undefined ? browserStorage() : storage;
  if (!store) return [];
  try {
    const raw = store.getItem(LIB_KEY);
    if (raw === null) return [];
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return [];
    }
    if (!isObj(data) || data.v !== LIB_VERSION || !Array.isArray(data.maps)) return [];
    const out: EditorMapEntry[] = [];
    for (const m of data.maps) {
      if (!isObj(m)) continue;
      const id = str(m.id);
      const name = str(m.name);
      const savedAt = str(m.savedAt);
      if (id === null || name === null || savedAt === null) continue;
      const level = parseLevel(m.level);
      if (level === null) continue;
      if (validateLevel(level) !== null) continue;
      out.push({ id, name, savedAt, level });
    }
    return out.slice(0, LIBRARY_MAX);
  } catch {
    return [];
  }
}

/** Write the library back, never throwing. */
export function saveLibrary(maps: readonly EditorMapEntry[], storage?: StorageLike | null): void {
  const store = storage === undefined ? browserStorage() : storage;
  try {
    store?.setItem(LIB_KEY, JSON.stringify({ v: LIB_VERSION, maps: maps.slice(0, LIBRARY_MAX) }));
  } catch {
    // Private browsing or quota: the maps simply do not persist.
  }
}
