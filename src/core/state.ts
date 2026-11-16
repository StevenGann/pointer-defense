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
import { createEnemy, ENEMY_STATS, isWeakPointHit, radiusOf, speedPerTick, type Enemy } from './enemies.ts';
import {
  createTower,
  effectiveStats,
  recomputeAuras,
  TOWER_STATS,
  sellValue,
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
  recordKillAt,
  spend,
  STARTING_SALVAGE,
  WEAK_POINT_KILL_BONUS,
  waveClearBonus,
  type DamageSource,
  type Economy,
} from './economy.ts';
import {
  CLICK_SLACK,
  COMBO_TICKS,
  comboMultiplier,
  createPointer,
  holdDamagePerTick,
  MAX_POINTER_STAGE,
  nextStageCost,
  pointerInfo,
  RETICLE_STICKY,
  type PointerStage,
  type PointerState,
} from './pointer.ts';
import {
  buildSchedule,
  noBuildRow,
  WAVE_COUNT,
  waveModifiers,
  type ModifierId,
  type Spawn,
} from './waves.ts';
import { tickPopups, type Popup } from './popups.ts';
import { TICK_MS } from './time.ts';
import {
  cloneProfile,
  defaultProfile,
  specGain,
  SPEC_CAPS,
  totalSpecs,
  type Profile,
  type SpecKind,
  type SpecLevels,
} from './save.ts';

/**
 * The run state and the functions that change it.
 *
 * Everything here is deterministic and side-effect free outside the state object: no clocks, no
 * randomness, no rendering. For speed the reducers mutate the state they are given rather than
 * copying it; "pure" here means the next state depends only on the previous state and the input.
 */

export type Phase = 'build' | 'wave' | 'halted' | 'victory';

export const STARTING_INTEGRITY = 20;

/** Bonus per RAM spec point, and the per-point damage/pointer multipliers (docs/design.md §12). */
export const RAM_SALVAGE_PER_POINT = 5;
const SPEC_DAMAGE_PCT_PER_POINT = 0.02;

export function towerDamageMult(specs: SpecLevels): number {
  return 1 + SPEC_DAMAGE_PCT_PER_POINT * specs.cpu;
}

export function pointerDamageMult(specs: SpecLevels): number {
  return 1 + SPEC_DAMAGE_PCT_PER_POINT * specs.gpu;
}

/** One-shot things that happened during a tick; the view drains `events` to spawn effects. */
export type GameEvent =
  | { type: 'kill'; x: number; y: number; reward: number; source: DamageSource }
  | { type: 'leak'; x: number; y: number }
  | { type: 'shot'; towerId: number; x: number; y: number; splash: number }
  | { type: 'click'; x: number; y: number; hit: boolean }
  | { type: 'damage'; x: number; y: number; amount: number; weak: boolean }
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
  /** Placed tower selected for inspection, or null. Mutually exclusive with `selected`. */
  selectedTowerId: number | null;
  /** Remaining spawns for the current wave, tick-ordered. */
  schedule: Spawn[];
  /** Ticks since the current wave started. */
  waveTick: number;
  /** Modifiers active for the current wave (empty outside a wave). */
  modifiers: readonly ModifierId[];
  /** Row locked by the no-build modifier, or null. */
  noBuildRow: number | null;
  /** True once the player chose Endless after clearing wave 100. */
  endless: boolean;
  /** Total ticks simulated this run. */
  tick: number;
  /** Leftover real time not yet simulated (ms); see step(). */
  accumulator: number;
  nextId: number;
  /** One-shot events produced since the view last drained them. */
  events: GameEvent[];
  /** The live desktop pop-up, or null. */
  popup: Popup | null;
  /** Tick when the next pop-up spawn may be attempted. */
  nextPopupAttemptTick: number;
  /** Ticks remaining on the AutoUpdate tower damage buff. */
  towerDamageBuffTicks: number;
  /** Ticks remaining on the Time Zone enemy slow. */
  enemySlowTicks: number;
  /** Tower id -> ticks remaining it is disabled. */
  towerDisabled: Map<number, number>;
  /** Seeded PRNG state (see rng.ts). */
  rng: number;
  /** Desktop geometry for pop-up placement, updated by the view on resize. */
  viewport: {
    width: number;
    height: number;
    window: { x: number; y: number; w: number; h: number };
    rightPanel?: { x: number; y: number; w: number; h: number };
  };
  /** Permanent spec levels applied to this run (mirrors the profile, drives the bonuses). */
  specs: SpecLevels;
  /** Banked, unspent specs — the currency the spec shop spends (mirrors the profile). */
  unspentSpecs: number;
  /** Achievement ids unlocked so far this run (seeded from the profile). */
  achievements: Set<string>;
  /** Weak-point hits this run, for the sharpshooter achievement. */
  weakPointHits: number;
  /** Pop-ups dismissed this run, for the popup-collector achievement. */
  popupsDismissed: number;
  /** Enemies leaked during the current wave, for the clean-wave achievement. */
  leaksThisWave: number;
  /** True once a wave at 40+ has been cleared with zero leaks this run. */
  clearedWaveNoLeaks: boolean;
  /** True once a boss has died to the pointer without any tower having touched it. */
  bossKilledByPointer: boolean;
}

export function createRunState(profile: Profile = defaultProfile()): RunState {
  const grid = createGrid();
  const blocked = new Set<number>();
  const specs: SpecLevels = {
    cpu: profile.specs.cpu,
    ram: profile.specs.ram,
    gpu: profile.specs.gpu,
    disk: profile.specs.disk,
  };
  return {
    grid,
    field: buildField(grid, blocked),
    blocked,
    phase: 'build',
    wave: 0,
    integrity: STARTING_INTEGRITY + specs.disk,
    economy: createEconomy(STARTING_SALVAGE + specs.ram * RAM_SALVAGE_PER_POINT),
    pointer: createPointer(),
    towers: [],
    enemies: [],
    selected: null,
    selectedTowerId: null,
    schedule: [],
    waveTick: 0,
    modifiers: [],
    noBuildRow: null,
    endless: false,
    tick: 0,
    accumulator: 0,
    nextId: 1,
    events: [],
    popup: null,
    nextPopupAttemptTick: 0,
    towerDamageBuffTicks: 0,
    enemySlowTicks: 0,
    towerDisabled: new Map(),
    rng: 0x9e3779b9,
    viewport: {
      width: 1280,
      height: 800,
      window: { x: 24, y: 24, w: 1232, h: 752 },
      rightPanel: { x: 1106, y: 62, w: 148, h: 692 },
    },
    specs,
    unspentSpecs: profile.unspentSpecs,
    achievements: new Set(profile.achievements),
    weakPointHits: 0,
    popupsDismissed: 0,
    leaksThisWave: 0,
    clearedWaveNoLeaks: false,
    bossKilledByPointer: false,
  };
}

// ---------------------------------------------------------------------------------------------
// Queries

export function towerAt(s: RunState, col: number, row: number): Tower | undefined {
  return s.towers.find((t) => t.col === col && t.row === row);
}

export function selectedTower(s: RunState): Tower | undefined {
  if (s.selectedTowerId === null) return undefined;
  return s.towers.find((t) => t.id === s.selectedTowerId);
}

export function canPlace(s: RunState, kind: TowerKind, col: number, row: number): boolean {
  if (s.phase !== 'build' && s.phase !== 'wave') return false;
  if (!inBounds(col, row) || tileAt(s.grid, col, row) !== 'buildable') return false;
  if (s.modifiers.includes('no-build') && s.phase === 'wave' && s.noBuildRow === row) return false;
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
  return !s.endless && s.wave >= WAVE_COUNT;
}

/** Tower range multiplier from the fog modifier (docs/design.md §8.3). */
export function towerRangeMult(s: RunState): number {
  return s.modifiers.includes('fog') ? 0.8 : 1;
}

// ---------------------------------------------------------------------------------------------
// Player actions (reducers)

export function selectTower(s: RunState, kind: TowerKind | null): void {
  s.selected = s.selected === kind ? null : kind;
  if (s.selected !== null) s.selectedTowerId = null;
}

/** Select a placed tower for inspection; clears any armed build kind. */
export function selectPlacedTower(s: RunState, tower: Tower): void {
  s.selectedTowerId = tower.id;
  s.selected = null;
}

export function placeTower(s: RunState, kind: TowerKind, col: number, row: number): boolean {
  if (!canPlace(s, kind, col, row)) return false;
  spend(s.economy, TOWER_STATS[kind].cost);
  s.blocked.add(row * s.grid.cols + col);
  s.towers.push(createTower(s.nextId++, kind, col, row));
  rebuildField(s);
  recomputeAuras(s.towers);
  return true;
}

/** The route creeps will take right now, for drawing. */
export function currentPath(s: RunState): Tile[] {
  return pathTiles(s.field, SPAWN);
}

function rebuildField(s: RunState): void {
  s.field = buildField(s.grid, s.blocked);
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
  recomputeAuras(s.towers);
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
  recomputeAuras(s.towers);
  return true;
}

export function sellTower(s: RunState, col: number, row: number): boolean {
  const t = towerAt(s, col, row);
  if (!t) return false;
  const refund = sellValue(t);
  s.towers = s.towers.filter((x) => x.id !== t.id);
  s.blocked.delete(row * s.grid.cols + col);
  s.economy.salvage += refund;
  if (s.selectedTowerId === t.id) s.selectedTowerId = null;
  rebuildField(s);
  recomputeAuras(s.towers);
  return true;
}

export function startWave(s: RunState): boolean {
  if (s.phase !== 'build') return false;
  if (s.wave >= WAVE_COUNT && !s.endless) return false;
  s.wave += 1;
  s.phase = 'wave';
  s.schedule = buildSchedule(s.wave);
  s.waveTick = 0;
  s.leaksThisWave = 0;
  s.modifiers = waveModifiers(s.wave);
  s.noBuildRow = s.modifiers.includes('no-build') ? noBuildRow(s.wave) : null;
  recomputeAuras(s.towers);
  return true;
}

/** After clearing wave 100, the player may continue into endless instead of rebooting. */
export function enterEndless(s: RunState): void {
  if (s.phase !== 'victory') return;
  s.endless = true;
  s.phase = 'build';
  s.selected = null;
  s.selectedTowerId = null;
}

export function upgradePointer(s: RunState): boolean {
  const cost = nextStageCost(s.pointer);
  if (cost === null || s.phase === 'halted' || !spend(s.economy, cost)) return false;
  s.pointer.stage = Math.min(MAX_POINTER_STAGE, s.pointer.stage + 1) as PointerStage;
  return true;
}

/** Spend one banked spec on a permanent upgrade. Capped rows and an empty bank are refused. */
export function buySpec(s: RunState, kind: SpecKind): boolean {
  if (s.unspentSpecs <= 0) return false;
  if (s.specs[kind] >= SPEC_CAPS[kind]) return false;
  s.unspentSpecs -= 1;
  s.specs[kind] += 1;
  return true;
}

/** A reboot banks specs from the run's lifetime salvage and returns the updated profile. */
export interface RestartResult {
  gained: number;
  profile: Profile;
}

export function restartWindows(s: RunState, profile: Profile): RestartResult {
  const gained = specGain(s.economy.earned);
  const next = cloneProfile(profile);
  next.unspentSpecs += gained;
  next.reboots += 1;
  next.bestWave = Math.max(next.bestWave, s.wave);
  if (!next.achievements.includes('reboot-50') && totalSpecs(next) >= 50) {
    next.achievements.push('reboot-50');
  }
  return { gained, profile: next };
}

/**
 * Evaluate every achievement against the current run and return the ids that just unlocked (which
 * are also recorded in `s.achievements`, so each id fires exactly once). Runs in the simulation
 * step, never in the view.
 */
export function checkAchievements(s: RunState): string[] {
  const unlocked: string[] = [];
  const add = (id: string): void => {
    if (!s.achievements.has(id)) {
      s.achievements.add(id);
      unlocked.push(id);
    }
  };

  if (s.economy.kills.tower + s.economy.kills.pointer > 0) add('first-blood');
  if (currentPath(s).length >= 50) add('long-road');
  if (s.clearedWaveNoLeaks) add('clean-wave');
  if (s.weakPointHits >= 100) add('sharpshooter');
  if (s.towers.filter((t) => t.tier === 5).length >= 5) add('five-tier-five');
  if (s.towers.filter((t) => t.kind === 'beacon').length >= 10) add('beacon-field');
  if (s.bossKilledByPointer) add('boss-by-pointer');
  if (s.popupsDismissed >= 10) add('popup-collector');
  if (s.wave >= 150) add('endless-150');

  return unlocked;
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
  const weak = target ? isWeakPointHit(target, x, y) : false;
  s.events.push({ type: 'click', x, y, hit: !!target });
  if (!target) {
    s.pointer.combo = 0;
    s.pointer.comboTicks = 0;
    return false;
  }
  s.pointer.targetId = target.id;
  const base = pointerInfo(s.pointer).clickDamage * relay.damage * pointerDamageMult(s.specs);
  damageEnemy(s, target, base * comboMultiplier(s.pointer) * (weak ? 2 : 1), 'pointer', true, undefined, weak);
  if (weak) {
    s.weakPointHits++;
    s.pointer.combo++;
    s.pointer.comboTicks = COMBO_TICKS;
  }
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
  s.selectedTowerId = null;
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
  decayCombo(s);
  tickPopups(s);
  checkAchievements(s);
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

/** The combo counts down every tick and expires (back to x1) when it reaches zero. */
function decayCombo(s: RunState): void {
  const p = s.pointer;
  if (p.comboTicks > 0) {
    p.comboTicks--;
    if (p.comboTicks === 0) p.combo = 0;
  }
}

function spawnDue(s: RunState): void {
  while (s.schedule.length > 0 && s.schedule[0].tick <= s.waveTick) {
    const sp = s.schedule.shift()!;
    s.enemies.push(createEnemy(s.nextId++, sp.kind, s.wave, SPAWN, EXIT));
  }
}

function moveEnemies(s: RunState): void {
  const globalSlow = s.enemySlowTicks > 0 ? 0.5 : 1;
  const speedMult = s.modifiers.includes('fast') ? 1.15 : 1;
  for (const e of s.enemies) {
    if (e.dead) continue;
    e.prevX = e.x;
    e.prevY = e.y;
    if (s.tick < e.stunUntilTick) continue; // stunned: stand still this tick
    const slow = s.tick < e.slowUntilTick ? Math.min(globalSlow, e.slowFactor) : globalSlow;
    let remaining = speedPerTick(e.kind) * slow * speedMult;
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
      if (d > 0) e.heading = Math.atan2(dy, dx);
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
  s.leaksThisWave++;
  s.integrity = Math.max(0, s.integrity - (e.isBoss ? 3 : 1));
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

function hitEnemy(s: RunState, t: Tower, st: EffectiveStats, e: Enemy, dmg: number): void {
  damageEnemy(s, e, perEnemyDamage(st, e, dmg), 'tower', st.ignoresArmour, t);
  if (st.slowFactor < 1 && st.slowTicks > 0 && !e.dead) applySlow(s, e, st.slowFactor, st.slowTicks);
}

function fireSplash(s: RunState, t: Tower, st: EffectiveStats, target: Enemy, dmg: number): void {
  const cx = target.x;
  const cy = target.y;
  for (const e of s.enemies) {
    if (!towerCanHurt(e)) continue;
    if (st.targetsFlyersOnly && e.kind !== 'flyer') continue;
    const r = st.splash + radiusOf(e);
    if ((e.x - cx) ** 2 + (e.y - cy) ** 2 <= r * r) hitEnemy(s, t, st, e, dmg);
  }
}

function fireChain(s: RunState, t: Tower, st: EffectiveStats, target: Enemy, dmg: number): void {
  hitEnemy(s, t, st, target, dmg);
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
    hitEnemy(s, t, st, next, dmg * st.chainDamage);
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
  for (let i = 0; i < n; i++) hitEnemy(s, t, st, hits[i], dmg);
}

function fireTowers(s: RunState): void {
  const buff = s.towerDamageBuffTicks > 0 ? 1.4 : 1;
  for (const t of s.towers) {
    if ((s.towerDisabled.get(t.id) ?? 0) > 0) continue; // disabled by Blue Screen
    if (t.cooldown > 0) {
      t.cooldown--;
      continue;
    }
    const st = effectiveStats(t);
    if (st.damage <= 0 || st.fireInterval <= 0) continue; // beacon never fires
    const range = (st.range + t.auraRange) * towerRangeMult(s);
    const dmg = st.damage * t.auraDamage * buff * towerDamageMult(s.specs);

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
    else if (st.chainCount > 0) fireChain(s, t, st, target, dmg);
    else if (st.splash > 0) fireSplash(s, t, st, target, dmg);
    else hitEnemy(s, t, st, target, dmg);
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
  if (target) damageEnemy(s, target, dpt * relay.damage * comboMultiplier(p) * pointerDamageMult(s.specs), 'pointer', true);
}

/**
 * Apply damage from a source. Pointer damage wears the shield first and overflows into hp;
 * tower damage is subtracted by armour unless the tower ignores it. Kill attribution is decided
 * here and only here: whoever reduces hp to zero gets the kill.
 */
function damageEnemy(
  s: RunState,
  e: Enemy,
  amount: number,
  source: DamageSource,
  ignoresArmour: boolean,
  tower?: Tower,
  weak = false,
): void {
  if (e.dead || amount <= 0) return;
  if (source === 'tower') e.towerDamaged = true;
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
  s.events.push({ type: 'damage', x: e.x, y: e.y, amount: dmg, weak: source === 'pointer' && weak });
  if (e.hp <= 1e-9) {
    e.hp = 0;
    e.dead = true;
    if (e.isBoss && source === 'pointer' && !e.towerDamaged) s.bossKilledByPointer = true;
    const value = e.value * (s.modifiers.includes('rush') ? 1.1 : 1);
    const reward =
      source === 'pointer' && weak
        ? recordKillAt(s.economy, value, source, WEAK_POINT_KILL_BONUS)
        : recordKill(s.economy, value, source);
    if (tower) {
      tower.kills++;
      tower.earned += reward;
    }
    s.events.push({ type: 'kill', x: e.x, y: e.y, reward, source });
    if (s.pointer.targetId === e.id) s.pointer.targetId = null;
  }
}

function endWave(s: RunState): void {
  const bonus = waveClearBonus(s.wave);
  earn(s.economy, bonus);
  s.events.push({ type: 'waveCleared', wave: s.wave, bonus });
  if (s.wave >= 40 && s.leaksThisWave === 0) s.clearedWaveNoLeaks = true;
  s.pointer.held = false;
  s.pointer.targetId = null;
  s.modifiers = [];
  s.noBuildRow = null;
  s.phase = s.wave >= WAVE_COUNT && !s.endless ? 'victory' : 'build';
}
