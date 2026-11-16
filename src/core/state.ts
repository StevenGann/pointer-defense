import {
  inBounds,
  tileAt,
  type Grid,
  type Tile,
} from './grid.ts';
import { createGrid, DEFAULT_LEVEL, LEVELS, levelById } from './levels.ts';
import { buildField, isSealed, pathTiles, stepToward } from './pathfield.ts';
import { createEnemy, ENEMY_STATS, isWeakPointHit, radiusOf, speedPerTick, type Enemy, type EnemyKind } from './enemies.ts';
import {
  createTower,
  effectiveStats,
  recomputeAuras,
  TOWER_STATS,
  sellValue,
  upgradeCost,
  type Branch,
  type EffectiveStats,
  type TargetMode,
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
  earlyCallBonus,
  noBuildRow,
  WAVE_COUNT,
  waveModifiers,
  type ModifierId,
  type Spawn,
} from './waves.ts';
import { tickPopups, type Popup, type PopupKind } from './popups.ts';
import { TICK_HZ, TICK_MS } from './time.ts';
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
  | { type: 'kill'; x: number; y: number; reward: number; source: DamageSource; kind: EnemyKind; heading: number }
  | { type: 'leak'; x: number; y: number }
  | { type: 'shot'; towerId: number; x: number; y: number; splash: number }
  | { type: 'click'; x: number; y: number; hit: boolean }
  | { type: 'damage'; x: number; y: number; amount: number; weak: boolean }
  | { type: 'waveStarted'; wave: number }
  | { type: 'waveCleared'; wave: number; bonus: number }
  | { type: 'popupSpawned'; kind: PopupKind }
  | { type: 'popupDismissed'; kind: PopupKind };

/** One started wave's live spawn queue. Spawn ticks are relative to `startTick`. */
export interface WaveRun {
  wave: number;
  startTick: number;
  spawns: Spawn[];
}

export interface RunState {
  grid: Grid;
  /** Authored map id (see levels.ts); carried in state so a cycle rebuilds the board. */
  levelId: string;
  /** Distance-in-tiles to the exit for every walkable, unblocked tile; -1 unreachable. */
  field: Int32Array;
  /** Tower tiles (blocked for pathing), by index row * COLS + col. */
  blocked: Set<number>;
  phase: Phase;
  /** Last wave started (0 before the first). During 'build' the next wave is wave + 1. */
  wave: number;
  /** Waves actually cleared this run, incremented when a wave's queue and enemies are gone. */
  clearedWaves: number;
  integrity: number;
  economy: Economy;
  pointer: PointerState;
  towers: Tower[];
  enemies: Enemy[];
  /** Tower kind armed for placement, or null. UI selection, but kept here so the sim validates it. */
  selected: TowerKind | null;
  /** Placed tower selected for inspection, or null. Mutually exclusive with `selected`. */
  selectedTowerId: number | null;
  /** Started waves still in flight, in the order they began. Several may run at once. */
  runs: WaveRun[];
  /** Ticks since the most recent wave started (popups and the early-call bonus depend on it). */
  waveTick: number;
  /** Monotonic run clock, incremented once per tick and never reset. */
  clock: number;
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
  /** Leaks counted per wave number, so an early call cannot poison or rescue another wave's record. */
  leaksByWave: Map<number, number>;
  /** True once the player has called a wave early this run. */
  calledEarly: boolean;
  /** True once a wave at 40+ has been cleared with zero leaks this run. */
  clearedWaveNoLeaks: boolean;
  /** True once a boss has died to the pointer without any tower having touched it. */
  bossKilledByPointer: boolean;
  /** Simulation paused by P: the view keeps rendering, the sim clock stands still. */
  paused: boolean;
  /** Speed multiplier fed into the accumulator (1, 2 or 3); never applied to the fixed tick. */
  speed: 1 | 2 | 3;
  /** A fresh profile (no achievements, no reboots) — gates the first-run onboarding. */
  onboarding: boolean;
  /** True once the player has placed a tower this run — hides the onboarding hints. */
  placedFirstTower: boolean;
}

export function createRunState(profile: Profile = defaultProfile()): RunState {
  const level = DEFAULT_LEVEL;
  const grid = createGrid(level);
  const blocked = new Set<number>();
  const specs: SpecLevels = {
    cpu: profile.specs.cpu,
    ram: profile.specs.ram,
    gpu: profile.specs.gpu,
    disk: profile.specs.disk,
  };
  return {
    grid,
    levelId: level.id,
    field: buildField(grid, blocked, level.exits[0]),
    blocked,
    phase: 'build',
    wave: 0,
    clearedWaves: 0,
    integrity: STARTING_INTEGRITY + specs.disk,
    economy: createEconomy(STARTING_SALVAGE + specs.ram * RAM_SALVAGE_PER_POINT),
    pointer: createPointer(),
    towers: [],
    enemies: [],
    selected: null,
    selectedTowerId: null,
    runs: [],
    waveTick: 0,
    clock: 0,
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
    leaksByWave: new Map(),
    calledEarly: false,
    clearedWaveNoLeaks: false,
    bossKilledByPointer: false,
    paused: false,
    speed: 1,
    onboarding: profile.reboots === 0 && profile.achievements.length === 0,
    placedFirstTower: false,
  };
}

// ---------------------------------------------------------------------------------------------
// Queries

/** The single spawn tile of the current level; the gate accessor every end-of-route read uses. */
export function spawnTile(s: RunState): Tile {
  return levelById(s.levelId).starts[0];
}

/** The single exit tile of the current level. */
export function exitTile(s: RunState): Tile {
  return levelById(s.levelId).exits[0];
}

/** Map selection is only offered before wave 1, with no towers placed. */
export function canCycleLevel(s: RunState): boolean {
  return s.phase === 'build' && s.wave === 0 && s.towers.length === 0;
}

/** Advance to the next authored map, rebuilding the grid and path field. Refused after the run starts. */
export function cycleLevel(s: RunState): boolean {
  if (!canCycleLevel(s)) return false;
  const idx = LEVELS.findIndex((l) => l.id === s.levelId);
  const next = LEVELS[(idx + 1 + LEVELS.length) % LEVELS.length];
  s.levelId = next.id;
  s.grid = createGrid(next);
  s.blocked = new Set();
  s.field = buildField(s.grid, s.blocked, next.exits[0]);
  return true;
}

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
  const sealed = isSealed(s.grid, s.blocked, spawnTile(s), exitTile(s));
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
  s.placedFirstTower = true;
  return true;
}

/** The highest speed Space may reach right now (1 before wave 1, 2 from wave 1, 3 from wave 50). */
export function maxSpeed(s: RunState): 1 | 2 | 3 {
  return s.wave >= 50 ? 3 : s.wave >= 1 ? 2 : 1;
}

/** Space cycles the speed 1 -> 2 -> (3) -> 1, only ever up to `maxSpeed`. */
export function toggleSpeed(s: RunState): void {
  const max = maxSpeed(s);
  s.speed = s.speed >= max ? 1 : ((s.speed + 1) as 1 | 2 | 3);
}

/** P pauses and resumes the simulation without disturbing the view. */
export function togglePause(s: RunState): void {
  s.paused = !s.paused;
}

/** The route creeps will take right now, for drawing. */
export function currentPath(s: RunState): Tile[] {
  return pathTiles(s.field, spawnTile(s));
}

function rebuildField(s: RunState): void {
  s.field = buildField(s.grid, s.blocked, exitTile(s));
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

/** Cycle a tower's targeting priority First -> Strong -> Close -> First. */
export function cycleTargetMode(s: RunState, col: number, row: number): void {
  const t = towerAt(s, col, row);
  if (!t) return;
  t.targetMode = t.targetMode === 'first' ? 'strong' : t.targetMode === 'strong' ? 'close' : 'first';
}

export function startWave(s: RunState): boolean {
  const early = s.phase === 'wave';
  if (s.phase !== 'build' && !early) return false;
  if (s.wave >= WAVE_COUNT && !s.endless) return false;
  // The early-call bonus is measured from the wave that just started, before we reset waveTick,
  // and paid as a fraction of the wave being called (s.wave + 1 once incremented below).
  const elapsed = s.waveTick;
  s.wave += 1;
  s.runs.push({ wave: s.wave, startTick: s.clock, spawns: buildSchedule(s.wave) });
  s.phase = 'wave';
  s.waveTick = 0;
  s.leaksByWave.set(s.wave, 0);
  s.modifiers = waveModifiers(s.wave);
  s.noBuildRow = s.modifiers.includes('no-build') ? noBuildRow(s.wave) : null;
  recomputeAuras(s.towers);
  s.events.push({ type: 'waveStarted', wave: s.wave });
  if (early) {
    s.calledEarly = true;
    earn(s.economy, earlyCallBonus(elapsed, s.wave));
  }
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
  if (!s.paused) {
    // Speed scales the wall-clock time fed in, never the fixed timestep (docs/design.md §15).
    s.accumulator += Math.max(0, dtMs) * s.speed;
  }
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
  decayCombo(s);
  tickPopups(s);
  checkAchievements(s);
  if (s.phase === 'wave') {
    spawnDue(s);
    moveEnemies(s);
    fireTowers(s);
    applyReticle(s);
    s.enemies = s.enemies.filter((e) => !e.dead);
    if (s.phase === 'wave') {
      s.waveTick++;
      clearDue(s);
      finishWavePhase(s);
    }
  }
  s.clock++;
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
  for (const run of s.runs) {
    while (run.spawns.length > 0 && run.startTick + run.spawns[0].tick <= s.clock) {
      const sp = run.spawns.shift()!;
      s.enemies.push(createEnemy(s.nextId++, sp.kind, run.wave, spawnTile(s), exitTile(s)));
    }
  }
}

function moveEnemies(s: RunState): void {
  const globalSlow = s.enemySlowTicks > 0 ? 0.5 : 1;
  const speedMult = s.modifiers.includes('fast') ? 1.15 : 1;
  const exit = exitTile(s);
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
        if (e.col === exit.col && e.row === exit.row) {
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
  s.leaksByWave.set(e.wave, (s.leaksByWave.get(e.wave) ?? 0) + 1);
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

/** All hurtable enemies in range this tower may target. */
function towerCandidates(s: RunState, t: Tower, st: EffectiveStats, range: number): Enemy[] {
  const out: Enemy[] = [];
  for (const e of s.enemies) {
    if (!towerCanHurt(e)) continue;
    if (st.targetsFlyersOnly && e.kind !== 'flyer') continue;
    if (!inRange(t, e, range)) continue;
    out.push(e);
  }
  return out;
}

/** Frost and Beacon affect everything in range, so their mode is meaningless — always First. */
function targetModeFor(t: Tower): TargetMode {
  return t.kind === 'frost' || t.kind === 'beacon' ? 'first' : t.targetMode;
}

/** First: the hurtable enemy furthest along the route, the one about to leak. */
function firstTarget(enemies: Enemy[]): Enemy | undefined {
  let target: Enemy | undefined;
  for (const e of enemies) if (!target || e.dist > target.dist) target = e;
  return target;
}

/** Strong: the enemy with the most current HP. */
function strongTarget(enemies: Enemy[]): Enemy | undefined {
  let target: Enemy | undefined;
  for (const e of enemies) if (!target || e.hp > target.hp) target = e;
  return target;
}

/** Close: the enemy nearest to the tower. */
function closeTarget(t: Tower, enemies: Enemy[]): Enemy | undefined {
  let target: Enemy | undefined;
  let best = Infinity;
  for (const e of enemies) {
    const d2 = dist2(e, t.col + 0.5, t.row + 0.5);
    if (d2 < best) {
      best = d2;
      target = e;
    }
  }
  return target;
}

function pickTarget(t: Tower, enemies: Enemy[]): Enemy | undefined {
  switch (targetModeFor(t)) {
    case 'strong':
      return strongTarget(enemies);
    case 'close':
      return closeTarget(t, enemies);
    default:
      return firstTarget(enemies);
  }
}

function acquireTarget(s: RunState, t: Tower, st: EffectiveStats, range: number): Enemy | undefined {
  return pickTarget(t, towerCandidates(s, t, st, range));
}

/** Up to `limit` targets, ordered by the tower's targeting mode. */
function acquireTargets(s: RunState, t: Tower, st: EffectiveStats, range: number, limit: number): Enemy[] {
  const out = towerCandidates(s, t, st, range);
  const mode = targetModeFor(t);
  out.sort((a, b) => {
    if (mode === 'strong') return b.hp - a.hp;
    if (mode === 'close') return dist2(a, t.col + 0.5, t.row + 0.5) - dist2(b, t.col + 0.5, t.row + 0.5);
    return b.dist - a.dist;
  });
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

/**
 * A traversing barrel must line up before it fires. 8° is wide enough that a tower tracking a
 * slow enemy never wobbles over the line (it settles and holds), but narrow enough that a fast
 * enemy crossing the tower's field actually forces a swing — a cannon with a 90°/s traverse pays
 * real time to reacquire a runner that rounded a corner. Expressed in radians for the sim.
 */
const AIM_TOLERANCE = (8 * Math.PI) / 180;

/** Fold an angle into [-π, π]. */
function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/** Bearing from the tower's centre to the enemy: 0 = north, increasing clockwise. */
function bearingTo(t: Tower, e: Enemy): number {
  return Math.atan2(e.x - (t.col + 0.5), -(e.y - (t.row + 0.5)));
}

/**
 * Rotate the barrel toward `bearing` by at most one tick's worth of traverse. Returns true when
 * the barrel is within tolerance and may fire; otherwise it has moved one step and must wait.
 * A turn rate of 0 (instant-turn towers) always returns true.
 */
function aimToward(t: Tower, bearing: number, turnRate: number): boolean {
  if (turnRate <= 0) return true;
  const diff = normalizeAngle(bearing - t.angle);
  if (Math.abs(diff) <= AIM_TOLERANCE) return true;
  const maxStep = ((turnRate / TICK_HZ) * Math.PI) / 180;
  t.angle = normalizeAngle(t.angle + Math.sign(diff) * Math.min(Math.abs(diff), maxStep));
  return false;
}

function fireTowers(s: RunState): void {
  const buff = s.towerDamageBuffTicks > 0 ? 1.4 : 1;
  for (const t of s.towers) {
    if ((s.towerDisabled.get(t.id) ?? 0) > 0) continue; // disabled by Blue Screen
    const st = effectiveStats(t);
    if (st.damage <= 0 || st.fireInterval <= 0) continue; // beacon never fires
    const range = (st.range + t.auraRange) * towerRangeMult(s);
    const dmg = st.damage * t.auraDamage * buff * towerDamageMult(s.specs);

    // Pick the target(s) exactly as before, so targeting priorities are unchanged by traverse.
    const targets =
      st.beams > 1
        ? acquireTargets(s, t, st, range, st.beams)
        : ((): Enemy[] => {
            const tg = acquireTarget(s, t, st, range);
            return tg ? [tg] : [];
          })();

    // Cooldown ticks down regardless of facing; the barrel keeps tracking while it cools down.
    if (t.cooldown > 0) {
      t.cooldown--;
      if (targets.length > 0) aimToward(t, bearingTo(t, targets[0]), st.turnRate);
      continue;
    }

    if (targets.length === 0) continue;

    // Line the barrel up first; if it still has to turn, hold fire until a later tick.
    if (!aimToward(t, bearingTo(t, targets[0]), st.turnRate)) continue;

    if (st.beams > 1) {
      t.cooldown = intervalTicks(st.fireInterval) - 1;
      for (const tg of targets) {
        s.events.push({ type: 'shot', towerId: t.id, x: tg.x, y: tg.y, splash: st.splash });
        fireBeam(s, t, st, tg, dmg * st.beamDamage);
      }
      continue;
    }

    const target = targets[0];
    t.cooldown = intervalTicks(st.fireInterval) - 1;
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
  s.economy.damage[source] += dmg;
  if (source === 'tower' && tower) tower.damageDealt += dmg;
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
    s.events.push({ type: 'kill', x: e.x, y: e.y, reward, source, kind: e.kind, heading: e.heading });
    if (s.pointer.targetId === e.id) s.pointer.targetId = null;
  }
}

/** Award the clear bonus for each wave whose queue is empty and whose enemies are all gone. */
function clearDue(s: RunState): void {
  const cleared = new Set<WaveRun>();
  for (const run of s.runs) {
    if (run.spawns.length !== 0) continue;
    if (s.enemies.some((e) => e.wave === run.wave)) continue;
    const bonus = waveClearBonus(run.wave);
    earn(s.economy, bonus);
    s.events.push({ type: 'waveCleared', wave: run.wave, bonus });
    if (run.wave >= 40 && (s.leaksByWave.get(run.wave) ?? 0) === 0) s.clearedWaveNoLeaks = true;
    cleared.add(run);
  }
  s.clearedWaves += cleared.size;
  if (cleared.size > 0) s.runs = s.runs.filter((r) => !cleared.has(r));
}

/** With every wave cleared and no enemies left, the run returns to build (or wins at wave 100). */
function finishWavePhase(s: RunState): void {
  if (s.runs.length !== 0 || s.enemies.length !== 0) return;
  s.pointer.held = false;
  s.pointer.targetId = null;
  s.modifiers = [];
  s.noBuildRow = null;
  s.phase = s.wave >= WAVE_COUNT && !s.endless ? 'victory' : 'build';
}
