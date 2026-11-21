import { COLS, ROWS, type Tile } from './grid.ts';
import { levelFingerprint, levelProblemMessage, MAX_TOGGLES, validateLevel, type Level, type LevelToggle } from './levels.ts';

/**
 * The `PD2.` share code: a map serialised into a string a person can paste into a chat message.
 *
 * A code is `PD2.` followed by the base64url of a byte string, no padding. The byte layout is the
 * contract (docs/design.md §20); every field is little-endian where it has a width:
 *
 *   0          version (uint8) = 2
 *   1          cols    (uint8)
 *   2          rows    (uint8)
 *   3..        bitfield: 2 bits per tile, 4 tiles per byte, row-major, low bits first
 *              (0 floor, 1 wall, 2 shutter, 3 no-build)
 *   then       start col, row (uint16 each, LE)
 *   then       exit  col, row (uint16 each, LE)
 *   then       shutter count (uint8), then per shutter:
 *              col, row, periodTicks, openTicks, phaseTicks (uint16 each, LE)
 *   then       name length (uint8), then the UTF-8 bytes (printable, at most 24 bytes)
 *   last       checksum (uint8): sum of all preceding bytes mod 251
 *
 * The code is the transport: there is no server, and a bad code is refused with a plain message, never
 * a parse error. Decoding a version other than 2 fails with a version message, not a crash.
 */

export const CODEC_VERSION = 2;
export const CODEC_PREFIX = 'PD2.';
export const CODEC_NAME_MAX_BYTES = 24;
const CHECKSUM_MOD = 251;

export type DecodeResult = { ok: true; level: Level } | { ok: false; reason: string };

/** A bitfield tile value. */
type EncodedTile = 0 | 1 | 2 | 3;

function tileValueAt(level: Level, idx: number): EncodedTile {
  const col = idx % COLS;
  const row = (idx - col) / COLS;
  const wall = level.walls.some(([c, r]) => c === col && r === row);
  if (wall) return 1;
  const noBuild = (level.noBuild ?? []).some(([c, r]) => c === col && r === row);
  if (noBuild) return 3;
  const toggle = (level.toggles ?? []).some((t) => t.col === col && t.row === row);
  return toggle ? 2 : 0;
}

function pushUint16(bytes: number[], v: number): void {
  bytes.push(v & 0xff, (v >>> 8) & 0xff);
}

/** Keep only printable ASCII and cap the byte length; a name is a convenience, never a rejection. */
function sanitizeName(name: string): string {
  let out = '';
  for (const ch of name) {
    const c = ch.codePointAt(0)!;
    if (c >= 0x20 && c <= 0x7e) out += ch;
  }
  return out.slice(0, CODEC_NAME_MAX_BYTES);
}

function encodeBase64Url(bytes: number[]): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin);
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(s: string): number[] | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (b64.length % 4)) % 4;
  let bin: string;
  try {
    bin = atob(b64 + '='.repeat(pad));
  } catch {
    return null;
  }
  const out = new Array<number>(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** The bytes a level serialises to, before the checksum byte. */
export function encodeBytes(level: Level): number[] {
  const bytes: number[] = [];
  bytes.push(CODEC_VERSION, COLS, ROWS);

  // Bitfield: 4 tiles per byte, low 2 bits first.
  const n = COLS * ROWS;
  for (let base = 0; base < n; base += 4) {
    let b = 0;
    for (let i = 0; i < 4 && base + i < n; i++) b |= tileValueAt(level, base + i) << (i * 2);
    bytes.push(b);
  }

  const start = level.starts[0];
  const exit = level.exits[0];
  pushUint16(bytes, start.col);
  pushUint16(bytes, start.row);
  pushUint16(bytes, exit.col);
  pushUint16(bytes, exit.row);

  const toggles = level.toggles ?? [];
  bytes.push(toggles.length);
  for (const t of toggles) {
    pushUint16(bytes, t.col);
    pushUint16(bytes, t.row);
    pushUint16(bytes, t.periodTicks);
    pushUint16(bytes, t.openTicks);
    pushUint16(bytes, t.phaseTicks);
  }

  const name = sanitizeName(level.name);
  bytes.push(name.length);
  for (let i = 0; i < name.length; i++) bytes.push(name.charCodeAt(i) & 0xff);

  return bytes;
}

/** Turn a level into a share code string, `PD2.` prefix included. */
export function encodeLevel(level: Level): string {
  const bytes = encodeBytes(level);
  let sum = 0;
  for (const b of bytes) sum += b;
  bytes.push(sum % CHECKSUM_MOD);
  return CODEC_PREFIX + encodeBase64Url(bytes);
}

function fail(reason: string): DecodeResult {
  return { ok: false, reason };
}

/**
 * Decode a share code. Never throws: every bad input is mapped to a plain reason string suitable for
 * the load-code dialog's status line.
 */
export function decodeCode(code: string): DecodeResult {
  if (code.startsWith('PD1.')) return fail('that code is from an older version');
  if (!code.startsWith(CODEC_PREFIX)) return fail('that code is not a valid share code');
  const bytes = decodeBase64Url(code.slice(CODEC_PREFIX.length));
  if (bytes === null || bytes.length === 0) return fail('that code is incomplete');

  // Checksum first: a truncated paste fails here before anything is read into a level.
  let sum = 0;
  for (let i = 0; i < bytes.length - 1; i++) sum += bytes[i];
  if (bytes[bytes.length - 1] !== sum % CHECKSUM_MOD) return fail('that code is incomplete');

  const body = bytes.slice(0, bytes.length - 1);
  if (body.length < 3) return fail('that code is incomplete');
  const version = body[0];
  if (version < CODEC_VERSION) return fail('that code is from an older version');
  if (version > CODEC_VERSION) return fail('that code is from a newer version');

  const cols = body[1];
  const rows = body[2];
  if (cols !== COLS || rows !== ROWS) return fail('that code is from a newer version');

  const n = cols * rows;
  const bitBytes = Math.ceil(n / 4);
  if (body.length < 3 + bitBytes) return fail('that code is incomplete');
  const tiles: EncodedTile[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const b = body[3 + (i >> 2)];
    const v = (b >> ((i & 3) * 2)) & 3;
    tiles[i] = v as EncodedTile;
  }

  let p = 3 + bitBytes;
  const read16 = (): number => {
    const v = body[p] | (body[p + 1] << 8);
    p += 2;
    return v;
  };
  if (body.length < p + 8) return fail('that code is incomplete');
  const startCol = read16();
  const startRow = read16();
  const exitCol = read16();
  const exitRow = read16();
  const start: Tile = { col: startCol, row: startRow };
  const exit: Tile = { col: exitCol, row: exitRow };
  if (startCol >= cols || startRow >= rows || exitCol >= cols || exitRow >= rows) {
    return fail('no route from start to exit');
  }

  if (body.length < p + 1) return fail('that code is incomplete');
  const count = body[p++];
  if (count > MAX_TOGGLES) return fail('too many shutters');
  const toggles: LevelToggle[] = [];
  const shutterSet = new Set<number>();
  for (let i = 0; i < count; i++) {
    if (body.length < p + 10) return fail('that code is incomplete');
    const col = read16();
    const row = read16();
    const periodTicks = read16();
    const openTicks = read16();
    const phaseTicks = read16();
    if (col >= cols || row >= rows) return fail('a shutter is out of bounds');
    const idx = row * cols + col;
    if (tiles[idx] !== 2) return fail('a shutter is misplaced');
    if (shutterSet.has(idx)) return fail('a shutter is listed twice');
    shutterSet.add(idx);
    toggles.push({ col, row, periodTicks, openTicks, phaseTicks });
  }
  // Every bitfield shutter tile must appear in the table.
  for (let i = 0; i < n; i++) {
    if (tiles[i] === 2 && !shutterSet.has(i)) return fail('a shutter is misplaced');
  }

  if (body.length < p + 1) return fail('that code is incomplete');
  const nameLen = body[p++];
  if (nameLen > CODEC_NAME_MAX_BYTES || body.length < p + nameLen) return fail('that code is incomplete');
  let name = '';
  for (let i = 0; i < nameLen; i++) name += String.fromCharCode(body[p + i]);
  name = sanitizeName(name);

  const walls: (readonly [number, number])[] = [];
  const noBuild: (readonly [number, number])[] = [];
  for (let i = 0; i < n; i++) {
    if (tiles[i] === 1) walls.push([i % cols, (i - (i % cols)) / cols]);
    else if (tiles[i] === 3) noBuild.push([i % cols, (i - (i % cols)) / cols]);
  }

  const level: Level = {
    id: levelFingerprint({ id: '', name, walls, starts: [start], exits: [exit], toggles, noBuild }),
    name,
    walls,
    noBuild,
    starts: [start],
    exits: [exit],
    toggles,
  };

  const reason = validateLevel(level);
  if (reason !== null) return fail(levelProblemMessage(reason));

  return { ok: true, level };
}
