import {
  createGrid,
  inBounds,
  pointAlongPath,
  tileAt,
  type Grid,
} from './grid.ts';
import { createEnemy, ENEMY_STATS, radiusOf, speedPerTick, type Enemy } from './enemies.ts';
import { createTower, TOWER_STATS, type Tower, type TowerKind } from './towers.ts';
import {
  canAfford,
  createEconomy,
  earn,
  recordKill,
  spend,
  waveClearBonus,
  type DamageSource,
  type Economy,
} from './economy.ts';
import {
  CLICK_SLACK,
  createPointer,
  holdDamagePerTick,
  MAX_POINTER_STAGE,
  nextStageCost,
  pointerInfo,
  RETICLE_STICKY,
  type PointerStage,
  type PointerState,
} from './pointer.ts';
import { buildSchedule, WAVE_COUNT, type Spawn } from './waves.ts';
import { TICK_MS } from './time.ts';

/**
 * The run state and the functions that change it.
 *
 * Everything here is deterministic and side-effect free outside the state object: no clocks, no
 * randomness, no rendering. For speed the reducers mutate the state they are given rather than
 * copying it; "pure" here means the next state depends only on the previous state and the input.
 */

export type Phase = 'build' | 'wave' | 'halted' | 'victory';

export const STARTING_INTEGRITY = 20;

/** One-shot things that happened during a tick; the view drains `events` to spawn effects. */
export type GameEvent =
  | { type: 'kill'; x: number; y: number; reward: number; source: DamageSource }
  | { type: 'leak'; x: number; y: number }
  | { type: 'shot'; towerId: number; x: number; y: number; splash: number }
  | { type: 'click'; x: number; y: number; hit: boolean }
  | { type: 'waveCleared'; wave: number; bonus: number };

export interface RunState {
  readonly grid: Grid;
  phase: Phase;
  /** Last wave started (0 before the first). During 'build' the next wave is wave + 1. */
  wave: number;
  integrity: number;
  economy: Economy;
  pointer: PointerState;
  towers: Tower[];
  enemies: Enemy[];
  /** Tower kind armed for placement, or null. UI selection, but kept here so the sim validates it. */
  selected: TowerKind | null;
  /** Remaining spawns for the current wave, tick-ordered. */
  schedule: Spawn[];
  /** Ticks since the current wave started. */
  waveTick: number;
  /** Total ticks simulated this run. */
  tick: number;
  /** Leftover real time not yet simulated (ms); see step(). */
  accumulator: number;
  nextId: number;
  /** One-shot events produced since the view last drained them. */
  events: GameEvent[];
}

export function createRunState(): RunState {
  return {
    grid: createGrid(),
    phase: 'build',
    wave: 0,
    integrity: STARTING_INTEGRITY,
    economy: createEconomy(),
    pointer: createPointer(),
    towers: [],
    enemies: [],
    selected: null,
    schedule: [],
    waveTick: 0,
    tick: 0,
    accumulator: 0,
    nextId: 1,
    events: [],
  };
}

// ---------------------------------------------------------------------------------------------
// Queries

export function towerAt(s: RunState, col: number, row: number): Tower | undefined {
  return s.towers.find((t) => t.col === col && t.row === row);
}

export function canPlace(s: RunState, kind: TowerKind, col: number, row: number): boolean {
  if (s.phase !== 'build' && s.phase !== 'wave') return false;
  if (!inBounds(col, row) || tileAt(s.grid, col, row) !== 'buildable') return false;
  if (towerAt(s, col, row)) return false;
  return canAfford(s.economy, TOWER_STATS[kind].cost);
}

/** The live enemy under a world point, preferring the one furthest along the lane. */
export function enemyAt(s: RunState, x: number, y: number, slack = CLICK_SLACK): Enemy | undefined {
  let best: Enemy | undefined;
  for (const e of s.enemies) {
    if (e.dead) continue;
    const r = radiusOf(e) + slack;
    if ((e.x - x) ** 2 + (e.y - y) ** 2 <= r * r && (!best || e.dist > best.dist)) best = e;
  }
  return best;
}

export function isFinalWave(s: RunState): boolean {
  return s.wave >= WAVE_COUNT;
}

// ---------------------------------------------------------------------------------------------
// Player actions (reducers)

export function selectTower(s: RunState, kind: TowerKind | null): void {
  s.selected = s.selected === kind ? null : kind;
}

export function placeTower(s: RunState, kind: TowerKind, col: number, row: number): boolean {
  if (!canPlace(s, kind, col, row)) return false;
  spend(s.economy, TOWER_STATS[kind].cost);
  s.towers.push(createTower(s.nextId++, kind, col, row));
  return true;
}

export function startWave(s: RunState): boolean {
  if (s.phase !== 'build' || s.wave >= WAVE_COUNT) return false;
  s.wave += 1;
  s.phase = 'wave';
  s.schedule = buildSchedule(s.wave);
  s.waveTick = 0;
  return true;
}

export function upgradePointer(s: RunState): boolean {
  const cost = nextStageCost(s.pointer);
  if (cost === null || s.phase === 'halted' || !spend(s.economy, cost)) return false;
  s.pointer.stage = Math.min(MAX_POINTER_STAGE, s.pointer.stage + 1) as PointerStage;
  return true;
}

/**
 * Mouse button pressed on the board at a world point. Deals click damage to the enemy under it.
 * Returns true if an enemy was hit (so the input layer knows not to treat it as a build click).
 */
export function pointerDown(s: RunState, x: number, y: number): boolean {
  s.pointer.x = x;
  s.pointer.y = y;
  if (s.phase !== 'wave') return false;
  s.pointer.held = true;
  const target = enemyAt(s, x, y);
  s.events.push({ type: 'click', x, y, hit: !!target });
  if (!target) return false;
  s.pointer.targetId = target.id;
  damageEnemy(s, target, pointerInfo(s.pointer).clickDamage, 'pointer', true);
  return true;
}

export function pointerMove(s: RunState, x: number, y: number): void {
  s.pointer.x = x;
  s.pointer.y = y;
}

export function pointerUp(s: RunState): void {
  s.pointer.held = false;
}

export function cancelSelection(s: RunState): void {
  s.selected = null;
}

// ---------------------------------------------------------------------------------------------
// Simulation

/** Never simulate more than this many ticks per step() call, so a backgrounded tab does not
 *  return to a frozen page while it catches up minutes of game time (the "spiral of death"). */
const MAX_TICKS_PER_STEP = 15;

/**
 * Advance by real elapsed time. Time is banked in the accumulator and spent in whole fixed ticks;
 * the remainder carries over. Returns the interpolation factor (0..1) between the previous and
 * current tick, which the view uses to draw smooth motion without ever touching the sim.
 */
export function step(s: RunState, dtMs: number): number {
  s.accumulator += Math.max(0, dtMs);
  let n = 0;
  while (s.accumulator >= TICK_MS && n < MAX_TICKS_PER_STEP) {
    tick(s);
    s.accumulator -= TICK_MS;
    n++;
  }
  if (n === MAX_TICKS_PER_STEP) s.accumulator = Math.min(s.accumulator, TICK_MS);
  return s.accumulator / TICK_MS;
}

/** One fixed 1/60 s simulation tick. */
export function tick(s: RunState): void {
  s.tick++;
  for (const t of s.towers) if (t.flash > 0) t.flash--;
  if (s.phase !== 'wave') return;

  spawnDue(s);
  moveEnemies(s);
  fireTowers(s);
  applyReticle(s);
  s.enemies = s.enemies.filter((e) => !e.dead);
  if (s.phase !== 'wave') return;
  s.waveTick++;

  if (s.schedule.length === 0 && s.enemies.length === 0) endWave(s);
}

function spawnDue(s: RunState): void {
  while (s.schedule.length > 0 && s.schedule[0].tick <= s.waveTick) {
    const sp = s.schedule.shift()!;
    s.enemies.push(createEnemy(s.nextId++, sp.kind, s.wave, s.grid));
  }
}

function moveEnemies(s: RunState): void {
  for (const e of s.enemies) {
    if (e.dead) continue;
    e.prevX = e.x;
    e.prevY = e.y;
    e.dist += speedPerTick(e.kind);
    if (e.dist >= s.grid.length) {
      leak(s, e);
      continue;
    }
    const p = pointAlongPath(s.grid, e.dist);
    e.x = p.x;
    e.y = p.y;
  }
}

function leak(s: RunState, e: Enemy): void {
  e.dead = true;
  s.integrity = Math.max(0, s.integrity - 1);
  s.events.push({ type: 'leak', x: e.x, y: e.y });
  if (s.pointer.targetId === e.id) s.pointer.targetId = null;
  if (s.integrity === 0) {
    s.phase = 'halted';
    s.pointer.held = false;
  }
}

/** Towers can hurt this enemy right now (shielded enemies are immune until the shield breaks). */
function towerCanHurt(e: Enemy): boolean {
  return !e.dead && e.shield <= 0;
}

function inRange(t: Tower, e: Enemy, range: number): boolean {
  const r = range + radiusOf(e);
  return (e.x - (t.col + 0.5)) ** 2 + (e.y - (t.row + 0.5)) ** 2 <= r * r;
}

function fireTowers(s: RunState): void {
  for (const t of s.towers) {
    if (t.cooldown > 0) {
      t.cooldown--;
      continue;
    }
    const st = TOWER_STATS[t.kind];
    // Target "first": the hurtable enemy furthest along the lane, the one about to leak.
    let target: Enemy | undefined;
    for (const e of s.enemies) {
      if (towerCanHurt(e) && inRange(t, e, st.range) && (!target || e.dist > target.dist)) target = e;
    }
    if (!target) continue;

    t.cooldown = st.fireInterval - 1;
    t.lastTargetId = target.id;
    t.flash = 6;
    s.events.push({ type: 'shot', towerId: t.id, x: target.x, y: target.y, splash: st.splash });

    if (st.splash > 0) {
      const cx = target.x;
      const cy = target.y;
      for (const e of s.enemies) {
        const r = st.splash + radiusOf(e);
        if (towerCanHurt(e) && (e.x - cx) ** 2 + (e.y - cy) ** 2 <= r * r) {
          damageEnemy(s, e, st.damage, 'tower', st.ignoresArmour);
        }
      }
    } else {
      damageEnemy(s, target, st.damage, 'tower', st.ignoresArmour);
    }
  }
}

/** Stage 2+: while the button is held, the reticle burns whatever it is held on. */
function applyReticle(s: RunState): void {
  const p = s.pointer;
  const dpt = holdDamagePerTick(p);
  if (!p.held || dpt <= 0) return;
  let target = s.enemies.find((e) => e.id === p.targetId && !e.dead);
  // Sticky lock: keep the current target while the cursor stays near it, so a fast runner is not
  // dropped by a few pixels of hand lag; otherwise retarget to whatever is under the cursor.
  if (!target || Math.hypot(target.x - p.x, target.y - p.y) > radiusOf(target) + RETICLE_STICKY) {
    target = enemyAt(s, p.x, p.y);
  }
  p.targetId = target ? target.id : null;
  if (target) damageEnemy(s, target, dpt, 'pointer', true);
}

/**
 * Apply damage from a source. Pointer damage wears the shield first and overflows into hp;
 * tower damage is subtracted by armour unless the tower ignores it. Kill attribution is decided
 * here and only here: whoever reduces hp to zero gets the kill.
 */
function damageEnemy(s: RunState, e: Enemy, amount: number, source: DamageSource, ignoresArmour: boolean): void {
  if (e.dead || amount <= 0) return;
  let dmg = amount;
  if (source === 'pointer' && e.shield > 0) {
    const absorbed = Math.min(e.shield, dmg);
    e.shield -= absorbed;
    dmg -= absorbed;
  } else if (source === 'tower') {
    if (e.shield > 0) return;
    if (!ignoresArmour) dmg = Math.max(1, dmg - ENEMY_STATS[e.kind].armour);
  }
  if (dmg <= 0) return;
  e.hp -= dmg;
  if (e.hp <= 1e-9) {
    e.hp = 0;
    e.dead = true;
    const reward = recordKill(s.economy, e.value, source);
    s.events.push({ type: 'kill', x: e.x, y: e.y, reward, source });
    if (s.pointer.targetId === e.id) s.pointer.targetId = null;
  }
}

function endWave(s: RunState): void {
  const bonus = waveClearBonus(s.wave);
  earn(s.economy, bonus);
  s.events.push({ type: 'waveCleared', wave: s.wave, bonus });
  s.pointer.held = false;
  s.pointer.targetId = null;
  s.phase = s.wave >= WAVE_COUNT ? 'victory' : 'build';
}
