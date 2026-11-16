import type { RunState } from './state.ts';
import { earn, recordKill } from './economy.ts';
import { secondsToTicks } from './time.ts';
import { createTower, recomputeAuras } from './towers.ts';
import { COLS, EXIT, ROWS, SPAWN, tileAt } from './grid.ts';
import { buildField, isSealed } from './pathfield.ts';
import { rngNext } from './rng.ts';

/**
 * Desktop pop-ups: rare timed bonuses that appear on the desktop during a wave and pay when their
 * close box is clicked (docs/design.md §10). Spawn scheduling, selection and effects live here so
 * the sim stays deterministic; the view only draws whatever `s.popup` says.
 *
 * Rules: at most one pop-up alive; an attempt every 45–75 s, during a wave only, never within the
 * first 20 s of a wave, and never with fewer than three enemies alive. A pop-up expires after 8 s
 * with no penalty. Blue Screen is a trap that pays nothing and disables a random tower.
 */

export type PopupKind = 'defrag' | 'autoupdate' | 'timezone' | 'freeware' | 'screensaver' | 'bluescreen';

export const POPUP_KINDS: readonly PopupKind[] = [
  'defrag',
  'autoupdate',
  'timezone',
  'freeware',
  'screensaver',
  'bluescreen',
];

interface PopupSpec {
  readonly title: string;
  readonly message: string;
  readonly weight: number;
}

export const POPUP_SPECS: Readonly<Record<PopupKind, PopupSpec>> = {
  defrag: { title: 'Defrag complete', message: '+8% salvage', weight: 30 },
  autoupdate: { title: 'AutoUpdate', message: 'Towers +40% for 10s', weight: 20 },
  timezone: { title: 'Time Zone Change', message: 'Enemies -50% for 6s', weight: 15 },
  freeware: { title: 'Freeware', message: 'A free Gun appears', weight: 15 },
  screensaver: { title: 'Screensaver', message: 'All enemies take 25', weight: 10 },
  bluescreen: { title: 'Blue Screen', message: 'The system is busy', weight: 10 },
};

export interface Popup {
  readonly id: number;
  readonly kind: PopupKind;
  /** Ticks remaining before it silently vanishes. */
  ttl: number;
  /** Top-left corner on the desktop, snapped to an 8px grid. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Pop-ups live 8 seconds. */
export const POPUP_LIFETIME_TICKS = secondsToTicks(8);

/** Pop-ups sit in the desktop margin around the window; the dialog is sized to fit the 24px band. */
export const POPUP_W = 176;
export const POPUP_H = 24;

const SPAWN_INTERVAL_MIN_S = 45;
const SPAWN_INTERVAL_SPAN_S = 30;
const WAVE_SETTLE_TICKS = secondsToTicks(20);
const MIN_ENEMIES = 3;
const SNAP = 8;

function nextFloat(s: RunState): number {
  const r = rngNext(s.rng);
  s.rng = r.next;
  return r.value;
}

function nextAttemptDelayTicks(s: RunState): number {
  return secondsToTicks(SPAWN_INTERVAL_MIN_S + nextFloat(s) * SPAWN_INTERVAL_SPAN_S);
}

function pickKind(s: RunState): PopupKind {
  let roll = nextFloat(s) * POPUP_KINDS.reduce((n, k) => n + POPUP_SPECS[k].weight, 0);
  for (const kind of POPUP_KINDS) {
    roll -= POPUP_SPECS[kind].weight;
    if (roll < 0) return kind;
  }
  return 'defrag';
}

/**
 * Spawn a pop-up (optionally forcing `kind` for tests). Returns null when one is already alive.
 * The position is snapped to an 8px grid in the desktop margin above or below the window, never
 * overlapping the window rect.
 */
export function spawnPopup(s: RunState, kind?: PopupKind): Popup | null {
  if (s.popup) return null;
  const k = kind ?? pickKind(s);
  const popup: Popup = { id: s.nextId++, kind: k, ttl: POPUP_LIFETIME_TICKS, x: 0, y: 0, w: POPUP_W, h: POPUP_H };
  const vw = s.viewport.width;
  const margin = s.viewport.window.y; // desktop band around the window
  const slots = Math.max(1, Math.floor((vw - POPUP_W) / SNAP));
  popup.x = Math.min(vw - POPUP_W, Math.floor(nextFloat(s) * slots) * SNAP);
  popup.y = nextFloat(s) < 0.5 ? 0 : s.viewport.height - margin;
  s.popup = popup;
  return popup;
}

/** Advance pop-up timers and attempt a spawn. Called once per sim tick. */
export function tickPopups(s: RunState): void {
  if (s.towerDamageBuffTicks > 0) s.towerDamageBuffTicks--;
  if (s.enemySlowTicks > 0) s.enemySlowTicks--;
  for (const [id, ticks] of s.towerDisabled) {
    if (ticks <= 1) s.towerDisabled.delete(id);
    else s.towerDisabled.set(id, ticks - 1);
  }

  if (s.popup) {
    s.popup.ttl--;
    if (s.popup.ttl <= 0) s.popup = null;
  }

  if (s.phase !== 'wave') return;
  if (s.nextPopupAttemptTick === 0) {
    s.nextPopupAttemptTick = s.tick + nextAttemptDelayTicks(s);
  }
  if (s.tick < s.nextPopupAttemptTick) return;
  if (!s.popup && s.waveTick >= WAVE_SETTLE_TICKS && s.enemies.length >= MIN_ENEMIES) {
    spawnPopup(s);
  }
  s.nextPopupAttemptTick = s.tick + nextAttemptDelayTicks(s);
}

/** Dismiss the live pop-up and apply its effect. Returns whether a pop-up was dismissed. */
export function dismissPopup(s: RunState, id: number): boolean {
  if (!s.popup || s.popup.id !== id) return false;
  const kind = s.popup.kind;
  s.popup = null;
  applyEffect(s, kind);
  return true;
}

function applyEffect(s: RunState, kind: PopupKind): void {
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
  const candidates: { col: number; row: number }[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (tileAt(s.grid, c, r) !== 'buildable') continue;
      const idx = r * COLS + c;
      if (s.blocked.has(idx)) continue;
      s.blocked.add(idx);
      const sealed = isSealed(s.grid, s.blocked, SPAWN, EXIT);
      s.blocked.delete(idx);
      if (!sealed) candidates.push({ col: c, row: r });
    }
  }
  if (candidates.length === 0) return;
  const pick = candidates[Math.floor(nextFloat(s) * candidates.length) % candidates.length];
  s.blocked.add(pick.row * COLS + pick.col);
  s.towers.push(createTower(s.nextId++, 'gun', pick.col, pick.row));
  s.field = buildField(s.grid, s.blocked);
  recomputeAuras(s.towers);
}

/** Screensaver: every enemy takes 25 flat damage and is stunned for half a second. */
function applyScreensaver(s: RunState): void {
  for (const e of s.enemies) {
    if (e.dead) continue;
    e.stunUntilTick = s.tick + secondsToTicks(0.5);
    e.hp -= 25;
    s.events.push({ type: 'damage', x: e.x, y: e.y, amount: 25, weak: false });
    if (e.hp <= 1e-9) {
      e.hp = 0;
      e.dead = true;
      const reward = recordKill(s.economy, e.value, 'tower');
      s.events.push({ type: 'kill', x: e.x, y: e.y, reward, source: 'tower' });
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
