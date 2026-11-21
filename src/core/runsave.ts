/**
 * Saving a run in progress (docs/RUN-SAVE.md).
 *
 * The profile has always persisted; the run never has. This module captures a run's authoritative
 * simulation state into a plain JSON object (`v: 1`) under `pd.run.v1`, and restores it on boot so a
 * reload mid-wave does not lose the wave, the towers, the salvage or the pointer upgrades.
 *
 * Only what the simulation treats as authoritative is saved. Everything derived comes back from the
 * code that already derives it: `grid`, `blocked` and the distance fields are rebuilt by
 * `rebuildField` after the towers are in place, and auras are recomputed by `recomputeAuras`. A save
 * that carries those fields is a save that can disagree with itself, so they are never written.
 *
 * Loading is defensive in the same spirit as save.ts: a missing, unparsable, unknown-version or
 * otherwise doubtful save returns null and deletes the key, and never throws, so a bad save can never
 * stop the game booting.
 */

import { COLS, inBounds, type Tile } from './grid.ts';
import { createGrid, levelRoutes, validateLevel, type Level, type LevelToggle, type Route } from './levels.ts';
import { isEnemyKind, type Enemy, type EnemyKind } from './enemies.ts';
import { isTowerKind, recomputeAuras, TIERS, TOWER_KINDS, TOWER_UNLOCK_WAVE, type Branch, type TargetMode, type Tier, type Tower, type TowerKind } from './towers.ts';
import type { Projectile } from './projectiles.ts';
import { rebuildField, STARTING_INTEGRITY, type Mine, type Phase, type RunState, type WaveRun, type WaveSnapshot } from './state.ts';
import type { Economy } from './economy.ts';
import type { PointerStage, PointerState } from './pointer.ts';
import type { Ad, AdKind } from './ads.ts';
import { WAVE_COUNT, type ModifierId } from './waves.ts';
import { GLOBAL_UPGRADES, type BuffKind, type TrayPopup, type UpgradeId } from './upgrades.ts';
import { defaultProfile, SPEC_CAPS, type Profile, type SpecLevels } from './save.ts';
import { isTreeNodeId, type TreeEffects } from './tree.ts';
import { isAdTipId, type AdTipId } from '../content/adTips.ts';

export const RUN_SAVE_KEY = 'pd.run.v1';
export const RUN_SAVE_VERSION = 1;

/** The widest integrity a legitimately-started run can hold (disk spec + the +5 Safe Mode node). */
const MAX_INTEGRITY = STARTING_INTEGRITY + SPEC_CAPS.disk + 5;

const PHASES: readonly Phase[] = ['build', 'wave', 'halted', 'victory'];
const MODIFIER_IDS: readonly ModifierId[] = ['fog', 'no-build', 'fast', 'blackout', 'rush'];
const AD_KINDS: readonly AdKind[] = ['defrag', 'autoupdate', 'timezone', 'freeware', 'screensaver', 'bluescreen'];
const BUFF_KINDS: readonly BuffKind[] = ['turbo', 'overdrive', 'windfall'];
const PROJECTILE_KINDS: readonly Projectile['kind'][] = ['shell', 'missile'];
const TARGET_MODES: readonly TargetMode[] = ['first', 'strong', 'close'];
const BRANCHES: readonly Branch[] = ['A', 'B', 'C'];

/** Tower kinds a licence can grant: every kind that is not free from the first build phase. */
const GATED_TOWER_KINDS: readonly TowerKind[] = TOWER_KINDS.filter((k) => TOWER_UNLOCK_WAVE[k] > 0);

/** Absurd-count ceilings a valid board can never reach (docs/RUN-SAVE.md). */
const MAX_TOWERS = 240;
const MAX_ENEMIES = 400;
const MAX_PROJECTILES = 400;
const MAX_MINES = 200;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** The plain JSON object a run serialises to. `v` is the schema version. */
export interface RunSave {
  v: 1;
  levelId: string;
  level: Level;
  toggles: readonly LevelToggle[];
  routes: readonly Route[];
  routeCursor: number;
  phase: Phase;
  wave: number;
  clearedWaves: number;
  integrity: number;
  economy: Economy;
  pointer: PointerState;
  towers: readonly Tower[];
  enemies: readonly Enemy[];
  projectiles: readonly Projectile[];
  mines: readonly Mine[];
  runs: readonly WaveRun[];
  waveTick: number;
  clock: number;
  modifiers: readonly ModifierId[];
  endless: boolean;
  tick: number;
  nextId: number;
  ad: Ad | null;
  nextAdAttemptTick: number;
  towerDamageBuffTicks: number;
  enemySlowTicks: number;
  towerDisabled: readonly (readonly [number, number])[];
  rng: number;
  specs: SpecLevels;
  rp: number;
  rpEarned: number;
  treeEffects: TreeEffects;
  achievements: readonly string[];
  weakPointHits: number;
  adsDismissed: number;
  leaksByWave: readonly (readonly [number, number])[];
  flyerLeaksByWave: readonly (readonly [number, number])[];
  calledEarly: boolean;
  clearedWaveNoLeaks: boolean;
  bossKilledByPointer: boolean;
  weakPointKills: number;
  critHits: number;
  salvagePeak: number;
  soldTower: boolean;
  earlyCallsInARow: number;
  clearedFlawlessWave: boolean;
  milestoneBossByPointer: boolean;
  wallDamageTaken: number;
  paused: boolean;
  speed: 1 | 2 | 3;
  onboarding: boolean;
  placedFirstTower: boolean;
  autoWave: boolean;
  autoWaveAtTick: number;
  godMode: boolean;
  cheatsUsed: boolean;
  upgrades: readonly UpgradeId[];
  emergencyPatchSpent: boolean;
  buff: { kind: BuffKind; until: number } | null;
  tray: TrayPopup | null;
  pointerHits: number;
  towersBuilt: number;
  towersSold: number;
  upgradesBought: number;
  branches: number;
  perfectWaves: number;
  perfectWaveStreak: number;
  bossesKilled: number;
  bossKillsByPointer: number;
  shieldsBroken: number;
  adsExpired: number;
  minesTriggered: number;
  repairsDone: number;
  salvageSpentOnRepairs: number;
  toggleFlips: number;
  wallsBuilt: number;
  flyersKilled: number;
  aaKills: number;
  cursorKills: number;
  cursorRepairs: number;
  earlyCalls: number;
  wavesAtThreeSpeed: number;
  waveAtThreeCounted: number;
  totalLeaks: number;
  integrityLowWater: number;
  pausedTicks: number;
  reboots: number;
  tree: readonly string[];
  cursorBuilt: boolean;
  clearedWave1NoLeak: boolean;
  killedBossKinds: readonly string[];
  waveSnapshots: readonly (readonly [number, WaveSnapshot])[];
  clearedWallOnlyWave: boolean;
  clearedNoUpgradeWave: boolean;
  clearedTwoKinds: boolean;
  clearedNoSpendWave: boolean;
  clearedBossNoLeak: boolean;
  clearedSellAllWave: boolean;
  clearedNoTowerWave: boolean;
  soldTowerSameWave: boolean;
  calledEarlyBeforeTower: boolean;
  wavesClearedSinceLeak: number;
  cheatSpawns: number;
  salvageHitZeroThisWave: boolean;
  towerOfflineThisWave: boolean;
  shadowBroke: boolean;
  maxBeamKills: number;
  maxChainKills: number;
  maxSplashKills: number;
  maxSlowCount: number;
  beaconBuffKill: boolean;
  cursorRepairsByTower: readonly (readonly [number, number])[];
  pointerIdleTicks: number;
  idleTowerKilled: boolean;
  pointerKillTicks: readonly number[];
  idleTicks: number;
  bossKilledByOverride: boolean;
  bossKilledAtOneIntegrity: boolean;
  salvageSpent: number;
}

function browserStorage(): StorageLike | null {
  try {
    return (globalThis as { localStorage?: StorageLike }).localStorage ?? null;
  } catch {
    return null;
  }
}

function mapPairs(m: ReadonlyMap<number, number>): [number, number][] {
  return [...m.entries()];
}

/** Capture the authoritative slice of a run as a plain JSON object (v: 1). */
export function captureRun(state: RunState): RunSave {
  return {
    v: 1,
    levelId: state.levelId,
    level: state.level,
    toggles: state.toggles,
    routes: state.routes,
    routeCursor: state.routeCursor,
    phase: state.phase,
    wave: state.wave,
    clearedWaves: state.clearedWaves,
    integrity: state.integrity,
    economy: state.economy,
    pointer: state.pointer,
    towers: state.towers,
    enemies: state.enemies,
    projectiles: state.projectiles,
    mines: state.mines,
    runs: state.runs,
    waveTick: state.waveTick,
    clock: state.clock,
    modifiers: state.modifiers,
    endless: state.endless,
    tick: state.tick,
    nextId: state.nextId,
    ad: state.ad,
    nextAdAttemptTick: state.nextAdAttemptTick,
    towerDamageBuffTicks: state.towerDamageBuffTicks,
    enemySlowTicks: state.enemySlowTicks,
    towerDisabled: mapPairs(state.towerDisabled),
    rng: state.rng,
    specs: state.specs,
    rp: state.rp,
    rpEarned: state.rpEarned,
    treeEffects: state.treeEffects,
    achievements: [...state.achievements],
    weakPointHits: state.weakPointHits,
    adsDismissed: state.adsDismissed,
    leaksByWave: mapPairs(state.leaksByWave),
    flyerLeaksByWave: mapPairs(state.flyerLeaksByWave),
    calledEarly: state.calledEarly,
    clearedWaveNoLeaks: state.clearedWaveNoLeaks,
    bossKilledByPointer: state.bossKilledByPointer,
    weakPointKills: state.weakPointKills,
    critHits: state.critHits,
    salvagePeak: state.salvagePeak,
    soldTower: state.soldTower,
    earlyCallsInARow: state.earlyCallsInARow,
    clearedFlawlessWave: state.clearedFlawlessWave,
    milestoneBossByPointer: state.milestoneBossByPointer,
    wallDamageTaken: state.wallDamageTaken,
    paused: state.paused,
    speed: state.speed,
    onboarding: state.onboarding,
    placedFirstTower: state.placedFirstTower,
    autoWave: state.autoWave,
    autoWaveAtTick: state.autoWaveAtTick,
    godMode: state.godMode,
    cheatsUsed: state.cheatsUsed,
    upgrades: state.upgrades,
    emergencyPatchSpent: state.emergencyPatchSpent,
    buff: state.buff,
    tray: state.tray,
    pointerHits: state.pointerHits,
    towersBuilt: state.towersBuilt,
    towersSold: state.towersSold,
    upgradesBought: state.upgradesBought,
    branches: state.branches,
    perfectWaves: state.perfectWaves,
    perfectWaveStreak: state.perfectWaveStreak,
    bossesKilled: state.bossesKilled,
    bossKillsByPointer: state.bossKillsByPointer,
    shieldsBroken: state.shieldsBroken,
    adsExpired: state.adsExpired,
    minesTriggered: state.minesTriggered,
    repairsDone: state.repairsDone,
    salvageSpentOnRepairs: state.salvageSpentOnRepairs,
    toggleFlips: state.toggleFlips,
    wallsBuilt: state.wallsBuilt,
    flyersKilled: state.flyersKilled,
    aaKills: state.aaKills,
    cursorKills: state.cursorKills,
    cursorRepairs: state.cursorRepairs,
    earlyCalls: state.earlyCalls,
    wavesAtThreeSpeed: state.wavesAtThreeSpeed,
    waveAtThreeCounted: state.waveAtThreeCounted,
    totalLeaks: state.totalLeaks,
    integrityLowWater: state.integrityLowWater,
    pausedTicks: state.pausedTicks,
    reboots: state.reboots,
    tree: state.tree,
    cursorBuilt: state.cursorBuilt,
    clearedWave1NoLeak: state.clearedWave1NoLeak,
    killedBossKinds: [...state.killedBossKinds],
    waveSnapshots: [...state.waveSnapshots.entries()],
    clearedWallOnlyWave: state.clearedWallOnlyWave,
    clearedNoUpgradeWave: state.clearedNoUpgradeWave,
    clearedTwoKinds: state.clearedTwoKinds,
    clearedNoSpendWave: state.clearedNoSpendWave,
    clearedBossNoLeak: state.clearedBossNoLeak,
    clearedSellAllWave: state.clearedSellAllWave,
    clearedNoTowerWave: state.clearedNoTowerWave,
    soldTowerSameWave: state.soldTowerSameWave,
    calledEarlyBeforeTower: state.calledEarlyBeforeTower,
    wavesClearedSinceLeak: state.wavesClearedSinceLeak,
    cheatSpawns: state.cheatSpawns,
    salvageHitZeroThisWave: state.salvageHitZeroThisWave,
    towerOfflineThisWave: state.towerOfflineThisWave,
    shadowBroke: state.shadowBroke,
    maxBeamKills: state.maxBeamKills,
    maxChainKills: state.maxChainKills,
    maxSplashKills: state.maxSplashKills,
    maxSlowCount: state.maxSlowCount,
    beaconBuffKill: state.beaconBuffKill,
    cursorRepairsByTower: mapPairs(state.cursorRepairsByTower),
    pointerIdleTicks: state.pointerIdleTicks,
    idleTowerKilled: state.idleTowerKilled,
    pointerKillTicks: state.pointerKillTicks,
    idleTicks: state.idleTicks,
    bossKilledByOverride: state.bossKilledByOverride,
    bossKilledAtOneIntegrity: state.bossKilledAtOneIntegrity,
    salvageSpent: state.salvageSpent,
  };
}

// --- Validation helpers ------------------------------------------------------------------------

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function int(v: unknown): number | null {
  const n = num(v);
  return n !== null && Number.isInteger(n) ? n : null;
}

function bool(v: unknown): boolean | null {
  return typeof v === 'boolean' ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null;
}

function numPairs(v: unknown): [number, number][] | null {
  if (!Array.isArray(v)) return null;
  const out: [number, number][] = [];
  for (const pair of v) {
    if (!Array.isArray(pair) || pair.length !== 2) return null;
    const k = int(pair[0]);
    const val = int(pair[1]);
    if (k === null || val === null) return null;
    out.push([k, val]);
  }
  return out;
}

function strArray(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null;
  const out: string[] = [];
  for (const s of v) {
    const x = str(s);
    if (x === null) return null;
    out.push(x);
  }
  return out;
}

function numArray(v: unknown): number[] | null {
  if (!Array.isArray(v)) return null;
  const out: number[] = [];
  for (const n of v) {
    const x = int(n);
    if (x === null) return null;
    out.push(x);
  }
  return out;
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

function parseRoutes(v: unknown): Route[] | null {
  if (!Array.isArray(v)) return null;
  const out: Route[] = [];
  for (const r of v) {
    const tiles = parseTiles(r);
    if (tiles === null) return null;
    out.push(tiles);
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
  const starts = parseTiles(v.starts);
  if (starts === null || starts.length === 0) return null;
  const exits = parseTiles(v.exits);
  if (exits === null || exits.length === 0) return null;

  let toggles: readonly LevelToggle[] | undefined;
  if (v.toggles !== undefined && v.toggles !== null) {
    const parsed = parseToggles(v.toggles);
    if (parsed === null) return null;
    toggles = parsed;
  }
  let routes: readonly Route[] | undefined;
  if (v.routes !== undefined && v.routes !== null) {
    const parsed = parseRoutes(v.routes);
    if (parsed === null) return null;
    routes = parsed;
  }

  const level: Level = {
    id,
    name,
    walls,
    starts,
    exits,
    ...(toggles !== undefined ? { toggles } : {}),
    ...(routes !== undefined ? { routes } : {}),
  };
  return level;
}

function parseEconomy(v: unknown): Economy | null {
  if (!isObj(v)) return null;
  const salvage = num(v.salvage);
  const earned = num(v.earned);
  if (salvage === null || earned === null) return null;
  const kills = parseSourceRecord(v.kills);
  const earnedBySource = parseSourceRecord(v.earnedBySource);
  const damage = parseSourceRecord(v.damage);
  if (kills === null || earnedBySource === null || damage === null) return null;
  return { salvage, earned, kills, earnedBySource, damage };
}

function parseSourceRecord(v: unknown): Record<'tower' | 'pointer', number> | null {
  if (!isObj(v)) return null;
  const tower = num(v.tower);
  const pointer = num(v.pointer);
  if (tower === null || pointer === null) return null;
  return { tower, pointer };
}

function parsePointer(v: unknown): PointerState | null {
  if (!isObj(v)) return null;
  const stage = int(v.stage);
  const clickLevel = int(v.clickLevel);
  const manualOverride = bool(v.manualOverride);
  const targetId = v.targetId === null ? null : int(v.targetId);
  if (v.targetId !== null && targetId === null) return null;
  const held = bool(v.held);
  const x = num(v.x);
  const y = num(v.y);
  const combo = int(v.combo);
  const comboTicks = int(v.comboTicks);
  if (stage === null || clickLevel === null || manualOverride === null || held === null || x === null || y === null || combo === null || comboTicks === null) return null;
  if (stage !== 1 && stage !== 2) return null;
  return { stage: stage as PointerStage, clickLevel, manualOverride, targetId, held, x, y, combo, comboTicks };
}

function parseTower(v: unknown): Tower | null {
  if (!isObj(v)) return null;
  const id = int(v.id);
  if (id === null) return null;
  const kindRaw = str(v.kind);
  if (kindRaw === null || !isTowerKind(kindRaw)) return null;
  const col = int(v.col);
  const row = int(v.row);
  const placedTick = int(v.placedTick);
  const builtWave = int(v.builtWave);
  const tier = int(v.tier);
  if (col === null || row === null || placedTick === null || builtWave === null || tier === null) return null;
  if (!TIERS.includes(tier as Tier)) return null;
  const branch = v.branch === null ? null : (BRANCHES.includes(v.branch as Branch) ? (v.branch as Branch) : null);
  if (v.branch !== null && branch === null) return null;
  const spent = num(v.spent);
  const auraDamage = num(v.auraDamage);
  const auraRange = num(v.auraRange);
  const angle = num(v.angle);
  const cooldown = int(v.cooldown);
  const mineCooldown = int(v.mineCooldown);
  const salvoCount = int(v.salvoCount);
  const kills = int(v.kills);
  const earned = num(v.earned);
  const damageDealt = num(v.damageDealt);
  const targetMode = str(v.targetMode);
  if (spent === null || auraDamage === null || auraRange === null || angle === null || cooldown === null || mineCooldown === null || salvoCount === null || kills === null || earned === null || damageDealt === null || targetMode === null) return null;
  if (!TARGET_MODES.includes(targetMode as TargetMode)) return null;
  const hp = num(v.hp);
  const maxHp = num(v.maxHp);
  const empUntilTick = int(v.empUntilTick);
  const open = bool(v.open);
  const toggleReadyAt = int(v.toggleReadyAt);
  const repairReadyAt = int(v.repairReadyAt);
  const repairStartHp = num(v.repairStartHp);
  const repairMissing = num(v.repairMissing);
  const repairDurationTicks = int(v.repairDurationTicks);
  const cursorX = num(v.cursorX);
  const cursorY = num(v.cursorY);
  const cursorTargetId = v.cursorTargetId === null ? null : int(v.cursorTargetId);
  if (v.cursorTargetId !== null && cursorTargetId === null) return null;
  const cursorRepairTowerId = v.cursorRepairTowerId === null ? null : int(v.cursorRepairTowerId);
  if (v.cursorRepairTowerId !== null && cursorRepairTowerId === null) return null;
  const cursorCooldown = int(v.cursorCooldown);
  const cursorWanderSeed = int(v.cursorWanderSeed);
  const cursorWanderAngle = num(v.cursorWanderAngle);
  const cursorClickFx = int(v.cursorClickFx);
  const cursorClickX = num(v.cursorClickX);
  const cursorClickY = num(v.cursorClickY);
  if (hp === null || maxHp === null || empUntilTick === null || open === null || toggleReadyAt === null || repairReadyAt === null || repairStartHp === null || repairMissing === null || repairDurationTicks === null || cursorX === null || cursorY === null || cursorCooldown === null || cursorWanderSeed === null || cursorWanderAngle === null || cursorClickFx === null || cursorClickX === null || cursorClickY === null) return null;
  return {
    id, kind: kindRaw as TowerKind, col, row, placedTick, builtWave,
    tier: tier as Tier, branch, spent, auraDamage, auraRange, angle, cooldown, mineCooldown, salvoCount,
    kills, earned, damageDealt, targetMode: targetMode as TargetMode,
    hp, maxHp, empUntilTick, open, toggleReadyAt, repairReadyAt, repairStartHp, repairMissing, repairDurationTicks,
    cursorX, cursorY, cursorTargetId, cursorRepairTowerId, cursorCooldown, cursorWanderSeed, cursorWanderAngle, cursorClickFx, cursorClickX, cursorClickY,
  };
}

function parseEnemy(v: unknown): Enemy | null {
  if (!isObj(v)) return null;
  const id = int(v.id);
  const kindRaw = str(v.kind);
  if (id === null || kindRaw === null || !isEnemyKind(kindRaw)) return null;
  const kind = kindRaw as EnemyKind;
  const wave = int(v.wave);
  const isBoss = bool(v.isBoss);
  const towerDamaged = bool(v.towerDamaged);
  const hp = num(v.hp);
  const maxHp = num(v.maxHp);
  const shield = num(v.shield);
  const maxShield = num(v.maxShield);
  const shieldsRemaining = int(v.shieldsRemaining);
  const dist = num(v.dist);
  const spawnTick = int(v.spawnTick);
  const x = num(v.x);
  const y = num(v.y);
  const prevX = num(v.prevX);
  const prevY = num(v.prevY);
  const col = int(v.col);
  const row = int(v.row);
  const targetCol = int(v.targetCol);
  const targetRow = int(v.targetRow);
  const value = num(v.value);
  const slowFactor = num(v.slowFactor);
  const slowUntilTick = int(v.slowUntilTick);
  const stunUntilTick = int(v.stunUntilTick);
  const heading = num(v.heading);
  const attackTowerId = v.attackTowerId === null ? null : int(v.attackTowerId);
  if (v.attackTowerId !== null && attackTowerId === null) return null;
  const turretCooldown = int(v.turretCooldown);
  const scatterTicks = int(v.scatterTicks);
  const broodCooldown = int(v.broodCooldown);
  const routeIndex = int(v.routeIndex);
  const laneOffset = num(v.laneOffset);
  const swayPhase = num(v.swayPhase);
  const flightDist = num(v.flightDist);
  const flightOffX = num(v.flightOffX);
  const flightOffY = num(v.flightOffY);
  const flightDirX = num(v.flightDirX);
  const flightDirY = num(v.flightDirY);
  const dead = bool(v.dead);
  if (wave === null || isBoss === null || towerDamaged === null || hp === null || maxHp === null || shield === null || maxShield === null || shieldsRemaining === null || dist === null || spawnTick === null || x === null || y === null || prevX === null || prevY === null || col === null || row === null || targetCol === null || targetRow === null || value === null || slowFactor === null || slowUntilTick === null || stunUntilTick === null || heading === null || turretCooldown === null || scatterTicks === null || broodCooldown === null || routeIndex === null || laneOffset === null || swayPhase === null || flightDist === null || flightOffX === null || flightOffY === null || flightDirX === null || flightDirY === null || dead === null) return null;
  return {
    id, kind, wave, isBoss, towerDamaged, hp, maxHp, shield, maxShield, shieldsRemaining, dist, spawnTick,
    x, y, prevX, prevY, col, row, targetCol, targetRow, value, slowFactor, slowUntilTick, stunUntilTick, heading,
    attackTowerId, turretCooldown, scatterTicks, broodCooldown, routeIndex, laneOffset, swayPhase, flightDist,
    flightOffX, flightOffY, flightDirX, flightDirY, dead,
  };
}

function parseProjectile(v: unknown): Projectile | null {
  if (!isObj(v)) return null;
  const id = int(v.id);
  const kind = str(v.kind);
  const x = num(v.x);
  const y = num(v.y);
  const vx = num(v.vx);
  const vy = num(v.vy);
  const targetId = v.targetId === null ? null : int(v.targetId);
  if (v.targetId !== null && targetId === null) return null;
  const towerId = int(v.towerId);
  const damage = num(v.damage);
  const lifetime = int(v.lifetime);
  if (id === null || kind === null || x === null || y === null || vx === null || vy === null || towerId === null || damage === null || lifetime === null) return null;
  if (!PROJECTILE_KINDS.includes(kind as Projectile['kind'])) return null;
  return { id, kind: kind as Projectile['kind'], x, y, vx, vy, targetId, towerId, damage, lifetime };
}

function parseMine(v: unknown): Mine | null {
  if (!isObj(v)) return null;
  const id = int(v.id);
  const towerId = int(v.towerId);
  const x = num(v.x);
  const y = num(v.y);
  const placedTick = int(v.placedTick);
  const armedAtTick = int(v.armedAtTick);
  const expiresTick = int(v.expiresTick);
  if (id === null || towerId === null || x === null || y === null || placedTick === null || armedAtTick === null || expiresTick === null) return null;
  return { id, towerId, x, y, placedTick, armedAtTick, expiresTick };
}

function parseSpawns(v: unknown): WaveRun['spawns'] | null {
  if (!Array.isArray(v)) return null;
  const out: WaveRun['spawns'] = [];
  for (const s of v) {
    if (!isObj(s)) return null;
    const tick = int(s.tick);
    const kind = str(s.kind);
    if (tick === null || kind === null || !isEnemyKind(kind)) return null;
    out.push({ tick, kind });
  }
  return out;
}

function parseRuns(v: unknown): WaveRun[] | null {
  if (!Array.isArray(v)) return null;
  const out: WaveRun[] = [];
  for (const r of v) {
    if (!isObj(r)) return null;
    const wave = int(r.wave);
    const startTick = int(r.startTick);
    if (wave === null || startTick === null) return null;
    const spawns = parseSpawns(r.spawns);
    if (spawns === null) return null;
    out.push({ wave, startTick, spawns });
  }
  return out;
}

function parseAd(v: unknown): Ad | null {
  if (!isObj(v)) return null;
  const id = int(v.id);
  const kind = str(v.kind);
  const ttl = int(v.ttl);
  const x = num(v.x);
  const y = num(v.y);
  const w = num(v.w);
  const h = num(v.h);
  if (id === null || kind === null || ttl === null || x === null || y === null || w === null || h === null) return null;
  if (!AD_KINDS.includes(kind as AdKind)) return null;
  // A Blue Screen has no tip; an absent tip (an older save, or a null) is treated the same way.
  const tip: AdTipId | null = v.tip === null || v.tip === undefined ? null : isAdTipId(v.tip) ? v.tip : null;
  return { id, kind: kind as AdKind, tip, ttl, x, y, w, h };
}

function parseTray(v: unknown): TrayPopup | null {
  if (!isObj(v)) return null;
  const id = int(v.id);
  const until = int(v.until);
  const x = num(v.x);
  const y = num(v.y);
  const w = num(v.w);
  const h = num(v.h);
  if (id === null || until === null || x === null || y === null || w === null || h === null) return null;
  return { id, until, x, y, w, h };
}

function parseBuff(v: unknown): { kind: BuffKind; until: number } | null {
  if (!isObj(v)) return null;
  const kind = str(v.kind);
  const until = int(v.until);
  if (kind === null || until === null) return null;
  if (!BUFF_KINDS.includes(kind as BuffKind)) return null;
  return { kind: kind as BuffKind, until };
}

function parseWaveSnapshot(v: unknown): WaveSnapshot | null {
  if (!isObj(v)) return null;
  const salvage = int(v.salvage);
  const salvageSpent = int(v.salvageSpent);
  const integrity = int(v.integrity);
  const towersBuilt = int(v.towersBuilt);
  const wallsBuilt = int(v.wallsBuilt);
  const towersSold = int(v.towersSold);
  const upgradesBought = int(v.upgradesBought);
  const branches = int(v.branches);
  const bossesKilled = int(v.bossesKilled);
  const towerCount = int(v.towerCount);
  if (salvage === null || salvageSpent === null || integrity === null || towersBuilt === null || wallsBuilt === null || towersSold === null || upgradesBought === null || branches === null || bossesKilled === null || towerCount === null) return null;
  return { salvage, salvageSpent, integrity, towersBuilt, wallsBuilt, towersSold, upgradesBought, branches, bossesKilled, towerCount };
}

function parseWaveSnapshots(v: unknown): Map<number, WaveSnapshot> | null {
  if (!Array.isArray(v)) return null;
  const out = new Map<number, WaveSnapshot>();
  for (const entry of v) {
    if (!Array.isArray(entry) || entry.length !== 2) return null;
    const wave = int(entry[0]);
    if (wave === null) return null;
    const snap = parseWaveSnapshot(entry[1]);
    if (snap === null) return null;
    out.set(wave, snap);
  }
  return out;
}

function parseSpecs(v: unknown): SpecLevels | null {
  if (!isObj(v)) return null;
  const cpu = int(v.cpu);
  const ram = int(v.ram);
  const gpu = int(v.gpu);
  const disk = int(v.disk);
  if (cpu === null || ram === null || gpu === null || disk === null) return null;
  return { cpu, ram, gpu, disk };
}

function parseUnlockedTowers(v: unknown, legacyUnlockAll: boolean): TowerKind[] {
  const out: TowerKind[] = [];
  if (Array.isArray(v)) {
    for (const k of v) {
      if (isTowerKind(k) && !out.includes(k)) out.push(k);
    }
  }
  // A pre-licence save carried `unlockAllTowers`; treat it as every gated kind licensed so an
  // in-flight run keeps the towers it was already using at wave 1. The flag is never written again.
  if (legacyUnlockAll) {
    for (const k of GATED_TOWER_KINDS) if (!out.includes(k)) out.push(k);
  }
  return out;
}

function parseTreeEffects(v: unknown): TreeEffects | null {
  if (!isObj(v)) return null;
  const startingWave = int(v.startingWave);
  const startSalvagePct = num(v.startSalvagePct);
  const startSalvageFlat = num(v.startSalvageFlat);
  const towerDamagePct = num(v.towerDamagePct);
  const pointerDamagePct = num(v.pointerDamagePct);
  const integrity = int(v.integrity);
  const costMultiplier = num(v.costMultiplier);
  const sellRefund = num(v.sellRefund);
  const repairSpeedMult = num(v.repairSpeedMult);
  const autoWave = bool(v.autoWave);
  const preloadGuns = int(v.preloadGuns);
  const startTier = int(v.startTier);
  const extraSpecsPerReboot = int(v.extraSpecsPerReboot);
  const rpGainMult = num(v.rpGainMult);
  if (startingWave === null || startSalvagePct === null || startSalvageFlat === null || towerDamagePct === null || pointerDamagePct === null || integrity === null || costMultiplier === null || sellRefund === null || repairSpeedMult === null || autoWave === null || preloadGuns === null || startTier === null || extraSpecsPerReboot === null || rpGainMult === null) return null;
  const unlockedTowers = parseUnlockedTowers(v.unlockedTowers, bool(v.unlockAllTowers) === true);
  return { startingWave, startSalvagePct, startSalvageFlat, towerDamagePct, pointerDamagePct, integrity, costMultiplier, sellRefund, repairSpeedMult, autoWave, preloadGuns, unlockedTowers, startTier, extraSpecsPerReboot, rpGainMult };
}

/**
 * Reconstruct a full RunState from a parsed save object, or null when anything is doubtful. Never
 * throws: every field is validated and the derived fields (grid, blocked, distance fields, auras)
 * are rebuilt from the authoritative towers.
 */
export function restoreRun(save: unknown, profile: Profile = defaultProfile()): RunState | null {
  if (!isObj(save)) return null;
  if (save.v !== RUN_SAVE_VERSION) return null;

  const level = parseLevel(save.level);
  if (level === null) return null;
  if (validateLevel(level) !== null) return null;

  const levelId = str(save.levelId);
  const routeCursor = int(save.routeCursor);
  const phaseRaw = str(save.phase);
  const wave = int(save.wave);
  const clearedWaves = int(save.clearedWaves);
  const integrity = int(save.integrity);
  if (levelId === null || routeCursor === null || phaseRaw === null || wave === null || clearedWaves === null || integrity === null) return null;
  if (!PHASES.includes(phaseRaw as Phase)) return null;
  if (integrity < 1 || integrity > MAX_INTEGRITY) return null;
  if (wave < 1) return null;
  if (routeCursor < 0) return null;
  const endless = bool(save.endless);
  if (endless === null) return null;
  if (wave > WAVE_COUNT && !endless) return null;

  const economy = parseEconomy(save.economy);
  const pointer = parsePointer(save.pointer);
  if (economy === null || pointer === null) return null;

  if (!Array.isArray(save.towers) || save.towers.length > MAX_TOWERS) return null;
  const towers: Tower[] = [];
  const blocked = new Set<number>();
  const occupied = new Set<number>();
  for (const t of save.towers) {
    const tower = parseTower(t);
    if (tower === null) return null;
    if (!inBounds(tower.col, tower.row)) return null;
    const idx = tower.row * COLS + tower.col;
    if (occupied.has(idx)) return null; // a tower on another tower
    occupied.add(idx);
    towers.push(tower);
  }

  if (!Array.isArray(save.enemies) || save.enemies.length > MAX_ENEMIES) return null;
  const enemies: Enemy[] = [];
  for (const e of save.enemies) {
    const enemy = parseEnemy(e);
    if (enemy === null) return null;
    enemies.push(enemy);
  }

  if (!Array.isArray(save.projectiles) || save.projectiles.length > MAX_PROJECTILES) return null;
  const projectiles: Projectile[] = [];
  for (const p of save.projectiles) {
    const projectile = parseProjectile(p);
    if (projectile === null) return null;
    projectiles.push(projectile);
  }

  if (!Array.isArray(save.mines) || save.mines.length > MAX_MINES) return null;
  const mines: Mine[] = [];
  for (const m of save.mines) {
    const mine = parseMine(m);
    if (mine === null) return null;
    mines.push(mine);
  }

  const runs = parseRuns(save.runs);
  if (runs === null) return null;

  const waveTick = int(save.waveTick);
  const clock = int(save.clock);
  const tick = int(save.tick);
  const nextId = int(save.nextId);
  if (waveTick === null || clock === null || tick === null || nextId === null) return null;

  const modifiers = strArray(save.modifiers);
  if (modifiers === null) return null;
  for (const m of modifiers) if (!MODIFIER_IDS.includes(m as ModifierId)) return null;

  const ad = save.ad === null || save.ad === undefined ? null : parseAd(save.ad);
  if (ad === null && save.ad !== null && save.ad !== undefined) return null;
  const tray = save.tray === null || save.tray === undefined ? null : parseTray(save.tray);
  if (tray === null && save.tray !== null && save.tray !== undefined) return null;

  // nextId must be above every id in use, so restored entities can never collide.
  let maxId = 0;
  for (const t of towers) if (t.id >= maxId) maxId = t.id + 1;
  for (const e of enemies) if (e.id >= maxId) maxId = e.id + 1;
  for (const p of projectiles) if (p.id >= maxId) maxId = p.id + 1;
  for (const m of mines) if (m.id >= maxId) maxId = m.id + 1;
  if (ad !== null && ad.id >= maxId) maxId = ad.id + 1;
  if (tray !== null && tray.id >= maxId) maxId = tray.id + 1;
  if (nextId < maxId) return null;

  const nextAdAttemptTick = int(save.nextAdAttemptTick);
  const towerDamageBuffTicks = int(save.towerDamageBuffTicks);
  const enemySlowTicks = int(save.enemySlowTicks);
  if (nextAdAttemptTick === null || towerDamageBuffTicks === null || enemySlowTicks === null) return null;

  const towerDisabledPairs = numPairs(save.towerDisabled);
  if (towerDisabledPairs === null) return null;
  const towerDisabled = new Map<number, number>(towerDisabledPairs);

  const rng = int(save.rng);
  if (rng === null) return null;

  const specs = parseSpecs(save.specs);
  const rp = int(save.rp);
  const rpEarned = int(save.rpEarned);
  const treeEffects = parseTreeEffects(save.treeEffects);
  if (specs === null || rp === null || rpEarned === null || treeEffects === null) return null;

  const achievementsRaw = strArray(save.achievements);
  if (achievementsRaw === null) return null;
  const achievements = new Set(achievementsRaw);

  const weakPointHits = int(save.weakPointHits);
  const adsDismissed = int(save.adsDismissed);
  const leaksByWavePairs = numPairs(save.leaksByWave);
  const flyerLeaksByWavePairs = numPairs(save.flyerLeaksByWave);
  const calledEarly = bool(save.calledEarly);
  const clearedWaveNoLeaks = bool(save.clearedWaveNoLeaks);
  const bossKilledByPointer = bool(save.bossKilledByPointer);
  const weakPointKills = int(save.weakPointKills);
  const critHits = int(save.critHits);
  const salvagePeak = int(save.salvagePeak);
  const soldTower = bool(save.soldTower);
  const earlyCallsInARow = int(save.earlyCallsInARow);
  const clearedFlawlessWave = bool(save.clearedFlawlessWave);
  const milestoneBossByPointer = bool(save.milestoneBossByPointer);
  const wallDamageTaken = num(save.wallDamageTaken);
  const paused = bool(save.paused);
  const speed: 1 | 2 | 3 | null = save.speed === 1 || save.speed === 2 || save.speed === 3 ? (save.speed as 1 | 2 | 3) : null;
  const onboarding = bool(save.onboarding);
  const placedFirstTower = bool(save.placedFirstTower);
  const autoWave = bool(save.autoWave);
  const autoWaveAtTick = int(save.autoWaveAtTick);
  const godMode = bool(save.godMode);
  const cheatsUsed = bool(save.cheatsUsed);
  if (weakPointHits === null || adsDismissed === null || leaksByWavePairs === null || flyerLeaksByWavePairs === null || calledEarly === null || clearedWaveNoLeaks === null || bossKilledByPointer === null || weakPointKills === null || critHits === null || salvagePeak === null || soldTower === null || earlyCallsInARow === null || clearedFlawlessWave === null || milestoneBossByPointer === null || wallDamageTaken === null || paused === null || speed === null || onboarding === null || placedFirstTower === null || autoWave === null || autoWaveAtTick === null || godMode === null || cheatsUsed === null) return null;

  const upgradesRaw = strArray(save.upgrades);
  if (upgradesRaw === null) return null;
  const upgrades: UpgradeId[] = [];
  for (const u of upgradesRaw) {
    if (!GLOBAL_UPGRADES.some((d) => d.id === u)) return null;
    upgrades.push(u as UpgradeId);
  }

  const emergencyPatchSpent = bool(save.emergencyPatchSpent);
  if (emergencyPatchSpent === null) return null;
  const buff = save.buff === null || save.buff === undefined ? null : parseBuff(save.buff);
  if (buff === null && save.buff !== null && save.buff !== undefined) return null;

  const pointerHits = int(save.pointerHits);
  const towersBuilt = int(save.towersBuilt);
  const towersSold = int(save.towersSold);
  const upgradesBought = int(save.upgradesBought);
  const branches = int(save.branches);
  const perfectWaves = int(save.perfectWaves);
  const perfectWaveStreak = int(save.perfectWaveStreak);
  const bossesKilled = int(save.bossesKilled);
  const bossKillsByPointer = int(save.bossKillsByPointer);
  const shieldsBroken = int(save.shieldsBroken);
  const adsExpired = int(save.adsExpired);
  const minesTriggered = int(save.minesTriggered);
  const repairsDone = int(save.repairsDone);
  const salvageSpentOnRepairs = int(save.salvageSpentOnRepairs);
  const toggleFlips = int(save.toggleFlips);
  const wallsBuilt = int(save.wallsBuilt);
  const flyersKilled = int(save.flyersKilled);
  const aaKills = int(save.aaKills);
  const cursorKills = int(save.cursorKills);
  const cursorRepairs = int(save.cursorRepairs);
  const earlyCalls = int(save.earlyCalls);
  const wavesAtThreeSpeed = int(save.wavesAtThreeSpeed);
  const waveAtThreeCounted = int(save.waveAtThreeCounted);
  const totalLeaks = int(save.totalLeaks);
  const integrityLowWater = int(save.integrityLowWater);
  const pausedTicks = num(save.pausedTicks);
  const reboots = int(save.reboots);
  const tree = strArray(save.tree);
  if (pointerHits === null || towersBuilt === null || towersSold === null || upgradesBought === null || branches === null || perfectWaves === null || perfectWaveStreak === null || bossesKilled === null || bossKillsByPointer === null || shieldsBroken === null || adsExpired === null || minesTriggered === null || repairsDone === null || salvageSpentOnRepairs === null || toggleFlips === null || wallsBuilt === null || flyersKilled === null || aaKills === null || cursorKills === null || cursorRepairs === null || earlyCalls === null || wavesAtThreeSpeed === null || waveAtThreeCounted === null || totalLeaks === null || integrityLowWater === null || pausedTicks === null || reboots === null || tree === null) return null;
  for (const id of tree) if (!isTreeNodeId(id)) return null;

  const cursorBuilt = bool(save.cursorBuilt);
  const clearedWave1NoLeak = bool(save.clearedWave1NoLeak);
  const killedBossKindsRaw = strArray(save.killedBossKinds);
  const waveSnapshots = parseWaveSnapshots(save.waveSnapshots);
  if (cursorBuilt === null || clearedWave1NoLeak === null || killedBossKindsRaw === null || waveSnapshots === null) return null;

  const clearedWallOnlyWave = bool(save.clearedWallOnlyWave);
  const clearedNoUpgradeWave = bool(save.clearedNoUpgradeWave);
  const clearedTwoKinds = bool(save.clearedTwoKinds);
  const clearedNoSpendWave = bool(save.clearedNoSpendWave);
  const clearedBossNoLeak = bool(save.clearedBossNoLeak);
  const clearedSellAllWave = bool(save.clearedSellAllWave);
  const clearedNoTowerWave = bool(save.clearedNoTowerWave);
  const soldTowerSameWave = bool(save.soldTowerSameWave);
  const calledEarlyBeforeTower = bool(save.calledEarlyBeforeTower);
  const wavesClearedSinceLeak = int(save.wavesClearedSinceLeak);
  const cheatSpawns = int(save.cheatSpawns);
  const salvageHitZeroThisWave = bool(save.salvageHitZeroThisWave);
  const towerOfflineThisWave = bool(save.towerOfflineThisWave);
  const shadowBroke = bool(save.shadowBroke);
  const maxBeamKills = int(save.maxBeamKills);
  const maxChainKills = int(save.maxChainKills);
  const maxSplashKills = int(save.maxSplashKills);
  const maxSlowCount = int(save.maxSlowCount);
  const beaconBuffKill = bool(save.beaconBuffKill);
  const cursorRepairsByTowerPairs = numPairs(save.cursorRepairsByTower);
  const pointerIdleTicks = int(save.pointerIdleTicks);
  const idleTowerKilled = bool(save.idleTowerKilled);
  const pointerKillTicks = numArray(save.pointerKillTicks);
  const idleTicks = int(save.idleTicks);
  const bossKilledByOverride = bool(save.bossKilledByOverride);
  const bossKilledAtOneIntegrity = bool(save.bossKilledAtOneIntegrity);
  const salvageSpent = int(save.salvageSpent);
  if (clearedWallOnlyWave === null || clearedNoUpgradeWave === null || clearedTwoKinds === null || clearedNoSpendWave === null || clearedBossNoLeak === null || clearedSellAllWave === null || clearedNoTowerWave === null || soldTowerSameWave === null || calledEarlyBeforeTower === null || wavesClearedSinceLeak === null || cheatSpawns === null || salvageHitZeroThisWave === null || towerOfflineThisWave === null || shadowBroke === null || maxBeamKills === null || maxChainKills === null || maxSplashKills === null || maxSlowCount === null || beaconBuffKill === null || cursorRepairsByTowerPairs === null || pointerIdleTicks === null || idleTowerKilled === null || pointerKillTicks === null || idleTicks === null || bossKilledByOverride === null || bossKilledAtOneIntegrity === null || salvageSpent === null) return null;

  const grid = createGrid(level);
  const toggles = level.toggles ?? [];
  const routes = levelRoutes(level);

  for (const tower of towers) blocked.add(tower.row * COLS + tower.col);

  const s: RunState = {
    grid,
    levelId,
    level,
    toggles,
    routes,
    routeFields: [],
    routeCursor,
    field: new Int32Array(grid.cols * grid.rows),
    breacherField: new Int32Array(grid.cols * grid.rows),
    ramField: new Int32Array(grid.cols * grid.rows),
    flyerField: new Int32Array(grid.cols * grid.rows),
    blocked,
    phase: phaseRaw as Phase,
    wave,
    clearedWaves,
    integrity,
    economy,
    pointer,
    towers,
    enemies,
    projectiles,
    mines,
    selected: null,
    selectedTowerId: null,
    runs,
    waveTick,
    clock,
    modifiers: modifiers as ModifierId[],
    endless,
    waveLimit: WAVE_COUNT,
    daily: null,
    tick,
    accumulator: 0,
    nextId,
    events: [],
    ad,
    adTipCursor: -1,
    nextAdAttemptTick,
    towerDamageBuffTicks,
    enemySlowTicks,
    towerDisabled,
    synergyRev: 0,
    synergyHoldSince: new Map(),
    synergyHoldTarget: new Map(),
    rng,
    viewport: {
      width: 1280,
      height: 800,
      window: { x: 24, y: 24, w: 1232, h: 752 },
      client: { x: 26, y: 70, w: 1228, h: 680 },
      boardCol: { x: 196, y: 70, w: 888, h: 680 },
      rightPanel: { x: 1086, y: 70, w: 168, h: 680 },
    },
    specs,
    rp,
    rpEarned,
    treeEffects,
    achievements,
    profile,
    notified: new Set(),
    profileDirty: false,
    weakPointHits,
    adsDismissed,
    leaksByWave: new Map(leaksByWavePairs),
    flyerLeaksByWave: new Map(flyerLeaksByWavePairs),
    calledEarly,
    clearedWaveNoLeaks,
    bossKilledByPointer,
    weakPointKills,
    critHits,
    salvagePeak,
    soldTower,
    earlyCallsInARow,
    clearedFlawlessWave,
    milestoneBossByPointer,
    wallDamageTaken,
    paused,
    speed,
    onboarding,
    placedFirstTower,
    autoWave,
    autoWaveAtTick,
    godMode,
    cheatsUsed,
    upgrades,
    emergencyPatchSpent,
    buff,
    tray,
    pointerHits,
    towersBuilt,
    towersSold,
    upgradesBought,
    branches,
    perfectWaves,
    perfectWaveStreak,
    bossesKilled,
    bossKillsByPointer,
    shieldsBroken,
    adsExpired,
    minesTriggered,
    repairsDone,
    salvageSpentOnRepairs,
    toggleFlips,
    wallsBuilt,
    flyersKilled,
    aaKills,
    cursorKills,
    cursorRepairs,
    earlyCalls,
    wavesAtThreeSpeed,
    waveAtThreeCounted,
    totalLeaks,
    integrityLowWater,
    pausedTicks,
    reboots,
    tree,
    cursorBuilt,
    clearedWave1NoLeak,
    killedBossKinds: new Set(killedBossKindsRaw),
    waveSnapshots,
    clearedWallOnlyWave,
    clearedNoUpgradeWave,
    clearedTwoKinds,
    clearedNoSpendWave,
    clearedBossNoLeak,
    clearedSellAllWave,
    clearedNoTowerWave,
    soldTowerSameWave,
    calledEarlyBeforeTower,
    wavesClearedSinceLeak,
    cheatSpawns,
    salvageHitZeroThisWave,
    towerOfflineThisWave,
    shadowBroke,
    maxBeamKills,
    maxChainKills,
    maxSplashKills,
    maxSlowCount,
    beaconBuffKill,
    cursorRepairsByTower: new Map(cursorRepairsByTowerPairs),
    pointerIdleTicks,
    idleTowerKilled,
    pointerKillTicks,
    idleTicks,
    bossKilledByOverride,
    bossKilledAtOneIntegrity,
    salvageSpent,
  };

  rebuildField(s);
  recomputeAuras(s.towers, s.clock);
  return s;
}

/** Load the run save from storage, or null when absent or doubtful (deleting a bad key). */
export function loadRunSave(profile?: Profile, storage?: StorageLike | null): RunState | null {
  const store = storage === undefined ? browserStorage() : storage;
  if (!store) return null;
  const p = profile ?? defaultProfile();
  try {
    const raw = store.getItem(RUN_SAVE_KEY);
    if (raw === null) return null;
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      store.removeItem(RUN_SAVE_KEY);
      return null;
    }
    const restored = restoreRun(data, p);
    if (restored === null) {
      store.removeItem(RUN_SAVE_KEY);
      return null;
    }
    return restored;
  } catch {
    try {
      store.removeItem(RUN_SAVE_KEY);
    } catch {
      // The key may already be gone; the game must still boot.
    }
    return null;
  }
}

/** Write the run save back, never throwing. A daily is never written to `pd.run.v1`. */
export function saveRun(state: RunState, storage?: StorageLike | null): void {
  if (state.daily !== null) return;
  const store = storage === undefined ? browserStorage() : storage;
  try {
    store?.setItem(RUN_SAVE_KEY, JSON.stringify(captureRun(state)));
  } catch {
    // Private browsing or quota: the run still plays, it just cannot be resumed.
  }
}

/** Delete the run save key, used on victory, integrity zero and Restart Windows. */
export function clearRunSave(storage?: StorageLike | null): void {
  const store = storage === undefined ? browserStorage() : storage;
  try {
    store?.removeItem(RUN_SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** Whether a save is present, for the main menu's Continue button. */
export function hasRunSave(storage?: StorageLike | null): boolean {
  const store = storage === undefined ? browserStorage() : storage;
  if (!store) return false;
  try {
    return store.getItem(RUN_SAVE_KEY) !== null;
  } catch {
    return false;
  }
}
