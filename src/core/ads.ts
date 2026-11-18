import type { RunState } from './state.ts';
import { earn, recordKill } from './economy.ts';
import { secondsToTicks } from './time.ts';
import { createTower, recomputeAuras } from './towers.ts';
import { COLS, ROWS, tileAt } from './grid.ts';
import { buildField, isSealed } from './pathfield.ts';
import { rngNext } from './rng.ts';

/**
 * Desktop ads: rare timed bonuses that appear on the desktop during a wave and pay when their close
 * box is clicked (docs/design.md §10). Spawn scheduling, selection, placement and effects live here
 * so the sim stays deterministic; the view only draws whatever `s.ad` says.
 *
 * Rules: at most one ad alive; the first attempt comes 8–16 s into the first wave, later attempts
 * every 25–45 s on an absolute clock that keeps running between waves, only during a wave, never
 * within the first 5 s of a wave, and never with fewer than two enemies alive. An attempt whose
 * conditions are unmet retries after 8–12 s. An ad expires after 8 s with no penalty. Blue Screen is
 * a trap that pays nothing and disables a random tower.
 */

export type AdKind = 'defrag' | 'autoupdate' | 'timezone' | 'freeware' | 'screensaver' | 'bluescreen';

export const AD_KINDS: readonly AdKind[] = [
  'defrag',
  'autoupdate',
  'timezone',
  'freeware',
  'screensaver',
  'bluescreen',
];

interface AdSpec {
  readonly title: string;
  readonly message: string;
  readonly weight: number;
}

export const AD_SPECS: Readonly<Record<AdKind, AdSpec>> = {
  defrag: { title: 'Defrag complete', message: 'Close for +8% salvage', weight: 30 },
  autoupdate: { title: 'AutoUpdate', message: 'Close for +40% towers', weight: 20 },
  timezone: { title: 'Time Zone Change', message: 'Close for -50% speed', weight: 15 },
  freeware: { title: 'Freeware', message: 'Close for a free Gun', weight: 15 },
  screensaver: { title: 'Screensaver', message: 'Close for 25 damage', weight: 10 },
  bluescreen: { title: 'Blue Screen', message: 'Close for nothing', weight: 10 },
};

export interface Ad {
  readonly id: number;
  readonly kind: AdKind;
  /** Ticks remaining before it silently vanishes. */
  ttl: number;
  /** Top-left corner of the dialog, chosen at random on the desktop by the sim. */
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ViewportRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Ads live 8 seconds. */
export const AD_LIFETIME_TICKS = secondsToTicks(8);

/** An ad's chrome is the main window's scale: it is a small dialog, not a shrunken one. */
export const AD_W = 176;
export const AD_H = 64;

/** An ad is placed with an 8 px margin from the board field's edges, never over chrome or panels. */
const AD_MARGIN = 8;

const FIRST_ATTEMPT_MIN_S = 8;
const FIRST_ATTEMPT_SPAN_S = 8;
const SPAWN_INTERVAL_MIN_S = 25;
const SPAWN_INTERVAL_SPAN_S = 20;
const RETRY_MIN_S = 8;
const RETRY_SPAN_S = 4;
const WAVE_SETTLE_TICKS = secondsToTicks(5);
const MIN_ENEMIES = 2;

function nextFloat(s: RunState): number {
  const r = rngNext(s.rng);
  s.rng = r.next;
  return r.value;
}

/** A deterministic float in [0, 1) hashed from a seed, without advancing the run's RNG stream.
 *  Ad placement reads the seeded stream so a replay puts the same ad in the same place, but must
 *  not consume `s.rng` — that would shift every later crit roll and change the balance harness. */
function hashUnit(seed: number): number {
  return rngNext(seed | 0).value;
}

function nextFirstAttemptDelayTicks(s: RunState): number {
  return secondsToTicks(FIRST_ATTEMPT_MIN_S + nextFloat(s) * FIRST_ATTEMPT_SPAN_S);
}

function nextAttemptDelayTicks(s: RunState): number {
  return secondsToTicks(SPAWN_INTERVAL_MIN_S + nextFloat(s) * SPAWN_INTERVAL_SPAN_S);
}

function nextRetryDelayTicks(s: RunState): number {
  return secondsToTicks(RETRY_MIN_S + nextFloat(s) * RETRY_SPAN_S);
}

/** The board field — the desktop the ad pops onto — inset 8 px on every side. */
function adRegion(s: RunState): ViewportRect {
  const supplied = s.viewport.boardCol;
  if (supplied) {
    return {
      x: supplied.x + AD_MARGIN,
      y: supplied.y + AD_MARGIN,
      w: supplied.w - AD_MARGIN * 2,
      h: supplied.h - AD_MARGIN * 2,
    };
  }
  const client = s.viewport.client ?? s.viewport.window;
  return {
    x: client.x + AD_MARGIN,
    y: client.y + AD_MARGIN,
    w: client.w - AD_MARGIN * 2,
    h: client.h - AD_MARGIN * 2,
  };
}

function pickKind(s: RunState): AdKind {
  let roll = nextFloat(s) * AD_KINDS.reduce((n, k) => n + AD_SPECS[k].weight, 0);
  for (const kind of AD_KINDS) {
    roll -= AD_SPECS[kind].weight;
    if (roll < 0) return kind;
  }
  return 'defrag';
}

/**
 * Spawn an ad (optionally forcing `kind` for tests). Returns null when one is already alive.
 * The dialog lands at a random spot on the board field, chosen from the seeded stream so the
 * same run always shows the same ad in the same place.
 */
export function spawnAd(s: RunState, kind?: AdKind): Ad | null {
  if (s.ad) return null;
  const k = kind ?? pickKind(s);
  const id = s.nextId;
  const region = adRegion(s);
  const spanX = Math.max(0, region.w - AD_W);
  const spanY = Math.max(0, region.h - AD_H);
  // Hash the run's current RNG state together with the ad id: the position is deterministic for a
  // given seed, differs between ads, and never consumes the stream the sim (and balance) relies on.
  const seed = (s.rng ^ Math.imul(id, 0x9e3779b9)) | 0;
  const ad: Ad = {
    id: s.nextId++,
    kind: k,
    ttl: AD_LIFETIME_TICKS,
    x: region.x + Math.round(hashUnit(seed) * spanX),
    y: region.y + Math.round(hashUnit(seed ^ 0x6d2b79f5) * spanY),
    w: AD_W,
    h: AD_H,
  };
  s.ad = ad;
  s.events.push({ type: 'adSpawned', kind: k });
  return ad;
}

/** Advance ad timers and attempt a spawn. Called once per sim tick. */
export function tickAds(s: RunState): void {
  if (s.towerDamageBuffTicks > 0) s.towerDamageBuffTicks--;
  if (s.enemySlowTicks > 0) s.enemySlowTicks--;
  for (const [id, ticks] of s.towerDisabled) {
    if (ticks <= 1) s.towerDisabled.delete(id);
    else s.towerDisabled.set(id, ticks - 1);
  }

  if (s.ad) {
    s.ad.ttl--;
    if (s.ad.ttl <= 0) {
      s.ad = null;
      s.adsExpired++;
    }
  }

  if (s.nextAdAttemptTick === 0) {
    if (s.phase !== 'wave') return;
    s.nextAdAttemptTick = s.tick + nextFirstAttemptDelayTicks(s);
  }
  if (s.tick < s.nextAdAttemptTick) return;
  if (
    s.phase === 'wave' &&
    !s.ad &&
    s.waveTick >= WAVE_SETTLE_TICKS &&
    s.enemies.length >= MIN_ENEMIES
  ) {
    spawnAd(s);
    s.nextAdAttemptTick = s.tick + nextAttemptDelayTicks(s);
  } else {
    s.nextAdAttemptTick = s.tick + nextRetryDelayTicks(s);
  }
}

/** Dismiss the live ad and apply its effect. Returns whether an ad was dismissed. */
export function dismissAd(s: RunState, id: number): boolean {
  if (!s.ad || s.ad.id !== id) return false;
  const kind = s.ad.kind;
  s.ad = null;
  s.adsDismissed++;
  s.events.push({ type: 'adDismissed', kind });
  applyEffect(s, kind);
  return true;
}

function applyEffect(s: RunState, kind: AdKind): void {
  switch (kind) {
    case 'defrag':
      earn(s.economy, Math.floor(s.economy.salvage * 0.08));
      break;
    case 'autoupdate':
      s.towerDamageBuffTicks = secondsToTicks(10);
      break;
    case 'timezone':
      s.enemySlowTicks = secondsToTicks(6);
      break;
    case 'freeware':
      placeFreeGun(s);
      break;
    case 'screensaver':
      applyScreensaver(s);
      break;
    case 'bluescreen':
      disableRandomTower(s);
      break;
  }
}

/** Freeware: place a free Gun on a random legal tile, respecting the seal rule. */
function placeFreeGun(s: RunState): void {
  const spawn = s.level.starts[0];
  const exit = s.level.exits[0];
  const candidates: { col: number; row: number }[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (tileAt(s.grid, c, r) !== 'buildable') continue;
      const idx = r * COLS + c;
      if (s.blocked.has(idx)) continue;
      s.blocked.add(idx);
      const sealed = isSealed(s.grid, s.blocked, spawn, exit);
      s.blocked.delete(idx);
      if (!sealed) candidates.push({ col: c, row: r });
    }
  }
  if (candidates.length === 0) return;
  const pick = candidates[Math.floor(nextFloat(s) * candidates.length) % candidates.length];
  s.blocked.add(pick.row * COLS + pick.col);
  const tower = createTower(s.nextId++, 'gun', pick.col, pick.row);
  tower.placedTick = s.clock;
  s.towers.push(tower);
  s.field = buildField(s.grid, s.blocked, exit);
  recomputeAuras(s.towers, s.clock);
}

/** Screensaver: every enemy takes 25 flat damage and is stunned for half a second. */
function applyScreensaver(s: RunState): void {
  for (const e of s.enemies) {
    if (e.dead) continue;
    if (e.kind === 'popup') continue; // the window only dies to its close box
    e.stunUntilTick = s.tick + secondsToTicks(0.5);
    e.hp -= 25;
    s.events.push({ type: 'damage', x: e.x, y: e.y, amount: 25, weak: false, id: e.id });
    if (e.hp <= 1e-9) {
      e.hp = 0;
      e.dead = true;
      const reward = recordKill(s.economy, e.value, 'tower');
      s.events.push({ type: 'kill', x: e.x, y: e.y, reward, source: 'tower', kind: e.kind, heading: e.heading });
      if (s.pointer.targetId === e.id) s.pointer.targetId = null;
    }
  }
}

/** Blue Screen: disable a random tower for 3 s and pay nothing. */
function disableRandomTower(s: RunState): void {
  if (s.towers.length === 0) return;
  const t = s.towers[Math.floor(nextFloat(s) * s.towers.length) % s.towers.length];
  s.towerDisabled.set(t.id, secondsToTicks(3));
}
