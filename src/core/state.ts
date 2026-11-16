import {
  createGrid,
  EXIT,
  inBounds,
  SPAWN,
  tileAt,
  type Grid,
  type Tile,
} from './grid.ts';
import { buildField, isSealed, pathTiles, stepToward } from './pathfield.ts';
import { createEnemy, ENEMY_STATS, radiusOf, speedPerTick, type Enemy } from './enemies.ts';
import {
  createTower,
  effectiveStats,
  TOWER_STATS,
  upgradeCost,
  type Branch,
  type EffectiveStats,
  type Tier,
  type Tower,
  type TowerKind,
} from './towers.ts';
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
  /** Distance-in-tiles to the exit for every walkable, unblocked tile; -1 unreachable. */
  field: Int32Array;
  /** Tower tiles (blocked for pathing), by index row * COLS + col. */
  blocked: Set<number>;
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
  const grid = createGrid();
  const blocked = new Set<number>();
  return {
    grid,
    field: buildField(grid, blocked),
    blocked,
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
  if (!canAfford(s.economy, TOWER_STATS[kind].cost)) return false;
  const idx = row * s.grid.cols + col;
  s.blocked.add(idx);
  const sealed = isSealed(s.grid, s.blocked, SPAWN, EXIT);
  s.blocked.delete(idx);
  return !sealed;
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
  s.blocked.add(row * s.grid.cols + col);
  s.towers.push(createTower(s.nextId++, kind, col, row));
  rebuildField(s);
  recomputeAuras(s);
  return true;
}

/** The route creeps will take right now, for drawing. */
export function currentPath(s: RunState): Tile[] {
  return pathTiles(s.field, SPAWN);
}

function rebuildField(s: RunState): void {
  s.field = buildField(s.grid, s.blocked);
}

function recomputeAuras(s: RunState): void {
  for (const t of s.towers) {
    t.auraDamage = 1;
    t.auraRange = 0;
  }
  for (const b of s.towers) {
    const st = effectiveStats(b);
    if (st.auraDamage <= 0 && st.auraRange <= 0) continue;
    const r = st.range;
    for (const t of s.towers) {
      if (t.id === b.id) continue;
      const d2 = (t.col + 0.5 - (b.col + 0.5)) ** 2 + (t.row + 0.5 - (b.row + 0.5)) ** 2;
      if (d2 <= r * r) {
        t.auraDamage *= 1 + st.auraDamage;
        t.auraRange += st.auraRange;
      }
    }
  }
}

export function upgradeTower(s: RunState, col: number, row: number): boolean {
  if (s.phase === 'halted' || s.phase === 'victory') return false;
  const t = towerAt(s, col, row);
  if (!t || t.tier === 2) return false; // 2 -> 3 is chooseBranch's job
  const cost = upgradeCost(t);
  if (cost === null) return false;
  if (!spend(s.economy, cost)) return false;
  t.tier = (t.tier + 1) as Tier;
  t.spent += cost;
  recomputeAuras(s);
  return true;
}

export function chooseBranch(s: RunState, col: number, row: number, branch: Branch): boolean {
  if (s.phase === 'halted' || s.phase === 'victory') return false;
  const t = towerAt(s, col, row);
  if (!t || t.tier !== 2 || t.branch !== null) return false;
  const cost = upgradeCost(t);
  if (cost === null) return false;
  if (!spend(s.economy, cost)) return false;
  t.branch = branch;
  t.tier = 3;
  t.spent += cost;
  recomputeAuras(s);
  return true;
}

export function sellTower(s: RunState, col: number, row: number): boolean {
  const t = towerAt(s, col, row);
  if (!t) return false;
  const refund = Math.floor(t.spent * 0.7);
  s.towers = s.towers.filter((x) => x.id !== t.id);
  s.blocked.delete(row * s.grid.cols + col);
  s.economy.salvage += refund;
  rebuildField(s);
  recomputeAuras(s);
  return true;
}

export function startWave(s: RunState): boolean {
  if (s.phase !== 'build' || s.wave >= WAVE_COUNT) return false;
  s.wave += 1;
  s.phase = 'wave';
  s.schedule = buildSchedule(s.wave);
  s.waveTick = 0;
  recomputeAuras(s);
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
function relayPointerBonus(s: RunState, x: number, y: number): { damage: number; slack: number } {
  let damage = 1;
  let slack = 0;
  for (const t of s.towers) {
    if (t.kind !== 'beacon' || t.branch !== 'B') continue;
    const st = effectiveStats(t);
    const r = st.range;
    if ((x - (t.col + 0.5)) ** 2 + (y - (t.row + 0.5)) ** 2 <= r * r) {
      damage += st.auraPointerDamage;
      slack += st.auraPointerRange;
    }
  }
  return { damage, slack };
}

export function pointerDown(s: RunState, x: number, y: number): boolean {
  s.pointer.x = x;
  s.pointer.y = y;
  if (s.phase !== 'wave') return false;
  s.pointer.held = true;
  const relay = relayPointerBonus(s, x, y);
  const target = enemyAt(s, x, y, CLICK_SLACK + relay.slack);
  s.events.push({ type: 'click', x, y, hit: !!target });
  if (!target) return false;
  s.pointer.targetId = target.id;
  damageEnemy(s, target, pointerInfo(s.pointer).clickDamage * relay.damage, 'pointer', true);
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
    s.enemies.push(createEnemy(s.nextId++, sp.kind, s.wave, SPAWN, EXIT));
  }
}

function moveEnemies(s: RunState): void {
  for (const e of s.enemies) {
    if (e.dead) continue;
    e.prevX = e.x;
    e.prevY = e.y;
    const slow = s.tick < e.slowUntilTick ? e.slowFactor : 1;
    let remaining = speedPerTick(e.kind) * slow;
    while (remaining > 0 && !e.dead) {
      if (e.targetCol < 0) {
        const next = stepToward(s.field, e.col, e.row);
        if (!next) break;
        e.targetCol = next.col;
        e.targetRow = next.row;
      }
      const tx = e.targetCol + 0.5;
      const ty = e.targetRow + 0.5;
      const dx = tx - e.x;
      const dy = ty - e.y;
      const d = Math.hypot(dx, dy);
      if (d <= remaining) {
        e.x = tx;
        e.y = ty;
        e.dist += d;
        remaining -= d;
        e.col = e.targetCol;
        e.row = e.targetRow;
        if (e.col === EXIT.col && e.row === EXIT.row) {
          leak(s, e);
          break;
        }
        e.targetCol = -1;
        e.targetRow = -1;
      } else {
        e.x += (dx / d) * remaining;
        e.y += (dy / d) * remaining;
        e.dist += remaining;
        remaining = 0;
      }
    }
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

function intervalTicks(fireInterval: number): number {
  return Math.max(1, Math.round(fireInterval));
}

function dist2(e: Enemy, x: number, y: number): number {
  return (e.x - x) ** 2 + (e.y - y) ** 2;
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = 0;
  if (len2 > 0) t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Target "first": the hurtable enemy furthest along the lane, the one about to leak. */
function acquireTarget(s: RunState, t: Tower, st: EffectiveStats, range: number): Enemy | undefined {
  let target: Enemy | undefined;
  for (const e of s.enemies) {
    if (!towerCanHurt(e)) continue;
    if (st.targetsFlyersOnly && e.kind !== 'flyer') continue;
    if (!inRange(t, e, range)) continue;
    if (!target || e.dist > target.dist) target = e;
  }
  return target;
}

/** Up to `limit` targets, most-threatened first (furthest along the lane). */
function acquireTargets(s: RunState, t: Tower, st: EffectiveStats, range: number, limit: number): Enemy[] {
  const out: Enemy[] = [];
  for (const e of s.enemies) {
    if (!towerCanHurt(e)) continue;
    if (st.targetsFlyersOnly && e.kind !== 'flyer') continue;
    if (!inRange(t, e, range)) continue;
    out.push(e);
  }
  out.sort((a, b) => b.dist - a.dist);
  return out.slice(0, limit);
}

function perEnemyDamage(st: EffectiveStats, e: Enemy, dmg: number): number {
  let d = dmg;
  if (e.kind === 'flyer') d *= st.flyerDamageMult;
  if (e.kind === 'shielded') d *= st.shieldedDamageMult;
  return d;
}

function applySlow(s: RunState, e: Enemy, factor: number, ticks: number): void {
  if (!(s.tick < e.slowUntilTick) || factor < e.slowFactor) e.slowFactor = factor;
  e.slowUntilTick = s.tick + ticks;
}

function hitEnemy(s: RunState, st: EffectiveStats, e: Enemy, dmg: number): void {
  damageEnemy(s, e, perEnemyDamage(st, e, dmg), 'tower', st.ignoresArmour);
  if (st.slowFactor < 1 && st.slowTicks > 0 && !e.dead) applySlow(s, e, st.slowFactor, st.slowTicks);
}

function fireSplash(s: RunState, st: EffectiveStats, target: Enemy, dmg: number): void {
  const cx = target.x;
  const cy = target.y;
  for (const e of s.enemies) {
    if (!towerCanHurt(e)) continue;
    if (st.targetsFlyersOnly && e.kind !== 'flyer') continue;
    const r = st.splash + radiusOf(e);
    if ((e.x - cx) ** 2 + (e.y - cy) ** 2 <= r * r) hitEnemy(s, st, e, dmg);
  }
}

function fireChain(s: RunState, st: EffectiveStats, target: Enemy, dmg: number): void {
  hitEnemy(s, st, target, dmg);
  const hitIds = new Set<number>([target.id]);
  let prev = target;
  for (let i = 1; i < st.chainCount; i++) {
    let next: Enemy | undefined;
    let best = Infinity;
    for (const e of s.enemies) {
      if (!towerCanHurt(e) || hitIds.has(e.id)) continue;
      if (st.targetsFlyersOnly && e.kind !== 'flyer') continue;
      const d2 = (e.x - prev.x) ** 2 + (e.y - prev.y) ** 2;
      if (d2 <= 1.5 * 1.5 && d2 < best) {
        best = d2;
        next = e;
      }
    }
    if (!next) break;
    hitIds.add(next.id);
    hitEnemy(s, st, next, dmg * st.chainDamage);
    prev = next;
  }
}

function fireBeam(s: RunState, t: Tower, st: EffectiveStats, target: Enemy, dmg: number): void {
  const ox = t.col + 0.5;
  const oy = t.row + 0.5;
  const hits: Enemy[] = [];
  for (const e of s.enemies) {
    if (!towerCanHurt(e)) continue;
    if (st.targetsFlyersOnly && e.kind !== 'flyer') continue;
    if (distanceToSegment(e.x, e.y, ox, oy, target.x, target.y) > 0.35) continue;
    hits.push(e);
  }
  hits.sort((a, b) => dist2(a, ox, oy) - dist2(b, ox, oy));
  const n = Math.min(st.pierce, hits.length);
  for (let i = 0; i < n; i++) hitEnemy(s, st, hits[i], dmg);
}

function fireTowers(s: RunState): void {
  for (const t of s.towers) {
    if (t.cooldown > 0) {
      t.cooldown--;
      continue;
    }
    const st = effectiveStats(t);
    if (st.damage <= 0 || st.fireInterval <= 0) continue; // beacon never fires
    const range = st.range + t.auraRange;
    const dmg = st.damage * t.auraDamage;

    if (st.beams > 1) {
      const targets = acquireTargets(s, t, st, range, st.beams);
      if (targets.length === 0) continue;
      t.cooldown = intervalTicks(st.fireInterval) - 1;
      t.lastTargetId = targets[0].id;
      t.flash = 6;
      for (const tg of targets) {
        s.events.push({ type: 'shot', towerId: t.id, x: tg.x, y: tg.y, splash: st.splash });
        fireBeam(s, t, st, tg, dmg * st.beamDamage);
      }
      continue;
    }

    const target = acquireTarget(s, t, st, range);
    if (!target) continue;
    t.cooldown = intervalTicks(st.fireInterval) - 1;
    t.lastTargetId = target.id;
    t.flash = 6;
    s.events.push({ type: 'shot', towerId: t.id, x: target.x, y: target.y, splash: st.splash });

    if (st.pierce > 1) fireBeam(s, t, st, target, dmg);
    else if (st.chainCount > 0) fireChain(s, st, target, dmg);
    else if (st.splash > 0) fireSplash(s, st, target, dmg);
    else hitEnemy(s, st, target, dmg);
  }
}

/** Stage 2+: while the button is held, the reticle burns whatever it is held on. */
function applyReticle(s: RunState): void {
  const p = s.pointer;
  const dpt = holdDamagePerTick(p);
  if (!p.held || dpt <= 0) return;
  const relay = relayPointerBonus(s, p.x, p.y);
  let target = s.enemies.find((e) => e.id === p.targetId && !e.dead);
  // Sticky lock: keep the current target while the cursor stays near it, so a fast runner is not
  // dropped by a few pixels of hand lag; otherwise retarget to whatever is under the cursor.
  if (!target || Math.hypot(target.x - p.x, target.y - p.y) > radiusOf(target) + RETICLE_STICKY) {
    target = enemyAt(s, p.x, p.y, CLICK_SLACK + relay.slack);
  }
  p.targetId = target ? target.id : null;
  if (target) damageEnemy(s, target, dpt * relay.damage, 'pointer', true);
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
