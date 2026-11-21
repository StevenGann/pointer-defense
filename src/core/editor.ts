import { COLS, ROWS, type Tile } from './grid.ts';
import { levelFingerprint, levelProblemMessage, MAX_TOGGLES, validateLevel, type Level, type LevelToggle } from './levels.ts';
import { t } from '../i18n/index.ts';

/**
 * The map editor's model: the board being drawn, kept side-effect free of any rendering so the smoke
 * harness can drive it directly. The editor produces a `Level` — nothing downstream needs to change.
 *
 * The board is `COLS x ROWS` tiles of `floor`, `wall` or `shutter`. Start and exit are single markers
 * that always sit on a floor tile; painting a second start (or exit) moves the marker. A shutter tile
 * carries a `LevelToggle` with its own period/open/phase timing.
 */

export type EditorTileKind = 'floor' | 'wall' | 'shutter' | 'no-build';

export type EditorTool = 'floor' | 'wall' | 'shutter' | 'no-build' | 'start' | 'exit' | 'eraser';

export const EDITOR_TOOLS: readonly EditorTool[] = ['floor', 'wall', 'shutter', 'no-build', 'start', 'exit', 'eraser'];

export const TOOL_NAMES: Readonly<Record<EditorTool, string>> = {
  floor: 'Floor',
  wall: 'Wall',
  shutter: 'Shutter',
  'no-build': t('shell.editor.tool.noBuild'),
  start: 'Start',
  exit: 'Exit',
  eraser: 'Eraser',
};

/** A new shutter's timing: 15 s cycle, open just under half, in phase (matches the Turnstile gate A). */
export const DEFAULT_SHUTTER: Readonly<Omit<LevelToggle, 'col' | 'row'>> = {
  periodTicks: 900,
  openTicks: 420,
  phaseTicks: 0,
};

const MAX_UNDO = 100;
const UINT16_MAX = 0xffff;

interface EditorSnapshot {
  tiles: EditorTileKind[];
  start: Tile | null;
  exit: Tile | null;
  toggles: LevelToggle[];
}

export interface EditorModel {
  cols: number;
  rows: number;
  tiles: EditorTileKind[];
  start: Tile | null;
  exit: Tile | null;
  /** One per shutter tile, row-major ordered. */
  toggles: LevelToggle[];
  tool: EditorTool;
  /** The shutter whose timing fields are open for editing, or null. */
  selectedShutter: Tile | null;
  undoStack: EditorSnapshot[];
  redoStack: EditorSnapshot[];
  /** The drawing's name, prefilled into a Save name prompt; empty while unnamed. */
  name: string;
  /** The library entry this drawing came from (Save updates it), or null when it is unsaved. */
  libraryId: string | null;
}

export function createEditor(): EditorModel {
  return {
    cols: COLS,
    rows: ROWS,
    tiles: new Array<EditorTileKind>(COLS * ROWS).fill('floor'),
    start: null,
    exit: null,
    toggles: [],
    tool: 'wall',
    selectedShutter: null,
    undoStack: [],
    redoStack: [],
    name: '',
    libraryId: null,
  };
}

/** Whether the drawing is empty: no painted tile, marker, shutter or name. */
export function editorIsEmpty(model: EditorModel): boolean {
  if (model.start !== null || model.exit !== null) return false;
  if (model.toggles.length > 0) return false;
  if (model.name !== '') return false;
  for (const t of model.tiles) if (t !== 'floor') return false;
  return true;
}

export function editorIndex(model: EditorModel, col: number, row: number): number {
  return row * model.cols + col;
}

export function editorInBounds(model: EditorModel, col: number, row: number): boolean {
  return col >= 0 && col < model.cols && row >= 0 && row < model.rows;
}

export function editorTileAt(model: EditorModel, col: number, row: number): EditorTileKind | undefined {
  return editorInBounds(model, col, row) ? model.tiles[editorIndex(model, col, row)] : undefined;
}

/** The authored toggle on a shutter tile, if any. */
export function editorToggleAt(model: EditorModel, col: number, row: number): LevelToggle | undefined {
  return model.toggles.find((t) => t.col === col && t.row === row);
}

function snapshot(model: EditorModel): EditorSnapshot {
  return { tiles: model.tiles.slice(), start: model.start, exit: model.exit, toggles: model.toggles.map((t) => ({ ...t })) };
}

function restore(model: EditorModel, snap: EditorSnapshot): void {
  model.tiles = snap.tiles.slice();
  model.start = snap.start;
  model.exit = snap.exit;
  model.toggles = snap.toggles.map((t) => ({ ...t }));
}

function pushUndo(model: EditorModel): void {
  model.undoStack.push(snapshot(model));
  if (model.undoStack.length > MAX_UNDO) model.undoStack.shift();
  model.redoStack.length = 0;
}

export function undoEditor(model: EditorModel): boolean {
  const snap = model.undoStack.pop();
  if (!snap) return false;
  model.redoStack.push(snapshot(model));
  restore(model, snap);
  return true;
}

export function redoEditor(model: EditorModel): boolean {
  const snap = model.redoStack.pop();
  if (!snap) return false;
  model.undoStack.push(snapshot(model));
  restore(model, snap);
  return true;
}

export function clearEditor(model: EditorModel): void {
  pushUndo(model);
  model.tiles = new Array<EditorTileKind>(model.cols * model.rows).fill('floor');
  model.start = null;
  model.exit = null;
  model.toggles = [];
  model.selectedShutter = null;
}

export function selectEditorTool(model: EditorModel, tool: EditorTool): void {
  model.tool = tool;
  if (tool !== 'shutter') model.selectedShutter = null;
}

/** Clear any marker that sits on a tile being replaced by a wall or shutter. */
function clearMarkersAt(model: EditorModel, col: number, row: number): void {
  if (model.start && model.start.col === col && model.start.row === row) model.start = null;
  if (model.exit && model.exit.col === col && model.exit.row === row) model.exit = null;
}

function setShutter(model: EditorModel, col: number, row: number, remove = false): void {
  model.toggles = model.toggles.filter((t) => t.col !== col || t.row !== row);
  if (!remove) model.toggles.push({ col, row, ...DEFAULT_SHUTTER });
  model.toggles.sort((a, b) => a.row - b.row || a.col - b.col);
}

function shutterCount(model: EditorModel): number {
  return model.toggles.length;
}

/**
 * Paint the currently selected tool onto a tile. Returns a plain refusal reason when the stroke is
 * refused (e.g. an eleventh shutter), or null when it was applied. Start and exit move rather than
 * duplicate; a wall or shutter painted over a marker clears that marker.
 */
export function paintEditor(model: EditorModel, col: number, row: number): string | null {
  if (!editorInBounds(model, col, row)) return 'out of bounds';
  const tool = model.tool;
  const idx = editorIndex(model, col, row);
  const tile = model.tiles[idx];
  const hasToggle = editorToggleAt(model, col, row) !== undefined;
  const markerHere = (model.start !== null && model.start.col === col && model.start.row === row) ||
    (model.exit !== null && model.exit.col === col && model.exit.row === row);

  if (tool === 'start') {
    const exitHere = model.exit?.col === col && model.exit?.row === row;
    if (model.start?.col === col && model.start?.row === row && tile === 'floor' && !hasToggle && !exitHere) return null;
    pushUndo(model);
    model.start = { col, row };
    if (exitHere) model.exit = null;
    // Start must sit on floor: replace whatever occupied the tile.
    model.tiles[idx] = 'floor';
    setShutter(model, col, row, true);
    return null;
  }
  if (tool === 'exit') {
    const startHere = model.start?.col === col && model.start?.row === row;
    if (model.exit?.col === col && model.exit?.row === row && tile === 'floor' && !hasToggle && !startHere) return null;
    pushUndo(model);
    model.exit = { col, row };
    if (startHere) model.start = null;
    model.tiles[idx] = 'floor';
    setShutter(model, col, row, true);
    return null;
  }
  if (tool === 'wall') {
    if (tile === 'wall' && !hasToggle && !markerHere) return null;
    pushUndo(model);
    model.tiles[idx] = 'wall';
    setShutter(model, col, row, true);
    clearMarkersAt(model, col, row);
    return null;
  }
  if (tool === 'shutter') {
    const existing = editorToggleAt(model, col, row);
    if (existing) {
      model.selectedShutter = { col, row };
      return null; // already a shutter: just open its timing fields
    }
    if (shutterCount(model) >= MAX_TOGGLES) return 'too many shutters';
    pushUndo(model);
    model.tiles[idx] = 'shutter';
    setShutter(model, col, row);
    clearMarkersAt(model, col, row);
    model.selectedShutter = { col, row };
    return null;
  }
  if (tool === 'no-build') {
    // Walkable floor the player cannot build on: painted and erased exactly like floor.
    if (tile === 'no-build' && !hasToggle) return null;
    pushUndo(model);
    model.tiles[idx] = 'no-build';
    setShutter(model, col, row, true);
    return null;
  }
  // floor / eraser: buildable floor.
  if (tile === 'floor' && !hasToggle) return null;
  pushUndo(model);
  model.tiles[idx] = 'floor';
  setShutter(model, col, row, true);
  return null;
}

/** Right-click erase: always paints floor and removes any shutter, but leaves the start/exit markers. */
export function eraseEditor(model: EditorModel, col: number, row: number): void {
  if (!editorInBounds(model, col, row)) return;
  const idx = editorIndex(model, col, row);
  if (model.tiles[idx] === 'floor' && editorToggleAt(model, col, row) === undefined) return;
  pushUndo(model);
  model.tiles[idx] = 'floor';
  setShutter(model, col, row, true);
}

/** Edit one timing field of a shutter, clamped to the legal range. Returns null on success. */
export function setEditorToggle(
  model: EditorModel,
  col: number,
  row: number,
  field: 'periodTicks' | 'openTicks' | 'phaseTicks',
  value: number,
): string | null {
  const idx = model.toggles.findIndex((t) => t.col === col && t.row === row);
  if (idx < 0) return 'no shutter on that tile';
  const t = model.toggles[idx];
  if (!Number.isFinite(value)) return 'invalid value';

  const period = field === 'periodTicks' ? Math.max(1, Math.min(UINT16_MAX, Math.round(value))) : t.periodTicks;
  const open =
    field === 'openTicks'
      ? Math.max(0, Math.min(t.periodTicks, Math.round(value)))
      : Math.min(t.openTicks, period);
  const phase = field === 'phaseTicks' ? Math.max(0, Math.min(UINT16_MAX, Math.round(value))) : t.phaseTicks;

  if (period === t.periodTicks && open === t.openTicks && phase === t.phaseTicks) return null;
  pushUndo(model);
  model.toggles[idx] = { col, row, periodTicks: period, openTicks: open, phaseTicks: phase };
  return null;
}

/** The first validation problem in the current drawing, or null when the map is legal. */
export function editorValidation(model: EditorModel): string | null {
  if (!model.start) return 'place a start tile';
  if (!model.exit) return 'place an exit tile';
  const reason = validateLevel(editorLevel(model));
  return reason === null ? null : levelProblemMessage(reason);
}

/** The level the drawing describes. Call only once a start and exit exist. */
export function editorLevel(model: EditorModel): Level {
  const walls: (readonly [number, number])[] = [];
  const noBuild: (readonly [number, number])[] = [];
  for (let row = 0; row < model.rows; row++) {
    for (let col = 0; col < model.cols; col++) {
      const kind = model.tiles[editorIndex(model, col, row)];
      if (kind === 'wall') walls.push([col, row]);
      else if (kind === 'no-build') noBuild.push([col, row]);
    }
  }
  const toggles = model.toggles.map((t) => ({ ...t }));
  const starts: Tile[] = model.start ? [model.start] : [];
  const exits: Tile[] = model.exit ? [model.exit] : [];
  const level: Level = { id: '', name: model.name, walls, noBuild, starts, exits, toggles };
  return { ...level, id: levelFingerprint(level) };
}

/** Whether the drawing is currently playable (a route exists through floor and open shutters). */
export function editorPlayable(model: EditorModel): boolean {
  return editorValidation(model) === null;
}
