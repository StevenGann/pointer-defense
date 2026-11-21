import { towerName } from '../i18n/names.ts';
import {
  inBounds,
  tileAt,
  type Grid,
  type Tile,
} from './grid.ts';
import {
  createGrid,
  DEFAULT_LEVEL,
  LEVELS,
  levelRoutes,
  toggleCombinations,
  toggleIndex,
  toggleOpenAt,
  validateLevel,
  type Level,
  type LevelToggle,
  type Route,
} from './levels.ts';
import { buildAirField, buildField, buildRouteField, isSealed, pathTiles, stepToward } from './pathfield.ts';
import {
  AUTOLOADER_INTERVAL_MULT,
  BOUNTY_HP_MULT,
  BOUNTY_VALUE_MULT,
  BULK_DISCOUNT_CAP,
  BULK_DISCOUNT_PER_COPY,
  CHAIN_RADIUS,
  CHAIN_SPLASH_MULT,
  CHAIN_TARGETS,
  COMPOUND_INTEREST_RATE,
  COOLANT_OVERCLOCK_CAP,
  DOUBLE_BUFFER_MULT,
  EMERGENCY_PATCH_INTEGRITY,
  hasUpgrade,
  SALVAGE_CONTRACT_MULT,
  TELEMETRY_SPLASH_MULT,
  TELEMETRY_SPLASH_RANGE,
  WARRANTY_DAMAGE_MULT,
  WARRANTY_REPAIR_MULT,
  WIDE_RETICLE_SLACK,
  buffIntervalMult,
  buffKillMult,
  buffPointerMult,
  tickSystemTray,
  type BuffKind,
  type TrayPopup,
  type UpgradeId,
} from './upgrades.ts';
import {
  BASTION_SHIELD_LAYER_VALUE,
  baseEnemyKind,
  BREACHER_TURRET_DAMAGE,
  BREACHER_TURRET_INTERVAL_TICKS,
  BREACHER_TURRET_RANGE,
  CARRIER_BROOD_COUNT,
  CARRIER_BROOD_INTERVAL_TICKS,
  CARRIER_BROOD_SCATTER_TICKS,
  CARRIER_DEATH_BROOD_COUNT,
  createEnemy,
  FLYER_LANE_OFFSET_MAX,
  FLYER_SWAY_WAVELENGTH,
  FLYER_TAPER_EXIT_HOLD_TILES,
  FLYER_TAPER_EXIT_TILES,
  FLYER_TAPER_SPAWN_TILES,
  flyerSwayAmplitude,
  ENEMY_STATS,
  isFlyerKind,
  isBossKind,
  isPopupEnemy,
  isWeakPointHit,
  PACER_AURA_RADIUS,
  popupCovers,
  radiusOf,
  RAM_TOWER_DPS,
  RAM_TURRET_DAMAGE,
  RAM_TURRET_RANGE,
  slowFactorFor,
  speedPerTick,
  WIRECUTTER_EMP_RADIUS,
  WIRECUTTER_EMP_TICKS,
  type Enemy,
  type EnemyKind,
} from './enemies.ts';
import {
  createTower,
  CURSOR_CLICK_RANGE,
  CURSOR_REPAIR_THRESHOLD,
  CURSOR_TRAVEL_SPEED,
  CURSOR_WANDER_SPEED,
  cursorClickDamage,
  cursorClickIntervalTicks,
  cursorRadius,
  effectiveStats,
  isFullyUpgraded,
  isGateLocked,
  isGateOpen,
  isDown,
  isEmpDisabled,
  isMinesweeper,
  isOffline,
  isRepairing,
  isToggleGate,
  isTowerUnlocked,
  isWall,
  MINE_ARM_TICKS,
  MINE_BLAST_RADIUS,
  MINE_DAMAGE,
  MINE_EXPIRE_TICKS,
  MINE_INTERVAL_TICKS,
  MINE_LIVE_CAP,
  MINE_PLACE_RANGE,
  MINE_TRIGGER_RADIUS,
  recomputeAuras,
  refreshTowerHp,
  repairCost,
  repairDurationTicks,
  repairHealRate,
  repairHealTargets,
  repairHpToRestore,
  TOGGLE_LOCK_TICKS,
  TOWER_KINDS,
  TOWER_STATS,
  sellValue,
  upgradeCost,
  wallBlocksFlyers,
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
  clickDamage,
  CRIT_MULTIPLIER,
  holdDamagePerTick,
  MARKED_DAMAGE_MULT,
  MAX_OVERCLOCK_LEVEL,
  MAX_POINTER_STAGE,
  nextCritRoll,
  nextOverclockCost,
  nextStageCost,
  overclockCeiling,
  RETICLE_STICKY,
  type PointerStage,
  type PointerState,
} from './pointer.ts';
import {
  buildSchedule,
  earlyCallBonus,
  milestoneBossHpMult,
  milestoneBossKind,
  popupAliveCap,
  WAVE_COUNT,
  waveModifiers,
  type ModifierId,
  type Spawn,
} from './waves.ts';
import { AD_AUTOUPDATE_DAMAGE_MULT, AD_TIMEZONE_SPEED_MULT, tickAds, type Ad, type AdKind } from './ads.ts';
import {
  AA_SALVO_COUNT,
  MISSILE_ACCEL,
  MISSILE_HIT_RANGE,
  MISSILE_INITIAL_SPEED,
  MISSILE_LIFETIME_TICKS,
  MISSILE_MAX_SPEED,
  MISSILE_RETARGET_RANGE,
  MISSILE_TURN_RATE,
  missileSeed,
  SHELL_SPEED,
  type Projectile,
} from './projectiles.ts';
import { rngNext } from './rng.ts';
import { cheatsEnabled } from './cheats.ts';
import { ACHIEVEMENTS, type AchievementStats } from './achievements.ts';
import { secondsToTicks, TICK_HZ, TICK_MS } from './time.ts';
import {
  cloneProfile,
  defaultProfile,
  rpGain,
  SPEC_CAPS,
  specLevelCost,
  type Profile,
  type SpecKind,
  type SpecLevels,
} from './save.ts';
import { effectsFor, TREE_NODES, type TreeEffects } from './tree.ts';
import {
  AA_HOLD_CAP,
  AA_HOLD_WINDOW,
  buildSynergyLayout,
  spotterGrant,
  type SynergyCluster,
  type SynergyLayout,
} from './synergy.ts';

/**
 * The run state and the functions that change it.
 *
 * Everything here is deterministic and side-effect free outside the state object: no clocks, no
 * randomness, no rendering. For speed the reducers mutate the state they are given rather than
 * copying it; "pure" here means the next state depends only on the previous state and the input.
 */

export type Phase = 'build' | 'wave' | 'halted' | 'victory';

export const STARTING_INTEGRITY = 20;

/** How long auto-wave waits after the board clears before starting the next wave (1.5 s). */
export const AUTO_WAVE_DELAY_TICKS = secondsToTicks(1.5);

/** Bonus per RAM spec point, and the per-point damage/pointer multipliers (docs/design.md §12). */
export const RAM_SALVAGE_PER_POINT = 5;
const SPEC_DAMAGE_PCT_PER_POINT = 0.02;

/** The passive prestige bonus: +0.5% tower and pointer damage per prestige level (docs §12.1). */
const PRESTIGE_DAMAGE_PCT_PER_LEVEL = 0.005;

export function towerDamageMult(s: RunState): number {
  return 1 + SPEC_DAMAGE_PCT_PER_POINT * s.specs.cpu + s.treeEffects.towerDamagePct + s.rpEarned * PRESTIGE_DAMAGE_PCT_PER_LEVEL;
}

export function pointerDamageMult(s: RunState): number {
  return 1 + SPEC_DAMAGE_PCT_PER_POINT * s.specs.gpu + s.treeEffects.pointerDamagePct + s.rpEarned * PRESTIGE_DAMAGE_PCT_PER_LEVEL;
}

/**
 * The build cost of a tower kind, after the tree's cost multiplier. Bulk Requisition takes 4 % off
 * per copy of the kind already on the board, to -40 %; walls never count (docs/GLOBAL-UPGRADES.md).
 */
export function towerCost(s: RunState, kind: TowerKind): number {
  const base = Math.round(TOWER_STATS[kind].cost * s.treeEffects.costMultiplier);
  if (kind === 'wall' || !hasUpgrade(s, 'bulk-requisition')) return base;
  const copies = s.towers.filter((t) => t.kind === kind).length;
  return Math.floor(base * (1 - Math.min(BULK_DISCOUNT_CAP, BULK_DISCOUNT_PER_COPY * copies)));
}

/** The run-local overclock cap: 12, or 16 once Coolant Loop is owned. */
export function overclockCap(s: RunState): number {
  return hasUpgrade(s, 'coolant') ? COOLANT_OVERCLOCK_CAP : MAX_OVERCLOCK_LEVEL;
}

/**
 * The global-upgrade click and hold damage multiplier: Double-Buffered Click's x2, times System
 * Tray's Overdrive x2 while it is live (1 with neither).
 */
function pointerUpgradeMult(s: RunState): number {
  return (hasUpgrade(s, 'double-buffer') ? DOUBLE_BUFFER_MULT : 1) * buffPointerMult(s);
}

/** Wide Reticle: extra click hit-test slack (0 without it). */
function clickSlackBonus(s: RunState): number {
  return hasUpgrade(s, 'wide-reticle') ? WIDE_RETICLE_SLACK : 0;
}

/** Whether a tower kind is unlocked for this run (a licence unlocks it at wave 1). */
export function towerUnlocked(s: RunState, kind: TowerKind): boolean {
  return s.treeEffects.unlockedTowers.includes(kind) || isTowerUnlocked(kind, s.wave);
}

/** One-shot things that happened during a tick; the view drains `events` to spawn effects. */
export type GameEvent =
  | { type: 'kill'; x: number; y: number; reward: number; source: DamageSource; kind: EnemyKind; heading: number }
  | { type: 'leak'; x: number; y: number }
  | { type: 'popupEscaped'; x: number; y: number }
  | { type: 'shot'; towerId: number; x: number; y: number; splash: number }
  | { type: 'click'; x: number; y: number; hit: boolean }
  | { type: 'damage'; x: number; y: number; amount: number; weak: boolean; crit?: boolean; marked?: boolean; id: number; dirX?: number; dirY?: number }
  | { type: 'shieldHit'; x: number; y: number; absorbed: number; left: number }
  | { type: 'waveStarted'; wave: number }
  | { type: 'waveCleared'; wave: number; bonus: number }
  | { type: 'wallDamaged'; x: number; y: number; amount: number }
  | { type: 'wallDestroyed'; x: number; y: number }
  | { type: 'turretShot'; x: number; y: number; targetX: number; targetY: number }
  | { type: 'towerOffline'; x: number; y: number; towerId: number }
  | { type: 'adSpawned'; kind: AdKind }
  | { type: 'adDismissed'; kind: AdKind }
  | { type: 'traySpawned' }
  | { type: 'trayClaimed'; kind: BuffKind }
  | { type: 'toggleChanged'; index: number; open: boolean }
  | { type: 'towerUnlocked'; kinds: TowerKind[] }
  | { type: 'mineDetonated'; x: number; y: number }
  | { type: 'enemySpawned'; kind: EnemyKind };

/** One started wave's live spawn queue. Spawn ticks are relative to `startTick`. */
export interface WaveRun {
  wave: number;
  startTick: number;
  spawns: Spawn[];
}

/**
 * One started wave's opening snapshot, captured in `startWave` and read when the wave clears in
 * `clearDue`. It is what the per-wave achievements (docs/ACHIEVEMENTS.md "Per-wave snapshots") diff
 * against: whatever the player built, spent or lost during that one wave.
 */
export interface WaveSnapshot {
  salvage: number;
  salvageSpent: number;
  integrity: number;
  towersBuilt: number;
  wallsBuilt: number;
  towersSold: number;
  upgradesBought: number;
  branches: number;
  bossesKilled: number;
  /** Towers standing when the wave started, for the sell-everything shadow. */
  towerCount: number;
}

/** Identifies the active daily run, or null for a normal run. */
export interface DailyInfo {
  date: string;
  seed: number;
}

/** Optional overrides passed to `createRunState`, used by the daily to shorten and seed the run. */
export interface RunOptions {
  /** The wave the run ends in victory at; defaults to `WAVE_COUNT`. */
  waveLimit?: number;
  /** The active daily's date and seed, or null for a normal run. */
  daily?: DailyInfo | null;
  /** The seeded PRNG state; defaults to the daily's seed, then the constant boot seed. */
  seed?: number;
}

/** A Minesweeper's live mine, sitting on a path tile. */
export interface Mine {
  readonly id: number;
  readonly towerId: number;
  /** Tile-centre world position. */
  readonly x: number;
  readonly y: number;
  readonly placedTick: number;
  readonly armedAtTick: number;
  readonly expiresTick: number;
}

export interface RunState {
  grid: Grid;
  /** Authored map id (see levels.ts); carried in state so a cycle rebuilds the board. */
  levelId: string;
  /** The full authored map; custom maps from the codec/editor live here, not in LEVELS. */
  level: Level;
  /** Authored map toggles (shutters); each one's state is a pure function of `clock`. */
  toggles: readonly LevelToggle[];
  /** Authored map routes (empty when the level is a single implicit route). */
  routes: readonly Route[];
  /** One distance field per route; empty when `routes` is empty (the whole board uses `field`). */
  routeFields: Int32Array[];
  /** Spawn counter for the seeded alternating route assignment (reset on a map cycle). */
  routeCursor: number;
  /** Distance-in-tiles to the exit for every walkable, unblocked tile; -1 unreachable. */
  field: Int32Array;
  /** Ground field for breachers: walls are walkable, other towers still block. */
  breacherField: Int32Array;
  /** Ground field for the Ram: only terrain and closed toggles block; towers are chewed, not routed around. */
  ramField: Int32Array;
  /** Air field for flyers: only Mesh walls block, terrain and other towers are ignored. */
  flyerField: Int32Array;
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
  /** In-flight projectiles (AA shells and missiles), ticked with the fixed timestep. */
  projectiles: Projectile[];
  /** Live mines laid by Minesweepers, sitting on path tiles. */
  mines: Mine[];
  /** Tower kind armed for placement, or null. UI selection, but kept here so the sim validates it. */
  selected: TowerKind | null;
  /** Placed tower selected for inspection, or null. Mutually exclusive with `selected`. */
  selectedTowerId: number | null;
  /** Started waves still in flight, in the order they began. Several may run at once. */
  runs: WaveRun[];
  /** Ticks since the most recent wave started (ads and the early-call bonus depend on it). */
  waveTick: number;
  /** Monotonic run clock, incremented once per tick and never reset. */
  clock: number;
  /** Modifiers active for the current wave (empty outside a wave). */
  modifiers: readonly ModifierId[];
  /** True once the player chose Endless after clearing wave 100. */
  endless: boolean;
  /** The wave the run ends in victory at (WAVE_COUNT for a normal run, 30 for a daily). */
  waveLimit: number;
  /** The active daily's date and seed, or null for a normal run. */
  daily: DailyInfo | null;
  /** Total ticks simulated this run. */
  tick: number;
  /** Leftover real time not yet simulated (ms); see step(). */
  accumulator: number;
  nextId: number;
  /** One-shot events produced since the view last drained them. */
  events: GameEvent[];
  /** The live desktop ad, or null. */
  ad: Ad | null;
  /** Ad-tip cursor: which pool entry the next ad shows; -1 until the first tip seeds it (docs/ADS-TIPS.md §2.3). */
  adTipCursor: number;
  /** Tick when the next ad spawn may be attempted. */
  nextAdAttemptTick: number;
  /** Ticks remaining on the AutoUpdate tower damage buff. */
  towerDamageBuffTicks: number;
  /** Ticks remaining on the Time Zone enemy slow. */
  enemySlowTicks: number;
  /** Tower id -> ticks remaining it is disabled. */
  towerDisabled: Map<number, number>;
  /** Bumped whenever towers change, invalidating the memoised synergy clusters (docs/SYNERGIES.md §4.4). */
  synergyRev: number;
  /** Tower id -> the tick a held shot began; cleared whenever clusters are rebuilt. */
  synergyHoldSince: Map<number, number>;
  /** Tower id -> the enemy a held shot is waiting to fire at; cleared with `synergyHoldSince`. */
  synergyHoldTarget: Map<number, number>;
  /** Seeded PRNG state (see rng.ts). */
  rng: number;
  /** Desktop geometry for ad placement, updated by the view on resize. */
  viewport: {
    width: number;
    height: number;
    window: { x: number; y: number; w: number; h: number };
    client: { x: number; y: number; w: number; h: number };
    boardCol: { x: number; y: number; w: number; h: number };
    leftPanel?: { x: number; y: number; w: number; h: number };
    rightPanel?: { x: number; y: number; w: number; h: number };
  };
  /** Permanent spec levels applied to this run (mirrors the profile, drives the bonuses). */
  specs: SpecLevels;
  /** Unspent Restore Points — the currency the Restore tree and spec levels spend. */
  rp: number;
  /** Lifetime Restore Points earned — the prestige level (drives the passive bonus). */
  rpEarned: number;
  /** The profile's Restore-tree effects, merged into one value (identity for an empty tree). */
  treeEffects: TreeEffects;
  /** Achievement ids unlocked so far this run (seeded from the profile). */
  achievements: Set<string>;
  /** The live profile backing this run; the unlock rules read it for cross-run counters. */
  profile: Profile;
  /** Achievement ids recorded from outside the sim (a hover, a resize, an editor action). */
  notified: Set<string>;
  /** Set once the sim mutates a profile counter that the view must persist. */
  profileDirty: boolean;
  /** Weak-point hits this run, for the sharpshooter achievement. */
  weakPointHits: number;
  /** Ads dismissed this run, for the ad-collector achievement. */
  adsDismissed: number;
  /** Leaks counted per wave number, so an early call cannot poison or rescue another wave's record. */
  leaksByWave: Map<number, number>;
  /** Flyer leaks per wave number (a subset of leaksByWave), for the balance harness. */
  flyerLeaksByWave: Map<number, number>;
  /** True once the player has called a wave early this run. */
  calledEarly: boolean;
  /** True once a wave at 40+ has been cleared with zero leaks this run. */
  clearedWaveNoLeaks: boolean;
  /** True once a boss has died to the pointer without any tower having touched it. */
  bossKilledByPointer: boolean;
  /** Kills landed on an enemy's weak point this run, for the deadeye achievement. */
  weakPointKills: number;
  /** Critical hits landed by the pointer this run, for the lucky-streak achievement. */
  critHits: number;
  /** The most salvage held at once this run, for the deep-pockets achievement. */
  salvagePeak: number;
  /** True once the player has sold a tower this run, gating the pack-rat achievement. */
  soldTower: boolean;
  /** Consecutive waves called early this run, for the speedrunner achievement. */
  earlyCallsInARow: number;
  /** True once any wave has been cleared with zero leaks this run. */
  clearedFlawlessWave: boolean;
  /** True once a milestone-wave boss has died to a pointer hit. */
  milestoneBossByPointer: boolean;
  /** Cumulative wall hit points removed by breachers this run (for the balance harness). */
  wallDamageTaken: number;
  /** Simulation paused by P: the view keeps rendering, the sim clock stands still. */
  paused: boolean;
  /** Speed multiplier fed into the accumulator (1, 2 or 3); never applied to the fixed tick. */
  speed: 1 | 2 | 3;
  /** A fresh profile (no achievements, no reboots) — gates the first-run onboarding. */
  onboarding: boolean;
  /** True once the player has placed a tower this run — hides the onboarding hints. */
  placedFirstTower: boolean;
  /** Auto-wave: start the next wave 1.5 s after the board clears (persisted in the profile). */
  autoWave: boolean;
  /** Simulation clock tick at which a pending auto-wave countdown fires (0 = no countdown). */
  autoWaveAtTick: number;
  /** Cheats: God Mode on — integrity never falls and salvage is kept at a large ceiling. */
  godMode: boolean;
  /** Cheats: true the moment any cheat is used this run; the run then records nothing. */
  cheatsUsed: boolean;
  /** Global upgrades bought this run, in purchase order. Cleared by createRunState. */
  upgrades: UpgradeId[];
  /** Emergency Patch: set once it has eaten a killing leak. */
  emergencyPatchSpent: boolean;
  /**
   * System Tray's active buff. `until` is a sim clock tick, not wall time, so pause and speed are
   * free. Phase 2 — see docs/GLOBAL-UPGRADES.md §5.
   */
  buff: { kind: 'turbo' | 'overdrive' | 'windfall'; until: number } | null;
  /** System Tray's System Update pop-up while one is on screen (at most one). */
  tray: TrayPopup | null;

  // --- Achievement counters (populated by buildStats once per tick) --------------------------
  /** Pointer hits that landed on an enemy this run. */
  pointerHits: number;
  /** Towers built this run (all kinds). */
  towersBuilt: number;
  /** Towers sold this run (soldTower is the boolean gate). */
  towersSold: number;
  /** Tower upgrades bought this run. */
  upgradesBought: number;
  /** Branch choices made this run. */
  branches: number;
  /** Waves cleared with zero leaks this run. */
  perfectWaves: number;
  /** Consecutive perfect waves (reset by any leak). */
  perfectWaveStreak: number;
  /** Bosses killed this run. */
  bossesKilled: number;
  /** Bosses killed by a pointer hit (the final blow) this run. */
  bossKillsByPointer: number;
  /** Shields fully broken this run (including Bastion layers). */
  shieldsBroken: number;
  /** Ads that expired without being closed this run. */
  adsExpired: number;
  /** Mines triggered this run. */
  minesTriggered: number;
  /** Repair jobs completed this run (manual or cursor). */
  repairsDone: number;
  /** Salvage spent on repairs this run. */
  salvageSpentOnRepairs: number;
  /** Map toggle (shutter) flips this run. */
  toggleFlips: number;
  /** Walls built this run. */
  wallsBuilt: number;
  /** Flyers killed this run. */
  flyersKilled: number;
  /** Kills scored by an AA tower this run. */
  aaKills: number;
  /** Kills scored by a Cursor tower this run. */
  cursorKills: number;
  /** Repairs started by a Maintenance cursor this run. */
  cursorRepairs: number;
  /** Waves called early this run (total, not the streak). */
  earlyCalls: number;
  /** Waves played at 3× speed this run. */
  wavesAtThreeSpeed: number;
  /** The wave most recently counted for wavesAtThreeSpeed, or -1. */
  waveAtThreeCounted: number;
  /** Total enemies leaked this run. */
  totalLeaks: number;
  /** The lowest integrity reached this run. */
  integrityLowWater: number;
  /** Ticks spent paused (accumulated wall-clock, not sim ticks). */
  pausedTicks: number;
  /** Profile reboot count at run start (frozen snapshot for meta achievements). */
  reboots: number;
  /** The profile's owned Restore-tree node ids (frozen snapshot). */
  tree: string[];
  /** True once a Cursor tower has been built this run. */
  cursorBuilt: boolean;
  /** True once wave 1 has been cleared with no leak. */
  clearedWave1NoLeak: boolean;
  /** The boss kinds killed this run (for the named boss achievements). */
  killedBossKinds: Set<string>;

  // --- Per-wave snapshots (captured in startWave, read in clearDue) ----------------------------
  waveSnapshots: Map<number, WaveSnapshot>;
  /** True once a wave cleared with only walls built that wave and no damage tower standing. */
  clearedWallOnlyWave: boolean;
  /** True once a wave 30+ cleared with every tower still tier 1. */
  clearedNoUpgradeWave: boolean;
  /** True once a wave 40+ cleared with exactly two tower kinds standing. */
  clearedTwoKinds: boolean;
  /** True once a wave cleared with no salvage spent during it. */
  clearedNoSpendWave: boolean;
  /** True once a milestone boss died in a wave whose integrity never moved. */
  clearedBossNoLeak: boolean;
  /** True once every tower standing at wave start was sold and the wave still cleared. */
  clearedSellAllWave: boolean;
  /** True once a wave cleared with no tower built during that wave (pointer-only). */
  clearedNoTowerWave: boolean;
  /** True once a tower was sold in the same wave it was built (sell-profit). */
  soldTowerSameWave: boolean;
  /** True once a wave was called early before any tower was built (early-call-wave-1). */
  calledEarlyBeforeTower: boolean;
  /** Consecutive waves cleared since the last leak (leak-recovery). */
  wavesClearedSinceLeak: number;
  /** Enemies spawned from the cheat menu this run (shadow-printer). */
  cheatSpawns: number;
  /** True while this wave has seen salvage hit zero (shadow-broke). */
  salvageHitZeroThisWave: boolean;
  /** True while this wave has seen a tower go offline (shadow-broke). */
  towerOfflineThisWave: boolean;
  /** True once salvage hit zero and a tower went offline in the same wave (shadow-broke). */
  shadowBroke: boolean;

  // --- Per-shot / per-wave tallies (the group B and A rules) -----------------------------------
  /** Max enemies a single beam (Laser) killed in one shot. */
  maxBeamKills: number;
  /** Max enemies a single Taser chain killed in one shot. */
  maxChainKills: number;
  /** Max enemies a single Cannon shell's splash killed. */
  maxSplashKills: number;
  /** Highest number of enemies slowed at once (Frost and the like). */
  maxSlowCount: number;
  /** True once a tower buffed by three beacons landed a kill. */
  beaconBuffKill: boolean;
  /** Repairs started by each Maintenance cursor, keyed by tower id. */
  cursorRepairsByTower: Map<number, number>;

  // --- Timers and view/OS flags (group D) -------------------------------------------------------
  /** Ticks since the pointer last fired; reset on any pointer click. */
  pointerIdleTicks: number;
  /** True once a tower killed during the current pointer-idle window. */
  idleTowerKilled: boolean;
  /** Recent pointer-kill ticks, pruned to a 10 s window (click-combo). */
  pointerKillTicks: number[];
  /** Ticks since the last player input (idle-hour). */
  idleTicks: number;
  /** True once a boss died while Manual Override was on. */
  bossKilledByOverride: boolean;
  /** True once a boss died while integrity was exactly 1. */
  bossKilledAtOneIntegrity: boolean;
  /** Salvage spent this run (no-spend-wave diffs it per wave). */
  salvageSpent: number;
}

export function createRunState(profile: Profile = defaultProfile(), level: Level = DEFAULT_LEVEL, opts: RunOptions = {}): RunState {
  const reason = validateLevel(level);
  if (reason !== null) throw new Error(`Level ${level.id} rejected: ${reason}`);
  const daily = opts.daily ?? null;
  const waveLimit = opts.waveLimit ?? WAVE_COUNT;
  const grid = createGrid(level);
  const blocked = new Set<number>();
  const toggles = level.toggles ?? [];
  const routes = levelRoutes(level);
  const specs: SpecLevels = {
    cpu: profile.specs.cpu,
    ram: profile.specs.ram,
    gpu: profile.specs.gpu,
    disk: profile.specs.disk,
  };
  const treeEffects = effectsFor(profile);
  const startSalvage =
    STARTING_SALVAGE + specs.ram * RAM_SALVAGE_PER_POINT + treeEffects.startSalvageFlat + Math.floor(profile.lastSalvage * treeEffects.startSalvagePct);
  const startIntegrity = STARTING_INTEGRITY + specs.disk + treeEffects.integrity;
  const exit = level.exits[0];
  const s: RunState = {
    grid,
    levelId: level.id,
    level,
    toggles,
    routes,
    routeFields: buildRouteFields(grid, initialGroundBlocked(toggles), exit, routes),
    routeCursor: 0,
    field: buildField(grid, initialGroundBlocked(toggles), exit),
    breacherField: buildField(grid, blocked, exit),
    ramField: buildField(grid, initialGroundBlocked(toggles), exit),
    flyerField: buildAirField(grid.cols, grid.rows, blocked, exit),
    blocked,
    phase: 'build',
    wave: treeEffects.startingWave,
    clearedWaves: 0,
    integrity: startIntegrity,
    economy: createEconomy(startSalvage),
    pointer: createPointer(),
    towers: [],
    enemies: [],
    projectiles: [],
    mines: [],
    selected: null,
    selectedTowerId: null,
    runs: [],
    waveTick: 0,
    clock: 0,
    modifiers: [],
    endless: false,
    waveLimit,
    daily,
    tick: 0,
    accumulator: 0,
    nextId: 1,
    events: [],
    ad: null,
    adTipCursor: -1,
    nextAdAttemptTick: 0,
    towerDamageBuffTicks: 0,
    enemySlowTicks: 0,
    towerDisabled: new Map(),
    synergyRev: 0,
    synergyHoldSince: new Map(),
    synergyHoldTarget: new Map(),
    rng: opts.seed ?? daily?.seed ?? 0x9e3779b9,
    viewport: {
      width: 1280,
      height: 800,
      window: { x: 24, y: 24, w: 1232, h: 752 },
      client: { x: 26, y: 70, w: 1228, h: 680 },
      boardCol: { x: 196, y: 70, w: 888, h: 680 },
      rightPanel: { x: 1086, y: 70, w: 168, h: 680 },
    },
    specs,
    rp: profile.rp,
    rpEarned: profile.rpEarned,
    treeEffects,
    achievements: new Set(profile.achievements),
    profile,
    notified: new Set(),
    profileDirty: false,
    weakPointHits: 0,
    adsDismissed: 0,
    leaksByWave: new Map(),
    flyerLeaksByWave: new Map(),
    calledEarly: false,
    clearedWaveNoLeaks: false,
    bossKilledByPointer: false,
    weakPointKills: 0,
    critHits: 0,
    salvagePeak: startSalvage,
    soldTower: false,
    earlyCallsInARow: 0,
    clearedFlawlessWave: false,
    milestoneBossByPointer: false,
    wallDamageTaken: 0,
    paused: false,
    speed: 1,
    onboarding: profile.reboots === 0 && profile.achievements.length === 0,
    placedFirstTower: false,
    autoWave: profile.autoWave || treeEffects.autoWave,
    autoWaveAtTick: 0,
    godMode: false,
    cheatsUsed: false,
    upgrades: [],
    emergencyPatchSpent: false,
    buff: null,
    tray: null,
    pointerHits: 0,
    towersBuilt: 0,
    towersSold: 0,
    upgradesBought: 0,
    branches: 0,
    perfectWaves: 0,
    perfectWaveStreak: 0,
    bossesKilled: 0,
    bossKillsByPointer: 0,
    shieldsBroken: 0,
    adsExpired: 0,
    minesTriggered: 0,
    repairsDone: 0,
    salvageSpentOnRepairs: 0,
    toggleFlips: 0,
    wallsBuilt: 0,
    flyersKilled: 0,
    aaKills: 0,
    cursorKills: 0,
    cursorRepairs: 0,
    earlyCalls: 0,
    wavesAtThreeSpeed: 0,
    waveAtThreeCounted: -1,
    totalLeaks: 0,
    integrityLowWater: startIntegrity,
    pausedTicks: 0,
    reboots: profile.reboots,
    tree: [...profile.tree],
    cursorBuilt: false,
    clearedWave1NoLeak: false,
    killedBossKinds: new Set(),
    waveSnapshots: new Map(),
    clearedWallOnlyWave: false,
    clearedNoUpgradeWave: false,
    clearedTwoKinds: false,
    clearedNoSpendWave: false,
    clearedBossNoLeak: false,
    clearedSellAllWave: false,
    clearedNoTowerWave: false,
    soldTowerSameWave: false,
    calledEarlyBeforeTower: false,
    wavesClearedSinceLeak: 0,
    cheatSpawns: 0,
    salvageHitZeroThisWave: false,
    towerOfflineThisWave: false,
    shadowBroke: false,
    maxBeamKills: 0,
    maxChainKills: 0,
    maxSplashKills: 0,
    maxSlowCount: 0,
    beaconBuffKill: false,
    cursorRepairsByTower: new Map(),
    pointerIdleTicks: 0,
    idleTowerKilled: false,
    pointerKillTicks: [],
    idleTicks: 0,
    bossKilledByOverride: false,
    bossKilledAtOneIntegrity: false,
    salvageSpent: 0,
  };
  preloadTowers(s);
  rebuildField(s);
  return s;
}

/** Place the Preload node's free Gun towers near the spawn, without spending salvage. */
function preloadTowers(s: RunState): void {
  const count = s.treeEffects.preloadGuns;
  if (count <= 0) return;
  const spawn = spawnTile(s);
  const offsets: readonly (readonly [number, number])[] = [
    [1, 0],
    [1, -1],
    [1, 1],
    [2, 0],
    [2, -1],
    [2, 1],
    [3, 0],
    [3, -1],
    [3, 1],
    [1, -2],
    [1, 2],
    [0, -1],
    [0, 1],
  ];
  let placed = 0;
  for (const [dc, dr] of offsets) {
    if (placed >= count) break;
    const col = spawn.col + dc;
    const row = spawn.row + dr;
    if (!inBounds(col, row)) continue;
    if (tileAt(s.grid, col, row) !== 'buildable') continue;
    if (toggleAtTile(s, col, row)) continue;
    if (towerAt(s, col, row)) continue;
    const idx = row * s.grid.cols + col;
    if (wouldSeal(s, idx)) continue;
    const tower = createTower(s.nextId++, 'gun', col, row);
    tower.placedTick = s.clock;
    tower.builtWave = s.wave;
    if (s.treeEffects.startTier > 1) {
      tower.tier = s.treeEffects.startTier as Tier;
      refreshTowerHp(tower);
    }
    s.blocked.add(idx);
    s.towers.push(tower);
    placed++;
  }
}

// ---------------------------------------------------------------------------------------------
// Queries

/** The single spawn tile of the current level; the gate accessor every end-of-route read uses. */
export function spawnTile(s: RunState): Tile {
  return s.level.starts[0];
}

/** The single exit tile of the current level. */
export function exitTile(s: RunState): Tile {
  return s.level.exits[0];
}

/** Map selection is only offered before wave 1, with no towers placed (and never in a daily). */
export function canCycleLevel(s: RunState): boolean {
  if (s.daily !== null) return false;
  return s.phase === 'build' && s.wave === 0 && s.towers.length === 0;
}

/** Advance to the next authored map, rebuilding the grid and path field. Refused after the run starts. */
export function cycleLevel(s: RunState): boolean {
  if (!canCycleLevel(s)) return false;
  const idx = LEVELS.findIndex((l) => l.id === s.levelId);
  const next = LEVELS[(idx + 1 + LEVELS.length) % LEVELS.length];
  const reason = validateLevel(next);
  if (reason !== null) throw new Error(`Level ${next.id} rejected: ${reason}`);
  s.levelId = next.id;
  s.level = next;
  s.grid = createGrid(next);
  s.blocked = new Set();
  s.toggles = next.toggles ?? [];
  s.routes = levelRoutes(next);
  s.routeCursor = 0;
  rebuildField(s);
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
  if (!towerUnlocked(s, kind)) return false;
  if (!inBounds(col, row) || tileAt(s.grid, col, row) !== 'buildable') return false;
  if (toggleAtTile(s, col, row)) return false; // toggles are permanent map elements
  if (noBuildActive(s)) return false;
  if (towerAt(s, col, row)) return false;
  if (!canAfford(s.economy, towerCost(s, kind))) return false;
  return !wouldSeal(s, row * s.grid.cols + col);
}

/** The live enemy under a world point, preferring the one furthest along the lane. */
export function enemyAt(s: RunState, x: number, y: number, slack = CLICK_SLACK): Enemy | undefined {
  let best: Enemy | undefined;
  for (const e of s.enemies) {
    if (e.dead) continue;
    if (isPopupEnemy(e)) continue; // the window is not pointer-targetable; only its close box is
    const r = radiusOf(e) + slack;
    if ((e.x - x) ** 2 + (e.y - y) ** 2 <= r * r && (!best || e.dist > best.dist)) best = e;
  }
  return best;
}

export function isFinalWave(s: RunState): boolean {
  return !s.endless && s.wave >= s.waveLimit;
}

/** The status-bar message every blocked No-Build action surfaces (docs/design.md §8). */
export const NO_BUILD_MESSAGE = 'No-Build — the board is frozen this wave';

/** True while a wave with the no-build modifier is running: the whole board is frozen. */
export function noBuildActive(s: RunState): boolean {
  return s.modifiers.includes('no-build') && s.phase === 'wave';
}

/** Tower range multiplier from the fog modifier (docs/design.md §8.3). */
export function towerRangeMult(s: RunState): number {
  return s.modifiers.includes('fog') ? 0.8 : 1;
}

/**
 * A tower's range in tiles before the run's range multiplier: its own range, its aura padding, and
 * whatever a `spotter` row hands over. The gift is an absolute range rather than a bonus, and it is
 * resolved here instead of in the layout because whether a Marksman is offline or EMP'd changes with
 * the clock while the layout is memoised on the roster.
 */
export function synergyRange(s: RunState, t: Tower, st: EffectiveStats = effectiveStats(t)): number {
  const own = st.range + t.auraRange;
  const sources = synergyLayout(s).spotterSources.get(t.id);
  if (sources === undefined) return own;
  let granted = 0;
  for (const source of sources) {
    if (isDown(source, s.clock)) continue; // an offline or EMP'd Marksman spots nothing
    const g = spotterGrant(source);
    if (g > granted) granted = g;
  }
  return granted === 0 ? own : Math.max(own, granted);
}

/**
 * The range a shot, a range ring or a tooltip must use: {@link synergyRange} with the run's range
 * modifier applied. Every consumer goes through this pair, so a spotted tower cannot shoot further
 * than it draws, or hold a target it cannot reach.
 */
export function effectiveRange(s: RunState, t: Tower, st: EffectiveStats = effectiveStats(t)): number {
  return synergyRange(s, t, st) * towerRangeMult(s);
}

// ---------------------------------------------------------------------------------------------
// Tower status helpers (docs/TOWER-AURAS.md)

/**
 * Ids of the towers a Repair tower is healing this tick. Recomputes the exact targets
 * `tickRepairAuras` reads (`repairHealTargets`), so a visual can never claim a heal the sim did not
 * apply. A tower healed by several Repair towers still appears once.
 */
export function healedTowerIds(s: RunState): Set<number> {
  const ids = new Set<number>();
  for (const h of s.towers) {
    if (h.kind !== 'repair' || isDown(h, s.clock)) continue;
    if (isRepairing(h, s.clock)) continue;
    for (const t of repairHealTargets(s.towers, h, s.clock)) ids.add(t.id);
  }
  return ids;
}

/**
 * The buffs on each tower id: `beacon` when a live Beacon's aura reaches it, `override` when Manual
 * Override has a marked target in range. Reads the same geometry `recomputeAuras` and `fireTowers`
 * use, so the view and the sim cannot drift apart.
 */
export function towerAuraSources(s: RunState): Map<number, Set<'beacon' | 'override'>> {
  const out = new Map<number, Set<'beacon' | 'override'>>();
  for (const t of s.towers) out.set(t.id, new Set());

  for (const b of s.towers) {
    if (b.kind !== 'beacon' || isDown(b, s.clock)) continue;
    const st = effectiveStats(b);
    if (st.auraDamage <= 0 && st.auraRange <= 0) continue;
    const r = st.range;
    for (const t of s.towers) {
      if (t.id === b.id) continue;
      if (t.kind === 'cursor') continue; // pointer-derived damage; tower auras never reach it
      const dx = t.col + 0.5 - (b.col + 0.5);
      const dy = t.row + 0.5 - (b.row + 0.5);
      if (dx * dx + dy * dy <= r * r) out.get(t.id)!.add('beacon');
    }
  }

  if (s.pointer.manualOverride && s.pointer.targetId !== null) {
    const marked = s.enemies.find((e) => e.id === s.pointer.targetId && !e.dead);
    if (marked) {
      for (const t of s.towers) {
        if ((s.towerDisabled.get(t.id) ?? 0) > 0) continue; // disabled by Blue Screen
        if (isDown(t, s.clock)) continue;
        if (isMinesweeper(t)) continue;
        const st = effectiveStats(t);
        if (st.damage <= 0 || st.fireInterval <= 0) continue;
        const range = effectiveRange(s, t, st);
        if (
          towerCanHurt(s, marked) &&
          (!st.targetsFlyersOnly || baseEnemyKind(marked.kind) === 'flyer') &&
          inRange(t, marked, range)
        ) {
          out.get(t.id)!.add('override');
        }
      }
    }
  }

  return out;
}

/** Ids of towers currently knocked out by a Wirecutter EMP or a Blue Screen ad. */
export function disabledTowerIds(s: RunState): Set<number> {
  const ids = new Set<number>();
  for (const t of s.towers) {
    if (isEmpDisabled(t, s.clock) || (s.towerDisabled.get(t.id) ?? 0) > 0) ids.add(t.id);
  }
  return ids;
}

// ---------------------------------------------------------------------------------------------
// Player actions (reducers)

export function selectTower(s: RunState, kind: TowerKind | null): void {
  if (kind !== null && !towerUnlocked(s, kind)) return;
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
  const cost = towerCost(s, kind);
  spend(s.economy, cost);
  s.salvageSpent += cost;
  s.idleTicks = 0;
  s.blocked.add(row * s.grid.cols + col);
  const tower = createTower(s.nextId++, kind, col, row);
  tower.placedTick = s.clock;
  tower.builtWave = s.wave;
  if (s.treeEffects.startTier > 1) {
    tower.tier = s.treeEffects.startTier as Tier;
    refreshTowerHp(tower);
  }
  if (kind === 'cursor') {
    // The cursor's wander is a deterministic path seeded from the run's PRNG stream and the tower
    // id: the same seed reproduces the same wander, and a different seed drifts differently.
    const r = rngNext(s.rng);
    s.rng = r.next;
    tower.cursorWanderSeed = seedCursorWander(r.value, tower.id);
    tower.cursorWanderAngle = r.value * Math.PI * 2;
  }
  s.towers.push(tower);
  s.towersBuilt++;
  if (kind === 'wall') s.wallsBuilt++;
  if (kind === 'cursor') s.cursorBuilt = true;
  s.synergyRev++;
  rebuildField(s);
  recomputeAuras(s.towers, s.clock);
  s.placedFirstTower = true;
  return true;
}

/** Derive a cursor's wander PRNG seed from the run's seeded stream and the tower id. */
function seedCursorWander(value: number, id: number): number {
  return ((Math.floor(value * 0x100000000) | 0) ^ Math.imul(id, 0x6d2b79f5)) | 0;
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

/** Every route creeps can take right now, for drawing; a single implicit route is a one-element list. */
export function currentRoutes(s: RunState): readonly Tile[][] {
  const spawn = spawnTile(s);
  if (s.routeFields.length === 0) return [pathTiles(s.field, spawn)];
  return s.routeFields.map((field) => pathTiles(field, spawn));
}

/** The primary route creeps take right now, for the HUD and the long-road achievement. */
export function currentPath(s: RunState): Tile[] {
  return currentRoutes(s)[0];
}

/** The authored toggle on a tile, if any. */
export function toggleAtTile(s: RunState, col: number, row: number): LevelToggle | undefined {
  return s.toggles.find((t) => t.col === col && t.row === row);
}

/**
 * The set of tile indices blocked by towers alone: every tower but an open Toggle gate and a wall
 * that is mid-repair (both are walkable, so the route can cut straight through them).
 */
function towerBlockedSet(s: RunState): Set<number> {
  const out = new Set<number>();
  for (const i of s.blocked) {
    const col = i % s.grid.cols;
    const row = (i - col) / s.grid.cols;
    const t = towerAt(s, col, row);
    if (!t || (!isGateOpen(t) && !isRepairing(t, s.clock))) out.add(i);
  }
  return out;
}

/** The set of tile indices that block ground pathing: towers plus closed map toggles. */
function groundBlocked(s: RunState): Set<number> {
  const out = towerBlockedSet(s);
  for (const t of s.toggles) if (!toggleOpenAt(t, s.clock)) out.add(toggleIndex(t));
  return out;
}

/** The set of tile indices that block ground pathing at the start of a run (clock 0). */
function initialGroundBlocked(toggles: readonly LevelToggle[]): Set<number> {
  const out = new Set<number>();
  for (const t of toggles) if (!toggleOpenAt(t, 0)) out.add(toggleIndex(t));
  return out;
}

/**
 * Whether placing a tower on tile `idx` would seal the spawn-to-exit route in any combination of
 * map-toggle states, not just the current one.
 */
function wouldSeal(s: RunState, idx: number): boolean {
  const base = towerBlockedSet(s);
  const spawn = spawnTile(s);
  const exit = exitTile(s);
  for (const closed of toggleCombinations(s.toggles)) {
    const blocked = new Set(base);
    blocked.add(idx);
    for (const i of closed) blocked.add(i);
    if (isSealed(s.grid, blocked, spawn, exit)) return true;
  }
  return false;
}

/** True when a placement is legal right now but would seal under some other toggle state. */
export function placementSealsUnderToggles(s: RunState, col: number, row: number): boolean {
  const idx = row * s.grid.cols + col;
  const blocked = groundBlocked(s);
  blocked.add(idx);
  if (isSealed(s.grid, blocked, spawnTile(s), exitTile(s))) return false; // a plain seal
  return wouldSeal(s, idx);
}

/** The set of tile indices that block breacher pathing: everything but wall towers. */
function breacherBlocked(s: RunState): Set<number> {
  const out = new Set<number>();
  for (const i of s.blocked) {
    const col = i % s.grid.cols;
    const row = (i - col) / s.grid.cols;
    const t = towerAt(s, col, row);
    if (!t || !isWall(t)) out.add(i);
  }
  return out;
}

/** The set of tile indices that block the Ram: closed map toggles only (towers are chewed, not routed around). */
function ramBlocked(s: RunState): Set<number> {
  const out = new Set<number>();
  for (const t of s.toggles) if (!toggleOpenAt(t, s.clock)) out.add(toggleIndex(t));
  return out;
}

/** The set of tile indices that block flyer pathing: only Mesh walls (a repairing wall does not). */
function flyerBlocked(s: RunState): Set<number> {
  const out = new Set<number>();
  for (const t of s.towers) {
    if (wallBlocksFlyers(t) && !isRepairing(t, s.clock)) out.add(t.row * s.grid.cols + t.col);
  }
  return out;
}

/** One distance field per authored route, each over that route's tiles alone. */
function buildRouteFields(grid: Grid, blocked: ReadonlySet<number>, exit: Tile, routes: readonly Route[]): Int32Array[] {
  return routes.map((route) => buildRouteField(grid, blocked, exit, route));
}

export function rebuildField(s: RunState): void {
  const exit = exitTile(s);
  s.field = buildField(s.grid, groundBlocked(s), exit);
  s.breacherField = buildField(s.grid, breacherBlocked(s), exit);
  s.ramField = buildField(s.grid, ramBlocked(s), exit);
  s.flyerField = buildAirField(s.grid.cols, s.grid.rows, flyerBlocked(s), exit);
  s.routeFields = buildRouteFields(s.grid, groundBlocked(s), exit, s.routes);
}

export function upgradeTower(s: RunState, col: number, row: number): boolean {
  if (s.phase === 'halted' || s.phase === 'victory') return false;
  if (noBuildActive(s)) return false;
  const t = towerAt(s, col, row);
  if (!t) return false;
  if (isDown(t, s.clock)) return false; // an offline (or EMP'd) tower cannot be upgraded, only repaired
  if (t.tier === 2 && t.kind !== 'repair') return false; // 2 -> 3 is chooseBranch's job (repair never branches)
  const cost = upgradeCost(t);
  if (cost === null) return false;
  if (!spend(s.economy, cost)) return false;
  s.salvageSpent += cost;
  s.idleTicks = 0;
  t.tier = (t.tier + 1) as Tier;
  t.spent += cost;
  s.upgradesBought++;
  s.synergyRev++;
  refreshTowerHp(t);
  recomputeAuras(s.towers, s.clock);
  return true;
}

/** The result of a Ctrl+click sweep upgrade. */
export interface TowerSweep {
  /** Towers whose tier was raised by the sweep. */
  upgraded: number;
  /** Tier-2 towers left alone because they need a branch choice the game never makes. */
  needBranch: number;
}

/**
 * Ctrl+click on a placed tower: upgrade every tower in the same place on the ladder — same kind,
 * tier and branch — in ascending tower id (placement order), spending salvage until it runs out.
 * The clicked tower is included. Towers that would need a branch choice at tier 2 are skipped, never
 * chosen for the player, and counted so the status line can name them. Spending stops at the first
 * tower that cannot be afforded; what was already bought stays bought.
 */
export function sweepUpgradeSame(s: RunState, source: Tower): TowerSweep {
  const result: TowerSweep = { upgraded: 0, needBranch: 0 };
  if (s.phase === 'halted' || s.phase === 'victory') return result;
  if (noBuildActive(s)) return result;

  const targets = s.towers
    .filter((t) => t.kind === source.kind && t.tier === source.tier && t.branch === source.branch)
    .sort((a, b) => a.id - b.id);

  for (const t of targets) {
    if (isDown(t, s.clock)) continue; // an offline (or EMP'd) tower cannot be upgraded, only repaired
    const cost = upgradeCost(t);
    if (cost === null) continue; // nothing left to buy
    if (t.tier === 2 && t.kind !== 'repair') {
      result.needBranch++; // 2 -> 3 is chooseBranch's job; the game never picks for the player
      continue;
    }
    if (!spend(s.economy, cost)) break; // salvage ran out; everything already upgraded stays
    s.salvageSpent += cost;
    s.idleTicks = 0;
    t.tier = (t.tier + 1) as Tier;
    t.spent += cost;
    s.upgradesBought++;
    result.upgraded++;
    refreshTowerHp(t);
  }

  if (result.upgraded > 0) {
    s.synergyRev++;
    recomputeAuras(s.towers, s.clock);
  }
  return result;
}

/**
 * The status-bar line for a sweep: how many towers were upgraded, plus how many are left waiting for
 * a branch choice when any were skipped. Returns null when nothing happened, so the status line stays
 * untouched on a no-op.
 */
export function sweepUpgradeReport(upgraded: number, needBranch: number): string | null {
  if (upgraded === 0 && needBranch === 0) return null;
  let msg = `Upgraded ${upgraded} tower${upgraded === 1 ? '' : 's'}`;
  if (needBranch > 0) msg += ` — ${needBranch} need a branch (click one to choose)`;
  return msg;
}

export function chooseBranch(s: RunState, col: number, row: number, branch: Branch): boolean {
  if (s.phase === 'halted' || s.phase === 'victory') return false;
  if (noBuildActive(s)) return false;
  const t = towerAt(s, col, row);
  if (!t || t.tier !== 2 || t.branch !== null) return false;
  if (isDown(t, s.clock)) return false; // an offline (or EMP'd) tower cannot branch, only be repaired
  const cost = upgradeCost(t);
  if (cost === null) return false;
  if (!spend(s.economy, cost)) return false;
  s.salvageSpent += cost;
  s.idleTicks = 0;
  t.branch = branch;
  t.tier = 3;
  t.spent += cost;
  s.branches++;
  // A Minesweeper arms its drop clock the moment it is built, so the first mine lands 2.5 s later.
  if (isMinesweeper(t)) t.mineCooldown = MINE_INTERVAL_TICKS;
  // A Toggle gate installs closed: the branch must never silently open the route the player built.
  t.open = false;
  s.synergyRev++;
  refreshTowerHp(t);
  rebuildField(s); // a Mesh branch starts blocking flyers
  recomputeAuras(s.towers, s.clock);
  return true;
}

export function sellTower(s: RunState, col: number, row: number): boolean {
  if (noBuildActive(s)) return false;
  const t = towerAt(s, col, row);
  if (!t) return false;
  const refund = sellValue(t, s.treeEffects.sellRefund);
  s.towers = s.towers.filter((x) => x.id !== t.id);
  s.synergyRev++;
  s.blocked.delete(row * s.grid.cols + col);
  s.mines = s.mines.filter((m) => m.towerId !== t.id);
  s.economy.salvage += refund;
  s.soldTower = true;
  s.towersSold++;
  s.idleTicks = 0;
  if (t.builtWave === s.wave) s.soldTowerSameWave = true;
  if (s.selectedTowerId === t.id) s.selectedTowerId = null;
  rebuildField(s);
  recomputeAuras(s.towers, s.clock);
  return true;
}

/**
 * Start a repair job on a tower's tile. The full cost is paid up front; while the repair runs the
 * tower is not functional, so a wall leaves the pathing field exactly as an open Toggle gate does and
 * breachers walk straight past it. One repair per tower at a time, refused at full health, and the
 * cost is never refunded if the tower is sold before the timer ends.
 */
export function startRepair(s: RunState, col: number, row: number): boolean {
  if (s.phase === 'halted' || s.phase === 'victory') return false;
  if (noBuildActive(s)) return false;
  const t = towerAt(s, col, row);
  if (!t || t.maxHp <= 0) return false;
  if (isRepairing(t, s.clock)) return false;
  if (t.hp >= t.maxHp) return false;
  const cost = repairCost(t);
  if (!spend(s.economy, cost)) return false;
  s.salvageSpent += cost;
  s.idleTicks = 0;
  s.salvageSpentOnRepairs += cost;

  t.repairStartHp = t.hp;
  t.repairMissing = repairHpToRestore(t);
  t.repairDurationTicks = repairDurationTicks(t, s.treeEffects.repairSpeedMult);
  if (hasUpgrade(s, 'structural-warranty')) {
    t.repairDurationTicks = Math.max(1, Math.round(t.repairDurationTicks * WARRANTY_REPAIR_MULT));
  }
  t.repairReadyAt = s.clock + t.repairDurationTicks;

  // The tile is off the field while the repair runs, so the route re-paths immediately. Any breacher
  // already chewing this wall stops; everything else simply picks a new step on the next tick.
  rebuildField(s);
  for (const e of s.enemies) {
    if (e.attackTowerId === t.id) e.attackTowerId = null;
    e.targetCol = -1;
    e.targetRow = -1;
  }
  return true;
}

/** Move an enemy off a tile that just closed beneath it, along its heading to the nearest open tile. */
function pushEnemyOffTile(s: RunState, e: Enemy, col: number, row: number): void {
  const dx = Math.cos(e.heading);
  const dy = Math.sin(e.heading);
  let dc = 0;
  let dr = 0;
  if (Math.abs(dx) >= Math.abs(dy)) dc = dx >= 0 ? 1 : -1;
  else dr = dy >= 0 ? 1 : -1;

  const dirs: readonly (readonly [number, number])[] = [
    [dc, dr],
    [0, -1],
    [-1, 0],
    [1, 0],
    [0, 1],
  ];
  for (const [stepCol, stepRow] of dirs) {
    const nc = col + stepCol;
    const nr = row + stepRow;
    if (!inBounds(nc, nr)) continue;
    if (s.field[nr * s.grid.cols + nc] < 0) continue;
    e.x = nc + 0.5;
    e.y = nr + 0.5;
    e.prevX = e.x;
    e.prevY = e.y;
    e.col = nc;
    e.row = nr;
    e.targetCol = -1;
    e.targetRow = -1;
    return;
  }
}

/**
 * Flip a Toggle gate open or closed. Opening is always allowed; closing is refused when it would
 * seal the ground route. Flipping rebuilds the field in this tick and re-paths every enemy.
 */
export function toggleGate(s: RunState, col: number, row: number): boolean {
  const t = towerAt(s, col, row);
  if (!t || !isToggleGate(t)) return false;
  if (isGateLocked(t, s.clock) && !hasUpgrade(s, 'shutter-licence')) return false;

  if (t.open) {
    const blocked = groundBlocked(s);
    blocked.add(row * s.grid.cols + col);
    if (isSealed(s.grid, blocked, spawnTile(s), exitTile(s))) return false;
    t.open = false;
  } else {
    t.open = true;
  }

  const closing = !t.open;
  t.toggleReadyAt = hasUpgrade(s, 'shutter-licence') ? s.clock : s.clock + TOGGLE_LOCK_TICKS;
  s.toggleFlips++;
  s.idleTicks = 0;
  rebuildField(s);
  for (const e of s.enemies) {
    if (e.attackTowerId === t.id) {
      e.attackTowerId = null;
      e.targetCol = -1;
      e.targetRow = -1;
    }
    if (closing && e.col === col && e.row === row && !isFlyerKind(e.kind)) {
      pushEnemyOffTile(s, e, col, row);
    } else {
      e.targetCol = -1;
      e.targetRow = -1;
    }
  }
  return true;
}

/** Cycle a tower's targeting priority First -> Strong -> Close -> First. A kind locked to a fixed
 *  mode ignores the player's stored value, so cycling is refused for it. The Cursor's rule is fixed
 *  too (shielded, then nearest to its home tile), so cycling is a no-op for it as well. */
export function cycleTargetMode(s: RunState, col: number, row: number): void {
  if (noBuildActive(s)) return;
  const t = towerAt(s, col, row);
  if (!t) return;
  if (t.kind === 'cursor' || t.kind === 'repair') return;
  if (TOWER_STATS[t.kind].targetLock !== null) return;
  t.targetMode = t.targetMode === 'first' ? 'strong' : t.targetMode === 'strong' ? 'close' : 'first';
}

export function startWave(s: RunState): boolean {
  const early = s.phase === 'wave';
  if (s.phase !== 'build' && !early) return false;
  if (s.wave >= s.waveLimit && !s.endless) return false;
  // The early-call bonus is measured from the wave that just started, before we reset waveTick,
  // and paid as a fraction of the wave being called (s.wave + 1 once incremented below).
  const elapsed = s.waveTick;
  // The start is accepted: drop the armed build tool so the next board click is not a stray
  // placement. A tower selected for inspection (selectedTowerId) stays selected.
  s.selected = null;
  s.wave += 1;
  s.runs.push({ wave: s.wave, startTick: s.clock, spawns: buildSchedule(s.wave) });
  s.waveSnapshots.set(s.wave, {
    salvage: s.economy.salvage,
    salvageSpent: s.salvageSpent,
    integrity: s.integrity,
    towersBuilt: s.towersBuilt,
    wallsBuilt: s.wallsBuilt,
    towersSold: s.towersSold,
    upgradesBought: s.upgradesBought,
    branches: s.branches,
    bossesKilled: s.bossesKilled,
    towerCount: s.towers.length,
  });
  s.phase = 'wave';
  s.waveTick = 0;
  s.idleTicks = 0;
  s.salvageHitZeroThisWave = false;
  s.towerOfflineThisWave = false;
  s.autoWaveAtTick = 0; // any start — manual or automatic — cancels a pending countdown
  s.leaksByWave.set(s.wave, 0);
  s.modifiers = waveModifiers(s.wave);
  recomputeAuras(s.towers, s.clock);
  s.events.push({ type: 'waveStarted', wave: s.wave });
  const unlocked = TOWER_KINDS.filter((k) => isTowerUnlocked(k, s.wave) && !isTowerUnlocked(k, s.wave - 1));
  if (unlocked.length > 0) s.events.push({ type: 'towerUnlocked', kinds: unlocked });
  if (early) {
    s.calledEarly = true;
    s.earlyCalls++;
    s.earlyCallsInARow++;
    if (s.towersBuilt === 0) s.calledEarlyBeforeTower = true;
    earn(s.economy, earlyCallBonus(elapsed, s.wave));
  } else {
    s.earlyCallsInARow = 0;
  }
  return true;
}

/** After clearing wave 100, the player may continue into endless instead of rebooting. */
export function enterEndless(s: RunState): void {
  if (s.phase !== 'victory') return;
  if (s.daily !== null) return; // endless is never offered at the end of a daily
  s.endless = true;
  s.phase = 'build';
  s.selected = null;
  s.selectedTowerId = null;
}

export function upgradePointer(s: RunState): boolean {
  if (s.phase === 'halted') return false;
  const stageCost = nextStageCost(s.pointer);
  if (stageCost !== null) {
    if (!spend(s.economy, stageCost)) return false;
    s.salvageSpent += stageCost;
    s.idleTicks = 0;
    s.pointer.stage = Math.min(MAX_POINTER_STAGE, s.pointer.stage + 1) as PointerStage;
    return true;
  }
  const overclockCost = nextOverclockCost(s.pointer);
  if (overclockCost === null) return false;
  if (s.pointer.clickLevel + 1 > overclockCeiling(s.wave, overclockCap(s))) return false;
  // The ceiling is a guard, not a tax: it only ever rises with the wave counter, so a level bought
  // earlier is never taken away when a run is restored or the wave count is odd.
  if (!spend(s.economy, overclockCost)) return false;
  s.salvageSpent += overclockCost;
  s.idleTicks = 0;
  s.pointer.clickLevel += 1;
  return true;
}

/** Flip the Manual Override checkbox: while on, towers fire at the marked enemy when in range. */
export function toggleManualOverride(s: RunState): void {
  s.pointer.manualOverride = !s.pointer.manualOverride;
}

/** Flip the Auto checkbox: while on, the next wave starts 1.5 s after the board clears. */
export function toggleAutoWave(s: RunState): void {
  s.autoWave = !s.autoWave;
  if (!s.autoWave) s.autoWaveAtTick = 0; // turning it off cancels any pending countdown
}

/** True while any tower is mid-repair (a wall or gun is off the field). */
export function anyTowerRepairing(s: RunState): boolean {
  return s.towers.some((t) => isRepairing(t, s.clock));
}

/**
 * The auto-wave status-bar line, or null when auto is off, not in build, or no countdown is armed.
 * During a repair the countdown holds, so the line reads "waiting for repairs" instead of a number.
 */
export function autoWaveStatus(s: RunState): string | null {
  if (!s.autoWave || s.phase !== 'build' || s.autoWaveAtTick === 0) return null;
  if (anyTowerRepairing(s)) return 'Auto: waiting for repairs';
  const remaining = Math.max(0, s.autoWaveAtTick - s.clock) / TICK_HZ;
  return `Auto: next wave in ${remaining.toFixed(1)} s`;
}

/** Spend RP on a permanent spec level. The cost curves with the level; capped rows are refused. */
export function buySpec(s: RunState, kind: SpecKind): boolean {
  if (s.specs[kind] >= SPEC_CAPS[kind]) return false;
  const cost = specLevelCost(s.specs[kind]);
  if (s.rp < cost) return false;
  s.rp -= cost;
  s.specs[kind] += 1;
  return true;
}

/** A reboot banks specs from the run's lifetime salvage and returns the updated profile. */
export interface RestartResult {
  gained: number;
  profile: Profile;
}

/** The Restore Points this run would bank on a reboot, after the RP-gain modifier and Windows Update. */
export function restartPointsGained(s: RunState, profile: Profile): number {
  const effects = effectsFor(profile);
  return Math.max(0, Math.floor(rpGain(s.economy.earned) * effects.rpGainMult) + effects.extraSpecsPerReboot);
}

export function restartWindows(s: RunState, profile: Profile): RestartResult {
  const next = cloneProfile(profile);
  next.reboots += 1;
  // A cheated run records nothing: no Restore Points, no best wave, no achievements (docs §12.4).
  if (s.cheatsUsed) return { gained: 0, profile: next };
  const gained = restartPointsGained(s, profile);
  next.rp += gained;
  next.rpEarned += gained;
  next.lastSalvage = s.economy.earned;
  next.bestWave = Math.max(next.bestWave, s.wave);
  // "Reboot with 50 or more total specs" is about specs owned, not points banked: a player who spends
  // every point on the tree still owns those levels.
  const totalSpecLevels = next.specs.cpu + next.specs.ram + next.specs.gpu + next.specs.disk;
  if (!next.achievements.includes('reboot-50') && totalSpecLevels >= 50) {
    next.achievements.push('reboot-50');
  }
  return { gained, profile: next };
}

/**
 * Build the flat `AchievementStats` snapshot the unlock rules read. Called once per tick by
 * `checkAchievements`; the per-achievement loop reuses this one snapshot rather than recomputing
 * any counter.
 */
export function buildStats(s: RunState): AchievementStats {
  const towers = s.towers;
  let maxTier = 1;
  let tierFive = 0;
  let beacons = 0;
  let maxedBranch = false;
  let aaFlak = false;
  let cursorBuilt = s.cursorBuilt;
  const kinds = new Set<string>();
  for (const t of towers) {
    kinds.add(t.kind);
    if (t.tier > maxTier) maxTier = t.tier;
    if (t.tier === 5) tierFive++;
    if (t.kind === 'beacon') beacons++;
    if (t.branch !== null && isFullyUpgraded(t)) maxedBranch = true;
    if (t.kind === 'aa' && t.branch === 'A') aaFlak = true;
    if (t.kind === 'cursor') cursorBuilt = true;
  }
  let maxTreeTier = 0;
  for (const id of s.tree) {
    const node = TREE_NODES.find((n) => n.id === id);
    if (node && node.tier > maxTreeTier) maxTreeTier = node.tier;
  }

  let maxCursorRepairs = 0;
  for (const n of s.cursorRepairsByTower.values()) if (n > maxCursorRepairs) maxCursorRepairs = n;
  const nowTick = s.tick;
  let recentPointerKills = 0;
  for (const t of s.pointerKillTicks) if (nowTick - t <= secondsToTicks(10)) recentPointerKills++;
  let shippedMapsCleared = 0;
  for (const l of LEVELS) if (s.profile.mapsCleared.includes(l.id)) shippedMapsCleared++;
  const date = new Date();

  return {
    wave: s.wave,
    kills: s.economy.kills.tower + s.economy.kills.pointer,
    killsByTower: s.economy.kills.tower,
    killsByPointer: s.economy.kills.pointer,
    pointerHits: s.pointerHits,
    critHits: s.critHits,
    weakHits: s.weakPointHits,
    weakKills: s.weakPointKills,
    leaks: s.totalLeaks,
    integrity: s.integrity,
    salvage: s.economy.salvage,
    salvagePeak: s.salvagePeak,
    earned: s.economy.earned,
    towersBuilt: s.towersBuilt,
    towersSold: s.soldTower ? Math.max(1, s.towersSold) : s.towersSold,
    upgradesBought: s.upgradesBought,
    branches: s.branches,
    maxTowerTier: maxTier,
    perfectWaves: Math.max(s.perfectWaves, s.clearedFlawlessWave ? 1 : 0),
    perfectWaveStreak: s.perfectWaveStreak,
    bossesKilled: s.bossesKilled,
    bossKillsByPointer: s.bossKillsByPointer,
    shieldsBroken: s.shieldsBroken,
    adsClosed: s.adsDismissed,
    adsExpired: s.adsExpired,
    minesTriggered: s.minesTriggered,
    repairsDone: s.repairsDone,
    salvageSpentOnRepairs: s.salvageSpentOnRepairs,
    toggles: s.toggleFlips,
    wallsBuilt: s.wallsBuilt,
    flyersKilled: s.flyersKilled,
    aaKills: s.aaKills,
    cursorKills: s.cursorKills,
    cursorRepairs: s.cursorRepairs,
    earlyCalls: s.earlyCalls,
    earlyCallStreak: s.earlyCallsInARow,
    endlessWave: s.endless ? s.wave : 0,
    wavesAtThreeSpeed: s.wavesAtThreeSpeed,
    cheatsUsed: s.cheatsUsed,
    treesFullyUpgraded: s.tree.length === TREE_NODES.length,
    treeNodeCount: s.tree.length,
    prestigeLevel: s.rpEarned,
    rebootCount: s.reboots,
    mapId: s.levelId,
    customMap: !LEVELS.some((l) => l.id === s.levelId),
    timeOfDayHour: date.getHours(),
    dayOfWeek: date.getDay(),
    pausedTicks: s.pausedTicks,
    routeLength: currentPath(s).length,
    rp: s.rp,
    clearedWaves: s.clearedWaves,
    startingWave: s.treeEffects.startingWave,
    towerKinds: kinds.size,
    tierFiveCount: tierFive,
    beaconCount: beacons,
    maxedBranch,
    aaFlak,
    cursorBuilt,
    overclockMax: s.pointer.stage >= MAX_POINTER_STAGE && s.pointer.clickLevel >= MAX_OVERCLOCK_LEVEL,
    bossKilledByPointer: s.bossKilledByPointer,
    milestoneBossByPointer: s.milestoneBossByPointer,
    cleanWave: s.clearedWaveNoLeaks,
    integrityLowWater: s.integrityLowWater,
    clearedWave1NoLeak: s.clearedWave1NoLeak,
    maxTreeTier,
    killedCarrier: s.killedBossKinds.has('flyer-boss'),
    killedDreadnought: s.killedBossKinds.has('armoured-boss'),
    killedWirecutter: s.killedBossKinds.has('saboteur-boss'),
    killedRam: s.killedBossKinds.has('breacher-boss'),
    // Per-wave snapshot rules (group A).
    towersOnBoard: s.towers.length,
    clearedWallOnlyWave: s.clearedWallOnlyWave,
    clearedNoUpgradeWave: s.clearedNoUpgradeWave,
    clearedTwoKinds: s.clearedTwoKinds,
    clearedNoSpendWave: s.clearedNoSpendWave,
    clearedBossNoLeak: s.clearedBossNoLeak,
    clearedSellAllWave: s.clearedSellAllWave,
    // Per-shot tallies (group B).
    maxBeamKills: s.maxBeamKills,
    maxChainKills: s.maxChainKills,
    maxSplashKills: s.maxSplashKills,
    maxSlowCount: s.maxSlowCount,
    beaconBuffKill: s.beaconBuffKill,
    maxCursorRepairs,
    // Profile counters (group C).
    lifetimeBossKillsByPointer: s.profile.lifetimeBossKillsByPointer,
    shippedMapsCleared,
    // Timers and flags (group D + the remaining shadows).
    pointerIdleSeconds: s.pointerIdleTicks / TICK_HZ,
    idleTowerKilled: s.idleTowerKilled,
    recentPointerKills,
    idleSeconds: s.idleTicks / TICK_HZ,
    autoWave: s.autoWave,
    bossKilledByOverride: s.bossKilledByOverride,
    bossKilledAtOneIntegrity: s.bossKilledAtOneIntegrity,
    notified: s.notified,
    runLost: s.phase === 'halted',
    runEnded: s.phase === 'halted' || s.phase === 'victory',
    specTotal: s.specs.cpu + s.specs.ram + s.specs.gpu + s.specs.disk,
    clearedNoTowerWave: s.clearedNoTowerWave,
    soldTowerSameWave: s.soldTowerSameWave,
    calledEarlyBeforeTower: s.calledEarlyBeforeTower,
    wavesClearedSinceLeak: s.wavesClearedSinceLeak,
    cheatSpawns: s.cheatSpawns,
    shadowBroke: s.shadowBroke,
  };
}

/**
 * Evaluate every achievement against the current run and return the ids that just unlocked (which
 * are also recorded in `s.achievements`, so each id fires exactly once). Runs in the simulation
 * step, never in the view. A new achievement is a single data row in `ACHIEVEMENTS`; this loop is
 * the whole engine.
 */
export function checkAchievements(s: RunState): string[] {
  const unlocked: string[] = [];
  const stats = buildStats(s);
  const profile = s.profile;
  for (const a of ACHIEVEMENTS) {
    if (s.achievements.has(a.id)) continue;
    // A cheated run records nothing — except the cheat-only shadows, whose condition *is* the
    // cheating (docs/design.md §12.4). They still need the sim state to match.
    if (s.cheatsUsed && !a.cheatOnly) continue;
    if (!a.when || !a.when(stats, profile)) continue;
    s.achievements.add(a.id);
    unlocked.push(a.id);
  }
  return unlocked;
}

/**
 * The view/OS hook for achievements the sim cannot observe: a tooltip hover, a window resize, an
 * editor action. It only records the observed event in `s.notified`; the normal `checkAchievements`
 * loop does the actual unlock on the next tick, so a notified id still fires once and toasts like
 * every other achievement. Kept deliberately narrow — callers pass an id, nothing more.
 */
export function notifyAchievement(s: RunState, id: string): void {
  if (s.cheatsUsed && !ACHIEVEMENTS.some((a) => a.id === id && a.cheatOnly)) return;
  s.notified.add(id);
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
    if (isDown(t, s.clock)) continue; // an offline (or EMP'd) Relay beacon buffs nothing
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
  s.pointerIdleTicks = 0;
  s.idleTowerKilled = false;
  s.idleTicks = 0;
  if (s.phase !== 'wave') return false;
  const previousTargetId = s.pointer.targetId;
  s.pointer.held = true;
  const relay = relayPointerBonus(s, x, y);
  const target = enemyAt(s, x, y, CLICK_SLACK + relay.slack + clickSlackBonus(s));
  const weak = target ? isWeakPointHit(target, x, y) : false;
  s.events.push({ type: 'click', x, y, hit: !!target });
  if (!target) {
    s.pointer.combo = 0;
    s.pointer.comboTicks = 0;
    return false;
  }
  // The reticle's locked enemy is marked; clicking an already-marked enemy pays +15 % and a better
  // crit chance, so holding the reticle on one enemy (a boss) makes the next clicks hurt more. The
  // mark is a stage-2 reticle feature: a bare stage-1 click never locks, so it never marks.
  s.pointerHits++;
  const marked = s.pointer.stage >= MAX_POINTER_STAGE && target.id === previousTargetId;
  const roll = nextCritRoll(s.rng, marked, weak);
  s.rng = roll.next;
  s.pointer.targetId = target.id;
  const base = clickDamage(s.pointer) * relay.damage * pointerDamageMult(s) * pointerUpgradeMult(s);
  const amount =
    base *
    comboMultiplier(s.pointer) *
    (weak ? 2 : 1) *
    (marked ? MARKED_DAMAGE_MULT : 1) *
    (roll.crit ? CRIT_MULTIPLIER : 1);
  damageEnemy(s, target, amount, 'pointer', true, undefined, weak, roll.crit, marked);
  if (target.dead && hasUpgrade(s, 'chain-reaction')) chainReaction(s, target, amount);
  if (weak) {
    s.weakPointHits++;
    s.pointer.combo++;
    s.pointer.comboTicks = COMBO_TICKS;
  }
  return true;
}

/** True while a Chain Reaction splash is being dealt, so a splash kill can never start a second chain. */
let chainInProgress = false;

/**
 * Chain Reaction: a killing click deals 25 % of the killing blow to the two nearest live enemies
 * within 1.5 tiles of the victim. The splash is plain pointer damage — no crit, no mark, no weak
 * point — and it never chains again (docs/GLOBAL-UPGRADES.md §4).
 */
function chainReaction(s: RunState, victim: Enemy, blow: number): void {
  if (chainInProgress || blow <= 0) return;
  const r2 = CHAIN_RADIUS * CHAIN_RADIUS;
  const near = s.enemies
    .filter((e) => !e.dead && e.id !== victim.id && !isPopupEnemy(e))
    .map((e) => ({ e, d2: (e.x - victim.x) ** 2 + (e.y - victim.y) ** 2 }))
    .filter((n) => n.d2 <= r2)
    .sort((a, b) => a.d2 - b.d2 || a.e.id - b.e.id)
    .slice(0, CHAIN_TARGETS);
  chainInProgress = true;
  try {
    for (const { e } of near) damageEnemy(s, e, blow * CHAIN_SPLASH_MULT, 'pointer', true);
  } finally {
    chainInProgress = false;
  }
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

/**
 * Close a pop-up window by clicking its close box: the only way to kill it. It pays the enemy's
 * normal salvage (no pointer bonus) and every enemy it was covering is targetable again on the next
 * tick, when towers reacquire.
 */
export function closePopupEnemy(s: RunState, id: number): boolean {
  const e = s.enemies.find((x) => x.id === id && isPopupEnemy(x) && !x.dead);
  if (!e) return false;
  e.dead = true;
  e.hp = 0;
  const reward = recordKillAt(s.economy, e.value * buffKillMult(s), 'pointer', 1);
  s.events.push({ type: 'kill', x: e.x, y: e.y, reward, source: 'pointer', kind: e.kind, heading: e.heading });
  if (s.pointer.targetId === e.id) s.pointer.targetId = null;
  return true;
}

// ---------------------------------------------------------------------------------------------
// Cheats (the gate lives in cheats.ts; these reducers are inert unless it is open)

/** The salvage ceiling God Mode maintains, so a god-mode purchase never runs out of money. */
export const GOD_SALVAGE_CEILING = 1_000_000;

/** God Mode: integrity is never reduced and salvage is topped up to the ceiling before it is spent. */
export function toggleGodMode(s: RunState): void {
  if (!cheatsEnabled()) return;
  if (s.daily !== null) return; // a daily forbids cheats
  s.godMode = !s.godMode;
  if (s.godMode) {
    s.cheatsUsed = true;
    s.economy.salvage = Math.max(s.economy.salvage, GOD_SALVAGE_CEILING);
  }
}

/** The wave whose scaling a cheat-spawned enemy uses: the live wave, or the next one in build. */
function cheatSpawnWave(s: RunState): number {
  return s.phase === 'wave' ? s.wave : Math.max(1, s.wave + 1);
}

/** Spawn one enemy of `kind` at the spawn tile, using the current wave's scaling. */
export function spawnCheatEnemy(s: RunState, kind: EnemyKind): boolean {
  if (!cheatsEnabled()) return false;
  if (s.daily !== null) return false; // a daily forbids cheats
  const enemy = createEnemy(s.nextId++, kind, cheatSpawnWave(s), spawnTile(s), exitTile(s));
  enemy.routeIndex = nextRouteIndex(s);
  enemy.spawnTick = s.tick;
  initFlight(s, enemy);
  s.enemies.push(enemy);
  s.cheatsUsed = true;
  s.cheatSpawns++;
  return true;
}

/** Kill every living enemy without salvage, achievement progress or a wave advance. */
export function killAllEnemies(s: RunState): void {
  if (!cheatsEnabled()) return;
  if (s.daily !== null) return; // a daily forbids cheats
  s.enemies = [];
  s.pointer.targetId = null;
  s.pointer.held = false;
  s.cheatsUsed = true;
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
  } else {
    s.pausedTicks += Math.max(0, dtMs) / TICK_MS;
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
  s.pointerIdleTicks++;
  s.idleTicks++;
  if (s.phase === 'wave' && s.speed === 3 && s.waveAtThreeCounted !== s.wave) {
    s.wavesAtThreeSpeed++;
    s.waveAtThreeCounted = s.wave;
  }
  if (s.godMode) s.economy.salvage = Math.max(s.economy.salvage, GOD_SALVAGE_CEILING);
  if (s.economy.salvage > s.salvagePeak) s.salvagePeak = s.economy.salvage;
  if (s.economy.salvage === 0) {
    s.salvageHitZeroThisWave = true;
    if (s.towerOfflineThisWave) s.shadowBroke = true;
  }
  updateToggles(s);
  tickRepairs(s);
  tickRepairAuras(s);
  tickEmpExpiry(s);
  decayCombo(s);
  tickAds(s);
  checkAchievements(s);
  if (s.phase === 'wave') {
    spawnDue(s);
    moveEnemies(s);
    applyEmp(s);
    tickBrood(s);
    fireBreacherTurrets(s);
    tickCursors(s);
    tickProjectiles(s); // move in-flight shells/missiles, resolve hits and expiries
    tickMines(s); // drop, arm and detonate Minesweeper mines
    fireTowers(s);
    updateMaxSlowCount(s);
    applyReticle(s);
    s.enemies = s.enemies.filter((e) => !e.dead);
    if (s.phase === 'wave') {
      s.waveTick++;
      clearDue(s);
      finishWavePhase(s);
    }
  } else if (s.phase === 'build') {
    tickCursors(s); // idle: the cursor drifts around its tile between waves
    tickProjectiles(s); // let a lingering missile expire after a wave clears
    tickMines(s); // drop and expire mines between waves (nothing walks into them yet)
  }
  s.clock++;
  // After the clock advances, so a pop-up or buff ends on exactly its `until` tick.
  tickSystemTray(s);
  tickAutoWave(s);
}

/** Track the highest number of enemies slowed at once (the frost-lock rule). */
function updateMaxSlowCount(s: RunState): void {
  let n = 0;
  for (const e of s.enemies) {
    if (!e.dead && s.tick < e.slowUntilTick && e.slowFactor < 1) n++;
  }
  if (n > s.maxSlowCount) s.maxSlowCount = n;
}

/**
 * Advance the auto-wave countdown in the build phase. The countdown is armed on the first build
 * tick after a wave clears (wave > 0, so a fresh run at wave 0 never auto-starts), fires when the
 * clock reaches the armed tick, and holds while any tower is mid-repair. Manual startWave and
 * toggling auto off both clear the armed tick.
 */
function tickAutoWave(s: RunState): void {
  if (!s.autoWave || s.phase !== 'build') return;
  if (s.autoWaveAtTick === 0) {
    if (s.wave > 0) s.autoWaveAtTick = s.clock + AUTO_WAVE_DELAY_TICKS;
    return;
  }
  if (anyTowerRepairing(s)) return;
  if (s.clock >= s.autoWaveAtTick) startWave(s);
}

/**
 * Flip every map toggle whose state changed from the previous tick, in this tick: recompute the
 * ground field and re-path every enemy from its current tile. Ground enemies caught inside a tile
 * that just closed are pushed to the nearest open tile along their heading, never left in a wall.
 */
function updateToggles(s: RunState): void {
  if (s.toggles.length === 0) return;
  const c = s.clock;
  if (c === 0) return; // the field was already built for clock 0
  const closedNow: LevelToggle[] = [];
  const events: { index: number; open: boolean }[] = [];
  for (let i = 0; i < s.toggles.length; i++) {
    const t = s.toggles[i];
    const open = toggleOpenAt(t, c);
    if (open === toggleOpenAt(t, c - 1)) continue;
    if (!open) closedNow.push(t);
    events.push({ index: i + 1, open });
  }
  if (events.length === 0) return;

  rebuildField(s);
  for (const e of s.enemies) {
    e.targetCol = -1;
    e.targetRow = -1;
  }
  for (const t of closedNow) {
    for (const e of s.enemies) {
      if (e.dead || isFlyerKind(e.kind) || e.kind === 'breacher') continue;
      if (e.col === t.col && e.row === t.row) pushEnemyOffTile(s, e, t.col, t.row);
    }
  }
  for (const ev of events) s.events.push({ type: 'toggleChanged', index: ev.index, open: ev.open });
}

/**
 * Advance every running repair one tick and finish the ones whose timer has elapsed. Hit points tick
 * back at a constant rate; the finishing tick snaps the tower to full health, returns it to service,
 * and rebuilds the field so the route closes again. Runs in every phase, so repairs made during the
 * build phase heal before the next wave starts.
 */
function tickRepairs(s: RunState): void {
  const finished: Tower[] = [];
  for (const t of s.towers) {
    if (t.repairReadyAt === 0) continue;
    if (!isRepairing(t, s.clock)) {
      // The clock has reached (or passed) the ready tick: the job is done.
      t.hp = t.maxHp;
      t.repairReadyAt = 0;
      finished.push(t);
      continue;
    }
    const remaining = t.repairReadyAt - s.clock;
    const done = t.repairDurationTicks - remaining + 1; // ticks elapsed through this tick
    if (done >= t.repairDurationTicks) {
      t.hp = t.maxHp;
      t.repairReadyAt = 0;
      finished.push(t);
    } else {
      t.hp = t.repairStartHp + (t.repairMissing * done) / t.repairDurationTicks;
    }
  }

  if (finished.length === 0) return;
  s.repairsDone += finished.length;
  rebuildField(s);
  recomputeAuras(s.towers, s.clock); // a repaired tower may have come back online (beacon/repair aura resumes)
  for (const e of s.enemies) {
    e.targetCol = -1;
    e.targetRow = -1;
  }
  for (const t of finished) {
    for (const e of s.enemies) {
      if (e.dead || isFlyerKind(e.kind)) continue;
      if (e.col === t.col && e.row === t.row) pushEnemyOffTile(s, e, t.col, t.row);
    }
  }
}

/**
 * Repair towers heal every damaged tower in their radius, in build and wave phases alike. Each tick
 * adds `healRate / TICK_HZ` hit points to every target, so the per-second rate is exact across the
 * fixed timestep. Targets are recomputed every tick: a tower that leaves the radius, reaches full
 * health, or starts a manual repair (and so leaves the field) stops receiving the aura immediately.
 */
function tickRepairAuras(s: RunState): void {
  let revived = false;
  for (const h of s.towers) {
    if (h.kind !== 'repair' || isDown(h, s.clock)) continue;
    if (isRepairing(h, s.clock)) continue; // a repair tower mid-repair is off the field
    const heal = repairHealRate(h) / TICK_HZ;
    for (const t of repairHealTargets(s.towers, h, s.clock)) {
      if (isOffline(t)) revived = true; // healing an offline tower back above 0 brings it online
      t.hp = Math.min(t.maxHp, t.hp + heal);
    }
  }
  if (revived) recomputeAuras(s.towers, s.clock);
}

/**
 * The Wirecutter's EMP is a time-limited offline state separate from HP: a tower with `empUntilTick`
 * in the future is knocked out but keeps its hit points. This runs every tick (not just in a wave),
 * so a tower knocked out as a wave ends still returns after its 3 s. A Beacon or Repair that comes
 * back re-projects its aura the moment it does.
 */
function tickEmpExpiry(s: RunState): void {
  let recovered = false;
  for (const t of s.towers) {
    if (t.empUntilTick !== 0 && s.clock >= t.empUntilTick) {
      t.empUntilTick = 0;
      recovered = true;
    }
  }
  if (recovered) recomputeAuras(s.towers, s.clock);
}

/**
 * A living Wirecutter knocks every non-wall tower within `WIRECUTTER_EMP_RADIUS` offline for 3 s.
 * It is a refresh, not a stack: while the Wirecutter stays close the timer keeps pointing at now+3 s,
 * so the tower returns 3 s after the boss moves on. It never damages the tower.
 */
function applyEmp(s: RunState): void {
  let changed = false;
  const wirecutters: Enemy[] = [];
  for (const e of s.enemies) if (!e.dead && e.kind === 'saboteur-boss') wirecutters.push(e);
  if (wirecutters.length === 0) return;

  const r2 = WIRECUTTER_EMP_RADIUS * WIRECUTTER_EMP_RADIUS;
  for (const t of s.towers) {
    if (isWall(t)) continue; // a wall has no firing/aura state to knock out
    for (const w of wirecutters) {
      const dx = t.col + 0.5 - w.x;
      const dy = t.row + 0.5 - w.y;
      if (dx * dx + dy * dy <= r2) {
        if (t.empUntilTick <= s.clock) changed = true;
        t.empUntilTick = Math.max(t.empUntilTick, s.clock + WIRECUTTER_EMP_TICKS);
        break;
      }
    }
  }
  if (changed) recomputeAuras(s.towers, s.clock);
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
      // A pop-up respects the "at most N alive" cap: if one is already walking (e.g. an early
      // call overlapped waves), this wave's pop-up is skipped rather than breaking the cap.
      if (sp.kind === 'popup' && livingPopups(s) >= popupAliveCap(run.wave)) continue;
      const milestoneMult = milestoneBossKind(run.wave) === sp.kind ? milestoneBossHpMult(run.wave) : 1;
      const bountyMult = isBossKind(sp.kind) && hasUpgrade(s, 'bounty-board') ? BOUNTY_HP_MULT : 1;
      const hpMult = milestoneMult * bountyMult;
      const enemy = createEnemy(s.nextId++, sp.kind, run.wave, spawnTile(s), exitTile(s), hpMult);
      enemy.routeIndex = nextRouteIndex(s);
      enemy.spawnTick = s.tick;
      initFlight(s, enemy);
      s.enemies.push(enemy);
      s.events.push({ type: 'enemySpawned', kind: sp.kind });
    }
  }
}

/**
 * The route a newly spawned enemy takes: a deterministic, seeded alternation over the level's routes.
 * It is round-robin (0, 1, …, n-1, 0, …), so with two routes consecutive spawns always split. The
 * cursor lives on the run state and only advances when the level authors routes, so a single implicit
 * route never consumes it and its behaviour is byte-for-byte unchanged.
 */
function nextRouteIndex(s: RunState): number {
  if (s.routes.length === 0) return 0;
  const idx = s.routeCursor % s.routes.length;
  s.routeCursor++;
  return idx;
}

/** The number of pop-up windows currently walking the board. */
function livingPopups(s: RunState): number {
  let n = 0;
  for (const e of s.enemies) if (!e.dead && isPopupEnemy(e)) n++;
  return n;
}

/**
 * The Carrier's brood: every `CARRIER_BROOD_INTERVAL_TICKS` it releases `CARRIER_BROOD_COUNT` flyers
 * at its own position. The flyers scatter outward for half a second, then home on the exit.
 */
function tickBrood(s: RunState): void {
  for (const e of s.enemies) {
    if (e.dead || e.kind !== 'flyer-boss') continue;
    if (e.broodCooldown > 0) {
      e.broodCooldown--;
      continue;
    }
    releaseBrood(s, e, CARRIER_BROOD_COUNT);
    e.broodCooldown = CARRIER_BROOD_INTERVAL_TICKS;
  }
}

/** Spawn `count` brood flyers at `carrier`'s position, fanned out to scatter then home. */
function releaseBrood(s: RunState, carrier: Enemy, count: number): void {
  const spawn = spawnTile(s);
  const exit = exitTile(s);
  for (let i = 0; i < count; i++) {
    const e = createEnemy(s.nextId++, 'flyer', carrier.wave, spawn, exit);
    e.x = carrier.x;
    e.y = carrier.y;
    e.prevX = carrier.x;
    e.prevY = carrier.y;
    e.col = Math.floor(carrier.x);
    e.row = Math.floor(carrier.y);
    e.dist = carrier.dist;
    e.heading = carrier.heading + (Math.PI * 2 * i) / count;
    e.scatterTicks = CARRIER_BROOD_SCATTER_TICKS;
    e.spawnTick = s.tick;
    initFlight(s, e);
    s.enemies.push(e);
    s.events.push({ type: 'enemySpawned', kind: 'flyer' });
  }
}

/** The distance field an enemy paths downhill over (breachers and flyers use their own). */
function fieldFor(s: RunState, e: Enemy): Int32Array {
  if (e.kind === 'breacher') return s.breacherField;
  if (e.kind === 'breacher-boss') return s.ramField;
  if (isFlyerKind(e.kind)) return s.flyerField;
  if (s.routeFields.length > 0) return s.routeFields[e.routeIndex % s.routeFields.length];
  return s.field;
}

/** Turn a breacher/Ram to face the tower it is chewing. */
function faceTower(e: Enemy, tower: Tower): void {
  const dx = tower.col + 0.5 - e.x;
  const dy = tower.row + 0.5 - e.y;
  const d = Math.hypot(dx, dy);
  if (d > 0) e.heading = Math.atan2(dy, dx);
}

/** Whether `e` may chew `tower` right now: a Breacher only chews walls; a Ram chews any tower. */
function isChewable(s: RunState, e: Enemy, tower: Tower | undefined): tower is Tower {
  if (!tower || tower.hp <= 0 || isRepairing(tower, s.clock)) return false;
  if (e.kind === 'breacher') return isWall(tower) && !isGateOpen(tower);
  if (e.kind === 'breacher-boss') return isWall(tower) ? !isGateOpen(tower) : true;
  return false;
}

/** Apply a chew tick: walls take `wallDps`, non-wall towers take the Ram's tower DPS (offline at 0). */
function chewTower(s: RunState, e: Enemy, tower: Tower): void {
  if (isWall(tower)) {
    const dps = ENEMY_STATS[e.kind].wallDps;
    if (dps > 0) damageWall(s, tower, dps / TICK_HZ);
  } else if (RAM_TOWER_DPS > 0) {
    damageTower(s, tower, RAM_TOWER_DPS / TICK_HZ);
  }
}

/** Clamp a world coordinate to the board's interior, so a scatter never drives a flyer off-screen. */
function clampToBoard(v: number, max: number): number {
  return Math.min(max - 1e-4, Math.max(0, v));
}

/**
 * Draw a flyer's lane offset and sway phase from the run's seeded PRNG (docs/FLYER-FLIGHT.md).
 * Every other kind is left untouched and consumes no randomness, so ground runs are unchanged.
 */
function initFlight(s: RunState, e: Enemy): void {
  if (!isFlyerKind(e.kind)) return;
  const lane = rngNext(s.rng);
  s.rng = lane.next;
  const phase = rngNext(s.rng);
  s.rng = phase.next;
  e.laneOffset = (lane.value * 2 - 1) * FLYER_LANE_OFFSET_MAX;
  e.swayPhase = phase.value * Math.PI * 2;
}

/** Radians the flyer's lateral frame may turn per tile of base travel, so a corner sweeps, not snaps. */
const FLYER_TURN_PER_TILE = 0.4;

/** Rotate the unit vector (e.flightDirX, e.flightDirY) toward (ux, uy) by at most `maxTurn` radians. */
function turnFlightDir(e: Enemy, ux: number, uy: number, maxTurn: number): void {
  const cur = Math.atan2(e.flightDirY, e.flightDirX);
  let delta = Math.atan2(uy, ux) - cur;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const a = cur + Math.max(-maxTurn, Math.min(maxTurn, delta));
  e.flightDirX = Math.cos(a);
  e.flightDirY = Math.sin(a);
}

/** Base-path distance from (bx, by) to the exit, following the flyer's current target (Infinity if unreachable). */
function flyerRemaining(s: RunState, e: Enemy, field: Int32Array, bx: number, by: number): number {
  const cols = s.grid.cols;
  const c = e.targetCol >= 0 ? e.targetCol : e.col;
  const r = e.targetCol >= 0 ? e.targetRow : e.row;
  const d = field[r * cols + c];
  if (d < 0) return Infinity;
  return d + Math.hypot(c + 0.5 - bx, r + 0.5 - by);
}

/**
 * Move a flyer (docs/FLYER-FLIGHT.md). A base position walks the air field waypoint to waypoint in
 * continuous space; `col`/`row` follow the base. The drawn position `x`/`y` is the base plus a lane
 * offset and a sinusoidal sway along the right-hand normal of the direction of travel, tapered to
 * zero near spawn and near the exit, and clamped inside the board. `heading` follows actual motion.
 */
function flyFlyer(s: RunState, e: Enemy, field: Int32Array, exit: Tile, remaining: number): void {
  let bx = e.x - e.flightOffX;
  let by = e.y - e.flightOffY;
  const startX = e.x;
  const startY = e.y;
  let leaked = false;
  while (remaining > 0) {
    if (e.targetCol < 0) {
      const next = stepToward(field, e.col, e.row);
      if (!next) break;
      e.targetCol = next.col;
      e.targetRow = next.row;
    }
    const tx = e.targetCol + 0.5;
    const ty = e.targetRow + 0.5;
    const dx = tx - bx;
    const dy = ty - by;
    const d = Math.hypot(dx, dy);
    const travel = Math.min(d, remaining);
    if (d > 0) {
      if (e.flightDist < FLYER_TAPER_SPAWN_TILES) {
        // Still on the spawn taper (offset near zero): adopt the path direction outright.
        e.flightDirX = dx / d;
        e.flightDirY = dy / d;
      } else {
        turnFlightDir(e, dx / d, dy / d, FLYER_TURN_PER_TILE * travel);
      }
    }
    e.dist += travel;
    e.flightDist += travel;
    remaining -= travel;
    if (d <= travel) {
      bx = tx;
      by = ty;
      e.col = e.targetCol;
      e.row = e.targetRow;
      e.targetCol = -1;
      e.targetRow = -1;
      if (e.col === exit.col && e.row === exit.row) {
        leaked = true;
        break;
      }
    } else {
      bx += (dx / d) * travel;
      by += (dy / d) * travel;
      // col/row follow the base: update only when it crosses into a new tile.
      const c = Math.floor(bx);
      const r = Math.floor(by);
      if ((c !== e.col || r !== e.row) && c >= 0 && r >= 0 && c < s.grid.cols && r < s.grid.rows) {
        e.col = c;
        e.row = r;
      }
    }
  }

  // The offset: lane + sway along the right-hand normal, tapered at both ends of the journey.
  const rem = leaked ? 0 : flyerRemaining(s, e, field, bx, by);
  const taper = Math.max(
    0,
    Math.min(1, e.flightDist / FLYER_TAPER_SPAWN_TILES, (rem - FLYER_TAPER_EXIT_HOLD_TILES) / FLYER_TAPER_EXIT_TILES),
  );
  const sway = flyerSwayAmplitude(e.kind) * Math.sin((2 * Math.PI * e.flightDist) / FLYER_SWAY_WAVELENGTH + e.swayPhase);
  const lateral = taper * (e.laneOffset + sway);
  // Right-hand normal of (dx, dy) in screen space (y down): (-dy, dx).
  const nx = -e.flightDirY;
  const ny = e.flightDirX;
  const cols = s.grid.cols;
  const rows = s.grid.rows;
  // Clamp inside the board, never pulling the drawn position past the base itself.
  const x = Math.min(Math.max(cols - 0.5, bx), Math.max(Math.min(0.5, bx), bx + nx * lateral));
  const y = Math.min(Math.max(rows - 0.5, by), Math.max(Math.min(0.5, by), by + ny * lateral));
  e.x = x;
  e.y = y;
  e.flightOffX = x - bx;
  e.flightOffY = y - by;
  const mx = x - startX;
  const my = y - startY;
  if (mx * mx + my * my > 1e-12) e.heading = Math.atan2(my, mx);
  if (leaked) leak(s, e);
}

function moveEnemies(s: RunState): void {
  const speedMult = s.modifiers.includes('fast') ? 1.15 : 1;
  const exit = exitTile(s);
  // The Pacer's speed floor reads the Pacer's position at the start of the step, so the movement of
  // enemies earlier in the array cannot shift the aura mid-tick.
  const pacerPositions: { x: number; y: number }[] = [];
  for (const p of s.enemies) if (!p.dead && p.kind === 'runner-boss') pacerPositions.push({ x: p.x, y: p.y });
  const pacerSpeed = speedPerTick('runner-boss');
  for (const e of s.enemies) {
    if (e.dead) continue;
    e.prevX = e.x;
    e.prevY = e.y;
    if (s.tick < e.stunUntilTick) continue; // stunned: stand still this tick
    const globalSlow = slowFactorFor(e.kind, s.enemySlowTicks > 0 ? AD_TIMEZONE_SPEED_MULT : 1);
    const slow = s.tick < e.slowUntilTick ? Math.min(globalSlow, e.slowFactor) : globalSlow;
    // The Pacer's aura is a speed floor: enemies inside 3 tiles move at the Pacer's speed or their
    // own, whichever is faster. Applied to the base speed before Frost, so it composes with slow.
    let baseSpeed = speedPerTick(e.kind);
    if (pacerPositions.length > 0) {
      for (const p of pacerPositions) {
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        if (dx * dx + dy * dy <= PACER_AURA_RADIUS * PACER_AURA_RADIUS) {
          if (pacerSpeed > baseSpeed) baseSpeed = pacerSpeed;
          break;
        }
      }
    }
    let remaining = baseSpeed * slow * speedMult;

    // A brood flyer scatters in a straight line for a moment, then re-paths toward the exit.
    if (e.kind === 'flyer' && e.scatterTicks > 0) {
      const step = speedPerTick('flyer') * slow * speedMult;
      e.x = clampToBoard(e.x + Math.cos(e.heading) * step, s.grid.cols);
      e.y = clampToBoard(e.y + Math.sin(e.heading) * step, s.grid.rows);
      e.dist += step;
      e.scatterTicks--;
      if (e.scatterTicks === 0) {
        e.col = Math.floor(e.x);
        e.row = Math.floor(e.y);
        e.targetCol = -1;
        e.targetRow = -1;
        // Join the sway from here: the base path starts at the scatter's end, the offset at zero.
        e.flightDist = 0;
        e.flightOffX = 0;
        e.flightOffY = 0;
        e.flightDirX = Math.cos(e.heading);
        e.flightDirY = Math.sin(e.heading);
      }
      continue;
    }

    const field = fieldFor(s, e);

    if (isFlyerKind(e.kind)) {
      flyFlyer(s, e, field, exit, remaining);
      continue;
    }

    // Chewing: a breacher chews a wall; the Ram chews any tower in its path, standing still.
    if (e.attackTowerId !== null) {
      const target = s.towers.find((t) => t.id === e.attackTowerId);
      if (isChewable(s, e, target)) {
        faceTower(e, target);
        chewTower(s, e, target);
        continue;
      }
      e.attackTowerId = null;
      e.targetCol = -1;
      e.targetRow = -1;
    }

    while (remaining > 0 && !e.dead) {
      if (e.targetCol < 0) {
        const next = stepToward(field, e.col, e.row);
        if (!next) break;
        // A breacher stops at a wall in its path instead of walking through it; the Ram stops at any
        // tower. An open gate is walkable, so it is never attacked.
        if (e.kind === 'breacher' || e.kind === 'breacher-boss') {
          const tower = towerAt(s, next.col, next.row);
          if (isChewable(s, e, tower)) {
            e.attackTowerId = tower.id;
            e.targetCol = next.col;
            e.targetRow = next.row;
            faceTower(e, tower);
            chewTower(s, e, tower);
            remaining = 0;
            break;
          }
        }
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
          if (isPopupEnemy(e)) popupEscaped(s, e);
          else leak(s, e);
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

/** Deal damage to a wall, destroying (and removing) it the moment its hit points run out. */
function damageWall(s: RunState, wall: Tower, amount: number): void {
  if (amount <= 0 || wall.hp <= 0) return;
  const dealt = Math.min(wall.hp, amount);
  wall.hp -= dealt;
  s.wallDamageTaken += dealt;
  s.events.push({ type: 'wallDamaged', x: wall.col + 0.5, y: wall.row + 0.5, amount: dealt });
  if (wall.hp <= 1e-9) {
    wall.hp = 0;
    destroyWall(s, wall);
  }
}

/** Remove a destroyed wall, unblocking its tile and recomputing the route in the same tick. */
function destroyWall(s: RunState, wall: Tower): void {
  s.towers = s.towers.filter((t) => t.id !== wall.id);
  s.blocked.delete(wall.row * s.grid.cols + wall.col);
  s.mines = s.mines.filter((m) => m.towerId !== wall.id);
  if (s.selectedTowerId === wall.id) s.selectedTowerId = null;
  for (const e of s.enemies) {
    if (e.attackTowerId === wall.id) {
      e.attackTowerId = null;
      e.targetCol = -1;
      e.targetRow = -1;
    }
  }
  rebuildField(s);
  recomputeAuras(s.towers, s.clock);
  s.events.push({ type: 'wallDestroyed', x: wall.col + 0.5, y: wall.row + 0.5 });
}

/**
 * Deal damage to a non-wall tower from the breacher's turret. A tower driven to 0 HP does not leave
 * the board: it goes offline — it stays put, stops firing and stops projecting auras, but can still
 * be repaired. Walls never reach here (the turret does not target them) but are routed to damageWall
 * as a safety net.
 */
function damageTower(s: RunState, tower: Tower, amount: number): void {
  if (amount <= 0 || tower.maxHp <= 0) return;
  if (hasUpgrade(s, 'structural-warranty')) amount *= WARRANTY_DAMAGE_MULT;
  if (isWall(tower)) {
    damageWall(s, tower, amount);
    return;
  }
  if (tower.hp <= 0) return; // already offline: nothing left to lose
  const dealt = Math.min(tower.hp, amount);
  tower.hp -= dealt;
  if (tower.hp <= 1e-9) {
    tower.hp = 0;
    recomputeAuras(s.towers, s.clock); // an offline beacon/repair stops buffing/healing immediately
    s.events.push({ type: 'towerOffline', x: tower.col + 0.5, y: tower.row + 0.5, towerId: tower.id });
    s.towerOfflineThisWave = true;
    if (s.salvageHitZeroThisWave) s.shadowBroke = true;
  }
}

/**
 * The nearest non-wall tower to a breacher, within turret range, that still has hit points to lose.
 * Offline towers (0 HP) and towers mid-repair are skipped. Ties keep tower order, so the choice is
 * deterministic.
 */
function breacherTurretTarget(s: RunState, e: Enemy, range: number): Tower | undefined {
  const r2 = range * range;
  let best: Tower | undefined;
  let bestD2 = Infinity;
  for (const t of s.towers) {
    if (isWall(t)) continue; // walls are the nose's job, never the turret's
    if (t.maxHp <= 0 || t.hp <= 0) continue;
    if (isRepairing(t, s.clock)) continue; // off the field
    const dx = t.col + 0.5 - e.x;
    const dy = t.row + 0.5 - e.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = t;
    }
  }
  return best;
}

/**
 * The breacher/Ram's mounted turret: while walking (not chewing a tower and not stunned) it fires a
 * shot at the nearest non-wall tower once per second. The Breacher's is 2 damage at 2.2 tiles; the
 * Ram's is 8 at 3. Chewing disarms it — the nose is busy — and it resumes the moment the tower is
 * gone (or offline).
 */
function fireBreacherTurrets(s: RunState): void {
  for (const e of s.enemies) {
    if (e.dead || (e.kind !== 'breacher' && e.kind !== 'breacher-boss')) continue;
    if (e.attackTowerId !== null) continue; // chewing: the nose is busy
    if (s.tick < e.stunUntilTick) continue; // stunned: not walking
    if (e.turretCooldown > 0) {
      e.turretCooldown--;
      continue;
    }
    const range = e.kind === 'breacher-boss' ? RAM_TURRET_RANGE : BREACHER_TURRET_RANGE;
    const target = breacherTurretTarget(s, e, range);
    if (!target) continue; // no target: stay ready, do not burn the clock
    e.turretCooldown = BREACHER_TURRET_INTERVAL_TICKS - 1;
    s.events.push({
      type: 'turretShot',
      x: e.x,
      y: e.y,
      targetX: target.col + 0.5,
      targetY: target.row + 0.5,
    });
    damageTower(s, target, e.kind === 'breacher-boss' ? RAM_TURRET_DAMAGE : BREACHER_TURRET_DAMAGE);
  }
}

function leak(s: RunState, e: Enemy): void {
  e.dead = true;
  s.totalLeaks++;
  s.wavesClearedSinceLeak = 0;
  s.leaksByWave.set(e.wave, (s.leaksByWave.get(e.wave) ?? 0) + 1);
  if (baseEnemyKind(e.kind) === 'flyer') s.flyerLeaksByWave.set(e.wave, (s.flyerLeaksByWave.get(e.wave) ?? 0) + 1);
  if (!s.godMode) {
    const after = s.integrity - ENEMY_STATS[e.kind].integrity;
    if (after <= 0 && hasUpgrade(s, 'emergency-patch') && !s.emergencyPatchSpent) {
      s.integrity = EMERGENCY_PATCH_INTEGRITY;
      s.emergencyPatchSpent = true;
    } else {
      s.integrity = Math.max(0, after);
    }
  }
  if (s.integrity < s.integrityLowWater) s.integrityLowWater = s.integrity;
  s.events.push({ type: 'leak', x: e.x, y: e.y });
  if (s.pointer.targetId === e.id) s.pointer.targetId = null;
  if (s.integrity === 0) {
    s.phase = 'halted';
    s.pointer.held = false;
  }
}

/**
 * A pop-up that reaches the exit leaves the board without costing integrity: it is not a leak, so it
 * never touches the leak counters, the integrity bar, or the end-of-run report. It still departs
 * silently, so a distinct event lets the view show a neutral status line instead of the leak effects.
 */
function popupEscaped(s: RunState, e: Enemy): void {
  e.dead = true;
  s.events.push({ type: 'popupEscaped', x: e.x, y: e.y });
}

/**
 * A pop-up window is a shield, not just camouflage: any enemy whose centre is inside its rectangle
 * is blind to towers, and the window itself can never be tower-targeted. The pointer is unaffected.
 */
function shieldedByPopup(s: RunState, e: Enemy): boolean {
  if (isPopupEnemy(e)) return true;
  for (const p of s.enemies) {
    if (p.dead || !isPopupEnemy(p)) continue;
    if (popupCovers(p, e.x, e.y)) return true;
  }
  return false;
}

/** Towers can hurt this enemy right now (shielded enemies are immune until the shield breaks). */
function towerCanHurt(s: RunState, e: Enemy): boolean {
  return !e.dead && e.shield <= 0 && !shieldedByPopup(s, e);
}

function inRange(t: Tower, e: Enemy, range: number): boolean {
  const r = range + radiusOf(e);
  return (e.x - (t.col + 0.5)) ** 2 + (e.y - (t.row + 0.5)) ** 2 <= r * r;
}

function intervalTicks(fireInterval: number): number {
  return Math.max(1, Math.round(fireInterval));
}

/**
 * A tower's fire interval in ticks, after Autoloader (`max(1, floor(interval * 0.87))`) and then
 * System Tray's Turbo (`max(1, floor(interval * 0.6))`) while it is live.
 */
export function towerIntervalTicks(s: RunState, fireInterval: number): number {
  let ticks = intervalTicks(fireInterval);
  if (hasUpgrade(s, 'autoloader')) ticks = Math.max(1, Math.floor(ticks * AUTOLOADER_INTERVAL_MULT));
  const turbo = buffIntervalMult(s);
  if (turbo !== 1) ticks = Math.max(1, Math.floor(ticks * turbo));
  return ticks;
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
/**
 * The only towers that can put a shot into the air. A Gun can, at a steep damage penalty, and the AA
 * tower exists for it; everything else cannot acquire a flyer at all — Taser and Frost cannot, and
 * neither can the Laser, the Cannon or a Cursor. This is what makes a flyer wave a real threat until
 * AA is scattered across the map, rather than a wave that a gun line absorbs.
 */
const AIR_TARGETABLE: ReadonlySet<TowerKind> = new Set<TowerKind>(['gun', 'aa']);

function towerCandidates(s: RunState, t: Tower, st: EffectiveStats, range: number): Enemy[] {
  const out: Enemy[] = [];
  for (const e of s.enemies) {
    if (!towerCanHurt(s, e)) continue;
    if (baseEnemyKind(e.kind) === 'flyer' && !AIR_TARGETABLE.has(t.kind)) continue;
    if (st.targetsFlyersOnly && baseEnemyKind(e.kind) !== 'flyer') continue;
    if (!inRange(t, e, range)) continue;
    out.push(e);
  }
  return out;
}

/** The tower's effective targeting priority: a per-kind lock wins over the player's choice. Beacon
 *  affects everything in range, so its mode is meaningless — always First. */
function effectiveTargetMode(t: Tower): TargetMode {
  const lock = TOWER_STATS[t.kind].targetLock;
  if (lock !== null) return lock;
  return t.kind === 'beacon' ? 'first' : t.targetMode;
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
  switch (effectiveTargetMode(t)) {
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
  const mode = effectiveTargetMode(t);
  out.sort((a, b) => {
    if (mode === 'strong') return b.hp - a.hp;
    if (mode === 'close') return dist2(a, t.col + 0.5, t.row + 0.5) - dist2(b, t.col + 0.5, t.row + 0.5);
    return b.dist - a.dist;
  });
  return out.slice(0, limit);
}

/**
 * How much of a Gun's damage reaches a flyer. Only the Gun and the AA can target air at all (see
 * AIR_TARGETABLE), and the Gun's share is deliberately small: it can finish a straggler, but a wave of
 * flyers is the AA tower's job. Chosen as a hypothesis — sharp enough that a gun line leaks badly
 * without AA, not so sharp that a stray flyer is unanswerable.
 */
export const FLYER_OFF_KIND_DAMAGE = 0.1;

function perEnemyDamage(st: EffectiveStats, e: Enemy, dmg: number, towerKind: TowerKind): number {
  let d = dmg;
  if (baseEnemyKind(e.kind) === 'flyer') {
    d *= st.flyerDamageMult;
    if (towerKind !== 'aa') d *= FLYER_OFF_KIND_DAMAGE;
  }
  if (baseEnemyKind(e.kind) === 'shielded') d *= st.shieldedDamageMult;
  return d;
}

function applySlow(s: RunState, e: Enemy, factor: number, ticks: number): void {
  // The Dreadnought's plating halves any slow's strength (Frost's 0.3 becomes 0.65, and so on).
  factor = slowFactorFor(e.kind, factor);
  if (!(s.tick < e.slowUntilTick) || factor < e.slowFactor) e.slowFactor = factor;
  e.slowUntilTick = s.tick + ticks;
}

/** Deal one tower hit. Returns whether the enemy died, so a shot can tally its own kill count. */
function hitEnemy(s: RunState, t: Tower, st: EffectiveStats, e: Enemy, dmg: number): boolean {
  damageEnemy(s, e, perEnemyDamage(st, e, dmg, t.kind), 'tower', st.ignoresArmour, t);
  if (st.slowFactor < 1 && st.slowTicks > 0 && !e.dead) applySlow(s, e, st.slowFactor, st.slowTicks);
  return e.dead;
}

function fireSplash(s: RunState, t: Tower, st: EffectiveStats, target: Enemy, dmg: number): void {
  const cx = target.x;
  const cy = target.y;
  let kills = 0;
  for (const e of s.enemies) {
    if (!towerCanHurt(s, e)) continue;
    if (st.targetsFlyersOnly && baseEnemyKind(e.kind) !== 'flyer') continue;
    const r = st.splash + radiusOf(e);
    if ((e.x - cx) ** 2 + (e.y - cy) ** 2 <= r * r && hitEnemy(s, t, st, e, dmg)) kills++;
  }
  if (t.kind === 'cannon' && kills > s.maxSplashKills) s.maxSplashKills = kills;
}

function fireChain(s: RunState, t: Tower, st: EffectiveStats, target: Enemy, dmg: number): void {
  let kills = hitEnemy(s, t, st, target, dmg) ? 1 : 0;
  const hitIds = new Set<number>([target.id]);
  let prev = target;
  for (let i = 1; i < st.chainCount; i++) {
    let next: Enemy | undefined;
    let best = Infinity;
    for (const e of s.enemies) {
      if (!towerCanHurt(s, e) || hitIds.has(e.id)) continue;
      if (st.targetsFlyersOnly && baseEnemyKind(e.kind) !== 'flyer') continue;
      const d2 = (e.x - prev.x) ** 2 + (e.y - prev.y) ** 2;
      if (d2 <= 1.5 * 1.5 && d2 < best) {
        best = d2;
        next = e;
      }
    }
    if (!next) break;
    hitIds.add(next.id);
    if (hitEnemy(s, t, st, next, dmg * st.chainDamage)) kills++;
    prev = next;
  }
  if (t.kind === 'taser' && kills > s.maxChainKills) s.maxChainKills = kills;
}

function fireBeam(s: RunState, t: Tower, st: EffectiveStats, target: Enemy, dmg: number): void {
  const ox = t.col + 0.5;
  const oy = t.row + 0.5;
  const hits: Enemy[] = [];
  for (const e of s.enemies) {
    if (!towerCanHurt(s, e)) continue;
    if (st.targetsFlyersOnly && baseEnemyKind(e.kind) !== 'flyer') continue;
    if (distanceToSegment(e.x, e.y, ox, oy, target.x, target.y) > 0.35) continue;
    hits.push(e);
  }
  hits.sort((a, b) => dist2(a, ox, oy) - dist2(b, ox, oy));
  const n = Math.min(st.pierce, hits.length);
  let kills = 0;
  for (let i = 0; i < n; i++) if (hitEnemy(s, t, st, hits[i], dmg)) kills++;
  if (t.kind === 'laser' && kills > s.maxBeamKills) s.maxBeamKills = kills;
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

// ---------------------------------------------------------------------------------------------
// Cursor towers

/** The cursor's home tile centre. */
function cursorHome(t: Tower): { x: number; y: number } {
  return { x: t.col + 0.5, y: t.row + 0.5 };
}

/**
 * A cursor may target any living enemy not hidden under a Pop Up window. Unlike towers it is not
 * blocked by the shield stat — pointer damage wears shields down, exactly like the player's clicks.
 */
function cursorCanTarget(s: RunState, e: Enemy): boolean {
  // A cursor is a hand on the board, not anti-air: it cannot click a flyer (see AIR_TARGETABLE).
  return !e.dead && !shieldedByPopup(s, e) && baseEnemyKind(e.kind) !== 'flyer';
}

/** Whether an enemy is inside the cursor's radius, measured to its home tile (not its arrow). */
function cursorInRadius(t: Tower, e: Enemy): boolean {
  const home = cursorHome(t);
  const dx = e.x - home.x;
  const dy = e.y - home.y;
  return dx * dx + dy * dy <= cursorRadius(t) ** 2;
}

/**
 * The enemy the cursor would acquire right now. Its rule is fixed, not a player choice:
 * shielded enemies first (nearest to the home tile), otherwise the nearest enemy to the home tile.
 * Pop-up concealment already removed those enemies as candidates, so a hidden enemy never wins.
 */
function cursorAcquire(s: RunState, t: Tower): Enemy | undefined {
  const home = cursorHome(t);
  const radius = cursorRadius(t);
  const r2 = radius * radius;
  let shielded: Enemy | undefined;
  let shieldedD2 = Infinity;
  let nearest: Enemy | undefined;
  let nearestD2 = Infinity;
  for (const e of s.enemies) {
    if (!cursorCanTarget(s, e)) continue;
    const dx = e.x - home.x;
    const dy = e.y - home.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    if (e.shield > 0) {
      if (d2 < shieldedD2) {
        shieldedD2 = d2;
        shielded = e;
      }
    } else if (d2 < nearestD2) {
      nearestD2 = d2;
      nearest = e;
    }
  }
  return shielded ?? nearest;
}

/** Whether a proposed cursor position stays off authored wall tiles (towers do not stop it). */
function cursorStepOk(s: RunState, x: number, y: number): boolean {
  const col = Math.floor(x);
  const row = Math.floor(y);
  return inBounds(col, row) && tileAt(s.grid, col, row) === 'buildable';
}

/** A cursor click's damage: half the player's click damage, pointer-sourced (no crit, no mark). */
function cursorDamage(s: RunState, t: Tower): number {
  return cursorClickDamage(t, clickDamage(s.pointer), pointerDamageMult(s));
}

/** A cursor click: pointer damage on the target, then the clock gate re-arms. */
function cursorClick(s: RunState, t: Tower, target: Enemy): void {
  damageEnemy(s, target, cursorDamage(s, t), 'pointer', true, undefined, false, false);
  if (target.dead) s.cursorKills++;
  // Full interval: tickCursors decrements at the top of the next tick before checking the gate, so
  // a full-interval value here yields exactly `cursorClickIntervalTicks` ticks between clicks.
  t.cursorCooldown = cursorClickIntervalTicks(t);
  t.cursorClickFx = 8;
  t.cursorClickX = target.x;
  t.cursorClickY = target.y;
}

/** Idle drift around the home tile: a deterministic seeded path that never leaves the radius. */
function wanderCursor(s: RunState, t: Tower): void {
  const home = cursorHome(t);
  const radius = cursorRadius(t);
  const step = CURSOR_WANDER_SPEED / TICK_HZ;

  const r = rngNext(t.cursorWanderSeed);
  t.cursorWanderSeed = r.next;
  const turn = (r.value - 0.5) * 0.6;
  let angle = t.cursorWanderAngle + turn;

  let nx = t.cursorX + Math.cos(angle) * step;
  let ny = t.cursorY + Math.sin(angle) * step;

  const dx = nx - home.x;
  const dy = ny - home.y;
  const d = Math.hypot(dx, dy);
  if (d > radius) {
    nx = home.x + (dx / d) * radius;
    ny = home.y + (dy / d) * radius;
    angle = Math.atan2(-dy, -dx);
  }

  if (!cursorStepOk(s, nx, ny)) {
    angle += Math.PI;
    nx = t.cursorX;
    ny = t.cursorY;
  }

  t.cursorX = nx;
  t.cursorY = ny;
  t.cursorWanderAngle = angle;
}

/** Clamp the cursor to its radius and off authored walls (a safety net for travel). */
function clampCursor(s: RunState, t: Tower): void {
  const home = cursorHome(t);
  const radius = cursorRadius(t);
  const dx = t.cursorX - home.x;
  const dy = t.cursorY - home.y;
  const d = Math.hypot(dx, dy);
  if (d > radius) {
    t.cursorX = home.x + (dx / d) * radius;
    t.cursorY = home.y + (dy / d) * radius;
  }
  if (!cursorStepOk(s, t.cursorX, t.cursorY)) {
    t.cursorX = home.x;
    t.cursorY = home.y;
  }
}

/** Whether any living enemy sits inside the cursor's radius (maintenance waits for a clear area). */
function cursorRadiusHasEnemy(s: RunState, t: Tower): boolean {
  for (const e of s.enemies) {
    if (e.dead) continue;
    if (cursorInRadius(t, e)) return true;
  }
  return false;
}

/** Whether a Maintenance cursor may repair `o` right now: damaged below the threshold, not destroyed,
 *  not mid-repair, and not the cursor's own plinth. */
function cursorRepairEligible(t: Tower, o: Tower, clock: number): boolean {
  if (o.id === t.id) return false;
  if (o.maxHp <= 0) return false; // an offline tower (hp 0) is a valid repair target, not destroyed
  if (o.hp >= o.maxHp) return false;
  if (o.hp >= CURSOR_REPAIR_THRESHOLD * o.maxHp) return false;
  if (isRepairing(o, clock)) return false;
  return true;
}

/** The damaged tower a Maintenance cursor would repair: lowest health fraction, then nearest. */
function cursorRepairAcquire(s: RunState, t: Tower): Tower | undefined {
  const home = cursorHome(t);
  const r2 = cursorRadius(t) ** 2;
  let best: Tower | undefined;
  let bestFrac = Infinity;
  let bestD2 = Infinity;
  for (const o of s.towers) {
    if (!cursorRepairEligible(t, o, s.clock)) continue;
    const dx = o.col + 0.5 - home.x;
    const dy = o.row + 0.5 - home.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    const frac = o.hp / o.maxHp;
    if (frac < bestFrac || (frac === bestFrac && d2 < bestD2)) {
      bestFrac = frac;
      bestD2 = d2;
      best = o;
    }
  }
  return best;
}

/** A Maintenance cursor with a clear radius flies to a damaged tower and clicks to start a repair. */
function tickMaintenanceCursor(s: RunState, t: Tower): void {
  let target: Tower | undefined;
  if (t.cursorRepairTowerId !== null) {
    target = s.towers.find((o) => o.id === t.cursorRepairTowerId);
    if (target && !cursorRepairEligible(t, target, s.clock)) target = undefined;
    if (target) {
      const home = cursorHome(t);
      const dx = target.col + 0.5 - home.x;
      const dy = target.row + 0.5 - home.y;
      if (dx * dx + dy * dy > cursorRadius(t) ** 2) target = undefined;
    }
  }
  if (!target) {
    target = cursorRepairAcquire(s, t);
    t.cursorRepairTowerId = target ? target.id : null;
  }
  if (!target) {
    wanderCursor(s, t);
    return;
  }

  const tx = target.col + 0.5;
  const ty = target.row + 0.5;
  const dx = tx - t.cursorX;
  const dy = ty - t.cursorY;
  const d = Math.hypot(dx, dy);
  if (d <= CURSOR_CLICK_RANGE) {
    if (t.cursorCooldown === 0) {
      // Re-check eligibility at the moment of the click, so a Repair aura that healed the tower over
      // the threshold mid-flight never gets topped up past it.
      if (!cursorRepairEligible(t, target, s.clock)) {
        t.cursorRepairTowerId = null;
        return;
      }
      t.cursorClickFx = 8;
      t.cursorClickX = tx;
      t.cursorClickY = ty;
      t.cursorCooldown = cursorClickIntervalTicks(t);
      if (startRepair(s, target.col, target.row)) {
        s.cursorRepairs++;
        s.cursorRepairsByTower.set(t.id, (s.cursorRepairsByTower.get(t.id) ?? 0) + 1);
        t.cursorRepairTowerId = null;
        wanderCursor(s, t);
      }
      // Otherwise the player cannot afford the repair: the branch stays idle and no salvage moves.
    }
  } else if (d > 0) {
    const step = CURSOR_TRAVEL_SPEED / TICK_HZ;
    const nx = t.cursorX + (dx / d) * step;
    const ny = t.cursorY + (dy / d) * step;
    if (cursorStepOk(s, nx, ny)) {
      t.cursorX = nx;
      t.cursorY = ny;
    }
  }
}

/** Advance every cursor tower one tick: wander when idle, fly to and click a target otherwise. */
function tickCursors(s: RunState): void {
  for (const t of s.towers) {
    if (t.kind !== 'cursor') continue;
    if (isDown(t, s.clock)) continue; // an offline (or EMP'd) cursor stops clicking
    if (t.cursorCooldown > 0) t.cursorCooldown--;
    if (t.cursorClickFx > 0) t.cursorClickFx--;

    // Maintenance never competes with combat: only when no enemy is inside the radius does a
    // tier-3+ Maintenance cursor switch to repairing damaged towers.
    if (t.tier >= 3 && t.branch === 'C' && !cursorRadiusHasEnemy(s, t)) {
      tickMaintenanceCursor(s, t);
      clampCursor(s, t);
      continue;
    }

    let target: Enemy | undefined;
    // Manual Override wins over the fixed rule, exactly as it beats a tower's lock: while the marked
    // enemy is in range and targetable, the cursor flies to and clicks it instead of its own priority.
    if (s.phase === 'wave' && s.pointer.manualOverride && s.pointer.targetId !== null) {
      const marked = s.enemies.find((e) => e.id === s.pointer.targetId && !e.dead);
      if (marked && cursorCanTarget(s, marked) && cursorInRadius(t, marked)) target = marked;
    }
    if (!target && t.cursorTargetId !== null) {
      target = s.enemies.find((e) => e.id === t.cursorTargetId && !e.dead);
      if (target && !cursorCanTarget(s, target)) target = undefined;
      if (target && !cursorInRadius(t, target)) target = undefined;
    }
    if (!target) {
      if (s.phase === 'wave') target = cursorAcquire(s, t);
      t.cursorTargetId = target ? target.id : null;
    }

    if (target) {
      const dx = target.x - t.cursorX;
      const dy = target.y - t.cursorY;
      const d = Math.hypot(dx, dy);
      if (d <= CURSOR_CLICK_RANGE) {
        if (t.cursorCooldown === 0) cursorClick(s, t, target);
      } else if (d > 0) {
        const step = CURSOR_TRAVEL_SPEED / TICK_HZ;
        const nx = t.cursorX + (dx / d) * step;
        const ny = t.cursorY + (dy / d) * step;
        if (cursorStepOk(s, nx, ny)) {
          t.cursorX = nx;
          t.cursorY = ny;
        }
      }
    } else {
      wanderCursor(s, t);
    }

    clampCursor(s, t);
  }
}

/**
 * The live status line for a Maintenance cursor's panel and tooltip, or null for any other cursor.
 * It names what the cursor is doing right now: fighting (enemies in range), chasing a repair, or
 * idle because there is nothing damaged to fix.
 */
export function cursorMaintenanceStatus(s: RunState, t: Tower): string | null {
  if (t.tier < 3 || t.branch !== 'C') return null;
  if (cursorRadiusHasEnemy(s, t)) return 'Idle — enemies in range';
  let target: Tower | undefined;
  if (t.cursorRepairTowerId !== null) {
    target = s.towers.find((o) => o.id === t.cursorRepairTowerId);
    if (target && !cursorRepairEligible(t, target, s.clock)) target = undefined;
  }
  if (!target) target = cursorRepairAcquire(s, t);
  if (!target) return 'Idle — nothing to repair';
  const pct = Math.round((target.hp / target.maxHp) * 100);
  return `Repairing ${towerName(target.kind)} ${pct}%`;
}

function fireTowers(s: RunState): void {
  const buff = s.towerDamageBuffTicks > 0 ? AD_AUTOUPDATE_DAMAGE_MULT : 1;
  const layout = synergyLayout(s);
  for (const t of s.towers) {
    if (layout.clusterOf.has(t.id)) continue; // a clustered AA fires with its cluster, below
    if ((s.towerDisabled.get(t.id) ?? 0) > 0) continue; // disabled by Blue Screen
    if (isDown(t, s.clock)) continue; // an offline (or EMP'd) tower does not fire
    if (isMinesweeper(t)) continue; // a Minesweeper lays mines instead of firing
    const st = effectiveStats(t);
    if (st.damage <= 0 || st.fireInterval <= 0) continue; // beacon never fires
    const range = effectiveRange(s, t, st);
    const dmg = st.damage * t.auraDamage * buff * towerDamageMult(s);

    // Manual Override: while it is on, the marked enemy is this tower's target whenever it is in
    // range, overriding every targeting mode and lock. Pop-up shields are never pierced.
    let overrideTarget: Enemy | undefined;
    if (s.pointer.manualOverride && s.pointer.targetId !== null) {
      const marked = s.enemies.find((e) => e.id === s.pointer.targetId && !e.dead);
      if (
        marked &&
        towerCanHurt(s, marked) &&
        (!st.targetsFlyersOnly || baseEnemyKind(marked.kind) === 'flyer') &&
        inRange(t, marked, range)
      ) {
        overrideTarget = marked;
      }
    }

    // Pick the target(s) exactly as before, so targeting priorities are unchanged by traverse.
    const targets =
      overrideTarget !== undefined
        ? [overrideTarget]
        : st.beams > 1
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
      t.cooldown = towerIntervalTicks(s, st.fireInterval) - 1;
      for (const tg of targets) {
        s.events.push({ type: 'shot', towerId: t.id, x: tg.x, y: tg.y, splash: st.splash });
        fireBeam(s, t, st, tg, dmg * st.beamDamage);
      }
      continue;
    }

    const target = targets[0];
    t.cooldown = towerIntervalTicks(s, st.fireInterval) - 1;

    // The AA's tier-3 branches fire projectiles rather than hitscan. Its base form (no branch) falls
    // through to the ordinary single-target hit below, which already applies the flyer-only targeting
    // and the 2x flyer multiplier from the kind's stats.
    if (t.kind === 'aa' && t.branch === 'A') {
      fireFlakShell(s, t, st, target, dmg);
      continue;
    }
    if (t.kind === 'aa' && t.branch === 'B') {
      fireMissileSalvo(s, t, st, target, dmg);
      continue;
    }

    s.events.push({ type: 'shot', towerId: t.id, x: target.x, y: target.y, splash: st.splash });

    if (st.pierce > 1) fireBeam(s, t, st, target, dmg);
    else if (st.chainCount > 0) fireChain(s, t, st, target, dmg);
    else if (st.splash > 0) fireSplash(s, t, st, target, dmg);
    else hitEnemy(s, t, st, target, dmg);
  }

  // Synchronized Fire (docs/SYNERGIES.md §4.2): each cluster is handled in one lead-order pass, so
  // leaders fire before the followers that wait on them.
  for (const cluster of layout.clusters) processSynergyCluster(s, cluster, buff);
}

/**
 * The memoised synergy layout for a state. Rebuilt only when the tower roster changed (the revision
 * counter), so the O(n²) adjacency scan does not run every tick. A rebuild also clears the held-shot
 * maps: a follower whose leader was sold, moved or re-rolled must re-evaluate from a clean hold.
 */
const synergyLayoutCache = new WeakMap<RunState, { rev: number; layout: SynergyLayout }>();
export function synergyLayout(s: RunState): SynergyLayout {
  let cached = synergyLayoutCache.get(s);
  if (cached === undefined || cached.rev !== s.synergyRev) {
    cached = { rev: s.synergyRev, layout: buildSynergyLayout(s.towers) };
    synergyLayoutCache.set(s, cached);
    s.synergyHoldSince.clear();
    s.synergyHoldTarget.clear();
  }
  return cached.layout;
}

/** Drop any held shot for a tower, because it fired, cooled, lost its target or stopped aiming. */
function clearSynergyHold(s: RunState, id: number): void {
  s.synergyHoldSince.delete(id);
  s.synergyHoldTarget.delete(id);
}

/** Fire one AA shot. A follower that fires writes its own cooldown and never anyone else's. */
function fireAaShot(s: RunState, t: Tower, st: EffectiveStats, dmg: number, target: Enemy): void {
  t.cooldown = towerIntervalTicks(s, st.fireInterval) - 1;
  // The AA's tier-3 branches fire projectiles rather than hitscan; the base form is a plain hit.
  if (t.kind === 'aa' && t.branch === 'A') {
    fireFlakShell(s, t, st, target, dmg);
    return;
  }
  if (t.kind === 'aa' && t.branch === 'B') {
    fireMissileSalvo(s, t, st, target, dmg);
    return;
  }
  s.events.push({ type: 'shot', towerId: t.id, x: target.x, y: target.y, splash: st.splash });
  hitEnemy(s, t, st, target, dmg);
}

/**
 * Advance one AA cluster for a tick. Members are walked in lead order; a follower that is ready to
 * fire and has a live, soon-to-fire leader that has not fired this tick holds its shot instead. A
 * hold never writes a cooldown and is re-evaluated every tick against a live target.
 */
function processSynergyCluster(s: RunState, cluster: SynergyCluster, buff: number): void {
  const members = cluster.members;
  const n = members.length;
  const live = new Array<boolean>(n);
  const fired = new Array<boolean>(n);
  const hasTarget = new Array<boolean>(n);
  const cooldownAfter = new Array<number>(n);

  for (let i = 0; i < n; i++) {
    const t = members[i];
    const disabled = (s.towerDisabled.get(t.id) ?? 0) > 0;
    const down = isDown(t, s.clock);
    live[i] = !disabled && !down;

    if (disabled || down) {
      clearSynergyHold(s, t.id);
      continue;
    }
    if (isMinesweeper(t)) {
      clearSynergyHold(s, t.id);
      continue;
    }
    const st = effectiveStats(t);
    if (st.damage <= 0 || st.fireInterval <= 0) {
      clearSynergyHold(s, t.id);
      continue;
    }
    const range = effectiveRange(s, t, st);
    const dmg = st.damage * t.auraDamage * buff * towerDamageMult(s);

    // Manual Override: identical to the per-tower walk, so a marked enemy still wins the target.
    let overrideTarget: Enemy | undefined;
    if (s.pointer.manualOverride && s.pointer.targetId !== null) {
      const marked = s.enemies.find((e) => e.id === s.pointer.targetId && !e.dead);
      if (
        marked &&
        towerCanHurt(s, marked) &&
        (!st.targetsFlyersOnly || baseEnemyKind(marked.kind) === 'flyer') &&
        inRange(t, marked, range)
      ) {
        overrideTarget = marked;
      }
    }
    const targets =
      overrideTarget !== undefined
        ? [overrideTarget]
        : ((): Enemy[] => {
            const tg = acquireTarget(s, t, st, range);
            return tg ? [tg] : [];
          })();

    if (t.cooldown > 0) {
      t.cooldown--;
      cooldownAfter[i] = t.cooldown;
      hasTarget[i] = targets.length > 0;
      if (targets.length > 0) aimToward(t, bearingTo(t, targets[0]), st.turnRate);
      clearSynergyHold(s, t.id);
      continue;
    }

    if (targets.length === 0) {
      cooldownAfter[i] = 0;
      hasTarget[i] = false;
      clearSynergyHold(s, t.id);
      continue;
    }

    if (!aimToward(t, bearingTo(t, targets[0]), st.turnRate)) {
      cooldownAfter[i] = 0;
      hasTarget[i] = true;
      clearSynergyHold(s, t.id);
      continue;
    }

    const target = targets[0];
    cooldownAfter[i] = 0;
    hasTarget[i] = true;

    // A live leader that has not fired this tick and will fire within the hold window blocks the shot.
    let blocked = false;
    for (const li of cluster.leaders[i]) {
      if (live[li] && !fired[li] && hasTarget[li] && cooldownAfter[li] <= AA_HOLD_WINDOW) {
        blocked = true;
        break;
      }
    }

    if (!blocked) {
      fireAaShot(s, t, st, dmg, target);
      fired[i] = true;
      clearSynergyHold(s, t.id);
      continue;
    }

    // The follower would hold. It fires anyway when the target it was waiting to shoot is gone or out
    // of range, or when it has held for the backstop.
    const since = s.synergyHoldSince.get(t.id);
    const heldTarget = s.synergyHoldTarget.get(t.id);
    const heldEnemy = heldTarget !== undefined ? s.enemies.find((e) => e.id === heldTarget && !e.dead) : undefined;
    const lostTarget = heldTarget !== undefined && (heldEnemy === undefined || !towerCanHurt(s, heldEnemy) || !inRange(t, heldEnemy, range));
    const heldLongEnough = since !== undefined && s.tick - since + 1 >= AA_HOLD_CAP;

    if (lostTarget || heldLongEnough) {
      fireAaShot(s, t, st, dmg, target);
      fired[i] = true;
      clearSynergyHold(s, t.id);
    } else if (since === undefined) {
      s.synergyHoldSince.set(t.id, s.tick);
      s.synergyHoldTarget.set(t.id, target.id);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Minesweeper mines

/** The path tile a Minesweeper drops its next mine on: the nearest within its drop range. */
function nearestPathTile(s: RunState, tower: Tower): Tile | null {
  const path = currentPath(s);
  const tx = tower.col + 0.5;
  const ty = tower.row + 0.5;
  const range2 = MINE_PLACE_RANGE * MINE_PLACE_RANGE;
  let best: Tile | null = null;
  let bestD2 = Infinity;
  for (const tile of path) {
    const dx = tile.col + 0.5 - tx;
    const dy = tile.row + 0.5 - ty;
    const d2 = dx * dx + dy * dy;
    if (d2 > range2) continue;
    // Ties keep the lowest row then column, so the choice is deterministic.
    if (
      best === null ||
      d2 < bestD2 ||
      (d2 === bestD2 && (tile.row < best.row || (tile.row === best.row && tile.col < best.col)))
    ) {
      best = tile;
      bestD2 = d2;
    }
  }
  return best;
}

/** Drop one mine at the tower's nearest path tile, evicting its oldest mine at the 6-mine cap. */
function layMine(s: RunState, tower: Tower): void {
  const tile = nearestPathTile(s, tower);
  if (tile === null) return;
  const owned = s.mines.filter((m) => m.towerId === tower.id);
  if (owned.length >= MINE_LIVE_CAP) {
    let oldest = owned[0];
    for (const m of owned) if (m.placedTick < oldest.placedTick) oldest = m;
    s.mines = s.mines.filter((m) => m.id !== oldest.id);
  }
  const now = s.clock;
  s.mines.push({
    id: s.nextId++,
    towerId: tower.id,
    x: tile.col + 0.5,
    y: tile.row + 0.5,
    placedTick: now,
    armedAtTick: now + MINE_ARM_TICKS,
    expiresTick: now + MINE_EXPIRE_TICKS,
  });
}

/** Detonate every armed mine a ground enemy has walked onto, damaging ground enemies in the blast. */
function detonateMines(s: RunState): void {
  if (s.mines.length === 0) return;
  const remaining: Mine[] = [];
  const trigger2 = MINE_TRIGGER_RADIUS * MINE_TRIGGER_RADIUS;
  const blast2 = MINE_BLAST_RADIUS * MINE_BLAST_RADIUS;
  for (const m of s.mines) {
    if (s.clock < m.armedAtTick) {
      remaining.push(m);
      continue;
    }
    let triggered = false;
    for (const e of s.enemies) {
      if (e.dead || isFlyerKind(e.kind) || isPopupEnemy(e)) continue;
      if ((e.x - m.x) ** 2 + (e.y - m.y) ** 2 <= trigger2) {
        triggered = true;
        break;
      }
    }
    if (!triggered) {
      remaining.push(m);
      continue;
    }
    const tower = s.towers.find((t) => t.id === m.towerId);
    s.minesTriggered++;
    for (const e of s.enemies) {
      if (isFlyerKind(e.kind) || !towerCanHurt(s, e)) continue;
      if ((e.x - m.x) ** 2 + (e.y - m.y) ** 2 <= blast2) {
        damageEnemy(s, e, MINE_DAMAGE, 'tower', false, tower);
      }
    }
    s.events.push({ type: 'mineDetonated', x: m.x, y: m.y });
  }
  s.mines = remaining;
}

/** Advance mines one tick: expire, drop new ones on each Minesweeper's clock, then detonate. */
function tickMines(s: RunState): void {
  s.mines = s.mines.filter((m) => s.clock < m.expiresTick);
  for (const t of s.towers) {
    if (!isMinesweeper(t)) continue;
    if ((s.towerDisabled.get(t.id) ?? 0) > 0) continue; // disabled by Blue Screen
    if (isDown(t, s.clock)) continue; // an offline (or EMP'd) Minesweeper lays nothing
    if (isRepairing(t, s.clock)) continue; // a Minesweeper mid-repair is off the field
    t.mineCooldown--;
    if (t.mineCooldown <= 0) {
      layMine(s, t);
      t.mineCooldown = MINE_INTERVAL_TICKS;
    }
  }
  detonateMines(s);
}

// ---------------------------------------------------------------------------------------------
// AA projectiles

/** A flyer's instantaneous velocity in tiles per second, from its heading and nominal speed. */
function flyerVelocity(e: Enemy): { vx: number; vy: number } {
  const speed = speedPerTick(e.kind) * TICK_HZ;
  return { vx: Math.cos(e.heading) * speed, vy: Math.sin(e.heading) * speed };
}

/** Launch a Flak shell toward the target's predicted position; it bursts when its flight elapses. */
function fireFlakShell(s: RunState, t: Tower, st: EffectiveStats, target: Enemy, dmg: number): void {
  const ox = t.col + 0.5;
  const oy = t.row + 0.5;
  const dist = Math.hypot(target.x - ox, target.y - oy);
  const flightTicks = Math.max(1, Math.ceil(dist / (SHELL_SPEED / TICK_HZ)));
  const flightSec = flightTicks / TICK_HZ;
  const vel = flyerVelocity(target);
  const px = target.x + vel.vx * flightSec;
  const py = target.y + vel.vy * flightSec;
  s.projectiles.push({
    id: s.nextId++,
    kind: 'shell',
    x: ox,
    y: oy,
    vx: (px - ox) / flightSec,
    vy: (py - oy) / flightSec,
    targetId: target.id,
    towerId: t.id,
    damage: dmg,
    lifetime: flightTicks,
  });
  s.events.push({ type: 'shot', towerId: t.id, x: target.x, y: target.y, splash: st.splash });
}

/** Launch a four-missile salvo; each missile picks a seeded direction, then homes onto the target. */
function fireMissileSalvo(s: RunState, t: Tower, st: EffectiveStats, target: Enemy, dmg: number): void {
  const ox = t.col + 0.5;
  const oy = t.row + 0.5;
  const perMissile = dmg / AA_SALVO_COUNT;
  let rng = missileSeed(s.tick, t.id, t.salvoCount);
  t.salvoCount++;
  for (let i = 0; i < AA_SALVO_COUNT; i++) {
    const r = rngNext(rng);
    rng = r.next;
    const angle = r.value * Math.PI * 2;
    s.projectiles.push({
      id: s.nextId++,
      kind: 'missile',
      x: ox,
      y: oy,
      vx: Math.cos(angle) * MISSILE_INITIAL_SPEED,
      vy: Math.sin(angle) * MISSILE_INITIAL_SPEED,
      targetId: target.id,
      towerId: t.id,
      damage: perMissile,
      lifetime: MISSILE_LIFETIME_TICKS,
    });
  }
  s.events.push({ type: 'shot', towerId: t.id, x: target.x, y: target.y, splash: st.splash });
}

/** The nearest flyer within `range` tiles of (x, y) that towers can currently hurt. */
function nearestFlyer(s: RunState, x: number, y: number, range: number): Enemy | undefined {
  let best: Enemy | undefined;
  let bestD2 = range * range;
  for (const e of s.enemies) {
    if (e.dead || baseEnemyKind(e.kind) !== 'flyer') continue;
    if (!towerCanHurt(s, e)) continue;
    const d2 = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d2 <= bestD2) {
      bestD2 = d2;
      best = e;
    }
  }
  return best;
}

/** Turn a missile's velocity toward its target by at most the turn rate, then accelerate. */
function steerMissile(p: Projectile, target: Enemy, dt: number): void {
  const dx = target.x - p.x;
  const dy = target.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d <= 0) return;
  const desired = Math.atan2(dy, dx);
  const current = Math.atan2(p.vy, p.vx);
  let diff = normalizeAngle(desired - current);
  const maxTurn = MISSILE_TURN_RATE * dt;
  if (Math.abs(diff) > maxTurn) diff = Math.sign(diff) * maxTurn;
  const angle = current + diff;
  const speed = Math.min(MISSILE_MAX_SPEED, Math.hypot(p.vx, p.vy) + MISSILE_ACCEL * dt);
  p.vx = Math.cos(angle) * speed;
  p.vy = Math.sin(angle) * speed;
}

/** A missile detonates when it closes to its target's radius plus a small arming distance. */
function missileReached(p: Projectile, target: Enemy): boolean {
  const r = radiusOf(target) + MISSILE_HIT_RANGE;
  return (target.x - p.x) ** 2 + (target.y - p.y) ** 2 <= r * r;
}

/** A Flak shell bursts: full damage to flyers in radius, half to ground, both only inside it. */
function burstShell(s: RunState, p: Projectile): void {
  const tower = s.towers.find((t) => t.id === p.towerId);
  if (!tower) return; // the tower was sold mid-flight: the shell fizzles without damage
  const st = effectiveStats(tower);
  const r = st.splash;
  const cx = p.x;
  const cy = p.y;
  // The impact: the enemy nearest the burst point among those the burst actually damaged. The
  // shell's designated target may have moved, died or never been in the radius at all.
  let impact: Enemy | undefined;
  let impactD2 = Infinity;
  for (const e of s.enemies) {
    if (!towerCanHurt(s, e)) continue;
    const rr = r + radiusOf(e);
    const d2 = (e.x - cx) ** 2 + (e.y - cy) ** 2;
    if (d2 > rr * rr) continue;
    if (baseEnemyKind(e.kind) === 'flyer') hitEnemy(s, tower, st, e, p.damage);
    else hitEnemy(s, tower, st, e, p.damage * 0.5);
    if (d2 < impactD2) {
      impactD2 = d2;
      impact = e;
    }
  }
  if (impact) telemetrySplash(s, tower, st, impact, p.damage);
}

/**
 * Ballistic Telemetry: a shell or missile that connects deals half its damage again to the nearest
 * other flyer within one tile of the enemy it hit (docs/GLOBAL-UPGRADES.md §4).
 */
function telemetrySplash(s: RunState, tower: Tower, st: EffectiveStats, hit: Enemy, damage: number): void {
  if (!hasUpgrade(s, 'ballistic-telemetry')) return;
  let best: Enemy | undefined;
  let bestD2 = TELEMETRY_SPLASH_RANGE * TELEMETRY_SPLASH_RANGE;
  for (const e of s.enemies) {
    if (e.id === hit.id || e.dead || baseEnemyKind(e.kind) !== 'flyer') continue;
    if (!towerCanHurt(s, e)) continue;
    const d2 = (e.x - hit.x) ** 2 + (e.y - hit.y) ** 2;
    if (d2 <= bestD2) {
      bestD2 = d2;
      best = e;
    }
  }
  if (best) hitEnemy(s, tower, st, best, damage * TELEMETRY_SPLASH_MULT);
}

/** Advance every projectile one tick: shells fly and burst, missiles home and detonate. */
function tickProjectiles(s: RunState): void {
  if (s.projectiles.length === 0) return;
  const dt = 1 / TICK_HZ;
  const next: Projectile[] = [];
  for (const p of s.projectiles) {
    p.lifetime--;
    if (p.kind === 'shell') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.lifetime <= 0) burstShell(s, p);
      else next.push(p);
      continue;
    }

    // Missile: hold the designated target while it lives; otherwise retarget the nearest flyer each
    // tick. A missile never acquires (or hurts) a ground unit.
    let target: Enemy | undefined;
    if (p.targetId !== null) {
      target = s.enemies.find((e) => e.id === p.targetId && !e.dead && baseEnemyKind(e.kind) === 'flyer');
    }
    if (!target) {
      target = nearestFlyer(s, p.x, p.y, MISSILE_RETARGET_RANGE);
      p.targetId = target ? target.id : null;
    }
    if (target) steerMissile(p, target, dt);
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (target && missileReached(p, target)) {
      const tower = s.towers.find((t) => t.id === p.towerId);
      if (tower && towerCanHurt(s, target)) {
        const st = effectiveStats(tower);
        hitEnemy(s, tower, st, target, p.damage);
        telemetrySplash(s, tower, st, target, p.damage);
      }
      // Otherwise the missile is spent on a pop-up-shielded target: it lands, but nothing is hurt.
    } else if (p.lifetime <= 0) {
      // expired: dropped.
    } else {
      next.push(p);
    }
  }
  s.projectiles = next;
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
  if (!target) return;
  // The held pointer can crit too, and its crit shakes by the same rule as a click's: 1 px, or 2 px
  // on the weak point / the marked enemy. The reticle is always on its marked target, and the weak
  // point follows the cursor.
  const marked = true;
  const weak = isWeakPointHit(target, p.x, p.y);
  const roll = nextCritRoll(s.rng, marked, weak);
  s.rng = roll.next;
  damageEnemy(
    s,
    target,
    dpt * relay.damage * comboMultiplier(p) * pointerDamageMult(s) * pointerUpgradeMult(s) * (roll.crit ? CRIT_MULTIPLIER : 1),
    'pointer',
    true,
    undefined,
    weak,
    roll.crit,
    marked,
  );
}

/** How many live beacons are currently boosting a tower (used for the beacon-buff achievement). */
function beaconsBuffing(s: RunState, tower: Tower): number {
  let n = 0;
  for (const b of s.towers) {
    if (b.kind !== 'beacon' || b.id === tower.id || isDown(b, s.clock)) continue;
    const st = effectiveStats(b);
    const r = st.range;
    const dx = tower.col + 0.5 - (b.col + 0.5);
    const dy = tower.row + 0.5 - (b.row + 0.5);
    if (dx * dx + dy * dy <= r * r) n++;
  }
  return n;
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
  crit = false,
  marked = false,
): void {
  if (e.dead || amount <= 0) return;
  if (source === 'tower') e.towerDamaged = true;
  let dmg = amount;
  if (source === 'pointer' && e.shieldsRemaining > 0) {
    // Bastion layers: one layer per hit, worth the base shield, never overflowing into hit points.
    e.shieldsRemaining -= 1;
    e.shield = e.shieldsRemaining * BASTION_SHIELD_LAYER_VALUE;
    s.shieldsBroken++;
    s.events.push({ type: 'shieldHit', x: e.x, y: e.y, absorbed: BASTION_SHIELD_LAYER_VALUE, left: e.shield });
    return;
  }
  if (source === 'pointer' && e.shield > 0) {
    const absorbed = Math.min(e.shield, dmg);
    e.shield -= absorbed;
    dmg -= absorbed;
    if (e.shield <= 1e-9) s.shieldsBroken++;
    // A shield absorbing the hit is still a hit the player must see: emit a distinct event even when
    // nothing overflows into hit points, so a cursor stripping a shield is not silently invisible.
    s.events.push({ type: 'shieldHit', x: e.x, y: e.y, absorbed, left: e.shield });
  } else if (source === 'tower') {
    if (e.shield > 0) return;
    // Armour and plating are both flat per-hit reductions; a tower that ignores armour ignores both
    // (the Taser), and the pointer never passes through here at all.
    // The floor exists so armour never makes a hit literally zero. It is `min(1, dmg)` rather than a flat
    // 1 so a hit that was already reduced below 1 - a non-AA tower chipping a flyer - stays reduced.
    if (!ignoresArmour) {
      dmg = Math.max(Math.min(1, dmg), dmg - ENEMY_STATS[e.kind].armour - ENEMY_STATS[e.kind].plating);
    }
  }
  if (dmg <= 0) return;
  e.hp -= dmg;
  s.economy.damage[source] += dmg;
  if (source === 'pointer' && crit) s.critHits++;
  if (source === 'tower' && tower) tower.damageDealt += dmg;
  // The view nudges the hit enemy along the shot direction for a cosmetic knockback. Carrying the
  // unit direction here (rather than re-deriving it from a matching shot) keeps splash/beam/chain
  // hits correct, and it is view data only — the simulation's position, pathing and targeting are
  // untouched by it.
  let dirX: number | undefined;
  let dirY: number | undefined;
  if (tower) {
    const dx = e.x - (tower.col + 0.5);
    const dy = e.y - (tower.row + 0.5);
    const d = Math.hypot(dx, dy);
    if (d > 0) {
      dirX = dx / d;
      dirY = dy / d;
    }
  }
  s.events.push({ type: 'damage', x: e.x, y: e.y, amount: dmg, weak: source === 'pointer' && weak, crit: crit && source === 'pointer', marked: marked && source === 'pointer', id: e.id, dirX, dirY });
  if (e.hp <= 1e-9) {
    e.hp = 0;
    e.dead = true;
    if (source === 'pointer' && weak) s.weakPointKills++;
    if (e.isBoss && source === 'pointer' && !e.towerDamaged) s.bossKilledByPointer = true;
    if (e.isBoss && source === 'pointer' && milestoneBossKind(e.wave) === e.kind) s.milestoneBossByPointer = true;
    if (e.isBoss) {
      s.bossesKilled++;
      s.killedBossKinds.add(e.kind);
      if (source === 'pointer') {
        s.bossKillsByPointer++;
        s.profile.lifetimeBossKillsByPointer++;
        s.profileDirty = true;
      }
      if (s.pointer.manualOverride) s.bossKilledByOverride = true;
      if (s.integrity === 1) s.bossKilledAtOneIntegrity = true;
    }
    if (source === 'tower' && tower && beaconsBuffing(s, tower) >= 3) s.beaconBuffKill = true;
    if (source === 'tower' && s.pointerIdleTicks > 0) s.idleTowerKilled = true;
    if (source === 'pointer') {
      s.pointerKillTicks.push(s.tick);
      s.pointerKillTicks = s.pointerKillTicks.filter((t) => s.tick - t <= secondsToTicks(10));
    }
    if (isFlyerKind(e.kind)) s.flyersKilled++;
    if (tower && tower.kind === 'aa') s.aaKills++;
    // A Carrier releases twice its brood on death, the one boss that fights on after it falls.
    if (e.kind === 'flyer-boss') releaseBrood(s, e, CARRIER_DEATH_BROOD_COUNT);
    const bounty = e.isBoss && hasUpgrade(s, 'bounty-board') ? BOUNTY_VALUE_MULT : 1;
    const value = e.value * bounty * (s.modifiers.includes('rush') ? 1.1 : 1) * buffKillMult(s);
    const reward =
      source === 'pointer' && weak
        ? recordKillAt(s.economy, value, source, WEAK_POINT_KILL_BONUS)
        : source === 'tower' && hasUpgrade(s, 'salvage-contract')
          ? recordKillAt(s.economy, Math.floor(Math.round(value) * SALVAGE_CONTRACT_MULT), source, 1)
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
    if (hasUpgrade(s, 'compound-interest')) earn(s.economy, Math.floor(s.economy.salvage * COMPOUND_INTEREST_RATE));
    s.events.push({ type: 'waveCleared', wave: run.wave, bonus });
    const waveLeaks = s.leaksByWave.get(run.wave) ?? 0;
    if (waveLeaks === 0) {
      s.clearedFlawlessWave = true;
      s.perfectWaves++;
      s.perfectWaveStreak++;
      if (run.wave === 1) s.clearedWave1NoLeak = true;
      if (s.totalLeaks > 0) s.wavesClearedSinceLeak++;
    } else {
      s.perfectWaveStreak = 0;
      s.wavesClearedSinceLeak = 0;
    }
    if (run.wave >= 40 && waveLeaks === 0) s.clearedWaveNoLeaks = true;
    evaluateWaveAchievements(s, run.wave);
    cleared.add(run);
  }
  s.clearedWaves += cleared.size;
  if (cleared.size > 0) {
    s.runs = s.runs.filter((r) => !cleared.has(r));
    // A cleared wave marks the current map as cleared, for the every-map shadow.
    if (!s.profile.mapsCleared.includes(s.levelId)) {
      s.profile.mapsCleared.push(s.levelId);
      s.profileDirty = true;
    }
  }
}

/**
 * Read a wave's opening snapshot at clear time and set the one-shot per-wave flags the group-A
 * rules read (docs/ACHIEVEMENTS.md "Per-wave snapshots"). The flags latch, so an achievement fires
 * once no matter how many qualifying waves clear afterwards.
 */
function evaluateWaveAchievements(s: RunState, wave: number): void {
  const snap = s.waveSnapshots.get(wave);
  if (!snap) return;

  const builtThisWave = s.towersBuilt - snap.towersBuilt;
  const wallsThisWave = s.wallsBuilt - snap.wallsBuilt;
  if (builtThisWave === 0) s.clearedNoTowerWave = true;
  if (builtThisWave >= 1 && builtThisWave === wallsThisWave && s.towers.length >= 1 && s.towers.every((t) => isWall(t))) {
    s.clearedWallOnlyWave = true;
  }
  if (wave >= 30 && s.towers.length >= 1 && s.towers.every((t) => t.tier === 1)) {
    s.clearedNoUpgradeWave = true;
  }
  if (wave >= 40 && distinctTowerKinds(s) === 2) {
    s.clearedTwoKinds = true;
  }
  if (s.salvageSpent === snap.salvageSpent) {
    s.clearedNoSpendWave = true;
  }
  if (milestoneBossKind(wave) !== null && s.bossesKilled > snap.bossesKilled && s.integrity === snap.integrity) {
    s.clearedBossNoLeak = true;
  }
  if (snap.towerCount >= 1 && s.towers.length === 0 && s.towersSold > snap.towersSold) {
    s.clearedSellAllWave = true;
  }
}

/** The number of distinct tower kinds currently standing. */
function distinctTowerKinds(s: RunState): number {
  const kinds = new Set<string>();
  for (const t of s.towers) kinds.add(t.kind);
  return kinds.size;
}

/** With every wave cleared and no enemies left, the run returns to build (or wins at wave 100). */
function finishWavePhase(s: RunState): void {
  if (s.runs.length !== 0 || s.enemies.length !== 0) return;
  s.pointer.held = false;
  s.pointer.targetId = null;
  s.modifiers = [];
  s.phase = s.wave >= s.waveLimit && !s.endless ? 'victory' : 'build';
}
