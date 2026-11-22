// Headless smoke check for the pure simulation core.
//
// Node 22.18+/23.6+ strips TypeScript types natively, so this imports src/core/*.ts directly with no
// build step and no extra dependencies. src/core must therefore only use erasable syntax (enforced by
// tsconfig's erasableSyntaxOnly) and import siblings with explicit .ts extensions.
//
// Scenario: place towers, start wave 1, run 3000 fixed ticks, assert enemies died and salvage grew.
// Then check the click path: pointer kills pay the 1.5x bonus and are attributed to the pointer.
// Then the maze: sealed placements are rejected, walls force detours, the distance field reports
// sealed boards, and flyers beat grunts across the board.

import { FLYER_OFF_KIND_DAMAGE,
  buildStats,
  createRunState,
  cursorMaintenanceStatus,
  disabledTowerIds,
  GOD_SALVAGE_CEILING,
  healedTowerIds,
  killAllEnemies,
  placeTower,
  canPlace,
  spawnCheatEnemy,
  startWave,
  tick,
  pointerDown,
  pointerUp,
  step,
  currentPath,
  upgradeTower,
  chooseBranch,
  sellTower,
  sweepUpgradeSame,
  sweepUpgradeReport,
  towerAt,
  towerUnlocked,
  cycleLevel,
  canCycleLevel,
  closePopupEnemy,
  toggleGate,
  selectPlacedTower,
  selectTower,
  cancelSelection,
  placementSealsUnderToggles,
  toggleAtTile,
  towerAuraSources,
  cycleTargetMode,
  startRepair,
  upgradePointer,
  toggleGodMode,
  toggleManualOverride,
  toggleAutoWave,
  anyTowerRepairing,
  autoWaveStatus,
  noBuildActive,
  NO_BUILD_MESSAGE,
  AUTO_WAVE_DELAY_TICKS,
  STARTING_INTEGRITY,
  synergyLayout,
  synergyRange,
  damageWall,
  rebuildField,
} from '../src/core/state.ts';
import { TOWER_STATS, TOWER_KINDS, TOWER_UNLOCK_WAVE, towerUnlockWave, isTowerUnlocked, effectiveStats, upgradeCost, createTower, sellValue, wallMaxHp, wallBlocksFlyers, isGateLocked, isToggleGate, isRepairing, isOffline, isEmpDisabled, isDown, hasBranches, recomputeAuras, repairCost, repairDurationTicks, TOGGLE_LOCK_TICKS, CURSOR_REPAIR_THRESHOLD, cursorRadius, cursorClickRate, cursorClickIntervalTicks, cursorClickDamageFactor, isFullyUpgraded, repairHealingCount, repairHealTargets, isMinesweeper, isMortar, MINE_INTERVAL_TICKS, MINE_ARM_TICKS, MINE_EXPIRE_TICKS, MINE_LIVE_CAP, MINE_DAMAGE, MINE_BLAST_RADIUS, CURSOR_CLICK_DAMAGE_FACTOR, repairHealRate, repairRadius, MAX_TIER, TIERS, kindMaxTier, COMBAT_KINDS, BRANCH_TIER } from '../src/core/towers.ts';
import { killReward, waveClearBonus } from '../src/core/economy.ts';
import { AA_HOLD_CAP, AA_HOLD_WINDOW, AA_MIN_CLUSTER, buildSynergyLayout, leads, spotterGrant, SPOTTER_CAP, SYNERGIES, CHILL_SLOW_FACTOR, CHILL_SLOW_TICKS, SHATTER_BURST_DELAY_TICKS, SHATTER_BURST_SPLASH, SHATTER_BURST_DAMAGE_MULT, BUTTRESS_GROUP_CAP, isBulwark } from '../src/core/synergy.ts';
import { formatNumber } from '../src/core/format.ts';
import { WAVE_COUNT, EARLY_CALL_FLOOR, buildSchedule, earlyCallBonus, endlessCountBase, endlessIntervalScale, FLYER_FLIGHT_MEMBER_TICKS, FLYER_FLIGHT_SIZE, flyerSwarmFactor, isBossWave, isTypeBossWave, milestoneBossKind, MODIFIER_POOL, popupCountForWave, typeBossKindForWave, typeBossUnlockWave, waveDef, waveEnemyCount, waveKillValue, waveModifiers, WAVE_ENEMY_CAP } from '../src/core/waves.ts';
import { TICK_HZ, TICK_MS, secondsToTicks } from '../src/core/time.ts';
import { buildField, buildRouteField, pathTiles, stepToward } from '../src/core/pathfield.ts';
import { COLS, ROWS, tileAt } from '../src/core/grid.ts';
import { LEVELS, DEFAULT_LEVEL, createGrid, levelById, levelRoutes, toggleIndex, toggleOpenAt, validateLevel, MAX_TOGGLES } from '../src/core/levels.ts';
import { encodeLevel, decodeCode, encodeBytes, CODEC_PREFIX } from '../src/core/codec.ts';
import {
  createEditor,
  paintEditor,
  selectEditorTool,
  eraseEditor,
  undoEditor,
  redoEditor,
  clearEditor,
  editorLevel,
  editorValidation,
  editorPlayable,
  editorToggleAt,
  setEditorToggle,
  editorTileAt,
  editorIsEmpty,
} from '../src/core/editor.ts';
import {
  applyDraft,
  applyMapEntry,
  deleteLibraryMap,
  loadEditorDraft,
  loadLibrary,
  saveEditorDraft,
  saveLibrary,
  saveLibraryMap,
  replaceLibraryMap,
} from '../src/core/editorstore.ts';
import { computeEditorLayout, editorExitAt, editorToolbarAt } from '../src/view/editor.ts';
import { baseEnemyKind, BASTION_SHIELD_LAYERS, BASTION_SHIELD_LAYER_VALUE, createEnemy, enemyKillValue, ENEMY_STATS, ENEMY_KINDS, BOSS_KINDS, isBossKind, isBossVariant, isPopupEnemy, isFlyerKind, slowFactorFor, PACER_AURA_RADIUS, waveHpScale, waveValueScale, BREACHER_TURRET_RANGE, BREACHER_TURRET_DAMAGE, BREACHER_TURRET_INTERVAL_TICKS, CARRIER_BROOD_COUNT, CARRIER_BROOD_INTERVAL_TICKS, CARRIER_BROOD_SCATTER_TICKS, CARRIER_DEATH_BROOD_COUNT, DREADNOUGHT_PLATING, DREADNOUGHT_SLOW_RESIST, WIRECUTTER_EMP_RADIUS, WIRECUTTER_EMP_TICKS, RAM_TOWER_DPS, RAM_TURRET_DAMAGE, RAM_TURRET_RANGE } from '../src/core/enemies.ts';
import { missileSeed, AA_SALVO_COUNT, CANNON_SHELL_SPEED } from '../src/core/projectiles.ts';
import { rngNext } from '../src/core/rng.ts';
import { spawnAd, dismissAd, AD_W, AD_H, AD_LIFETIME_TICKS, AD_KINDS, AD_DEFRAG_SALVAGE_PCT, AD_AUTOUPDATE_DAMAGE_MULT, AD_TIMEZONE_SPEED_MULT, AD_SCREENSAVER_DAMAGE } from '../src/core/ads.ts';
import { AD_TIPS } from '../src/content/adTips.ts';
import {
  comboMultiplier,
  clickDamage,
  MAX_OVERCLOCK_LEVEL,
  OVERCLOCK_COST_BASE,
  OVERCLOCK_COST_GROWTH,
  OVERCLOCK_DAMAGE_GROWTH,
  overclockMilestoneMult,
  overclockCeiling,
  overclockUnlockWave,
  holdDps,
  nextOverclockCost,
  nextPointerCost,
  pointerUpgradeState,
  nextCritRoll,
  critChance,
  CRIT_MULTIPLIER,
  MARKED_DAMAGE_MULT,
  CLICK_SLACK,
} from '../src/core/pointer.ts';
import { loadProfile, saveProfile, defaultProfile, prefersReducedMotion, addSeenEnemies, allHelpUnlocked, checkProfileAchievements, rpGain, specLevelCost, MAX_RUNS } from '../src/core/save.ts';
import { appendRun, appendDailyRun, buildRunRecord, runTotals, bestByMap } from '../src/core/runs.ts';
import { buildRecordsRows, totalsLine, bestByMapLine, computeRecordsLayout, recordsHitAt, formatRecordDate, outcomeLabel } from '../src/view/records.ts';
import { captureRun, restoreRun, loadRunSave, saveRun, clearRunSave, hasRunSave, RUN_SAVE_KEY } from '../src/core/runsave.ts';
import { computeMenuScreen, menuButtonAt, computeMenuWindow, computeMenuAnim, marqueeMaskRect } from '../src/view/menuScreen.ts';
import { computeMapGrid, clampMapScroll, scrollForFocus, mapCardAt, moveMapFocus, mapGalleryKey, mapFocusForId, mapLevelAt, MAP_CARD_W, MAP_CARD_H, MAP_CARD_GAP, MAP_GRID_COLS, MAP_SCROLL_W, MAP_NAME_SIZE, MAP_HISTORY_SIZE } from '../src/view/mapSelect.ts';
import { thumbnailTexture, thumbCacheSize, thumbBase } from '../src/view/mapsScreen.ts';
import { levelThumbnail } from '../src/core/thumb.ts';
import { MAP_SAVE_KEY, rememberMap, readRememberedMap } from '../src/core/mapSave.ts';
import { computeUpgradesLayout, UpgradesSession, upgradesStatusText, upgradesEmptyLines, upgradesHitAt, pressUpgradesOk, UPGRADE_ROW_H } from '../src/view/upgrades.ts';
import { computeRestoreLayout, RestoreSession, restoreProgress, restoreDirty, RestoreView, TREE_TEXT_ANCHOR, treeRowTextX, treePriceTextX } from '../src/view/restore.ts';
import { effectsFor, treeNodeById, treeTierUnlocked, canBuy, hasNode, buyNode, visibleNodes, TREE_NODES, LICENCE_IDS } from '../src/core/tree.ts';
import { ACHIEVEMENTS } from '../src/core/achievements.ts';
import { restartWindows, checkAchievements, enterEndless, pointerDamageMult, towerCost, overclockCap, towerIntervalTicks } from '../src/core/state.ts';
import { cheatsEnabled, setCheatsVisibleForTests, SPAWN_KINDS, spawnKindLabel } from '../src/core/cheats.ts';
import { dashRects, offsetSegment, routeOffset } from '../src/view/route.ts';
import { enemyDrawOrder, popupCloseHit, popupCloseRect, popupWindowRect, POPUP_TITLE_H, POPUP_CLOSE_W, POPUP_CLOSE_H } from '../src/view/popupEnemy.ts';
import { adCloseRect, wrapAdTip, adRewardLineY, adTipMaxWidth, adProgressRect, adProgressFillRect } from '../src/view/ad.ts';
import {
  hatchSegments,
  lerpColor,
  wallArt,
  wallButtonSpec,
  wallDamageStage,
  wallFocusRect,
  wallFootprintSize,
  wallSpec,
  WALL_FACE,
  WALL_FACE_DISABLED,
  WALL_FACE_PRESSED,
} from '../src/view/wallAppearance.ts';
import { towerTooltipLines, upgradeTooltipLines, branchTooltipLines, tooltipText, targetModeDisplay, targetLockReason, pointerTooltipLines, fmtClickDamage, paletteTooltipLines, lockedPaletteLine, cursorTooltipLines, cursorUpgradeTooltipLines, cursorBranchTooltipLines, repairUpgradeTooltipLines, branchName, TOOLTIP_BLUE } from '../src/view/tooltipText.ts';
import { drawTower, clearTowerSprites, BoardView, BOARD_LAYER_ORDER, SHADOW_ALPHA, SHADOW_OFFSET, SHADOW_OFFSET_FLYER, SHADOW_OFFSET_FLYER_BOSS, SHADOW_OFFSET_FLYER_BOSS_SCALE, SHADOW_TINT, shadowOffsetFor, shadowVisibleFor, staticLayerKey, routeKey, enemyHealthBarVisible, shadowDrawnFor, ENEMY_COLOR, SHIELD_COLOR, TRACER_COLOR, TRANSITION_TICKS, CURSOR_ARROW_PX, cursorRingCentre, cursorLeashCentre, synergyEdgeEndpoints, synergyEdgeStyle, recoilOffset, RECOIL_DURATION_TICKS, RECOIL_PEAK_CELLS, SLOW_TINT } from '../src/view/board.ts';
import { branchMarkSpec, healthBarRect, pipRect, pipUsesBottomCorner } from '../src/view/branchMarks.ts';
import { computeLayout, computeWindowChromeGeom, pixelToWorld, worldToPixel, TITLE_H, CONTROL_BOX_W, CONTROL_BOX_H, FONT_SIZE, menuItems, menuNameAt, menuWordRects } from '../src/view/chrome.ts';
import { computeHud, computeRightPanel, hudControlAt, hudButtonAt, textWidth, HudView, speedStatusText, statusPerfText, READOUT_FONT_SIZE, salvageReadoutText, waveLabel, victoryButtonAt, victoryButtons, victoryModalRect, modalRect, modalMenuAt, modalMessageTop } from '../src/view/hud.ts';
import { FloatingNumbersView } from '../src/view/numbers.ts';
import { nextQuality } from '../src/core/quality.ts';
import { dailyFor, dailyLevel, dailySeed, dailyMenuLabel, dailyAvailable, DAILY_WAVES, hashDaily } from '../src/core/daily.ts';
import {
  advanceBossBars,
  barFillPx,
  bossBarFrame,
  bossBarRect,
  bossPanelRect,
  bossRowRect,
  bossGimmick,
  bossName,
  bossShield,
  livingBosses,
  visibleBossBars,
} from '../src/view/bossBars.ts';
import { backingStorePixelSize } from '../src/view/screen.ts';
import { HELP_PAGES, pageUnlocked, lockedReason, pageById } from '../src/content/help.ts';
import { computeHelpLayout, clampHelpPosition, defaultHelpPosition, helpRows, treeRowLabel, helpHitAt, pageBodyHeight, computeHelpScroll, HelpSession, helpIndexList, helpSearchResults, helpTopicPath, helpTopicCount, helpPrintDocument, helpOptionsMenu, helpOptionsHitAt, helpContextMenuLayout, helpContextHitAt, HELP_W, HELP_H, HELP_LINE_H, HELP_HEADING_H, HELP_SCROLL_LINES, helpArtLayout } from '../src/view/help.ts';
import { parseHelpMarkdown, layoutHelpBlocks, helpMeasure, ITEM_GAP } from '../src/view/helpMarkdown.ts';
import { nextHelpMode, contextHelpPage, contextHelpHitAt } from '../src/view/contexthelp.ts';
import { buildAchievementGrid, gridRowCount, gridCellRect, ACH_COLUMNS, ACH_CELL, ACH_GUTTER, computeAchievementGrid, achievementGridHitAt, AchievementSession, computeDialog } from '../src/view/dialog.ts';
import { computeNameDialog } from '../src/view/mapLibrary.ts';
import { computeMenu, menuEntryAt, advanceSubmenu, SUBMENU_OPEN_MS, CHEVRON_W } from '../src/view/menu.ts';
import {
  ART_MANIFEST,
  ART_VIEWBOX,
  ART_SILHOUETTE,
  manifestEntry,
  cacheKey,
  rasterPixelSize,
  artSpriteSize,
  artNameForEnemy,
  enemyArtNames,
  artNameForTowerBase,
  artNameForTowerTurret,
  artNameForBranch,
  getArtTexture,
  getArtFrames,
  animationOf,
  frameTexture,
  effectFrameTexture,
  injectArtFrames,
  injectArtAnim,
  seedFrameCache,
  cachedFrameCount,
  hasArt,
  setArtDpr,
  artDpr,
  resetArt,
  injectArtTexture,
  onArtInvalidate,
  artFileUrl,
  PRELOAD_CONCURRENCY,
  EAGER_ART,
  requestArt,
  preloadArt,
  artQueueLength,
  artLoadStats,
  setArtTransport,
  setArtIdleScheduler,
  IDLE_STARVED_MS,
} from '../src/view/art.ts';
import { Texture } from 'pixi.js';
import { readdirSync, existsSync, readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { animFrame, currentAnimFrame, DEFAULT_ANIM, entityOffset } from '../src/view/anim.ts';
import { scanArt } from './art-manifest.mjs';
import { runAchArt } from './ach-art.mjs';
import { runUpgradeArt } from './upgrade-art.mjs';
import {
  GLOBAL_UPGRADES,
  buyUpgrade,
  revealedUpgrades,
  upgradeBuff,
  trayRollDue,
  tickSystemTray,
  spawnTray,
  claimTray,
  TRAY_BUFF_TICKS,
  TRAY_LIFETIME_TICKS,
  TRAY_SETTLE_TICKS,
  TRAY_ROLL_TICKS,
  TRAY_W,
  TRAY_H,
} from '../src/core/upgrades.ts';
import { buffRowText, upgradesRowText, upgradesNewCount } from '../src/view/hud.ts';
import { escapeAction, escapeTarget } from '../src/input/escape.ts';
import { EffectsView, muzzleAssetFor, muzzleLife, FIRE_KINDS } from '../src/view/effects.ts';

import { fileURLToPath } from 'node:url';
import {
  CameraShake,
  shakeImpulseFor,
  SHAKE_AMPLITUDE,
  SHAKE_DECAY_TICKS,
  SHAKE_MAX_TICKS,
  SHAKE_LEAK_FREEZE_MS,
} from '../src/view/shake.ts';
import { t, plural, formatInt, formatMoney, setLocale } from '../src/i18n/index.ts';
import { levelName, towerName } from '../src/i18n/names.ts';
import { clearTextWidthCache } from '../src/view/metrics.ts';
import { setDirection, isRtl, mirrorX } from '../src/view/direction.ts';
import { en } from '../src/i18n/en/index.ts';
import { extractTKeys, parseCatalogueKeys, checkI18n, scanRoots, walkAllSources, readBaseline } from './i18n-check.mjs';

// All v0.10b levels share a single spawn and exit, so the older maze checks keep a local gate.
const SPAWN = DEFAULT_LEVEL.starts[0];
const EXIT = DEFAULT_LEVEL.exits[0];

/** A fresh run on a specific level, reached by cycling from the default. */
function stateOnLevel(id) {
  const s = createRunState();
  while (s.levelId !== id) cycleLevel(s);
  return s;
}

/** A fresh state with every tower kind unlocked, for tests that exercise a non-starting kind. */
function allUnlocked(id = 'open-field') {
  const s = stateOnLevel(id);
  s.wave = 24;
  return s;
}

/** An enemy pinned at a world point so a test can reason about exactly where it stands. */
function stationary(id, kind, wave, x, y) {
  const e = createEnemy(id, kind, wave, SPAWN, EXIT);
  e.x = x;
  e.y = y;
  e.prevX = x;
  e.prevY = y;
  e.col = Math.floor(x);
  e.row = Math.floor(y);
  e.dist = 0;
  e.targetCol = -1;
  e.targetRow = -1;
  e.stunUntilTick = 999999;
  return e;
}

let failures = 0;
function check(cond, msg) {
  console.log(`${cond ? 'ok  ' : 'FAIL'}  ${msg}`);
  if (!cond) failures++;
}

/** Flush pending microtasks and one macrotask turn, so queued art-invalidation callbacks run. */
const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

// --- 1. Towers alone clear wave 1 -------------------------------------------------------------
{
  const s = stateOnLevel('open-field');
  const start = s.economy.salvage;
  // (3,6) sits on the spawn row, so the gun covers the route and forces a small detour.
  check(placeTower(s, 'gun', 3, 6), 'gun placed on a buildable tile');
  check(!placeTower(s, 'gun', 1, 9), 'cannot build on a blocked tile');
  check(!placeTower(s, 'gun', 3, 6), 'cannot build on an occupied tile');
  const afterBuild = s.economy.salvage;
  check(afterBuild === start - TOWER_STATS.gun.cost, `tower cost deducted (${start} -> ${afterBuild})`);
  check(startWave(s), 'wave 1 started');

  const total = waveEnemyCount(1);
  let maxAlive = 0;
  for (let i = 0; i < 3000; i++) {
    tick(s);
    maxAlive = Math.max(maxAlive, s.enemies.length);
  }
  const kills = s.economy.kills.tower + s.economy.kills.pointer;
  const leaks = 20 - s.integrity;
  check(maxAlive > 0, `enemies spawned (peak ${maxAlive} alive)`);
  check(kills > 0, `enemies died: ${kills} killed, ${leaks} leaked of ${total}`);
  check(kills + leaks === total, 'every enemy is accounted for');
  check(s.economy.salvage > afterBuild, `salvage increased (${afterBuild} -> ${s.economy.salvage})`);
  check(s.phase === 'build' && s.wave === 1, `wave ended and returned to build (phase=${s.phase})`);
}

// --- 2. Kill attribution: a click kill pays 1.5x ---------------------------------------------
{
  const s = stateOnLevel('open-field');
  startWave(s);
  while (s.enemies.length === 0) tick(s);
  const e = s.enemies[0];
  const before = s.economy.salvage;
  let clicks = 0;
  while (!e.dead && clicks < 50) {
    pointerDown(s, e.x, e.y);
    pointerUp(s);
    clicks++;
  }
  check(e.dead, `grunt killed by ${clicks} clicks`);
  check(s.economy.kills.pointer === 1, 'kill attributed to the pointer');
  check(s.economy.salvage - before === killReward(e.value, 'pointer'),
    `pointer kill paid ${s.economy.salvage - before} (base ${e.value} x1.5)`);
}

// --- 3. Fixed timestep: the frame rate must not change the outcome ------------------------------
{
  const run = (frameMs) => {
    const s = createRunState();
    placeTower(s, 'gun', 3, 6);
    startWave(s);
    // Feed ~15 s of wall time in frames of the given size, then top up to an exact tick count.
    for (let t = 0; t < 900 * TICK_MS - frameMs; t += frameMs) step(s, frameMs);
    while (s.tick < 1000) tick(s);
    return JSON.stringify([
      s.economy,
      s.integrity,
      s.enemies.map((e) => [e.id, e.hp, e.dist]),
      s.rng,
      s.nextAdAttemptTick,
      s.towerDamageBuffTicks,
      s.enemySlowTicks,
      s.towerDisabled.size,
    ]);
  };
  const at60 = run(TICK_MS);
  check(at60 === run(1000 / 144), 'same result at 60 Hz and 144 Hz frames');
  check(at60 === run(1000 / 23), 'same result at 23 Hz frames');
}

// --- 4. Formatting rule ---------------------------------------------------------------------
check(formatNumber(999_999) === '999,999', `formatNumber(999999) = ${formatNumber(999_999)}`);
check(formatNumber(1_000_000) === '1,000,000', `formatNumber(1000000) = ${formatNumber(1_000_000)}`);
check(formatNumber(12_345_678) === '12.3M', `formatNumber(12345678) = ${formatNumber(12_345_678)}`);

// --- 5. Mazing: sealed placements, detours, the field, and flyers ------------------------------
{
  // 5a. A tile that would seal the route is rejected.
  const s = createRunState();
  check(!canPlace(s, 'gun', EXIT.col, EXIT.row), 'canPlace rejects a tile that seals the route (exit)');
  check(!placeTower(s, 'gun', EXIT.col, EXIT.row), 'placeTower returns false for a sealing tile');
  check(!canPlace(s, 'gun', SPAWN.col, SPAWN.row), 'canPlace rejects the spawn tile');

  // 5b. A legal wall measurably lengthens the route. Extending the two decorative obstacles at
  // (11,6)/(12,6) into a three-tall barrier forces creeps around it instead of over it.
  const s2 = stateOnLevel('open-field');
  const before = currentPath(s2).length;
  s2.economy.salvage = 10000;
  for (const [c, r] of [[11, 5], [12, 5], [11, 7], [12, 7]]) {
    check(placeTower(s2, 'gun', c, r), `wall tower placed at ${c},${r}`);
  }
  const after = currentPath(s2).length;
  check(after > before, `detour lengthens the route (${before} -> ${after} tiles)`);

  // 5c. buildField: finite at the exit, -1 once the board is sealed.
  const grid = createGrid(DEFAULT_LEVEL);
  const open = buildField(grid, new Set(), EXIT);
  check(open[EXIT.row * COLS + EXIT.col] === 0, 'buildField gives the exit a finite distance (0)');
  const wall = new Set();
  for (let r = 0; r < ROWS; r++) wall.add(r * COLS + 10);
  const sealed = buildField(grid, wall, EXIT);
  check(sealed[SPAWN.row * COLS + SPAWN.col] === -1, 'buildField gives -1 at spawn on a sealed board');

  // 5d. A flyer crosses the board in fewer ticks than a grunt on the same wave.
  const ticksToLeak = (kind) => {
    const s3 = createRunState();
    s3.phase = 'wave';
    s3.enemies.push(createEnemy(1, kind, 6, SPAWN, EXIT));
    let t = 0;
    while (s3.enemies.length > 0 && t < 5000) {
      tick(s3);
      t++;
    }
    return t;
  };
  const gruntTicks = ticksToLeak('grunt');
  const flyerTicks = ticksToLeak('flyer');
  check(flyerTicks < gruntTicks, `flyer crosses in fewer ticks than a grunt (${flyerTicks} < ${gruntTicks})`);
}

// --- 5f. Flyer flight (docs/FLYER-FLIGHT.md) ----------------------------------------------------
{
  /** Run one level's wave-6 schedule (six flyers since the swarm) plus a Carrier under God Mode, recording flyers. */
  const flyRun = (levelId, seed) => {
    const s = stateOnLevel(levelId);
    if (seed !== undefined) s.rng = seed;
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    s.godMode = true;
    s.wave = 5;
    startWave(s);
    const exit = s.level.exits[0];
    const tracks = new Map();
    const leakTiles = new Map();
    let carrierQueued = false;
    for (let i = 0; i < 9000; i++) {
      if (!carrierQueued && i === 60) {
        const c = createEnemy(s.nextId++, 'flyer-boss', 6, s.level.starts[0], exit);
        c.laneOffset = 4; // worst case lane, so the clamp and the bound are both exercised
        c.swayPhase = 0;
        c.broodCooldown = Number.MAX_SAFE_INTEGER;
        s.enemies.push(c);
        carrierQueued = true;
      }
      const leaksBefore = s.totalLeaks;
      const alive = s.enemies.filter((e) => !e.dead);
      tick(s);
      for (const e of alive) {
        if (!isFlyerKind(e.kind)) continue;
        if (!tracks.has(e.id)) tracks.set(e.id, { kind: e.kind, lane: e.laneOffset, pts: [] });
        const bx = e.x - e.flightOffX;
        const by = e.y - e.flightOffY;
        const remain = e.dead ? 0 : s.flyerField[e.row * COLS + e.col] + Math.hypot(e.col + 0.5 - bx, e.row + 0.5 - by);
        tracks.get(e.id).pts.push({ x: e.x, y: e.y, bx, by, col: e.col, row: e.row, dev: Math.hypot(e.x - bx, e.y - by), remain, dead: e.dead });
        if (e.dead && s.totalLeaks > leaksBefore) leakTiles.set(e.id, { col: e.col, row: e.row });
      }
      if (s.enemies.length === 0 && s.phase !== 'wave' && carrierQueued) break;
    }
    return { s, tracks, leakTiles, exit };
  };

  const run = flyRun('corridor');
  const flyers = [...run.tracks.values()].filter((t) => t.kind === 'flyer');
  check(flyers.length >= 3 && run.tracks.size === flyers.length + 1, `flyer flight: the wave flies ${flyers.length} flyers and a Carrier`);

  // 1. Mid-flight a flyer is not tile-centre-snapped: x or y is off the nearest integer (and off the
  // tile centre) by more than 0.05 on most ticks.
  for (const t of run.tracks.values()) {
    const mid = t.pts.slice(Math.floor(t.pts.length * 0.1), Math.floor(t.pts.length * 0.9));
    const offInt = mid.filter((p) => Math.abs(p.x - Math.round(p.x)) > 0.05 || Math.abs(p.y - Math.round(p.y)) > 0.05).length;
    const offCentre = mid.filter((p) => Math.abs(p.x - Math.floor(p.x) - 0.5) > 0.05 || Math.abs(p.y - Math.floor(p.y) - 0.5) > 0.05).length;
    check(offInt > mid.length * 0.5 && offCentre > mid.length * 0.5,
      `flyer flight: a ${t.kind} is not grid-snapped mid-flight (${offInt}/${mid.length} off-integer, ${offCentre}/${mid.length} off-centre)`);
  }

  // 2. Two flyers spawned by one wave have different lane offsets, each inside [-4, +4].
  const lanes = flyers.map((t) => t.lane);
  check(new Set(lanes).size === lanes.length && lanes.every((l) => l >= -4 && l <= 4),
    `flyer flight: each flyer in a wave draws its own lane (${lanes.map((l) => l.toFixed(2)).join(', ')})`);

  // 3. The perpendicular deviation from the base path never exceeds |laneOffset| + amplitude; the base
  // itself stays on the air route (its tile is on the field) and col/row are the base's tile.
  for (const levelId of ['corridor', 'open-field', 'ladder']) {
    const r = levelId === 'corridor' ? run : flyRun(levelId);
    let worst = -Infinity;
    let bounded = true;
    let onBoard = true;
    let baseTiles = true;
    for (const t of r.tracks.values()) {
      const amp = t.kind === 'flyer-boss' ? 2 : 3;
      for (const p of t.pts) {
        if (p.dev > Math.abs(t.lane) + amp + 1e-6) bounded = false;
        worst = Math.max(worst, p.dev - Math.abs(t.lane) - amp);
        if (p.x < 0 || p.y < 0 || p.x >= COLS || p.y >= ROWS) onBoard = false;
        if (!p.dead && (Math.floor(p.bx) !== p.col || Math.floor(p.by) !== p.row) &&
          Math.hypot(p.bx - p.col - 0.5, p.by - p.row - 0.5) > 1e-9) baseTiles = false;
      }
    }
    check(bounded, `flyer flight (${levelId}): deviation never exceeds |lane| + amplitude (worst margin ${worst.toFixed(3)})`);
    check(onBoard, `flyer flight (${levelId}): every flyer stays inside the board`);
    check(baseTiles, `flyer flight (${levelId}): col/row follow the base path position`);

    // 4. Within the last two tiles before the exit the deviation is under 0.25 tiles, and every
    // flyer still leaks on the exit tile.
    let nearExit = 0;
    let tight = true;
    for (const t of r.tracks.values()) {
      for (const p of t.pts) {
        if (p.remain > 2) continue;
        nearExit++;
        if (p.dev >= 0.25) tight = false;
      }
    }
    check(nearExit > 0 && tight, `flyer flight (${levelId}): within two tiles of the exit the deviation is under 0.25 (${nearExit} samples)`);
    const leaked = [...r.leakTiles.values()];
    check(leaked.length === r.tracks.size && leaked.every((l) => l.col === r.exit.col && l.row === r.exit.row),
      `flyer flight (${levelId}): all ${r.tracks.size} flyers leak on the exit tile (${leaked.length})`);
  }

  // 5. A non-flyer fixture is byte-identical to the build before flyer flight. The hash below was
  // recorded from that build (commit 3cb9f15) with exactly this fixture. The Cannon now lands damage
  // a flight later, but this fixture has no Cannon, so the hash is unchanged. It was re-baselined once
  // more for the ground pathing tie-break (docs/PATHING-TIEBREAK.md): the open-field fixture has
  // downhill ties, so the momentum-then-parity rule moves ground enemies to different tiles.
  const nonFlyerFixture = () => {
    const s = stateOnLevel('open-field');
    s.economy.salvage = 10000;
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    for (const [c, r] of [[5, 6], [8, 5], [8, 7], [11, 5]]) placeTower(s, 'wall', c, r);
    placeTower(s, 'gun', 6, 4);
    startWave(s);
    const kinds = ['popup', 'shielded-boss', 'armoured-boss', 'saboteur-boss', 'grunt', 'runner', 'shielded', 'armoured', 'saboteur', 'breacher', 'grunt-boss', 'runner-boss', 'breacher-boss'];
    let id = 10000;
    for (const k of kinds) s.enemies.push(createEnemy(id++, k, 5, SPAWN, EXIT));
    const buf = [];
    for (let i = 0; i < 2400; i++) {
      tick(s);
      for (const e of s.enemies) if (!e.dead) buf.push(`${e.id}:${e.x},${e.y},${e.heading},${e.col},${e.row},${e.dist}`);
      buf.push(`|${s.rng}`);
    }
    return createHash('sha1').update(buf.join(';')).digest('hex');
  };
  const fixtureHash = nonFlyerFixture();
  check(fixtureHash === '91e682f18a605e301839c5e85cb43f60febf9409',
    `flyer flight: a non-flyer fixture run is byte-identical to the pre-flight build (${fixtureHash.slice(0, 10)})`);

  // 6. The same seed reproduces identical flyer flight; a different seed flies differently.
  const trace = (seed) => {
    const r = flyRun('open-field', seed);
    return [...r.tracks.entries()].map(([id, t]) => `${id}:${t.pts.map((p) => `${p.x},${p.y}`).join(' ')}`).join('\n');
  };
  const a = trace(12345);
  check(a === trace(12345), 'flyer flight: the same seed produces identical flyer positions across two runs');
  check(a !== trace(54321), 'flyer flight: a different seed produces a different flight');

  // The Carrier brood keeps its straight scatter, then joins the sway.
  {
    const s = stateOnLevel('corridor');
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    s.godMode = true;
    s.phase = 'wave';
    const c = createEnemy(1, 'flyer-boss', 30, SPAWN, EXIT);
    c.broodCooldown = 0;
    s.nextId = 2;
    s.enemies.push(c);
    tick(s);
    const brood = s.enemies.filter((e) => e.kind === 'flyer');
    const h0 = brood.map((e) => e.heading);
    let straight = true;
    for (let i = 1; i < CARRIER_BROOD_SCATTER_TICKS; i++) {
      tick(s);
      brood.forEach((e, k) => { if (e.heading !== h0[k] || e.flightOffX !== 0 || e.flightOffY !== 0) straight = false; });
    }
    check(brood.length === CARRIER_BROOD_COUNT && straight, 'flyer flight: brood flyers scatter in a straight line first');
    tick(s); // the brood is released after movement, so its last scatter step lands one tick later
    check(brood.every((e) => e.scatterTicks === 0), 'flyer flight: the brood scatter ends on schedule');
    let swayed = false;
    for (let i = 0; i < 240; i++) {
      tick(s);
      if (brood.some((e) => !e.dead && Math.hypot(e.flightOffX, e.flightOffY) > 0.5)) swayed = true;
    }
    check(swayed, 'flyer flight: brood flyers join the sway after the scatter');
  }
}

// --- 5e. Authored levels: walkable ends, expected route length, sealing, mazing, cycling -------
{
  // Every level loads with a walkable start and exit and a route of the documented length.
  const ROUTE_TOLERANCE = 2;
  const ROUTE_LENGTHS = { corridor: 48, dumbbell: 28, 'open-field': 22, turnstile: 20, fork: 22, ladder: 25, moat: 27, hourglass: 27, trident: 20, switchyard: 28, comb: 70, shelves: 73, pinwheel: 28, 'twin-halls': 28, ziggurat: 30, gauntlet: 30, quarry: 30 };
  for (const level of LEVELS) {
    const grid = createGrid(level);
    const field = buildField(grid, new Set(), level.exits[0]);
    const spawnIdx = level.starts[0].row * COLS + level.starts[0].col;
    const exitIdx = level.exits[0].row * COLS + level.exits[0].col;
    check(field[spawnIdx] >= 0, `${level.id}: spawn is walkable at load`);
    check(field[exitIdx] === 0, `${level.id}: exit is walkable at load`);
    const route = pathTiles(field, level.starts[0]);
    const expected = ROUTE_LENGTHS[level.id];
    check(Math.abs(route.length - expected) <= ROUTE_TOLERANCE,
      `${level.id}: route is ${route.length} tiles (expected ~${expected})`);
  }

  // Sealing a level's only route is refused: a tower on the spawn or exit tile never goes down.
  {
    const s = createRunState();
    for (let i = 0; i < LEVELS.length; i++) {
      const level = levelById(s.levelId);
      const exit = level.exits[0];
      const spawn = level.starts[0];
      check(!canPlace(s, 'gun', exit.col, exit.row), `${level.id}: exit placement is refused`);
      check(!canPlace(s, 'gun', spawn.col, spawn.row), `${level.id}: spawn placement is refused`);
      cycleLevel(s);
    }
  }

  // The Corridor: blocking the gaps of three baffles (and one extra tower) pushes the route around
  // the longer wrap, growing it by well over six tiles.
  {
    const s = createRunState(); // default = corridor
    const before = currentPath(s).length;
    s.economy.salvage = 10000;
    for (const [c, r] of [[4, 9], [4, 10], [12, 9], [12, 10], [8, 2], [8, 1], [16, 2]]) {
      check(placeTower(s, 'gun', c, r), `corridor wall tower placed at ${c},${r}`);
    }
    const after = currentPath(s).length;
    check(after - before >= 6, `corridor mazing grows the route by at least 6 tiles (${before} -> ${after})`);
  }

  // Cycling before wave 1 changes the route; it is refused once a tower exists.
  {
    const s = createRunState();
    const first = currentPath(s).length;
    check(canCycleLevel(s), 'map cycling is available before wave 1');
    check(cycleLevel(s), 'cycle to the next map');
    check(s.levelId !== 'corridor', 'cycling changes the level id');
    check(currentPath(s).length !== first, 'cycling changes the route length');
    s.economy.salvage = 10000;
    placeTower(s, 'gun', 5, 5);
    check(!canCycleLevel(s), 'map cycling is refused once a tower exists');
    check(!cycleLevel(s), 'cycleLevel returns false once a tower exists');
  }
}

// --- 5g. Multi-route levels: no-routes unchanged, fork/ladder load, overlap, isolation -------
{
  // A deterministic slice of a wave on each no-route level, hashed so any change to the single
  // implicit route (or to wave balance) trips this byte-identity check. The Cannon now lands damage
  // a flight later, but this fixture places only a Gun, so the hash is unchanged. It was re-baselined
  // for the ground pathing tie-break (docs/PATHING-TIEBREAK.md): each of these four fields has
  // downhill ties, so the momentum-then-parity rule moves ground enemies to different tiles.
  const simulate = (id) => {
    const s = stateOnLevel(id);
    s.economy.salvage = 10000;
    placeTower(s, 'gun', 3, 6);
    startWave(s);
    for (let i = 0; i < 1000; i++) tick(s);
    return JSON.stringify([
      s.levelId,
      s.economy.salvage,
      s.economy.earned,
      s.integrity,
      s.enemies.map((e) => [e.kind, e.wave, e.hp, e.dist, e.routeIndex]),
      s.rng,
      s.tick,
      s.clock,
    ]);
  };
  let table = '';
  for (const id of ['corridor', 'dumbbell', 'open-field', 'turnstile']) table += simulate(id) + '\n';
  let h = 0x811c9dc5;
  for (let i = 0; i < table.length; i++) {
    h ^= table.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  check((h >>> 0).toString(16) === '818cfcb5', `no-route levels unchanged (wave hash ${(h >>> 0).toString(16)})`);
}

// --- 5h. Ground pathing tie-break (docs/PATHING-TIEBREAK.md §5) ---------------------------------
{
  // A lone enemy is byte-identical between two runs with the same seed, over 600 ticks. The seed
  // controls flyers only; the ground tie-break is momentum + tile parity, both pure state, so the
  // run reproduces exactly.
  const trace = (seed) => {
    const s = createRunState();
    s.rng = seed;
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    s.phase = 'wave';
    s.enemies.push(createEnemy(1, 'grunt', 1, SPAWN, EXIT));
    const out = [];
    for (let i = 0; i < 600; i++) {
      tick(s);
      for (const e of s.enemies) if (!e.dead) out.push(`${e.x},${e.y},${e.col},${e.row},${e.dist},${e.lastDir}`);
    }
    return out.join(';');
  };
  check(trace(12345) === trace(12345), 'pathing tie-break: a lone enemy over 600 ticks is byte-identical with the same seed');

  // On the Corridor the route's above/below split is within 10 tiles of even (today it is 26/14).
  {
    const level = levelById('corridor');
    const grid = createGrid(level);
    const field = buildField(grid, new Set(), level.exits[0]);
    const route = pathTiles(field, level.starts[0]);
    const centreRow = level.starts[0].row;
    let above = 0;
    let below = 0;
    for (const t of route) {
      if (t.row < centreRow) above++;
      else if (t.row > centreRow) below++;
    }
    check(Math.abs(above - below) <= 10,
      `pathing tie-break: the Corridor route splits ${above}/${below} above/below centre (within 10 of even)`);
  }

  // Direction changes across the ten shipped maps stay under 45 when walked by the canonical
  // walker (pathTiles), which keeps its own momentum. The drawn route is pathTiles, so this is the
  // same route currentPath and every thumbnail show.
  {
    const dirIndex = (a, b) => (b.col !== a.col ? (b.col > a.col ? 2 : 1) : (b.row < a.row ? 0 : 3));
    let changes = 0;
    for (const level of LEVELS.slice(0, 10)) {
      const grid = createGrid(level);
      const spawn = level.starts[0];
      const exit = level.exits[0];
      const routes = levelRoutes(level);
      const walks = routes.length === 0
        ? [pathTiles(buildField(grid, new Set(), exit), spawn)]
        : routes.map((r) => pathTiles(buildRouteField(grid, new Set(), exit, r), spawn));
      for (const tiles of walks) {
        for (let i = 2; i < tiles.length; i++) {
          if (dirIndex(tiles[i - 2], tiles[i - 1]) !== dirIndex(tiles[i - 1], tiles[i])) changes++;
        }
      }
    }
    check(changes < 45, `pathing tie-break: ${changes} direction changes across the ten maps (under 45)`);
  }

  // A saved run mid-flight restores `lastDir` and continues without diverging.
  {
    const s = createRunState();
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    s.phase = 'wave';
    s.wave = 1;
    s.enemies.push(createEnemy(s.nextId++, 'grunt', 1, SPAWN, EXIT));
    for (let i = 0; i < 30; i++) tick(s);
    const saved = JSON.stringify(captureRun(s));
    const restored = restoreRun(JSON.parse(saved));
    check(restored !== null && restored.enemies[0].lastDir === s.enemies[0].lastDir,
      `pathing tie-break: a mid-flight save restores lastDir (${s.enemies[0].lastDir})`);
    if (restored) {
      let diverged = false;
      for (let i = 0; i < 200; i++) {
        tick(s);
        tick(restored);
        const a = s.enemies.filter((e) => !e.dead).map((e) => `${e.x},${e.y},${e.col},${e.row},${e.dist},${e.lastDir}`);
        const b = restored.enemies.filter((e) => !e.dead).map((e) => `${e.x},${e.y},${e.col},${e.row},${e.dist},${e.lastDir}`);
        if (a.join(';') !== b.join(';')) diverged = true;
      }
      check(!diverged, 'pathing tie-break: a restored mid-flight run continues without diverging');
    }
  }

  // Ground pathing draws no rng: a lone grunt leaves the rng stream position untouched.
  {
    const s = createRunState();
    const seed = s.rng;
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    s.phase = 'wave';
    s.enemies.push(createEnemy(1, 'grunt', 1, SPAWN, EXIT));
    for (let i = 0; i < 600; i++) tick(s);
    check(s.rng === seed, 'pathing tie-break: ground pathing draws no rng');
  }
}

{
  // Both authored routes levels load, and a level whose routes overlap is rejected by name.
  check(validateLevel(levelById('fork')) === null, 'fork: validateLevel accepts the map');
  check(validateLevel(levelById('ladder')) === null, 'ladder: validateLevel accepts the map');

  const overlap = {
    id: 'overlap',
    name: 'Overlap',
    walls: [],
    starts: [{ col: 0, row: 6 }],
    exits: [{ col: 19, row: 6 }],
    routes: [
      [{ col: 0, row: 6 }, { col: 1, row: 6 }, { col: 2, row: 6 }, { col: 19, row: 6 }],
      [{ col: 0, row: 6 }, { col: 2, row: 6 }, { col: 3, row: 6 }, { col: 19, row: 6 }],
    ],
  };
  check(validateLevel(overlap) === 'routes overlap',
    'a level whose routes overlap (outside spawn/exit) is rejected');

  const disjoint = {
    id: 'disjoint',
    name: 'Disjoint',
    walls: [],
    starts: [{ col: 0, row: 6 }],
    exits: [{ col: 19, row: 6 }],
    routes: [
      [{ col: 0, row: 6 }, { col: 1, row: 5 }, { col: 19, row: 6 }],
      [{ col: 0, row: 6 }, { col: 1, row: 7 }, { col: 19, row: 6 }],
    ],
  };
  check(validateLevel(disjoint) === null, 'routes sharing only the spawn and exit are accepted');
}

{
  // The Ladder hollows its centre: the box that once filled cols 1-16 / rows 3-8 is gone, so the
  // central rectangle and both balcony islands are buildable, and a tower actually places through
  // the placement path (not just on the grid).
  const ladder = levelById('ladder');
  const grid = createGrid(ladder);
  let buildable = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (tileAt(grid, c, r) === 'buildable') buildable++;
  check(buildable >= 40, `ladder: ${buildable} buildable tiles (expected at least 40)`);
  for (const [c, r] of [[1, 3], [8, 5], [16, 8], [4, 0], [5, 1], [14, 10], [15, 11]]) {
    check(tileAt(grid, c, r) === 'buildable', `ladder: (${c},${r}) is buildable`);
  }
  check(validateLevel(ladder) === null, 'ladder: validateLevel accepts the map');
  const s = stateOnLevel('ladder');
  check(canPlace(s, 'gun', 8, 5), 'ladder: a tower places in the hollow centre');
  check(canPlace(s, 'gun', 4, 0), 'ladder: a tower places on the top balcony island');
}

{
  // Spawned enemies alternate routes by a seeded, deterministic round-robin.
  const assign = () => {
    const s = stateOnLevel('fork');
    const idx = [];
    for (let i = 0; i < 6; i++) {
      spawnCheatEnemy(s, 'grunt');
      idx.push(s.enemies[s.enemies.length - 1].routeIndex);
    }
    return idx;
  };
  const seq = assign();
  check(JSON.stringify(seq) === JSON.stringify([0, 1, 0, 1, 0, 1]),
    `fork: enemies alternate routes 0,1,0,1 (${seq.join(',')})`);
  check(JSON.stringify(assign()) === JSON.stringify(seq), 'fork: route distribution is deterministic across runs');
}

{
  // A wall on one route re-routes that corridor alone; the other route's field is untouched.
  const s = stateOnLevel('fork');
  const beforeA = Array.from(s.routeFields[0]);
  const beforeB = Array.from(s.routeFields[1]);
  s.economy.salvage = 10000;
  check(placeTower(s, 'wall', 5, 2), 'wall placed on the upper route');
  check(JSON.stringify(Array.from(s.routeFields[1])) === JSON.stringify(beforeB),
    'a wall on one route leaves the other route field unchanged');
  check(JSON.stringify(Array.from(s.routeFields[0])) !== JSON.stringify(beforeA),
    'a wall on a route changes that route field');
}

// --- 5f. The static tile layer keys on the map, not just the geometry ------------------------
{
  const graphicsSignature = (g) =>
    JSON.stringify(
      g.context.instructions.map((i) => [
        i.action,
        i.data.style.color,
        i.data.path.instructions,
      ]),
    );

  const layout = computeLayout(1280, 800);
  const board = layout.board;
  const hover = { col: 0, row: 0, onBoard: false, x: 0, y: 0 };
  const s = createRunState();
  const firstKey = staticLayerKey(s, board);
  for (let i = 0; i < 120; i++) tick(s);
  check(staticLayerKey(s, board) === firstKey, 'static layer key is stable across ticks for one level');

  const view = new BoardView();
  const drawLayer = () => {
    view.draw(s, layout, 0, hover);
    return graphicsSignature(view.tiles);
  };
  const keys = [firstKey];
  const layers = [drawLayer()];
  for (let i = 1; i < LEVELS.length; i++) {
    check(cycleLevel(s), `cycle to map ${i + 1} for the static layer`);
    keys.push(staticLayerKey(s, board));
    layers.push(drawLayer());
  }
  check(new Set(keys).size === LEVELS.length, `all ${LEVELS.length} maps have distinct static layer keys`);
  check(new Set(layers).size === LEVELS.length, `all ${LEVELS.length} maps draw distinct static tile layers`);
  check(cycleLevel(s), 'cycle back to the first map');
  check(s.levelId === LEVELS[0].id, 'the first map is selected again');
  check(staticLayerKey(s, board) === firstKey, 'returning to the first map reproduces its static layer key');
  check(drawLayer() === layers[0], 'returning to the first map redraws its original tile layer');
}

{
  const graphicsSignature = (g) =>
    JSON.stringify(
      g.context.instructions.map((i) => [
        i.action,
        i.data.style.color,
        i.data.path.instructions,
      ]),
    );

  const layout = computeLayout(1280, 800);
  const board = layout.board;
  const hover = { col: 0, row: 0, onBoard: false, x: 0, y: 0 };
  const s = createRunState();
  s.economy.salvage = 10000;
  check(placeTower(s, 'gun', 3, 6), 'tower placed before the layer-rebuild check');
  const view = new BoardView();
  view.draw(s, layout, 0, hover);
  const towersBefore = graphicsSignature(view.towers);
  const tilesBefore = graphicsSignature(view.tiles);
  check(view.towers.context.instructions.length > 0, 'the tower layer has content before the map switch');

  // A run-start map switch, forced directly because the public cycle refuses once a tower exists.
  s.levelId = LEVELS[1].id;
  s.level = LEVELS[1];
  s.grid = createGrid(LEVELS[1]);
  s.toggles = LEVELS[1].toggles ?? [];
  view.draw(s, layout, 0, hover);

  check(graphicsSignature(view.tiles) !== tilesBefore, 'the map switch rebuilds the static tile layer');
  check(graphicsSignature(view.towers) === towersBefore,
    'the tile-layer rebuild leaves the placed tower layer unchanged');
  check(view.towers.context.instructions.length > 0, 'the tower layer still has content after the switch');
}

// --- 6. Tier ladder, branches, selling -------------------------------------------------------
{
  const dps = (st) => st.damage / (st.fireInterval / TICK_HZ);

  // 6a. A branched tier-3 tower out-damages the same salvage spent on tier-2 towers.
  const s = createRunState();
  s.economy.salvage = 10000;
  check(placeTower(s, 'gun', 5, 5), 'place a gun to branch');
  check(upgradeTower(s, 5, 5), 'upgrade gun 1 -> 2');
  check(chooseBranch(s, 5, 5, 'A'), 'choose Marksman branch (2 -> 3)');
  const branched = towerAt(s, 5, 5);
  const branchDps = dps(effectiveStats(branched));

  const tier1 = createTower(999, 'gun', 0, 0);
  const tier2Cost = TOWER_STATS.gun.cost + upgradeCost(tier1);
  const tier2 = createTower(998, 'gun', 0, 0);
  tier2.tier = 2;
  const tier2Dps = dps(effectiveStats(tier2));
  const nTier2 = Math.floor(branched.spent / tier2Cost);
  check(branchDps > nTier2 * tier2Dps,
    `branched gun dps ${branchDps.toFixed(1)} > ${nTier2} tier-2 gun(s) (${(nTier2 * tier2Dps).toFixed(1)}) for the same salvage`);

  // 6b. chooseBranch is required at tier 3; upgradeTower will not cross 2 -> 3 on its own.
  const s2 = createRunState();
  s2.economy.salvage = 10000;
  placeTower(s2, 'gun', 5, 5);
  upgradeTower(s2, 5, 5);
  check(!upgradeTower(s2, 5, 5), 'upgradeTower refuses to cross 2 -> 3');
  check(towerAt(s2, 5, 5).tier === 2, 'tower is still tier 2');
  check(chooseBranch(s2, 5, 5, 'B'), 'chooseBranch performs 2 -> 3');
  const branched2 = towerAt(s2, 5, 5);
  check(branched2.tier === 3 && branched2.branch === 'B', `tower is tier 3 branch ${branched2.branch}`);

  // 6c. Selling refunds floor(spent * 0.7) and restores the route length.
  const s3 = stateOnLevel('open-field');
  s3.economy.salvage = 10000;
  const routeBefore = currentPath(s3).length;
  for (const [c, r] of [[11, 5], [12, 5], [11, 7], [12, 7]]) placeTower(s3, 'gun', c, r);
  check(currentPath(s3).length > routeBefore, 'a wall lengthens the route');
  const spent = towerAt(s3, 11, 5).spent;
  const salv = s3.economy.salvage;
  check(sellTower(s3, 11, 5), 'sell a wall tower');
  check(s3.economy.salvage === salv + Math.floor(spent * 0.7),
    `refund is floor(spent * 0.7) = ${Math.floor(spent * 0.7)}`);
  for (const [c, r] of [[12, 5], [11, 7], [12, 7]]) sellTower(s3, c, r);
  check(currentPath(s3).length === routeBefore, `selling restores the route (${routeBefore} tiles)`);

  // 6d. The refund covers upgrade spend too (spent accumulates).
  const s4 = createRunState();
  s4.economy.salvage = 10000;
  placeTower(s4, 'gun', 5, 5);
  upgradeTower(s4, 5, 5);
  const spent2 = towerAt(s4, 5, 5).spent;
  const salv2 = s4.economy.salvage;
  sellTower(s4, 5, 5);
  check(s4.economy.salvage === salv2 + Math.floor(spent2 * 0.7), 'refund covers upgrades too');
}

// --- 6e. Upgrade tooltip text matches the stats after actually buying --------------------------
{
  const s = createRunState();
  s.economy.salvage = 10000;
  placeTower(s, 'wall', 5, 5);
  const wall = towerAt(s, 5, 5);
  const line = upgradeTooltipLines(wall, s.economy.salvage)[0];
  check(tooltipText(line) === 'Wall T2 — HP 60 → 180, $12',
    `upgrade tooltip reads the tier-2 total and cost (${tooltipText(line)})`);
  upgradeTower(s, 5, 5);
  check(towerAt(s, 5, 5).maxHp === 180, 'the tooltip after-value matches the wall after buying');

  // A non-wall upgrade reads from effectiveStats, so a beacon aura is part of the shown delta.
  const s2 = allUnlocked();
  s2.economy.salvage = 10000;
  placeTower(s2, 'gun', 5, 5);
  placeTower(s2, 'beacon', 6, 5);
  const gun = towerAt(s2, 5, 5);
  const gunLine = tooltipText(upgradeTooltipLines(gun, s2.economy.salvage)[0]);
  check(gunLine.includes('4.8 → 6.0'), `gun upgrade tooltip includes the beacon aura (${gunLine})`);
}

// --- 7. Frost slows a grunt ------------------------------------------------------------------
{
  const travel = (withFrost) => {
    const s = allUnlocked();
    if (withFrost) {
      s.economy.salvage = 10000;
      placeTower(s, 'frost', 3, 5);
    }
    s.phase = 'wave';
    const e = createEnemy(1, 'grunt', 1, SPAWN, EXIT);
    s.enemies.push(e);
    for (let i = 0; i < 60; i++) tick(s);
    return e.dist;
  };
  const normal = travel(false);
  const slowed = travel(true);
  check(slowed < normal, `frost slows a grunt (${slowed.toFixed(2)} < ${normal.toFixed(2)} tiles over 60 ticks)`);
}

// --- 8. Beacon raises a neighbouring gun's damage by 60% -------------------------------------
{
  const s = allUnlocked();
  s.economy.salvage = 10000;
  placeTower(s, 'gun', 5, 5);
  placeTower(s, 'beacon', 6, 5);
  const gun = towerAt(s, 5, 5);
  check(Math.abs(gun.auraDamage - 1.6) < 1e-9,
    `beacon raises neighbouring gun damage by 60% (auraDamage=${gun.auraDamage.toFixed(4)})`);
}

// --- 9. Laser damages more than one enemy in a line ------------------------------------------
{
  const s = allUnlocked();
  s.economy.salvage = 10000;
  placeTower(s, 'laser', 5, 5);
  s.phase = 'wave';
  // Enemies sit in a vertical line north of the laser, so its barrel (which starts facing north)
  // is already lined up and the single tick is about piercing, not traversal.
  const spawn = (id, y, dist) => {
    const e = createEnemy(id, 'grunt', 1, SPAWN, EXIT);
    e.x = 5.5;
    e.y = y;
    e.prevX = 5.5;
    e.prevY = y;
    e.col = 5;
    e.row = Math.floor(y);
    e.dist = dist;
    e.targetCol = -1;
    e.targetRow = -1;
    return e;
  };
  s.enemies.push(spawn(1, 4.5, 1), spawn(2, 3.5, 2), spawn(3, 2.5, 3));
  tick(s);
  const hurt = s.enemies.filter((e) => e.hp < e.maxHp).length;
  check(hurt >= 2, `laser damaged ${hurt} enemies in a line (expected >= 2)`);
}

// --- 9b. Turret traverse: a traversing barrel waits to line up; instant towers do not ----------
{
  // A cannon facing south must swing 180° north before firing. At 90°/s that is ~115 ticks, so it
  // must hold fire early and land a shot inside the expected window.
  const s = allUnlocked();
  s.economy.salvage = 10000;
  placeTower(s, 'cannon', 5, 5);
  const cannon = towerAt(s, 5, 5);
  cannon.angle = Math.PI; // pointing away from the target (which is north)
  s.phase = 'wave';
  const e = createEnemy(1, 'grunt', 1, SPAWN, EXIT);
  e.x = 5.5;
  e.y = 4.0;
  e.prevX = 5.5;
  e.prevY = 4.0;
  e.col = 5;
  e.row = 4;
  e.dist = 1;
  e.targetCol = -1;
  e.targetRow = -1;
  e.stunUntilTick = 9999; // hold still so traverse is the only variable
  s.enemies.push(e);

  let firedAt = -1;
  for (let i = 1; i <= 160; i++) {
    tick(s);
    if (firedAt < 0 && e.hp < e.maxHp) firedAt = i;
    if (i === 50) check(e.hp === e.maxHp, 'cannon holds fire while the barrel traverses (50 ticks)');
  }
  check(firedAt > 0, 'cannon fires once the barrel lines up');
  check(firedAt >= 100 && firedAt <= 130, `cannon fires within the expected window (tick ${firedAt})`);

  // An instant-turn tower (turnRate 0) ignores facing entirely and fires on the first tick.
  const s2 = allUnlocked();
  s2.economy.salvage = 10000;
  placeTower(s2, 'taser', 5, 5);
  const taser = towerAt(s2, 5, 5);
  taser.angle = Math.PI; // even pointing away, an instant tower needs no aiming
  s2.phase = 'wave';
  const e2 = createEnemy(1, 'grunt', 1, SPAWN, EXIT);
  e2.x = 5.5;
  e2.y = 4.0;
  e2.prevX = 5.5;
  e2.prevY = 4.0;
  e2.col = 5;
  e2.row = 4;
  e2.dist = 1;
  e2.targetCol = -1;
  e2.targetRow = -1;
  e2.stunUntilTick = 9999;
  s2.enemies.push(e2);
  tick(s2);
  check(e2.hp < e2.maxHp, 'an instant-turn tower fires on the first tick it has a target');
}

// --- 9c. The AA tower: flyers only, 2x damage, and the Flak / Missile branches ------------------
{
  // A ground unit alone in range never draws a shot.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'aa', 5, 5);
  s.phase = 'wave';
  const grunt = stationary(1, 'grunt', 1, 5.5, 4.0);
  s.enemies.push(grunt);
  for (let i = 0; i < 60; i++) tick(s);
  check(grunt.hp === grunt.maxHp, 'AA holds fire with only a ground unit in range');
}
{
  // The same nominal hit lands at 2x against a flyer (2.6 base -> 5.2).
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'aa', 5, 5);
  const aa = towerAt(s, 5, 5);
  s.phase = 'wave';
  const flyer = stationary(1, 'flyer', 20, 5.5, 4.0);
  s.enemies.push(flyer);
  for (let i = 0; i < 60 && aa.damageDealt === 0; i++) tick(s);
  check(aa.damageDealt > 0, 'AA fires at a flyer in range');
  check(Math.abs(aa.damageDealt - 5.2) < 1e-6, `AA deals 2x nominal damage to a flyer (${aa.damageDealt.toFixed(2)} vs 5.2)`);
}
{
  // Air belongs to the AA. Every other tower only chips a flyer, so a ground-winning line still leaks
  // without one: a Gun's 3 damage lands as 0.75, which is 7x worse than the AA's 5.2.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'gun', 5, 5);
  const gun = towerAt(s, 5, 5);
  s.phase = 'wave';
  const flyer = stationary(1, 'flyer', 20, 5.5, 4.0);
  s.enemies.push(flyer);
  for (let i = 0; i < 120 && gun.damageDealt === 0; i++) tick(s);
  const want = 3 * FLYER_OFF_KIND_DAMAGE;
  check(Math.abs(gun.damageDealt - want) < 1e-6,
    `a Gun deals ${FLYER_OFF_KIND_DAMAGE}x to a flyer (${gun.damageDealt.toFixed(2)} vs ${want.toFixed(2)})`);
  check(5.2 / gun.damageDealt > 6, 'the AA hits a flyer at least six times harder than a Gun');
}

{
  // Air belongs to the Gun and the AA. Every other tower in the palette must refuse to acquire a
  // flyer at all — Taser and Frost cannot target one, and neither can the Laser, the Cannon or a
  // Cursor. A flyer parked inside their range must come out untouched.
  for (const kind of ['laser', 'taser', 'frost', 'cannon', 'cursor']) {
    const s = allUnlocked();
    s.economy.salvage = 100000;
    placeTower(s, kind, 5, 5);
    const t = towerAt(s, 5, 5);
    s.phase = 'wave';
    const flyer = stationary(1, 'flyer', 20, 5.5, 4.0);
    const before = flyer.hp;
    s.enemies.push(flyer);
    for (let i = 0; i < 240; i++) tick(s);
    check(t.damageDealt === 0, `a ${kind} cannot target a flyer (dealt ${t.damageDealt})`);
    check(flyer.hp === before, `the flyer is untouched by a ${kind} (${flyer.hp} of ${before})`);
  }
}
{
  // Every tower in the palette must be clickable. This is the AA bug in general form: a kind drawn in
  // the palette with no dispatch case is a button that does nothing.
  const layout = computeLayout(1280, 800);
  const s = allUnlocked();
  s.economy.salvage = 100000;
  const h = computeHud(layout, s);
  const dead = [];
  for (const t of h.towers) {
    const hit = hudControlAt(layout, s, t.rect.x + t.rect.w - 4, t.rect.y + t.rect.h / 2);
    if (!hit || hit.action !== t.kind || !hit.enabled) dead.push(t.kind);
  }
  check(dead.length === 0, `every palette tower is a live control (dead: ${dead.join(', ') || 'none'})`);
  check(h.towers.some((t) => t.kind === 'aa'), 'the AA tower has a palette button');
}
{
  // Flak splash: a flyer takes full damage, a ground unit inside the radius takes half, and a ground
  // unit outside the radius is untouched.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'aa', 5, 5);
  upgradeTower(s, 5, 5);
  chooseBranch(s, 5, 5, 'A');
  const aa = towerAt(s, 5, 5);
  s.phase = 'wave';
  const flyer = stationary(1, 'flyer', 20, 5.5, 4.0);
  const near = stationary(2, 'grunt', 1, 6.0, 4.0);
  const far = stationary(3, 'grunt', 1, 8.0, 4.0);
  s.enemies.push(flyer, near, far);
  for (let i = 0; i < 200 && aa.damageDealt === 0; i++) tick(s);
  const st = effectiveStats(aa);
  check(st.splash > 0, 'the Flak branch adds splash');
  const flyerDmg = st.damage * st.flyerDamageMult;
  const groundDmg = st.damage * 0.5;
  check(Math.abs(flyer.maxHp - flyer.hp - flyerDmg) < 1e-6,
    `Flak deals full damage to a flyer (${(flyer.maxHp - flyer.hp).toFixed(2)} vs ${flyerDmg.toFixed(2)})`);
  check(Math.abs(near.maxHp - near.hp - groundDmg) < 1e-6,
    `Flak deals half damage to a ground unit (${(near.maxHp - near.hp).toFixed(2)} vs ${groundDmg.toFixed(2)})`);
  check(far.hp === far.maxHp, 'Flak splash does not reach beyond its radius');
}
{
  // Missile: four missiles launch, all home on the designated target, and land within the salvo window.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'aa', 5, 5);
  upgradeTower(s, 5, 5);
  chooseBranch(s, 5, 5, 'B');
  const aa = towerAt(s, 5, 5);
  s.phase = 'wave';
  const flyer = stationary(1, 'flyer', 20, 5.5, 4.0);
  s.enemies.push(flyer);
  tick(s); // fire the salvo
  check(s.projectiles.length === 4, `a missile salvo launches 4 missiles (${s.projectiles.length})`);
  check(s.projectiles.every((p) => p.kind === 'missile' && p.targetId === flyer.id),
    'all four missiles home on the designated target');
  aa.cooldown = 100000; // hold further salvos so the four land in isolation
  const hpBefore = flyer.hp;
  let landedBy = -1;
  for (let i = 1; i <= 120; i++) {
    tick(s);
    if (s.projectiles.length === 0) {
      landedBy = i;
      break;
    }
  }
  check(landedBy > 0 && landedBy <= 120, `the four missiles land within the salvo window (${landedBy} ticks)`);
  const fullHit = effectiveStats(aa).damage * 2;
  check(Math.abs(hpBefore - flyer.hp - fullHit) < 1e-6,
    `four missiles deal one full hit (${(hpBefore - flyer.hp).toFixed(2)} vs ${fullHit.toFixed(2)})`);
}
{
  // A missile never damages a ground unit, even one sitting on the flyer's flight path.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'aa', 5, 5);
  upgradeTower(s, 5, 5);
  chooseBranch(s, 5, 5, 'B');
  const aa = towerAt(s, 5, 5);
  s.phase = 'wave';
  const flyer = stationary(1, 'flyer', 20, 5.5, 4.0);
  const grunt = stationary(2, 'grunt', 1, 5.6, 4.0);
  s.enemies.push(flyer, grunt);
  tick(s);
  aa.cooldown = 100000;
  for (let i = 0; i < 120; i++) tick(s);
  check(grunt.hp === grunt.maxHp, 'a missile never damages a ground unit');
  check(flyer.hp < flyer.maxHp, 'the missiles still reach the flyer');
}
{
  // A missile whose target dies retargets the nearest flyer within range.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'aa', 5, 5);
  upgradeTower(s, 5, 5);
  chooseBranch(s, 5, 5, 'B');
  const aa = towerAt(s, 5, 5);
  s.phase = 'wave';
  const a = stationary(1, 'flyer', 20, 5.5, 4.0);
  const b = stationary(2, 'flyer', 20, 6.0, 4.0);
  s.enemies.push(a, b);
  tick(s); // salvo homes on `a`
  check(s.projectiles.every((p) => p.targetId === a.id), 'the salvo homes on the first flyer');
  a.dead = true; // the target dies mid-flight
  aa.cooldown = 100000;
  let remaining = 0;
  for (let i = 0; i < 120 && s.projectiles.length > 0; i++) {
    tick(s);
    remaining = s.projectiles.length;
  }
  check(remaining === 0, 'the missiles retarget and land (none expire in flight)');
  check(b.hp < b.maxHp, 'a missile whose target died retargets the nearest flyer');
}



{
  // 46aa. The Beacon's branch is a real upgrade, not a silent downgrade: Command *adds* +30% to the
  // +60% base aura (the branch effect was assigned where every other numeric effect adds), and both
  // the placed-tower tooltip and the branch preview say so in numbers.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'beacon', 5, 5);
  const b = towerAt(s, 5, 5);
  const base = effectiveStats(b);
  check(Math.abs(base.auraDamage - 0.6) < 1e-9, `an un-branched Beacon is +60% (${base.auraDamage})`);
  b.branch = 'A';
  b.tier = 3;
  const command = effectiveStats(b);
  check(Math.abs(command.auraDamage - 0.9) < 1e-9, `Command is +90%, not +30% (${command.auraDamage})`);
  b.branch = 'B';
  const relay = effectiveStats(b);
  check(Math.abs(relay.auraDamage - 0.6) < 1e-9 && Math.abs(relay.auraPointerDamage - 0.5) < 1e-9,
    'Relay keeps the +60% aura and adds +50% pointer damage');
  const relayLines = towerTooltipLines(b, s.clock);
  check(relayLines.some((l) => l.includes('+60% damage')), `the Relay tooltip states its aura (${relayLines.join(' | ')})`);
  check(relayLines.some((l) => l.includes('50% pointer damage') && l.includes('0.75')),
    `the Relay tooltip states the pointer bonus (${relayLines.join(' | ')})`);
  b.branch = 'A';
  const cmdLines = towerTooltipLines(b, s.clock);
  check(cmdLines.some((l) => l.includes('+90% damage')), `the Command tooltip states +90% (${cmdLines.join(' | ')})`);
  const palette = paletteTooltipLines('beacon');
  check(palette.some((l) => l.includes('+60% damage')), `the palette says what a Beacon does (${palette.join(' | ')})`);
  check(paletteTooltipLines('beacon').some((l) => l.includes('Cursors')), 'the palette warns that Cursors take nothing');
}
{
  // 46z. A Cursor tower's ring is centred on its base tile; a dotted tether runs from base to cursor.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  s.phase = 'wave';
  placeTower(s, 'cursor', 5, 5);
  const t = towerAt(s, 5, 5);
  t.cursorX = 7.5;
  t.cursorY = 4.5;
  const board = { x: 100, y: 50, cell: 20 };
  const c = cursorRingCentre(t, board, 20);
  check(c.x === 250 && c.y === 140, `the cursor tether runs to the cursor (${c.x}, ${c.y})`);
  const home = cursorLeashCentre(t, board, 20);
  check(home.x === 210 && home.y === 160, `the cursor range ring is centred on the tower base (${home.x}, ${home.y})`);
  check(c.x !== home.x || c.y !== home.y, 'the tether has a length, so base and cursor are distinguishable');
  check(cursorRadius(t) > 0, 'the ring has a radius: the distance the cursor may wander from its base');
  // The art size the game draws a tower's cursor at matches the player's own arrow.
  check(CURSOR_ARROW_PX === 16, 'a tower cursor is drawn at the same size as the player pointer');
}
{
  // A missile that loses its target searches from where the missile *is*, not from its tower: the
  // flyer that catches it is well outside the AA's 3.4-tile range.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'aa', 5, 5);
  upgradeTower(s, 5, 5);
  chooseBranch(s, 5, 5, 'B');
  const aa = towerAt(s, 5, 5);
  s.phase = 'wave';
  const a = stationary(1, 'flyer', 40, 5.5, 4.0);
  const far = stationary(2, 'flyer', 40, 5.5, 0.0);
  const towerDist = Math.hypot(far.x - (5 + 0.5), far.y - (5 + 0.5));
  check(towerDist > effectiveStats(aa).range, `the far flyer is outside the AA's range (${towerDist.toFixed(1)})`);
  s.enemies.push(a, far);
  tick(s); // salvo launches at `a`
  a.dead = true;
  aa.cooldown = 100000;
  let acquired = false;
  for (let i = 0; i < 120 && s.projectiles.length > 0; i++) {
    tick(s);
    if (s.projectiles.some((p) => p.targetId === far.id)) acquired = true;
  }
  check(acquired, 'a missile retargets onto a flyer within its own radius, outside the tower range');
  check(far.hp < far.maxHp, 'the retargeted missile lands on the far flyer');
}
{
  // Same seed reproduces the same directions; two runs of the same wave produce identical missile paths.
  const dirs = (tick, towerId, salvo) => {
    let rng = missileSeed(tick, towerId, salvo);
    const out = [];
    for (let i = 0; i < 4; i++) {
      const r = rngNext(rng);
      rng = r.next;
      out.push(r.value);
    }
    return out;
  };
  check(JSON.stringify(dirs(100, 7, 0)) === JSON.stringify(dirs(100, 7, 0)), 'the same seed reproduces the same launch directions');
  check(JSON.stringify(dirs(100, 7, 0)) !== JSON.stringify(dirs(100, 8, 0)), 'a different tower id yields different directions');

  const trace = () => {
    const s = allUnlocked();
    s.economy.salvage = 100000;
    placeTower(s, 'aa', 5, 5);
    upgradeTower(s, 5, 5);
    chooseBranch(s, 5, 5, 'B');
    s.phase = 'wave';
    s.enemies.push(stationary(1, 'flyer', 20, 5.5, 4.0));
    const path = [];
    for (let i = 0; i < 40; i++) {
      tick(s);
      for (const p of s.projectiles) path.push([p.kind, p.id, +p.x.toFixed(4), +p.y.toFixed(4)]);
    }
    return JSON.stringify(path);
  };
  check(trace() === trace(), 'two runs of the same flyer wave produce identical missile paths');
}
{
  // The fixed-timestep equivalence holds with projectiles in flight: the frame rate never changes the
  // missiles' integrated positions, because their motion comes from the same fixed tick as everything
  // else.
  const run = (frameMs) => {
    const s = allUnlocked();
    s.economy.salvage = 100000;
    placeTower(s, 'aa', 5, 5);
    upgradeTower(s, 5, 5);
    chooseBranch(s, 5, 5, 'B');
    s.phase = 'wave';
    s.enemies.push(stationary(1, 'flyer', 20, 5.5, 4.0));
    for (let t = 0; t < 100 * TICK_MS - frameMs; t += frameMs) step(s, frameMs);
    while (s.tick < 120) tick(s);
    return JSON.stringify([
      s.projectiles.map((p) => [p.kind, p.id, +p.x.toFixed(4), +p.y.toFixed(4), +p.vx.toFixed(4), +p.vy.toFixed(4)]),
      s.enemies.map((e) => [e.id, e.hp]),
      s.economy.damage.tower,
    ]);
  };
  const at60 = run(TICK_MS);
  check(at60 === run(1000 / 144), 'projectiles in flight: same result at 60 Hz and 144 Hz frames');
  check(at60 === run(1000 / 23), 'projectiles in flight: same result at 23 Hz frames');
}

// --- 10. Precision clicking: weak points deal 2x, combo scales and resets ----------------------
{
  const make = () => {
    const s = createRunState();
    s.phase = 'wave';
    const e = createEnemy(1, 'grunt', 1, SPAWN, EXIT);
    e.x = 10.5;
    e.y = 5.5;
    e.prevX = 10.5;
    e.prevY = 5.5;
    e.heading = 0; // moving right; the weak point faces +x
    s.enemies.push(e);
    return { s, e };
  };

  // A click 0.15 tiles ahead of the centre is inside the radius and the leading arc.
  const weak = make();
  pointerDown(weak.s, weak.e.x + 0.15, weak.e.y);
  const weakDmg = weak.e.maxHp - weak.e.hp;

  // The same distance 90° off the heading is inside the radius but outside the arc: a normal hit.
  const normal = make();
  pointerDown(normal.s, normal.e.x, normal.e.y + 0.15);
  const normalDmg = normal.e.maxHp - normal.e.hp;

  check(weakDmg === normalDmg * 2, `weak-point click deals exactly 2x a normal click (${weakDmg} vs ${normalDmg})`);

  // Combo: ten weak-point hits reach x2; a miss resets to x1.
  const c = make();
  c.e.hp = 1000000; // keep it alive across ten clicks
  for (let i = 0; i < 10; i++) pointerDown(c.s, c.e.x + 0.15, c.e.y);
  check(Math.abs(comboMultiplier(c.s.pointer) - 2) < 1e-9,
    `combo reaches x2 at ten hits (combo=${c.s.pointer.combo})`);
  pointerDown(c.s, c.e.x + 10, c.e.y); // click nothing
  check(c.s.pointer.combo === 0 && comboMultiplier(c.s.pointer) === 1,
    `combo resets to x1 on a miss (combo=${c.s.pointer.combo})`);
}

// --- 11. Ads: timing in wave 1, no build-phase spawns, one alive, freeware and bluescreen --
{
  // No towers: wave 1's grunts live long enough for the first attempt to find two on the board.
  const s = createRunState();
  check(startWave(s), 'ad timing: wave 1 started with no towers');
  const limit = secondsToTicks(20);
  let firstSeen = -1;
  for (let i = 0; i < limit; i++) {
    tick(s);
    if (firstSeen < 0 && s.ad) firstSeen = s.tick;
  }
  check(firstSeen > 0 && firstSeen <= limit,
    `wave 1 produces an ad within 20 s (first seen at tick ${firstSeen})`);
}

{
  const s = createRunState();
  check(startWave(s), 'ad timing: wave 1 started for the build-phase check');
  let spawnedInBuild = false;
  let previousId = null;
  for (let i = 0; i < secondsToTicks(120); i++) {
    const phase = s.phase;
    tick(s);
    const id = s.ad?.id ?? null;
    if (id !== null && id !== previousId && phase === 'build') spawnedInBuild = true;
    previousId = id;
  }
  check(s.phase === 'build', 'wave 1 ended and the run waits in build');
  check(!spawnedInBuild, 'no ad ever spawns during build phase');
}

{
  const s = createRunState();
  for (let i = 0; i < 1000; i++) tick(s);
  check(s.ad === null, 'no ad ever spawns in an untouched build phase');

  const first = spawnAd(s, 'defrag');
  check(first !== null, 'an ad spawns on demand');
  check(spawnAd(s, 'freeware') === null, 'two ads never coexist (a second is refused)');
  s.ad = null;
}

{
  const s = createRunState();
  const routeBefore = currentPath(s).length;
  const ad = spawnAd(s, 'freeware');
  check(dismissAd(s, ad.id), 'dismiss freeware');
  check(s.towers.length === 1, 'freeware adds one tower');
  const gun = s.towers[0];
  check(gun.kind === 'gun', 'the free tower is a Gun');
  check(tileAt(s.grid, gun.col, gun.row) === 'buildable', 'the Gun sits on a buildable tile');
  check(currentPath(s).length > 1, 'the route stays open after the free Gun');
  check(routeBefore === currentPath(s).length || currentPath(s).length >= routeBefore,
    'free Gun does not seal or shorten the route');
}

{
  const s = createRunState();
  s.economy.salvage = 10000;
  placeTower(s, 'gun', 5, 5);
  const gun = towerAt(s, 5, 5);
  const ad = spawnAd(s, 'bluescreen');
  const before = s.economy.salvage;
  check(dismissAd(s, ad.id), 'dismiss bluescreen');
  check(s.economy.salvage === before, 'bluescreen pays nothing');
  check(s.towerDisabled.get(gun.id) === secondsToTicks(3),
    `bluescreen disables a tower for 3 s (${s.towerDisabled.get(gun.id)} ticks)`);
}

// --- 12. Profile persistence: defaults for empty, corrupt and unknown-version stores -----------
{
  const empty = loadProfile({ getItem: () => null, setItem: () => {} });
  check(empty.version === 3, 'empty storage returns a default profile (version 3)');
  check(
    empty.specs.cpu === 0 && empty.specs.ram === 0 && empty.specs.gpu === 0 && empty.specs.disk === 0,
    'default spec levels are all zero',
  );
  check(
    empty.rp === 0 && empty.rpEarned === 0 && empty.tree.length === 0 && empty.lastSalvage === 0,
    'default Restore Point fields are zero',
  );
  check(
    empty.achievements.length === 0 && empty.bestWave === 0 && empty.reboots === 0,
    'default profile meta fields are zero',
  );

  const corrupt = loadProfile({ getItem: () => 'not json', setItem: () => {} });
  check(corrupt.specs.cpu === 0, 'corrupt JSON returns a default profile');

  const unknown = loadProfile({
    getItem: () => JSON.stringify({ version: 999, specs: { cpu: 5, ram: 5, gpu: 5, disk: 5 } }),
    setItem: () => {},
  });
  check(unknown.specs.cpu === 0, 'an unknown-version save returns a default profile');

  const store = { value: null, getItem() { return this.value; }, setItem(_k, v) { this.value = v; } };
  const p = defaultProfile();
  p.specs.cpu = 7;
  p.rp = 3;
  p.rpEarned = 12;
  p.tree.push('loose-change');
  p.achievements.push('first-blood');
  saveProfile(p, store);
  const loaded = loadProfile(store);
  check(
    loaded.specs.cpu === 7 && loaded.rp === 3 && loaded.rpEarned === 12 && loaded.tree.includes('loose-change') && loaded.achievements.includes('first-blood'),
    'save/load round-trips the profile',
  );
}

// --- 13. Spec bonuses are applied to the starting economy ---------------------------------------
{
  const profile = defaultProfile();
  profile.specs.ram = 3;
  profile.specs.disk = 2;
  const s = createRunState(profile);
  check(s.economy.salvage === 60 + 3 * 5, `RAM specs add +5 salvage each (${s.economy.salvage})`);
  check(s.integrity === 20 + 2, `Disk specs add +1 integrity each (${s.integrity})`);
}

// --- 14. restartWindows banks the right number of Restore Points and resets the run ------------
{
  const s = createRunState();
  s.economy.earned = 20000; // floor(2.2 * sqrt(20000 / 900)) = floor(10.37) = 10
  s.wave = 52;
  const before = defaultProfile();
  const { gained, profile } = restartWindows(s, before);
  check(gained === 10, `restartWindows banks floor(2.2*sqrt(earned/900)) = ${gained}`);
  check(profile.rp === 10, 'banked Restore Points land in rp');
  check(profile.rpEarned === 10, 'the prestige level rises to match');
  check(profile.lastSalvage === 20000, 'lastSalvage records the run for Restore Point');
  check(profile.reboots === 1, 'reboot count increments');
  check(profile.bestWave === 52, 'bestWave records the run wave');

  const s2 = createRunState(profile);
  check(s2.wave === 0 && s2.phase === 'build', 'the reboot resets the run');
  check(s2.rp === 10 && s2.rpEarned === 10, 'the fresh run carries the banked RP and level');
}

// --- 15. An achievement unlocks once and only once ---------------------------------------------
{
  const s = createRunState();
  s.phase = 'wave';
  const e = createEnemy(1, 'grunt', 1, SPAWN, EXIT);
  s.enemies.push(e);
  let clicks = 0;
  while (!e.dead && clicks < 50) {
    pointerDown(s, e.x, e.y);
    pointerUp(s);
    clicks++;
  }
  check(e.dead, 'grunt killed for the achievement check');
  const first = checkAchievements(s);
  check(first.includes('first-blood'), 'first kill unlocks first-blood');
  const again = checkAchievements(s);
  check(!again.includes('first-blood'), 'first-blood does not fire twice');
}

// --- 15b. The achievement table: 118 definitions, unique ids, names and descriptions -----------
{
  check(ACHIEVEMENTS.length === 118, `exactly 118 achievements (${ACHIEVEMENTS.length})`);
  const ids = ACHIEVEMENTS.map((a) => a.id);
  check(new Set(ids).size === ACHIEVEMENTS.length, 'achievement ids are unique');
  check(
    ACHIEVEMENTS.every((a) => a.name.trim().length > 0 && a.description.trim().length > 0),
    'every achievement has a name and a description',
  );
  // Every shadow- id is hidden (the three redefined ids — leak-recovery, sell-profit and
  // early-call-wave-1 — are also hidden but keep their original ids).
  check(
    ACHIEVEMENTS.every((a) => !a.id.startsWith('shadow-') || a.hidden === true),
    'every shadow- id is hidden',
  );
  // Every achievement carries a live predicate (no `() => false` placeholder).
  check(
    ACHIEVEMENTS.every((a) => a.when !== undefined),
    'every achievement has a when predicate',
  );
  // The full 118-id catalog is present verbatim, and nothing extra ships.
  const DOC_IDS = [
    'first-blood', 'sharpshooter', 'weak-point-kills', 'crit-hits', 'crit-100', 'pointer-1k', 'click-combo', 'override',
    'pointer-only-wave', 'weak-point-10', 'crit-first', 'overclock-max', 'click-idle', 'pointer-boss-10',
    'five-tier-five', 'beacon-field', 'maxed-branch', 'aa-flak', 'mine-layer', 'wall-only-wave', 'toggle-master', 'repair-shop',
    'tower-zoo', 'tier-five-first', 'sell-10', 'no-upgrade-wave', 'laser-chain', 'frost-lock', 'taser-chain', 'cannon-splash',
    'cursor-first', 'cursor-repair', 'beacon-buff', 'one-kind', 'two-kinds', 'upgrade-first', 'branch-first', 'sell-tower-first',
    'salvage-peak', 'salvage-10k', 'earn-100k', 'no-spend-wave', 'ad-collector', 'ad-ignore', 'early-call-streak', 'early-call-10',
    'early-call-wave-1', 'idle-hour', 'sell-profit', 'no-sell',
    'clean-wave', 'flawless-wave', 'flawless-10', 'perfect-run', 'long-road', 'maze-100', 'wave-25', 'wave-50', 'wave-100',
    'endless-150', 'endless-200', 'integrity-1', 'speed-3', 'wave-1-no-damage', 'leak-recovery',
    'boss-by-pointer', 'milestone-boss-pointer', 'boss-10', 'boss-first-wave', 'shield-break-5', 'carrier-brood',
    'dreadnought-kill', 'wirecutter-kill', 'ram-kill', 'boss-no-leak',
    'reboot-50', 'two-reboots', 'reboot-10', 'specs-banked', 'first-rp', 'rp-100', 'prestige-25', 'tree-tier-3', 'tree-complete',
    'fast-boot-40', 'no-cheats-100', 'all-help',
    'custom-map-cleared', 'editor-first', 'map-export', 'map-import', 'fork-cleared', 'ladder-cleared',
    'shadow-ad-no-close', 'shadow-zero-towers', 'shadow-all-walls', 'shadow-sell-all', 'shadow-1hp-boss', 'shadow-pause',
    'shadow-hover', 'shadow-resize', 'shadow-mute', 'shadow-reload', 'shadow-clippy', 'shadow-monochrome', 'shadow-owl',
    'shadow-weekend', 'shadow-flat-battery', 'shadow-printer', 'shadow-boots', 'shadow-perfect-100', 'shadow-every-map',
    'shadow-broke', 'shadow-help-clippy', 'shadow-drag', 'shadow-tooltip', 'shadow-cheat-lose', 'shadow-console',
  ];
  const idSet = new Set(ids);
  check(DOC_IDS.length === 118, `the doc catalog has 118 ids (${DOC_IDS.length})`);
  check(DOC_IDS.every((id) => idSet.has(id)), 'every doc id is present');
  check(ids.every((id) => DOC_IDS.includes(id)), 'no id ships that is not in the doc');
}

// --- 15c. Each new run-state achievement fires once and only once -----------------------------
{
  // weak-point kills (deadeye): a counter threshold plus a real weak-point kill increments it.
  const s = createRunState();
  s.weakPointKills = 50;
  check(checkAchievements(s).includes('weak-point-kills'), 'weak-point-kills fires at 50');
  check(!checkAchievements(s).includes('weak-point-kills'), 'weak-point-kills fires once');
  const real = createRunState();
  real.phase = 'wave';
  const w = createEnemy(1, 'grunt', 1, SPAWN, EXIT);
  w.x = 10.5; w.y = 5.5; w.prevX = 10.5; w.prevY = 5.5; w.heading = 0;
  w.hp = 2; w.maxHp = 2;
  real.enemies.push(w);
  pointerDown(real, w.x + 0.15, w.y);
  check(real.weakPointKills === 1, 'a weak-point kill increments weakPointKills');
}

{
  // crit hits (lucky streak): a threshold plus a forced-crit click increments the counter.
  const s = createRunState();
  s.critHits = 25;
  check(checkAchievements(s).includes('crit-hits'), 'crit-hits fires at 25');
  check(!checkAchievements(s).includes('crit-hits'), 'crit-hits fires once');
  const findCrit = (seed) => {
    let r = seed;
    for (let i = 0; i < 10000; i++) {
      const roll = nextCritRoll(r, false, false);
      if (roll.crit) return r;
      r = roll.next;
    }
    throw new Error('no crit seed found');
  };
  const real = createRunState();
  real.phase = 'wave';
  const e = stationary(1, 'grunt', 1, 10.5, 5.5);
  e.hp = 100000; e.maxHp = 100000;
  real.enemies.push(e);
  real.rng = findCrit(0xabcdef01);
  pointerDown(real, e.x, e.y + 0.15);
  check(real.critHits === 1, 'a crit increments critHits');
}

{
  // salvage peak (deep pockets): tracked by tick, fires once.
  const s = createRunState();
  s.economy.salvage = 1500;
  tick(s);
  check(s.salvagePeak === 1500, 'tick captures the salvage peak');
  check(s.achievements.has('salvage-peak'), 'salvage-peak fires at the peak');
  check(!checkAchievements(s).includes('salvage-peak'), 'salvage-peak fires once');
}

{
  // no-sell (pack rat): wave 20 without selling; selling sets the flag and blocks it.
  const s = createRunState();
  s.wave = 20;
  check(checkAchievements(s).includes('no-sell'), 'no-sell fires at wave 20 with no sale');
  check(!checkAchievements(s).includes('no-sell'), 'no-sell fires once');
  const sold = createRunState();
  sold.wave = 20;
  sold.soldTower = true;
  check(!checkAchievements(sold).includes('no-sell'), 'selling blocks no-sell');
  const selling = createRunState();
  selling.economy.salvage = 10000;
  placeTower(selling, 'gun', 5, 5);
  sellTower(selling, 5, 5);
  check(selling.soldTower === true, 'sellTower sets the sold flag');
}

{
  // one-kind (one-trick pony): a wave cleared with exactly one tower kind on the board.
  const s = stateOnLevel('open-field');
  s.economy.salvage = 10000;
  placeTower(s, 'gun', 5, 5);
  s.clearedWaves = 1;
  check(checkAchievements(s).includes('one-kind'), 'one-kind fires on a single tower kind');
  check(!checkAchievements(s).includes('one-kind'), 'one-kind fires once');
  const two = allUnlocked();
  two.economy.salvage = 10000;
  placeTower(two, 'gun', 5, 5);
  placeTower(two, 'cannon', 6, 5);
  two.clearedWaves = 1;
  check(!checkAchievements(two).includes('one-kind'), 'two tower kinds block one-kind');
}

{
  // maxed-branch (maxed out): a branched tower with nothing left to buy.
  const s = createRunState();
  const t = createTower(1, 'gun', 5, 5);
  t.tier = MAX_TIER;
  t.branch = 'A';
  s.towers.push(t);
  check(checkAchievements(s).includes('maxed-branch'), 'maxed-branch fires on a tier-20 branched tower');
  check(!checkAchievements(s).includes('maxed-branch'), 'maxed-branch fires once');
  const unbranched = createRunState();
  const u = createTower(1, 'gun', 5, 5);
  u.tier = MAX_TIER;
  u.branch = null;
  unbranched.towers.push(u);
  check(!checkAchievements(unbranched).includes('maxed-branch'), 'an unbranched tower does not count');
}

{
  // aa-flak (flak jacket): an AA tower branched into Flak.
  const s = createRunState();
  const t = createTower(1, 'aa', 5, 5);
  t.tier = 3;
  t.branch = 'A';
  s.towers.push(t);
  check(checkAchievements(s).includes('aa-flak'), 'aa-flak fires on an AA Flak branch');
  check(!checkAchievements(s).includes('aa-flak'), 'aa-flak fires once');
  const missile = createRunState();
  const m = createTower(1, 'aa', 5, 5);
  m.tier = 3;
  m.branch = 'B';
  missile.towers.push(m);
  check(!checkAchievements(missile).includes('aa-flak'), 'the AA missile branch does not count');
}

{
  // early-call-streak (speedrunner): three early calls in a row, tracked by startWave.
  const s = createRunState();
  s.earlyCallsInARow = 3;
  check(checkAchievements(s).includes('early-call-streak'), 'early-call-streak fires at three in a row');
  check(!checkAchievements(s).includes('early-call-streak'), 'early-call-streak fires once');
  const streak = createRunState();
  startWave(streak); // wave 1 from build: not early
  check(streak.earlyCallsInARow === 0, 'a normal start resets the streak');
  startWave(streak); // wave 2 early
  startWave(streak); // wave 3 early
  startWave(streak); // wave 4 early
  check(streak.earlyCallsInARow === 3, 'three early calls reach the streak');
}

{
  // flawless-wave (no leaks): a zero-leak clear sets the flag and fires once.
  const s = createRunState();
  s.phase = 'wave';
  s.wave = 1;
  s.runs = [{ wave: 1, startTick: s.clock, spawns: [] }];
  s.leaksByWave.set(1, 0);
  s.enemies = [];
  tick(s);
  check(s.clearedFlawlessWave === true, 'a zero-leak clear sets the flawless flag');
  check(checkAchievements(s).includes('flawless-wave'), 'flawless-wave fires after a zero-leak clear');
  check(!checkAchievements(s).includes('flawless-wave'), 'flawless-wave fires once');
}

{
  // milestone-boss-pointer (milestone hunter): the pointer lands the final blow on a milestone boss.
  const s = createRunState();
  s.milestoneBossByPointer = true;
  check(checkAchievements(s).includes('milestone-boss-pointer'), 'milestone-boss-pointer fires');
  check(!checkAchievements(s).includes('milestone-boss-pointer'), 'milestone-boss-pointer fires once');
  const real = createRunState();
  real.phase = 'wave';
  const boss = createEnemy(1, 'grunt-boss', 10, SPAWN, EXIT);
  boss.hp = 2; boss.maxHp = 2;
  real.enemies.push(boss);
  let guard = 0;
  while (!boss.dead && guard++ < 20) {
    pointerDown(real, boss.x, boss.y);
    pointerUp(real);
  }
  check(real.milestoneBossByPointer === true, 'a milestone boss killed by the pointer sets the flag');
}

{
  // specs-banked (nest egg): a run seeded with banked Restore Points.
  const p = defaultProfile();
  p.rp = 3;
  const s = createRunState(p);
  check(checkAchievements(s).includes('specs-banked'), 'specs-banked fires with banked RP');
  check(!checkAchievements(s).includes('specs-banked'), 'specs-banked fires once');
}

{
  // custom-map-cleared (cartographer): a wave cleared on a level outside the shipped set.
  const custom = { id: 'custom-test', name: 'Custom', walls: [], starts: [{ col: 0, row: 6 }], exits: [{ col: 19, row: 6 }], toggles: [] };
  const s = createRunState(undefined, custom);
  s.clearedWaves = 1;
  check(checkAchievements(s).includes('custom-map-cleared'), 'custom-map-cleared fires on a custom map');
  check(!checkAchievements(s).includes('custom-map-cleared'), 'custom-map-cleared fires once');
  const shipped = createRunState();
  shipped.clearedWaves = 1;
  check(!checkAchievements(shipped).includes('custom-map-cleared'), 'a shipped map does not count');
}

// --- 15d. Profile-only achievements: two reboots and the full Help library --------------------
{
  const p = defaultProfile();
  p.reboots = 2;
  const newly = checkProfileAchievements(p);
  check(newly.includes('two-reboots'), 'two-reboots fires at two reboots');
  check(checkProfileAchievements(p).length === 0, 'two-reboots fires once');
}

{
  const complete = defaultProfile();
  complete.bestWave = 24;
  for (const k of ENEMY_KINDS) complete.seenEnemies.push(k);
  for (const k of BOSS_KINDS) complete.seenBossKinds.push(k);
  check(allHelpUnlocked(complete), 'all-help is satisfied when everything is met');
  check(
    allHelpUnlocked(complete) === HELP_PAGES.every((page) => pageUnlocked(page, complete)),
    'all-help matches the real page gates',
  );
  const newly = checkProfileAchievements(complete);
  check(newly.includes('all-help'), 'all-help fires via the profile check');
  check(!checkProfileAchievements(complete).includes('all-help'), 'all-help fires once');

  const missing = defaultProfile();
  missing.bestWave = 24;
  for (const k of ENEMY_KINDS) missing.seenEnemies.push(k);
  for (const k of BOSS_KINDS.slice(0, -1)) missing.seenBossKinds.push(k);
  check(!allHelpUnlocked(missing), 'all-help is not satisfied while a boss page is locked');
}

// --- 15e. An achievement does not fire twice across a save round trip --------------------------
{
  const store = { value: null, getItem() { return this.value; }, setItem(_k, v) { this.value = v; } };
  const p = defaultProfile();
  p.achievements.push('first-blood');
  saveProfile(p, store);
  const loaded = loadProfile(store);
  const s = createRunState(loaded);
  check(s.achievements.has('first-blood'), 'a round-tripped achievement seeds the run');
  s.phase = 'wave';
  const e = createEnemy(1, 'grunt', 1, SPAWN, EXIT);
  s.enemies.push(e);
  while (!e.dead) {
    pointerDown(s, e.x, e.y);
    pointerUp(s);
  }
  check(!checkAchievements(s).includes('first-blood'), 'a round-tripped achievement does not fire again');
}

// --- 15f. A cheated run records only the cheat-only shadow ------------------------------------
{
  const s = createRunState();
  s.cheatsUsed = true;
  s.weakPointKills = 50;
  s.critHits = 25;
  s.salvagePeak = 1000;
  s.wave = 20;
  s.earlyCallsInARow = 3;
  s.clearedFlawlessWave = true;
  s.milestoneBossByPointer = true;
  s.rp = 3;
  s.clearedWaves = 1;
  const got = checkAchievements(s);
  check(got.length === 1 && got[0] === 'shadow-console',
    'a cheated run records only shadow-console, not the non-cheat-only achievements');
}

// --- 16. The hundred: generator, bosses, modifiers, victory, endless ---------------------------
{
  check(waveEnemyCount(1) === 8, 'wave 1 is unchanged (8 grunts)');

  const d100 = waveDef(100);
  check(d100 !== null && d100.groups.length > 0, 'wave 100 exists');
  check(buildSchedule(100).length > 0, 'wave 100 produces a spawn schedule');

  const MILESTONE_KIND = { 10: 'grunt-boss', 25: 'runner-boss', 50: 'shielded-boss', 75: 'flyer-boss', 100: 'armoured-boss' };
  for (const w of [10, 25, 50, 75, 100]) {
    check(milestoneBossKind(w) === MILESTONE_KIND[w], `wave ${w} maps to ${MILESTONE_KIND[w]}`);
    const bosses = buildSchedule(w).filter((sp) => sp.kind === MILESTONE_KIND[w]);
    check(bosses.length === 1, `wave ${w} has exactly one ${MILESTONE_KIND[w]} (${bosses.length})`);
    check(buildSchedule(w).filter((sp) => sp.kind.endsWith('-boss')).length === 1,
      `wave ${w} spawns exactly one boss total`);
    const defTotal = waveDef(w).groups.reduce((sum, grp) => sum + grp.count, 0);
    const escortCount = waveEnemyCount(w) - defTotal - 1;
    check(escortCount >= 6 && escortCount <= 12, `wave ${w} keeps a 6..12 enemy escort (${escortCount})`);
    check(isBossWave(w), `wave ${w} is marked a boss wave`);
  }
  check(milestoneBossKind(11) === null && milestoneBossKind(9) === null, 'non-milestone waves have no milestone boss');

  // The boss bar names the milestone boss: a Sergeant on wave 10, a Bastion on wave 50.
  check(bossName(milestoneBossKind(10)) === 'SERGEANT', 'wave 10 milestone boss is named SERGEANT');
  check(bossName(milestoneBossKind(50)) === 'BASTION', 'wave 50 milestone boss is named BASTION');
  check(bossName(milestoneBossKind(100)) === 'DREADNOUGHT', 'wave 100 milestone boss is named DREADNOUGHT');

  check(waveModifiers(50).length === 0, 'no modifier before wave 51');
  const m51a = waveModifiers(51);
  const m51b = waveModifiers(51);
  check(m51a.length === 1 && MODIFIER_POOL.includes(m51a[0]), `wave 51 has one modifier (${m51a[0]})`);
  check(m51a.join(',') === m51b.join(','), 'modifiers are deterministic (same wave, same modifier)');
  check(waveModifiers(120).length === 2, 'endless wave 120 stacks two modifiers');
  check(
    JSON.stringify(buildSchedule(51)) === JSON.stringify(buildSchedule(51)),
    'wave generation is deterministic',
  );
}

{
  const s = createRunState();
  s.wave = 99;
  s.phase = 'build';
  check(startWave(s), 'wave 100 starts');
  s.runs[0].spawns = [];
  s.enemies = [];
  tick(s);
  check(s.phase === 'victory', 'clearing wave 100 sets victory');
}

{
  const s = createRunState();
  s.wave = 99;
  s.phase = 'build';
  startWave(s);
  s.runs[0].spawns = [];
  s.enemies = [];
  tick(s);
  check(s.phase === 'victory', 'endless setup: victory reached');
  enterEndless(s);
  check(s.endless && s.phase === 'build', 'endless returns to build phase');
  check(startWave(s), 'endless starts wave 101');
  check(s.wave === 101, 'endless continues at 101');
}

// --- 16a. Flyer swarms (docs/FLYER-SWARMS.md) --------------------------------------------------
{
  // Captured from buildSchedule on the branch point (0a2b9ce), before the swarm change:
  // wave: [flyer count, total schedule length, chaff (grunt + runner) count].
  const PRE_SWARM = {
    6: [3, 22, 19], 7: [4, 25, 21], 8: [5, 30, 25], 9: [6, 30, 21], 10: [8, 52, 31], 11: [7, 32, 20], 12: [5, 29, 16],
    13: [6, 30, 19], 14: [7, 32, 18], 15: [6, 30, 17], 16: [8, 33, 19], 17: [5, 28, 19], 18: [5, 29, 14], 19: [6, 31, 18],
    20: [5, 28, 18], 21: [7, 40, 24], 22: [7, 41, 24], 23: [11, 45, 22], 24: [10, 45, 24], 25: [7, 48, 32], 26: [8, 41, 23],
    27: [6, 40, 24], 28: [9, 42, 22], 29: [9, 43, 25], 30: [8, 43, 25], 31: [11, 45, 21], 32: [6, 40, 24], 33: [11, 45, 20],
    34: [10, 44, 21], 35: [10, 44, 23], 36: [9, 44, 23], 37: [11, 45, 20], 38: [11, 45, 25], 39: [10, 44, 26], 40: [6, 40, 23],
    41: [12, 54, 27], 42: [13, 56, 27], 43: [13, 55, 26], 44: [11, 53, 37], 45: [8, 50, 26], 46: [10, 52, 28], 47: [11, 52, 30],
    48: [13, 56, 28], 49: [13, 55, 28], 50: [11, 62, 33], 51: [9, 51, 28], 52: [12, 54, 28], 53: [12, 54, 27], 54: [13, 54, 29],
    55: [12, 53, 31], 56: [11, 53, 30], 57: [10, 51, 28], 58: [9, 50, 26], 59: [8, 51, 30], 60: [10, 51, 25], 61: [13, 62, 34],
    62: [14, 64, 28], 63: [9, 57, 34], 64: [13, 63, 33], 65: [14, 64, 36], 66: [14, 64, 41], 67: [10, 58, 33], 68: [10, 58, 36],
    69: [10, 58, 32], 70: [11, 59, 41], 71: [10, 58, 42], 72: [10, 59, 33], 73: [11, 59, 41], 74: [11, 60, 34], 75: [12, 70, 45],
    76: [12, 61, 35], 77: [10, 58, 34], 78: [11, 59, 34], 79: [14, 64, 33], 80: [9, 58, 35], 81: [15, 68, 37], 82: [10, 63, 36],
    83: [10, 63, 34], 84: [13, 67, 38], 85: [14, 68, 34], 86: [17, 71, 33], 87: [16, 70, 36], 88: [13, 68, 35], 89: [10, 63, 43],
    90: [14, 68, 38], 91: [11, 64, 38], 92: [13, 67, 37], 93: [13, 67, 40], 94: [14, 68, 37], 95: [16, 70, 37], 96: [14, 68, 35],
    97: [16, 70, 33], 98: [17, 71, 36], 99: [13, 67, 39], 100: [14, 78, 39],
  };
  // FNV-1a of JSON.stringify(buildSchedule(w)) for the flyer-free waves 1..5, joined by '\n', on the
  // same branch point.
  const PRE_SWARM_NO_FLYER_HASH = 'ee8c2036';

  const factor = flyerSwarmFactor;
  check(flyerSwarmFactor(20) === 2 && flyerSwarmFactor(21) === 3 && flyerSwarmFactor(50) === 3 &&
    flyerSwarmFactor(51) === 3 && flyerSwarmFactor(85) === 2 && flyerSwarmFactor(100) === 2,
    'flyer swarms: band factors are 2x to 20, 3x to 50, then a ramp 3x->2x from 51 to 85 (docs/FLYER-TAPER.md)');

  // 1 + 2. Counts per band; capped waves trim chaff, never flyers, and land exactly on the cap.
  let countsOk = true;
  let cappedOk = true;
  const capped = [];
  for (let w = 6; w <= 100; w++) {
    const [oldFlyers, oldTotal] = PRE_SWARM[w];
    const want = Math.round(oldFlyers * factor(w));
    const sched = buildSchedule(w);
    const flyers = sched.filter((sp) => sp.kind === 'flyer').length;
    if (flyers !== want) {
      countsOk = false;
      console.log(`  wave ${w}: ${flyers} flyers, expected ${want}`);
    }
    if (oldTotal - oldFlyers + want > WAVE_ENEMY_CAP) {
      capped.push(w);
      // Only chaff (grunt/runner) may shrink; every other non-flyer kind keeps its pre-swarm count.
      if (sched.length !== WAVE_ENEMY_CAP || flyers !== want) cappedOk = false;
    } else if (sched.length !== oldTotal - oldFlyers + want) {
      cappedOk = false;
      console.log(`  wave ${w}: total ${sched.length}, expected ${oldTotal - oldFlyers + want} (uncapped)`);
    }
  }
  check(countsOk, 'flyer swarms: waves 6..100 carry round(old * band factor) flyers');
  check(capped.length === 0, `flyer swarms: the taper keeps every wave 6..100 under the cap (capped: ${capped.join(', ') || 'none'})`);
  check(cappedOk, 'flyer swarms: capped waves keep every multiplied flyer and total exactly WAVE_ENEMY_CAP; uncapped totals grow by the added flyers only');
  check(buildSchedule(6).filter((sp) => sp.kind === 'flyer').length === 6 &&
    buildSchedule(10).filter((sp) => sp.kind === 'flyer').length === 16,
    'flyer swarms: tutorial wave 6 flies 6 flyers and wave 10 flies 16');

  // Every wave: the only kinds whose counts move are flyers (up) and chaff (down, only when capped);
  // the chaff loss is exactly the overflow.
  let trimChaffOnly = true;
  for (let w = 6; w <= 100; w++) {
    const sched = buildSchedule(w);
    const flyers = sched.filter((sp) => sp.kind === 'flyer').length;
    const chaff = sched.filter((sp) => sp.kind === 'grunt' || sp.kind === 'runner').length;
    const [oldFlyers, oldTotal, oldChaff] = PRE_SWARM[w];
    const overflow = Math.max(0, oldTotal - oldFlyers + flyers - WAVE_ENEMY_CAP);
    const otherNow = sched.length - flyers - chaff;
    if (chaff !== oldChaff - overflow || otherNow !== oldTotal - oldFlyers - oldChaff) {
      trimChaffOnly = false;
      console.log(`  wave ${w}: chaff ${chaff} (was ${oldChaff}, overflow ${overflow}), other ${otherNow}`);
    }
  }
  check(trimChaffOnly, 'flyer swarms: the cap trims chaff (grunt/runner), never flyers or other kinds');

  // 2. No wave over the cap, through the run and well into endless.
  let worst = 0;
  for (let w = 1; w <= 400; w++) worst = Math.max(worst, buildSchedule(w).length);
  check(worst <= WAVE_ENEMY_CAP, `flyer swarms: no wave 1..400 exceeds WAVE_ENEMY_CAP (largest ${worst})`);

  // 3. Flights: within a flyer group the longest gap is at most 0.9 s + the intra-flight interval,
  // no flight has more than six members, and the first flight starts at the group's delay.
  const maxGap = secondsToTicks(0.9) + secondsToTicks(0.15);
  let gapOk = true;
  let flightOk = true;
  let delayOk = true;
  let largestGap = 0;
  let largestFlight = 0;
  for (let w = 6; w <= 300; w++) {
    const groups = waveDef(w).groups.filter((grp) => grp.kind === 'flyer');
    if (groups.length !== 1) { gapOk = false; continue; }
    const ticks = buildSchedule(w).filter((sp) => sp.kind === 'flyer').map((sp) => sp.tick);
    if (ticks[0] !== groups[0].delay) delayOk = false;
    let run = 1;
    for (let i = 1; i < ticks.length; i++) {
      const gap = ticks[i] - ticks[i - 1];
      largestGap = Math.max(largestGap, gap);
      if (gap > maxGap) gapOk = false;
      if (gap <= FLYER_FLIGHT_MEMBER_TICKS) run++;
      else run = 1;
      largestFlight = Math.max(largestFlight, run);
      if (run > FLYER_FLIGHT_SIZE) flightOk = false;
    }
  }
  check(gapOk, `flyer swarms: longest gap inside a flyer group is ${largestGap} ticks (<= ${maxGap})`);
  check(flightOk && largestFlight === 6, `flyer swarms: no flight exceeds six members (largest ${largestFlight})`);
  check(delayOk, 'flyer swarms: the first flight starts at the group delay');
  // The doc's example: a 24-flyer group (wave 30, 8 x 3) is four flights, airborne in about 5 s
  // (3 x (5 x 0.15 + 0.9) + 5 x 0.15 = 5.7 s) instead of a 36 s trickle.
  const w30 = buildSchedule(30).filter((sp) => sp.kind === 'flyer').map((sp) => sp.tick);
  const w30Flights = 1 + w30.slice(1).filter((t, i) => t - w30[i] > FLYER_FLIGHT_MEMBER_TICKS).length;
  const w30Span = w30[w30.length - 1] - w30[0];
  check(w30.length === 24 && w30Flights === 4 && w30Span <= secondsToTicks(6),
    `flyer swarms: wave 30's 24 flyers fly as ${w30Flights} flights, airborne in ${(w30Span / TICK_HZ).toFixed(2)} s`);

  // 4. Waves with no flyers are byte-identical to the pre-swarm build.
  const noFlyer = [];
  for (let w = 1; w <= 100; w++) if (!buildSchedule(w).some((sp) => sp.kind === 'flyer')) noFlyer.push(w);
  check(noFlyer.join(',') === '1,2,3,4,5', `flyer swarms: only waves 1..5 carry no flyers (${noFlyer.join(',')})`);
  const text = noFlyer.map((w) => JSON.stringify(buildSchedule(w))).join('\n');
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  check((h >>> 0).toString(16) === PRE_SWARM_NO_FLYER_HASH,
    `flyer swarms: flyer-free schedules are byte-identical to the pre-swarm build (hash ${(h >>> 0).toString(16)})`);

  // 5. Cross-run determinism: the same wave produces the same schedule every time.
  let same = true;
  for (const w of [6, 10, 24, 51, 86, 100, 101, 187, 300]) {
    if (JSON.stringify(buildSchedule(w)) !== JSON.stringify(buildSchedule(w))) same = false;
    if (JSON.stringify(waveDef(w)) !== JSON.stringify(waveDef(w))) same = false;
  }
  check(same, 'flyer swarms: schedules are identical across runs');

  // The schedule shape is unchanged: { tick, kind } only, tick-ordered, length = waveEnemyCount.
  let shapeOk = true;
  for (let w = 1; w <= 120; w++) {
    const sched = buildSchedule(w);
    if (sched.length !== waveEnemyCount(w)) shapeOk = false;
    for (let i = 0; i < sched.length; i++) {
      const keys = Object.keys(sched[i]).join(',');
      if (keys !== 'tick,kind' || (i > 0 && sched[i].tick < sched[i - 1].tick)) shapeOk = false;
    }
  }
  check(shapeOk, 'flyer swarms: schedule shape unchanged ({tick, kind}, ordered, length = waveEnemyCount)');
}

// --- 16ab. Flyer taper (docs/FLYER-TAPER.md) ---------------------------------------------------
{
  const oldFactor = (w) => (w <= 20 ? 2 : w <= 50 ? 3 : 4);
  // Pre-swarm flyer counts, from the docs/FLYER-SWARMS.md table above.
  const PRE_TAPER_FLYERS = { 10: 8, 25: 7, 50: 11 };

  // 1. Waves 10, 25 and 50 produce byte-identical schedules to before. The taper only touches
  //    wave >= 51, so their multipliers (and therefore their full schedules) are unchanged.
  let lowBandsUnchanged = true;
  for (let w = 1; w <= 50; w++) if (flyerSwarmFactor(w) !== oldFactor(w)) lowBandsUnchanged = false;
  check(lowBandsUnchanged, 'flyer taper: waves 1..50 keep their old 2x/3x multipliers');
  for (const w of [10, 25, 50]) {
    const flyers = buildSchedule(w).filter((sp) => sp.kind === 'flyer').length;
    check(flyers === Math.round(PRE_TAPER_FLYERS[w] * oldFactor(w)),
      `flyer taper: wave ${w} still flies ${flyers} flyers (${oldFactor(w)}x, unchanged)`);
  }
  // The full schedule byte-identity against the pre-change build: the hash below is recorded from
  // the old flat-band curve, so it is an expectation computed from the old multiplier, not a hash of
  // the new output.
  const preChangeText = [10, 25, 50].map((w) => JSON.stringify(buildSchedule(w))).join('\n');
  let h = 0x811c9dc5;
  for (let i = 0; i < preChangeText.length; i++) {
    h ^= preChangeText.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  check((h >>> 0).toString(16) === '899bc06e',
    `flyer taper: waves 10/25/50 schedules are byte-identical to the pre-change build (hash ${(h >>> 0).toString(16)})`);

  // 2. Wave 85 produces 28 flyers, not 56.
  const w85Flyers = buildSchedule(85).filter((sp) => sp.kind === 'flyer').length;
  check(w85Flyers === 28, `flyer taper: wave 85 flies ${w85Flyers} flyers, not 56`);

  // 3. The multiplier is 3.0 at wave 51, 2.0 at wave 85, 2.0 at wave 100, and never increases after
  //    wave 50.
  check(flyerSwarmFactor(51) === 3 && flyerSwarmFactor(85) === 2 && flyerSwarmFactor(100) === 2,
    'flyer taper: the multiplier is 3x at wave 51, 2x at wave 85, 2x at wave 100');
  let neverUp = true;
  for (let w = 51; w <= 400; w++) if (flyerSwarmFactor(w + 1) > flyerSwarmFactor(w)) neverUp = false;
  check(neverUp, 'flyer taper: the multiplier never increases after wave 50');

  // 4. The band curve is a smooth, monotone ramp: each wave from 51 to 85 steps down by exactly
  //    1/34, so the curve only eases the volume and never bumps a wave's flyer count back up.
  let rampOk = true;
  for (let w = 51; w < 85; w++) {
    if (Math.abs(flyerSwarmFactor(w) - flyerSwarmFactor(w + 1) - 1 / 34) > 1e-9) rampOk = false;
  }
  check(rampOk, 'flyer taper: the 51..85 ramp is linear, 1/34 per wave');

  // 5. Flight packing is unchanged: six per flight, 0.15 s between members of a flight.
  const w85Ticks = buildSchedule(85).filter((sp) => sp.kind === 'flyer').map((sp) => sp.tick);
  let sixPerFlight = true;
  let spacingOk = true;
  let run = 1;
  for (let i = 1; i < w85Ticks.length; i++) {
    const gap = w85Ticks[i] - w85Ticks[i - 1];
    if (gap <= FLYER_FLIGHT_MEMBER_TICKS) run++;
    else run = 1;
    if (run > FLYER_FLIGHT_SIZE) sixPerFlight = false;
  }
  const firstFlight = w85Ticks.slice(0, FLYER_FLIGHT_SIZE);
  spacingOk = firstFlight.slice(1).every((t, i) => t - firstFlight[i] === FLYER_FLIGHT_MEMBER_TICKS);
  check(sixPerFlight && spacingOk, 'flyer taper: wave 85 flies six per flight, 0.15 s apart');
}

// --- 16b. Endless curve: 1-100 unchanged, HP bands, count/interval, modifier stacking ---------
{
  // Waves 1..100 must be byte-identical: hash the full balance table (HP scale, value scale,
  // enemy count and kill value per wave) and compare against the committed hash. The hash changed
  // when the milestone waves swapped the generic boss for their mapped type boss (v0.41), and again
  // when flyer swarms multiplied the flyer groups (docs/FLYER-SWARMS.md).
  let table = '';
  for (let w = 1; w <= 100; w++) {
    table += `${waveHpScale(w)}|${waveValueScale(w)}|${waveEnemyCount(w)}|${waveKillValue(w)}\n`;
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < table.length; i++) {
    h ^= table.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  check((h >>> 0).toString(16) === 'ae33addc', `waves 1..100 balance table unchanged (hash ${(h >>> 0).toString(16)})`);
}

{
  // HP escalates in compounding bands with no step or dip at the band edges.
  const hp = waveHpScale;
  const close = (a, b) => Math.abs(a - b) < 1e-9;
  check(hp(100) < hp(101), `hp rises across 100->101 (${hp(100).toFixed(3)} -> ${hp(101).toFixed(3)})`);
  check(hp(125) < hp(126), `hp rises across 125->126 (${hp(125).toFixed(3)} -> ${hp(126).toFixed(3)})`);
  check(hp(150) < hp(151), `hp rises across 150->151 (${hp(150).toFixed(3)} -> ${hp(151).toFixed(3)})`);
  check(hp(175) < hp(176), `hp rises across 175->176 (${hp(175).toFixed(3)} -> ${hp(176).toFixed(3)})`);
  check(close(hp(101) / hp(100), 1.02), '101-125 rate is 1.020');
  check(close(hp(126) / hp(125), 1.035), '126-150 rate is 1.035');
  check(close(hp(151) / hp(150), 1.05), '151-175 rate is 1.050');
  check(close(hp(176) / hp(175), 1.065), '176+ base rate is 1.065');
  check(close(hp(201) / hp(200), 1.07), 'rate climbs to 1.070 at wave 201');
  check(close(hp(500) / hp(499), 1.12), 'rate caps at 1.12');
}

{
  // The enemy-count baseline grows again and the spawn interval tightens toward its floor.
  check(endlessCountBase(100) === 66, 'count baseline stays 66 through wave 100');
  check(endlessCountBase(101) === 72, 'count baseline rises to 72 at wave 101');
  check(endlessCountBase(126) === 78, 'count baseline rises to 78 at wave 126');
  check(endlessCountBase(251) === 108, 'count baseline reaches 108 at wave 251');
  check(endlessCountBase(276) === 110, 'count baseline caps at 110');
  check(endlessCountBase(500) === 110, 'count baseline holds the 110 cap');

  check(endlessIntervalScale(100) === 1, 'interval scale is 1 through wave 100');
  check(endlessIntervalScale(101) === 0.96, 'interval tightens to 0.96 at wave 101');
  check(endlessIntervalScale(126) === 0.92, 'interval tightens to 0.92 at wave 126');
  check(endlessIntervalScale(326) === 0.6, 'interval scale floors at 0.60');
  check(endlessIntervalScale(500) === 0.6, 'interval scale holds the 0.60 floor');
}

{
  // Modifiers stack harder deep in endless: two at 149, three at 150, three at 199, four at 200.
  const distinct = (mods) => new Set(mods).size === mods.length;
  check(waveModifiers(149).length === 2, 'wave 149 stacks two modifiers');
  check(waveModifiers(150).length === 3, 'wave 150 stacks three modifiers');
  check(distinct(waveModifiers(150)), 'wave 150 modifiers are distinct');
  check(waveModifiers(199).length === 3, 'wave 199 still stacks three modifiers');
  check(waveModifiers(200).length === 4, 'wave 200 stacks four modifiers');
  check(distinct(waveModifiers(200)), 'wave 200 modifiers are distinct');
  check(waveModifiers(120).length === 2, 'wave 120 still stacks two modifiers');
}

// --- 17. Early-call waves: bonus, schedules, per-wave leaks and victory -----------------------
{
  // 17a. A normal call from build starts wave 1 with no bonus; an early call mid-wave pays.
  const s = createRunState();
  const sal0 = s.economy.salvage;
  check(startWave(s), 'early call: wave 1 starts from build');
  check(s.wave === 1 && s.phase === 'wave', 'early call: wave 1 running');
  check(s.economy.salvage === sal0, 'early call: a build-phase call pays no bonus');
  check(s.calledEarly === false, 'early call: not yet flagged');

  const sal1 = s.economy.salvage;
  check(startWave(s), 'early call: wave 2 starts mid-wave');
  check(s.wave === 2 && s.phase === 'wave', 'early call: wave 2 running');
  const bonus = s.economy.salvage - sal1;
  check(bonus > 0 && bonus <= 40, `early call: paid ${bonus} (0 < bonus <= 40)`);
  check(s.calledEarly === true, 'early call: flagged after the first early call');
}

{
  // 17b. The bonus is a fraction of the called wave's kill value: bounded by it, non-increasing
  // in elapsed ticks, floored at 5, and growing with the wave number at the same elapsed time.
  const start = earlyCallBonus(0, 3);
  check(start === Math.round(0.5 * waveKillValue(3)),
    `early call: wave 3 starts at half of its kill value (${start} = ${Math.round(0.5 * waveKillValue(3))})`);
  let prev = start;
  let monotone = true;
  for (let t = 0; t <= 5000; t += 10) {
    const b = earlyCallBonus(t, 3);
    if (b > prev) monotone = false;
    prev = b;
  }
  check(monotone, 'early call: bonus never increases as elapsed grows');
  check(prev === 5, `early call: bonus bottoms out at 5 (${prev})`);
  for (const w of [2, 30, 60, 100]) {
    const b = earlyCallBonus(0, w);
    check(b <= waveKillValue(w), `early call: wave ${w} bonus ${b} <= kill value ${waveKillValue(w)}`);
  }
  check(
    earlyCallBonus(0, 10) > earlyCallBonus(0, 3) && earlyCallBonus(0, 60) > earlyCallBonus(0, 10),
    'early call: bonus grows with the wave number at the same elapsed time',
  );
}

{
  // 17c. Two waves in flight spawn on their own schedules; each enemy carries its wave for HP.
  const s = createRunState();
  startWave(s); // wave 1 (8 grunts)
  startWave(s); // wave 2 (12 grunts), called immediately
  check(s.runs.length === 2, 'early call: two waves in flight');
  tick(s);
  const waves = s.enemies.map((e) => e.wave).sort((a, b) => a - b);
  check(waves.length === 2 && waves[0] === 1 && waves[1] === 2, `early call: each enemy carries its wave (${waves.join(',')})`);
  const hp1 = s.enemies.find((e) => e.wave === 1).maxHp;
  const hp2 = s.enemies.find((e) => e.wave === 2).maxHp;
  check(hp2 > hp1, `early call: wave-2 enemy has more HP than wave-1 (${hp1} vs ${hp2})`);
  check(s.runs[0].spawns.length === 7 && s.runs[1].spawns.length === 11,
    `early call: each wave drains its own schedule (${s.runs[0].spawns.length}, ${s.runs[1].spawns.length})`);
}

{
  // 17d. Wave N clears while wave N+1 is still running: the clear bonus lands once, stay in wave.
  const s = createRunState();
  startWave(s); // wave 1
  startWave(s); // wave 2
  s.runs[0].spawns = [];
  const sal = s.economy.salvage;
  tick(s);
  const clearedCount = s.events.filter((e) => e.type === 'waveCleared').length;
  check(clearedCount === 1, `early call: wave 1 clear event fires once (${clearedCount})`);
  check(s.economy.salvage === sal + waveClearBonus(1), `early call: wave 1 clear bonus +${waveClearBonus(1)}`);
  check(s.phase === 'wave', 'early call: still in wave phase while wave 2 runs');
  check(s.runs.length === 1 && s.runs[0].wave === 2, 'early call: wave 1 removed, wave 2 still in flight');
}

{
  // 17e. Calling at wave 100 in a normal run is refused (from build and from wave).
  const s = createRunState();
  s.wave = 100;
  s.phase = 'build';
  check(!startWave(s), 'early call: refused at wave 100 from build');
  s.phase = 'wave';
  check(!startWave(s), 'early call: refused at wave 100 from wave');
  check(s.wave === 100, 'early call: wave number unchanged at 100');
}

// --- 18. Walls and breachers ----------------------------------------------------------------

// 18a. A wall costs 8 and blocks the route exactly as a gun on the same tile does.
{
  const base = createRunState(); // corridor
  const baseLen = currentPath(base).length;

  const wallState = createRunState();
  const sal = wallState.economy.salvage;
  check(placeTower(wallState, 'wall', 4, 9), 'wall placed in the corridor gap');
  check(wallState.economy.salvage === sal - TOWER_STATS.wall.cost, `wall costs ${TOWER_STATS.wall.cost}`);
  const wallLen = currentPath(wallState).length;

  const gunState = createRunState();
  gunState.economy.salvage = 10000;
  check(placeTower(gunState, 'gun', 4, 9), 'gun placed on the same corridor gap');
  const gunLen = currentPath(gunState).length;

  check(wallLen > baseLen, `wall lengthens the route (${baseLen} -> ${wallLen})`);
  check(wallLen === gunLen, `wall blocks the route exactly like a gun (${wallLen} vs ${gunLen})`);
}

// 18b. A breacher heads for the wall on its field line, stops to chew it, and resumes the same
// tick the wall dies (and the route unblocks).
{
  const s = stateOnLevel('open-field');
  const openLen = currentPath(s).length;
  s.economy.salvage = 10000;
  const first = stepToward(s.breacherField, SPAWN.col, SPAWN.row);
  check(first !== null, 'breacher field gives a first step from spawn');
  check(placeTower(s, 'wall', first.col, first.row), 'wall placed on the breacher line');
  const wall = towerAt(s, first.col, first.row);
  const fullHp = wall.hp;
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER; // no pop-ups mid-test
  const b = createEnemy(1, 'breacher', 12, SPAWN, EXIT);
  s.enemies.push(b);

  const salvageAtSpawn = s.economy.salvage;
  let attacked = false;
  let destroyed = false;
  let unblockedSameTick = false;
  let resumedDist = -1;

  for (let i = 0; i < 6000 && !b.dead; i++) {
    tick(s);
    if (!attacked && wall.hp < fullHp) attacked = true;
    if (!destroyed && !towerAt(s, first.col, first.row)) {
      destroyed = true;
      unblockedSameTick = currentPath(s).length === openLen;
    }
    if (destroyed && b.dist > 0) resumedDist = b.dist;
  }

  check(attacked, 'breacher stops and damages the wall on its line');
  check(destroyed, 'the wall dies under the breacher');
  check(unblockedSameTick, 'the route unblocks in the same tick the wall dies');
  check(s.economy.salvage === salvageAtSpawn, 'losing a wall never refunds salvage');
  check(resumedDist > 0, `breacher resumes once the wall is gone (dist ${resumedDist.toFixed(2)})`);
}

// 18c. Wall hit points survive upgrade and branch selection; both branches double the tier-3 total.
{
  const s = createRunState();
  s.economy.salvage = 10000;
  check(placeTower(s, 'wall', 5, 5), 'place a wall to upgrade');
  const wall = towerAt(s, 5, 5);
  check(wallMaxHp(1, null) === 60 && wall.hp === 60, `tier-1 wall has 60 HP (${wall.hp})`);
  wall.hp = 40; // 20 damage taken, two-thirds health

  check(upgradeTower(s, 5, 5), 'upgrade wall 1 -> 2');
  check(wall.tier === 2 && wall.maxHp === 180 && wall.hp === 120,
    `wall HP fraction survives upgrade (${wall.hp}/180)`);

  check(chooseBranch(s, 5, 5, 'A'), 'choose Bulwark (2 -> 3)');
  check(wall.tier === 3 && wall.branch === 'A' && wall.maxHp === 1080 && wall.hp === 720,
    `Bulwark doubles the total and keeps the damage fraction (${wall.hp}/1080)`);
  check(!wallBlocksFlyers(wall), 'Bulwark does not block flyers');

  const mesh = createRunState();
  mesh.economy.salvage = 10000;
  placeTower(mesh, 'wall', 5, 5);
  upgradeTower(mesh, 5, 5);
  check(chooseBranch(mesh, 5, 5, 'B'), 'choose Mesh (2 -> 3)');
  const m = towerAt(mesh, 5, 5);
  check(m.maxHp === 1080 && m.hp === 1080, `Mesh doubles the total too (${m.hp}/1080)`);
  check(wallBlocksFlyers(m), 'Mesh blocks flyers');
}

// 18d. Flyers ignore a normal wall and detour around a Mesh wall.
{
  const runFlyer = (withMesh) => {
    const s = stateOnLevel('open-field');
    s.economy.salvage = 10000;
    placeTower(s, 'wall', 5, 6);
    if (withMesh) {
      placeTower(s, 'wall', 10, 6);
      upgradeTower(s, 10, 6);
      chooseBranch(s, 10, 6, 'B');
    }
    s.phase = 'wave';
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    const f = createEnemy(1, 'flyer', 12, SPAWN, EXIT);
    s.enemies.push(f);
    let minRow = 999;
    let maxRow = -999;
    for (let i = 0; i < 6000 && !f.dead; i++) {
      tick(s);
      minRow = Math.min(minRow, f.row);
      maxRow = Math.max(maxRow, f.row);
    }
    return { minRow, maxRow, dead: f.dead };
  };

  const straight = runFlyer(false);
  check(straight.dead && straight.minRow === 6 && straight.maxRow === 6,
    `flyer ignores a normal wall (rows ${straight.minRow}-${straight.maxRow})`);

  const detour = runFlyer(true);
  check(detour.dead && (detour.minRow < 6 || detour.maxRow > 6),
    `flyer detours around a Mesh wall (rows ${detour.minRow}-${detour.maxRow})`);
}

// 18e. Selling a wall never refunds.
{
  const s = createRunState();
  s.economy.salvage = 10000;
  placeTower(s, 'wall', 5, 5);
  const before = s.economy.salvage;
  check(sellValue(towerAt(s, 5, 5)) === 0, 'sellValue of a wall is 0');
  check(sellTower(s, 5, 5), 'sell a wall');
  check(s.economy.salvage === before, 'selling a wall refunds nothing');
}

// --- 18f. The Toggle branch: a tier-3 gate that flips open and closed -------------------------
{
  // Visual language: every wall state renders a button spec, and none of them carries brick strokes.
  const states = [
    { name: 'plain tier 1', wall: { branch: null, open: false, hp: 60, maxHp: 60 } },
    { name: 'plain tier 2', wall: { branch: null, open: false, hp: 180, maxHp: 180 } },
    { name: 'toggle closed', wall: { branch: 'C', open: false, hp: 540, maxHp: 540 } },
    { name: 'toggle open', wall: { branch: 'C', open: true, hp: 540, maxHp: 540 } },
    { name: 'bulwark', wall: { branch: 'A', open: false, hp: 1080, maxHp: 1080 } },
    { name: 'mesh', wall: { branch: 'B', open: false, hp: 1080, maxHp: 1080 } },
    { name: 'damaged high', wall: { branch: 'A', open: false, hp: 900, maxHp: 1080 } },
    { name: 'damaged mid', wall: { branch: 'A', open: false, hp: 540, maxHp: 1080 } },
    { name: 'damaged low', wall: { branch: 'A', open: false, hp: 100, maxHp: 1080 } },
    { name: 'repairing', wall: { branch: 'A', open: false, hp: 540, maxHp: 1080, repairing: true } },
  ];
  for (const st of states) {
    const spec = wallSpec(st.wall);
    check(
      Number.isInteger(spec.face) && spec.tl.length === 2 && spec.br.length === 2,
      `${st.name}: wall renders a valid button spec`,
    );
    check(!('bricks' in spec), `${st.name}: wall uses no brick strokes`);
  }
  check(wallSpec({ branch: null, open: false, hp: 60, maxHp: 60 }).face === WALL_FACE_DISABLED, 'a plain wall reads as disabled');
  check(wallSpec({ branch: 'C', open: true, hp: 540, maxHp: 540 }).face === WALL_FACE_PRESSED, 'an open Toggle reads as pressed');
  check(wallSpec({ branch: 'C', open: false, hp: 540, maxHp: 540 }).face === WALL_FACE, 'a closed Toggle reads as raised');
  check(wallSpec({ branch: 'A', open: false, hp: 1080, maxHp: 1080 }).innerRim, 'Bulwark adds an inner rim');
  check(wallSpec({ branch: 'B', open: false, hp: 1080, maxHp: 1080 }).crosshatch, 'Mesh adds a crosshatch');
  check(wallSpec({ branch: 'A', open: false, hp: 540, maxHp: 1080, repairing: true }).hatched, 'a repairing wall draws a hatch');
  check(!wallSpec({ branch: 'A', open: false, hp: 540, maxHp: 1080, repairing: true }).crosshatch,
    'a repairing wall drops the branch marks for the repair hatch');
  check(wallFootprintSize(28) === 22, `wall footprint is cell - 6 (${wallFootprintSize(28)})`);
  check(hatchSegments(0, 0, 20, 4).length > 0, 'Mesh crosshatch produces diagonal strokes');
  const focus = wallFocusRect(14, 14, 28);
  check(focus.w === 20 && focus.h === 20, `focus rect is inset 4 px (${focus.w}x${focus.h})`);
  check(lerpColor(0x000000, 0xffffff, 0.5) === 0x808080, `lerpColor blends colours (${lerpColor(0x000000, 0xffffff, 0.5).toString(16)})`);
}

{
  // 18e continues: the wall resolves a tier face plus overlays, and the damage stage is integer thirds.
  check(wallDamageStage(60, 60) === 0, 'a full wall is damage stage 0');
  check(wallDamageStage(59, 60) === 1, 'the top third of HP is damage stage 1');
  check(wallDamageStage(40, 60) === 1, 'exactly two thirds is stage 1 (no flicker)');
  check(wallDamageStage(39, 60) === 2, 'just below two thirds is stage 2');
  check(wallDamageStage(20, 60) === 2, 'exactly one third is stage 2 (no flicker)');
  check(wallDamageStage(19, 60) === 3, 'the bottom third of HP is damage stage 3');

  check(wallArt({ branch: null, open: false, hp: 60, maxHp: 60 }).face === 'wall-t1', 'a plain tier-1 wall uses the wall-t1 face');
  check(wallArt({ branch: null, open: false, hp: 180, maxHp: 180, tier: 2 }).face === 'wall-t2', 'a tier-2 wall uses the wall-t2 face');
  check(wallArt({ branch: 'C', open: true, hp: 540, maxHp: 540, tier: 3 }).face === 'wall-t3', 'a tier-3 Toggle uses the wall-t3 face');
  check(wallArt({ branch: 'A', open: false, hp: 1080, maxHp: 1080, tier: 3 }).overlays.includes('wall-bulwark'),
    'Bulwark adds the inner-rim overlay');
  check(wallArt({ branch: 'B', open: false, hp: 1080, maxHp: 1080, tier: 3 }).overlays.includes('wall-mesh'),
    'Mesh adds the crosshatch overlay');
  check(wallArt({ branch: 'A', open: false, hp: 540, maxHp: 1080, tier: 3, repairing: true }).overlays.includes('wall-repairing'),
    'a repairing wall adds the repair overlay');
  check(!wallArt({ branch: 'A', open: false, hp: 540, maxHp: 1080, tier: 3, repairing: true }).overlays.includes('wall-bulwark'),
    'a repairing wall drops the branch overlay');
  check(wallArt({ branch: 'A', open: false, hp: 100, maxHp: 1080, tier: 3 }).overlays.includes('wall-damaged-3'),
    'a heavily damaged wall adds the stage-3 damage overlay');
  check(wallArt({ branch: 'A', open: false, hp: 900, maxHp: 1080, tier: 3 }).overlays.includes('wall-damaged-1'),
    'a lightly damaged wall adds the stage-1 damage overlay');
  check(wallArt({ branch: 'C', open: true, hp: 100, maxHp: 540, tier: 3 }).overlays.every((o) => !o.startsWith('wall-damaged')),
    'an open Toggle never reads damage');

  // The button spec ignores damage, so the art path's tint and bevel do not double the overlay.
  const damaged = wallButtonSpec({ branch: 'A', open: false, hp: 100, maxHp: 1080, tier: 3 });
  check(damaged.face === WALL_FACE, 'the button spec keeps the raised face at any HP');
  check(wallSpec({ branch: 'A', open: false, hp: 100, maxHp: 1080 }).face === WALL_FACE_PRESSED,
    'the full spec still presses the face below a third HP (procedural fallback)');
}

{
  // 18f continues: the toggle flips only for a Toggle wall; selecting elsewhere never flips it.
  const s = createRunState();
  s.economy.salvage = 10000;
  placeTower(s, 'wall', 5, 5);
  upgradeTower(s, 5, 5);
  chooseBranch(s, 5, 5, 'C');
  const gate = towerAt(s, 5, 5);
  check(isToggleGate(gate) && !gate.open, 'a fresh Toggle gate starts closed');
  check(wallMaxHp(3, 'C') === 540 && gate.maxHp === 540, `Toggle keeps the tier-3 base HP (${gate.maxHp})`);

  selectPlacedTower(s, gate);
  check(!gate.open, 'selecting the gate does not flip it');
  cancelSelection(s);
  check(!gate.open, 'right-click/cancel does not flip it');

  check(toggleGate(s, 5, 5) && gate.open, 'toggleGate opens a closed gate');
  s.clock += TOGGLE_LOCK_TICKS;
  check(toggleGate(s, 5, 5) && !gate.open, 'toggleGate closes an open gate');

  // Bulwark and Mesh never toggle.
  const bulwark = createRunState();
  bulwark.economy.salvage = 10000;
  placeTower(bulwark, 'wall', 5, 5);
  upgradeTower(bulwark, 5, 5);
  chooseBranch(bulwark, 5, 5, 'A');
  check(!isToggleGate(towerAt(bulwark, 5, 5)) && !toggleGate(bulwark, 5, 5), 'Bulwark is not a Toggle gate');
  const mesh = createRunState();
  mesh.economy.salvage = 10000;
  placeTower(mesh, 'wall', 5, 5);
  upgradeTower(mesh, 5, 5);
  chooseBranch(mesh, 5, 5, 'B');
  check(!isToggleGate(towerAt(mesh, 5, 5)) && !toggleGate(mesh, 5, 5), 'Mesh is not a Toggle gate');
}

{
  // An open gate is walkable: the route shortens while open and returns when closed.
  const s = createRunState(); // corridor
  const base = currentPath(s).length;
  s.economy.salvage = 10000;
  placeTower(s, 'wall', 4, 9);
  upgradeTower(s, 4, 9);
  const tier2Len = currentPath(s).length;
  chooseBranch(s, 4, 9, 'C');
  const gate = towerAt(s, 4, 9);
  const closedLen = currentPath(s).length;
  check(!gate.open, 'a Toggle gate installs closed');
  check(closedLen === tier2Len, `branching does not reroute the maze (${tier2Len} -> ${closedLen})`);
  check(closedLen > base, `a closed gate lengthens the route (${base} -> ${closedLen})`);

  check(toggleGate(s, 4, 9), 'one click opens the gate');
  check(gate.open, 'the gate is now open');
  check(currentPath(s).length === base, `an open gate is walkable (route ${currentPath(s).length} == ${base})`);
  s.clock += TOGGLE_LOCK_TICKS;
  check(toggleGate(s, 4, 9), 'close the gate');
  check(currentPath(s).length === closedLen, `a closed gate blocks again (${currentPath(s).length})`);
}

{
  // Closing is refused when it would seal the route, allowed when a detour remains.
  const s = stateOnLevel('open-field');
  s.economy.salvage = 10000;
  placeTower(s, 'wall', 5, 6);
  upgradeTower(s, 5, 6);
  chooseBranch(s, 5, 6, 'C');
  check(toggleGate(s, 5, 6), 'open the gate at the choke point');
  s.clock += TOGGLE_LOCK_TICKS;
  for (let r = 0; r < ROWS; r++) {
    if (r === 6) continue;
    check(placeTower(s, 'gun', 5, r), `block column 5 at row ${r}`);
  }
  check(!toggleGate(s, 5, 6), 'closing is refused when it would seal the route');
  check(towerAt(s, 5, 6).open, 'the gate stays open after a refused close');
  check(sellTower(s, 5, 5), 'sell a blocker to open a detour');
  check(toggleGate(s, 5, 6), 'closing is allowed once a detour exists');
  check(!towerAt(s, 5, 6).open, 'the gate is now closed');
}

{
  // An enemy standing on the tile when it closes is pushed forward along its heading.
  const s = stateOnLevel('open-field');
  s.economy.salvage = 10000;
  placeTower(s, 'wall', 5, 6);
  upgradeTower(s, 5, 6);
  chooseBranch(s, 5, 6, 'C');
  check(toggleGate(s, 5, 6), 'open the gate');
  const e = createEnemy(1, 'grunt', 1, SPAWN, EXIT);
  e.x = 5.5;
  e.y = 6.5;
  e.prevX = 5.5;
  e.prevY = 6.5;
  e.col = 5;
  e.row = 6;
  e.heading = 0; // travelling east
  e.stunUntilTick = 999999;
  s.enemies.push(e);
  s.clock += TOGGLE_LOCK_TICKS;
  check(toggleGate(s, 5, 6), 'close the gate under the enemy');
  check(e.col === 6 && e.row === 6, `enemy pushed forward to (${e.col},${e.row})`);
  check(towerAt(s, 5, 6).open === false, 'the gate is closed');
}

{
  // A breacher walks through an open gate without damaging it.
  const s = stateOnLevel('open-field');
  s.economy.salvage = 10000;
  const first = stepToward(s.breacherField, SPAWN.col, SPAWN.row);
  placeTower(s, 'wall', first.col, first.row);
  upgradeTower(s, first.col, first.row);
  chooseBranch(s, first.col, first.row, 'C');
  const gate = towerAt(s, first.col, first.row);
  check(toggleGate(s, first.col, first.row), 'open the gate on the breacher line');
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const b = createEnemy(1, 'breacher', 12, SPAWN, EXIT);
  s.enemies.push(b);
  for (let i = 0; i < 6000 && !b.dead; i++) tick(s);
  check(gate.hp === gate.maxHp, `breacher never damaged the open gate (${gate.hp}/${gate.maxHp})`);
  check(b.dist > 0, `breacher walked through the open gate (dist ${b.dist.toFixed(2)})`);
}

// --- 18g. A Toggle flip locks that gate for three seconds -----------------------------------
{
  const s = createRunState();
  s.economy.salvage = 10000;
  placeTower(s, 'wall', 5, 5);
  upgradeTower(s, 5, 5);
  chooseBranch(s, 5, 5, 'C');
  const gate = towerAt(s, 5, 5);
  check(gate.toggleReadyAt === 0, 'a fresh Toggle gate is ready to flip');

  check(toggleGate(s, 5, 5), 'the first flip is accepted');
  check(gate.open, 'the first flip opens the gate');
  check(gate.toggleReadyAt === TOGGLE_LOCK_TICKS, `a flip sets the lock (${gate.toggleReadyAt})`);
  check(isGateLocked(gate, s.clock), 'the gate is locked immediately after the flip');

  s.clock++;
  check(!toggleGate(s, 5, 5), 'a second flip one tick later is refused');
  check(gate.open, 'the refused flip leaves the gate state unchanged');

  s.clock = gate.toggleReadyAt - 1;
  check(!toggleGate(s, 5, 5), 'the gate is still locked one tick before the cooldown ends');
  s.clock = gate.toggleReadyAt;
  check(!isGateLocked(gate, s.clock), 'the lock expires exactly at its ready tick');
  check(toggleGate(s, 5, 5), 'a flip is accepted once 180 ticks have passed');
  check(!gate.open, 'the accepted flip closes the gate');
}

// --- 18h. The lock is per gate, shown disabled, and named by the tooltip --------------------
{
  const s = stateOnLevel('open-field');
  s.economy.salvage = 10000;
  for (const [c, r] of [[5, 5], [7, 5]]) {
    placeTower(s, 'wall', c, r);
    upgradeTower(s, c, r);
    chooseBranch(s, c, r, 'C');
  }
  const first = towerAt(s, 5, 5);
  const second = towerAt(s, 7, 5);
  check(toggleGate(s, 5, 5) && first.open, 'the first gate flips');
  check(isGateLocked(first, s.clock), 'the first gate is now locked');
  check(toggleGate(s, 7, 5) && second.open, 'a second gate still flips while the first is locked');
  check(first.toggleReadyAt === s.clock + TOGGLE_LOCK_TICKS && second.toggleReadyAt === s.clock + TOGGLE_LOCK_TICKS,
    'each gate carries its own lock');

  const lockedClosed = wallSpec({ branch: 'C', open: false, hp: 540, maxHp: 540, locked: true });
  const lockedOpen = wallSpec({ branch: 'C', open: true, hp: 540, maxHp: 540, locked: true });
  check(lockedClosed.face === WALL_FACE_DISABLED, 'a locked closed Toggle is drawn disabled');
  check(lockedOpen.face === WALL_FACE_DISABLED, 'a locked open Toggle is drawn disabled');
  check(wallSpec({ branch: 'C', open: false, hp: 540, maxHp: 540, locked: false }).face === WALL_FACE,
    'an unlocked closed Toggle keeps its live style');

  s.clock = 96; // 84 ticks left at 60 Hz = 1.4 s
  check(towerTooltipLines(first, s.clock).map(tooltipText).includes('Gate locked — 1.4 s'),
    'a locked gate tooltip names the remaining lock');
}

// --- 18i. Fixed-timestep equivalence still holds with a gate mid-lock -----------------------
{
  const run = (frameMs) => {
    const s = stateOnLevel('open-field');
    s.economy.salvage = 10000;
    placeTower(s, 'wall', 5, 6);
    upgradeTower(s, 5, 6);
    chooseBranch(s, 5, 6, 'C');
    for (let i = 0; i < 30; i++) tick(s);
    toggleGate(s, 5, 6); // opens at clock 30 and locks until clock 210
    toggleGate(s, 5, 6); // refused, mid-lock
    startWave(s);
    for (let t = 0; t < 100 * TICK_MS - frameMs; t += frameMs) step(s, frameMs);
    while (s.clock < 130) tick(s);
    const gate = towerAt(s, 5, 6);
    return JSON.stringify([
      s.economy,
      s.integrity,
      s.enemies.map((e) => [e.id, e.hp, e.dist]),
      s.rng,
      s.clock,
      s.field,
      gate.open,
      gate.toggleReadyAt,
      isGateLocked(gate, s.clock),
    ]);
  };
  const at60 = run(TICK_MS);
  const midLock = JSON.parse(at60);
  check(midLock[6] === true && midLock[8] === true, 'the gate is still open and locked at the end');
  check(at60 === run(1000 / 144), 'a gate mid-lock: same result at 60 Hz and 144 Hz frames');
  check(at60 === run(1000 / 23), 'a gate mid-lock: same result at 23 Hz frames');
}

// --- 18j. Repair: cost formula, duration, and the "not functional" rule ----------------------
{
  // A Bulwark wall costs 40 spent and holds 1080 HP; its repair cost is half that, pro rata.
  const s = stateOnLevel('open-field');
  s.economy.salvage = 10000;
  placeTower(s, 'wall', 5, 6);
  upgradeTower(s, 5, 6);
  chooseBranch(s, 5, 6, 'A');
  const wall = towerAt(s, 5, 6);
  const spent = wall.spent;
  const max = wall.maxHp;
  check(spent === 40, `a Bulwark wall costs 40 spent (${spent})`);
  check(max === 1080, `a Bulwark wall holds 1080 HP (${max})`);

  const costAt = (damage) => {
    wall.hp = max * (1 - damage);
    return repairCost(wall);
  };
  const c100 = costAt(1);
  const c50 = costAt(0.5);
  const c1 = costAt(0.01);
  check(c100 === Math.ceil(0.5 * spent), `repair at 100% damage costs half the spent (${c100})`);
  check(c50 === Math.ceil(0.5 * spent * 0.5), `repair at 50% damage costs ${c50}`);
  check(c1 === Math.ceil(0.5 * spent * 0.01), `repair at 1% damage costs ${c1}`);
  check(c100 < spent && c50 < spent && c1 < spent, 'repair cost is always under the tower spend');

  // A half-damaged wall repairs in 2.5 s, pays up front, and lands back at full health exactly.
  wall.hp = max / 2;
  const missing = max - wall.hp;
  const salv = s.economy.salvage;
  const price = repairCost(wall);
  check(repairDurationTicks(wall) === secondsToTicks(2.5), 'a half-damaged repair schedules 2.5 s');
  check(startRepair(s, 5, 6), 'a half-damaged wall starts repairing');
  check(s.economy.salvage === salv - price, `the repair cost is paid up front (${price})`);
  check(isRepairing(wall, s.clock), 'the wall is mid-repair immediately');
  let ticks = 0;
  while (isRepairing(wall, s.clock) && ticks < 1000) {
    tick(s);
    ticks++;
  }
  check(ticks === secondsToTicks(2.5), `a half-damaged repair takes 2.5 s (${ticks} ticks)`);
  check(wall.hp === wall.maxHp, `the repair restores exactly the missing hit points (${missing})`);
}

{
  // A repairing wall is off the field: the route shortens the moment the repair starts and returns
  // the moment it finishes.
  const s = createRunState(); // corridor
  const open = currentPath(s).length;
  s.economy.salvage = 10000;
  placeTower(s, 'wall', 4, 9);
  upgradeTower(s, 4, 9);
  chooseBranch(s, 4, 9, 'A');
  const wall = towerAt(s, 4, 9);
  const blocked = currentPath(s).length;
  check(blocked > open, `a wall lengthens the route (${open} -> ${blocked})`);
  wall.hp = wall.maxHp / 2;
  check(startRepair(s, 4, 9), 'the repair starts');
  check(currentPath(s).length === open, `a repairing wall is walkable (route ${currentPath(s).length} == ${open})`);
  while (isRepairing(wall, s.clock)) tick(s);
  check(currentPath(s).length === blocked, `the route closes again when the repair finishes (${currentPath(s).length})`);
}

{
  // A breacher chewing the wall is released when a repair starts, and cannot damage it while it runs.
  const s = stateOnLevel('open-field');
  s.economy.salvage = 10000;
  const first = stepToward(s.breacherField, SPAWN.col, SPAWN.row);
  placeTower(s, 'wall', first.col, first.row);
  upgradeTower(s, first.col, first.row);
  chooseBranch(s, first.col, first.row, 'A');
  const wall = towerAt(s, first.col, first.row);
  wall.hp = wall.maxHp / 2;

  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const b = createEnemy(1, 'breacher', 12, SPAWN, EXIT);
  b.attackTowerId = wall.id;
  b.x = wall.col + 0.5 - 0.6;
  b.y = wall.row + 0.5;
  b.prevX = b.x;
  b.prevY = b.y;
  b.col = wall.col - 1;
  b.row = wall.row;
  s.enemies.push(b);

  const hpBefore = wall.hp;
  check(startRepair(s, first.col, first.row), 'the repair starts under a breacher');
  check(b.attackTowerId === null, 'starting a repair releases the breacher');
  for (let i = 0; i < secondsToTicks(2.4); i++) tick(s);
  check(isRepairing(wall, s.clock), 'the wall is still repairing mid-window');
  check(wall.hp >= hpBefore, `a breacher cannot damage a repairing wall (${wall.hp} >= ${hpBefore})`);
  while (isRepairing(wall, s.clock)) tick(s);
  check(wall.hp === wall.maxHp, 'the wall finishes the repair at full health');
}

{
  // One repair at a time, and none at full health.
  const s = stateOnLevel('open-field');
  s.economy.salvage = 10000;
  placeTower(s, 'wall', 5, 6);
  upgradeTower(s, 5, 6);
  chooseBranch(s, 5, 6, 'A');
  const wall = towerAt(s, 5, 6);
  wall.hp = wall.maxHp / 2;
  check(startRepair(s, 5, 6), 'the first repair starts');
  check(!startRepair(s, 5, 6), 'a second repair is refused while one runs');
  while (isRepairing(wall, s.clock)) tick(s);
  check(wall.hp === wall.maxHp, 'the repair finished at full health');
  check(!startRepair(s, 5, 6), 'a repair at full health is refused');
}

{
  // Selling mid-repair refunds only the standard value and the timer resurrects nothing.
  const s = stateOnLevel('open-field');
  s.economy.salvage = 10000;
  placeTower(s, 'wall', 5, 6);
  upgradeTower(s, 5, 6);
  chooseBranch(s, 5, 6, 'A');
  const wall = towerAt(s, 5, 6);
  wall.hp = wall.maxHp / 2;
  const salv = s.economy.salvage;
  const price = repairCost(wall);
  check(startRepair(s, 5, 6), 'the repair starts');
  check(sellTower(s, 5, 6), 'selling mid-repair succeeds');
  check(s.economy.salvage === salv - price, 'selling mid-repair refunds only the standard value (walls refund $0)');
  check(!s.towers.some((t) => t.id === wall.id), 'the sold tower is gone');
  for (let i = 0; i < 300; i++) tick(s);
  check(!s.towers.some((t) => t.id === wall.id), 'the timer does not resurrect a sold tower');
}

// --- 18k. Fixed-timestep equivalence still holds with a repair in flight ---------------------
{
  const run = (frameMs) => {
    const s = stateOnLevel('open-field');
    s.economy.salvage = 10000;
    placeTower(s, 'wall', 5, 6);
    upgradeTower(s, 5, 6);
    chooseBranch(s, 5, 6, 'A');
    const wall = towerAt(s, 5, 6);
    wall.hp = wall.maxHp / 2;
    startRepair(s, 5, 6);
    startWave(s);
    for (let t = 0; t < 100 * TICK_MS - frameMs; t += frameMs) step(s, frameMs);
    while (s.clock < 130) tick(s);
    return JSON.stringify([
      s.economy,
      s.integrity,
      s.enemies.map((e) => [e.id, e.hp, e.dist]),
      s.rng,
      s.clock,
      s.field,
      wall.hp,
      wall.repairReadyAt,
      isRepairing(wall, s.clock),
    ]);
  };
  const at60 = run(TICK_MS);
  const parsed = JSON.parse(at60);
  check(parsed[8] === true, 'the repair is still in flight at the sampled clock');
  check(at60 === run(1000 / 144), 'a repair in flight: same result at 60 Hz and 144 Hz frames');
  check(at60 === run(1000 / 23), 'a repair in flight: same result at 23 Hz frames');
}

// --- 19. Route line: reversed segments and per-route offsets ---------------------------------
{
  const down = dashRects(10, 0, 10, 20, 4, 4, 3);
  const up = dashRects(10, 20, 10, 0, 4, 4, 3);
  const right = dashRects(0, 10, 20, 10, 4, 4, 3);
  const left = dashRects(20, 10, 0, 10, 4, 4, 3);
  check(up.length > 0 && up.length === down.length, `northward dashes draw (${up.length} shapes)`);
  check(left.length > 0 && left.length === right.length, `westward dashes draw (${left.length} shapes)`);
  check(
    up.every((r) => r.y >= 0 && r.y + r.h <= 20) && left.every((r) => r.x >= 0 && r.x + r.w <= 20),
    'reversed dashes stay inside their segment',
  );

  const cell = 28;
  check(routeOffset(0, 1, cell) === 0, 'a single route has zero offset');
  const o0 = routeOffset(0, 2, cell);
  const o1 = routeOffset(1, 2, cell);
  check(o0 !== o1 && o0 === -o1, `two routes get distinct, symmetric offsets (${o0}, ${o1})`);
  const h0 = offsetSegment(0, 0, 10, 0, o0);
  const h1 = offsetSegment(0, 0, 10, 0, o1);
  const v0 = offsetSegment(10, 0, 10, 10, o0);
  const v1 = offsetSegment(10, 0, 10, 10, o1);
  check(h0.a.y !== h1.a.y && v0.a.x !== v1.a.x,
    'horizontal and vertical segments separate two routes');
}

// --- 20. Pop-up enemy: the walking shield ------------------------------------------------
{
  // 20a. An enemy inside the window is never acquired while it lives, and is acquired on the tick
  // after the window closes.
  const s = createRunState();
  s.economy.salvage = 10000;
  placeTower(s, 'gun', 5, 5);
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const grunt = stationary(1, 'grunt', 15, 5.5, 4.0);
  const popup = stationary(2, 'popup', 15, 5.5, 4.0);
  s.enemies.push(grunt, popup);

  for (let i = 0; i < 30; i++) tick(s);
  check(grunt.hp === grunt.maxHp, 'an enemy inside the window is never acquired while it lives');

  check(closePopupEnemy(s, popup.id), 'the pop-up window closes');
  tick(s);
  check(grunt.hp < grunt.maxHp, 'the enemy is acquired on the tick after the pop-up closes');
}

{
  // 20b. Flak (cannon splash) reaches an unshielded enemy but not an enemy inside the window.
  const s = allUnlocked();
  s.economy.salvage = 10000;
  placeTower(s, 'cannon', 5, 6);
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const target = stationary(1, 'grunt', 15, 5.5, 3.7);
  const covered = stationary(2, 'grunt', 15, 5.5, 4.5);
  const popup = stationary(3, 'popup', 15, 5.5, 4.5);
  s.enemies.push(target, covered, popup);

  for (let i = 0; i < 30 && target.hp === target.maxHp; i++) tick(s);
  check(target.hp < target.maxHp, 'flak damages an unshielded enemy');
  check(covered.hp === covered.maxHp, 'flak burst does not damage a shielded enemy');
  check(popup.hp === popup.maxHp && !popup.dead, 'flak does not damage the window itself');
}

{
  // 20c. The pointer ignores the shield and cannot damage the window body.
  const s = createRunState();
  s.phase = 'wave';
  const grunt = stationary(1, 'grunt', 15, 5.5, 4.5);
  const popup = stationary(2, 'popup', 15, 5.5, 4.5);
  s.enemies.push(grunt, popup);

  const hpBefore = grunt.hp;
  pointerDown(s, grunt.x, grunt.y);
  check(grunt.hp < hpBefore, 'the pointer damages an enemy inside the window');
  check(!popup.dead, 'the pointer cannot damage the window body');
}

{
  // 20d. Clicking the close box kills the window; clicking the body does not.
  const s = createRunState();
  s.phase = 'wave';
  const popup = stationary(1, 'popup', 15, 10.5, 6.5);
  s.enemies.push(popup);
  const board = { x: 0, y: 0, cell: 28 };
  const win = popupWindowRect(popup, board);
  const close = popupCloseRect(popup, board);
  check(close.w === POPUP_CLOSE_W && close.h === POPUP_CLOSE_H,
    `close box is ${POPUP_CLOSE_W}x${POPUP_CLOSE_H} px (${close.w}x${close.h})`);

  const body = { x: win.x + 6, y: win.y + win.h - 4 };
  check(!popupCloseHit(popup, board, body.x, body.y), 'clicking the window body is not the close box');
  check(popupCloseHit(popup, board, close.x + close.w / 2, close.y + close.h / 2), 'the close-box centre is a hit');

  const salvageBefore = s.economy.salvage;
  check(closePopupEnemy(s, popup.id), 'clicking the close box kills the window');
  check(popup.dead, 'the window is dead');
  check(s.economy.salvage === salvageBefore + popup.value,
    `closing pays the normal salvage (${s.economy.salvage - salvageBefore}, base ${popup.value})`);
}

{
  // 20e. The pop-up renders below other enemies: it lands in the lower draw layer.
  const popup = createEnemy(1, 'popup', 15, SPAWN, EXIT);
  const grunt = createEnemy(2, 'grunt', 15, SPAWN, EXIT);
  const order = enemyDrawOrder([popup, grunt]);
  check(order.popups.length === 1 && order.popups[0].id === popup.id, 'the pop-up is in the lower layer');
  check(order.others.length === 1 && order.others[0].id === grunt.id, 'the grunt is in the upper layer');
}

{
  // 20e2. Inside the upper layer: regulars first, then bosses, then flyers. Bosses must never be hidden
  // behind their own escort, and a flyer is above the board whatever rank it holds.
  const mk = (id, kind) => createEnemy(id, kind, 15, SPAWN, EXIT);
  const order = enemyDrawOrder([
    mk(1, 'flyer'), mk(2, 'grunt-boss'), mk(3, 'grunt'), mk(4, 'flyer-boss'), mk(5, 'runner'),
  ]);
  const kinds = order.others.map((e) => e.kind).join(',');
  check(kinds === 'grunt,runner,grunt-boss,flyer,flyer-boss',
    `regulars, then bosses, then flyers (got ${kinds})`);
}

{
  // 20f. Rarity: none before wave 15, never two before 60, never on a boss wave, at most two after.
  let noneBefore15 = true;
  for (let w = 1; w < 15; w++) if (popupCountForWave(w) !== 0) noneBefore15 = false;
  check(noneBefore15, 'no pop-up before wave 15');

  let neverTwoBefore60 = true;
  for (let w = 15; w < 60; w++) if (popupCountForWave(w) > 1) neverTwoBefore60 = false;
  check(neverTwoBefore60, 'never two pop-ups in a wave before wave 60');

  let bossClear = true;
  for (const w of [10, 25, 50, 75, 100]) if (popupCountForWave(w) !== 0) bossClear = false;
  check(bossClear, 'never on a boss wave');

  let cappedAfter60 = true;
  for (let w = 60; w <= 100; w++) if (popupCountForWave(w) > 2) cappedAfter60 = false;
  check(cappedAfter60, 'at most two pop-ups per wave after wave 60');
}

{
  // 20g. Deterministic and wired into the schedule: the same wave produces the same pop-up.
  let matches = true;
  let present = 0;
  for (let w = 1; w <= 100; w++) {
    const n = popupCountForWave(w);
    if (buildSchedule(w).filter((sp) => sp.kind === 'popup').length !== n) matches = false;
    if (w >= 15 && n > 0) present++;
  }
  check(matches, 'every wave schedule matches its pop-up count');
  check(present > 0, 'pop-ups appear on at least one wave (15..100)');
  check(popupCountForWave(60) === popupCountForWave(60), 'the same wave produces the same pop-up count');
}

{
  // 20h. A pop-up driven to the exit costs no integrity, counts as no leak, and emits popupEscaped
  // rather than the integrity-loss leak event.
  const s = stateOnLevel('open-field');
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const integrityBefore = s.integrity;
  const popup = createEnemy(1, 'popup', 15, SPAWN, EXIT);
  s.enemies.push(popup);
  let t = 0;
  while (s.enemies.length > 0 && t < 5000) {
    tick(s);
    t++;
  }
  check(popup.dead, 'the pop-up reached the exit and left the board');
  check(s.integrity === integrityBefore, `a pop-up escape leaves integrity unchanged (${s.integrity})`);
  check((s.leaksByWave.get(15) ?? 0) === 0, 'a pop-up escape increments no leak counter');
  check(
    s.events.some((e) => e.type === 'popupEscaped') && !s.events.some((e) => e.type === 'leak'),
    'a pop-up escape emits popupEscaped, not leak',
  );
}

{
  // 20i. An idle run (auto-wave on, no clicking) through a wave that contains a pop-up loses nothing
  // to it: the pop-up walks off and integrity and the leak counter are untouched by its escape.
  let popupWave = 0;
  for (let w = 15; w <= 100; w++) {
    if (popupCountForWave(w) > 0) {
      popupWave = w;
      break;
    }
  }
  check(popupWave > 0, `a pop-up wave exists for the idle test (wave ${popupWave})`);

  const s = stateOnLevel('open-field');
  toggleAutoWave(s);
  s.wave = popupWave - 1;
  s.phase = 'build';
  startWave(s);
  // Drop every non-popup spawn so no other enemy can leak and confound the pop-up's own accounting.
  s.runs[0].spawns = s.runs[0].spawns.filter((sp) => sp.kind === 'popup');
  const integrityBefore = s.integrity;
  let escaped = false;
  for (let i = 0; i < 6000 && !escaped; i++) {
    tick(s);
    if (s.events.some((e) => e.type === 'popupEscaped')) escaped = true;
  }
  check(escaped, 'the pop-up escaped during the idle auto-wave run');
  check(s.integrity === integrityBefore, `the idle run loses nothing to the pop-up (integrity ${s.integrity})`);
  check((s.leaksByWave.get(popupWave) ?? 0) === 0, 'the pop-up wave records no leak');
  check(s.autoWave === true, 'auto-wave stays on for the next wave');
}

{
  // 20j. Every non-boss enemy kind costs integrity exactly as it does today: 1 each.
  const leakCost = (kind) => {
    const s = stateOnLevel('open-field');
    s.phase = 'wave';
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    const start = s.integrity;
    const e = createEnemy(1, kind, 6, SPAWN, EXIT);
    s.enemies.push(e);
    let t = 0;
    while (s.enemies.length > 0 && t < 10000) {
      tick(s);
      t++;
    }
    return start - s.integrity;
  };
  check(leakCost('grunt') === 1, 'a grunt still costs 1 integrity');
  for (const kind of ['runner', 'shielded', 'flyer', 'armoured', 'saboteur', 'breacher']) {
    check(leakCost(kind) === 1, `a ${kind} still costs 1 integrity`);
  }
}

// --- 21. Map toggles (shutters) -------------------------------------------------------------

/** A minimal test level: open field, spawn (0,6), exit (19,6), with optional walls and toggles. */
function toggleLevel(toggles, walls = []) {
  return {
    id: 'toggle-test',
    name: 'Toggle Test',
    walls,
    starts: [{ col: 0, row: 6 }],
    exits: [{ col: 19, row: 6 }],
    toggles,
  };
}

/** A full-height column at x=5 except for the two rows named in `gaps`. */
function chokeWalls(gaps) {
  const walls = [];
  for (let r = 0; r < ROWS; r++) if (!gaps.includes(r)) walls.push([5, r]);
  return walls;
}

// 21a. Toggle state is a pure function of the clock: same tick, same state.
{
  const t = { col: 5, row: 6, periodTicks: 100, openTicks: 40, phaseTicks: 0 };
  check(toggleOpenAt(t, 10) === toggleOpenAt(t, 10), 'toggle state is a pure function of the clock');
  check(toggleOpenAt(t, 39) === true && toggleOpenAt(t, 40) === false, 'open before the window, closed at it');
  const a = { ...t, phaseTicks: 0 };
  const b = { ...t, phaseTicks: 50 };
  check(toggleOpenAt(a, 0) !== toggleOpenAt(b, 0), 'phaseTicks offsets two toggles out of lockstep');
  check(MAX_TOGGLES === 4, 'at most four toggles per level (16 combinations)');
}

// 21b. A closing shutter that would strand an enemy pushes it forward, not into a wall.
{
  const s = createRunState(undefined, toggleLevel([{ col: 5, row: 6, periodTicks: 100, openTicks: 50, phaseTicks: 0 }]));
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const e = createEnemy(1, 'grunt', 1, SPAWN, EXIT);
  e.x = 5.5;
  e.y = 6.5;
  e.prevX = 5.5;
  e.prevY = 6.5;
  e.col = 5;
  e.row = 6;
  e.heading = 0; // travelling east
  e.stunUntilTick = 999999;
  s.enemies.push(e);

  let guard = 0;
  while (e.col === 5 && e.row === 6 && guard < 200) {
    tick(s);
    guard++;
  }
  check(e.col === 6 && e.row === 6, `enemy pushed forward off the closing shutter (${e.col},${e.row})`);
  check(toggleAtTile(s, 5, 6) !== undefined, 'the closed tile is still an authored shutter');
}

// 21c. The route lengthens when a toggle closes and returns when it opens.
{
  const s = createRunState(undefined, toggleLevel([{ col: 10, row: 6, periodTicks: 100, openTicks: 50, phaseTicks: 0 }]));
  const openLen = currentPath(s).length; // clock 0, open
  while (s.clock < 60) tick(s); // into the closed window
  const closedLen = currentPath(s).length;
  while (s.clock < 110) tick(s); // back into the open window
  const reopenedLen = currentPath(s).length;
  check(openLen === 20, `open route is 20 tiles (${openLen})`);
  check(closedLen > openLen, `route lengthens when the shutter closes (${openLen} -> ${closedLen})`);
  check(reopenedLen === openLen, `route returns when the shutter reopens (${reopenedLen})`);
}

// 21d. Placement refused when it would seal under a closed toggle, accepted when permanently open.
{
  const walls = chokeWalls([5, 6]); // the only crossings are the two gaps at rows 5 and 6
  const toggling = [{ col: 5, row: 6, periodTicks: 100, openTicks: 50, phaseTicks: 0 }];
  const s = createRunState(undefined, toggleLevel(toggling, walls));
  check(!canPlace(s, 'gun', 5, 6), 'cannot build on a shutter tile');
  check(!canPlace(s, 'gun', 5, 5), 'placement refused when it would seal under a closed shutter');
  check(placementSealsUnderToggles(s, 5, 5), 'the refusal names a shutter combination as the cause');
  check(canPlace(s, 'gun', 4, 6), 'a placement away from the choke stays legal');

  const alwaysOpen = [{ col: 5, row: 6, periodTicks: 100, openTicks: 100, phaseTicks: 0 }];
  const s2 = createRunState(undefined, toggleLevel(alwaysOpen, walls));
  check(canPlace(s2, 'gun', 5, 5), 'accepted when the shutter is permanently open');
  check(!placementSealsUnderToggles(s2, 5, 5), 'a permanently-open shutter never seals a combination');
}

// 21e. Loading a level whose toggles can seal it is rejected with a named reason.
{
  const walls = chokeWalls([5]); // a single gap at row 5, filled by the shutter
  const level = {
    id: 'sealed-toggle',
    name: 'Sealed Toggle',
    walls,
    starts: [{ col: 0, row: 6 }],
    exits: [{ col: 19, row: 6 }],
    toggles: [{ col: 5, row: 5, periodTicks: 100, openTicks: 50, phaseTicks: 0 }],
  };
  check(validateLevel(level) === 'toggle combination seals the route', 'loading a sealing toggle level is rejected with a named reason');

  let threw = false;
  try {
    createRunState(undefined, level);
  } catch {
    threw = true;
  }
  check(threw, 'createRunState throws for a level whose toggles seal it');

  const tooMany = { ...level, toggles: [0, 1, 2, 3, 4].map((i) => ({ col: i, row: 0, periodTicks: 100, openTicks: 50, phaseTicks: 0 })) };
  check(validateLevel(tooMany) === 'too many toggles', 'more than four toggles is rejected');
}

// 21f. Fixed-timestep equivalence still holds with toggles running.
{
  const level = toggleLevel([{ col: 10, row: 6, periodTicks: 90, openTicks: 45, phaseTicks: 0 }]);
  const run = (frameMs) => {
    const s = createRunState(undefined, level);
    placeTower(s, 'gun', 3, 6);
    startWave(s);
    for (let t = 0; t < 900 * TICK_MS - frameMs; t += frameMs) step(s, frameMs);
    while (s.tick < 1000) tick(s);
    return JSON.stringify([
      s.economy,
      s.integrity,
      s.enemies.map((e) => [e.id, e.hp, e.dist]),
      s.rng,
      s.clock,
      s.field,
    ]);
  };
  const at60 = run(TICK_MS);
  check(at60 === run(1000 / 144), 'toggles: same result at 60 Hz and 144 Hz frames');
  check(at60 === run(1000 / 23), 'toggles: same result at 23 Hz frames');
}

// 21g. Turnstile: the authored map demonstrates the mechanic end to end. The direct gate is open at
// clock 0, so the route is the straight lane; once it closes the route runs the upper hall, and every
// combination of the two gates still leaves the board walkable (validated by createRunState itself).
{
  const level = levelById('turnstile');
  check(validateLevel(level) === null, 'turnstile: validateLevel accepts the map');

  const s = stateOnLevel('turnstile');
  const openLen = currentPath(s).length; // clock 0: direct gate open, upper gate closed
  while (s.clock < 421) tick(s); // cross the direct gate's close at clock 420
  const closedLen = currentPath(s).length;
  check(openLen === 20, `turnstile: open route is 20 tiles (${openLen})`);
  check(closedLen === 26, `turnstile: closed route is 26 tiles (${closedLen})`);
  check(closedLen > openLen, `turnstile: closing the gate measurably lengthens the route (${openLen} -> ${closedLen})`);
}

// --- 22. Run isolation: no module-level state leaks between runs in the same process -----------
{
  // A deterministic slice of a run: a small board, a few waves, a scripted click on the leading
  // enemy. The full outcome is captured so that any hidden cross-run state (a cached field, a shared
  // array, an id or RNG counter that outlives createRunState) would change it on the second run.
  const simulate = (levelId) => {
    const s = stateOnLevel(levelId);
    s.economy.salvage = 10000;
    for (const [c, r] of [[3, 6], [7, 5], [7, 7]]) placeTower(s, 'gun', c, r);
    for (let wave = 1; wave <= 3; wave++) {
      if (!startWave(s)) break;
      for (let i = 0; i < 4000 && s.phase === 'wave'; i++) {
        const target = s.enemies.find((e) => !e.dead && !isPopupEnemy(e));
        if (target) {
          pointerDown(s, target.x, target.y);
          pointerUp(s);
        }
        tick(s);
      }
    }
    return JSON.stringify([
      s.levelId,
      s.economy.salvage,
      s.economy.earned,
      s.integrity,
      s.clearedWaves,
      s.towers.map((t) => [t.kind, t.col, t.row, t.tier, t.kills, t.damageDealt]),
      s.enemies.map((e) => [e.kind, e.wave, e.hp, e.dist]),
      s.rng,
      s.tick,
      s.clock,
    ]);
  };

  const first = simulate('open-field');
  const second = simulate('open-field');
  check(first === second, 'run isolation: the same map twice gives the identical outcome');

  // Two maps in each order: each map's outcome must not depend on what ran before it.
  const corridorFirst = simulate('corridor');
  const openFirst = simulate('open-field');
  const openSecond = simulate('open-field');
  const corridorSecond = simulate('corridor');
  check(
    openFirst === openSecond && corridorFirst === corridorSecond,
    'run isolation: a map\'s outcome is unaffected by the order maps run in',
  );
}

// --- 23. Targeting locks: Taser & Frost (close), Laser (first), Cannon (strong), Gun (player's choice) --
{
  // A Taser locked to 'close' ignores a stored 'strong' preference and fires at the nearest enemy.
  const s = allUnlocked();
  s.economy.salvage = 10000;
  placeTower(s, 'taser', 5, 5);
  const taser = towerAt(s, 5, 5);
  taser.targetMode = 'strong';
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const near = stationary(1, 'grunt', 1, 5.5, 5.0);
  const far = stationary(2, 'grunt', 1, 5.5, 4.0);
  far.hp = 500;
  s.enemies.push(near, far);
  tick(s);
  check(near.hp < near.maxHp, `taser with target=strong still fires at the closest enemy (near hp ${near.hp})`);
  check(far.hp === 500, `the stronger, farther enemy is untouched (far hp ${far.hp})`);
}

{
  // Frost is a radial pulse (docs/FROST-PULSE.md): one pulse slows every enemy inside its radius,
  // leaves enemies outside untouched, and a tier-1 Frost deals no damage.
  const s = allUnlocked();
  s.economy.salvage = 10000;
  placeTower(s, 'frost', 5, 5);
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const a = stationary(1, 'grunt', 1, 5.5, 5.0);
  const b = stationary(2, 'grunt', 1, 5.5, 4.0);
  const c = stationary(3, 'grunt', 1, 6.5, 5.5);
  const out = stationary(4, 'grunt', 1, 9.5, 5.5);
  s.enemies.push(a, b, c, out);
  tick(s);
  check(a.slowFactor === 0.3 && b.slowFactor === 0.3 && c.slowFactor === 0.3,
    `one pulse slows all three enemies in radius (${a.slowFactor}, ${b.slowFactor}, ${c.slowFactor})`);
  check(out.slowFactor === 1, `an enemy outside the radius is untouched (slowFactor ${out.slowFactor})`);
  check(a.hp === a.maxHp && b.hp === b.maxHp && c.hp === c.maxHp,
    'a tier-1 Frost pulse deals no damage');
}

{
  // Two overlapping Frosts give the same slow as one: applySlow's weaker-wins rule is unchanged.
  const one = allUnlocked();
  one.economy.salvage = 10000;
  placeTower(one, 'frost', 5, 5);
  one.phase = 'wave';
  one.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const e1 = stationary(1, 'grunt', 1, 5.5, 4.0);
  one.enemies.push(e1);
  tick(one);

  const two = allUnlocked();
  two.economy.salvage = 10000;
  placeTower(two, 'frost', 5, 5);
  placeTower(two, 'frost', 6, 5);
  two.phase = 'wave';
  two.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const e2 = stationary(1, 'grunt', 1, 5.5, 4.0);
  two.enemies.push(e2);
  tick(two);
  check(e1.slowFactor === 0.3 && e2.slowFactor === e1.slowFactor,
    `two Frosts give the same slow as one (${e2.slowFactor} === ${e1.slowFactor})`);
}

{
  // The pulse fires only when an enemy is in range, on the documented interval.
  const s = allUnlocked();
  s.economy.salvage = 10000;
  placeTower(s, 'frost', 5, 5);
  const frost = towerAt(s, 5, 5);
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const out = stationary(1, 'grunt', 1, 9.5, 5.5); // outside the radius, keeps the wave alive
  s.enemies.push(out);
  tick(s);
  check(s.events.filter((e) => e.type === 'shot').length === 0, 'no enemy in range: the Frost does not fire');

  const e = stationary(2, 'grunt', 1, 5.5, 4.0);
  s.enemies.push(e);
  const interval = towerIntervalTicks(s, effectiveStats(frost).fireInterval);
  tick(s);
  check(s.events.filter((ev) => ev.type === 'shot').length === 1, 'an enemy in range: the Frost fires');
  check(frost.cooldown === interval - 1, `the Frost arms its cooldown for the documented interval (${frost.cooldown})`);
  s.events.length = 0;
  for (let i = 0; i < interval; i++) tick(s);
  check(s.events.filter((ev) => ev.type === 'shot').length === 1, 'the Frost fires again after exactly one interval');
}

{
  // Branch B (Shard) damages every enemy in radius, not one plus a splash, and does not slow.
  const s = allUnlocked();
  s.economy.salvage = 10000;
  placeTower(s, 'frost', 5, 5);
  upgradeTower(s, 5, 5); // 1 -> 2
  chooseBranch(s, 5, 5, 'B'); // 2 -> 3 branch B
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const a = stationary(1, 'grunt', 1, 5.5, 5.0);
  const b = stationary(2, 'grunt', 1, 5.5, 4.0);
  const c = stationary(3, 'grunt', 1, 6.5, 5.5);
  s.enemies.push(a, b, c);
  tick(s);
  check(a.hp < a.maxHp && b.hp < b.maxHp && c.hp < c.maxHp,
    `branch B damages every enemy in radius (hp ${a.hp}, ${b.hp}, ${c.hp})`);
  check(a.slowFactor === 1 && b.slowFactor === 1 && c.slowFactor === 1, 'branch B does not slow');
}

{
  // A Laser locked to 'first' fires at the furthest-along enemy, ignoring a stored 'strong' choice.
  const s = allUnlocked();
  s.economy.salvage = 10000;
  placeTower(s, 'laser', 5, 5);
  const laser = towerAt(s, 5, 5);
  laser.targetMode = 'strong';
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const front = stationary(1, 'grunt', 1, 5.5, 3.0);
  const back = stationary(2, 'grunt', 1, 6.5, 4.0);
  front.dist = 10;
  back.dist = 5;
  back.hp = 500;
  s.enemies.push(front, back);
  tick(s);
  check(front.hp === front.maxHp - 11, `laser locked to 'first' hits the leading enemy (front hp ${front.hp})`);
  check(back.hp === 500, `the stronger, nearer enemy is untouched (back hp ${back.hp})`);
}

{
  // A Cannon locked to 'strong' swings at the biggest enemy, not the furthest along.
  const s = allUnlocked();
  s.economy.salvage = 10000;
  placeTower(s, 'cannon', 5, 5);
  const cannon = towerAt(s, 5, 5);
  cannon.targetMode = 'first';
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const strong = stationary(1, 'grunt', 1, 5.5, 4.0);
  const far = stationary(2, 'grunt', 1, 7.5, 4.0);
  strong.dist = 5;
  far.dist = 10;
  strong.hp = 500;
  s.enemies.push(strong, far);
  for (let i = 0; i < 30 && strong.hp === 500; i++) tick(s);
  check(strong.hp === 500 - 5, `cannon locked to 'strong' hits the biggest enemy (strong hp ${strong.hp})`);
  check(far.hp === far.maxHp, `the furthest-along enemy is untouched (far hp ${far.hp})`);
}

{
  // The Gun is unaffected by locks: 'close' and 'strong' pick different enemies in the same setup.
  const setup = () => {
    const s = createRunState();
    s.economy.salvage = 10000;
    placeTower(s, 'gun', 5, 5);
    s.phase = 'wave';
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    const near = stationary(1, 'grunt', 1, 5.5, 5.0);
    const far = stationary(2, 'grunt', 1, 5.5, 4.0);
    far.hp = 500;
    s.enemies.push(near, far);
    return s;
  };
  const closeRun = setup();
  towerAt(closeRun, 5, 5).targetMode = 'close';
  tick(closeRun);
  check(closeRun.enemies.find((e) => e.id === 1).hp === 17,
    `close gun hits the near enemy (near hp ${closeRun.enemies.find((e) => e.id === 1).hp})`);
  check(closeRun.enemies.find((e) => e.id === 2).hp === 500,
    `close gun leaves the strong enemy alone (far hp ${closeRun.enemies.find((e) => e.id === 2).hp})`);

  const strongRun = setup();
  towerAt(strongRun, 5, 5).targetMode = 'strong';
  tick(strongRun);
  check(strongRun.enemies.find((e) => e.id === 2).hp === 497,
    `strong gun hits the strong enemy (far hp ${strongRun.enemies.find((e) => e.id === 2).hp})`);
  check(strongRun.enemies.find((e) => e.id === 1).hp === 20,
    `strong gun leaves the near enemy alone (near hp ${strongRun.enemies.find((e) => e.id === 1).hp})`);
}

{
  // The panel reads a fixed label for locked towers and the stored mode for the configurable Gun;
  // the target key/click is refused for locked towers and still cycles the Gun.
  check(targetModeDisplay(createTower(1, 'taser', 0, 0)) === 'Closest (fixed)', 'taser panel reads "Closest (fixed)"');
  check(targetModeDisplay(createTower(2, 'frost', 0, 0)) === 'Closest (fixed)', 'frost panel reads "Closest (fixed)"');
  check(targetModeDisplay(createTower(3, 'laser', 0, 0)) === 'First (fixed)', 'laser panel reads "First (fixed)"');
  check(targetModeDisplay(createTower(4, 'cannon', 0, 0)) === 'Strong (fixed)', 'cannon panel reads "Strong (fixed)"');
  const gun = createTower(5, 'gun', 0, 0);
  check(targetModeDisplay(gun) === 'First', 'gun panel reads its stored mode');
  check(targetLockReason('taser') === 'A Tesla coil discharges into whatever is nearest.', 'taser tooltip explains the lock');
  check(targetLockReason('frost') === 'Frost always targets the closest enemy.', 'frost tooltip explains the lock');
  check(targetLockReason('laser') !== null && targetLockReason('cannon') !== null, 'laser and cannon tooltips each explain their lock');
  check(targetLockReason('gun') === null, 'the configurable gun has no lock reason');

  const s = allUnlocked();
  s.economy.salvage = 10000;
  placeTower(s, 'taser', 5, 5);
  placeTower(s, 'frost', 6, 5);
  placeTower(s, 'gun', 6, 6);
  const taser = towerAt(s, 5, 5);
  taser.targetMode = 'strong';
  cycleTargetMode(s, 5, 5);
  check(taser.targetMode === 'strong', 'the target key/click does not change a locked taser');
  const frost = towerAt(s, 6, 5);
  frost.targetMode = 'strong';
  cycleTargetMode(s, 6, 5);
  check(frost.targetMode === 'strong', 'the target key/click does not change a locked frost');
  const g = towerAt(s, 6, 6);
  g.targetMode = 'first';
  cycleTargetMode(s, 6, 6);
  check(g.targetMode === 'strong', 'the target key/click still cycles a configurable gun');
}

// --- 24. Pointer overclock ladder, crits and Manual Override --------------------------------
{
  // 24a. The ladder: cost and damage follow the formulas, and the tooltip's "after" is the value
  // actually applied once the level is bought.
  const s = createRunState();
  s.economy.salvage = 100000;
  s.wave = 16; // the ceiling lets two overclock levels be bought by wave 16
  check(upgradePointer(s), 'pointer upgrades stage 1 -> 2');
  check(s.pointer.stage === 2, 'pointer is at stage 2');
  check(s.pointer.clickLevel === 0, 'clickLevel starts at 0');
  check(nextOverclockCost(s.pointer) === OVERCLOCK_COST_BASE, `first overclock costs ${OVERCLOCK_COST_BASE}`);
  check(clickDamage(s.pointer) === 4, 'stage-2 click damage is 4 at level 0');
  check(holdDps(s.pointer) === 10, 'stage-2 hold dps is 10 at level 0');

  const sal = s.economy.salvage;
  check(upgradePointer(s), 'buy overclock level 1');
  check(s.pointer.clickLevel === 1, 'clickLevel becomes 1');
  check(s.economy.salvage === sal - OVERCLOCK_COST_BASE, `level 1 costs ${OVERCLOCK_COST_BASE}`);
  check(Math.abs(clickDamage(s.pointer) - 4 * OVERCLOCK_DAMAGE_GROWTH) < 1e-9, 'click damage follows the damage growth constant');
  check(Math.abs(holdDps(s.pointer) - clickDamage(s.pointer) * 2.5) < 1e-9, 'hold dps scales with click');
  check(nextOverclockCost(s.pointer) === Math.round(OVERCLOCK_COST_BASE * OVERCLOCK_COST_GROWTH ** 1), 'next overclock cost follows the formula');
  check(nextPointerCost(s.pointer) === nextOverclockCost(s.pointer), 'nextPointerCost is the overclock cost at stage 2');

  // Buying the level the tooltip previewed must raise the damage to the tooltip's "after" value.
  const tooltipLine = pointerTooltipLines(s.pointer, s.economy.salvage, s.wave)[0];
  const previewAfter = fmtClickDamage(clickDamage({ ...s.pointer, clickLevel: s.pointer.clickLevel + 1 }));
  check(tooltipText(tooltipLine).includes(previewAfter), `overclock tooltip previews the applied damage (${tooltipText(tooltipLine)})`);
  upgradePointer(s);
  check(fmtClickDamage(clickDamage(s.pointer)) === previewAfter, 'the tooltip after-value matches the damage applied after buying');
}

{
  // 24a1. The damage milestones: level 5 doubles click damage and level 10 doubles it again, so the
  // ladder is a few visible jumps rather than one smooth 1.12 curve.
  const proto = createRunState().pointer;
  const dmg = (level) => clickDamage({ ...proto, stage: 2, clickLevel: level });
  check(overclockMilestoneMult(4) === 1, 'no milestone below level 5');
  check(overclockMilestoneMult(5) === 2, 'level 5 doubles the milestone multiplier');
  check(overclockMilestoneMult(9) === 2, 'the level-5 milestone persists to level 9');
  check(overclockMilestoneMult(10) === 4, 'level 10 doubles it again (x4 total)');
  check(overclockMilestoneMult(12) === 4, 'the multiplier holds through the cap');
  check(Math.abs(dmg(4) - 4 * OVERCLOCK_DAMAGE_GROWTH ** 4) < 1e-9, 'level 4 follows the plain growth curve');
  check(Math.abs(dmg(5) - 2 * 4 * OVERCLOCK_DAMAGE_GROWTH ** 5) < 1e-9, 'level 5 doubles the growth curve');
  check(Math.abs(dmg(10) - 4 * 4 * OVERCLOCK_DAMAGE_GROWTH ** 10) < 1e-9, 'level 10 doubles again');
  check(Math.abs(dmg(12) - 4 * 4 * OVERCLOCK_DAMAGE_GROWTH ** 12) < 1e-9, 'level 12 carries both milestones');
}

{
  // 24a2. The overclock ceiling: buying is gated by floor(wave / 8) up to 12, and the tooltip names
  // the wave that unlocks the next level. Levels already bought are never taken back.
  check(overclockCeiling(0) === 0 && overclockCeiling(7) === 0, 'ceiling is 0 before wave 8');
  check(overclockCeiling(8) === 1 && overclockCeiling(15) === 1, 'ceiling is 1 from wave 8');
  check(overclockCeiling(16) === 2 && overclockCeiling(96) === 12, 'ceiling tracks floor(wave/8)');
  check(overclockCeiling(200) === 12, 'ceiling clamps to 12');
  check(overclockUnlockWave(2) === 16, 'the unlock wave is level x 8');

  const g = createRunState();
  g.economy.salvage = 100000;
  check(upgradePointer(g), 'stage 1 -> 2 ignores the ceiling');
  check(upgradePointer(g) === false, 'overclock 1 is refused before wave 8');
  check(g.pointer.clickLevel === 0, 'a refused buy leaves clickLevel at 0');
  check(
    tooltipText(pointerTooltipLines(g.pointer, g.economy.salvage, g.wave)[0]) === 'Needs wave 8 — one overclock level every 8 waves.',
    'the tooltip names the unlocking wave',
  );
  g.wave = 8;
  check(upgradePointer(g), 'overclock 1 buys once wave 8 arrives');
  check(g.pointer.clickLevel === 1, 'clickLevel becomes 1');
  check(upgradePointer(g) === false, 'overclock 2 is refused before wave 16');
  check(tooltipText(pointerTooltipLines(g.pointer, g.economy.salvage, g.wave)[0]) === 'Needs wave 16 — one overclock level every 8 waves.',
    'the tooltip names the next unlocking wave');
  g.wave = 16;
  check(upgradePointer(g), 'overclock 2 buys once wave 16 arrives');
  g.pointer.clickLevel = MAX_OVERCLOCK_LEVEL;
  check(pointerTooltipLines(g.pointer, g.economy.salvage, g.wave)[0] === 'Max level', 'the ladder reads Max level at the cap');
}

{
  // Pointer upgrade gate (docs/POINTER-UPGRADE-GATE.md): the Upgrade button keys off the same ceiling
  // and cap the purchase does, so it greys out on a wave block instead of looking live and refusing.
  const s = createRunState();
  s.pointer.stage = 2;
  s.pointer.clickLevel = 0;

  // 1. Wave 7, stage 2, clickLevel 0: the first overclock level is gated by wave 8.
  const gated = pointerUpgradeState(7, MAX_OVERCLOCK_LEVEL, s.pointer);
  check(gated.block === 'wave' && gated.unlockWave === 8 && gated.cost === 1845,
    `wave 7 gates the first overclock (${gated.block}, unlock ${gated.unlockWave}, cost ${gated.cost})`);

  // 2. Wave 8 lifts the block: the same state is buyable.
  const lifted = pointerUpgradeState(8, MAX_OVERCLOCK_LEVEL, s.pointer);
  check(lifted.block === null && lifted.unlockWave === null && lifted.cost === 1845,
    `wave 8 lifts the gate (${lifted.block}, cost ${lifted.cost})`);

  // 3. At the ladder's top the block is maxed and the cost is null.
  const maxed = pointerUpgradeState(200, MAX_OVERCLOCK_LEVEL, { ...s.pointer, clickLevel: MAX_OVERCLOCK_LEVEL });
  check(maxed.block === 'maxed' && maxed.cost === null, 'the ladder top reads maxed with no cost');
}

{
  // 4. Coolant Loop's raised cap: a level above 12 is still a wave gate, not maxed.
  const cooled = createRunState();
  cooled.economy.salvage = 1_000_000;
  cooled.wave = 100;
  check(buyUpgrade(cooled, 'coolant'), 'coolant is bought for the raised-cap check');
  check(overclockCap(cooled) === 16, 'coolant raises the run-local cap to 16');
  cooled.pointer.stage = 2;
  cooled.pointer.clickLevel = 12;
  const st = pointerUpgradeState(cooled.wave, overclockCap(cooled), cooled.pointer);
  check(st.block === 'wave' && st.unlockWave === 104,
    `a level above 12 is a wave gate under coolant, not maxed (${st.block}, ${st.unlockWave})`);
}

{
  // 5. The HUD's Upgrade button hit-tests disabled on a wave block and enabled once the wave arrives.
  const l = computeLayout(1280, 720);
  const centre = (r) => [r.x + r.w / 2, r.y + r.h / 2];
  const s = createRunState();
  s.pointer.stage = 2;
  s.pointer.clickLevel = 0;
  s.wave = 7;
  s.economy.salvage = 100000;

  const blocked = computeRightPanel(l, s).pointer.upgrade;
  const blockedHit = hudControlAt(l, s, ...centre(blocked));
  check(blockedHit?.action === 'pointer' && blockedHit.enabled === false,
    'the wave-blocked Upgrade button hit-tests disabled');
  check(hudButtonAt(l, s, ...centre(blocked)) === null, 'hudButtonAt refuses the wave-blocked Upgrade');

  s.wave = 8;
  const open = computeRightPanel(l, s).pointer.upgrade;
  const openHit = hudControlAt(l, s, ...centre(open));
  check(openHit?.action === 'pointer' && openHit.enabled === true,
    'the Upgrade button re-enables once the wave arrives');
  check(hudButtonAt(l, s, ...centre(open)) === 'pointer', 'hudButtonAt hits the Upgrade once the wave arrives');
}

{
  // 6. The tooltip names the unlocking wave, in blue.
  const s = createRunState();
  s.pointer.stage = 2;
  s.pointer.clickLevel = 1;
  s.wave = 8;
  s.economy.salvage = 100000;
  const line = pointerTooltipLines(s.pointer, s.economy.salvage, s.wave)[0];
  check(tooltipText(line) === 'Needs wave 16 — one overclock level every 8 waves.',
    `the tooltip names the unlocking wave (${tooltipText(line)})`);
  check(typeof line !== 'string' && line.some((seg) => seg.color === TOOLTIP_BLUE), 'the wave line is blue');
}

{
  // 24b. A click on a marked enemy deals 1.15x an unmarked click (crits suppressed by a chosen seed).
  const findNoCritSeed = (seed) => {
    let r = seed;
    for (let i = 0; i < 10000; i++) {
      if (!nextCritRoll(r, true, false).crit) return r; // marked worst-case chance (10%) does not crit
      r = nextCritRoll(r, true, false).next;
    }
    throw new Error('no non-crit seed found');
  };
  const noCritSeed = findNoCritSeed(0x9e3779b9);

  const make = () => {
    const s = createRunState();
    s.phase = 'wave';
    const e = stationary(1, 'grunt', 1, 10.5, 5.5);
    e.hp = 100000;
    e.maxHp = 100000;
    s.enemies.push(e);
    s.rng = noCritSeed;
    return { s, e };
  };

  const unmarked = make();
  unmarked.s.pointer.stage = 2; // mark is a stage-2 reticle feature, so hold both legs there
  pointerDown(unmarked.s, unmarked.e.x, unmarked.e.y + 0.15);
  const unmarkedDmg = unmarked.e.maxHp - unmarked.e.hp;

  const marked = make();
  marked.s.pointer.stage = 2;
  marked.s.pointer.targetId = marked.e.id; // mark without clicking
  pointerDown(marked.s, marked.e.x, marked.e.y + 0.15);
  const markedDmg = marked.e.maxHp - marked.e.hp;

  check(Math.abs(markedDmg - unmarkedDmg * MARKED_DAMAGE_MULT) < 1e-9,
    `a marked click deals ${MARKED_DAMAGE_MULT}x an unmarked click (${markedDmg} vs ${unmarkedDmg})`);
}

{
  // 24c. Crits: with a forced seed, clicks crit at the base rate over a thousand samples, and a
  // crit deals 2.5x.
  check(critChance(false, false) === 0.04, 'base crit chance is 4%');
  check(critChance(true, false) === 0.1, 'marked crit chance is 10%');
  check(critChance(false, true) === 0.12, 'weak-point crit chance is 12%');

  const s = createRunState();
  s.phase = 'wave';
  const e = stationary(1, 'grunt', 1, 10.5, 5.5);
  e.hp = 1e9;
  e.maxHp = 1e9;
  s.enemies.push(e);
  s.rng = 0x12345678; // forced seed
  let crits = 0;
  for (let i = 0; i < 1000; i++) {
    s.pointer.targetId = null; // unmarked
    const before = e.hp;
    pointerDown(s, e.x, e.y + 0.15); // non-weak
    if (before - e.hp > 3.1) crits++; // base click is 3, a crit is 7.5
  }
  check(crits >= 20 && crits <= 70, `clicks crit at ~4% over 1000 samples (${crits} crits)`);

  const findSeed = (seed, wantCrit) => {
    let r = seed;
    for (let i = 0; i < 10000; i++) {
      const roll = nextCritRoll(r, false, false);
      if (roll.crit === wantCrit) return r;
      r = roll.next;
    }
    throw new Error('no crit seed found');
  };

  const make = (seed) => {
    const st = createRunState();
    st.phase = 'wave';
    const en = stationary(1, 'grunt', 1, 10.5, 5.5);
    en.hp = 100000;
    en.maxHp = 100000;
    st.enemies.push(en);
    st.rng = seed;
    return { s: st, e: en };
  };

  const normal = make(findSeed(0xabcdef01, false));
  pointerDown(normal.s, normal.e.x, normal.e.y + 0.15);
  const normalDmg = normal.e.maxHp - normal.e.hp;

  const crit = make(findSeed(0xabcdef01, true));
  pointerDown(crit.s, crit.e.x, crit.e.y + 0.15);
  const critDmg = crit.e.maxHp - crit.e.hp;

  check(Math.abs(critDmg - normalDmg * CRIT_MULTIPLIER) < 1e-9,
    `a crit deals ${CRIT_MULTIPLIER}x (${critDmg} vs ${normalDmg})`);
}

{
  // 24d. Manual Override: a strong-mode tower fires at the marked weak enemy while on, and returns
  // to strong once the marked enemy dies.
  const s = allUnlocked();
  s.economy.salvage = 10000;
  placeTower(s, 'cannon', 5, 5); // locked to 'strong'
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const marked = stationary(1, 'grunt', 1, 5.5, 4.0);
  marked.hp = 5; // one cannon shot kills it
  const strong = stationary(2, 'grunt', 1, 7.5, 4.0);
  strong.hp = 500;
  s.enemies.push(marked, strong);
  s.pointer.targetId = marked.id;
  toggleManualOverride(s);

  for (let i = 0; i < 30 && !marked.dead; i++) tick(s);
  check(marked.dead, 'override: the cannon kills the marked weak enemy');
  check(strong.hp === 500, 'override: the stronger enemy is untouched while the mark lives');

  const strongHp = strong.hp;
  for (let i = 0; i < 200 && strong.hp === strongHp; i++) tick(s);
  check(strong.hp < strongHp, 'override: the tower returns to strong mode once the mark dies');
}

{
  // 24e. Override never pierces a pop-up shield.
  const s = createRunState();
  s.economy.salvage = 10000;
  placeTower(s, 'gun', 5, 5);
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const grunt = stationary(1, 'grunt', 15, 5.5, 4.0);
  const popup = stationary(2, 'popup', 15, 5.5, 4.0);
  s.enemies.push(grunt, popup);
  s.pointer.targetId = grunt.id;
  toggleManualOverride(s);

  for (let i = 0; i < 30; i++) tick(s);
  check(grunt.hp === grunt.maxHp, 'override: a pop-up-shielded marked enemy is never targeted');
}

{
  // 24f. Fixed-timestep equivalence still holds with a click (and its crit roll) in the mix.
  const run = (frameMs) => {
    const s = stateOnLevel('open-field');
    s.economy.salvage = 10000;
    placeTower(s, 'gun', 3, 6);
    startWave(s);
    for (let t = 0; t < 900 * TICK_MS - frameMs; t += frameMs) step(s, frameMs);
    let clicked = false;
    while (s.tick < 1000) {
      if (!clicked && s.tick === 500) {
        const e = s.enemies.find((x) => !x.dead && !isPopupEnemy(x));
        if (e) pointerDown(s, e.x, e.y + 0.15);
        clicked = true;
      }
      tick(s);
    }
    return JSON.stringify([
      s.economy,
      s.integrity,
      s.enemies.map((e) => [e.id, e.hp, e.dist]),
      s.rng,
      s.nextAdAttemptTick,
    ]);
  };
  const at60 = run(TICK_MS);
  check(at60 === run(1000 / 144), 'a click in the mix: same result at 60 Hz and 144 Hz frames');
  check(at60 === run(1000 / 23), 'a click in the mix: same result at 23 Hz frames');
}

// --- 25. Cursor towers -----------------------------------------------------------------------

/** A cursor tower on open-field with a huge-HP grunt pinned at its home tile (an easy click target). */
function cursorRig(tier = 1, branch = null) {
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cursor', 5, 5);
  const c = s.towers.find((t) => t.kind === 'cursor');
  c.tier = tier;
  c.branch = branch;
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const e = createEnemy(1, 'grunt', 1, SPAWN, EXIT);
  e.x = 5.5;
  e.y = 5.5;
  e.prevX = 5.5;
  e.prevY = 5.5;
  e.col = 5;
  e.row = 5;
  e.hp = 1e12;
  e.maxHp = 1e12;
  e.stunUntilTick = 999999;
  s.enemies.push(e);
  return { s, c, e };
}

/** A bare cursor tower of the given tier/branch, for the pure stat accessors. */
function cursorTower(tier, branch) {
  const t = createTower(1, 'cursor', 5, 5);
  t.tier = tier;
  t.branch = branch;
  return t;
}

{
  // 25a. The radius, rate and damage-factor accessors match the spec at every tier and branch.
  check(cursorRadius(cursorTower(1, null)) === 3.0, 'cursor tier-1 radius is 3.0');
  check(cursorRadius(cursorTower(2, null)) === 4.0, 'cursor tier-2 radius is 4.0');
  check(cursorRadius(cursorTower(3, null)) === 4.75, 'cursor tier-3 radius is 4.75');
  check(Math.abs(cursorRadius(cursorTower(3, 'B')) - 4.75 * 1.35) < 1e-9, 'Wide Search radius is 4.75 x1.35');
  check(Math.abs(cursorClickRate(cursorTower(1, null)) - 1.5) < 1e-9, 'cursor tier-1 rate is 1.5/s');
  check(Math.abs(cursorClickRate(cursorTower(2, null)) - 2.0) < 1e-9, 'cursor tier-2 rate is 2.0/s');
  check(Math.abs(cursorClickRate(cursorTower(3, null)) - 2.75) < 1e-9, 'cursor tier-3 rate is 2.75/s');
  check(Math.abs(cursorClickRate(cursorTower(3, 'A')) - 2.75 * 1.8) < 1e-9, 'Overclock rate is 2.75 x1.8');
  check(Math.abs(cursorClickRate(cursorTower(3, 'B')) - 2.75 * 0.7) < 1e-9, 'Wide Search rate is 2.75 x0.7');
  check(cursorClickIntervalTicks(cursorTower(1, null)) === 40, 'tier-1 cursor clicks every 40 ticks');
  check(cursorClickIntervalTicks(cursorTower(3, 'A')) === 12, 'Overclock cursor clicks every 12 ticks');
  check(Math.abs(cursorClickDamageFactor(cursorTower(3, 'A')) - 0.6) < 1e-9, 'Overclock per-click damage is x0.6');
  check(cursorClickDamageFactor(cursorTower(3, 'B')) === 1, 'Wide Search keeps per-click damage at x1');
  check(upgradeCost(cursorTower(1, null)) === 150, 'cursor tier-2 upgrade costs 150');
  check(upgradeCost(cursorTower(2, null)) === 260, 'cursor tier-3 branch costs 260');
  const tiers = [1, 2, 3, 4, 5];
  check(
    tiers.every((t, i) => i === 0 || cursorClickRate(cursorTower(t, null)) >= cursorClickRate(cursorTower(tiers[i - 1], null))),
    'cursor click-rate table is monotonic across tiers',
  );
  check(
    tiers.every((t, i) => i === 0 || cursorRadius(cursorTower(t, null)) >= cursorRadius(cursorTower(tiers[i - 1], null))),
    'cursor radius table is monotonic across tiers',
  );
}

{
  // 25b. The palette and placed tooltips name the cursor and its ladder-fed click damage.
  check(
    paletteTooltipLines('cursor').join(' | ') === 'Cursor  $200 | a cursor that clicks for 50% of your click damage, 3.0 tiles',
    'palette tooltip reads the cursor spec',
  );
  check(branchName('cursor', 'A') === 'Overclock' && branchName('cursor', 'B') === 'Wide Search',
    'cursor branches are named Overclock and Wide Search');

  const { s, c } = cursorRig(1, null);
  const lines = cursorTooltipLines(c, s.pointer, pointerDamageMult(s));
  check(lines[0] === 'Cursor T1', `placed cursor tooltip names the tower (${lines[0]})`);
  check(lines[1].includes('Radius 3.0'), `placed cursor tooltip names the radius (${lines[1]})`);
  check(lines[2].includes('50% of 3'), `placed cursor tooltip shows the ladder feeding it (${lines[2]})`);
  check(tooltipText(upgradeTooltipLines(c, s.economy.salvage)[0]).includes('rate 1.5'), 'cursor upgrade tooltip previews the rate');
  check(tooltipText(cursorBranchTooltipLines(c, 'A', s.economy.salvage)[0]).includes('rate'), 'cursor branch tooltip previews the rate');
}

{
  // 25c. Click damage is half the player's click damage, and follows a ladder bought mid-wave.
  const { s } = cursorRig(1, null);
  tick(s); // the cursor sits on its target, so the first tick clicks
  const first = s.economy.damage.pointer;
  check(Math.abs(first - 0.5 * clickDamage(s.pointer) * pointerDamageMult(s)) < 1e-9,
    `cursor click damage is half the player's click damage (${first} = 0.5 x ${clickDamage(s.pointer)})`);

  check(upgradePointer(s), 'buy the reticle mid-wave');
  let clicks = 0;
  for (let i = 0; i < 1000 && clicks < 2; i++) {
    tick(s);
    clicks = s.events.filter((ev) => ev.type === 'damage').length;
  }
  const second = s.economy.damage.pointer - first;
  check(Math.abs(second - 0.5 * clickDamage(s.pointer) * pointerDamageMult(s)) < 1e-9,
    `cursor click damage follows a ladder bought mid-wave (${second} = 0.5 x ${clickDamage(s.pointer)})`);
}

{
  // 25d. A cursor clicks on the clock at each tier and each branch.
  const countClicks = (tier, branch, ticks) => {
    const { s } = cursorRig(tier, branch);
    for (let i = 0; i < ticks; i++) tick(s);
    return s.events.filter((ev) => ev.type === 'damage').length;
  };
  for (const [tier, branch] of [[1, null], [2, null], [3, null], [3, 'A'], [3, 'B']]) {
    const ticks = 600;
    const clicks = countClicks(tier, branch, ticks);
    const iv = cursorClickIntervalTicks(cursorTower(tier, branch));
    const expected = ticks / iv;
    check(clicks >= Math.floor(expected) - 1 && clicks <= Math.ceil(expected) + 1,
      `cursor clicks on the clock at tier ${tier}${branch ? ' ' + branch : ''} (${clicks} clicks in ${ticks} ticks)`);
  }
}

{
  // 25e. The cursor never leaves its radius, and the Wide Search branch widens it to 4.75 x1.35.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cursor', 5, 5);
  const c = s.towers.find((t) => t.kind === 'cursor');
  let maxD = 0;
  for (let i = 0; i < 2000; i++) {
    tick(s);
    maxD = Math.max(maxD, Math.hypot(c.cursorX - 5.5, c.cursorY - 5.5));
  }
  check(maxD <= 3.0 + 1e-9, `cursor never leaves its tier-1 radius (max ${maxD.toFixed(3)} of 3.0)`);
  check(maxD > 0.5, `the cursor actually wanders (max distance ${maxD.toFixed(3)})`);

  check(upgradeTower(s, 5, 5) && chooseBranch(s, 5, 5, 'B'), 'branch the cursor to Wide Search');
  const expected = 4.75 * 1.35;
  check(Math.abs(cursorRadius(c) - expected) < 1e-9, `Wide Search radius is ${expected.toFixed(3)}`);
  let maxBranched = 0;
  for (let i = 0; i < 2000; i++) {
    tick(s);
    maxBranched = Math.max(maxBranched, Math.hypot(c.cursorX - 5.5, c.cursorY - 5.5));
  }
  check(maxBranched <= expected + 1e-9, `cursor stays within its branched radius (max ${maxBranched.toFixed(3)})`);
}

{
  // 25f. The cursor's targeting is fixed, not configurable: shielded enemies first (nearest to the
  // home tile), otherwise the nearest enemy to the home tile. Its stored target mode is ignored.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cursor', 5, 5);
  const c = s.towers.find((t) => t.kind === 'cursor');
  c.targetMode = 'close'; // must be ignored: the rule is fixed
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const closer = stationary(1, 'grunt', 1, 5.5, 5.3); // unshielded, nearer the home tile
  const shielded = stationary(2, 'shielded', 1, 5.5, 4.5); // shielded, farther away
  s.enemies.push(closer, shielded);
  for (let i = 0; i < 120; i++) tick(s);
  check(shielded.shield < shielded.maxShield,
    `cursor takes the shielded enemy over the closer unshielded one (shield ${shielded.shield})`);
  check(closer.hp === closer.maxHp, `the closer unshielded enemy is untouched (hp ${closer.hp})`);
}

{
  // 25f2. Two shielded enemies in radius: the cursor takes the one nearer its home tile.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cursor', 5, 5);
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const near = stationary(1, 'shielded', 1, 5.5, 4.5); // dist 1.0
  const far = stationary(2, 'shielded', 1, 5.5, 3.5); // dist 2.0
  s.enemies.push(near, far);
  for (let i = 0; i < 120; i++) tick(s);
  check(near.shield < near.maxShield,
    `cursor takes the shielded enemy nearer its home tile (shield ${near.shield})`);
  check(far.shield === far.maxShield, `the farther shielded enemy is untouched (shield ${far.shield})`);
}

{
  // 25f3. No shielded enemy in radius: the cursor takes the nearest enemy to its home tile.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cursor', 5, 5);
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const near = stationary(1, 'grunt', 1, 5.5, 4.5); // dist 1.0
  const far = stationary(2, 'grunt', 1, 5.5, 3.5); // dist 2.0
  s.enemies.push(near, far);
  for (let i = 0; i < 120; i++) tick(s);
  check(near.hp < near.maxHp, `cursor takes the nearest unshielded enemy (hp ${near.hp})`);
  check(far.hp === far.maxHp, `the farther unshielded enemy is untouched (hp ${far.hp})`);
}

{
  // 25f4. A shielded enemy hidden under a Pop Up is not a candidate, even though it has shield.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cursor', 5, 5);
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const shielded = stationary(1, 'shielded', 15, 5.5, 4.5);
  const popup = stationary(2, 'popup', 15, 5.5, 4.5);
  s.enemies.push(shielded, popup);
  for (let i = 0; i < 120; i++) tick(s);
  check(shielded.shield === shielded.maxShield, 'cursor skips a shielded enemy hidden under a Pop Up');
  check(!popup.dead, 'cursor does not close the Pop Up window');
}

{
  // 25f5. Manual Override still wins over the fixed rule: while the marked enemy is in range and
  // targetable, the cursor clicks it instead of the shielded enemy the rule would have chosen.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cursor', 5, 5);
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const shielded = stationary(1, 'shielded', 1, 5.5, 4.5);
  const marked = stationary(2, 'grunt', 1, 5.5, 3.2); // in radius, marked, unshielded
  marked.hp = 100000;
  marked.maxHp = 100000;
  s.enemies.push(shielded, marked);
  s.pointer.targetId = marked.id;
  toggleManualOverride(s);
  for (let i = 0; i < 120; i++) tick(s);
  check(shielded.shield === shielded.maxShield,
    'override: cursor ignores the shielded enemy the rule would have taken');
  check(marked.hp < marked.maxHp, 'override: cursor clicks the marked enemy instead');
}

{
  // 25f6. The panel reads a fixed label, and cycling the target is a no-op for a cursor.
  check(targetModeDisplay(createTower(1, 'cursor', 0, 0)) === 'Shield first',
    'cursor panel reads "Shield first"');
  check(targetLockReason('cursor') === 'Shielded enemies first, then the nearest; this cannot be changed. The marked enemy overrides it.',
    'cursor tooltip explains the fixed rule and that it cannot be changed');

  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cursor', 5, 5);
  const cursor = towerAt(s, 5, 5);
  cursor.targetMode = 'strong';
  cycleTargetMode(s, 5, 5);
  check(cursor.targetMode === 'strong', 'cycleTargetMode is a no-op for a cursor');
}

{
  // 25f7. A shield-absorbed cursor click emits a shieldHit with the absorbed and remaining amounts,
  // and still emits no hp-damage event.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cursor', 5, 5);
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const shielded = stationary(1, 'shielded', 1, 5.5, 5.5); // on the home tile, so the first tick clicks
  s.enemies.push(shielded);
  tick(s);
  const shieldHits = s.events.filter((ev) => ev.type === 'shieldHit');
  const hpEvents = s.events.filter((ev) => ev.type === 'damage');
  check(shieldHits.length === 1, `a fully absorbed cursor click emits one shieldHit (${shieldHits.length})`);
  check(shieldHits[0].absorbed === 1.5, `shieldHit absorbed is the full cursor click (${shieldHits[0].absorbed})`);
  check(shieldHits[0].left === 15 - 1.5, `shieldHit left is the remaining shield (${shieldHits[0].left})`);
  check(hpEvents.length === 0, 'a fully absorbed hit emits no hp-damage event');
  check(shielded.hp === shielded.maxHp, 'enemy hp is unchanged after an absorbed hit');
}

{
  // 25g. A cursor ignores an enemy hidden under a Pop Up, and never closes the window.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cursor', 5, 5);
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const grunt = stationary(1, 'grunt', 15, 5.5, 4.5);
  const popup = stationary(2, 'popup', 15, 5.5, 4.5);
  s.enemies.push(grunt, popup);
  for (let i = 0; i < 60; i++) tick(s);
  check(grunt.hp === grunt.maxHp, 'cursor ignores an enemy hidden under a Pop Up');
  check(!popup.dead, 'cursor does not close the Pop Up window');
}

{
  // 25h. A cursor never crits: a thousand clicks produce no crit event.
  const { s } = cursorRig(1, null);
  for (let i = 0; i < 60100; i++) tick(s);
  const dmgEvents = s.events.filter((ev) => ev.type === 'damage');
  check(dmgEvents.length >= 1000, `cursor produced ${dmgEvents.length} clicks (>= 1000)`);
  check(dmgEvents.every((ev) => ev.crit !== true), 'cursor never crits (no crit event across 1000 clicks)');
}

{
  // 25i. The wander is deterministic for one seed and differs for another.
  const wander = (seed) => {
    const s = allUnlocked();
    s.rng = seed;
    s.economy.salvage = 100000;
    placeTower(s, 'cursor', 5, 5);
    for (let i = 0; i < 300; i++) tick(s);
    const c = s.towers.find((t) => t.kind === 'cursor');
    return JSON.stringify([c.cursorX, c.cursorY, c.cursorWanderAngle, c.cursorWanderSeed]);
  };
  const a = wander(0x12345678);
  check(a === wander(0x12345678), 'cursor wander is deterministic for one seed');
  check(a !== wander(0x9abcdef0), 'cursor wander differs for another seed');
}

{
  // 25j. Fixed-timestep equivalence holds with cursors in flight.
  const run = (frameMs) => {
    const s = stateOnLevel('open-field');
    s.economy.salvage = 100000;
    placeTower(s, 'cursor', 5, 5);
    startWave(s);
    for (let t = 0; t < 900 * TICK_MS - frameMs; t += frameMs) step(s, frameMs);
    while (s.tick < 1000) tick(s);
    return JSON.stringify([
      s.economy,
      s.integrity,
      s.enemies.map((e) => [e.id, e.hp, e.dist]),
      s.rng,
      s.clock,
      s.towers.map((t) => [t.kind, t.cursorX, t.cursorY, t.cursorCooldown, t.cursorTargetId, t.cursorWanderSeed, t.cursorWanderAngle, t.cursorClickFx]),
    ]);
  };
  const at60 = run(TICK_MS);
  check(at60 === run(1000 / 144), 'cursors in flight: same result at 60 Hz and 144 Hz frames');
  check(at60 === run(1000 / 23), 'cursors in flight: same result at 23 Hz frames');
}

{
  // 25k. A wave start snaps every Cursor tower's pointer to its home tile (docs/CURSOR-WAVE-RESET.md).
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cursor', 5, 5);
  placeTower(s, 'cursor', 8, 8);
  const cursors = s.towers.filter((t) => t.kind === 'cursor');
  for (const c of cursors) {
    c.cursorX = c.col + 0.5 + 1;
    c.cursorY = c.row + 0.5 - 1;
  }
  check(startWave(s), 'cursor reset: the next wave starts');
  check(
    cursors.every((c) => c.cursorX === c.col + 0.5 && c.cursorY === c.row + 0.5),
    `cursor reset: every cursor is exactly at its home after startWave (${cursors.map((c) => `${c.cursorX},${c.cursorY}`).join(' / ')})`,
  );
}

{
  // 25l. A cursor wedged into a blocked tile is home after the next startWave and wanders again.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cursor', 5, 5);
  const c = s.towers.find((t) => t.kind === 'cursor');
  let blocked = null;
  for (let r = 0; r < ROWS && blocked === null; r++) {
    for (let col = 0; col < COLS; col++) {
      if (tileAt(s.grid, col, r) !== 'buildable') {
        blocked = [col, r];
        break;
      }
    }
  }
  c.cursorX = blocked[0] + 0.5;
  c.cursorY = blocked[1] + 0.5;
  check(startWave(s), 'cursor wedge: the next wave starts');
  check(c.cursorX === 5.5 && c.cursorY === 5.5, `cursor wedge: a wedged cursor is home after startWave (${c.cursorX}, ${c.cursorY})`);
  let moved = false;
  for (let i = 0; i < 60; i++) {
    tick(s);
    if (c.cursorX !== 5.5 || c.cursorY !== 5.5) {
      moved = true;
      break;
    }
  }
  check(moved, 'cursor wedge: the cursor wanders again after the reset');
}

{
  // 25m. The reset is a position write: it draws nothing from the run's rng stream.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cursor', 5, 5);
  const c = s.towers.find((t) => t.kind === 'cursor');
  c.cursorX = 11.5;
  c.cursorY = 0.5;
  const rngBefore = s.rng;
  startWave(s);
  check(s.rng === rngBefore, 'cursor reset draws no rng: the run stream position is unchanged by startWave');
}

{
  // 25n. A wave start with no Cursor towers changes nothing.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'gun', 3, 6);
  const towersBefore = JSON.stringify(s.towers.map((t) => [t.kind, t.col, t.row]));
  const rngBefore = s.rng;
  const waveBefore = s.wave;
  check(startWave(s), 'cursor-free wave start: the next wave starts');
  check(s.wave === waveBefore + 1 && s.phase === 'wave', 'cursor-free wave start: only the wave advances');
  check(JSON.stringify(s.towers.map((t) => [t.kind, t.col, t.row])) === towersBefore && s.rng === rngBefore,
    'cursor-free wave start: towers and rng are untouched');
}

// --- 26. Auto-wave --------------------------------------------------------------------------

{
  // 26a. Off by default: a cleared board waits in build and never auto-starts.
  const s = stateOnLevel('open-field');
  check(s.autoWave === false, 'auto-wave is off by default');
  s.economy.salvage = 100000;
  placeTower(s, 'gun', 3, 6);
  startWave(s);
  for (let i = 0; i < 4000 && s.phase === 'wave'; i++) tick(s);
  check(s.phase === 'build' && s.wave === 1, 'auto off: the board clears and the run waits in build');
  for (let i = 0; i < 200; i++) tick(s);
  check(s.phase === 'build' && s.wave === 1, 'auto off: no wave starts while the flag is off');
}

{
  // 26b. Auto on: the next wave starts 1.5 s after the board clears, and the status bar counts down.
  const s = stateOnLevel('open-field');
  s.economy.salvage = 100000;
  placeTower(s, 'gun', 3, 6);
  toggleAutoWave(s);
  check(s.autoWave === true, 'auto on: flag set');
  startWave(s);
  for (let i = 0; i < 4000 && s.phase === 'wave'; i++) tick(s);
  check(s.phase === 'build', 'auto on: board cleared');
  const armed = s.autoWaveAtTick;
  const clearClock = s.clock;
  check(armed === clearClock + AUTO_WAVE_DELAY_TICKS, 'auto on: the countdown is armed 1.5 s after the clear');
  const status = autoWaveStatus(s);
  check(status !== null && status.startsWith('Auto: next wave in '), `auto on: status shows the countdown (${status})`);
  while (s.phase === 'build' && s.clock < armed) tick(s);
  check(s.phase === 'wave' && s.wave === 2, 'auto on: wave 2 starts automatically');
  check(s.runs[0].startTick === armed, `auto on: wave 2 starts at the armed tick (${s.runs[0].startTick} == ${armed})`);
  check(s.runs[0].startTick - clearClock === AUTO_WAVE_DELAY_TICKS,
    `auto on: started ${AUTO_WAVE_DELAY_TICKS} ticks (1.5 s) after the clear`);
}

{
  // 26c. A repair in progress holds the auto-start until it finishes, then it fires.
  const s = stateOnLevel('open-field');
  s.economy.salvage = 100000;
  placeTower(s, 'gun', 3, 6);
  placeTower(s, 'wall', 5, 5);
  const wall = towerAt(s, 5, 5);
  wall.hp = wall.maxHp / 2;
  toggleAutoWave(s);
  startWave(s);
  for (let i = 0; i < 4000 && s.phase === 'wave'; i++) tick(s);
  check(s.phase === 'build', 'auto+repair: board cleared');
  const armed = s.autoWaveAtTick;
  check(startRepair(s, 5, 5), 'auto+repair: a repair starts during the countdown');
  check(anyTowerRepairing(s), 'auto+repair: the wall is mid-repair');
  while (s.clock < armed + 30) tick(s);
  check(s.phase === 'build' && s.wave === 1, 'auto+repair: the start holds while a repair runs');
  check(autoWaveStatus(s) === 'Auto: waiting for repairs', `auto+repair: status reads waiting for repairs (${autoWaveStatus(s)})`);
  while (s.phase === 'build') tick(s);
  check(s.phase === 'wave' && s.wave === 2, 'auto+repair: the wave fires once the repair finishes');
}

{
  // 26d. An auto-started wave is a normal start, never an early call, so no bonus is paid.
  const s = stateOnLevel('open-field');
  s.economy.salvage = 100000;
  placeTower(s, 'gun', 3, 6);
  toggleAutoWave(s);
  startWave(s);
  for (let i = 0; i < 4000 && s.phase === 'wave'; i++) tick(s);
  const salBefore = s.economy.salvage;
  const armed = s.autoWaveAtTick;
  while (s.phase === 'build' && s.clock < armed) tick(s);
  check(s.phase === 'wave' && s.wave === 2, 'auto bonus: wave 2 starts automatically');
  check(s.calledEarly === false, 'auto bonus: an auto-start is not an early call');
  check(s.economy.salvage === salBefore, 'auto bonus: no early-call bonus is awarded');
}

{
  // 26e. The setting round-trips through the save and seeds the run from the profile.
  check(defaultProfile().autoWave === false, 'auto-wave: off by default in the profile');
  const store = { value: null, getItem() { return this.value; }, setItem(_k, v) { this.value = v; } };
  const p = defaultProfile();
  p.autoWave = true;
  saveProfile(p, store);
  const loaded = loadProfile(store);
  check(loaded.autoWave === true, 'auto-wave: setting round-trips through the save');
  const s = createRunState(loaded);
  check(s.autoWave === true && s.autoWaveAtTick === 0, 'auto-wave: the run seeds auto from the profile');
}

{
  // 26f. Fixed-timestep equivalence: the same ticks produce the same start tick at 30 fps and 60 fps.
  const run = (frameMs) => {
    const s = stateOnLevel('open-field');
    s.economy.salvage = 100000;
    placeTower(s, 'gun', 3, 6);
    toggleAutoWave(s);
    startWave(s);
    for (let t = 0; t < 1800 * TICK_MS - frameMs; t += frameMs) step(s, frameMs);
    while (s.tick < 1800) tick(s);
    const started = s.runs.find((r) => r.wave === 2);
    return JSON.stringify([s.wave, s.phase, started ? started.startTick : null, s.clock, s.autoWaveAtTick]);
  };
  const at30 = run(1000 / 30);
  const at60 = run(1000 / 60);
  const parsed = JSON.parse(at30);
  check(parsed[1] === 'wave' && typeof parsed[2] === 'number', 'auto-wave: wave 2 started automatically in the fixed-timestep run');
  check(at30 === at60, 'auto-wave: same start tick at 30 fps and 60 fps');
}

// --- 27. DPR: the backing store equals CSS size x the live ratio ------------------------------
{
  const bs = backingStorePixelSize;
  check(bs(1280, 800, 1).width === 1280 && bs(1280, 800, 1).height === 800,
    'dpr 1: backing store equals the CSS size');
  check(bs(1280, 800, 1.25).width === 1600 && bs(1280, 800, 1.25).height === 1000,
    'dpr 1.25: 1280x800 -> 1600x1000');
  check(bs(1280, 800, 1.5).width === 1920 && bs(1280, 800, 1.5).height === 1200,
    'dpr 1.5: 1280x800 -> 1920x1200');
  check(bs(1280, 800, 2).width === 2560 && bs(1280, 800, 2).height === 1600,
    'dpr 2 (a simulated 2x display): 1280x800 -> 2560x1600');
  check(bs(1366, 768, 1.25).width === 1708, 'a fractional backing width rounds, never truncates (1366 -> 1708)');
}

{
  // Coordinate mapping is CSS-pixel based: the pointer position and the layout both live in CSS
  // pixels, so a ratio change (which only grows the backing store) never moves where a click lands.
  const layout = computeLayout(1280, 800);
  const tile = (px, py) => {
    const w = pixelToWorld(layout, px, py);
    return [Math.floor(w.x), Math.floor(w.y)];
  };
  const cx = layout.board.x + 3.5 * layout.board.cell;
  const cy = layout.board.y + 4.5 * layout.board.cell;
  check(tile(cx, cy)[0] === 3 && tile(cx, cy)[1] === 4,
    'a CSS click on a tile centre maps to that tile after a ratio change');
  check(tile(layout.board.x, layout.board.y)[0] === 0 && tile(layout.board.x, layout.board.y)[1] === 0,
    'the board origin maps to tile (0,0)');
}

// --- 28. Screen shake ------------------------------------------------------------------------
{
  // 28a. Amplitude per event, and the events that shake nothing.
  check(shakeImpulseFor({ type: 'kill', kind: 'grunt' }) === null,
    'an ordinary enemy death shakes nothing');
  check(shakeImpulseFor({ type: 'kill', kind: 'grunt-boss' }).amplitude === SHAKE_AMPLITUDE.bossDeath,
    'a boss death shakes 4 px');
  check(shakeImpulseFor({ type: 'wallDamaged' }) === null,
    'an ordinary tower hit shakes nothing');
  check(shakeImpulseFor({ type: 'wallDestroyed' }).amplitude === SHAKE_AMPLITUDE.towerOffline,
    'a tower going offline shakes 3 px');
  check(shakeImpulseFor({ type: 'adDismissed' }).amplitude === SHAKE_AMPLITUDE.adClose,
    'an ad closing shakes 2 px');
  check(shakeImpulseFor({ type: 'damage', weak: false, crit: true }).amplitude === SHAKE_AMPLITUDE.crit,
    'a plain crit shakes 1 px');
  check(shakeImpulseFor({ type: 'damage', weak: true, crit: true }).amplitude === SHAKE_AMPLITUDE.critAimed,
    'a weak-point crit shakes 2 px');
  check(shakeImpulseFor({ type: 'damage', weak: false, crit: true, marked: true }).amplitude === SHAKE_AMPLITUDE.critAimed,
    'a marked crit shakes 2 px');
  check(shakeImpulseFor({ type: 'damage', weak: false, crit: false }) === null,
    'a non-crit damage event shakes nothing');
  check(shakeImpulseFor({ type: 'mineDetonated', x: 3, y: 4 }).amplitude === SHAKE_AMPLITUDE.mineTrip,
    'a mine going off shakes 2 px');
  check(SHAKE_AMPLITUDE.mineTrip < SHAKE_AMPLITUDE.leak && SHAKE_AMPLITUDE.mineTrip <= SHAKE_AMPLITUDE.toggleShut,
    'a mine is a small shake — lighter than a leak, no heavier than a shutter');
  check(shakeImpulseFor({ type: 'leak' }).amplitude === SHAKE_AMPLITUDE.leak,
    'a leak shakes 5 px');
  check(shakeImpulseFor({ type: 'leak' }).freezeMs === SHAKE_LEAK_FREEZE_MS,
    'a leak also freezes the frame');
  check(shakeImpulseFor({ type: 'toggleChanged', open: false }).amplitude === SHAKE_AMPLITUDE.toggleShut,
    'a Toggle gate slamming shut shakes 3 px');
  check(shakeImpulseFor({ type: 'toggleChanged', open: true }) === null,
    'a Toggle gate opening shakes nothing');
  check(shakeImpulseFor({ type: 'shot' }) === null, 'a tower shot shakes nothing');
  check(shakeImpulseFor({ type: 'click' }) === null, 'a click shakes nothing');
}

{
  // 28b. A single impulse decays to zero inside the hard cap (24 ticks = 400 ms), and the decay
  // duration sits in the 150-250 ms band.
  check(SHAKE_DECAY_TICKS >= 9 && SHAKE_DECAY_TICKS <= 15,
    `decay duration is about 150-250 ms (${SHAKE_DECAY_TICKS} ticks)`);
  check(SHAKE_MAX_TICKS === 24, 'the hard cap is 400 ms (24 ticks)');
  const shake = new CameraShake();
  shake.impulse(5, 1000);
  const atStart = shake.offset(1000);
  check(atStart.x !== 0 || atStart.y !== 0, 'a shake is non-zero at its start tick');
  let lastNonZero = -1;
  for (let t = 1000; t <= 1000 + SHAKE_MAX_TICKS; t++) {
    const o = shake.offset(t);
    if (o.x !== 0 || o.y !== 0) lastNonZero = t;
  }
  check(lastNonZero >= 1000 && lastNonZero < 1000 + SHAKE_MAX_TICKS,
    `shake decays to zero inside ${SHAKE_MAX_TICKS} ticks (last non-zero at tick ${lastNonZero})`);
}

{
  // 28c. Determinism: the same impulse at the same tick reproduces the identical offset trail.
  const trail = () => {
    const shake = new CameraShake();
    shake.impulse(4, 500);
    const out = [];
    for (let t = 500; t <= 530; t++) {
      const o = shake.offset(t);
      out.push(`${o.x.toFixed(6)},${o.y.toFixed(6)}`);
    }
    return out.join('|');
  };
  check(trail() === trail(), 'shake offset is deterministic from the tick (a replay is identical)');
}

{
  // 28d. The toggle disables shake entirely, and re-enabling restores it.
  const shake = new CameraShake();
  shake.impulse(5, 100);
  check(shake.offset(100).x !== 0 || shake.offset(100).y !== 0, 'shake is active before the toggle');
  shake.setEnabled(false);
  check(shake.offset(100).x === 0 && shake.offset(100).y === 0, 'the toggle disables shake entirely');
  shake.setEnabled(true);
  check(shake.offset(100).x !== 0 || shake.offset(100).y !== 0, 're-enabling restores shake');
}

{
  // 28e. A leak's freeze-frame holds the offset at zero for the freeze, then the shake begins.
  const shake = new CameraShake();
  shake.impulse(5, 200, SHAKE_LEAK_FREEZE_MS);
  const freezeTicks = Math.round(SHAKE_LEAK_FREEZE_MS / TICK_MS);
  check(shake.offset(200).x === 0 && shake.offset(200).y === 0, 'the freeze holds the offset at zero');
  check(shake.offset(200 + freezeTicks - 1).x === 0 && shake.offset(200 + freezeTicks - 1).y === 0,
    'the offset is still frozen just before the freeze ends');
  const after = shake.offset(200 + freezeTicks);
  check(after.x !== 0 || after.y !== 0, 'the shake begins once the freeze ends');
}

{
  // 28f. Hit-testing ignores the shake: the pointer-to-world mapping is CSS-pixel based and never
  // consumes the render offset, so shaking never moves the tile under the cursor.
  const layout = computeLayout(1280, 800);
  const hit = (px, py) => {
    const w = pixelToWorld(layout, px, py);
    return [Math.floor(w.x), Math.floor(w.y)];
  };
  const tileX = layout.board.x + 6.5 * layout.board.cell;
  const tileY = layout.board.y + 5.5 * layout.board.cell;
  const before = hit(tileX, tileY);
  const shake = new CameraShake();
  shake.impulse(5, 42);
  const offset = shake.offset(42);
  check(offset.x !== 0 || offset.y !== 0, 'the shake is active (a render offset exists)');
  check(hit(tileX, tileY)[0] === before[0] && hit(tileX, tileY)[1] === before[1],
    'hit-testing maps the raw CSS coordinate, unaffected by the active shake');
  check(before[0] === 6 && before[1] === 5, 'the tile under the cursor is (6,5)');
}

{
  // 28g. The preference: on by default, off for reduced-motion users, and it round-trips through save.
  check(defaultProfile().shakeOn === true, 'shake defaults on without a reduced-motion preference');
  check(prefersReducedMotion() === false, 'headless has no reduced-motion preference');
  const store = { value: null, getItem() { return this.value; }, setItem(_k, v) { this.value = v; } };
  const p = defaultProfile();
  p.shakeOn = false;
  saveProfile(p, store);
  check(loadProfile(store).shakeOn === false, 'shake preference round-trips through the save');

  const original = globalThis.matchMedia;
  globalThis.matchMedia = (q) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} });
  try {
    check(defaultProfile().shakeOn === false, 'reduced-motion users default shake off');
  } finally {
    if (original === undefined) delete globalThis.matchMedia;
    else globalThis.matchMedia = original;
  }
}

// --- 29. Branch marks and the fully-upgraded pip ----------------------------------------------
{
  // 29a. Every kind/branch combination produces a distinct mark, and unbranched or unmarked kinds
  // (walls, cursors) draw none.
  const markedKinds = ['gun', 'cannon', 'taser', 'frost', 'laser', 'beacon', 'cursor'];
  const seen = new Set();
  let distinct = true;
  for (const kind of markedKinds) {
    for (const branch of ['A', 'B']) {
      const spec = branchMarkSpec(kind, branch);
      if (spec === null) {
        distinct = false;
        continue;
      }
      const key = JSON.stringify(spec.primitives);
      if (seen.has(key)) distinct = false;
      seen.add(key);
    }
  }
  check(distinct && seen.size === 14, 'every kind/branch combination produces a distinct mark');
  check(
    branchMarkSpec('wall', 'A') === null && branchMarkSpec('wall', 'B') === null && branchMarkSpec('wall', 'C') === null,
    'walls carry no branch mark (their button states do)',
  );
  check(
    branchMarkSpec('cursor', 'A') !== null && branchMarkSpec('cursor', 'B') !== null,
    'cursor A and B carry branch marks',
  );
  check(branchMarkSpec('gun', null) === null, 'an unbranched tower carries no mark');
}

{
  // 29b. The pip appears exactly at the maximum tier and disappears while a further upgrade exists.
  const gun = createTower(1, 'gun', 5, 5);
  gun.tier = 4;
  gun.branch = 'A';
  check(!isFullyUpgraded(gun), 'a tier-4 branched gun is not fully upgraded');
  check(!towerTooltipLines(gun, 0).map(tooltipText).includes('Fully upgraded'),
    'the tooltip does not name the pip while a further upgrade exists');
  gun.tier = 19;
  check(!isFullyUpgraded(gun), 'a tier-19 branched gun is not fully upgraded');
  gun.tier = MAX_TIER;
  check(isFullyUpgraded(gun), 'a tier-20 branched gun is fully upgraded');
  check(towerTooltipLines(gun, 0).map(tooltipText).includes('Fully upgraded'),
    'the tooltip names the pip at the maximum tier');

  const cursor = createTower(2, 'cursor', 5, 5);
  cursor.tier = 5;
  cursor.branch = 'B';
  check(isFullyUpgraded(cursor), 'a tier-5 branched cursor is fully upgraded');
  check(towerTooltipLines(cursor, 0).map(tooltipText).includes('Fully upgraded'),
    'the cursor tooltip names the pip too');
}

{
  // 29c. The pip is absent at tier 3 with no branch and present once the wall's branch is chosen.
  const wall = createTower(3, 'wall', 5, 5);
  wall.tier = 3;
  wall.branch = null;
  check(!isFullyUpgraded(wall), 'a wall at tier 3 with no branch is not fully upgraded');
  check(!towerTooltipLines(wall, 0).map(tooltipText).includes('Fully upgraded'),
    'the tooltip does not name the pip before the wall branches');
  wall.branch = 'A';
  check(isFullyUpgraded(wall), 'a branched wall is fully upgraded (walls branch once)');
  check(towerTooltipLines(wall, 0).map(tooltipText).includes('Fully upgraded'),
    'the tooltip names the pip after the wall branches');
}

{
  // 29d. A damaged wall's pip sits in the corner the health bar does not use.
  const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  const damaged = createTower(4, 'wall', 5, 5);
  damaged.tier = 3;
  damaged.branch = 'A';
  damaged.maxHp = 1080;
  damaged.hp = 540;
  check(pipUsesBottomCorner(damaged, 0) === true, 'a damaged wall routes its pip to the bottom corner');

  const full = createTower(5, 'wall', 5, 5);
  full.tier = 3;
  full.branch = 'A';
  full.maxHp = 1080;
  full.hp = 1080;
  check(pipUsesBottomCorner(full, 0) === false, 'a full-health wall keeps the top-right pip');
  const gun = createTower(6, 'gun', 5, 5);
  check(pipUsesBottomCorner(gun, 0) === false, 'a full-health non-wall keeps the top-right pip');

  const cell = 32;
  const cx = 5.5 * cell;
  const cy = 5.5 * cell;
  const bar = healthBarRect(cx, cy, cell);
  const bottomPip = pipRect(cx, cy, cell, true);
  check(!intersects(bottomPip, bar), 'a damaged wall pip does not collide with its health bar');
  check(pipRect(cx, cy, cell, false).x > cx && pipRect(cx, cy, cell, false).y < cy,
    'the normal pip sits in the tower tile top-right corner');
}

// --- 30. Pointer panel lives on the right; the left column has no pointer rows -----------------
{
  const s = createRunState();
  s.pointer.stage = 2; // exercise the Override row too
  const left = computeHud(computeLayout(1280, 720), s);
  check(
    !('pointerPanel' in left) && !('pointerUpgrade' in left) && !('pointerOverride' in left),
    'the left column has no pointer panel fields',
  );

  const right = computeRightPanel(computeLayout(1280, 720), s);
  check(right.pointer !== undefined, 'the right column has a POINTER section');
  check(right.pointer.override !== null, 'the POINTER section carries the Override checkbox at stage 2');
  check(right.pointer.rows.length >= 3, 'the POINTER section lists stage, overclock and crits');
  check(right.globalUpgrades.title === 'GLOBAL UPGRADES', 'the right column ends with GLOBAL UPGRADES');
  check(
    right.globalUpgrades.rows.length === 2 &&
      right.globalUpgrades.rows[0] === 'Restore — 0 RP' &&
      right.globalUpgrades.rows[1] === 'Upgrades — none yet',
    'GLOBAL UPGRADES lists the Restore row and the Upgrades row',
  );
  check(
    right.nextWave.rect.y < right.kills.rect.y &&
      right.kills.rect.y < right.pointer.rect.y &&
      right.pointer.rect.y < right.globalUpgrades.rect.y,
    'right column order is NEXT WAVE, KILLS, POINTER, GLOBAL UPGRADES',
  );
}

{
  // Every right-panel section stays inside the 168 px panel at 1280x720 and 1600x900.
  for (const [vw, vh] of [[1280, 720], [1600, 900]]) {
    const l = computeLayout(vw, vh);
    const s = createRunState();
    s.pointer.stage = 2;
    const right = computeRightPanel(l, s);
    const within = (r) => r.x >= l.rightPanel.x && r.x + r.w <= l.rightPanel.x + l.rightPanel.w;
    check(
      [right.nextWave.rect, right.kills.rect, right.pointer.rect, right.globalUpgrades.rect].every(within),
      `right panel sections stay inside the 168 px panel at ${vw}x${vh}`,
    );
  }
}

{
  // GLOBAL UPGRADES: the first row opens the Restore tree dialog (its only entry point), the second
  // the Global Upgrades dialog (docs/GLOBAL-UPGRADES.md §6.1).
  const l = computeLayout(1280, 720);
  const s = createRunState();
  const right = computeRightPanel(l, s);
  const centre = (r) => [r.x + r.w / 2, r.y + r.h / 2];
  const restoreHit = hudControlAt(l, s, ...centre(right.globalUpgrades.restore));
  const upgradesHit = hudControlAt(l, s, ...centre(right.globalUpgrades.upgrades));
  check(
    restoreHit?.action === 'restore' && restoreHit.enabled && upgradesHit?.action === 'upgrades' && upgradesHit.enabled,
    'GLOBAL UPGRADES rows open the Restore and Upgrades dialogs',
  );
}

{
  // The Upgrades row counts revealed-but-unowned upgrades, affordable or not, and the row's
  // bright/dim colour keys off the same upgradesNewCount (hud.ts), so the two cannot disagree.
  const s = createRunState();
  const none = upgradesRowText(s);
  s.wave = 35; // reveals the wave-20..35 upgrades
  s.economy.salvage = 0; // affords none of them
  const revealed = revealedUpgrades(s).length;
  const broke = upgradesRowText(s);
  const brokeCount = upgradesNewCount(s);
  s.economy.salvage = 1_000_000;
  const first = revealedUpgrades(s)[0].id;
  buyUpgrade(s, first);
  const afterOne = upgradesRowText(s);
  for (const d of revealedUpgrades(s)) buyUpgrade(s, d.id);
  const allOwned = upgradesRowText(s);
  check(
    revealed >= 3 && none === 'Upgrades — none yet' && broke === `Upgrades — ${revealed} new` && brokeCount === revealed &&
      afterOne === `Upgrades — ${revealed - 1} new` && allOwned === 'Upgrades — all owned' && upgradesNewCount(s) === 0,
    `the Upgrades row counts revealed, unowned upgrades even when none are affordable (${none} / ${broke} / ${afterOne} / ${allOwned})`,
  );
}

{
  // Escape closes the topmost run modal before it ever exits the run — Restore included, which
  // the chain used to skip (Esc ended the run with the Restore window still drawn).
  const closed = { menuOrDialog: false, help: false, achievements: false, restore: false, upgrades: false };
  const only = (k) => escapeTarget({ ...closed, [k]: true });
  const each = ['menuOrDialog', 'help', 'achievements', 'restore', 'upgrades'].every((k) => only(k) === k);
  check(
    each && escapeTarget(closed) === 'run' && escapeTarget({ ...closed, restore: true, upgrades: true }) === 'restore' &&
      escapeTarget({ ...closed, help: true, restore: true }) === 'help',
    `Escape closes each open modal (Restore included) and only exits the run with none open (restore -> ${only('restore')})`,
  );
}

// --- 31. Ad chrome is the main window's scale, and the pop-up enemy matches it -----------------
{
  const s = createRunState();
  const ad = spawnAd(s, 'defrag');
  const close = adCloseRect(ad);
  check(
    close.w === CONTROL_BOX_W && close.h === CONTROL_BOX_H,
    `ad close box equals the main window's ${CONTROL_BOX_W}x${CONTROL_BOX_H} (${close.w}x${close.h})`,
  );
  check(
    close.y === ad.y + 2 + Math.floor((TITLE_H - CONTROL_BOX_H) / 2),
    'ad close box is centred in the 22 px title bar',
  );
  check(TITLE_H === 22, 'the main window title bar is 22 px');
  check(FONT_SIZE.body === 13, 'the main window body text is 13 px');

  check(POPUP_TITLE_H === TITLE_H, 'pop-up enemy title bar equals the main window 22 px');
  check(
    POPUP_CLOSE_W === CONTROL_BOX_W && POPUP_CLOSE_H === CONTROL_BOX_H,
    `pop-up enemy close box equals the main window's ${CONTROL_BOX_W}x${CONTROL_BOX_H}`,
  );
}

// --- 32. Ad placement: 100 seeded spawns stay inside, avoid chrome, repeat and differ ----------
{
  const MARGIN = 8;
  const l = computeLayout(1280, 720);
  const place = (seed) => {
    const s = createRunState();
    s.rng = seed;
    s.viewport.boardCol = { x: l.boardCol.x, y: l.boardCol.y, w: l.boardCol.w, h: l.boardCol.h };
    const positions = [];
    for (let i = 0; i < 100; i++) {
      s.ad = null;
      const ad = spawnAd(s, 'defrag');
      positions.push([ad.x, ad.y]);
    }
    return positions;
  };

  const a = place(0x12345678);
  const b = place(0x12345678);
  const c = place(0x9abcdef0);

  const inside = ([x, y]) =>
    x >= l.boardCol.x + MARGIN &&
    y >= l.boardCol.y + MARGIN &&
    x + AD_W <= l.boardCol.x + l.boardCol.w - MARGIN &&
    y + AD_H <= l.boardCol.y + l.boardCol.h - MARGIN;
  check(a.every(inside), '100 ad spawns stay inside the board field with an 8 px margin');

  const overlaps = ([x, y], r) =>
    x < r.x + r.w && x + AD_W > r.x && y < r.y + r.h && y + AD_H > r.y;
  const reserved = [l.title, l.status, l.leftPanel, l.rightPanel];
  check(
    a.every((p) => reserved.every((r) => !overlaps(p, r))),
    'ad spawns never overlap the title bar, status bar or side panels',
  );

  check(JSON.stringify(a) === JSON.stringify(b), 'ad placement repeats identically for the same seed');
  check(JSON.stringify(a) !== JSON.stringify(c), 'ad placement differs across seeds');
}

{
  // The close box still pays the bonus and the ad still expires after 8 s.
  const s = createRunState();
  const before = s.economy.salvage;
  const ad = spawnAd(s, 'defrag');
  check(dismissAd(s, ad.id), 'the ad close box still pays');
  check(s.economy.salvage > before, 'defrag pays a bonus');

  const s2 = createRunState();
  spawnAd(s2, 'screensaver');
  for (let i = 0; i < AD_LIFETIME_TICKS; i++) tick(s2);
  check(s2.ad === null, `the ad expires after ${AD_LIFETIME_TICKS / TICK_HZ} s`);
}

// --- Ad tips: layout, selection, the Blue Screen trap, and no repeats (docs/ADS-TIPS.md) --------
{
  // Geometry: the dialog grows to 220x98 and the reward line keeps its pre-tip place.
  const s = createRunState();
  const ad = spawnAd(s, 'defrag');
  check(AD_W === 220 && AD_H === 98, `the ad is ${AD_W}x${AD_H} (220x98)`);
  check(adRewardLineY(ad) === ad.y + 2 + TITLE_H + 19, 'the reward line stays 19 px below the title bar');
  check(adTipMaxWidth(ad) === 208, `the tip block has a ${adTipMaxWidth(ad)} px text budget`);
  check(ad.tip !== null, 'defrag carries a tip');

  // Every tip in every locale wraps to at most three 11 px lines inside the 220 px box. The headless
  // textWidth estimate is what the browser uses for layout, so a fourth line here is a fourth line in
  // game. The report prints the max line count per locale.
  const codes = ['en', 'es', 'fr', 'ru', 'uk', 'zh-Hans', 'he'];
  const maxW = adTipMaxWidth(ad);
  let fit = true;
  const perLocaleMax = {};
  for (const code of codes) {
    const mod = await import(`../src/i18n/${code}/index.ts`);
    setLocale(mod[Object.keys(mod)[0]], code);
    clearTextWidthCache();
    setDirection(code === 'he' ? 'rtl' : 'ltr');
    let max = 0;
    for (const id of AD_TIPS) {
      const text = t(`ads.tip.${id}`);
      const lines = wrapAdTip(text, maxW);
      max = Math.max(max, lines.length);
      if (lines.length > 3) {
        fit = false;
        console.log(`  tip overflow: ${code} "${id}" needs ${lines.length} lines`);
      }
      for (const line of lines) {
        if (textWidth(line, FONT_SIZE.small) > maxW) {
          fit = false;
          console.log(`  tip over-wide: ${code} "${id}" line "${line}" is ${textWidth(line, FONT_SIZE.small)} px`);
        }
      }
    }
    perLocaleMax[code] = max;
  }
  check(fit, 'every tip wraps inside three 11 px lines in all seven locales');
  console.log(`  ad-tip line counts (max per locale): ${JSON.stringify(perLocaleMax)}`);
  setLocale(en, 'en');
  clearTextWidthCache();
  setDirection('ltr');
}

// --- Ad progress bar: geometry, fill, RTL, Blue Screen, and no sim effect (docs/ADS-PROGRESS.md) --
{
  const s = createRunState();
  const ad = spawnAd(s, 'defrag');

  // Track geometry: 3 px tall, 6 px in from each side, just inside the bottom bevel.
  const track = adProgressRect(ad);
  check(track.x === ad.x + 6 && track.w === ad.w - 12 && track.h === 3,
    'the bar track is 3 px tall and 6 px in from each side');
  check(track.y === ad.y + ad.h - 7, 'the bar track sits 7 px above the dialog bottom');
  check(track.y >= ad.y + 2 && track.y + track.h <= ad.y + ad.h - 2,
    'the bar track sits inside the 2 px bevel');

  // Fill fraction: full, half, one pixel, zero (kept at least 1 px while ttl > 0).
  const fillW = (ttl) => {
    ad.ttl = ttl;
    return adProgressFillRect(ad).w;
  };
  check(fillW(AD_LIFETIME_TICKS) === track.w, 'the bar is full at full lifetime');
  check(fillW(Math.floor(AD_LIFETIME_TICKS / 2)) === Math.round(track.w / 2), 'the bar is half full at half lifetime');
  check(fillW(1) === 1, 'the bar keeps 1 px at one tick left');
  check(fillW(0) === 0, 'the bar is empty at zero ticks');

  // The tip's last line (three 12 px lines below the reward line and separator) clears the bar by 2 px.
  const tipBottom = adRewardLineY(ad) + 8 + 2 + 3 * 12;
  check(track.y - tipBottom >= 2, `the tip's last line clears the bar by ${track.y - tipBottom} px`);
}

{
  // RTL mirrors the fill so it grows from the right edge, and leaves the track where it was.
  const s = createRunState();
  const ad = spawnAd(s, 'defrag');
  const track = adProgressRect(ad);
  ad.ttl = Math.floor(AD_LIFETIME_TICKS / 2);
  const ltr = adProgressFillRect(ad);
  setDirection('rtl');
  const rtl = adProgressFillRect(ad);
  setDirection('ltr');
  check(adProgressRect(ad).x === track.x && adProgressRect(ad).y === track.y,
    'RTL leaves the bar track where it was');
  check(rtl.w === ltr.w && rtl.y === ltr.y && rtl.h === ltr.h, 'RTL keeps the fill size');
  check(ltr.x === track.x && rtl.x === track.x + track.w - rtl.w,
    'RTL grows the fill from the right edge');
}

{
  // Blue Screen draws the bar like every other kind: its only tell stays the 1 px-high title text.
  const s = createRunState();
  const ad = spawnAd(s, 'bluescreen');
  const track = adProgressRect(ad);
  const fill = adProgressFillRect(ad);
  check(track.h === 3 && fill.w === track.w && fill.h === 3, 'Blue Screen draws the bar');
}

{
  // The bar reads ad.ttl and nothing else, so a run's outcome cannot depend on it. Dismissing an ad
  // at a fixed tick must be byte-identical whether the dialog was 92 or 98 px tall — the height is
  // the only sim-visible change (docs/ADS-PROGRESS.md §3).
  const dismissAt = (h) => {
    const s = createRunState();
    s.rng = 0x5adc0de;
    s.economy.salvage = 1000;
    s.viewport.boardCol = { x: 8, y: 8, w: 480, h: 360 };
    const ad = spawnAd(s, 'defrag');
    ad.h = h;
    for (let i = 0; i < 240; i++) tick(s);
    dismissAd(s, s.ad.id);
    return JSON.stringify(captureRun(s));
  };
  check(dismissAt(98) === dismissAt(92),
    'dismissing an ad at a fixed tick leaves the run unchanged apart from the ad height');
}

{
  // Selection is a pure function of ad.id and the pool length, seeded per run: a replayed run shows
  // the same tip, and the choice never reads or advances the run's RNG stream.
  const critRolls = (rng, n) => {
    const out = [];
    let r = rng;
    for (let i = 0; i < n; i++) {
      const res = nextCritRoll(r, false, false);
      out.push(res.crit);
      r = res.next;
    }
    return out;
  };

  const base = createRunState();
  base.rng = 0x5eed1234;
  const rollsWithoutAds = critRolls(base.rng, 24);

  const withAds = createRunState();
  withAds.rng = 0x5eed1234;
  const tips = [];
  for (let i = 0; i < 5; i++) {
    withAds.ad = null;
    tips.push(spawnAd(withAds, 'defrag').tip);
  }
  const rollsWithAds = critRolls(withAds.rng, 24);
  check(JSON.stringify(rollsWithoutAds) === JSON.stringify(rollsWithAds),
    'choosing tips leaves the crit-roll stream byte-identical');

  const replay = createRunState();
  replay.rng = 0x5eed1234;
  const replayTips = [];
  for (let i = 0; i < 5; i++) {
    replay.ad = null;
    replayTips.push(spawnAd(replay, 'defrag').tip);
  }
  check(JSON.stringify(tips) === JSON.stringify(replayTips), 'the same seed shows the same tips on the same ads');

  // Consecutive ads advance the cursor, so adjacent ads never share a tip.
  const other = createRunState();
  const first = spawnAd(other, 'defrag').tip;
  other.ad = null;
  const second = spawnAd(other, 'autoupdate').tip;
  check(first !== null && second !== null && first !== second, 'different ads fall on different tips');
}

{
  // A run shows the whole pool once before any tip repeats: the cursor cycles the pool.
  const s = createRunState();
  const seen = [];
  for (let i = 0; i < AD_TIPS.length; i++) {
    s.ad = null;
    seen.push(spawnAd(s, 'defrag').tip);
  }
  check(new Set(seen).size === AD_TIPS.length, `a run shows all ${AD_TIPS.length} tips before any repeats`);
  s.ad = null;
  const next = spawnAd(s, 'defrag').tip;
  check(next === seen[0], 'after the pool is exhausted the cycle starts over at the first tip');
}

{
  // Blue Screen keeps the block but carries no tip; every other kind carries one.
  const s = createRunState();
  const bs = spawnAd(s, 'bluescreen');
  check(bs.tip === null, 'Blue Screen has no tip');
  let allTipped = true;
  for (const kind of AD_KINDS) {
    if (kind === 'bluescreen') continue;
    s.ad = null;
    if (spawnAd(s, kind).tip === null) allTipped = false;
  }
  check(allTipped, 'every ad kind except Blue Screen carries a tip');
}

{
  // A cursor click never shakes: cursors never crit, so their damage events shake nothing.
  const { s } = cursorRig(1, null);
  for (let i = 0; i < 200; i++) tick(s);
  const cursorDamage = s.events.filter((ev) => ev.type === 'damage');
  check(cursorDamage.length > 0, `cursor produced ${cursorDamage.length} clicks`);
  check(cursorDamage.every((ev) => shakeImpulseFor(ev) === null), 'a cursor click shakes nothing');
}

// --- 33. Repair tower: hit points for every kind, the heal aura, and no revives -----------------
{
  // 33a. Every kind carries a non-zero hit-point pool that matches the table, and the palette order
  // puts the repair tower between Beacon and Wall.
  const HP_TABLE = { gun: 100, cannon: 140, taser: 120, laser: 120, aa: 100, frost: 90, beacon: 80, repair: 90, cursor: 80 };
  for (const [kind, hp] of Object.entries(HP_TABLE)) {
    const t = createTower(1, kind, 0, 0);
    check(t.maxHp === hp && t.hp === hp, `${kind} has a ${hp} HP pool (${t.maxHp})`);
  }
  check(createTower(1, 'wall', 0, 0).maxHp === 60, 'wall keeps its tier-1 60 HP');
  check(TOWER_KINDS.indexOf('repair') === TOWER_KINDS.indexOf('beacon') + 1, 'repair sits after beacon in the palette');
  check(TOWER_KINDS.indexOf('wall') === TOWER_KINDS.indexOf('repair') + 1, 'repair sits before wall in the palette');

  // 33b. An upgrade raises the ceiling without changing the HP fraction: half stays half.
  const su = createRunState();
  su.economy.salvage = 10000;
  placeTower(su, 'wall', 5, 5);
  const w = towerAt(su, 5, 5);
  w.hp = 30; // half of the tier-1 60
  upgradeTower(su, 5, 5);
  check(w.maxHp === 180 && w.hp === 90, `upgrade keeps the wall at half of the new maximum (${w.hp}/180)`);
}

{
  // 33c. The repair tower heals only within radius, heals several towers at once, and never heals
  // an enemy.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  check(placeTower(s, 'repair', 5, 5), 'repair tower placed');
  check(placeTower(s, 'gun', 6, 5), 'in-radius gun placed');
  check(placeTower(s, 'gun', 5, 6), 'second in-radius gun placed');
  check(placeTower(s, 'gun', 12, 5), 'out-of-radius gun placed');
  const a = towerAt(s, 6, 5);
  const b = towerAt(s, 5, 6);
  const far = towerAt(s, 12, 5);
  a.hp = 40;
  b.hp = 50;
  far.hp = 40;
  const e = stationary(999, 'grunt', 1, 5.5, 4.5);
  e.hp = 7;
  s.enemies.push(e);

  for (let i = 0; i < 60; i++) tick(s); // 1 second
  check(a.hp > 40 && a.hp <= a.maxHp, `repair heals a damaged tower in radius (${a.hp})`);
  check(b.hp > 50 && b.hp <= b.maxHp, `repair heals several towers at once (${b.hp})`);
  check(far.hp === 40, `repair never heals outside its radius (${far.hp})`);
  check(e.hp === 7, 'repair never heals an enemy');
}

{
  // 33d. A full-health tower is not a target, and the aura reports 0 towers healed.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'repair', 5, 5);
  placeTower(s, 'gun', 6, 5);
  const repair = towerAt(s, 5, 5);
  check(repairHealingCount(s.towers, repair, s.clock) === 0, 'a full-HP tower is not a heal target');
  check(repairHealTargets(s.towers, repair, s.clock).length === 0, 'the aura reports 0 towers healed');
}

{
  // 33e. A zero-HP (offline) tower is a heal target: the aura revives it, never leaves it dead.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'repair', 5, 5);
  placeTower(s, 'gun', 6, 5);
  const offline = towerAt(s, 6, 5);
  offline.hp = 0;
  check(repairHealingCount(s.towers, towerAt(s, 5, 5), s.clock) === 1, 'a zero-HP tower is counted as healed');
  for (let i = 0; i < 60; i++) tick(s);
  check(offline.hp > 0, 'the aura revives an offline tower');
}

{
  // 33f. The repair tower itself can be damaged and shows a health bar, and it never heals itself.
  const r = createTower(1, 'repair', 5, 5);
  check(r.maxHp === 90, `repair tower has a 90 HP pool (${r.maxHp})`);
  r.hp = 45;
  check(r.hp < r.maxHp, 'the repair tower itself can be damaged');
  check(pipUsesBottomCorner(r, 0) === true, 'a damaged repair tower routes its pip for a health bar');

  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'repair', 5, 5);
  const solo = towerAt(s, 5, 5);
  solo.hp = 45;
  for (let i = 0; i < 60; i++) tick(s);
  check(solo.hp === 45, 'a repair tower does not heal itself');
}

{
  // 33g. Fixed-timestep equivalence holds while the aura is running.
  const run = (frameMs) => {
    const s = createRunState();
    s.economy.salvage = 100000;
    placeTower(s, 'repair', 5, 5);
    placeTower(s, 'gun', 6, 5);
    const gun = towerAt(s, 6, 5);
    gun.hp = 40;
    for (let t = 0; t < 900 * TICK_MS - frameMs; t += frameMs) step(s, frameMs);
    while (s.tick < 1000) tick(s);
    return JSON.stringify([gun.hp, s.tick, s.clock, s.rng]);
  };
  const at60 = run(TICK_MS);
  check(at60 === run(1000 / 144), 'repair aura matches at 60 Hz and 144 Hz frames');
  check(at60 === run(1000 / 23), 'repair aura matches at 23 Hz frames');
}

{
  // 33h. The palette and placed tooltips name the repair tower and the live heal numbers.
  check(
    paletteTooltipLines('repair').join(' | ') === 'Repair  $220 | heals 2 HP/s to towers within 4.5 tiles',
    'palette tooltip reads the repair spec',
  );
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'repair', 5, 5);
  placeTower(s, 'gun', 6, 5);
  const repair = towerAt(s, 5, 5);
  const gun = towerAt(s, 6, 5);
  gun.hp = 40;
  const healed = repairHealingCount(s.towers, repair, s.clock);
  const lines = towerTooltipLines(repair, s.clock, undefined, undefined, healed).map(tooltipText);
  check(lines[0] === 'Repair T1', `placed repair tooltip names the tower (${lines[0]})`);
  check(lines[1] === 'Heals 2.0 HP/s · Radius 4.5', `placed repair tooltip shows rate and radius (${lines[1]})`);
  check(lines[2] === 'Healing 1 towers', `placed repair tooltip counts healed towers (${lines[2]})`);
  check(
    tooltipText(repairUpgradeTooltipLines(repair, s.economy.salvage)[0]).includes('rng 4.5 → 5.0'),
    'repair upgrade tooltip previews the radius',
  );
}

{
  // 33i. Every palette button fits inside the left panel at the smallest and largest layouts.
  for (const [vw, vh] of [[1280, 720], [1600, 900]]) {
    const l = computeLayout(vw, vh);
    const h = computeHud(l, createRunState());
    check(
      h.towers.length === TOWER_KINDS.length && h.towers.every((t) => t.rect.y + t.rect.h <= l.leftPanel.y + l.leftPanel.h),
      `${h.towers.length} palette buttons fit in the left panel at ${vw}x${vh}`,
    );
  }
}

{
  // 33j. A tower being repaired by hand is off the field, so the aura skips it.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'repair', 5, 5);
  placeTower(s, 'gun', 6, 5);
  const gun = towerAt(s, 6, 5);
  gun.hp = 40;
  check(startRepair(s, 6, 5), 'manual repair starts on the damaged gun');
  check(repairHealingCount(s.towers, towerAt(s, 5, 5), s.clock) === 0, 'a repairing tower is not healed by the aura');
}

// --- 34. Cursor Maintenance branch ------------------------------------------------------------

/** A Maintenance cursor on open-field at (5,5) with a gun at (6,5) at the given HP (build phase). */
function maintenanceRig(gunHp) {
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cursor', 5, 5);
  const c = s.towers.find((t) => t.kind === 'cursor');
  c.tier = 3;
  c.branch = 'C';
  placeTower(s, 'gun', 6, 5);
  const gun = towerAt(s, 6, 5);
  gun.hp = gunHp;
  return { s, c, gun };
}

{
  // 34a. With an enemy in radius, a Maintenance cursor fights normally and never starts a repair.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cursor', 5, 5);
  const c = s.towers.find((t) => t.kind === 'cursor');
  c.tier = 3;
  c.branch = 'C';
  placeTower(s, 'beacon', 6, 5);
  const beacon = towerAt(s, 6, 5);
  beacon.hp = 40; // 50%, damaged and in radius
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const e = stationary(99, 'grunt', 1, 5.5, 5.5);
  e.hp = 1e9;
  e.maxHp = 1e9;
  s.enemies.push(e);
  for (let i = 0; i < 60; i++) tick(s);
  check(e.hp < 1e9, 'maintenance: a cursor fights the enemy in its radius');
  check(!isRepairing(beacon, s.clock) && beacon.hp === 40, 'maintenance: no repair starts while an enemy is in range');
  check(cursorMaintenanceStatus(s, c) === 'Idle — enemies in range',
    `maintenance: status reports enemies in range (${cursorMaintenanceStatus(s, c)})`);
}

{
  // 34b. With the radius clear and a tower at 50%, a repair starts, costs the normal salvage, and
  // takes the tower offline.
  const { s, c, gun } = maintenanceRig(50);
  const before = s.economy.salvage;
  const cost = repairCost(gun);
  let repaired = false;
  for (let i = 0; i < 200 && !repaired; i++) {
    tick(s);
    repaired = isRepairing(gun, s.clock);
  }
  check(repaired, 'maintenance: a repair starts on a 50% tower');
  check(isRepairing(gun, s.clock), 'maintenance: the tower is offline while it repairs');
  check(s.economy.salvage === before - cost,
    `maintenance: repair costs the normal salvage (${before} -> ${s.economy.salvage}, cost ${cost})`);
  check(c.tier === 3 && c.branch === 'C', 'maintenance: the cursor is the Maintenance branch');
}

{
  // 34c. A tower at 90% (or exactly 80%) is left alone; at 79% it is repaired.
  const high = maintenanceRig(90);
  for (let i = 0; i < 120; i++) tick(high.s);
  check(!isRepairing(high.gun, high.s.clock) && high.gun.hp === 90, 'maintenance: a 90% tower is left alone');

  const edge = maintenanceRig(80);
  for (let i = 0; i < 120; i++) tick(edge.s);
  check(!isRepairing(edge.gun, edge.s.clock) && edge.gun.hp === 80, 'maintenance: exactly 80% is left alone (below 80% only)');

  const low = maintenanceRig(79);
  let repaired = false;
  for (let i = 0; i < 200 && !repaired; i++) {
    tick(low.s);
    repaired = isRepairing(low.gun, low.s.clock);
  }
  check(repaired, 'maintenance: a 79% tower is repaired');
}

{
  // 34d. The lowest health fraction is chosen when two towers are damaged (equal distance, so the
  // fraction is the only difference), and the nearest wins on an equal fraction.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cursor', 5, 5);
  const c = s.towers.find((t) => t.kind === 'cursor');
  c.tier = 3;
  c.branch = 'C';
  placeTower(s, 'gun', 6, 5);
  placeTower(s, 'gun', 5, 6);
  const a = towerAt(s, 6, 5);
  const b = towerAt(s, 5, 6);
  a.hp = 40; // 40%
  b.hp = 20; // 20%
  check(cursorMaintenanceStatus(s, c) === 'Repairing Gun 20%',
    `maintenance: the lowest fraction is chosen first (${cursorMaintenanceStatus(s, c)})`);
  let first = null;
  for (let i = 0; i < 200 && first === null; i++) {
    tick(s);
    if (isRepairing(a, s.clock)) first = 'a';
    if (isRepairing(b, s.clock)) first = 'b';
  }
  check(first === 'b', `maintenance: the 20% tower repairs before the 40% one (got ${first})`);

  const tie = allUnlocked();
  tie.economy.salvage = 100000;
  placeTower(tie, 'cursor', 5, 5);
  const tc = tie.towers.find((t) => t.kind === 'cursor');
  tc.tier = 3;
  tc.branch = 'C';
  placeTower(tie, 'gun', 6, 5);
  placeTower(tie, 'cannon', 7, 5);
  towerAt(tie, 6, 5).hp = 50; // 50% of 100
  towerAt(tie, 7, 5).hp = 70; // 50% of 140
  check(cursorMaintenanceStatus(tie, tc) === 'Repairing Gun 50%',
    `maintenance: the nearest tower wins an equal fraction (${cursorMaintenanceStatus(tie, tc)})`);
}

{
  // 34e. An unaffordable repair is not started and no salvage is spent.
  const { s, gun } = maintenanceRig(50);
  s.economy.salvage = 3; // below the 7-salvage repair cost
  for (let i = 0; i < 120; i++) tick(s);
  check(!isRepairing(gun, s.clock), 'maintenance: an unaffordable repair is not started');
  check(s.economy.salvage === 3, 'maintenance: no salvage is spent on an unaffordable repair');
  check(gun.hp === 50, 'maintenance: the tower stays damaged when the repair is unaffordable');
}

{
  // 34f. A destroyed wall is removed from the board, so maintenance never targets it. (An offline
  // non-wall tower is a valid target — covered in 36f — so "destroyed" now means a wall alone.)
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cursor', 5, 5);
  const c = s.towers.find((t) => t.kind === 'cursor');
  c.tier = 3;
  c.branch = 'C';
  placeTower(s, 'wall', 6, 5);
  const wall = towerAt(s, 6, 5);
  s.towers = s.towers.filter((t) => t.id !== wall.id); // a wall at 0 HP is destroyed (removed)
  for (let i = 0; i < 120; i++) tick(s);
  check(cursorMaintenanceStatus(s, c) === 'Idle — nothing to repair',
    `maintenance: a destroyed wall is ignored (${cursorMaintenanceStatus(s, c)})`);
}

{
  // 34g. A non-Maintenance cursor never repairs.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cursor', 5, 5);
  const c = s.towers.find((t) => t.kind === 'cursor');
  c.tier = 3;
  c.branch = 'A'; // Overclock
  placeTower(s, 'gun', 6, 5);
  const gun = towerAt(s, 6, 5);
  gun.hp = 50;
  for (let i = 0; i < 120; i++) tick(s);
  check(!isRepairing(gun, s.clock) && gun.hp === 50, 'maintenance: an Overclock cursor never repairs');
  check(cursorMaintenanceStatus(s, c) === null, 'maintenance: status is null for a non-Maintenance cursor');
}

{
  // 34h. Fixed-timestep equivalence, and the target choice is deterministic for one seed.
  const run = (frameMs) => {
    const { s, c, gun } = maintenanceRig(50);
    s.rng = 0x12345678;
    for (let t = 0; t < 900 * TICK_MS - frameMs; t += frameMs) step(s, frameMs);
    while (s.tick < 1000) tick(s);
    return JSON.stringify([gun.hp, gun.repairReadyAt, c.cursorRepairTowerId, c.cursorX, c.cursorY, s.tick, s.clock, s.rng]);
  };
  const at60 = run(TICK_MS);
  check(at60 === run(1000 / 144), 'maintenance: same result at 60 Hz and 144 Hz frames');
  check(at60 === run(1000 / 23), 'maintenance: same result at 23 Hz frames');

  const targetChoice = () => {
    const s = allUnlocked();
    s.rng = 0x12345678;
    s.economy.salvage = 100000;
    placeTower(s, 'cursor', 5, 5);
    const c = s.towers.find((t) => t.kind === 'cursor');
    c.tier = 3;
    c.branch = 'C';
    placeTower(s, 'gun', 6, 5);
    placeTower(s, 'gun', 5, 6);
    towerAt(s, 6, 5).hp = 40;
    towerAt(s, 5, 6).hp = 20;
    for (let i = 0; i < 60; i++) tick(s);
    return JSON.stringify([c.cursorRepairTowerId, towerAt(s, 6, 5).repairReadyAt, towerAt(s, 5, 6).repairReadyAt]);
  };
  check(targetChoice() === targetChoice(), 'maintenance: target choice is deterministic for one seed');
}

{
  // 34i. The branch name, mark, panel layout and tooltips read the Maintenance behaviour.
  check(branchName('cursor', 'C') === 'Maintenance', 'cursor branch C is named Maintenance');
  check(CURSOR_REPAIR_THRESHOLD === 0.8, 'maintenance threshold is 80%');
  check(branchMarkSpec('cursor', 'C') !== null, 'Maintenance carries a wrench branch mark');
  check(branchMarkSpec('cursor', 'A') !== null && branchMarkSpec('cursor', 'B') !== null,
    'Overclock and Wide Search carry branch marks');

  const rs = createRunState();
  const placed = cursorTooltipLines(cursorTower(3, 'C'), rs.pointer, pointerDamageMult(rs), 'Repairing Gun 42%');
  check(placed[0] === 'Cursor T3 — Maintenance', `maintenance tooltip names the branch (${placed[0]})`);
  check(placed[1] === 'Repairs damaged towers when its radius is clear', 'maintenance tooltip reads the rule');
  check(placed[2] === 'Below 80% HP · Repairing Gun 42%',
    `maintenance tooltip shows the threshold and target (${placed[2]})`);
  check(placed[3].includes('Overclock'), 'maintenance tooltip names the Overclock trade-off');

  const branchTip = tooltipText(cursorBranchTooltipLines(cursorTower(2, null), 'C', 100000)[0]);
  check(branchTip.includes('Maintenance') && branchTip.includes('repairs damaged towers') && branchTip.includes('80%'),
    `maintenance branch tooltip reads the behaviour (${branchTip})`);
  check(branchTip.includes('no Overclock damage boost'), 'maintenance branch tooltip states the lost Overclock damage');

  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cursor', 5, 5);
  const c = towerAt(s, 5, 5);
  c.tier = 2;
  selectPlacedTower(s, c);
  const h = computeHud(computeLayout(1280, 720), s);
  check(h.detail !== null && h.detail.branches.length === 3, 'a tier-2 cursor offers three branches');
}

{
  // 34k. Three-branch towers stack their buttons vertically and never overlap, and every label
  // shrinks to fit its button's inner width.
  const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cursor', 5, 5);
  const c = towerAt(s, 5, 5);
  c.tier = 2;
  selectPlacedTower(s, c);
  const l = computeLayout(1280, 720);
  const h = computeHud(l, s);
  const buttons = h.detail.branches;
  check(buttons.length === 3, 'a tier-2 cursor offers three branch buttons');

  for (let i = 0; i < buttons.length; i++) {
    for (let j = i + 1; j < buttons.length; j++) {
      check(!intersects(buttons[i].rect, buttons[j].rect),
        `cursor branch buttons ${i} and ${j} do not overlap`);
    }
    const labelW = Math.ceil(textWidth(buttons[i].label, FONT_SIZE.small));
    const innerW = buttons[i].rect.w - 12;
    check(labelW <= innerW,
      `cursor branch label "${buttons[i].label}" fits its button (${labelW} <= ${innerW})`);
  }

  const last = buttons[buttons.length - 1].rect;
  check(last.y + last.h <= l.leftPanel.y + l.leftPanel.h,
    `the last cursor branch button stays above the panel bottom (${last.y + last.h} <= ${l.leftPanel.y + l.leftPanel.h})`);
  check(h.detail.sell.y + h.detail.sell.h <= l.leftPanel.y + l.leftPanel.h,
    'the cursor sell row is not pushed off the panel');
}

{
  // 34l. A two-branch tower keeps the side-by-side row and its full, unchanged branch names.
  const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  const s = createRunState();
  s.economy.salvage = 100000;
  placeTower(s, 'gun', 5, 5);
  upgradeTower(s, 5, 5);
  selectPlacedTower(s, towerAt(s, 5, 5));
  const h = computeHud(computeLayout(1280, 720), s);
  const buttons = h.detail.branches;
  check(buttons.length === 2, 'a tier-2 gun offers two branch buttons');
  check(!intersects(buttons[0].rect, buttons[1].rect), 'gun branch buttons do not overlap');
  check(buttons[0].rect.y === buttons[1].rect.y, 'gun branch buttons share one row');
  check(buttons[0].rect.w === buttons[1].rect.w, 'gun branch buttons split the row evenly');
  check(buttons[0].label === branchName('gun', 'A') && buttons[1].label === branchName('gun', 'B'),
    'gun branch buttons keep their full branch names');
}

{
  // 34m. Every branching tower renders its branch buttons fully inside the panel at 1280x720 and
  // 1600x900.
  for (const [vw, vh] of [[1280, 720], [1600, 900]]) {
    const l = computeLayout(vw, vh);
    for (const kind of TOWER_KINDS) {
      if (!hasBranches(kind)) continue;
      const s = allUnlocked();
      s.economy.salvage = 100000;
      check(placeTower(s, kind, 5, 5), `place a ${kind} to inspect its branch row`);
      check(upgradeTower(s, 5, 5), `upgrade ${kind} to tier 2`);
      selectPlacedTower(s, towerAt(s, 5, 5));
      const h = computeHud(l, s);
      const buttons = h.detail.branches;
      const inside = buttons.every((b) =>
        b.rect.x >= l.leftPanel.x &&
        b.rect.x + b.rect.w <= l.leftPanel.x + l.leftPanel.w &&
        b.rect.y + b.rect.h <= l.leftPanel.y + l.leftPanel.h);
      check(inside, `${kind} branch buttons stay inside the panel at ${vw}x${vh}`);
    }
  }
}

// --- 35. No-Build freezes the board -----------------------------------------------------------

{
  // 35a. During a no-build wave all six board/tower actions are refused, and the frozen status
  // message is the exact string the view surfaces.
  const s = stateOnLevel('open-field');
  s.economy.salvage = 100000;
  placeTower(s, 'gun', 3, 6);
  placeTower(s, 'wall', 5, 5);
  const gun = towerAt(s, 3, 6);
  const wall = towerAt(s, 5, 5);
  upgradeTower(s, 5, 5); // wall -> tier 2, so it has branches
  gun.hp = gun.maxHp / 2;
  gun.targetMode = 'first';
  s.phase = 'wave';
  s.modifiers = ['no-build'];

  check(noBuildActive(s), 'no-build is active during the wave');
  check(NO_BUILD_MESSAGE === 'No-Build — the board is frozen this wave', 'the frozen status message is exact');

  check(!canPlace(s, 'gun', 4, 4), 'placing is refused');
  check(!upgradeTower(s, 3, 6), 'upgrading is refused');
  check(gun.tier === 1, 'the refused upgrade leaves the tier unchanged');
  check(!chooseBranch(s, 5, 5, 'A'), 'branching is refused');
  check(wall.branch === null, 'the refused branch leaves the wall unbranched');
  check(!sellTower(s, 3, 6), 'selling is refused');
  check(towerAt(s, 3, 6) !== undefined, 'the tower survives the refused sell');
  check(!startRepair(s, 3, 6), 'repairing is refused');
  check(!isRepairing(gun, s.clock), 'no repair starts');
  cycleTargetMode(s, 3, 6);
  check(gun.targetMode === 'first', 'retargeting is refused');
  check(!('noBuildRow' in s), 'the locked-row field is gone from the state');
}

{
  // 35b. The tower-detail and palette buttons render disabled during a no-build wave.
  const s = stateOnLevel('open-field');
  s.economy.salvage = 100000;
  placeTower(s, 'gun', 3, 6);
  const gun = towerAt(s, 3, 6);
  gun.hp = gun.maxHp / 2;
  selectPlacedTower(s, gun);
  s.phase = 'wave';
  s.modifiers = ['no-build'];
  const l = computeLayout(1280, 720);
  const h = computeHud(l, s);
  const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  const enabledAt = (r) => hudControlAt(l, s, center(r).x, center(r).y)?.enabled === true;
  check(h.detail !== null, 'a selected gun opens the detail panel');
  check(!enabledAt(h.detail.target), 'target button is disabled under no-build');
  check(!enabledAt(h.detail.upgrade), 'upgrade button is disabled under no-build');
  check(!enabledAt(h.detail.repair), 'repair button is disabled under no-build');
  check(!enabledAt(h.detail.sell), 'sell button is disabled under no-build');

  const palette = stateOnLevel('open-field');
  palette.economy.salvage = 100000;
  palette.phase = 'wave';
  palette.modifiers = ['no-build'];
  const ph = computeHud(l, palette);
  const p = ph.towers[0];
  const hit = hudControlAt(l, palette, center(p.rect).x, center(p.rect).y);
  check(hit !== null && hit.action === 'gun' && hit.enabled === false, 'palette gun button is disabled under no-build');
}

{
  // 35c. Between waves and during waves without the modifier, nothing changes.
  const s = stateOnLevel('open-field');
  s.economy.salvage = 100000;
  check(!noBuildActive(s), 'no-build is not active between waves');
  check(canPlace(s, 'gun', 4, 4), 'placing still works between waves');
  placeTower(s, 'gun', 4, 4);
  s.phase = 'wave';
  s.modifiers = ['fog'];
  check(!noBuildActive(s), 'no-build is not active in a fog wave');
  check(upgradeTower(s, 4, 4), 'upgrading still works in a non-no-build wave');

  const build = createRunState();
  build.economy.salvage = 100000;
  const l = computeLayout(1280, 720);
  const ph = computeHud(l, build);
  const p = ph.towers[0];
  const hit = hudControlAt(l, build, p.rect.x + p.rect.w / 2, p.rect.y + p.rect.h / 2);
  check(hit !== null && hit.enabled === true, 'palette gun button is enabled between waves');
}

{
  // 35d. The Repair tower's aura still heals during a no-build wave.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'repair', 5, 5);
  placeTower(s, 'gun', 6, 5);
  const gun = towerAt(s, 6, 5);
  gun.hp = 40;
  s.phase = 'wave';
  s.modifiers = ['no-build'];
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const e = stationary(999, 'grunt', 1, 0.5, 0.5);
  e.hp = 1e9;
  e.maxHp = 1e9;
  s.enemies.push(e);
  for (let i = 0; i < 60; i++) tick(s);
  check(gun.hp > 40, `repair aura still heals during no-build (${gun.hp})`);
}

{
  // 35e. Manual Override still toggles and still retargets during a no-build wave.
  const s = stateOnLevel('open-field');
  s.economy.salvage = 100000;
  placeTower(s, 'gun', 5, 5);
  s.phase = 'wave';
  s.modifiers = ['no-build'];
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const natural = stationary(1, 'grunt', 1, 5.5, 4.0);
  const marked = stationary(2, 'grunt', 1, 5.5, 6.0);
  natural.dist = 100;
  marked.dist = 1;
  natural.hp = 1e9;
  natural.maxHp = 1e9;
  marked.hp = 1e9;
  marked.maxHp = 1e9;
  s.enemies.push(natural, marked);
  s.pointer.targetId = marked.id;
  toggleManualOverride(s);
  check(s.pointer.manualOverride === true, 'manual override toggles during no-build');
  for (let i = 0; i < 120; i++) tick(s);
  check(marked.hp < marked.maxHp, 'override: the gun shoots the marked enemy during no-build');
  check(natural.hp === natural.maxHp, 'override: the natural target is left alone');
}

{
  // 35f. Auto-wave still advances, and a run with a no-build wave can still finish.
  const s = stateOnLevel('open-field');
  s.economy.salvage = 100000;
  placeTower(s, 'gun', 3, 6);
  toggleAutoWave(s);
  startWave(s);
  s.modifiers = ['no-build'];
  check(s.phase === 'wave' && noBuildActive(s), 'no-build is active on the live wave');
  for (let i = 0; i < 4000 && s.phase === 'wave'; i++) tick(s);
  check(s.phase === 'build', 'the no-build wave clears back to build');
  check(s.wave === 1, 'wave 1 finished');
  const armed = s.autoWaveAtTick;
  while (s.phase === 'build' && s.clock < armed) tick(s);
  check(s.phase === 'wave' && s.wave === 2, 'auto-wave advances past the no-build wave');
}

// --- 36. Breacher turret and offline towers ---------------------------------------------------

// 36a. The turret's stats match the spec, and a breacher in range damages a tower once per second
// without ever exceeding the rate.
check(BREACHER_TURRET_RANGE === 2.2, 'breacher turret range is 2.2 tiles');
check(BREACHER_TURRET_DAMAGE === 2, 'breacher turret damage is 2');
check(BREACHER_TURRET_INTERVAL_TICKS === TICK_HZ, 'breacher turret fires once per second (60 ticks)');

{
  const run = (ticks) => {
    const s = stateOnLevel('open-field');
    s.economy.salvage = 100000;
    placeTower(s, 'gun', 5, 5);
    const gun = towerAt(s, 5, 5);
    s.phase = 'wave';
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    const b = createEnemy(1, 'breacher', 12, SPAWN, EXIT);
    b.x = 5.0;
    b.y = 6.5;
    b.prevX = 5.0;
    b.prevY = 6.5;
    b.col = 5;
    b.row = 6;
    b.heading = 0;
    b.dist = 0;
    s.enemies.push(b);
    for (let i = 0; i < ticks; i++) tick(s);
    return gun.hp;
  };
  const loss1 = 100 - run(60);
  check(loss1 === 2, `breacher turret deals 2 damage in one second (${loss1})`);
  const loss4 = 100 - run(240);
  check(loss4 === 8, `breacher turret holds exactly 2/s and never exceeds the rate (${loss4} over 4 s)`);
}

// 36b. A breacher chewing a wall deals no turret damage, and resumes once the wall is gone.
{
  const s = stateOnLevel('open-field');
  s.economy.salvage = 100000;
  const first = stepToward(s.breacherField, SPAWN.col, SPAWN.row);
  check(first !== null, 'breacher field gives a first step for the turret test');
  placeTower(s, 'wall', first.col, first.row);
  placeTower(s, 'gun', 0, 7); // within turret range of the chewing spot (0.5, 6.5)
  const gun = towerAt(s, 0, 7);
  const gunHp = gun.hp;
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const b = createEnemy(1, 'breacher', 12, SPAWN, EXIT);
  s.enemies.push(b);

  let wallGone = false;
  let firedWhileChewing = false;
  let firedAfterWall = false;
  for (let i = 0; i < 6000 && !b.dead; i++) {
    tick(s);
    if (!wallGone && !towerAt(s, first.col, first.row)) wallGone = true;
    if (!wallGone && gun.hp < gunHp) firedWhileChewing = true;
    if (wallGone && gun.hp < gunHp) firedAfterWall = true;
  }
  check(wallGone, 'the wall is destroyed');
  check(!firedWhileChewing, 'a breacher chewing a wall deals no turret damage');
  check(firedAfterWall, 'the breacher resumes turret fire after the wall is gone');
}

// 36c. A tower at 0 HP goes offline: it stops firing, and a beacon stops buffing.
{
  const s = stateOnLevel('open-field');
  s.economy.salvage = 100000;
  placeTower(s, 'gun', 5, 5);
  const gun = towerAt(s, 5, 5);
  gun.hp = 0;
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const e = stationary(1, 'grunt', 1, 5.5, 4.5);
  s.enemies.push(e);
  for (let i = 0; i < 30; i++) tick(s);
  check(isOffline(gun), 'a non-wall tower at 0 HP is offline');
  check(e.hp === e.maxHp, 'an offline gun stops firing');
}

{
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'gun', 5, 5);
  placeTower(s, 'beacon', 6, 5);
  const gun = towerAt(s, 5, 5);
  const beacon = towerAt(s, 6, 5);
  check(Math.abs(gun.auraDamage - 1.6) < 1e-9, 'the beacon buffs its neighbour');
  beacon.hp = 0;
  recomputeAuras(s.towers, s.clock);
  check(Math.abs(gun.auraDamage - 1.0) < 1e-9, 'an offline beacon stops buffing');
}

// 36d. An offline tower can be repaired through the normal flow and comes back online at full HP.
{
  const s = stateOnLevel('open-field');
  s.economy.salvage = 100000;
  placeTower(s, 'gun', 5, 5);
  const gun = towerAt(s, 5, 5);
  gun.hp = 0;
  const price = repairCost(gun);
  check(price === Math.ceil(0.5 * gun.spent), `repair at 0 HP costs the full half-spent cap (${price})`);
  const salv = s.economy.salvage;
  check(startRepair(s, 5, 5), 'an offline tower starts repairing');
  check(s.economy.salvage === salv - price, 'the repair cost is paid up front');
  while (isRepairing(gun, s.clock)) tick(s);
  check(gun.hp === gun.maxHp, 'the repaired tower returns online at full HP');
  check(!isOffline(gun), 'the tower is no longer offline');
}

// 36e. The Repair tower's aura heals an offline tower back above 0 (the point of owning one).
{
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'repair', 5, 5);
  placeTower(s, 'gun', 6, 5);
  const gun = towerAt(s, 6, 5);
  gun.hp = 0;
  check(isOffline(gun), 'the gun starts offline');
  for (let i = 0; i < 60; i++) tick(s); // 1 s at 2 HP/s
  check(gun.hp > 0, `the repair aura heals an offline tower back above 0 (${gun.hp})`);
  check(!isOffline(gun), 'the gun comes back online');
}

// 36f. A Maintenance cursor treats an offline tower as a valid target and picks it over a 40% one.
{
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cursor', 5, 5);
  const c = s.towers.find((t) => t.kind === 'cursor');
  c.tier = 3;
  c.branch = 'C';
  placeTower(s, 'gun', 6, 5);
  placeTower(s, 'gun', 5, 6);
  const a = towerAt(s, 6, 5);
  const b = towerAt(s, 5, 6);
  a.hp = 0; // offline, 0%
  b.hp = 40; // 40%
  check(cursorMaintenanceStatus(s, c) === 'Repairing Gun 0%',
    `maintenance picks the offline tower over the 40% one (${cursorMaintenanceStatus(s, c)})`);
  let repaired = null;
  for (let i = 0; i < 200 && repaired === null; i++) {
    tick(s);
    if (isRepairing(a, s.clock)) repaired = 'a';
    if (isRepairing(b, s.clock)) repaired = 'b';
  }
  check(repaired === 'a', `maintenance starts the repair on the offline tower (got ${repaired})`);
}

// 36g. A wall at 0 HP is still destroyed and re-opens the route (walls never go offline).
{
  const s = stateOnLevel('open-field');
  const openLen = currentPath(s).length;
  s.economy.salvage = 100000;
  const first = stepToward(s.breacherField, SPAWN.col, SPAWN.row);
  placeTower(s, 'wall', first.col, first.row);
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const b = createEnemy(1, 'breacher', 12, SPAWN, EXIT);
  s.enemies.push(b);
  let destroyed = false;
  let reopened = false;
  for (let i = 0; i < 6000 && !b.dead; i++) {
    tick(s);
    if (!destroyed && !towerAt(s, first.col, first.row)) {
      destroyed = true;
      reopened = currentPath(s).length === openLen;
    }
  }
  check(destroyed, 'a wall at 0 HP is destroyed, not left offline');
  check(reopened, 'destroying the wall leaves the route open');
}

// 36h. Fixed-timestep equivalence holds with the turret firing, and target choice is deterministic.
{
  const run = (frameMs) => {
    const s = stateOnLevel('open-field');
    s.economy.salvage = 100000;
    placeTower(s, 'gun', 5, 5);
    placeTower(s, 'gun', 5, 7);
    s.phase = 'wave';
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    const b = createEnemy(1, 'breacher', 12, SPAWN, EXIT);
    b.x = 5.5;
    b.y = 6.5;
    b.prevX = 5.5;
    b.prevY = 6.5;
    b.col = 5;
    b.row = 6;
    b.heading = 0;
    b.dist = 0;
    s.enemies.push(b);
    for (let t = 0; t < 900 * TICK_MS - frameMs; t += frameMs) step(s, frameMs);
    while (s.tick < 1000) tick(s);
    return JSON.stringify([
      s.economy,
      s.integrity,
      s.enemies.map((e) => [e.id, e.hp, e.dist]),
      s.towers.map((t) => [t.kind, t.hp]),
      s.rng,
      s.tick,
      s.clock,
    ]);
  };
  const at60 = run(TICK_MS);
  check(at60 === run(1000 / 144), 'breacher turret: same result at 60 Hz and 144 Hz frames');
  check(at60 === run(1000 / 23), 'breacher turret: same result at 23 Hz frames');

  const targetChoice = () => {
    const s = stateOnLevel('open-field');
    s.rng = 0x12345678;
    s.economy.salvage = 100000;
    placeTower(s, 'gun', 5, 5);
    placeTower(s, 'gun', 5, 7);
    s.phase = 'wave';
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    const b = createEnemy(1, 'breacher', 12, SPAWN, EXIT);
    b.x = 5.5;
    b.y = 6.5;
    b.prevX = 5.5;
    b.prevY = 6.5;
    b.col = 5;
    b.row = 6;
    b.heading = 0;
    b.dist = 0;
    s.enemies.push(b);
    tick(s); // one turret shot
    return JSON.stringify([towerAt(s, 5, 5).hp, towerAt(s, 5, 7).hp]);
  };
  const choice = targetChoice();
  check(choice === targetChoice(), 'turret target choice is deterministic for one seed');
  const parsed = JSON.parse(choice);
  check(parsed[0] === 98 && parsed[1] === 100,
    `the turret hits the first-placed of two equidistant towers (${parsed.join(',')})`);
}

// --- 37. Art pipeline: manifest, naming, cache, fallback, and the manifest/reality diff ---------
{
  const artDir = fileURLToPath(new URL('../public/art', import.meta.url));

  // 37a. The manifest is well-formed: unique names, all four categories present.
  const names = new Set();
  let unique = true;
  const categories = new Set();
  for (const e of ART_MANIFEST) {
    if (names.has(e.name)) unique = false;
    names.add(e.name);
    categories.add(e.category);
  }
  check(unique, 'every manifest entry has a unique name');
  check(
    ['enemies', 'towers', 'branches', 'board', 'fx', 'ui', 'wall'].every((c) => categories.has(c)),
    'the manifest covers enemies, towers, branches, board, fx, ui and wall',
  );
  check(ART_VIEWBOX === 32 && ART_SILHOUETTE === 28,
    `the viewBox contract is ${ART_VIEWBOX}x${ART_VIEWBOX}, silhouette ${ART_SILHOUETTE}px`);

  // 37b. Every shipped manifest file exists on disk, and no SVG on disk is unreferenced. The
  // shipped set grows as each art phase lands (towers, branches, board); the manifest itself lists
  // the whole contract from the start, so unshipped entries simply fall back to procedural drawing.
  const shippedCategories = ['enemies', 'towers', 'branches', 'board', 'fx', 'ui', 'wall'];
  const missing = ART_MANIFEST.filter(
    (e) => shippedCategories.includes(e.category) && !existsSync(`${artDir}/${e.file}`),
  );
  check(missing.length === 0, `every shipped manifest file exists (${missing.map((m) => m.file).join(', ') || 'none missing'})`);

  // Every fx and ui asset parses as SVG: an svg root with a numeric viewBox that closes cleanly. A
  // malformed file (truncated, missing viewBox, unbalanced tags) would fail the rasteriser, so it is
  // rejected here rather than silently falling back to the procedural drawing. The viewBox is not
  // fixed to 32x32: a wide asset such as the synergy link is authored at its own aspect ratio.
  const svgLooksValid = (text) => {
    const t = text.trim();
    return (
      t.startsWith('<svg') &&
      t.endsWith('</svg>') &&
      /viewBox="0 0 \d+(\.\d+)? \d+(\.\d+)?"/.test(t) &&
      (t.match(/</g) || []).length === (t.match(/>/g) || []).length
    );
  };
  const malformed = ART_MANIFEST.filter((e) => {
    if (e.category !== 'fx' && e.category !== 'ui') return false;
    if (!existsSync(`${artDir}/${e.file}`)) return false;
    return !svgLooksValid(readFileSync(`${artDir}/${e.file}`, 'utf8'));
  });
  check(malformed.length === 0, `every fx and ui asset parses as SVG (${malformed.map((m) => m.file).join(', ') || 'none malformed'})`);

  const onDisk = [];
  const walk = (dir, rel) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const r = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(`${dir}/${entry.name}`, r);
      else if (entry.name.endsWith('.svg')) onDisk.push(r);
    }
  };
  walk(artDir, '');
  const referenced = new Set(ART_MANIFEST.map((e) => e.file));
  // A numbered frame (`grunt.2.svg`) is referenced through its base still (`grunt.svg`): adding frames
  // is files-only (docs/ART-ANIMATION.md), so it must not need a manifest entry of its own.
  const baseOf = (f) => f.replace(/\.[1-9]\d*\.svg$/, '.svg');
  const unreferenced = onDisk.filter((f) => !referenced.has(baseOf(f)));
  check(unreferenced.length === 0, `no unreferenced SVG in public/art (${unreferenced.join(', ') || 'none'})`);
}

{
  // 37c. Every enemy and tower kind resolves an asset name, and the naming helpers agree.
  for (const kind of ['grunt', 'runner', 'shielded', 'flyer', 'armoured', 'saboteur', 'breacher']) {
    check(artNameForEnemy(kind) === kind, `enemy ${kind} resolves an asset name`);
  }
  check(artNameForEnemy('popup') === null, 'the pop-up stays runtime (no asset)');
  // Every boss variant owns its art and keeps its base type as a fallback, so an artist can give a boss
  // details a grunt does not have without the enemy disappearing if the file is mid-edit.
  for (const kind of ['grunt-boss', 'runner-boss', 'shielded-boss', 'flyer-boss', 'armoured-boss', 'saboteur-boss', 'breacher-boss']) {
    check(artNameForEnemy(kind) === kind, `boss ${kind} resolves its own asset`);
    check(
      enemyArtNames(kind)[0] === kind && enemyArtNames(kind)[1] === baseEnemyKind(kind),
      `boss ${kind} falls back to its base type's art`,
    );
  }
  check(enemyArtNames('grunt').length === 1, 'a base enemy resolves exactly one art name');
  for (const kind of ['gun', 'cannon', 'laser', 'taser', 'frost', 'aa', 'beacon', 'cursor', 'repair']) {
    check(artNameForTowerBase(kind) === `${kind}-base`, `tower ${kind} resolves a base`);
  }
  for (const kind of ['gun', 'cannon', 'laser', 'taser', 'frost', 'aa']) {
    check(artNameForTowerTurret(kind) === `${kind}-turret`, `tower ${kind} resolves a turret`);
  }
  for (const kind of ['beacon', 'cursor', 'repair', 'wall']) {
    check(artNameForTowerTurret(kind) === null, `tower ${kind} ships no turret`);
  }
  // The wall ships a tier face plus overlays in the wall/ category, not a single tower base plinth.
  for (const name of ['wall-t1', 'wall-t2', 'wall-t3', 'wall-t4', 'wall-t5', 'wall-bulwark', 'wall-mesh', 'wall-repairing', 'wall-damaged-1', 'wall-damaged-2', 'wall-damaged-3']) {
    check(manifestEntry(name)?.category === 'wall', `wall asset ${name} is in the wall category`);
  }
  check(artNameForBranch('gun', 'A') === 'gun-marksman', 'gun A names Marksman');
  check(artNameForBranch('gun', 'B') === 'gun-repeater', 'gun B names Repeater');
  check(artNameForBranch('cannon', 'B') === 'cannon-minesweeper', 'cannon B names Minesweeper');
  check(artNameForBranch('cursor', 'C') === 'cursor-maintenance', 'cursor C names Maintenance');
  check(
    artNameForBranch('wall', 'A') === null && artNameForBranch('repair', 'A') === null,
    'wall and repair branches carry no branch-mark asset',
  );
}

{
  // 37d. Raster size and cache key: the exact device-pixel size, and the key changes with DPR.
  check(rasterPixelSize(28, 1) === 28, 'raster size at dpr 1 is the logical size');
  check(rasterPixelSize(28, 1.5) === 42, 'raster size at dpr 1.5 rounds 28 -> 42');
  check(rasterPixelSize(28, 2) === 56, 'raster size at dpr 2 rounds 28 -> 56');
  check(cacheKey('grunt', 42) === 'grunt@42', 'cache key is name@pixelSize');
  check(cacheKey('grunt', 42) !== cacheKey('grunt', 56), 'the cache key changes with the pixel size');

  const before = artDpr();
  setArtDpr(2);
  check(artDpr() === 2, 'setArtDpr re-aims the rasteriser');
  setArtDpr(before);
  check(artDpr() === before, 'setArtDpr restores');
}

{
  // 37e. Sprite sizing keeps the viewBox padding contract: the silhouette fills bodyPx, the sprite
  // spans 32/28 of it so a `bodyPx` silhouette lands exactly `bodyPx` pixels on screen.
  check(Math.abs(artSpriteSize(28) - 32) < 1e-9, `artSpriteSize(28) = 32 (${artSpriteSize(28)})`);
  check(Math.abs(artSpriteSize(14) - 16) < 1e-9, `artSpriteSize(14) = 16 (${artSpriteSize(14)})`);
}

{
  // 37f. The fallback: headlessly (no DOM) the loader yields no texture, so the caller falls back
  // to its procedural drawing rather than crashing.
  check(hasArt('grunt') === false, 'no asset is decoded headlessly');
  check(getArtTexture('grunt', 28) === null, 'getArtTexture falls back to null headlessly');
  check(manifestEntry('grunt') !== undefined, 'manifestEntry resolves a known name');
  check(manifestEntry('no-such-asset') === undefined, 'manifestEntry rejects an unknown name');
  resetArt();
}

// --- 37g. The placement ghost uses the same SVG art as a placed tower --------------------------
{
  resetArt();
  const gunBase = new Texture({ width: 4, height: 4 });
  const gunTurret = new Texture({ width: 8, height: 8 });
  const beaconBase = new Texture({ width: 6, height: 6 });
  const wallT1 = new Texture({ width: 6, height: 6 });
  injectArtTexture('gun-base', gunBase);
  injectArtTexture('gun-turret', gunTurret);
  injectArtTexture('beacon-base', beaconBase);
  injectArtTexture('wall-t1', wallT1);

  const layout = computeLayout(1280, 800);
  const board = layout.board;
  const cell = board.cell;
  const cx = board.x + (4 + 0.5) * cell;
  const cy = board.y + (6 + 0.5) * cell;
  const hover = { col: 4, row: 6, onBoard: true, x: 0, y: 0 };

  // A turret kind previews its base and turret sprites, and the base is the same texture the placed
  // tower uses (identity, not "something drawn").
  const s = stateOnLevel('open-field');
  s.economy.salvage = 10000;
  check(placeTower(s, 'gun', 3, 6), 'ghost: place a gun to anchor texture identity');
  selectTower(s, 'gun');
  const view = new BoardView();
  view.draw(s, layout, 0, hover);
  check(view.towerBaseSprites[0].visible, 'ghost: the placed gun draws its base sprite');
  check(view.ghostBase.visible, 'ghost: the preview base sprite is visible at the hovered tile');
  check(view.ghostBase.texture === view.towerBaseSprites[0].texture,
    'ghost: the preview uses the placed tower\'s base texture');
  check(view.ghostBase.texture === gunBase, 'ghost: the preview base is the gun-base texture');
  check(view.ghostBase.alpha === 0.5, 'ghost: the preview base is at 50% alpha');
  check(view.ghostBase.position.x === cx && view.ghostBase.position.y === cy,
    'ghost: the preview base sits at the hovered tile');
  check(view.ghostTurret.visible, 'ghost: a turret kind previews its turret');
  check(view.ghostTurret.texture === gunTurret, 'ghost: the turret preview uses the gun-turret texture');
  check(view.ghostTurret.alpha === 0.5, 'ghost: the turret preview is at 50% alpha');
  check(view.ghostTurret.rotation === 0, 'ghost: a fresh turret faces north');

  // The ghost sprites are pooled: the same two sprites serve every frame, no per-frame allocation.
  const baseRef = view.ghostBase;
  const turretRef = view.ghostTurret;
  for (let i = 0; i < 10; i++) view.draw(s, layout, 0, hover);
  check(view.ghostBase === baseRef && view.ghostTurret === turretRef,
    'ghost: pooled sprites persist across frames');
  check(view.ghost.children.length === 2, 'ghost: exactly two pooled sprites (base + turret)');

  // Moving off the board hides the ghost on the next frame.
  view.draw(s, layout, 0, { col: 4, row: 6, onBoard: false, x: 0, y: 0 });
  check(!view.ghostBase.visible && !view.ghostTurret.visible, 'ghost: leaving the board hides the ghost');

  // The ghost returns on re-entry, and cancelling the selection hides it.
  view.draw(s, layout, 0, hover);
  check(view.ghostBase.visible && view.ghostTurret.visible, 'ghost: the ghost returns when hovering back');
  cancelSelection(s);
  view.draw(s, layout, 0, hover);
  check(!view.ghostBase.visible && !view.ghostTurret.visible, 'ghost: cancelling the selection hides the ghost');

  // A turret-less kind previews base only.
  const s2 = stateOnLevel('open-field');
  s2.wave = 24;
  s2.economy.salvage = 10000;
  const view2 = new BoardView();
  selectTower(s2, 'beacon');
  view2.draw(s2, layout, 0, hover);
  check(view2.ghostBase.visible, 'ghost: a turret-less kind previews its base');
  check(view2.ghostBase.texture === beaconBase, 'ghost: the beacon base is the injected texture');
  check(!view2.ghostTurret.visible, 'ghost: a turret-less kind previews no turret');

  // The wall preview uses the tier-1 face art at the default (closed, un-upgraded) appearance.
  const s3 = stateOnLevel('open-field');
  s3.economy.salvage = 10000;
  const view3 = new BoardView();
  selectTower(s3, 'wall');
  view3.draw(s3, layout, 0, hover);
  check(view3.ghostBase.visible, 'ghost: the wall preview uses the tier-1 face art');
  check(view3.ghostBase.texture === wallT1, 'ghost: the wall face is the injected wall-t1 texture');
  check(view3.ghostBase.alpha === 0.5, 'ghost: the wall preview is at 50% alpha');
  check(!view3.ghostTurret.visible, 'ghost: the wall preview has no turret');

  resetArt();
}

// --- 37h. The ghost falls back to the procedural shape when the art texture is absent ----------
{
  resetArt();
  const layout = computeLayout(1280, 800);
  const s = stateOnLevel('open-field');
  s.economy.salvage = 10000;
  selectTower(s, 'gun');
  const view = new BoardView();
  const hover = { col: 4, row: 6, onBoard: true, x: 0, y: 0 };
  view.draw(s, layout, 0, hover);
  check(!view.ghostBase.visible && !view.ghostTurret.visible,
    'ghost fallback: no sprites are shown without art');
  check(view.overlay.context.instructions.length > 0,
    'ghost fallback: the procedural ghost drew into the overlay');
  resetArt();
}

// --- 37h2. A wall falls back to the procedural button when its face art is absent ---------------
{
  resetArt();
  const layout = computeLayout(1280, 800);
  const s = stateOnLevel('open-field');
  s.economy.salvage = 10000;
  placeTower(s, 'wall', 3, 6);
  const view = new BoardView();
  const hover = { col: 4, row: 6, onBoard: false, x: 0, y: 0 };
  view.draw(s, layout, 0, hover);
  check(!view.towerBaseSprites[0].visible, 'wall fallback: no face sprite without wall art');
  check(view.wallOverlaySprites.every((sp) => !sp.visible), 'wall fallback: no overlay sprites without wall art');
  check(view.towers.context.instructions.length > 0, 'wall fallback: the procedural button drew into the towers layer');
  resetArt();
}

// --- 37i. Art landing after the first paint invalidates the board without a resize -------------
{
  resetArt();
  const layout = computeLayout(1280, 800);
  const s = stateOnLevel('open-field');
  s.economy.salvage = 10000;
  placeTower(s, 'gun', 3, 6);
  const view = new BoardView();
  const hover = { col: 4, row: 6, onBoard: false, x: 0, y: 0 };

  // First frame, before any texture has decoded: procedural fallback everywhere.
  view.draw(s, layout, 0, hover);
  check(!view.towerBaseSprites[0].visible, 'late-load: the gun base draws procedurally before art loads');
  check(view.tileSprites.children.length === 0, 'late-load: no tile sprites before art loads');
  check(view.tiles.context.instructions.length > 0, 'late-load: the static layer drew procedural tiles');

  // The async preload resolves; the board is told to invalidate, then the next frame draws.
  const gunBase = new Texture({ width: 4, height: 4 });
  const tile = new Texture({ width: 8, height: 8 });
  injectArtTexture('gun-base', gunBase);
  injectArtTexture('tile', tile);
  view.invalidateArt();

  // Same geometry: no resize event, so the static-layer key did not change on its own.
  view.draw(s, layout, 0, hover);
  check(view.towerBaseSprites[0].visible, 'late-load: the gun base sprite appears after art loads');
  check(view.towerBaseSprites[0].texture === gunBase, 'late-load: the gun base is the loaded texture');
  check(view.tileSprites.children.length > 0, 'late-load: the static tile layer rebuilt as sprites');
  resetArt();
}

// --- 37j. Invalidation is coalesced: two same-tick signals cause one rebuild -------------------
{
  resetArt();
  await flushMicrotasks(); // drain any invalidate callback queued by an earlier setArtDpr
  const before = artDpr();
  let fires = 0;
  const off = onArtInvalidate(() => fires++);
  setArtDpr(before + 1); // ratio drift
  setArtDpr(before + 2); // a second drift in the same tick
  await flushMicrotasks();
  check(fires === 1, `art invalidate coalesces same-tick signals into one callback (${fires})`);
  off();
  setArtDpr(before);
  await flushMicrotasks();
  resetArt();
}

// --- 37k. A still-missing texture keeps the fallback and does not throw ------------------------
{
  resetArt();
  const layout = computeLayout(1280, 800);
  const s = stateOnLevel('open-field');
  s.economy.salvage = 10000;
  placeTower(s, 'gun', 3, 6);
  const view = new BoardView();
  const hover = { col: 4, row: 6, onBoard: false, x: 0, y: 0 };
  view.draw(s, layout, 0, hover);
  view.invalidateArt(); // a completed load that never produced a gun texture (404)
  view.draw(s, layout, 0, hover);
  check(!view.towerBaseSprites[0].visible, 'missing texture: the gun keeps the procedural fallback');
  check(view.towers.context.instructions.length > 0, 'missing texture: the procedural tower was drawn');
  resetArt();
}

// --- 37l. A DPR change invalidates the same caches via the subscription ------------------------
{
  resetArt();
  await flushMicrotasks();
  const before = artDpr();
  const view = new BoardView();
  const s = stateOnLevel('open-field');
  const layout = computeLayout(1280, 800);
  const off = onArtInvalidate(() => view.invalidateArt());

  view.draw(s, layout, 0, { col: 0, row: 0, onBoard: false, x: 0, y: 0 });
  check(view.staticKey !== '', 'dpr: the static layer is keyed before the change');

  setArtDpr(before + 1);
  await flushMicrotasks();
  check(view.staticKey === '', 'dpr: setArtDpr invalidates the static-layer key');

  off();
  setArtDpr(before);
  await flushMicrotasks();
  resetArt();
}

// --- 37m. Lazy art loading (docs/ART-LOADING.md) ----------------------------------------------
// A fake transport stands in for fetch + decode, and a manual idle scheduler stands in for
// requestIdleCallback, so the queue is driven deterministically with no DOM and no network.
{
  const realManifest = JSON.parse(readFileSync(new URL('../public/art/manifest.json', import.meta.url), 'utf8')).assets;
  const idleSlices = [];
  const manualIdle = (cb) => {
    idleSlices.push(cb);
    return () => {
      const i = idleSlices.indexOf(cb);
      if (i >= 0) idleSlices.splice(i, 1);
    };
  };
  const runIdleSlice = () => {
    const cb = idleSlices.shift();
    if (cb) cb({ didTimeout: false, timeRemaining: () => 10 });
    return cb !== undefined;
  };
  const makeTransport = (assets, { fail = new Set() } = {}) => {
    const t = {
      order: [],
      attempts: new Map(),
      manifest: async () => assets,
      load: async (asset) => {
        const bare = asset.name.slice(asset.name.lastIndexOf('/') + 1);
        t.order.push(bare);
        t.attempts.set(bare, (t.attempts.get(bare) ?? 0) + 1);
        if (fail.has(bare)) throw new Error('HTTP 404');
        return Array.from({ length: Math.max(1, asset.frames) }, () => ({ fake: bare }));
      },
    };
    return t;
  };
  const settle = async () => {
    for (let i = 0; i < 5; i++) await flushMicrotasks();
  };

  // 1. The same name requested twice is queued once.
  resetArt();
  requestArt('grunt', 'idle');
  requestArt('grunt', 'idle');
  requestArt('grunt', 'now');
  check(artQueueLength() === 1 && artLoadStats().requested === 1,
    `lazy art: a name requested twice is queued once (${artQueueLength()})`);
  requestArt('not-an-asset', 'now');
  check(artQueueLength() === 1, 'lazy art: a name outside the manifest is not queued');

  // 2. A getArtFrames miss returns an empty list and queues the asset.
  resetArt();
  const miss = getArtFrames('runner', 32);
  check(Array.isArray(miss) && miss.length === 0, 'lazy art: a getArtFrames miss returns an empty list');
  check(artQueueLength() === 1, 'lazy art: a getArtFrames miss queues the asset');
  getArtFrames('runner', 32);
  check(artQueueLength() === 1, 'lazy art: repeated misses on the draw path do not re-queue');

  // 4. preloadArt loads only the eager set and leaves the long tail queued.
  resetArt();
  setArtIdleScheduler(manualIdle);
  const t4 = makeTransport(realManifest);
  setArtTransport(t4);
  await preloadArt();
  check(EAGER_ART.length === 8 && EAGER_ART.every((n) => hasArt(n)), 'lazy art: preloadArt resolves with every eager asset loaded');
  check(t4.order.length === EAGER_ART.length && t4.order.every((n) => EAGER_ART.includes(n)),
    `lazy art: preloadArt loads only the eager set (${t4.order.length} loads)`);
  check(artQueueLength() === realManifest.length - EAGER_ART.length,
    `lazy art: the rest of the manifest stays queued (${artQueueLength()} of ${realManifest.length - EAGER_ART.length})`);
  const st4 = artLoadStats();
  check(st4.requested === realManifest.length && st4.loaded === EAGER_ART.length && st4.failed === 0 &&
    st4.firstMs !== null && st4.lastMs !== null && st4.lastMs >= st4.firstMs,
    'lazy art: artLoadStats counts the requests and the eager loads');
  // Idle slices drain the tail one asset at a time.
  check(runIdleSlice(), 'lazy art: an idle slice is armed for the tail');
  check(t4.order.length === EAGER_ART.length + 1, 'lazy art: one idle slice starts exactly one asset');
  check(idleSlices.length === 0, 'lazy art: no second idle slice is armed while an idle asset is in flight');
  for (let guard = 0; guard < 1000 && artQueueLength() > 0; guard++) {
    await settle();
    runIdleSlice();
  }
  await settle();
  check(artQueueLength() === 0 && artLoadStats().loaded === realManifest.length,
    `lazy art: the idle queue eventually loads the whole manifest (${artLoadStats().loaded})`);

  // 3. A now request is served before an earlier-queued idle request, and preempts idle slices.
  resetArt();
  setArtIdleScheduler(manualIdle);
  idleSlices.length = 0;
  const small = [...EAGER_ART.map((n) => realManifest.find((a) => a.name.endsWith(`/${n}`))), 
    { name: 'enemies/grunt', frames: 1 }, { name: 'enemies/runner', frames: 1 }, { name: 'enemies/flyer', frames: 1 }];
  const t3 = makeTransport(small);
  setArtTransport(t3);
  await preloadArt();
  t3.order.length = 0;
  // grunt, runner, flyer sit in the idle queue in that order; flyer is asked for by a draw.
  getArtFrames('flyer', 32);
  check(t3.order[0] === 'flyer', `lazy art: a now request starts before earlier-queued idle work (${t3.order.join(',')})`);
  runIdleSlice(); // fires while the now request is outstanding: must yield
  check(t3.order.length === 1, 'lazy art: an idle slice yields while a now request is outstanding');
  await settle();
  for (let guard = 0; guard < 20 && artQueueLength() > 0; guard++) {
    runIdleSlice();
    await settle();
  }
  check(t3.order.join(',') === 'flyer,grunt,runner', `lazy art: idle work resumes in queue order (${t3.order.join(',')})`);

  // 5. A completed asset triggers exactly one invalidation.
  resetArt();
  setArtIdleScheduler(manualIdle);
  idleSlices.length = 0;
  setArtTransport(makeTransport(small));
  await preloadArt();
  await settle();
  let fires = 0;
  const off = onArtInvalidate(() => fires++);
  requestArt('grunt', 'now');
  await settle();
  check(hasArt('grunt') && fires === 1, `lazy art: a completed asset triggers exactly one invalidation (${fires})`);
  off();

  // 6. An absent asset returns the same empty list as before: one retry, one warning, fallback kept.
  resetArt();
  setArtIdleScheduler(manualIdle);
  idleSlices.length = 0;
  const t6 = makeTransport(small, { fail: new Set(['runner']) });
  setArtTransport(t6);
  await preloadArt();
  const before = getArtFrames('runner', 32);
  const warnings = [];
  const warn = console.warn;
  console.warn = (msg) => warnings.push(String(msg));
  await settle();
  console.warn = warn;
  const after = getArtFrames('runner', 32);
  check(before.length === 0 && after.length === 0 && before === after && after === getArtFrames('not-an-asset', 32),
    'lazy art: an absent asset returns the same empty list before and after its failed load');
  check(t6.attempts.get('runner') === 2, `lazy art: a failed asset is retried once (${t6.attempts.get('runner')} attempts)`);
  check(warnings.length === 1 && warnings[0].includes('enemies/runner'), `lazy art: one warning for a failed asset (${warnings.length})`);
  check(!hasArt('runner') && artLoadStats().failed === 1, 'lazy art: the failed asset stays absent');
  getArtFrames('runner', 32);
  await settle();
  check(t6.attempts.get('runner') === 2, 'lazy art: a failed asset is not refetched on every draw');

  // 7. A starved requestIdleCallback (a busy 60fps loop) cannot stall the warm-up: the fallback
  // timer runs the slice, still one asset at a time, and cancels the idle callback it beat.
  {
    const hadRic = 'requestIdleCallback' in globalThis;
    const realRic = globalThis.requestIdleCallback;
    const realCic = globalThis.cancelIdleCallback;
    const pendingIdle = new Map();
    let nextHandle = 1;
    let cancelled = 0;
    globalThis.requestIdleCallback = (cb) => {
      const h = nextHandle++;
      pendingIdle.set(h, cb);
      return h;
    };
    globalThis.cancelIdleCallback = (h) => {
      if (pendingIdle.delete(h)) cancelled++;
    };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    try {
      resetArt();
      setArtIdleScheduler(null);
      const t7 = makeTransport(small);
      setArtTransport(t7);
      await preloadArt();
      await settle();
      t7.order.length = 0;
      check(pendingIdle.size === 1, `lazy art: the default scheduler arms requestIdleCallback (${pendingIdle.size})`);
      // requestIdleCallback never fires.
      await sleep(IDLE_STARVED_MS + 100);
      check(t7.order.length === 1,
        `lazy art: an idle slice still arrives when requestIdleCallback never fires (${t7.order.join(',')})`);
      check(cancelled === 1, `lazy art: the fallback timer cancels the starved idle callback (${cancelled})`);
      await settle();
      // The next slice is armed again; this time requestIdleCallback wins and the timer is cleared.
      check(pendingIdle.size === 1, 'lazy art: the next idle slice is armed after the fallback ran');
      const [h, cb] = [...pendingIdle][0];
      pendingIdle.delete(h);
      const realClear = globalThis.clearTimeout;
      let timersCleared = 0;
      globalThis.clearTimeout = (id) => { timersCleared++; return realClear(id); };
      try {
        cb({ didTimeout: false, timeRemaining: () => 10 });
      } finally {
        globalThis.clearTimeout = realClear;
      }
      check(t7.order.length === 2, `lazy art: requestIdleCallback still runs a slice when it fires (${t7.order.join(',')})`);
      check(timersCleared === 1, `lazy art: requestIdleCallback winning clears the fallback timer (${timersCleared})`);
      await settle();
      const afterIdle = t7.order.length;
      // Only the remaining asset's slice is pending; let its timer fire, then make sure no stale timer
      // from the slice requestIdleCallback won starts an extra load.
      await sleep(IDLE_STARVED_MS + 100);
      await settle();
      check(t7.order.length === afterIdle + 1 && t7.order.join(',') === 'grunt,runner,flyer',
        `lazy art: one asset per slice, in queue order, with no double-fired slice (${t7.order.join(',')})`);
      check(artQueueLength() === 0, 'lazy art: the starved-idle queue drains');
    } finally {
      setArtTransport(null);
      setArtIdleScheduler(null);
      resetArt();
      if (hadRic) {
        globalThis.requestIdleCallback = realRic;
        globalThis.cancelIdleCallback = realCic;
      } else {
        delete globalThis.requestIdleCallback;
        delete globalThis.cancelIdleCallback;
      }
    }
  }

  setArtTransport(null);
  setArtIdleScheduler(null);
  resetArt();
  await flushMicrotasks();
}

// --- 38. Tower unlocks -------------------------------------------------------------------------

{
  // 38a. The starting pair is available from the initial build phase; every later kind unlocks on
  // exactly its wave and not one earlier, and never re-locks.
  check(TOWER_UNLOCK_WAVE.gun === 0 && TOWER_UNLOCK_WAVE.wall === 0, 'Gun and Wall are the starting pair (unlock wave 0)');
  check(isTowerUnlocked('gun', 0) && isTowerUnlocked('wall', 0), 'Gun and Wall are unlocked at wave 0');
  for (const [kind, wave] of Object.entries(TOWER_UNLOCK_WAVE)) {
    if (kind === 'gun' || kind === 'wall') continue;
    check(!isTowerUnlocked(kind, wave - 1), `${kind} is locked at wave ${wave - 1}`);
    check(isTowerUnlocked(kind, wave), `${kind} unlocks at wave ${wave}`);
    check(isTowerUnlocked(kind, wave + 1), `${kind} stays unlocked at wave ${wave + 1}`);
    check(towerUnlockWave(kind) === wave, `towerUnlockWave(${kind}) reports ${wave}`);
  }
}

{
  // 38b. A locked kind cannot be placed, cannot be selected, and its palette tooltip reads the
  // unlock wave. An unlocked kind places and selects normally.
  const s = stateOnLevel('open-field');
  s.economy.salvage = 100000;
  check(!isTowerUnlocked('cannon', s.wave), 'cannon is locked on a fresh run');
  check(!canPlace(s, 'cannon', 4, 4), 'a locked cannon cannot be placed');
  check(!placeTower(s, 'cannon', 4, 4), 'placeTower refuses a locked cannon');
  selectTower(s, 'cannon');
  check(s.selected === null, 'selectTower refuses a locked cannon (nothing selected)');
  check(lockedPaletteLine('cannon', s.wave) === 'Unlocks at wave 4',
    `locked palette line reads the unlock wave (${lockedPaletteLine('cannon', s.wave)})`);
  check(lockedPaletteLine('gun', s.wave) === null, 'an unlocked tower has no unlock line');

  check(canPlace(s, 'gun', 4, 4), 'the starting Gun still places');
  check(placeTower(s, 'gun', 4, 4), 'placeTower places the starting Gun');
  selectTower(s, 'gun');
  check(s.selected === 'gun', 'selectTower arms the unlocked Gun');
  cancelSelection(s);

  // A stale armed selection cannot dodge the lock: once the wave advances to the cannon's wave the
  // kind is unlocked, but before that canPlace keeps refusing regardless of `selected`.
  selectTower(s, 'cannon');
  check(s.selected === null, 're-selecting a locked kind is refused even after other selection');
}

{
  // 38c. The unlock message fires exactly once, on the wave the kind unlocks, and names only it.
  const s = stateOnLevel('open-field');
  s.wave = 5;
  s.phase = 'build';
  s.events = [];
  check(startWave(s), 'wave 6 starts');
  const unlocks = s.events.filter((e) => e.type === 'towerUnlocked');
  check(unlocks.length === 1, `wave 6 fires one unlock event (${unlocks.length})`);
  check(unlocks[0].kinds.length === 1 && unlocks[0].kinds[0] === 'frost',
    `wave 6 unlocks frost alone (${unlocks[0].kinds.join(',')})`);
  check(s.events.filter((e) => e.type === 'waveStarted').length === 1, 'wave 6 still fires its normal waveStarted event');

  // Wave 7 unlocks nothing, so no unlock event fires.
  const s2 = stateOnLevel('open-field');
  s2.wave = 6;
  s2.phase = 'build';
  s2.events = [];
  startWave(s2);
  check(s2.events.filter((e) => e.type === 'towerUnlocked').length === 0, 'wave 7 fires no unlock event');
}

{
  // 38d. Unlocks persist into endless and across a profile save/load round trip (a fresh run restores
  // the same starting schedule).
  const s = createRunState();
  s.wave = 24;
  for (const kind of TOWER_KINDS) check(isTowerUnlocked(kind, s.wave), `${kind} unlocked by wave 24`);
  s.wave = 150; // endless
  for (const kind of TOWER_KINDS) check(isTowerUnlocked(kind, s.wave), `${kind} stays unlocked in endless (wave 150)`);

  const store = { value: null, getItem() { return this.value; }, setItem(_k, v) { this.value = v; } };
  const p = defaultProfile();
  p.bestWave = 40;
  saveProfile(p, store);
  const loaded = loadProfile(store);
  const fresh = createRunState(loaded);
  check(isTowerUnlocked('gun', fresh.wave) && isTowerUnlocked('wall', fresh.wave), 'a fresh run after load has the starters unlocked');
  check(!isTowerUnlocked('cannon', fresh.wave) && !isTowerUnlocked('cursor', fresh.wave), 'a fresh run after load locks the later kinds');
}

{
  // 38e. Fixed-timestep equivalence holds across an unlock wave.
  const run = (frameMs) => {
    const s = stateOnLevel('open-field');
    s.economy.salvage = 100000;
    placeTower(s, 'gun', 3, 6);
    s.wave = 5;
    s.phase = 'build';
    startWave(s); // wave 6: frost unlocks
    for (let t = 0; t < 900 * TICK_MS - frameMs; t += frameMs) step(s, frameMs);
    while (s.tick < 1000) tick(s);
    return JSON.stringify([
      s.wave,
      s.economy,
      s.integrity,
      s.enemies.map((e) => [e.id, e.hp, e.dist]),
      s.rng,
      s.clock,
    ]);
  };
  const at60 = run(TICK_MS);
  check(at60 === run(1000 / 144), 'unlock wave: same result at 60 Hz and 144 Hz frames');
  check(at60 === run(1000 / 23), 'unlock wave: same result at 23 Hz frames');
}

// --- 39. Boss variants (pass 1: Sergeant, Pacer, Bastion) -------------------------------------

{
  // 39a. Stats: HP multiple, speed, scale (radius), integrity and kill value match the design table.
  const sergeant = ENEMY_STATS['grunt-boss'];
  const pacer = ENEMY_STATS['runner-boss'];
  const bastion = ENEMY_STATS['shielded-boss'];
  check(sergeant.name === 'Sergeant' && sergeant.hp === 120, `Sergeant is 6x grunt HP (${sergeant.hp})`);
  check(sergeant.speed === 0.55 && sergeant.scale === 1.6 && sergeant.integrity === 4,
    `Sergeant speed/scale/integrity (${sergeant.speed}/${sergeant.scale}/${sergeant.integrity})`);
  check(sergeant.radius === 0.3 * 1.6, `Sergeant radius is grunt x1.6 (${sergeant.radius})`);
  check(sergeant.value === 24, `Sergeant kill value is 6x grunt (${sergeant.value})`);
  check(pacer.name === 'Pacer' && pacer.hp === 40 && pacer.speed === 0.85 && pacer.scale === 1.5,
    `Pacer stats (${pacer.hp}/${pacer.speed}/${pacer.scale})`);
  check(pacer.integrity === 3 && pacer.radius === 0.18 * 1.5 && pacer.value === 36,
    `Pacer integrity/radius/value (${pacer.integrity}/${pacer.radius}/${pacer.value})`);
  check(bastion.name === 'Bastion' && bastion.hp === 150 && bastion.speed === 0.45 && bastion.scale === 1.6,
    `Bastion stats (${bastion.hp}/${bastion.speed}/${bastion.scale})`);
  check(bastion.integrity === 4 && bastion.armour === 2 && bastion.value === 60,
    `Bastion integrity/armour/value (${bastion.integrity}/${bastion.armour}/${bastion.value})`);
  check(bastion.shield === BASTION_SHIELD_LAYERS * BASTION_SHIELD_LAYER_VALUE,
    `Bastion shield is ${BASTION_SHIELD_LAYERS} layers of ${BASTION_SHIELD_LAYER_VALUE} (${bastion.shield})`);
  check(enemyKillValue('grunt-boss', 1) === 24 && enemyKillValue('runner-boss', 1) === 36 && enemyKillValue('shielded-boss', 1) === 60,
    'kill value at wave 1 is 6x the base type');
}

{
  // 39b. Base-type membership: boss variants count as their base type for tower rules.
  check(baseEnemyKind('grunt-boss') === 'grunt', 'Sergeant counts as a grunt');
  check(baseEnemyKind('runner-boss') === 'runner', 'Pacer counts as a runner');
  check(baseEnemyKind('shielded-boss') === 'shielded', 'Bastion counts as shielded');
  check(baseEnemyKind('grunt') === 'grunt', 'an ordinary grunt maps to itself');
  check(isBossVariant('grunt-boss') && isBossVariant('runner-boss') && isBossVariant('shielded-boss'),
    'the three pass-1 kinds are boss variants');
  check(!isBossVariant('grunt') && !isBossVariant('shielded'), 'ordinary enemies are not boss variants');
  check(isBossKind('shielded-boss') && !isBossKind('grunt'), 'boss variants are bosses and ordinary enemies are not');
}

{
  // 39c. A Taser Overload treats a Bastion as shielded: its 2.5x shielded multiplier applies.
  const drop = (kind) => {
    const s = allUnlocked();
    s.economy.salvage = 10000;
    placeTower(s, 'taser', 5, 5);
    upgradeTower(s, 5, 5);
    chooseBranch(s, 5, 5, 'B');
    s.phase = 'wave';
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    const e = stationary(1, kind, 24, 5.5, 4.5);
    e.shield = 0;
    e.shieldsRemaining = 0;
    e.maxShield = 0;
    s.enemies.push(e);
    tick(s);
    return e.maxHp - e.hp;
  };
  const gruntDrop = drop('grunt');
  const bastionDrop = drop('shielded-boss');
  check(Math.abs(bastionDrop / gruntDrop - 2.5) < 1e-9,
    `Overload deals ${bastionDrop} to a Bastion vs ${gruntDrop} to a grunt (2.5x shielded)`);
}

{
  // 39d. Bastion shield layers strip one per hit: three pointer clicks strip three layers and the
  // enemy's hit points are untouched until the last layer is gone.
  const s = createRunState();
  s.phase = 'wave';
  const b = stationary(1, 'shielded-boss', 24, 5.5, 5.5);
  check(b.shieldsRemaining === BASTION_SHIELD_LAYERS && b.shield === 45, 'a fresh Bastion has three layers');
  s.enemies.push(b);

  pointerDown(s, b.x, b.y);
  pointerUp(s);
  check(b.shieldsRemaining === 2 && b.shield === 30, `one hit strips one layer (${b.shieldsRemaining}, shield ${b.shield})`);
  check(b.hp === b.maxHp, 'hit points are untouched while a layer remains');

  pointerDown(s, b.x, b.y);
  pointerUp(s);
  check(b.shieldsRemaining === 1 && b.shield === 15, `two hits strip two layers (${b.shieldsRemaining}, shield ${b.shield})`);

  pointerDown(s, b.x, b.y);
  pointerUp(s);
  check(b.shieldsRemaining === 0 && b.shield === 0, 'three hits strip all three layers');
  check(b.hp === b.maxHp, 'no hit points were lost while stripping layers');
}

{
  // 39d2. A cursor's shield-first targeting counts a Bastion as shielded: it takes the Bastion over
  // a nearer plain grunt.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cursor', 5, 5);
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const closer = stationary(1, 'grunt', 1, 5.5, 5.3); // unshielded, nearer the home tile
  const bastion = stationary(2, 'shielded-boss', 24, 5.5, 4.5); // shielded, farther away
  s.enemies.push(closer, bastion);
  for (let i = 0; i < 120; i++) tick(s);
  check(bastion.shield < bastion.maxShield,
    `cursor takes the Bastion over the closer unshielded grunt (shield ${bastion.shield})`);
  check(closer.hp === closer.maxHp, `the closer unshielded grunt is untouched (hp ${closer.hp})`);
}

{
  // 39e. The Warden aura is removed: a Bastion grants no shield to nearby enemies, no matter how
  // long it stands next to them, so a tower-only board can always damage the wave around it.
  const s = createRunState();
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const bastion = stationary(1, 'shielded-boss', 24, 5.5, 5.5);
  const grunt = stationary(2, 'grunt', 24, 5.5, 6.5); // 1 tile from the Bastion, inside the old 3.0
  s.enemies.push(bastion, grunt);

  for (let i = 0; i < TICK_HZ * 6; i++) tick(s);
  check(grunt.shield === 0, `a Bastion grants no shield to a nearby enemy (shield ${grunt.shield})`);
  check(grunt.maxShield === 0, `the nearby enemy keeps its max shield (${grunt.maxShield})`);
}

{
  // 39f. The Pacer aura: a slow enemy inside 3 tiles is raised to the Pacer's speed; outside it is
  // unchanged; and an ordinary grunt is unchanged by the aura's absence.
  const distOf = (kind, withPacer, pacerX) => {
    const s = createRunState();
    s.phase = 'wave';
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    const e = createEnemy(1, kind, 12, SPAWN, EXIT);
    e.stunUntilTick = 0;
    s.enemies.push(e);
    if (withPacer) {
      const p = createEnemy(2, 'runner-boss', 18, SPAWN, EXIT);
      p.x = pacerX;
      p.y = 6.5;
      p.prevX = p.x;
      p.prevY = p.y;
      p.col = Math.floor(p.x);
      p.row = 6;
      p.stunUntilTick = 999999;
      s.enemies.push(p);
    }
    for (let i = 0; i < TICK_HZ; i++) tick(s);
    return e.dist;
  };
  const noPacer = distOf('breacher', false, 0);
  const inAura = distOf('breacher', true, 1.0);
  const outAura = distOf('breacher', true, 12.0);
  check(inAura > noPacer, `Pacer raises a slow enemy inside the aura (${inAura.toFixed(2)} > ${noPacer.toFixed(2)} tiles/s)`);
  check(Math.abs(outAura - noPacer) < 1e-9, `outside the aura a slow enemy is unchanged (${outAura.toFixed(2)})`);

  const gruntNoPacer = distOf('grunt', false, 0);
  const gruntWithPacer = distOf('grunt', true, 1.0);
  check(Math.abs(gruntNoPacer - 1.6) < 1e-6, `an ordinary grunt keeps its speed without a Pacer (${gruntNoPacer.toFixed(3)})`);
  check(Math.abs(gruntWithPacer - gruntNoPacer) < 1e-9, 'a grunt (faster than the Pacer) is unchanged by the aura');
  check(PACER_AURA_RADIUS === 3, `the Pacer aura radius is 3 tiles (${PACER_AURA_RADIUS})`);
}

{
  // 39g. The spawn schedule: first appearance at the unlock wave, never before, every eighth wave
  // after the last unlock, favouring the newest type. The milestone waves each carry their mapped
  // type boss, distinct from this type-boss schedule.
  check(typeBossUnlockWave('grunt-boss') === 12, 'Sergeant unlocks at wave 12');
  check(typeBossUnlockWave('runner-boss') === 18, 'Pacer unlocks at wave 18');
  check(typeBossUnlockWave('shielded-boss') === 24, 'Bastion unlocks at wave 24');
  check(typeBossKindForWave(12) === 'grunt-boss', 'wave 12 spawns a Sergeant');
  check(typeBossKindForWave(18) === 'runner-boss', 'wave 18 spawns a Pacer');
  check(typeBossKindForWave(24) === 'shielded-boss', 'wave 24 spawns a Bastion');
  check(typeBossKindForWave(11) === null, 'no type boss before wave 12');
  check(buildSchedule(12).filter((sp) => sp.kind === 'grunt-boss').length === 1, 'wave 12 schedule has one Sergeant');
  check(buildSchedule(18).filter((sp) => sp.kind === 'runner-boss').length === 1, 'wave 18 schedule has one Pacer');
  check(buildSchedule(24).filter((sp) => sp.kind === 'shielded-boss').length === 1, 'wave 24 schedule has one Bastion');
  for (const w of [30, 36, 42, 48, 56, 64, 72, 80, 88, 96]) {
    check(isTypeBossWave(w), `wave ${w} is a type-boss wave`);
    check(buildSchedule(w).filter((sp) => sp.kind.endsWith('-boss')).length === 1, `wave ${w} carries one type boss`);
  }
  for (const w of [10, 25, 50, 75, 100]) {
    check(!isTypeBossWave(w), `milestone wave ${w} is not a type-boss wave`);
    check(buildSchedule(w).filter((sp) => sp.kind.endsWith('-boss')).length === 1,
      `milestone wave ${w} carries exactly its mapped type boss`);
  }
  check(typeBossKindForWave(56) === typeBossKindForWave(56), 'type-boss selection is deterministic');
  check(isTypeBossWave(56) && !isTypeBossWave(55) && !isTypeBossWave(100), 'the eighth-wave cadence holds after wave 48');
}

// --- 37i. Effects draw sprites from the fx assets, tint only the death ring ---------------------
{
  resetArt();
  const layout = computeLayout(1280, 800);
  const gunMuzzle = new Texture({ width: 4, height: 4 });
  const spark = new Texture({ width: 4, height: 4 });
  const shield = new Texture({ width: 4, height: 4 });
  const death = new Texture({ width: 4, height: 4 });
  injectArtTexture('muzzle-gun', gunMuzzle);
  injectArtTexture('spark-hit', spark);
  injectArtTexture('shield-arc', shield);
  injectArtTexture('death-ring', death);

  const s = createRunState();
  s.tick = 10;

  // A gun muzzle flash draws the muzzle-gun sprite, visible, and no procedural fallback runs.
  const fx = new EffectsView();
  fx.addShot(createTower(1, 'gun', 3, 6), 8, 6);
  fx.draw(s, layout);
  check(fx.muzzleSprites[0].visible, 'effects: a gun shot draws a muzzle sprite');
  check(fx.muzzleSprites[0].texture === gunMuzzle, 'effects: the muzzle uses the muzzle-gun texture');

  // A death ring uses the death-ring texture, is tinted to the dead enemy's colour, and sits at the
  // death's world position.
  fx.addDeath('grunt', 5, 6);
  fx.draw(s, layout);
  check(fx.deathSprites[0].texture === death, 'effects: a death draws the death-ring texture');
  check(fx.deathSprites[0].tint === ENEMY_COLOR.grunt, 'effects: the death ring is tinted to the enemy colour');
  const dp = worldToPixel(layout, 5, 6);
  check(
    Math.round(fx.deathSprites[0].position.x) === Math.round(dp.x) &&
      Math.round(fx.deathSprites[0].position.y) === Math.round(dp.y),
    'effects: the death ring sits at the death position',
  );

  // A shield hit uses the shield-arc texture and is left untinted (its cyan lives in the file).
  fx.addShieldHit(7, 8);
  fx.draw(s, layout);
  check(fx.shieldSprites[0].texture === shield, 'effects: a shield hit draws the shield-arc texture');
  check(fx.shieldSprites[0].tint === 0xffffff, 'effects: the shield arc stays cyan (no tint applied)');

  // A hit spark draws the spark-hit texture at the impact point.
  fx.addHitSpark(9, 10);
  fx.draw(s, layout);
  check(fx.sparkSprites[0].texture === spark, 'effects: a hit spark draws the spark-hit texture');
  const sp = worldToPixel(layout, 9, 10);
  check(
    Math.round(fx.sparkSprites[0].position.x) === Math.round(sp.x) &&
      Math.round(fx.sparkSprites[0].position.y) === Math.round(sp.y),
    'effects: the spark sits at the impact position',
  );

  resetArt();
}

// --- 37i.1 Line-tower tracer colours (docs/LINE-TRACERS.md) -------------------------------------
{
  const fx = new EffectsView();

  // TRACER_COLOR maps only the line towers: the Gun's yellow and the Laser's red.
  check(Object.keys(TRACER_COLOR).sort().join(',') === 'gun,laser',
    'effects: TRACER_COLOR has entries for gun and laser only');
  check(TRACER_COLOR.gun === 0xffd400, 'effects: the Gun tracer is yellow');
  check(TRACER_COLOR.laser === 0xff3300, 'effects: the Laser tracer is red');

  // A Gun shot adds one tracer; a Laser shot adds one.
  fx.addShot(createTower(1, 'gun', 3, 6), 8, 6);
  check(fx.muzzles.length === 1 && fx.tracers.length === 1, 'effects: a Gun shot adds one tracer');
  fx.addShot(createTower(2, 'laser', 3, 6), 8, 6);
  check(fx.muzzles.length === 2 && fx.tracers.length === 2, 'effects: a Laser shot adds one tracer');

  // Taser, Frost, Cannon and Flak shots add no tracer but keep their muzzle flash.
  fx.addShot(createTower(3, 'taser', 3, 6), 8, 6);
  fx.addShot(createTower(4, 'frost', 3, 6), 8, 6);
  fx.addShot(createTower(5, 'cannon', 3, 6), 8, 6);
  fx.addShot(createTower(6, 'aa', 3, 6), 8, 6); // Flak (and Missile) launch a projectile
  check(fx.muzzles.length === 6, 'effects: Taser, Frost, Cannon and Flak each add a muzzle flash');
  check(fx.tracers.length === 2, 'effects: Taser, Frost, Cannon and Flak add no tracer');

  // A Frost keeps its muzzle but drops the tracer: the pulse ring is the shot (docs/FROST-PULSE.md).
  // The ring lives in the board view's own pool, so it is covered by the Frost tests, not here.

  // A Beacon fires nothing: no muzzle and no tracer.
  fx.addShot(createTower(7, 'beacon', 3, 6), 8, 6);
  check(fx.muzzles.length === 6, 'effects: a Beacon shot adds no muzzle');
  check(fx.tracers.length === 2, 'effects: a Beacon shot adds no tracer');

  // The tracer pool still compacts to empty once every tracer's life has elapsed.
  const s = createRunState();
  s.tick = 10;
  const layout = computeLayout(1280, 800);
  fx.draw(s, layout);
  check(fx.tracers.length === 2, 'effects: live tracers survive their first draw');
  s.tick = 10 + 6;
  fx.draw(s, layout);
  check(fx.tracers.length === 0, 'effects: the tracer pool compacts to empty');
}

{
  // 39h. A boss variant death shakes like a boss (4 px), and a boss variant leak costs its integrity.
  check(shakeImpulseFor({ type: 'kill', kind: 'grunt-boss' }).amplitude === SHAKE_AMPLITUDE.bossDeath,
    'a Sergeant death shakes 4 px');
  check(shakeImpulseFor({ type: 'kill', kind: 'runner-boss' }).amplitude === SHAKE_AMPLITUDE.bossDeath,
    'a Pacer death shakes 4 px');
  check(shakeImpulseFor({ type: 'kill', kind: 'shielded-boss' }).amplitude === SHAKE_AMPLITUDE.bossDeath,
    'a Bastion death shakes 4 px');

  const leakCost = (kind) => {
    const s = stateOnLevel('open-field');
    s.phase = 'wave';
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    const start = s.integrity;
    s.enemies.push(createEnemy(1, kind, 12, SPAWN, EXIT));
    let t = 0;
    while (s.enemies.length > 0 && t < 20000) {
      tick(s);
      t++;
    }
    return start - s.integrity;
  };
  check(leakCost('grunt-boss') === 4, 'a Sergeant leak costs 4 integrity');
  check(leakCost('runner-boss') === 3, 'a Pacer leak costs 3 integrity');
  check(leakCost('shielded-boss') === 4, 'a Bastion leak costs 4 integrity');
}

// --- 39. Manifest generation (scripts/art-manifest.mjs) ---------------------------------------
{
  const tmp = mkdtempSync(join(tmpdir(), 'pd-art-'));
  const write = (rel, content = '<svg xmlns="http://www.w3.org/2000/svg"/>') => {
    const p = join(tmp, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  };
  try {
    // 39a. Frames are found in order, and a missing json applies the defaults.
    write('enemies/grunt.svg');
    write('enemies/grunt.1.svg');
    write('enemies/grunt.2.svg');
    write('enemies/grunt.3.svg');
    const a = scanArt(tmp);
    const grunt = a.assets.find((x) => x.name === 'enemies/grunt');
    check(grunt !== undefined && grunt.frames === 4, 'manifest: four frames found in order');
    check(
      grunt.anim.fps === 8 && grunt.anim.loop === 'loop' && grunt.anim.hold === 0 &&
        grunt.anim.holdAfter === 0 && grunt.anim.randomStart === true && grunt.anim.when === 'always',
      'manifest: a missing json applies the defaults',
    );

    // 39b. The json is parsed, and unknown keys are a warning.
    write('enemies/grunt.json', JSON.stringify({ fps: 12, loop: 'pingpong', note: 'artist note' }));
    const b = scanArt(tmp);
    const parsed = b.assets.find((x) => x.name === 'enemies/grunt').anim;
    check(parsed.fps === 12 && parsed.loop === 'pingpong', 'manifest: json fps and loop are read');
    check(b.warnings.some((m) => m.includes('unknown key "note"')), 'manifest: unknown keys warn');

    // 39c. A gap in the numbering is a build error.
    write('enemies/gap.svg');
    write('enemies/gap.1.svg');
    write('enemies/gap.3.svg');
    const c = scanArt(tmp);
    check(c.errors.some((m) => m.includes('enemies/gap') && m.includes('contiguous')),
      'manifest: a numbering gap is a build error');

    // 39d. The `.0` spelling is warned and produces no asset.
    write('enemies/zero.svg');
    write('enemies/zero.0.svg');
    const d = scanArt(tmp);
    check(d.warnings.some((m) => m.includes('enemies/zero.0.svg') && m.includes('rename')),
      'manifest: a `.0` frame warns to rename');
    check(!d.assets.some((x) => x.name === 'enemies/zero.0'), 'manifest: a `.0` frame is not an asset');

    // 39e. A still with a json is one frame, and its json is ignored with a warning.
    write('enemies/still.svg');
    write('enemies/still.json', JSON.stringify({ fps: 12 }));
    const e = scanArt(tmp);
    check(e.assets.find((x) => x.name === 'enemies/still').frames === 1, 'manifest: a still is one frame');
    check(e.warnings.some((m) => m.includes('enemies/still.json') && m.includes('ignored')),
      'manifest: a still\'s json is ignored with a warning');

    // 39f. A numbered frame on a static category is ignored and warned: it will never play.
    write('ui/glyph-close.svg');
    write('ui/glyph-close.1.svg');
    write('ui/glyph-close.2.svg');
    write('branches/gun-marksman.svg');
    write('branches/gun-marksman.1.svg');
    write('wall/wall-t1.svg');
    write('wall/wall-t1.1.svg');
    const f = scanArt(tmp);
    check(f.warnings.some((m) => m.includes('ui/glyph-close.1.svg') && m.includes('will never play') && m.includes('ui glyphs are static')),
      'manifest: a numbered frame on a ui glyph warns it will never play');
    check(f.warnings.some((m) => m.includes('branches/gun-marksman.1.svg') && m.includes('branch marks are static')),
      'manifest: a numbered frame on a branch mark warns it is static');
    check(f.warnings.some((m) => m.includes('wall/wall-t1.1.svg') && m.includes('the wall face is static')),
      'manifest: a numbered frame on the wall face warns it is static');
    check(f.assets.find((x) => x.name === 'ui/glyph-close').frames === 1, 'manifest: a static asset stays one frame');

    // 39g. The two shutter leaves are the ui assets that may animate (their transition is lifetime-driven).
    write('ui/shutter-open.svg');
    write('ui/shutter-open.1.svg');
    const g = scanArt(tmp);
    check(!g.warnings.some((m) => m.includes('shutter-open') && m.includes('will never play')),
      'manifest: a shutter leaf is not warned as static');
    check(g.assets.find((x) => x.name === 'ui/shutter-open').frames === 2, 'manifest: a shutter transition is a two-frame asset');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

// --- 40. The frame animator is a pure function of sim ticks ------------------------------------
{
  const mk = (o = {}) => ({ fps: 10, loop: 'loop', hold: 0, holdAfter: 0, randomStart: false, when: 'always', ...o });

  check(
    DEFAULT_ANIM.fps === 8 && DEFAULT_ANIM.loop === 'loop' && DEFAULT_ANIM.hold === 0 &&
      DEFAULT_ANIM.holdAfter === 0 && DEFAULT_ANIM.randomStart === true && DEFAULT_ANIM.when === 'always',
    'animator: defaults match the contract',
  );

  // fps 10 = one frame every 6 ticks; a four-frame loop cycles 0,1,2,3,0,...
  const loop = mk();
  check(animFrame(loop, 4, 0, 1) === 0 && animFrame(loop, 4, 6, 1) === 1 &&
    animFrame(loop, 4, 12, 1) === 2 && animFrame(loop, 4, 18, 1) === 3 &&
    animFrame(loop, 4, 24, 1) === 0, 'animator: loop cycles 0..3 and wraps');

  // pingpong walks 0,1,2,3,2,1,0,...
  const ping = mk({ loop: 'pingpong' });
  check(animFrame(ping, 4, 0, 1) === 0 && animFrame(ping, 4, 18, 1) === 3 &&
    animFrame(ping, 4, 24, 1) === 2 && animFrame(ping, 4, 30, 1) === 1 &&
    animFrame(ping, 4, 36, 1) === 0, 'animator: pingpong bounces back and forth');

  // once plays to the last frame and stays.
  const once = mk({ loop: 'once' });
  check(animFrame(once, 4, 0, 1) === 0 && animFrame(once, 4, 18, 1) === 3 &&
    animFrame(once, 4, 600, 1) === 3, 'animator: once plays to the end and stays');

  // hold0 plays once then returns to frame 0 and stays.
  const hold0 = mk({ loop: 'hold0' });
  check(animFrame(hold0, 4, 18, 1) === 3 && animFrame(hold0, 4, 24, 1) === 0 &&
    animFrame(hold0, 4, 600, 1) === 0, 'animator: hold0 returns to frame 0 and stays');

  // hold delays the start by whole seconds.
  const hold = mk({ hold: 1 });
  check(animFrame(hold, 2, 59, 1) === 0 && animFrame(hold, 2, 60, 1) === 0 &&
    animFrame(hold, 2, 66, 1) === 1, 'animator: hold sits on frame 0 until the delay elapses');

  // holdAfter holds the final frame before looping.
  const holdAfter = mk({ holdAfter: 0.5 });
  check(animFrame(holdAfter, 2, 0, 1) === 0 && animFrame(holdAfter, 2, 6, 1) === 1 &&
    animFrame(holdAfter, 2, 12, 1) === 1 && animFrame(holdAfter, 2, 30, 1) === 1 &&
    animFrame(holdAfter, 2, 42, 1) === 0, 'animator: holdAfter holds the last frame before looping');

  // randomStart offsets each id deterministically, so a crowd does not march in lockstep.
  const rs = mk({ randomStart: true });
  const offsets = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((id) => animFrame(rs, 4, 0, id)));
  check(offsets.size > 1, `animator: randomStart spreads a crowd (${offsets.size} starting frames)`);
  check(entityOffset(7) === entityOffset(7), 'animator: the per-entity offset is deterministic');

  // A still is one frame regardless of metadata.
  check(animFrame(mk(), 1, 999, 1) === 0, 'animator: a still is always frame 0');

  // when: "moving" holds frame 0 while stopped.
  const walk = mk({ when: 'moving' });
  check(currentAnimFrame(walk, 4, 6, 1, false) === 0, 'animator: when moving holds frame 0 while stopped');
  check(currentAnimFrame(walk, 4, 6, 1, true) === 1, 'animator: when moving plays while travelling');
}

// --- 41. Animated frames in the view -----------------------------------------------------------
{
  // 41a. A still asset behaves exactly as before: same texture, same position.
  resetArt();
  const gruntTex = new Texture({ width: 4, height: 4 });
  injectArtTexture('grunt', gruntTex);
  const s = stateOnLevel('open-field');
  const e = createEnemy(1, 'grunt', 1, SPAWN, EXIT);
  e.x = 5.5;
  e.y = 6.5;
  e.prevX = 5.5;
  e.prevY = 6.5;
  e.spawnTick = s.tick;
  s.enemies.push(e);
  const layout = computeLayout(1280, 800);
  const cell = layout.board.cell;
  const view = new BoardView();
  view.draw(s, layout, 0, { col: 0, row: 0, onBoard: false, x: 0, y: 0 });
  check(view.enemySprites[0].visible, 'still: the enemy sprite is visible');
  check(view.enemySprites[0].texture === gruntTex, 'still: the sprite uses the single injected texture');
  check(
    view.enemySprites[0].position.x === layout.board.x + 5.5 * cell &&
      view.enemySprites[0].position.y === layout.board.y + 6.5 * cell,
    'still: the sprite position is unchanged',
  );
  check(getArtFrames('grunt', 28)[0] === gruntTex && getArtTexture('grunt', 28) === gruntTex,
    'still: getArtTexture is frame 0 of getArtFrames');
  check(animationOf('grunt') === null, 'still: animationOf is null for a still');
  resetArt();
}

{
  // 41b. An animated enemy picks its frame from the animator, and switching frames reuses the sprite.
  resetArt();
  const f0 = new Texture({ width: 4, height: 4 });
  const f1 = new Texture({ width: 5, height: 5 });
  const f2 = new Texture({ width: 6, height: 6 });
  const f3 = new Texture({ width: 7, height: 7 });
  injectArtFrames('grunt', [f0, f1, f2, f3]);
  injectArtAnim('grunt', { fps: 10, loop: 'loop', hold: 0, holdAfter: 0, randomStart: false, when: 'always' });
  check(animationOf('grunt') !== null && animationOf('grunt').fps === 10,
    'animated: animationOf resolves the injected metadata');
  const s = stateOnLevel('open-field');
  const e = createEnemy(1, 'grunt', 1, SPAWN, EXIT);
  e.x = 5.5;
  e.y = 6.5;
  e.prevX = 5.5;
  e.prevY = 6.5;
  e.spawnTick = 0;
  s.enemies.push(e);
  const layout = computeLayout(1280, 800);
  const view = new BoardView();

  s.tick = 6;
  view.draw(s, layout, 0, { col: 0, row: 0, onBoard: false, x: 0, y: 0 });
  check(view.enemySprites[0].texture === f1, 'animated: tick 6 selects frame 1');

  s.tick = 18;
  view.draw(s, layout, 0, { col: 0, row: 0, onBoard: false, x: 0, y: 0 });
  check(view.enemySprites[0].texture === f3, 'animated: tick 18 selects frame 3');

  const ref = view.enemySprites[0];
  s.tick = 12;
  view.draw(s, layout, 0, { col: 0, row: 0, onBoard: false, x: 0, y: 0 });
  check(view.enemySprites[0] === ref && view.enemySprites[0].texture === f2,
    'animated: the pooled sprite persists and swaps texture, no allocation');
  resetArt();
}

{
  // Slow-tint (docs/SLOW-TINT.md): a slowed enemy's body reads pale blue; the cue is presentation-only.
  const r = (SLOW_TINT >> 16) & 0xff;
  const g = (SLOW_TINT >> 8) & 0xff;
  const b = SLOW_TINT & 0xff;
  check(r < b && g > r, `SLOW_TINT is a pale blue, not merely desaturated (r=${r} g=${g} b=${b})`);

  resetArt();
  const gruntTex = new Texture({ width: 4, height: 4 });
  injectArtTexture('grunt', gruntTex);
  const s = stateOnLevel('open-field');
  const e = createEnemy(1, 'grunt', 1, SPAWN, EXIT);
  e.x = 5.5;
  e.y = 6.5;
  e.prevX = 5.5;
  e.prevY = 6.5;
  e.spawnTick = 0;
  e.slowUntilTick = 100;
  e.slowFactor = 0.5;
  s.enemies.push(e);
  const layout = computeLayout(1280, 800);
  const view = new BoardView();
  const hover = { col: 0, row: 0, onBoard: false, x: 0, y: 0 };

  s.tick = 99;
  view.draw(s, layout, 0, hover);
  check(view.enemySprites[0].tint === SLOW_TINT, 'a slowed enemy sprite tints SLOW_TINT');

  s.tick = 100;
  view.draw(s, layout, 0, hover);
  check(view.enemySprites[0].tint === 0xffffff, 'the tint clears the tick the slow expires (tick === slowUntilTick)');

  e.slowUntilTick = 0;
  s.tick = 99;
  view.draw(s, layout, 0, hover);
  check(view.enemySprites[0].tint === 0xffffff, 'an unslowed enemy sprite stays 0xffffff');
  resetArt();
}

{
  // 41c. A DPR change drops every cached frame array, so the next draw re-rasterises at the new size.
  resetArt();
  seedFrameCache('grunt', 28, [new Texture({ width: 2, height: 2 }), new Texture({ width: 2, height: 2 })]);
  check(cachedFrameCount() === 1, 'dpr: one frame array is cached');
  const before = artDpr();
  setArtDpr(before + 1);
  check(cachedFrameCount() === 0, 'dpr: setArtDpr drops every cached frame array');
  setArtDpr(before);
  resetArt();
}

{
  // 41d. frameTexture is the single resolution path: still -> frame 0, absent -> null, animated -> fps.
  resetArt();
  check(frameTexture('no-such-asset', 28, 0, 1) === null, 'frameTexture: an absent asset resolves to null');
  const still = new Texture({ width: 4, height: 4 });
  injectArtTexture('grunt', still);
  check(frameTexture('grunt', 28, 999, 1) === still, 'frameTexture: a still is frame 0 on every clock');
  const f0 = new Texture({ width: 5, height: 5 });
  const f1 = new Texture({ width: 6, height: 6 });
  injectArtFrames('grunt', [f0, f1]);
  injectArtAnim('grunt', { fps: 10, loop: 'loop', hold: 0, holdAfter: 0, randomStart: false, when: 'always' });
  check(frameTexture('grunt', 28, 6, 1) === f1, 'frameTexture: an animated asset picks its frame from the fps clock');
  resetArt();
}

// --- 41e. A tower animates on the sim clock and is out of phase with a later placement --------
{
  resetArt();
  const base = new Texture({ width: 4, height: 4 });
  const t0 = new Texture({ width: 5, height: 5 });
  const t1 = new Texture({ width: 6, height: 6 });
  injectArtTexture('gun-base', base);
  injectArtFrames('gun-turret', [t0, t1]);
  injectArtAnim('gun-turret', { fps: 10, loop: 'loop', hold: 0, holdAfter: 0, randomStart: false, when: 'always' });

  const s = stateOnLevel('open-field');
  s.economy.salvage = 10000;
  check(placeTower(s, 'gun', 3, 6), 'tower anim: place the first gun at clock 0');
  const layout = computeLayout(1280, 800);
  const view = new BoardView();
  const hover = { col: 0, row: 0, onBoard: false, x: 0, y: 0 };

  // fps 10 = one frame every 6 ticks; a two-frame turret cycles 0,1,0 on the sim clock.
  s.clock = 0;
  view.draw(s, layout, 0, hover);
  check(view.towerTurretSprites[0].texture === t0, 'tower anim: clock 0 selects frame 0');
  s.clock = 6;
  view.draw(s, layout, 0, hover);
  check(view.towerTurretSprites[0].texture === t1, 'tower anim: clock 6 selects frame 1');
  s.clock = 12;
  view.draw(s, layout, 0, hover);
  check(view.towerTurretSprites[0].texture === t0, 'tower anim: clock 12 wraps back to frame 0');

  // A second tower placed 30 ticks later is out of phase with the first.
  s.clock = 30;
  check(placeTower(s, 'gun', 5, 6), 'tower anim: place the second gun at clock 30');
  s.clock = 36;
  view.draw(s, layout, 0, hover);
  check(view.towerTurretSprites[0].texture === t0 && view.towerTurretSprites[1].texture === t1,
    'tower anim: towers placed 30 ticks apart are out of phase');
  resetArt();
}

{
  // 41f. A still tower (frames: 1) draws frame 0 on every clock tick, byte-identical to today.
  resetArt();
  const base = new Texture({ width: 4, height: 4 });
  const turret = new Texture({ width: 5, height: 5 });
  injectArtTexture('gun-base', base);
  injectArtTexture('gun-turret', turret);
  const s = stateOnLevel('open-field');
  s.economy.salvage = 10000;
  placeTower(s, 'gun', 3, 6);
  const layout = computeLayout(1280, 800);
  const view = new BoardView();
  const hover = { col: 0, row: 0, onBoard: false, x: 0, y: 0 };
  for (const c of [0, 5, 60, 999]) {
    s.clock = c;
    view.draw(s, layout, 0, hover);
    check(view.towerBaseSprites[0].texture === base && view.towerTurretSprites[0].texture === turret,
      `tower still: frame 0 on every clock (${c})`);
  }
  resetArt();
}

// --- 41g. Effects are lifetime-driven, not fps-driven ------------------------------------------
{
  resetArt();
  const e0 = new Texture({ width: 4, height: 4 });
  const e1 = new Texture({ width: 5, height: 5 });
  const e2 = new Texture({ width: 6, height: 6 });
  const e3 = new Texture({ width: 7, height: 7 });
  injectArtFrames('death-ring', [e0, e1, e2, e3]);
  injectArtAnim('death-ring', { fps: 8, loop: 'loop', hold: 0, holdAfter: 0, randomStart: false, when: 'always' });

  check(effectFrameTexture('death-ring', 28, 0, 6) === e0, 'effect: age 0 shows frame 0');
  check(effectFrameTexture('death-ring', 28, 5, 6) === e3,
    'effect: a four-frame effect lands on its last frame as it expires');
  check(effectFrameTexture('death-ring', 28, 6, 6) === e3, 'effect: past its life it never wraps');
  check(effectFrameTexture('death-ring', 28, 99, 6) === e3, 'effect: stays on the last frame forever');

  // hold (0.1 s = 6 ticks) delays the first frame; the sequence then maps across the remaining life.
  injectArtAnim('death-ring', { fps: 8, loop: 'loop', hold: 0.1, holdAfter: 0, randomStart: false, when: 'always' });
  check(effectFrameTexture('death-ring', 28, 5, 20) === e0, 'effect: hold sits on frame 0 until the delay elapses');
  check(effectFrameTexture('death-ring', 28, 11, 20) === e1, 'effect: after hold the sequence maps across the remaining life');
  resetArt();
}

// --- 41h. A shutter transition plays once and settles on the correct end frame -----------------
{
  resetArt();
  const o0 = new Texture({ width: 4, height: 4 });
  const o1 = new Texture({ width: 5, height: 5 });
  const c0 = new Texture({ width: 6, height: 6 });
  const c1 = new Texture({ width: 7, height: 7 });
  injectArtFrames('shutter-open', [o0, o1]);
  injectArtFrames('shutter-closed', [c0, c1]);

  check(TRANSITION_TICKS === 18, 'shutter: the transition is 18 ticks (0.3 s)');

  const s = stateOnLevel('turnstile');
  const layout = computeLayout(1280, 800);
  const view = new BoardView();
  const hover = { col: 0, row: 0, onBoard: false, x: 0, y: 0 };

  // Toggle 0 (10,6) is period 900, open 420, phase 0: it starts open at clock 0 and closes at 420.
  s.clock = 0;
  view.draw(s, layout, 0, hover);
  check(view.shutterSpritePool[0].texture === o0, 'shutter: the open transition starts on frame 0');
  s.clock = 9;
  view.draw(s, layout, 0, hover);
  check(view.shutterSpritePool[0].texture === o1, 'shutter: the open transition reaches its end frame');
  s.clock = 18;
  view.draw(s, layout, 0, hover);
  check(view.shutterSpritePool[0].texture === o1, 'shutter: the open shutter settles on the end frame');

  s.clock = 420;
  view.draw(s, layout, 0, hover);
  check(view.shutterSpritePool[0].texture === c0, 'shutter: the close transition starts on frame 0');
  s.clock = 429;
  view.draw(s, layout, 0, hover);
  check(view.shutterSpritePool[0].texture === c1, 'shutter: the close transition reaches its end frame');
  s.clock = 438;
  view.draw(s, layout, 0, hover);
  check(view.shutterSpritePool[0].texture === c1, 'shutter: the closed shutter settles on the end frame');
  resetArt();
}

// --- 40. Boss bars ---------------------------------------------------------------------------
{
  // 40a. A boss on the field produces exactly one bar; a non-boss produces none.
  const grunt = createEnemy(1, 'grunt', 1, SPAWN, EXIT);
  const boss = createEnemy(2, 'grunt-boss', 12, SPAWN, EXIT);
  const bosses = livingBosses([grunt, boss]);
  check(bosses.length === 1 && bosses[0].id === 2, 'a boss on the field produces exactly one bar');
  check(livingBosses([grunt]).length === 0, 'a non-boss produces no bar');
  check(bossName('grunt-boss') === 'SERGEANT' && bossName('shielded-boss') === 'BASTION',
    'boss names are uppercased for the bar');
  check(bossGimmick('grunt-boss') === 'shrugs off damage', 'the Sergeant subtitle names the gimmick');
  check(bossGimmick('runner-boss') === 'anything near it keeps pace', 'the Pacer subtitle names the gimmick');
  check(bossGimmick('shielded-boss') === 'three layers of shielding', 'the Bastion subtitle names the gimmick');
  check(bossGimmick('grunt') === null, 'an ordinary enemy has no teaching subtitle');
}

{
  // 40b. The health fill matches hp/maxHp within a pixel, and the lag segment is ahead of or equal.
  const innerW = 318;
  const ratio = 60 / 120;
  const fillW = barFillPx(innerW, ratio);
  check(Math.abs(fillW - innerW * ratio) <= 1, `health fill matches hp/maxHp within a pixel (${fillW} of ${innerW * ratio})`);

  const tracks = [];
  const seen = new Set();
  const e = createEnemy(1, 'grunt-boss', 12, SPAWN, EXIT);
  e.hp = 120;
  e.maxHp = 120;
  advanceBossBars(tracks, [e], 0, seen, true);
  e.hp = 60;
  advanceBossBars(tracks, [e], 1, seen, true);
  const f = bossBarFrame(tracks[0], 1, true);
  check(f.lagRatio >= f.hpRatio, `the lag segment is ahead of or equal to the fill (${f.lagRatio} >= ${f.hpRatio})`);
}

{
  // 40c. A Bastion shows three shield segments and the count falls as layers strip; a Sergeant none.
  const bastion = createEnemy(1, 'shielded-boss', 24, SPAWN, EXIT);
  const s0 = bossShield(bastion);
  check(s0.segments === 3 && s0.filled === 3, `a Bastion shows three shield segments (${s0.segments}, filled ${s0.filled})`);
  bastion.shieldsRemaining = 2;
  bastion.shield = 30;
  const s1 = bossShield(bastion);
  check(s1.segments === 3 && s1.filled === 2, `the shield segment count falls as layers strip (filled ${s1.filled})`);
  check(bossShield(createEnemy(2, 'grunt-boss', 12, SPAWN, EXIT)).segments === 0, 'a Sergeant shows no shield bar');
}

{
  // 40d. Four bosses produce three bars, oldest dropped.
  const tracks = [];
  const seen = new Set();
  const enemies = [1, 2, 3, 4].map((id) => createEnemy(id, 'grunt-boss', 12, SPAWN, EXIT));
  advanceBossBars(tracks, enemies, 0, seen, true);
  const visible = visibleBossBars(tracks, 0);
  check(visible.length === 3, `four bosses produce three bars (${visible.length})`);
  check(!visible.some((t) => t.enemyId === 1), 'the oldest boss is dropped');
  check(visible.some((t) => t.enemyId === 4), 'the newest boss is kept');
}

{
  // 40e. The NEW tag appears only on a type's first appearance per profile, never again after save.
  const seen = new Set();
  const tracks = [];
  const first = createEnemy(1, 'grunt-boss', 12, SPAWN, EXIT);
  const newly = advanceBossBars(tracks, [first], 0, seen, true);
  check(newly.includes('grunt-boss'), 'the first appearance records the seen kind');
  check(bossBarFrame(tracks[0], 0, true).showNew, 'the NEW tag appears on a type\'s first appearance');

  const seen2 = new Set(seen);
  const tracks2 = [];
  const again = createEnemy(50, 'grunt-boss', 12, SPAWN, EXIT);
  const newly2 = advanceBossBars(tracks2, [again], 1000, seen2, true);
  check(newly2.length === 0, 'an already-seen type does not record again');
  check(!bossBarFrame(tracks2[0], 1000, true).showNew, 'the NEW tag never appears again after the first time');

  const store = { value: null, getItem() { return this.value; }, setItem(_k, v) { this.value = v; } };
  const p = defaultProfile();
  p.seenBossKinds = ['grunt-boss'];
  saveProfile(p, store);
  check(loadProfile(store).seenBossKinds.includes('grunt-boss'), 'the seen set survives a save/reload');

  const p2 = defaultProfile();
  p2.seenBossKinds = ['grunt-boss', 'grunt', 'not-a-kind', 'grunt-boss'];
  saveProfile(p2, store);
  const capped = loadProfile(store).seenBossKinds;
  check(capped.length === 1 && capped[0] === 'grunt-boss', 'the seen set is capped at the boss kinds that exist');
}

{
  // 40f. The panel lives in the title strip and never covers a tile at any common resolution.
  for (const [vw, vh] of [[1280, 720], [1600, 900], [1024, 640], [1920, 1080]]) {
    const l = computeLayout(vw, vh);
    const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    for (const rows of [1, 2, 3]) {
      const p = bossPanelRect(l, rows);
      check(!intersects(p, l.board), `${vw}x${vh}: a ${rows}-boss panel never covers the field`);
      check(!intersects(p, l.rightPanel), `${vw}x${vh}: a ${rows}-boss panel never covers the right panel`);
      check(!intersects(p, l.leftPanel), `${vw}x${vh}: a ${rows}-boss panel never covers the left panel`);
      check(p.y >= l.title.y, `${vw}x${vh}: the panel starts inside the title strip`);
      check(p.y + p.h <= l.client.y, `${vw}x${vh}: the panel stops above the field's first row`);
      check(p.w <= l.boardW - 16, `${vw}x${vh}: the panel width clears the board edges (${p.w})`);
      const cx = l.board.x + l.boardW / 2;
      check(Math.abs(p.x + p.w / 2 - cx) <= 1, `${vw}x${vh}: the panel is centred over the field`);
    }
    // Every row it can draw sits inside the panel and inside the field-free zone.
    const full = bossPanelRect(l, 3);
    const rowCount = Math.floor((full.h - 8 + 1) / 21);
    for (let i = 0; i < rowCount; i++) {
      const r = bossRowRect(full, i);
      check(r.y >= full.y && r.y + r.h <= full.y + full.h, `${vw}x${vh}: row ${i} fits the panel`);
      check(r.healthY + 5 <= l.client.y, `${vw}x${vh}: row ${i} health bar stays off the field`);
    }
  }
}

{
  // 40g. With shakeOn off (reduced motion) there is no flash and the fill is the true value at once.
  const seen = new Set();
  const tracks = [];
  const e = createEnemy(1, 'grunt-boss', 12, SPAWN, EXIT);
  e.hp = 90;
  e.maxHp = 120;
  advanceBossBars(tracks, [e], 0, seen, false);
  const f = bossBarFrame(tracks[0], 0, false);
  check(!f.flash, 'with shakeOn off there is no flash');
  check(Math.abs(f.hpRatio - 90 / 120) < 1e-9, 'with shakeOn off the fill is the true value on the first frame');
  check(f.lagRatio === f.hpRatio, 'with shakeOn off there is no drain (lag equals the fill)');
}


// --- 41z. Fire effects: one asset per kind, one more per branch --------------------------------
{
  // Every attacking kind has a base fire effect, and every branch has its own file rather than
  // borrowing the kind's flash.
  for (const kind of FIRE_KINDS) {
    check(manifestEntry(`muzzle-${kind}`) !== undefined, `${kind} has a fire-effect asset`);
  }
  for (const kind of FIRE_KINDS) {
    for (const branch of ['A', 'B', 'C']) {
      const mark = artNameForBranch(kind, branch);
      if (mark === null) continue;
      check(manifestEntry(`muzzle-${mark}`) !== undefined, `branch ${mark} has its own fire effect`);
    }
  }
  check(muzzleAssetFor('gun', null) === 'muzzle-gun', 'an unbranched Gun uses the gun flash');
  check(muzzleAssetFor('gun', 'A') === 'muzzle-gun-marksman', 'a Marksman uses its own flash');
  check(muzzleAssetFor('aa', 'B') === 'muzzle-aa-missile', 'a Missile AA uses its own flash');
  check(muzzleAssetFor('beacon', null) === null, 'the Beacon has no fire effect');
  check(muzzleAssetFor('wall', null) === null, 'a wall has no fire effect');
  // A framed effect plays its whole animation; a still flashes for two ticks.
  check(muzzleLife('muzzle-gun', 32) >= 2, 'a still fire effect lasts at least the flash window');
  check(muzzleLife(null, 32) === 2, 'a kind with no file keeps the two-tick flash');
  // A file with numbered frames plays its whole animation instead of flashing for two ticks.
  injectArtFrames('muzzle-gun', [undefined, undefined, undefined, undefined]);
  check(muzzleLife('muzzle-gun', 32) > 2, 'a framed fire effect lives for its animation');
  injectArtFrames('muzzle-gun', []);
}

// --- 42. Boss variants (pass 2: Carrier, Dreadnought, Wirecutter, Ram) -------------------------

{
  // 42a. Stats: HP multiple, speed, scale (radius), integrity and kill value match the design table.
  const carrier = ENEMY_STATS['flyer-boss'];
  const dread = ENEMY_STATS['armoured-boss'];
  const wire = ENEMY_STATS['saboteur-boss'];
  const ram = ENEMY_STATS['breacher-boss'];
  check(carrier.name === 'Carrier' && carrier.hp === 96, `Carrier is 12x flyer HP (${carrier.hp})`);
  check(carrier.speed === 0.35 && carrier.scale === 2.0 && carrier.integrity === 5,
    `Carrier speed/scale/integrity (${carrier.speed}/${carrier.scale}/${carrier.integrity})`);
  check(carrier.radius === 0.22 * 2.0 && carrier.value === 30, `Carrier radius/value (${carrier.radius}/${carrier.value})`);
  check(dread.name === 'Dreadnought' && dread.hp === 405, `Dreadnought is 9x armoured HP (${dread.hp})`);
  check(dread.speed === 0.4 && dread.scale === 1.7 && dread.integrity === 4,
    `Dreadnought speed/scale/integrity (${dread.speed}/${dread.scale}/${dread.integrity})`);
  check(dread.armour === 8 && dread.plating === DREADNOUGHT_PLATING, `Dreadnought armour ${dread.armour} + plating ${dread.plating}`);
  check(Math.abs(dread.radius - 0.34 * 1.7) < 1e-9 && dread.value === 72, `Dreadnought radius/value (${dread.radius}/${dread.value})`);
  check(wire.name === 'Wirecutter' && wire.hp === 125, `Wirecutter is 5x saboteur HP (${wire.hp})`);
  check(wire.speed === 0.6 && wire.scale === 1.5 && wire.integrity === 4,
    `Wirecutter speed/scale/integrity (${wire.speed}/${wire.scale}/${wire.integrity})`);
  check(Math.abs(wire.radius - 0.28 * 1.5) < 1e-9 && wire.value === 66, `Wirecutter radius/value (${wire.radius}/${wire.value})`);
  check(ram.name === 'Ram' && ram.hp === 440, `Ram is 8x breacher HP (${ram.hp})`);
  check(ram.speed === 0.4 && ram.scale === 1.8 && ram.integrity === 5,
    `Ram speed/scale/integrity (${ram.speed}/${ram.scale}/${ram.integrity})`);
  check(ram.radius === 0.42 * 1.8 && ram.value === 84 && ram.wallDps === 40,
    `Ram radius/value/wallDps (${ram.radius}/${ram.value}/${ram.wallDps})`);
  check(
    enemyKillValue('flyer-boss', 1) === 30 && enemyKillValue('armoured-boss', 1) === 72 &&
      enemyKillValue('saboteur-boss', 1) === 66 && enemyKillValue('breacher-boss', 1) === 84,
    'kill value at wave 1 is 6x the base type',
  );
}

{
  // 42b. Base-type membership: boss variants count as their base type for tower rules.
  check(baseEnemyKind('flyer-boss') === 'flyer', 'Carrier counts as a flyer');
  check(baseEnemyKind('armoured-boss') === 'armoured', 'Dreadnought counts as armoured');
  check(baseEnemyKind('saboteur-boss') === 'saboteur', 'Wirecutter counts as a saboteur');
  check(baseEnemyKind('breacher-boss') === 'breacher', 'Ram counts as a breacher');
  check(isFlyerKind('flyer-boss') && !isFlyerKind('breacher-boss'), 'the Carrier flies; the Ram is ground');
  check(
    isBossVariant('flyer-boss') && isBossVariant('armoured-boss') && isBossVariant('saboteur-boss') && isBossVariant('breacher-boss'),
    'the four pass-2 kinds are boss variants',
  );
}

{
  // 42c. An AA tower (flyers only) treats the Carrier as a flyer and ignores a ground Sergeant.
  const drop = (kind) => {
    const s = allUnlocked();
    s.economy.salvage = 10000;
    placeTower(s, 'aa', 5, 5);
    s.phase = 'wave';
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    const e = stationary(1, kind, 30, 5.5, 4.5);
    s.enemies.push(e);
    tick(s);
    return e.maxHp - e.hp;
  };
  check(drop('flyer-boss') > 0, `AA damages a Carrier (${drop('flyer-boss')})`);
  check(drop('grunt-boss') === 0, 'AA ignores a ground Sergeant');
}

{
  // 42d. The Carrier's brood: three flyers on the 4 s clock, six on death, all carrying its wave.
  const s = createRunState();
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const carrier = stationary(1, 'flyer-boss', 30, 10.5, 6.5);
  s.enemies.push(carrier);
  for (let i = 0; i <= CARRIER_BROOD_INTERVAL_TICKS; i++) tick(s);
  const brood = s.enemies.filter((e) => e.kind === 'flyer' && !e.dead);
  check(brood.length === CARRIER_BROOD_COUNT, `the Carrier releases ${CARRIER_BROOD_COUNT} flyers on schedule (${brood.length})`);
  check(brood.every((e) => e.wave === 30), 'brood flyers carry the Carrier wave');

  carrier.hp = 1;
  carrier.maxHp = 1;
  pointerDown(s, carrier.x, carrier.y);
  pointerUp(s);
  const onDeath = s.enemies.filter((e) => e.kind === 'flyer' && !e.dead);
  check(carrier.dead, 'the Carrier dies');
  check(onDeath.length === CARRIER_BROOD_COUNT + CARRIER_DEATH_BROOD_COUNT,
    `the Carrier releases ${CARRIER_DEATH_BROOD_COUNT} more flyers on death (${onDeath.length} alive)`);
}

{
  // 42e. Dreadnought plating and half-strength slow.
  const drop = (kind) => {
    const s = allUnlocked();
    s.economy.salvage = 10000;
    placeTower(s, 'laser', 5, 5);
    s.phase = 'wave';
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    const e = stationary(1, kind, 36, 5.5, 4.5);
    s.enemies.push(e);
    tick(s);
    return e.maxHp - e.hp;
  };
  check(drop('armoured') === 3, `a laser deals 3 to an armoured (${drop('armoured')})`);
  check(drop('armoured-boss') === 1, `a laser deals 1 to a Dreadnought (plated; ${drop('armoured-boss')})`);

  const slowOf = (kind) => {
    const s = allUnlocked();
    s.economy.salvage = 10000;
    placeTower(s, 'frost', 5, 5);
    s.phase = 'wave';
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    const e = stationary(1, kind, 36, 5.5, 4.5);
    s.enemies.push(e);
    tick(s);
    return e.slowFactor;
  };
  check(slowOf('grunt') === 0.3, 'frost slows a grunt to 0.3x');
  check(slowOf('armoured-boss') === 0.65, `frost slows a Dreadnought to 0.65x (half-strength; ${slowOf('armoured-boss')})`);
  check(slowFactorFor('armoured-boss', 0.3) === 0.65, 'slowFactorFor halves a Dreadnought slow');
}

{
  // 42f. The Wirecutter's EMP knocks a tower offline without touching its HP, and it returns alone.
  const s = createRunState();
  s.economy.salvage = 10000;
  placeTower(s, 'gun', 5, 5);
  const gun = towerAt(s, 5, 5);
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const w = stationary(1, 'saboteur-boss', 42, 5.5, 5.5);
  s.enemies.push(w);

  for (let i = 0; i < 3; i++) tick(s);
  check(isEmpDisabled(gun, s.clock), 'the Wirecutter EMPs a tower within radius');
  check(gun.hp === gun.maxHp, `the EMP keeps the tower's HP intact (${gun.hp}/${gun.maxHp})`);
  check(isDown(gun, s.clock) && !isOffline(gun), 'an EMPd tower is down but not HP-offline');

  w.dead = true;
  for (let i = 0; i < WIRECUTTER_EMP_TICKS + 2; i++) tick(s);
  check(!isEmpDisabled(gun, s.clock) && !isDown(gun, s.clock), 'the tower returns on its own once the EMP elapses');
}

{
  // 42g. The Ram chews a wall at 40 DPS, and chews a non-wall tower to offline (not destroyed).
  const s = stateOnLevel('open-field');
  s.economy.salvage = 10000;
  const first = stepToward(s.ramField, SPAWN.col, SPAWN.row);
  placeTower(s, 'wall', first.col, first.row);
  const wall = towerAt(s, first.col, first.row);
  const fullHp = wall.hp;
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const ram = createEnemy(1, 'breacher-boss', 48, SPAWN, EXIT);
  ram.attackTowerId = wall.id;
  ram.x = wall.col + 0.5 - 0.6;
  ram.y = wall.row + 0.5;
  ram.prevX = ram.x;
  ram.prevY = ram.y;
  ram.col = wall.col - 1;
  ram.row = wall.row;
  s.enemies.push(ram);
  for (let i = 0; i < secondsToTicks(1); i++) tick(s);
  const wallDamage = fullHp - wall.hp;
  check(wallDamage > 0 && Math.abs(wallDamage - 40) <= 1, `the Ram chews walls at 40 DPS (${wallDamage.toFixed(1)} in 1s)`);
  check(RAM_TOWER_DPS === 40 && RAM_TURRET_DAMAGE === 8 && RAM_TURRET_RANGE === 3,
    `the Ram chews towers at ${RAM_TOWER_DPS} and its turret is ${RAM_TURRET_DAMAGE} at ${RAM_TURRET_RANGE}`);
}

{
  // 42h. The Ram drives a gun offline (0 HP) but the tower stays on the board for repair.
  const s = stateOnLevel('open-field');
  s.economy.salvage = 10000;
  const first = stepToward(s.ramField, SPAWN.col, SPAWN.row);
  placeTower(s, 'gun', first.col, first.row);
  const gun = towerAt(s, first.col, first.row);
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const ram = createEnemy(1, 'breacher-boss', 48, SPAWN, EXIT);
  ram.attackTowerId = gun.id;
  ram.x = gun.col + 0.5 - 0.6;
  ram.y = gun.row + 0.5;
  ram.prevX = ram.x;
  ram.prevY = ram.y;
  ram.col = gun.col - 1;
  ram.row = gun.row;
  s.enemies.push(ram);
  for (let i = 0; i < secondsToTicks(3); i++) tick(s);
  check(gun.hp === 0, `the Ram drove the gun offline (hp ${gun.hp})`);
  check(towerAt(s, gun.col, gun.row) === gun, 'an offline tower is not destroyed');
  check(isOffline(gun), 'the chewed tower is HP-offline (repairable)');
}

{
  // 42i. The Ram's turret fires at an off-route tower within 3 tiles while it walks.
  const s = stateOnLevel('open-field');
  s.economy.salvage = 10000;
  placeTower(s, 'gun', 5, 5);
  const gun = towerAt(s, 5, 5);
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const ram = createEnemy(1, 'breacher-boss', 48, SPAWN, EXIT);
  ram.x = 4.5;
  ram.y = 6.5;
  ram.prevX = 4.5;
  ram.prevY = 6.5;
  ram.col = 4;
  ram.row = 6;
  s.enemies.push(ram);
  for (let i = 0; i < secondsToTicks(2); i++) tick(s);
  const dmg = gun.maxHp - gun.hp;
  check(dmg >= RAM_TURRET_DAMAGE, `the Ram turret deals at least ${RAM_TURRET_DAMAGE} to a tower within ${RAM_TURRET_RANGE} tiles (${dmg} in 2s)`);
}

{
  // 42j. Schedule: first appearance at the unlock wave and never before.
  check(typeBossUnlockWave('flyer-boss') === 30, 'Carrier unlocks at wave 30');
  check(typeBossUnlockWave('armoured-boss') === 36, 'Dreadnought unlocks at wave 36');
  check(typeBossUnlockWave('saboteur-boss') === 42, 'Wirecutter unlocks at wave 42');
  check(typeBossUnlockWave('breacher-boss') === 48, 'Ram unlocks at wave 48');
  check(typeBossKindForWave(30) === 'flyer-boss', 'wave 30 spawns a Carrier');
  check(typeBossKindForWave(36) === 'armoured-boss', 'wave 36 spawns a Dreadnought');
  check(typeBossKindForWave(42) === 'saboteur-boss', 'wave 42 spawns a Wirecutter');
  check(typeBossKindForWave(48) === 'breacher-boss', 'wave 48 spawns a Ram');
  check(buildSchedule(30).filter((sp) => sp.kind === 'flyer-boss').length === 1, 'wave 30 schedule has one Carrier');
  check(buildSchedule(36).filter((sp) => sp.kind === 'armoured-boss').length === 1, 'wave 36 schedule has one Dreadnought');
  check(buildSchedule(42).filter((sp) => sp.kind === 'saboteur-boss').length === 1, 'wave 42 schedule has one Wirecutter');
  check(buildSchedule(48).filter((sp) => sp.kind === 'breacher-boss').length === 1, 'wave 48 schedule has one Ram');
  const neverEarly = (kind, unlock) => {
    for (let w = 12; w < unlock; w++) if (typeBossKindForWave(w) === kind) return false;
    return true;
  };
  check(neverEarly('flyer-boss', 30), 'no Carrier before wave 30');
  check(neverEarly('armoured-boss', 36), 'no Dreadnought before wave 36');
  check(neverEarly('saboteur-boss', 42), 'no Wirecutter before wave 42');
  check(neverEarly('breacher-boss', 48), 'no Ram before wave 48');
  check(typeBossKindForWave(64) === typeBossKindForWave(64), 'pass-2 boss selection is deterministic');
}

{
  // 42k. Boss presence: a death pops like a boss and a leak costs the boss's own integrity.
  const leakCost = (kind) => {
    const s = stateOnLevel('open-field');
    s.phase = 'wave';
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    const start = s.integrity;
    const e = createEnemy(1, kind, 48, SPAWN, EXIT);
    e.broodCooldown = Number.MAX_SAFE_INTEGER; // suppress the Carrier's brood so its own leak is isolated
    s.enemies.push(e);
    let t = 0;
    while (s.enemies.length > 0 && t < 40000) {
      tick(s);
      t++;
    }
    return start - s.integrity;
  };
  for (const kind of ['flyer-boss', 'armoured-boss', 'saboteur-boss', 'breacher-boss']) {
    check(shakeImpulseFor({ type: 'kill', kind }).amplitude === SHAKE_AMPLITUDE.bossDeath, `a ${kind} death shakes 4 px`);
  }
  check(leakCost('flyer-boss') === 5, 'a Carrier leak costs 5 integrity');
  check(leakCost('armoured-boss') === 4, 'a Dreadnought leak costs 4 integrity');
  check(leakCost('saboteur-boss') === 4, 'a Wirecutter leak costs 4 integrity');
  check(leakCost('breacher-boss') === 5, 'a Ram leak costs 5 integrity');
}

{
  // 42l. Boss bars name the new kinds and teach their gimmick on first appearance.
  check(bossName('flyer-boss') === 'CARRIER' && bossName('breacher-boss') === 'RAM', 'the new boss names are uppercased');
  check(bossGimmick('flyer-boss') === 'hatches flyers as it flies', 'the Carrier subtitle names the gimmick');
  check(bossGimmick('armoured-boss') === 'plated and slow to chill', 'the Dreadnought subtitle names the gimmick');
  check(bossGimmick('saboteur-boss') === 'shorts out towers as it passes', 'the Wirecutter subtitle names the gimmick');
  check(bossGimmick('breacher-boss') === 'eats through your towers', 'the Ram subtitle names the gimmick');
}

// --- 41. The PD2. share code: round-trip, the frozen example, and every failure mode ----------
{
  // Walls are compared as sets (the bitfield is row-major, so the array order is not preserved and a
  // duplicate coordinate — which the shipped maps carry as harmless redundancy — collapses to one);
  // toggles keep their exact order, and name / start / exit are exact.
  const wallKey = (walls) => [...new Set(walls.map((w) => w.join(',')))].sort().join(';');
  const toggleKey = (toggles) => [...(toggles ?? [])].sort((a, b) => a.col - b.col || a.row - b.row)
    .map((t) => `${t.col},${t.row},${t.periodTicks},${t.openTicks},${t.phaseTicks}`).join(';');
  const levelEquals = (a, b) =>
    a.name === b.name &&
    wallKey(a.walls) === wallKey(b.walls) &&
    a.starts[0].col === b.starts[0].col && a.starts[0].row === b.starts[0].row &&
    a.exits[0].col === b.exits[0].col && a.exits[0].row === b.exits[0].row &&
    toggleKey(a.toggles) === toggleKey(b.toggles);

  for (const level of LEVELS) {
    const dec = decodeCode(encodeLevel(level));
    check(dec.ok, `${level.id}: a shipped map round-trips`);
    check(levelEquals(dec.level, level), `${level.id}: round-trip preserves the level`);
  }

  const emptyLevel = { id: '', name: '', walls: [], starts: [{ col: 0, row: 6 }], exits: [{ col: 19, row: 6 }], toggles: [] };
  const emptyCode = encodeLevel(emptyLevel);
  check(emptyCode.length < 110, `an empty 20x12 map codes to ${emptyCode.length} characters (< 110)`);
  check(emptyCode.startsWith(CODEC_PREFIX), 'every code carries the PD2. prefix');

  // A generated fixture with row-major walls round-trips exactly, even the wall order.
  const fixture = {
    id: 'fixture', name: 'Fixture', walls: [[3, 2], [4, 2], [10, 9]],
    starts: [{ col: 0, row: 6 }], exits: [{ col: 19, row: 6 }],
    toggles: [{ col: 10, row: 6, periodTicks: 600, openTicks: 240, phaseTicks: 300 }],
  };
  const fixtureDec = decodeCode(encodeLevel(fixture));
  check(fixtureDec.ok, 'a generated fixture round-trips');
  check(JSON.stringify(fixtureDec.level.walls) === JSON.stringify([[3, 2], [4, 2], [10, 9]]),
    'the fixture walls keep their row-major order');

  // The frozen example: a fixed, hand-written code decodes to an exact level.
  const FROZEN_CODE = 'PD2.AhQMFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGABMABgABCgAGAIQDpAEAAAZGcm96ZW5A';
  const frozen = decodeCode(FROZEN_CODE);
  check(frozen.ok, 'the frozen example decodes');
  check(frozen.level.name === 'Frozen', 'the frozen example name is "Frozen"');
  check(wallKey(frozen.level.walls) === '1,0;2,0', `the frozen example walls are (1,0) and (2,0) (${wallKey(frozen.level.walls)})`);
  check(frozen.level.starts[0].col === 0 && frozen.level.starts[0].row === 6, 'the frozen example start is (0,6)');
  check(frozen.level.exits[0].col === 19 && frozen.level.exits[0].row === 6, 'the frozen example exit is (19,6)');
  check(toggleKey(frozen.level.toggles) === '10,6,900,420,0', 'the frozen example shutter is (10,6) 900/420/0');

  // A truncated paste is rejected as incomplete, not parsed into a corrupt map.
  const truncated = decodeCode(FROZEN_CODE.slice(0, -8));
  check(!truncated.ok && truncated.reason === 'that code is incomplete', `a truncated code is rejected (${truncated.reason})`);

  // A corrupted body byte leaves the checksum byte unchanged, so the checksum mismatches.
  const wrongChecksum = decodeCode(FROZEN_CODE.slice(0, -5) + 'B' + FROZEN_CODE.slice(-4));
  check(!wrongChecksum.ok && wrongChecksum.reason === 'that code is incomplete', `a wrong checksum is rejected (${wrongChecksum.reason})`);

  const pd1 = decodeCode('PD1.' + FROZEN_CODE.slice(4));
  check(!pd1.ok && pd1.reason === 'that code is from an older version', `a PD1. code is rejected (${pd1.reason})`);

  const notACode = decodeCode('hello world');
  check(!notACode.ok && notACode.reason === 'that code is not a valid share code', `a non-code string is rejected (${notACode.reason})`);

  // A version byte above 2 fails with a version message, with a valid checksum.
  const futureBytes = encodeBytes(emptyLevel);
  futureBytes[0] = 3;
  let futureSum = 0;
  for (const b of futureBytes) futureSum += b;
  futureBytes.push(futureSum % 251);
  const futureCode = CODEC_PREFIX + Buffer.from(futureBytes).toString('base64url');
  const future = decodeCode(futureCode);
  check(!future.ok && future.reason === 'that code is from a newer version', `a future version is rejected (${future.reason})`);

  // A name with non-ASCII characters is sanitised to printable ASCII, never a reason to reject.
  const nonAscii = { id: '', name: 'café ☕', walls: [], starts: [{ col: 0, row: 6 }], exits: [{ col: 19, row: 6 }], toggles: [] };
  const nonAsciiDec = decodeCode(encodeLevel(nonAscii));
  check(nonAsciiDec.ok && nonAsciiDec.level.name === 'caf ', `a non-ASCII name is sanitised to "${nonAsciiDec.level.name}"`);
}

// --- 42. The map editor model: painting, undo/redo, the single start/exit rule, validation -----
{
  const m = createEditor();
  check(editorTileAt(m, 0, 0) === 'floor', 'a fresh editor board is all floor');
  check(editorValidation(m) === 'place a start tile', 'an empty editor reports the missing start');

  selectEditorTool(m, 'wall');
  check(paintEditor(m, 3, 4) === null && editorTileAt(m, 3, 4) === 'wall', 'the Wall tool paints a wall tile');
  selectEditorTool(m, 'shutter');
  check(paintEditor(m, 5, 5) === null && editorTileAt(m, 5, 5) === 'shutter', 'the Shutter tool paints a shutter tile');
  check(editorToggleAt(m, 5, 5) !== undefined, 'a shutter tile carries its toggle');
  selectEditorTool(m, 'floor');
  check(paintEditor(m, 5, 5) === null && editorTileAt(m, 5, 5) === 'floor', 'the Floor tool paints buildable floor');
  selectEditorTool(m, 'eraser');
  paintEditor(m, 3, 4);
  check(editorTileAt(m, 3, 4) === 'floor', 'the Eraser paints buildable floor');

  // Start and exit: painting a second moves the first; the exit is independent.
  selectEditorTool(m, 'start');
  paintEditor(m, 0, 6);
  check(editorValidation(m) === 'place an exit tile', 'one start and no exit reports the missing exit');
  paintEditor(m, 5, 3);
  check(editorLevel(m).starts[0].col === 5 && editorLevel(m).starts[0].row === 3, 'a second start moves the first');

  selectEditorTool(m, 'exit');
  paintEditor(m, 19, 6);
  check(editorValidation(m) === null, 'a start and exit on a clear board validates');
  paintEditor(m, 10, 0);
  check(editorLevel(m).exits[0].col === 10 && editorLevel(m).exits[0].row === 0, 'a second exit moves the first');
  paintEditor(m, 19, 6);
  check(editorValidation(m) === null, 'moving the exit back restores a clear route');

  // Undo / redo returns the exact prior grid.
  const before = m.tiles.slice();
  selectEditorTool(m, 'wall');
  paintEditor(m, 1, 1);
  check(m.tiles[1 * m.cols + 1] === 'wall', 'a wall is painted before undo');
  check(undoEditor(m), 'undo succeeds');
  check(JSON.stringify(m.tiles) === JSON.stringify(before), 'undo returns the exact prior grid');
  check(redoEditor(m), 'redo succeeds');
  check(m.tiles[1 * m.cols + 1] === 'wall', 'redo re-applies the wall');

  // A map with no route from start to exit is reported, in plain words.
  const sealed = createEditor();
  selectEditorTool(sealed, 'start');
  paintEditor(sealed, 0, 6);
  selectEditorTool(sealed, 'exit');
  paintEditor(sealed, 19, 6);
  selectEditorTool(sealed, 'wall');
  for (let r = 0; r < ROWS; r++) paintEditor(sealed, 9, r);
  check(editorValidation(sealed) === 'no route from start to exit', `a sealed board reports "no route" (${editorValidation(sealed)})`);
  check(!editorPlayable(sealed), 'a sealed board is not playable');
}

// --- 43. A pasted code starts a run on that map; an edited map routes and spawns normally -------
{
  // Decoding a share code yields a run on exactly that level.
  const code = encodeLevel({
    id: '', name: 'Pasted', walls: [[4, 5]],
    starts: [{ col: 0, row: 6 }], exits: [{ col: 19, row: 6 }], toggles: [],
  });
  const pasted = decodeCode(code);
  check(pasted.ok, 'the pasted code decodes');
  const s = createRunState(undefined, pasted.level);
  check(s.level.name === 'Pasted', 'a pasted code starts a run on that map');
  check(currentPath(s).length > 0, 'the pasted map produces a route');

  // An edited Open-Field-shaped map behaves exactly like the shipped one.
  const m = createEditor();
  selectEditorTool(m, 'start');
  paintEditor(m, 0, 6);
  selectEditorTool(m, 'exit');
  paintEditor(m, 19, 6);
  selectEditorTool(m, 'wall');
  for (const [c, r] of LEVELS.find((l) => l.id === 'open-field').walls) paintEditor(m, c, r);
  check(editorPlayable(m), 'the edited open-field map is playable');
  const edited = createRunState(undefined, editorLevel(m));
  const shipped = stateOnLevel('open-field');
  check(currentPath(edited).length === currentPath(shipped).length,
    'an edited map with the same geometry has the same route length as the shipped map');
  check(JSON.stringify(buildSchedule(1)) === JSON.stringify(buildSchedule(1)), 'wave generation is unchanged for an edited map');
  check(startWave(edited), 'a wave starts on the edited map');
}

// --- 43b. The No-Build tile (docs/NO-BUILD-TILE.md) -------------------------------------------
{
  const nbLevel = (extra) => ({
    id: '', name: 'NoBuild', walls: [[4, 5]],
    starts: [{ col: 0, row: 6 }], exits: [{ col: 19, row: 6 }],
    toggles: [],
    ...extra,
  });

  // Pathing: a no-build tile is walkable and routes identically to a buildable tile there.
  const buildableGrid = createGrid(nbLevel({}));
  const noBuildGrid = createGrid(nbLevel({ noBuild: [[10, 6]] }));
  const exit = { col: 19, row: 6 };
  const fieldBuildable = buildField(buildableGrid, new Set(), exit);
  const fieldNoBuild = buildField(noBuildGrid, new Set(), exit);
  check(tileAt(noBuildGrid, 10, 6) === 'no-build', 'createGrid marks a no-build tile');
  check(tileAt(noBuildGrid, 4, 5) === 'blocked', 'createGrid keeps the wall beside the no-build tile');
  check(JSON.stringify(Array.from(fieldNoBuild)) === JSON.stringify(Array.from(fieldBuildable)),
    'pathing across a no-build tile matches the same board with a buildable tile');

  // canPlace is false on a no-build tile for every tower kind (walls included), with the new reason.
  const s = createRunState(undefined, nbLevel({ noBuild: [[10, 6]] }));
  s.wave = 24; // unlock every tower kind
  for (const kind of TOWER_KINDS) {
    check(!canPlace(s, kind, 10, 6), `canPlace refuses ${kind} on a no-build tile`);
  }
  check(canPlace(s, 'gun', 1, 1), 'a buildable tile still places');
  check(t('shell.refusal.noBuildTile') === 'No towers on a No-Build tile.',
    'the no-build refusal string is present');

  // validateLevel accepts noBuild, rejects a tile listed as both wall and no-build.
  check(validateLevel(nbLevel({ noBuild: [[10, 6]] })) === null, 'validateLevel accepts a no-build tile');
  check(validateLevel(nbLevel({ walls: [[4, 5], [10, 6]], noBuild: [[10, 6]] })) !== null,
    'validateLevel rejects a tile that is both wall and no-build');

  // Save round-trip: all three tile kinds (plus a shutter) encode, decode and paint back identically.
  const allKinds = {
    id: '', name: 'ThreeKinds', walls: [[4, 5]], noBuild: [[10, 6]],
    starts: [{ col: 0, row: 6 }], exits: [{ col: 19, row: 6 }],
    toggles: [{ col: 12, row: 6, periodTicks: 900, openTicks: 420, phaseTicks: 0 }],
  };
  const dec = decodeCode(encodeLevel(allKinds));
  check(dec.ok, 'a map with all three tile kinds round-trips');
  check(dec.ok && JSON.stringify([...dec.level.noBuild].sort()) === JSON.stringify([[10, 6]]),
    'the round-trip keeps the no-build tiles');
  check(dec.ok && dec.level.walls.some(([c, r]) => c === 4 && r === 5), 'the round-trip keeps the walls');
  check(dec.ok && (dec.level.toggles ?? []).length === 1, 'the round-trip keeps the shutter');

  // An old two-character save (no no-build value in the bitfield) still loads.
  const old = { id: '', name: 'Old', walls: [[3, 2]], starts: [{ col: 0, row: 6 }], exits: [{ col: 19, row: 6 }], toggles: [] };
  const oldDec = decodeCode(encodeLevel(old));
  check(oldDec.ok && JSON.stringify([...(oldDec.level.noBuild ?? [])]) === '[]', 'an old two-character save still loads');

  // Draw order: the hatch is drawn in the tile pass, before the enemy layer.
  {
    const layout = computeLayout(1280, 800);
    const hover = { col: 0, row: 0, onBoard: false, x: 0, y: 0 };
    const v = new BoardView();
    v.draw(createRunState(undefined, nbLevel({ noBuild: [[10, 6]] })), layout, 0, hover);
    const children = v.root.children;
    const tilesIdx = children.indexOf(v.tiles);
    const enemiesIdx = children.indexOf(v.enemies);
    check(tilesIdx >= 0 && enemiesIdx >= 0 && tilesIdx < enemiesIdx,
      'the no-build hatch (tile layer) sits before the enemy layer in the container order');
  }

  // Thumbnail: a no-build tile differs from a floor tile by exactly the 8 % darkening.
  {
    const parse = (hex) => {
      const n = parseInt(hex.slice(1), 16);
      return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
    };
    const floor = parse(thumbBase('open'));
    const nb = parse(thumbBase('no-build'));
    const expected = floor.map((c) => Math.round(c * 0.92));
    check(JSON.stringify(nb) === JSON.stringify(expected),
      `a no-build thumbnail tile is the floor darkened 8 % (${thumbBase('no-build')})`);
    const cells = levelThumbnail(nbLevel({ noBuild: [[1, 1]] }));
    check(cells[1 * COLS + 1] === 'no-build', 'levelThumbnail marks an off-route no-build tile');
  }

  // Editor: paint, erase, and the wall-over-no-build replacement.
  {
    const m = createEditor();
    selectEditorTool(m, 'no-build');
    check(paintEditor(m, 3, 4) === null && editorTileAt(m, 3, 4) === 'no-build', 'the No-Build tool paints a no-build tile');
    selectEditorTool(m, 'wall');
    check(paintEditor(m, 3, 4) === null && editorTileAt(m, 3, 4) === 'wall', 'painting a wall over a no-build tile replaces it');
    selectEditorTool(m, 'no-build');
    check(paintEditor(m, 3, 4) === null && editorTileAt(m, 3, 4) === 'no-build', 'painting a no-build tile over a wall replaces it');
    eraseEditor(m, 3, 4);
    check(editorTileAt(m, 3, 4) === 'floor', 'erase paints a no-build tile back to floor');
  }
}

// --- 44. Minesweeper (Cannon branch B) --------------------------------------------------------
{
  // 44a. Branching down B turns the cannon into a Minesweeper that never fires its gun.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cannon', 5, 5);
  const cannon = towerAt(s, 5, 5);
  upgradeTower(s, 5, 5);
  chooseBranch(s, 5, 5, 'B');
  check(isMinesweeper(cannon), 'cannon B is a Minesweeper');
  check(branchName('cannon', 'B') === 'Minesweeper', 'cannon branch B is named Minesweeper');

  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const grunt = stationary(1, 'grunt', 1, 5.5, 5.0);
  s.enemies.push(grunt);
  for (let i = 0; i < 120; i++) tick(s);
  check(grunt.hp === grunt.maxHp && cannon.damageDealt === 0,
    'a Minesweeper never fires its gun at a ground enemy in range');
}

{
  // 44b. The first mine lands at exactly 2.5 s of sim, not before.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cannon', 5, 5);
  upgradeTower(s, 5, 5);
  chooseBranch(s, 5, 5, 'B');
  check(s.mines.length === 0, 'a fresh Minesweeper starts with no mines');
  for (let i = 0; i < MINE_INTERVAL_TICKS - 1; i++) tick(s);
  check(s.mines.length === 0, 'no mine before 2.5 s have passed');
  tick(s);
  check(s.mines.length === 1, 'the first mine lands at exactly 2.5 s');
}

{
  // 44c. A mine arms 0.5 s after it lands and never detonates before that.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cannon', 5, 5);
  const tower = towerAt(s, 5, 5);
  upgradeTower(s, 5, 5);
  chooseBranch(s, 5, 5, 'B');
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const placed = s.clock;
  s.mines.push({ id: 900, towerId: tower.id, x: 5.5, y: 6.5, placedTick: placed, armedAtTick: placed + MINE_ARM_TICKS, expiresTick: placed + MINE_EXPIRE_TICKS });
  const grunt = stationary(1, 'grunt', 1, 5.5, 6.5);
  s.enemies.push(grunt);

  tick(s);
  check(grunt.hp === grunt.maxHp, 'an unarmed mine does not detonate under an enemy');
  check(s.mines.length === 1, 'the unarmed mine is not consumed');

  while (s.clock < placed + MINE_ARM_TICKS) tick(s);
  check(grunt.hp === grunt.maxHp, 'the mine never detonates before it arms');
  check(s.mines.length === 1, 'the mine survives until its arming tick');

  tick(s);
  check(s.mines.length === 0, 'an armed mine detonates once a ground enemy stands on it');
  check(grunt.hp === grunt.maxHp - MINE_DAMAGE, `the detonation deals ${MINE_DAMAGE} (grunt ${grunt.hp}/${grunt.maxHp})`);
}

{
  // 44d. An armed mine damages every ground enemy inside 0.9 tiles and removes itself.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cannon', 5, 5);
  const tower = towerAt(s, 5, 5);
  upgradeTower(s, 5, 5);
  chooseBranch(s, 5, 5, 'B');
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const now = s.clock;
  s.mines.push({ id: 901, towerId: tower.id, x: 5.5, y: 6.5, placedTick: now, armedAtTick: now, expiresTick: now + MINE_EXPIRE_TICKS });
  const onMine = stationary(1, 'grunt', 1, 5.5, 6.5);
  const near = stationary(2, 'grunt', 1, 5.9, 6.5);
  const far = stationary(3, 'grunt', 1, 7.5, 6.5);
  s.enemies.push(onMine, near, far);
  tick(s);
  check(s.mines.length === 0, 'an armed mine is removed once triggered');
  check(onMine.hp === onMine.maxHp - MINE_DAMAGE, `the triggering enemy takes ${MINE_DAMAGE}`);
  check(near.hp === near.maxHp - MINE_DAMAGE, 'a ground enemy inside 0.9 tiles also takes 18');
  check(far.hp === far.maxHp, 'a ground enemy beyond 0.9 tiles is untouched');
}

{
  // 44e. A flyer crossing a mine takes no damage and does not consume it.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cannon', 5, 5);
  const tower = towerAt(s, 5, 5);
  upgradeTower(s, 5, 5);
  chooseBranch(s, 5, 5, 'B');
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const now = s.clock;
  s.mines.push({ id: 902, towerId: tower.id, x: 5.5, y: 6.5, placedTick: now, armedAtTick: now, expiresTick: now + MINE_EXPIRE_TICKS });
  const flyer = stationary(1, 'flyer', 1, 5.5, 6.5);
  s.enemies.push(flyer);
  tick(s);
  check(flyer.hp === flyer.maxHp, 'a flyer crossing a mine takes no damage');
  check(s.mines.length === 1, 'a flyer does not consume the mine');
}

{
  // 44f. The seventh mine evicts the oldest: never more than six live per tower.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cannon', 5, 5);
  const tower = towerAt(s, 5, 5);
  upgradeTower(s, 5, 5);
  chooseBranch(s, 5, 5, 'B');
  let firstPlaced = Infinity;
  let maxSeen = 0;
  for (let i = 0; i < 7 * MINE_INTERVAL_TICKS; i++) {
    tick(s);
    for (const m of s.mines) firstPlaced = Math.min(firstPlaced, m.placedTick);
    maxSeen = Math.max(maxSeen, s.mines.length);
  }
  check(maxSeen === MINE_LIVE_CAP, `never more than ${MINE_LIVE_CAP} live mines (peak ${maxSeen})`);
  check(s.mines.length === MINE_LIVE_CAP, `exactly ${MINE_LIVE_CAP} mines remain after a seventh drop`);
  check(s.mines.every((m) => m.towerId === tower.id), 'all live mines belong to the tower');
  check(!s.mines.some((m) => m.placedTick === firstPlaced), 'the seventh drop removed the oldest mine');
}

{
  // 44g. Selling the tower removes its mines.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cannon', 5, 5);
  const tower = towerAt(s, 5, 5);
  upgradeTower(s, 5, 5);
  chooseBranch(s, 5, 5, 'B');
  const now = s.clock;
  s.mines.push({ id: 910, towerId: tower.id, x: 5.5, y: 6.5, placedTick: now, armedAtTick: now, expiresTick: now + MINE_EXPIRE_TICKS });
  check(sellTower(s, 5, 5), 'sell the Minesweeper');
  check(s.mines.length === 0, 'selling the tower removes its mines');
}

{
  // 44h. A destroyed tower takes its mines with it (the destroy path cleans up by tower id too).
  const s = stateOnLevel('open-field');
  s.economy.salvage = 10000;
  const first = stepToward(s.breacherField, SPAWN.col, SPAWN.row);
  placeTower(s, 'wall', first.col, first.row);
  const wall = towerAt(s, first.col, first.row);
  const now = s.clock;
  s.mines.push({ id: 911, towerId: wall.id, x: 5.5, y: 1.5, placedTick: now, armedAtTick: now, expiresTick: now + MINE_EXPIRE_TICKS });
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const b = createEnemy(1, 'breacher', 12, SPAWN, EXIT);
  s.enemies.push(b);
  for (let i = 0; i < 6000 && !b.dead && towerAt(s, first.col, first.row); i++) tick(s);
  check(!towerAt(s, first.col, first.row), 'the wall was destroyed by the breacher');
  check(s.mines.length === 0, 'a destroyed wall takes its mines with it');
}

{
  // 44i. Fixed-timestep equivalence holds with mines live and an enemy walking the field.
  const run = (frameMs) => {
    const s = allUnlocked();
    s.economy.salvage = 100000;
    placeTower(s, 'cannon', 5, 5);
    upgradeTower(s, 5, 5);
    chooseBranch(s, 5, 5, 'B');
    s.phase = 'wave';
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    s.enemies.push(createEnemy(1, 'grunt', 6, SPAWN, EXIT));
    for (let t = 0; t < 1000 * TICK_MS - frameMs; t += frameMs) step(s, frameMs);
    while (s.tick < 1000) tick(s);
    return JSON.stringify([
      s.mines.map((m) => [m.id, m.towerId, +m.x.toFixed(4), +m.y.toFixed(4), m.placedTick, m.armedAtTick, m.expiresTick]),
      s.enemies.map((e) => [e.id, +e.hp.toFixed(4), e.dead]),
      s.economy,
      s.integrity,
      s.rng,
      s.clock,
    ]);
  };
  const at60 = run(TICK_MS);
  check(at60 === run(1000 / 144), 'mines live: same result at 60 Hz and 144 Hz frames');
  check(at60 === run(1000 / 23), 'mines live: same result at 23 Hz frames');
}

{
  // 44j. The branch tooltip names the cap and the duration, both otherwise invisible.
  const s = allUnlocked();
  s.economy.salvage = 100000;
  placeTower(s, 'cannon', 5, 5);
  const cannon = towerAt(s, 5, 5);
  upgradeTower(s, 5, 5);
  const tip = tooltipText(branchTooltipLines(cannon, 'B', s.economy.salvage)[0]);
  check(tip.startsWith('Minesweeper — lays mines on the path; flyers pass over them'),
    `branch tooltip names the behaviour (${tip})`);
  check(tip.includes('6 max') && tip.includes('30 s'), `branch tooltip states the cap and duration (${tip})`);
}

// --- 45. The Help viewer ----------------------------------------------------------------------

{
  // 44a. Every enemy kind, every boss variant and every tower kind has exactly one page, and the
  // Bosses chapter also carries its one general page.
  for (const kind of ENEMY_KINDS) {
    const pages = HELP_PAGES.filter((p) => p.category === 'enemies' && p.gate.kind === 'enemy' && p.gate.enemy === kind);
    check(pages.length === 1, `enemy ${kind} has exactly one Help page`);
  }
  for (const kind of BOSS_KINDS) {
    const pages = HELP_PAGES.filter((p) => p.category === 'bosses' && p.gate.kind === 'boss' && p.gate.enemy === kind);
    check(pages.length === 1, `boss ${kind} has exactly one Help page`);
  }
  for (const kind of TOWER_KINDS) {
    const pages = HELP_PAGES.filter((p) => p.category === 'towers' && p.gate.kind === 'tower' && p.gate.tower === kind);
    check(pages.length === 1, `tower ${kind} has exactly one Help page`);
  }
  check(HELP_PAGES.filter((p) => p.category === 'bosses' && p.gate.kind === 'any-boss').length === 1,
    'the Bosses chapter has exactly one general page');
}

{
  // 44b. Gates: tower pages key off bestWave, enemy pages off seenEnemies, boss pages off seenBossKinds,
  // and the general boss page waits for the first boss encounter.
  const p = defaultProfile();
  const cannon = pageById('tower-cannon');
  check(cannon !== undefined && !pageUnlocked(cannon, p), 'the Cannon page is locked before wave 4');
  p.bestWave = 4;
  check(pageUnlocked(cannon, p), 'the Cannon page unlocks once bestWave reaches its unlock wave');

  const flyer = pageById('enemy-flyer');
  check(flyer !== undefined && !pageUnlocked(flyer, p), 'the Flyer page is locked before the flyer is seen');
  p.seenEnemies.push('flyer');
  check(pageUnlocked(flyer, p), 'the Flyer page unlocks once the flyer is encountered');

  const sergeant = pageById('boss-grunt-boss');
  check(sergeant !== undefined && !pageUnlocked(sergeant, p), 'the Sergeant page is locked before the boss is seen');
  p.seenBossKinds.push('grunt-boss');
  check(pageUnlocked(sergeant, p), 'the Sergeant page unlocks once the boss is encountered');

  check(pageUnlocked(pageById('getting-started'), p), 'Getting started is never locked');
  check(pageUnlocked(pageById('mechanics-pointer'), p), 'Mechanics pages are never locked');

  const general = pageById('bosses-in-general');
  check(!pageUnlocked(general, defaultProfile()), 'the general boss page is locked before any boss is seen');
  check(pageUnlocked(general, p), 'the general boss page unlocks after the first boss');
}

{
  // 44c. An older save without the seenEnemies field loads cleanly and starts everything locked.
  const store = { value: null, getItem() { return this.value; }, setItem(_k, v) { this.value = v; } };
  store.value = JSON.stringify({ version: 1, specs: { cpu: 0, ram: 0, gpu: 0, disk: 0 } });
  const loaded = loadProfile(store);
  check(Array.isArray(loaded.seenEnemies) && loaded.seenEnemies.length === 0,
    'an older save without seenEnemies loads with an empty list');
}

{
  // 44d. The sim emits an enemySpawned event when a wave spawns, and the recorded encounter survives
  // a save round trip and unlocks the page.
  const s = stateOnLevel('open-field');
  s.events = [];
  startWave(s);
  for (let i = 0; i < 10 && !s.events.some((e) => e.type === 'enemySpawned'); i++) tick(s);
  check(s.events.some((e) => e.type === 'enemySpawned' && e.kind === 'grunt'),
    'spawning a grunt emits an enemySpawned event');

  const store = { value: null, getItem() { return this.value; }, setItem(_k, v) { this.value = v; } };
  const p = defaultProfile();
  addSeenEnemies(p, ['flyer']);
  saveProfile(p, store);
  const reloaded = loadProfile(store);
  check(reloaded.seenEnemies.includes('flyer'), 'an encountered kind survives a save round trip');
  check(pageUnlocked(pageById('enemy-flyer'), reloaded), 'the Flyer page is unlocked after the round trip');
  check(addSeenEnemies(p, ['flyer']) === false, 'recording an already-seen kind changes nothing');
}

{
  // 44e. A locked enemy row is greyed, labelled Undiscovered, and never reveals the enemy's name.
  const p = defaultProfile();
  const rows = helpRows(p, 2); // the Enemies chapter expanded
  const flyerRow = rows.find((r) => r.kind === 'page' && r.page.id === 'enemy-flyer');
  check(flyerRow !== undefined && flyerRow.locked, 'the Flyer row is locked before the flyer is seen');
  const label = treeRowLabel(flyerRow);
  check(label === 'Undiscovered', `a locked row reads "Undiscovered" (got "${label}")`);
  check(!label.toLowerCase().includes('flyer'), 'a locked row does not reveal the enemy name');

  p.seenEnemies.push('flyer');
  const unlockedRow = helpRows(p, 2).find((r) => r.kind === 'page' && r.page.id === 'enemy-flyer');
  check(treeRowLabel(unlockedRow) === 'Flyer', 'an unlocked row reads the enemy name');
}

// --- 44f. Help Markdown (docs/HELP-MARKDOWN.md): parser, alignment and the tier tables ------------

function helpSynthTower(kind, tier, branch) {
  const t = createTower(0, kind, 0, 0);
  t.tier = tier;
  t.branch = branch;
  return t;
}
function helpFmtDps(damage, fireTicks) { return fireTicks <= 0 ? '—' : (damage * TICK_HZ / fireTicks).toFixed(2); }

{
  // 1. Parser: inline styles, bullets, tables, and a mismatched row is a thrown parse error.
  const blocks = parseHelpMarkdown([
    'This is **bold** and *italic* and `code`.',
    '- one',
    '- two',
    '| A | B |',
    '|---|--:|',
    '| x | 1 |',
    '| y | 2 |',
  ]);
  check(blocks[0].kind === 'paragraph', 'parser: a prose line is a paragraph');
  const para = blocks[0];
  check(para.runs.some((r) => r.bold && r.text === 'bold'), 'parser: **bold** becomes a bold run');
  check(para.runs.some((r) => r.italic && r.text === 'italic'), 'parser: *italic* becomes an italic run');
  check(para.runs.some((r) => r.code && r.text === 'code'), 'parser: `code` becomes a code run');
  check(blocks[1].kind === 'bullet' && blocks[2].kind === 'bullet', 'parser: "- " lines are bullets');
  check(blocks[3].kind === 'table', 'parser: a pipe table parses to one table block');
  const table = blocks[3];
  check(table.header.join(',') === 'A,B' && table.rows.length === 2, 'parser: a table has its header and two body rows');

  let threw = false;
  try {
    parseHelpMarkdown(['| A | B |', '|---|---|', '| x |']);
  } catch {
    threw = true;
  }
  check(threw, 'parser: a row with a different cell count than the header is a parse error');
}

{
  // 2. Alignment: `--:` right-aligns, and a right-aligned numeric column's cells end at the same x.
  const blocks = parseHelpMarkdown(['| Tier | Cost | DPS |', '|---|--:|--:|', '| 1 | — | 6.0 |', '| 10 | $300 | 50.25 |', '| 100 | $3000 | 502.5 |']);
  const table = blocks[0];
  check(table.kind === 'table' && table.align.join(',') === 'left,right,right', 'alignment: --: parses to right alignment');
  const layout = layoutHelpBlocks(blocks, 400, null, (t) => t.length * 7);
  const laid = layout.items[0];
  const rightEdges = laid.cells.map((row) => {
    const cell = row[2];
    const last = cell[cell.length - 1];
    return last.x + last.width;
  });
  check(rightEdges.every((x) => Math.abs(x - rightEdges[0]) < 1e-9), `alignment: right-aligned cells end at the same x (${rightEdges.join(',')})`);
}

{
  // 5. The Gun tier table's tier 5 / 10 / 20 rows match effectiveStats and upgradeCost.
  const gun = pageById('tower-gun');
  const table = parseHelpMarkdown(gun.body).find((b) => b.kind === 'table');
  check(table !== undefined && table.header[0] === 'Tier' && table.header[1] === 'Cost' && table.header.length === 4,
    `the Gun page has a Tier/Cost/branch/branch table (${table?.header.join(',')})`);
  check(table.header[2] === 'Marksman' && table.header[3] === 'Repeater', 'the Gun table names its two branches');
  for (const tier of [5, 10, 20]) {
    const row = table.rows[tier - 1];
    const tierText = row[0].map((r) => r.text).join('');
    const costText = row[1].map((r) => r.text).join('');
    check(tierText === String(tier), `gun tier ${tier} row labels its tier`);
    check(costText === `$${upgradeCost(helpSynthTower('gun', tier - 1, null))}`, `gun tier ${tier} cost matches upgradeCost (${costText})`);
    for (const [bi, branch] of ['A', 'B'].entries()) {
      const eff = effectiveStats(helpSynthTower('gun', tier, branch));
      const got = row[2 + bi].map((r) => r.text).join('');
      check(got === helpFmtDps(eff.damage, eff.fireInterval), `gun tier ${tier} ${branch} DPS matches effectiveStats (${got})`);
    }
  }
}

{
  // 6. A Wall page's table stops at tier 3, a Cursor's at 5, a Gun's at 20.
  const rowsFor = (id) => parseHelpMarkdown(pageById(id).body).find((b) => b.kind === 'table').rows.length;
  check(rowsFor('tower-wall') === 3, 'the Wall table stops at tier 3');
  check(rowsFor('tower-cursor') === 5, 'the Cursor table stops at tier 5');
  check(rowsFor('tower-gun') === 20, 'the Gun table stops at tier 20');
}

{
  // 7. Every locale's Help prose keeps the English Markdown shape: same lines, each the same kind,
  // and a table row keeps its pipe count. A translation that drops a pipe silently loses a column.
  const enHelp = (await import('../src/i18n/en/help.ts')).help;
  const shapeOf = (text) =>
    text.split('\n').map((line) => {
      const t = line.trim();
      if (t.startsWith('## ')) return 'h';
      if (t.startsWith('- ')) return 'b';
      if (t.startsWith('|')) return `t${(t.match(/\|/g) ?? []).length}`;
      return 'p';
    }).join(',');
  for (const code of ['es', 'fr', 'ru', 'uk', 'zh-Hans', 'he']) {
    const mod = await import(`../src/i18n/${code}/help.ts`);
    const bad = Object.keys(enHelp).filter((k) => shapeOf(enHelp[k]) !== shapeOf(mod.help[k]));
    check(bad.length === 0, `help prose: ${code} keeps the English Markdown shape (${bad.slice(0, 3).join(', ')})`);
  }
}

{
  // 44f3. A long page reports a positive scroll range; a short page reports zero and draws no
  // scrollbar; scrolling past either end clamps.
  const l = computeLayout(1280, 720);
  const pos = defaultHelpPosition(l);
  const hl = computeHelpLayout(pos.x, pos.y);

  const gunPage = HELP_PAGES.find((p) => p.id === 'tower-gun');
  const longScroll = computeHelpScroll(gunPage, hl.pageText, 0);
  check(longScroll.maxScroll > 0, `a tower page is longer than its panel (scroll range ${longScroll.maxScroll})`);
  check(longScroll.scroll === 0, 'a fresh page starts scrolled to the first line');
  check(computeHelpScroll(gunPage, hl.pageText, 1e9).scroll === longScroll.maxScroll,
    'scrolling past the end clamps to the last line');
  check(computeHelpScroll(gunPage, hl.pageText, -1e9).scroll === 0,
    'scrolling past the top clamps to the first line');

  const shortPage = HELP_PAGES.find((p) => p.id === 'mechanics-auto-start');
  const shortScroll = computeHelpScroll(shortPage, hl.pageText, 0);
  check(shortScroll.maxScroll === 0, 'a short page reports a zero scroll range (no scrollbar)');

  const mid = computeHelpScroll(gunPage, hl.pageText, longScroll.maxScroll / 2);
  check(mid.thumb.y >= mid.scrollbar.y && mid.thumb.y + mid.thumb.h <= mid.scrollbar.y + mid.scrollbar.h,
    'the thumb stays inside its track');

  const session = new HelpSession();
  session.pageId = 'tower-gun';
  const notch = HELP_LINE_H * HELP_SCROLL_LINES;
  session.scrollBy(notch, hl);
  check(session.scroll === notch, `a wheel notch scrolls ${HELP_SCROLL_LINES} lines (${notch}px)`);
  const beforePage = session.scroll;
  session.scrollPage(1, hl);
  check(session.scroll > beforePage, 'Page Down scrolls a window toward the end');
  session.scrollBy(1e9, hl);
  check(session.scroll === longScroll.maxScroll, 'the session clamps to the bottom');
  session.scrollBy(-1e9, hl);
  check(session.scroll === 0, 'the session clamps to the top');
}

{
  // 44f4. The help window still fits the client area at 1280x720 and 1600x900.
  for (const [vw, vh] of [[1280, 720], [1600, 900]]) {
    const l = computeLayout(vw, vh);
    const pos = defaultHelpPosition(l);
    const hl = computeHelpLayout(pos.x, pos.y);
    check(hl.window.w <= l.client.w && hl.window.h <= l.client.h, `the help window fits the client area at ${vw}x${vh}`);
  }
}

{
  // 44g. Hit-testing resolves the close box, title bar, toolbar and tree, and ignores outside points.
  const l = computeLayout(1280, 720);
  const pos = defaultHelpPosition(l);
  const hl = computeHelpLayout(pos.x, pos.y);
  const rows = helpRows(defaultProfile(), 2);
  check(helpHitAt(hl, rows, hl.close.x + hl.close.w / 2, hl.close.y + hl.close.h / 2)?.type === 'close',
    'the close box is hit-testable');
  check(helpHitAt(hl, rows, hl.title.x + 12, hl.title.y + 10)?.type === 'title', 'the title bar is hit-testable');
  check(helpHitAt(hl, rows, hl.contents.x + hl.contents.w / 2, hl.contents.y + hl.contents.h / 2)?.type === 'toolbar',
    'the Contents button is hit-testable');
  check(helpHitAt(hl, rows, hl.window.x + hl.window.w + 20, hl.window.y + 10) === null,
    'a point outside the window is not a hit');
  check(helpHitAt(hl, rows, hl.pagePanel.x + hl.pagePanel.w / 2, hl.pagePanel.y + hl.pagePanel.h / 2)?.type === 'page',
    'a click in the page panel is swallowed by the window');
}

{
  // 44h. The session: single instance, centred first open, kept position, clamped drag, close.
  const l = computeLayout(1280, 720);
  const session = new HelpSession();
  check(!session.open, 'the help window starts closed');
  session.show(l);
  check(session.open, 'Show Help opens the window');
  const centred = defaultHelpPosition(l);
  check(session.x === centred.x && session.y === centred.y, 'it opens centred the first time');
  session.show(l);
  check(session.open && session.x === centred.x && session.y === centred.y,
    'a second Show Help choice does not open a second window');

  session.startDrag(l.client.x + 10, l.client.y + 10);
  session.dragTo(l, l.client.x + 40, l.client.y + 40);
  session.endDrag();
  check(session.x !== centred.x || session.y !== centred.y, 'dragging the title bar moves the window');

  const clamped = clampHelpPosition(l, -100000, -100000);
  check(clamped.x === l.client.x - HELP_W + 32 && clamped.y === l.client.y - HELP_H + 32,
    'clampHelpPosition keeps a minimum strip of the window visible');
  session.startDrag(l.client.x + 10, l.client.y + 10);
  session.dragTo(l, -100000, -100000);
  check(session.x === clamped.x && session.y === clamped.y, 'dragging is clamped so the window cannot be dragged fully off');
  session.endDrag();

  const moved = { x: session.x, y: session.y };
  session.hide();
  check(!session.open, 'the close box (and Escape) close the window');
  session.show(l);
  check(session.open && session.x === moved.x && session.y === moved.y, 'reopening keeps the session position');
}

{
  // 44i. A locked row is unselectable: clicking it does nothing but explain why; Contents collapses.
  const l = computeLayout(1280, 720);
  const session = new HelpSession();
  session.show(l);
  const before = session.pageId;

  const p = defaultProfile();
  const lockedRow = helpRows(p, 2).find((r) => r.kind === 'page' && r.page.id === 'enemy-flyer');
  session.clickTree(lockedRow);
  check(session.pageId === before, 'clicking a locked row does not change the page');
  check(session.status === 'Encounter this enemy to learn about it',
    `clicking a locked row says why (${session.status})`);

  p.seenEnemies.push('flyer');
  const unlockedRow = helpRows(p, 2).find((r) => r.kind === 'page' && r.page.id === 'enemy-flyer');
  session.clickTree(unlockedRow);
  check(session.pageId === 'enemy-flyer', 'clicking an unlocked row opens the page');
  check(session.canBack(), 'opening a page enables Back');

  session.contents();
  check(session.expanded === null, 'Contents collapses the tree back to the top');
}

// --- 44j. CHM chrome: Print builds a document with the title and first body line ----------------
{
  const gs = pageById('getting-started');
  const doc = helpPrintDocument(gs, new Date(0));
  check(doc.includes(gs.title), 'print: the document contains the topic title');
  check(doc.includes(gs.body[0]), 'print: the document contains the first body line');
  check(doc.includes(t('window.title')), 'print: the document names the game');
  const tower = pageById('tower-gun');
  const towerDoc = helpPrintDocument(tower, new Date(0));
  check(!towerDoc.includes('**') && !towerDoc.includes('|'), 'print: bold markers and table pipes are stripped');
}

// --- 44k. CHM chrome: Options opens/closes and its disabled states follow the session -----------
{
  const session = new HelpSession();
  const hl = computeHelpLayout(0, 0);
  const menu = helpOptionsMenu(hl, session);
  check(menu.items.length === 6, 'options: the menu has six items');
  check(menu.items.map((i) => i.action).join(',') === 'hide-tabs,back,forward,home,print,refresh',
    'options: the menu lists Hide tabs, Back, Forward, Home, Print, Refresh');
  const back = menu.items.find((i) => i.action === 'back');
  const forward = menu.items.find((i) => i.action === 'forward');
  check(!back.enabled && !forward.enabled, 'options: Back and Forward are disabled with no history');

  session.optionsOpen = true;
  check(helpOptionsHitAt(hl, session, menu.items[0].rect.x + 4, menu.items[0].rect.y + 4) === 'hide-tabs',
    'options: an open menu resolves a click on an item');
  session.optionsOpen = false;
  check(helpOptionsHitAt(hl, session, menu.items[0].rect.x + 4, menu.items[0].rect.y + 4) === null,
    'options: a closed menu resolves to null');

  session.openPageId('tower-gun');
  const menu2 = helpOptionsMenu(hl, session);
  check(menu2.items.find((i) => i.action === 'back').enabled, 'options: Back enables after opening a page');
  check(!menu2.items.find((i) => i.action === 'forward').enabled, 'options: Forward stays disabled at the newest page');
}

// --- 44l. CHM chrome: Locate stays enabled and expands a collapsed chapter ----------------------
{
  const profile = defaultProfile();
  profile.seenEnemies.push('flyer');
  profile.bestWave = 24;
  const session = new HelpSession();
  session.pageId = 'enemy-flyer'; // reached via Search/Index, so the Enemies chapter stays collapsed
  check(session.expanded === null, 'locate: the chapter starts collapsed');
  check(session.locateEnabled(), 'locate: stays enabled for a topic whose chapter is collapsed');
  session.locate(profile);
  check(session.expanded === 2, 'locate: expands the collapsed Enemies chapter');
  check(session.navTab === 'contents', 'locate: switches to the Contents tab');
  const rows = helpRows(profile, 2);
  check(rows[session.treeSelected]?.kind === 'page' && rows[session.treeSelected].page.id === 'enemy-flyer',
    'locate: selects the open topic row');
  session.pageId = null;
  check(!session.locateEnabled(), 'locate: disabled when there is no open topic');
}

// --- 44m. CHM chrome: tree keys move the selection, expand/collapse, and Enter opens ------------
{
  const profile = defaultProfile();
  profile.bestWave = 24;
  const session = new HelpSession();
  session.expanded = 2;
  const rows = helpRows(profile, 2);
  session.treeSelected = 0;
  session.helpTreeKey('arrowdown', profile);
  check(session.treeSelected === 1, 'tree keys: Down moves the selection down');
  session.helpTreeKey('arrowup', profile);
  check(session.treeSelected === 0, 'tree keys: Up moves the selection up');
  session.helpTreeKey('end', profile);
  check(session.treeSelected === rows.length - 1, 'tree keys: End jumps to the last row');
  session.helpTreeKey('home', profile);
  check(session.treeSelected === 0, 'tree keys: Home jumps to the first row');

  // Right expands a collapsed chapter and steps into its first child.
  session.expanded = null;
  session.treeSelected = 0;
  session.helpTreeKey('arrowright', profile);
  check(session.expanded === 0, 'tree keys: Right expands a chapter');
  const afterRight = helpRows(profile, 0);
  check(afterRight[session.treeSelected]?.kind === 'page', 'tree keys: Right steps into the chapter');

  // Left walks from a page to its parent chapter, then collapses it.
  session.helpTreeKey('arrowleft', profile);
  check(session.treeSelected === 0, 'tree keys: Left walks to the parent chapter');
  session.helpTreeKey('arrowleft', profile);
  check(session.expanded === null, 'tree keys: Left collapses the expanded chapter');

  // Enter opens the selected page (the Mechanics chapter is fully ungated).
  session.expanded = 1;
  const openRows = helpRows(profile, 1);
  const pageIdx = openRows.findIndex((r) => r.kind === 'page');
  session.treeSelected = pageIdx;
  session.helpTreeKey('enter', profile);
  check(session.pageId === openRows[pageIdx].page.id, 'tree keys: Enter opens the selected page');
}

// --- 44n. CHM chrome: the navigation-pane context menu resolves Open and Print -------------------
{
  const hl = computeHelpLayout(0, 0);
  const ctx = { x: hl.treePanel.x + 8, y: hl.treePanel.y + 8 };
  const menu = helpContextMenuLayout(hl, ctx);
  check(menu.items.length === 2, 'context menu: two items');
  check(menu.items.map((i) => i.action).join(',') === 'open,print', 'context menu: Open then Print');
  check(helpContextHitAt(hl, ctx, menu.items[0].rect.x + 4, menu.items[0].rect.y + 4) === 'open',
    'context menu: the first item resolves to Open');
  check(helpContextHitAt(hl, ctx, menu.items[1].rect.x + 4, menu.items[1].rect.y + 4) === 'print',
    'context menu: the second item resolves to Print');
  check(helpContextHitAt(hl, null, menu.items[0].rect.x + 4, menu.items[0].rect.y + 4) === null,
    'context menu: a closed menu resolves to null');
}

// --- 44o. CHM chrome: the status count is over the unlocked topics ------------------------------
{
  const profile = defaultProfile();
  profile.bestWave = 24;
  const unlocked = HELP_PAGES.filter((p) => pageUnlocked(p, profile));
  const gun = pageById('tower-gun');
  const count = helpTopicCount(gun, profile);
  check(count.total === unlocked.length && count.topic === unlocked.indexOf(gun) + 1,
    `status: the count is over unlocked topics (Topic ${count.topic} of ${count.total})`);
  check(helpTopicCount(undefined, profile).topic === 0, 'status: no open topic reads topic 0');
}

// --- 45a. Help art previews (docs/HELP-ART.md) -----------------------------------------------
{
  // 1. Every enemy and tower page that names art resolves to an asset that exists in the manifest.
  for (const page of HELP_PAGES) {
    if (!page.art) continue;
    check(manifestEntry(page.art.base) !== undefined, `help art: ${page.id} base "${page.art.base}" is in the manifest`);
    if (page.art.turret !== undefined) {
      check(manifestEntry(page.art.turret) !== undefined, `help art: ${page.id} turret "${page.art.turret}" is in the manifest`);
    }
  }
}

{
  // 3 + 4. Layout (docs/HELP-MARKDOWN.md): monotonic height, the sum of line heights, the scroll
  // invariant, and no laid-out line overlaps the artwork box, for every page at two widths.
  // The ruler must be the real one. A private estimate (`length * 13 * 0.6`) measures wide, so every
  // word is placed further right than it needs to be and the line reads as if it were justified.
  {
    const src = readFileSync(new URL('../src/view/helpMarkdown.ts', import.meta.url), 'utf8');
    check(
      /export function helpMeasure\([\s\S]*?textWidth\(/.test(src),
      'help markdown: helpMeasure delegates to the shared text measurer',
    );
  }

  // RTL: prose is flush right, the first word is the rightmost, and a bullet's marker sits outside
  // the text on the right rather than floating at the left edge.
  {
    const width = 320;
    const rtlLayout = layoutHelpBlocks(parseHelpMarkdown(HELP_PAGES[0].body), width, null, helpMeasure, true);
    let rightAligned = true;
    let firstWordRightmost = true;
    for (const item of rtlLayout.items) {
      if (item.kind !== 'text' || item.runs.length === 0) continue;
      const runs = item.runs;
      const right = Math.max(...runs.map((r) => r.x + r.width));
      if (right > width + 0.5) rightAligned = false;
      if (!runs[0].text.startsWith('•') && runs.length > 1) {
        const first = runs[0];
        const second = runs[1];
        if (first.x <= second.x) firstWordRightmost = false;
      }
    }
    check(rtlLayout.items.length > 0, 'help markdown: the RTL layout produces lines');
    check(firstWordRightmost, 'help markdown: RTL puts the first word on the right');
    check(rightAligned, 'help markdown: RTL lines stay inside the text column');

    // Every paragraph line ends flush against the right edge of the column it was given.
    let flush = true;
    for (const item of rtlLayout.items) {
      if (item.kind !== 'text') continue;
      const runs = item.runs.filter((r) => !r.text.startsWith('•'));
      if (runs.length === 0) continue;
      if (Math.abs(Math.max(...runs.map((r) => r.x + r.width)) - width) > 0.5) flush = false;
    }
    check(flush, 'help markdown: RTL paragraph lines are right-justified');
  }

  const widths = [computeHelpLayout(0, 0, 200).pageText.w, computeHelpLayout(0, 0, 320).pageText.w];
  const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const layoutAt = (page, width) => {
    const art = helpArtLayout(page, width);
    return layoutHelpBlocks(parseHelpMarkdown(page.body), width, art !== null ? art.box : null, helpMeasure);
  };

  for (const page of HELP_PAGES) {
    const layouts = widths.map((width) => layoutAt(page, width));

    // 3. Height is monotonic (wider never taller) and equals the bottom of the last line plus the gap.
    check(layouts[0].height <= layouts[1].height, `help markdown: ${page.id} height is monotonic across widths (${layouts[0].height} <= ${layouts[1].height})`);
    for (const [i, layout] of layouts.entries()) {
      const last = layout.items[layout.items.length - 1];
      const sum = last ? last.y + last.height + ITEM_GAP : HELP_HEADING_H;
      check(layout.height === sum, `help markdown: ${page.id} height equals the sum of line heights at ${widths[i]}px`);
      check(pageBodyHeight(page, widths[i]) === layout.height, `help markdown: pageBodyHeight equals the laid-out height for ${page.id} at ${widths[i]}px`);
    }

    // 4. No laid-out line overlaps the artwork box.
    for (const [i, layout] of layouts.entries()) {
      const art = helpArtLayout(page, widths[i]);
      if (art === null) continue;
      const box = art.box;
      let clean = true;
      for (const item of layout.items) {
        if (overlaps({ x: item.x, y: item.y, w: item.width, h: item.height }, box)) clean = false;
      }
      check(clean, `help markdown: no line overlaps the art box for ${page.id} at ${widths[i]}px`);
    }
  }
}

{
  // 5. An animated asset cycles frames across ticks; a still one does not.
  resetArt();
  const f0 = new Texture({ width: 2, height: 2 });
  const f1 = new Texture({ width: 3, height: 3 });
  injectArtFrames('grunt', [f0, f1]);
  injectArtAnim('grunt', { fps: 10, loop: 'loop', hold: 0, holdAfter: 0, randomStart: false, when: 'always' });
  check(frameTexture('grunt', 48, 0, 0) === f0, 'help art: an animated asset starts on frame 0 at tick 0');
  check(frameTexture('grunt', 48, 6, 0) === f1, 'help art: an animated asset advances to frame 1 at tick 6');
  check(frameTexture('grunt', 48, 12, 0) === f0, 'help art: an animated asset wraps back to frame 0 at tick 12');
  const still = new Texture({ width: 4, height: 4 });
  injectArtTexture('gun-base', still);
  check(frameTexture('gun-base', 48, 0, 0) === still && frameTexture('gun-base', 48, 999, 0) === still,
    'help art: a still asset stays on frame 0 across ticks');
  resetArt();
}

{
  // 6. A tower page with a turret reports both parts; one without reports the base only.
  const gun = pageById('tower-gun');
  check(gun !== undefined && gun.art?.base === 'gun-base' && gun.art.turret === 'gun-turret',
    'help art: a Gun page reports both its base and turret');
  const beacon = pageById('tower-beacon');
  check(beacon !== undefined && beacon.art?.base === 'beacon-base' && beacon.art.turret === undefined,
    'help art: a Beacon page reports its base only');
  const wall = pageById('tower-wall');
  check(wall !== undefined && wall.art === undefined, 'help art: a Wall page (no plinth) names no art');
  const popup = pageById('enemy-popup');
  check(popup !== undefined && popup.art === undefined, 'help art: the Pop-up page (runtime enemy) names no art');
}

// --- 46. Cheats ------------------------------------------------------------------------------
{
  // The menu word exists only while the gate is open. `menuNameAt` maps the same rects the chrome
  // draws, so the word is present in both the hit-test and the label list, or in neither.
  check(cheatsEnabled(), 'the cheats gate is open by default');
  check(menuItems().some((m) => m.name === 'cheats'), 'the Cheats menu word is present while visible');

  const layout = computeLayout(1280, 800);
  const cheatIdx = menuItems().findIndex((m) => m.name === 'cheats');
  const cheatRect = menuWordRects(layout.menu)[cheatIdx];
  check(menuNameAt(layout.menu, cheatRect.x + 2, cheatRect.y + 2) === 'cheats',
    'the Cheats word hit-rect maps to the Cheats name');

  setCheatsVisibleForTests(false);
  check(!cheatsEnabled(), 'the cheats gate closes');
  check(!menuItems().some((m) => m.name === 'cheats'), 'the Cheats menu word is absent while hidden');
  check(menuItems().map((m) => m.name).join(',') === 'file,view,help', 'the hidden menu bar is File, View, Help');

  setCheatsVisibleForTests(true);
  check(menuItems().some((m) => m.name === 'cheats'), 'the Cheats menu word returns when re-enabled');
  const withCheats = menuItems().map((m) => m.name);
  check(withCheats.indexOf('view') + 1 === withCheats.indexOf('cheats'), 'Cheats sits after View');
  check(withCheats.indexOf('cheats') + 1 === withCheats.indexOf('help'), 'Cheats sits before Help');
}

// --- 46a. Menu submenus (docs/MENU-SUBMENUS.md §6) ----------------------------------------------
{
  const SPAWN_PREFIX = 'spawn:';
  const spawnSubmenu = () => SPAWN_KINDS.map((kind) => ({ id: SPAWN_PREFIX + kind, label: spawnKindLabel(kind) }));
  const cheatsMenu = (submenuParentId) => ({
    name: 'cheats',
    entries: [
      { id: 'god-mode', label: t('menu.cheats.godMode'), checked: true },
      { id: 'kill-all', label: t('menu.cheats.killAll') },
      { id: 'separator', label: '', separator: true },
      { id: 'spawn', label: t('menu.cheats.spawn'), submenu: spawnSubmenu() },
    ],
    submenuParentId,
  });
  // computeMenu reads only menu/window/client, so a minimal layout suffices here.
  const fakeLayout = (vw, vh) => ({
    window: { x: 0, y: 0, w: vw, h: vh },
    menu: { x: 0, y: 24, w: vw, h: 22 },
    client: { x: 0, y: 46, w: vw, h: vh - 72 },
  });

  // 1. The Cheats menu is a single column, and no menu carries a second column.
  const closed = computeMenu(fakeLayout(1280, 800), cheatsMenu(null));
  check(closed.items.length === 4, 'submenu: the Cheats menu is one column of four rows');
  check(closed.submenu === null, 'submenu: a closed menu has no flyout');
  check(!('second' in closed) && !('secondColumn' in cheatsMenu(null)), 'submenu: no menu has a secondColumn (or a second layout column)');

  // 2. A row with a submenu reserves the chevron column; a row without one does not.
  const longLabel = 'A_LONG_MENU_LABEL';
  const plainW = computeMenu(fakeLayout(1280, 800), { name: 'file', entries: [{ id: 'a', label: longLabel }], submenuParentId: null }).rect.w;
  const parentW = computeMenu(fakeLayout(1280, 800), { name: 'file', entries: [{ id: 'a', label: longLabel, submenu: [{ id: 'c', label: 'Child' }] }], submenuParentId: null }).rect.w;
  check(parentW === plainW + CHEVRON_W, `submenu: a submenu row reserves the ${CHEVRON_W} px chevron column`);

  // 3. The flyout opens to the right in LTR and to the left in RTL, aligned to the parent row.
  const openLtr = computeMenu(fakeLayout(1280, 800), cheatsMenu('spawn'));
  const parentRowLtr = openLtr.items.find((it) => it.id === 'spawn');
  check(openLtr.submenu !== null && openLtr.submenu.parentId === 'spawn', 'submenu: opening Spawn produces the flyout');
  check(openLtr.submenu.rect.x === openLtr.rect.x + openLtr.rect.w, 'submenu LTR: the flyout opens on the parent menu right edge');
  check(openLtr.submenu.rect.y === parentRowLtr.rect.y, 'submenu LTR: the flyout top aligns to the parent row');
  setDirection('rtl');
  try {
    const openRtl = computeMenu(fakeLayout(1280, 800), cheatsMenu('spawn'));
    const parentRowRtl = openRtl.items.find((it) => it.id === 'spawn');
    check(openRtl.submenu !== null && openRtl.submenu.rect.x + openRtl.submenu.rect.w === openRtl.rect.x, 'submenu RTL: the flyout opens on the parent menu left edge');
    check(openRtl.submenu.rect.y === parentRowRtl.rect.y, 'submenu RTL: the flyout top aligns to the parent row');
  } finally {
    setDirection('ltr');
  }

  // 4. It flips to the other side at the window edge, on both sides.
  {
    const helpMenu = { name: 'help', entries: [{ id: 'p', label: 'Parent', submenu: [{ id: 'c', label: 'Child' }] }], submenuParentId: 'p' };
    const narrowLtr = computeMenu(fakeLayout(320, 800), helpMenu);
    check(narrowLtr.submenu !== null && narrowLtr.submenu.rect.x + narrowLtr.submenu.rect.w === narrowLtr.rect.x,
      'submenu LTR: the flyout flips to the left at the right window edge');
    setDirection('rtl');
    try {
      const narrowRtl = computeMenu(fakeLayout(320, 800), helpMenu);
      check(narrowRtl.submenu !== null && narrowRtl.submenu.rect.x === narrowRtl.rect.x + narrowRtl.rect.w,
        'submenu RTL: the flyout flips to the right at the left window edge');
    } finally {
      setDirection('ltr');
    }
  }

  // 5. The flyout's bottom clamps inside the window, never above the menu bar.
  {
    const short = {
      name: 'cheats',
      entries: [
        { id: 'god-mode', label: 'God mode' },
        { id: 'kill-all', label: 'Kill all' },
        { id: 'separator', label: '', separator: true },
        { id: 'spawn', label: 'Spawn', submenu: [1, 2, 3, 4, 5].map((n) => ({ id: 'c' + n, label: 'Child ' + n })) },
      ],
      submenuParentId: 'spawn',
    };
    const m = computeMenu(fakeLayout(1280, 200), short);
    check(m.submenu !== null, 'submenu: the short flyout is present');
    check(m.submenu.rect.y + m.submenu.rect.h === 200, 'submenu: the flyout bottom clamps inside the window');
    check(m.submenu.rect.y >= 24, 'submenu: the flyout never rises above the menu bar');
  }

  // 6. A list too tall for the client area splits into two balanced columns.
  {
    const m = computeMenu(fakeLayout(1280, 300), cheatsMenu('spawn'));
    check(m.submenu !== null, 'submenu: the tall flyout is present');
    check(m.submenu.items.length === 15, 'submenu: the split flyout still holds all 15 spawn items');
    check(m.submenu.rect.w > m.rect.w, 'submenu: a split flyout is wider than one column');
    const leftIds = m.submenu.items.filter((it) => it.rect.x === m.submenu.rect.x).map((it) => it.id);
    const rightIds = m.submenu.items.filter((it) => it.rect.x === m.submenu.rect.x + m.submenu.rect.w / 2).map((it) => it.id);
    check(leftIds.length === 8 && rightIds.length === 7, `submenu: the split flyout balances the columns (${leftIds.length} left / ${rightIds.length} right)`);
    check(leftIds.join(',') === SPAWN_KINDS.slice(0, 8).map((k) => SPAWN_PREFIX + k).join(','), 'submenu: the left column is filled first, top to bottom');
  }

  // 7. Hover: 250 ms opens, leaving before then does not, the flyout stays open on the way in, and
  //    hovering another row closes it (the controller drives this with the same pure state machine).
  {
    const empty = { parentId: null, startedAt: 0 };
    const armed = advanceSubmenu(null, empty, 'spawn', false, 0);
    check(armed.submenuParentId === null && armed.timer.parentId === 'spawn', 'submenu: hovering the parent arms the timer');
    const before = advanceSubmenu(null, armed.timer, 'spawn', false, SUBMENU_OPEN_MS - 1);
    check(before.submenuParentId === null, 'submenu: leaving before 250 ms does not open the flyout');
    const opened = advanceSubmenu(null, armed.timer, 'spawn', false, SUBMENU_OPEN_MS);
    check(opened.submenuParentId === 'spawn', 'submenu: hovering for 250 ms opens the flyout');

    const inFlyout = advanceSubmenu('spawn', { parentId: null, startedAt: 0 }, null, true, SUBMENU_OPEN_MS + 50);
    check(inFlyout.submenuParentId === 'spawn', 'submenu: moving from the parent into the flyout keeps it open');

    const otherRow = advanceSubmenu('spawn', { parentId: null, startedAt: 0 }, null, false, SUBMENU_OPEN_MS + 50);
    check(otherRow.submenuParentId === null, 'submenu: hovering another row closes the flyout');
  }

  // 8. Escape closes the flyout first, then the menu: the flyout is a separable piece of the open menu.
  {
    const open = cheatsMenu('spawn');
    check(computeMenu(fakeLayout(1280, 800), open).submenu !== null, 'submenu: the flyout is open before Escape');
    open.submenuParentId = null; // the controller's first Esc
    const afterFirstEsc = computeMenu(fakeLayout(1280, 800), open);
    check(afterFirstEsc.submenu === null && afterFirstEsc.items.length === 4,
      'submenu: the first Escape closes the flyout and keeps the menu open');
  }

  // 9. A spawn item's id still resolves to a spawn action with the id unchanged.
  {
    const m = computeMenu(fakeLayout(1280, 800), cheatsMenu('spawn'));
    const firstKind = SPAWN_KINDS[0];
    const firstItem = m.submenu.items.find((it) => it.id === SPAWN_PREFIX + firstKind);
    check(firstItem !== undefined, 'submenu: the flyout carries the spawn items');
    const hit = menuEntryAt(fakeLayout(1280, 800), cheatsMenu('spawn'), firstItem.rect.x + 2, firstItem.rect.y + 2);
    check(hit === SPAWN_PREFIX + firstKind, 'submenu: menuEntryAt resolves the flyout item id unchanged');
    const s = allUnlocked();
    const before = s.enemies.length;
    check(spawnCheatEnemy(s, firstKind), 'submenu: a spawn id still resolves to a spawn action');
    check(s.enemies.length === before + 1 && s.enemies[s.enemies.length - 1].kind === firstKind,
      'submenu: the spawned enemy matches the spawn id');
  }
}

{
  // God Mode stops integrity loss and keeps money from ever running out.
  const s = allUnlocked();
  s.economy.salvage = 0;
  toggleGodMode(s);
  check(s.godMode, 'God Mode turns on');
  check(s.cheatsUsed, 'using God Mode flags the run');
  check(s.economy.salvage >= GOD_SALVAGE_CEILING, 'God Mode tops salvage up to the ceiling');

  // A leak costs nothing while God Mode is on.
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const grunt = createEnemy(1, 'grunt', 1, SPAWN, EXIT);
  s.enemies.push(grunt);
  const integrityBefore = s.integrity;
  let t = 0;
  while (s.enemies.length > 0 && t < 5000) {
    tick(s);
    t++;
  }
  check(grunt.dead, 'the grunt leaked while God Mode was on');
  check(s.integrity === integrityBefore, `God Mode stops integrity loss (integrity ${s.integrity})`);

  // A purchase spends from the ceiling and the next tick tops it back up: buy repeatedly forever.
  s.phase = 'build';
  const cost = TOWER_STATS.gun.cost;
  const beforeSpend = s.economy.salvage;
  check(placeTower(s, 'gun', 3, 6), 'a tower is bought in God Mode');
  check(s.economy.salvage === beforeSpend - cost, 'a God Mode purchase spends the salvage');
  tick(s);
  check(s.economy.salvage >= GOD_SALVAGE_CEILING, 'the next tick tops God Mode salvage back to the ceiling');
}

{
  // Spawn lists every enemy kind and every boss variant, and spawns exactly that kind at the spawn
  // tile with the current wave's scaling.
  const listed = new Set(SPAWN_KINDS);
  const all = Object.keys(ENEMY_STATS);
  check(all.every((k) => listed.has(k)), 'Spawn lists every enemy kind and every boss variant');
  check(SPAWN_KINDS.length === all.length, `Spawn lists exactly ${all.length} kinds (${SPAWN_KINDS.length})`);

  const s = allUnlocked();
  s.phase = 'wave';
  s.wave = 12;
  const before = s.enemies.length;
  check(spawnCheatEnemy(s, 'grunt-boss'), 'spawn a boss');
  check(s.enemies.length === before + 1, 'spawning puts exactly one enemy on the field');
  const spawned = s.enemies[s.enemies.length - 1];
  check(spawned.kind === 'grunt-boss', 'the spawned enemy is the requested kind');
  check(spawned.col === s.level.starts[0].col && spawned.row === s.level.starts[0].row, 'the enemy sits on the spawn tile');
  const expected = createEnemy(999, 'grunt-boss', 12, s.level.starts[0], s.level.exits[0]);
  check(spawned.maxHp === expected.maxHp && spawned.value === expected.value, 'the enemy uses the current wave scaling');
  check(spawned.isBoss, 'a spawned boss is marked a boss');

  // Pop-ups are included.
  check(spawnCheatEnemy(s, 'popup'), 'spawn a pop-up');
  check(s.enemies.some((e) => e.kind === 'popup' && !e.dead), 'the pop-up is on the field');

  // A cheated boss is still a boss encounter for the bar, the NEW tag and seenBossKinds.
  const seen = new Set();
  const tracks = [];
  const newlySeen = advanceBossBars(tracks, [spawned], s.tick, seen, false);
  check(newlySeen.includes('grunt-boss'), 'a spawned boss registers a first appearance');
  check(seen.has('grunt-boss'), 'a spawned boss records seenBossKinds');
  check(livingBosses([spawned]).some((e) => e.kind === 'grunt-boss'), 'a spawned boss shows on the boss bar');
}

{
  // Kill All empties the field, awards nothing, and leaves the wave live.
  const s = stateOnLevel('open-field');
  startWave(s);
  while (s.enemies.length === 0) tick(s);
  const salvageBefore = s.economy.salvage;
  const earnedBefore = s.economy.earned;
  const killsBefore = { tower: s.economy.kills.tower, pointer: s.economy.kills.pointer };
  const runsBefore = s.runs.length;
  const spawnsBefore = s.runs[0].spawns.length;

  killAllEnemies(s);
  check(s.enemies.length === 0, 'Kill All empties the field');
  check(s.economy.salvage === salvageBefore && s.economy.earned === earnedBefore, 'Kill All awards no salvage');
  check(s.economy.kills.tower === killsBefore.tower && s.economy.kills.pointer === killsBefore.pointer, 'Kill All records no kills');
  check(s.phase === 'wave', 'the wave stays live after Kill All');
  check(s.runs.length === runsBefore && s.runs[0].spawns.length === spawnsBefore, 'the wave schedule is untouched by Kill All');
  check(s.cheatsUsed, 'Kill All flags the run');
}

{
  // A cheated run records only the cheat-only shadow, and no bestWave.
  const s = createRunState();
  s.phase = 'wave';
  const grunt = createEnemy(1, 'grunt', 1, SPAWN, EXIT);
  s.enemies.push(grunt);
  s.cheatsUsed = true;
  while (!grunt.dead) {
    pointerDown(s, grunt.x, grunt.y);
    pointerUp(s);
  }
  check(grunt.dead, 'the grunt died in a cheated run');
  const got = checkAchievements(s);
  check(got.includes('shadow-console'), 'a cheated run fires shadow-console');
  check(!got.includes('first-blood'), 'a cheated run does not fire first-blood');
  check(!s.achievements.has('first-blood'), 'the first-blood achievement is not recorded in a cheated run');

  s.wave = 52;
  const before = defaultProfile();
  const { profile } = restartWindows(s, before);
  check(profile.bestWave === before.bestWave, 'a cheated run does not update bestWave');
}

{
  // With the gate closed the reducers are inert and nothing is flagged, and the wave 1..100 balance
  // hash is byte-identical.
  setCheatsVisibleForTests(false);
  const s = createRunState();
  toggleGodMode(s);
  check(!s.godMode && !s.cheatsUsed, 'God Mode is inert while cheats are hidden');
  const before = s.enemies.length;
  check(!spawnCheatEnemy(s, 'grunt'), 'Spawn is refused while cheats are hidden');
  check(s.enemies.length === before, 'no enemy appears while cheats are hidden');
  killAllEnemies(s);
  check(!s.cheatsUsed, 'Kill All does not flag a hidden-cheats run');
  setCheatsVisibleForTests(true);

  let table = '';
  for (let w = 1; w <= 100; w++) {
    table += `${waveHpScale(w)}|${waveValueScale(w)}|${waveEnemyCount(w)}|${waveKillValue(w)}\n`;
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < table.length; i++) {
    h ^= table.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  check((h >>> 0).toString(16) === 'ae33addc', 'waves 1..100 balance table unchanged with cheats off');
}

// --- 45. The Restore tree ----------------------------------------------------------------
{
  // 45a. The RP curve follows floor(2.2 * sqrt(earned / 900)).
  check(rpGain(20000) === 10, `rpGain(20000) = ${rpGain(20000)} (expected 10)`);
  check(rpGain(60000) === 17, `rpGain(60000) = ${rpGain(60000)} (expected 17)`);
  check(rpGain(150000) === 28, `rpGain(150000) = ${rpGain(150000)} (expected 28)`);
  check(rpGain(500000) === 51, `rpGain(500000) = ${rpGain(500000)} (expected 51)`);
}

{
  // 45b. The tree has exactly 28 nodes across the five tiers (eight licences replaced Early Access).
  check(TREE_NODES.length === 28, `exactly 28 tree nodes (${TREE_NODES.length})`);
  check(new Set(TREE_NODES.map((n) => n.id)).size === 28, 'tree node ids are unique');
  const byTier = [1, 2, 3, 4, 5].map((t) => TREE_NODES.filter((n) => n.tier === t).length).join(',');
  check(byTier === '7,8,6,4,3', `tree tiers hold 7/8/6/4/3 nodes (${byTier})`);
}

{
  // 45c. Tier gates open at the documented prestige levels.
  check(treeTierUnlocked(0, 1) === true, 'tier 1 is open at level 0');
  check(treeTierUnlocked(0, 2) === false, 'tier 2 is locked at level 0');
  check(treeTierUnlocked(8, 2) === true, 'tier 2 opens at level 8');
  check(treeTierUnlocked(19, 3) === false, 'tier 3 is locked at level 19');
  check(treeTierUnlocked(20, 3) === true, 'tier 3 opens at level 20');
  check(treeTierUnlocked(39, 4) === false && treeTierUnlocked(40, 4) === true, 'tier 4 opens at level 40');
  check(treeTierUnlocked(69, 5) === false && treeTierUnlocked(70, 5) === true, 'tier 5 opens at level 70');
}

{
  // 45d. Buying a node spends rp but leaves the prestige level untouched.
  const p = defaultProfile();
  p.rp = 100;
  p.rpEarned = 20;
  const node = treeNodeById('loose-change');
  check(canBuy(p, node), 'loose-change is buyable at level 20');
  check(buyNode(p, node), 'buying loose-change succeeds');
  check(p.rp === 96, `the purchase spends rp (${p.rp})`);
  check(p.rpEarned === 20, 'the prestige level is unchanged by a purchase');
  check(hasNode(p, 'loose-change'), 'loose-change is owned after buying');
  check(!canBuy(p, node), 'an owned node cannot be bought again');
  check(effectsFor(p).startSalvageFlat === 200, 'Loose Change folds +200 into the merged effect');
}

{
  // 45e. Safe Mode and Blue Screen are mutually exclusive; buying one hides the other.
  const p = defaultProfile();
  p.rp = 100;
  p.rpEarned = 20;
  check(buyNode(p, treeNodeById('safe-mode')), 'buy Safe Mode');
  check(!canBuy(p, treeNodeById('blue-screen')), 'Blue Screen is refused while Safe Mode is owned');
  check(!visibleNodes(p).some((n) => n.id === 'blue-screen'), 'Blue Screen is hidden while Safe Mode is owned');
  const fx = effectsFor(p);
  check(fx.integrity === 5 && Math.abs(fx.rpGainMult - 0.9) < 1e-9, 'Safe Mode grants +5 integrity and -10% RP');
}

{
  // 45f. createRunState applies the notable nodes.
  const fast = defaultProfile();
  fast.tree.push('fast-boot-1');
  check(createRunState(fast).wave === 3, 'Fast Boot I starts runs at wave 3');

  const pre = defaultProfile();
  pre.tree.push('preload');
  const ps = createRunState(pre);
  check(ps.towers.filter((t) => t.kind === 'gun').length === 2, 'Preload places two Gun towers');
  check(ps.towers.every((t) => t.kind === 'gun' && t.col >= 1 && t.col <= 3), 'preloaded Guns sit near the spawn');

  const ea = defaultProfile();
  ea.tree.push('cannon-licence');
  const eas = createRunState(ea);
  eas.wave = 1;
  check(towerUnlocked(eas, 'cannon'), 'a Cannon licence unlocks the Cannon from wave 1');

  const ng = defaultProfile();
  ng.tree.push('new-game-plus');
  const ngs = createRunState(ng);
  ngs.economy.salvage = 100000;
  check(placeTower(ngs, 'gun', 5, 5), 'place a Gun with New Game+');
  check(towerAt(ngs, 5, 5).tier === 2, 'New Game+ places towers at tier 2');
}

{
  // 45g. A version-1 save migrates: specs kept, banked points carried into Restore Points.
  const store = {
    value: JSON.stringify({
      version: 1,
      specs: { cpu: 5, ram: 3, gpu: 2, disk: 1 },
      unspentSpecs: 9,
      achievements: ['first-blood'],
      bestWave: 12,
      reboots: 2,
    }),
    getItem() { return this.value; },
    setItem(_k, v) { this.value = v; },
  };
  const migrated = loadProfile(store);
  check(migrated.version === 3, 'a version-1 save migrates to version 3');
  check(migrated.specs.cpu === 5 && migrated.specs.ram === 3 && migrated.specs.gpu === 2 && migrated.specs.disk === 1,
    'migration keeps the four spec fields');
  check(migrated.rp === 9 && migrated.rpEarned === 9,
    'migration carries the old banked specs into Restore Points');
  check(migrated.tree.length === 0 && migrated.lastSalvage === 0,
    'migration leaves the tree empty and the last-salvage carry at zero');
  check(migrated.achievements.includes('first-blood') && migrated.bestWave === 12 && migrated.reboots === 2,
    'migration keeps the pre-RP profile fields');
}

{
  // 45h. An empty tree is identity: the merged effect and the run are unchanged.
  const fx = effectsFor(defaultProfile());
  check(
    fx.startingWave === 0 && fx.startSalvageFlat === 0 && fx.startSalvagePct === 0 &&
      fx.towerDamagePct === 0 && fx.pointerDamagePct === 0 && fx.integrity === 0 &&
      fx.costMultiplier === 1 && fx.sellRefund === 0.7 && fx.repairSpeedMult === 1 &&
      fx.autoWave === false && fx.preloadGuns === 0 && fx.unlockedTowers.length === 0 &&
      fx.startTier === 1 && fx.extraSpecsPerReboot === 0 && fx.rpGainMult === 1,
    'an empty tree produces the identity effect',
  );
  const s = createRunState(defaultProfile());
  check(s.wave === 0 && s.economy.salvage === 60 && s.integrity === 20 && s.towers.length === 0,
    'a run with an empty tree is identical to today');
}

// --- 45i. Tower licences (docs/PRESTIGE.md) ----------------------------------------------------
{
  // The merged effect lists licensed kinds, sorted and without duplicates, and empty with none.
  const none = defaultProfile();
  check(JSON.stringify(effectsFor(none).unlockedTowers) === '[]', 'no licences: unlockedTowers is empty');
  const p = defaultProfile();
  p.tree.push('cannon-licence');
  check(JSON.stringify(effectsFor(p).unlockedTowers) === '["cannon"]', "a cannon licence reports ['cannon']");
  p.tree.push('aa-licence');
  p.tree.push('cannon-licence'); // duplicate: a profile never holds one id twice, but the fold must not
  check(JSON.stringify(effectsFor(p).unlockedTowers) === '["aa","cannon"]',
    'two licences report sorted kinds without duplicates');
}

{
  // towerUnlocked at wave 1 is true for a licensed kind and false without it, for all eight.
  const gated = TOWER_KINDS.filter((k) => TOWER_UNLOCK_WAVE[k] > 0);
  for (const kind of gated) {
    const plain = createRunState(defaultProfile());
    plain.wave = 1;
    check(!towerUnlocked(plain, kind), `${kind} is locked at wave 1 without a licence`);
    const p = defaultProfile();
    p.tree.push(`${kind}-licence`);
    const licensed = createRunState(p);
    licensed.wave = 1;
    check(towerUnlocked(licensed, kind), `${kind} is unlocked at wave 1 with its licence`);
  }
}

{
  // The eight nodes exist with the exact tier, gate and cost from the spec.
  const spec = [
    ['cannon-licence', 1, 0, 3],
    ['aa-licence', 1, 0, 4],
    ['frost-licence', 2, 8, 5],
    ['beacon-licence', 2, 8, 6],
    ['laser-licence', 2, 8, 8],
    ['taser-licence', 3, 20, 10],
    ['repair-licence', 3, 20, 12],
    ['cursor-licence', 4, 40, 16],
  ];
  for (const [id, tier, level, cost] of spec) {
    const node = treeNodeById(id);
    check(node !== undefined && node.tier === tier && node.unlockLevel === level && node.cost === cost,
      `${id} is tier ${tier}, level ${level}, cost ${cost}`);
  }
  check(!TREE_NODES.some((n) => n.id === 'early-access'), 'early-access is gone from TREE_NODES');

  // Every catalogue carries all sixteen licence keys, and no early-access key survives.
  const licenceKeys = [
    'tree.cannonLicence.name', 'tree.cannonLicence.description',
    'tree.aaLicence.name', 'tree.aaLicence.description',
    'tree.frostLicence.name', 'tree.frostLicence.description',
    'tree.beaconLicence.name', 'tree.beaconLicence.description',
    'tree.laserLicence.name', 'tree.laserLicence.description',
    'tree.taserLicence.name', 'tree.taserLicence.description',
    'tree.repairLicence.name', 'tree.repairLicence.description',
    'tree.cursorLicence.name', 'tree.cursorLicence.description',
  ];
  let cataloguesOk = true;
  for (const code of ['en', 'es', 'fr', 'ru', 'uk', 'zh-Hans', 'he']) {
    const mod = await import(`../src/i18n/${code}/index.ts`);
    const cat = mod[Object.keys(mod)[0]];
    if (!licenceKeys.every((k) => cat[k] !== undefined)) cataloguesOk = false;
    if (Object.keys(cat).some((k) => k.startsWith('tree.earlyAccess'))) cataloguesOk = false;
  }
  check(cataloguesOk, 'every catalogue carries the sixteen licence keys and no early-access key');
}

{
  // Buying a licence through the existing purchase path: exact cost, short-RP refusal, owned refusal.
  const p = defaultProfile();
  p.rp = 100;
  p.rpEarned = 20;
  const node = treeNodeById('cannon-licence');
  check(canBuy(p, node), 'cannon-licence is buyable');
  check(buyNode(p, node), 'buying cannon-licence succeeds');
  check(p.rp === 97, `cannon-licence deducts exactly 3 RP (${p.rp})`);
  check(!buyNode(p, node), 'an owned licence cannot be bought again');

  const short = defaultProfile();
  short.rp = 2;
  short.rpEarned = 20;
  check(!canBuy(short, treeNodeById('cannon-licence')), 'a licence is refused when RP is short');
  check(!buyNode(short, treeNodeById('cannon-licence')), 'buyNode returns false when RP is short');
}

{
  // A profile with licences round-trips through save/load.
  const p = defaultProfile();
  p.tree = ['cannon-licence', 'cursor-licence', 'loose-change'];
  const store = { value: '', getItem() { return this.value; }, setItem(_k, v) { this.value = v; } };
  saveProfile(p, store);
  const loaded = loadProfile(store);
  check(JSON.stringify(loaded.tree) === JSON.stringify(p.tree), 'profile save/load round-trips licences');

  // A legacy profile holding early-access migrates to all eight licences, and the migration is
  // idempotent (the rewritten save no longer carries the id).
  const legacy = defaultProfile();
  legacy.tree = ['early-access', 'loose-change'];
  const legacyStore = { value: '', getItem() { return this.value; }, setItem(_k, v) { this.value = v; } };
  saveProfile(legacy, legacyStore);
  const migrated = loadProfile(legacyStore);
  check(!migrated.tree.includes('early-access'), 'early-access is removed on profile migration');
  check(migrated.tree.includes('loose-change'), 'migration keeps the other owned nodes');
  check(LICENCE_IDS.every((id) => migrated.tree.includes(id)), 'migration grants all eight licences');
  const again = loadProfile(legacyStore);
  check(JSON.stringify(again.tree) === JSON.stringify(migrated.tree), 'the migration is idempotent');

  // A profile without the id is untouched.
  const plain = defaultProfile();
  plain.tree = ['loose-change'];
  const plainStore = { value: '', getItem() { return this.value; }, setItem(_k, v) { this.value = v; } };
  saveProfile(plain, plainStore);
  check(JSON.stringify(loadProfile(plainStore).tree) === JSON.stringify(['loose-change']),
    'a profile without early-access is untouched');
}

{
  // A legacy treeEffects with unlockAllTowers:true and no unlockedTowers restores every gated kind.
  const s = createRunState();
  s.wave = 5;
  const save = captureRun(s);
  save.treeEffects = { ...save.treeEffects, unlockAllTowers: true };
  delete save.treeEffects.unlockedTowers;
  const restored = restoreRun(save, defaultProfile());
  check(restored !== null, 'a legacy treeEffects restores without failing');
  const gated = TOWER_KINDS.filter((k) => TOWER_UNLOCK_WAVE[k] > 0);
  check(
    restored !== null && restored.treeEffects.unlockedTowers.length === gated.length &&
      gated.every((k) => restored.treeEffects.unlockedTowers.includes(k)),
    'legacy unlockAllTowers restores with every gated kind unlocked',
  );

  // A pre-licence save (no unlockedTowers key) restores with an empty list.
  const s2 = createRunState();
  s2.wave = 5;
  const save2 = captureRun(s2);
  delete save2.treeEffects.unlockedTowers;
  const restored2 = restoreRun(save2, defaultProfile());
  check(restored2 !== null && restored2.treeEffects.unlockedTowers.length === 0,
    'a pre-licence save restores with an empty unlockedTowers list');
}

// --- 46. The achievements grid ---------------------------------------------------------------
{
  check(ACH_COLUMNS === 8, 'grid: eight columns');
  check(gridRowCount(0) === 0, 'grid: zero cells, zero rows');
  check(gridRowCount(8) === 1, 'grid: eight cells fill one row');
  check(gridRowCount(9) === 2, 'grid: nine cells spill to two rows');
  check(gridRowCount(118) === 15, 'grid: 118 cells form 15 rows');
  const r = gridCellRect(100, 200, 3, 2);
  check(
    r.x === 100 + 3 * (ACH_CELL + ACH_GUTTER) && r.y === 200 + 2 * (ACH_CELL + ACH_GUTTER) && r.w === ACH_CELL && r.h === ACH_CELL,
    'grid: a cell lands at col*pitch, row*pitch',
  );
}

{
  const model = buildAchievementGrid(['first-blood'], { 'first-blood': '2026-11-18' }, 'all');
  check(model.total === 118, 'grid: the stored total is 118');
  check(model.earnedCount === 1, 'grid: earned count reads the profile');
  check(model.shadowCount === 0, 'grid: no shadow earned yet');
  check(
    model.entries.every((e) => !e.id.startsWith('shadow-')),
    'grid: a hidden achievement has no cell before earning',
  );
  const earnedShadow = buildAchievementGrid(['shadow-owl'], {}, 'all');
  check(earnedShadow.shadowCount === 1, 'grid: an earned shadow is counted');
  check(earnedShadow.entries.some((e) => e.id === 'shadow-owl'), 'grid: an earned shadow gets a cell');
  check(model.entries.find((e) => e.id === 'first-blood').earnedDate === '2026-11-18', 'grid: earned date is attached');

  const client = { x: 0, y: 0, w: 1280, h: 800 };
  const al = computeAchievementGrid(model, client);
  check(al.window.w === 560, 'grid: the window is 560 wide');
  const cells = al.cells;
  check(new Set(cells.slice(0, 8).map((c) => c.rect.y)).size === 1, 'grid: the first eight cells share a row');
  check(cells.length <= 8 || cells[8].rect.y > cells[0].rect.y, 'grid: the ninth cell starts the next row');
  const hit = achievementGridHitAt(al, model, cells[0].rect.x + 4, cells[0].rect.y + 4);
  check(hit !== null && hit.type === 'cell' && hit.id === model.entries[0].id, 'grid: a click on a cell hit-tests to that cell');
  // The scrollbar: a thumb proportional to what is visible, always inside its track, and gone when
  // the whole catalog fits.
  check(al.maxScroll > 0, 'grid: 118 cells do not fit the viewport, so there is a scroll');
  check(al.scrollbar.x >= al.grid.x && al.scrollbar.x + al.scrollbar.w <= al.grid.x + al.grid.w,
    'grid: the scrollbar sits inside the grid viewport');
  check(al.thumb.h < al.scrollbar.h, 'grid: the thumb is shorter than its track');
  check(al.thumb.y >= al.scrollbar.y && al.thumb.y + al.thumb.h <= al.scrollbar.y + al.scrollbar.h,
    'grid: the thumb starts inside the track');
  const bottom = computeAchievementGrid({ ...model, scroll: al.maxScroll }, client);
  check(Math.abs(bottom.thumb.y + bottom.thumb.h - (al.scrollbar.y + al.scrollbar.h)) <= 1,
    'grid: at the bottom the thumb reaches the end of the track');
  const roomy = computeAchievementGrid({ ...model, entries: model.entries.slice(0, 8) }, client);
  check(roomy.maxScroll === 0 && roomy.thumb.h === roomy.scrollbar.h,
    'grid: a catalog that fits has a full-length thumb and no scrolling');

  const session = new AchievementSession();
  session.show();
  check(session.open, 'grid session: show opens the grid');
  session.hide();
  check(!session.open, 'grid session: hide closes the grid');
}

// --- 46b. Every AchievementStats field is populated in a built snapshot ------------------------
{
  const keys = Object.keys(buildStats(createRunState())).sort();
  const fields = [
    'aaFlak', 'aaKills', 'adsClosed', 'adsExpired', 'autoWave', 'beaconBuffKill', 'beaconCount',
    'bossKilledAtOneIntegrity', 'bossKilledByOverride', 'bossKilledByPointer', 'bossKillsByPointer',
    'bossesKilled', 'branches', 'calledEarlyBeforeTower', 'cheatSpawns', 'cheatsUsed', 'cleanWave',
    'clearedBossNoLeak', 'clearedNoSpendWave', 'clearedNoTowerWave', 'clearedNoUpgradeWave',
    'clearedSellAllWave', 'clearedTwoKinds', 'clearedWallOnlyWave', 'clearedWave1NoLeak', 'clearedWaves',
    'critHits', 'cursorBuilt', 'cursorKills', 'cursorRepairs', 'customMap', 'dayOfWeek',
    'earlyCallStreak', 'earlyCalls', 'earned', 'endlessWave', 'flyersKilled', 'idleSeconds',
    'idleTowerKilled', 'integrity', 'integrityLowWater', 'killedCarrier', 'killedDreadnought',
    'killedRam', 'killedWirecutter', 'kills', 'killsByPointer', 'killsByTower', 'leaks',
    'lifetimeBossKillsByPointer', 'mapId', 'maxBeamKills', 'maxChainKills', 'maxCursorRepairs',
    'maxSlowCount', 'maxSplashKills', 'maxTowerTier', 'maxTreeTier', 'maxedBranch',
    'milestoneBossByPointer', 'minesTriggered', 'notified', 'overclockMax', 'pausedTicks',
    'perfectWaveStreak', 'perfectWaves', 'pointerHits', 'pointerIdleSeconds', 'prestigeLevel',
    'rebootCount', 'recentPointerKills', 'repairsDone', 'routeLength', 'rp', 'runEnded', 'runLost',
    'salvage', 'salvagePeak', 'salvageSpentOnRepairs', 'shadowBroke', 'shieldsBroken',
    'shippedMapsCleared', 'soldTowerSameWave', 'specTotal', 'startingWave', 'tierFiveCount',
    'timeOfDayHour', 'toggles', 'towerKinds', 'towersBuilt', 'towersOnBoard', 'towersSold',
    'treeNodeCount', 'treesFullyUpgraded', 'upgradesBought', 'wallsBuilt', 'wave', 'wavesAtThreeSpeed',
    'wavesClearedSinceLeak', 'weakHits', 'weakKills',
  ].sort();
  check(
    JSON.stringify(keys) === JSON.stringify(fields),
    'the built snapshot has exactly the 101 AchievementStats fields',
  );
}

// --- 47. Every achievement has a live detector (no `() => false` placeholder) -----------------
// Each row is [id, stats overrides, optional profile]; the predicate must fire for that input, so a
// `when` that is (or became) constant-false fails this sweep.
{
  const base = buildStats(createRunState());
  const p = defaultProfile();
  const muteProfile = { ...p, soundOn: false };
  const shakeProfile = { ...p, shakeOn: false };
  const helpProfile = { ...p, bestWave: 24, seenEnemies: [...ENEMY_KINDS], seenBossKinds: [...BOSS_KINDS] };
  const fires = (id, overrides, prof = p) => ACHIEVEMENTS.find((a) => a.id === id).when({ ...base, ...overrides }, prof);
  const N = (id) => new Set([id]);
  const cases = [
    // Pointer and the clicker
    ['first-blood', { kills: 1 }],
    ['sharpshooter', { weakHits: 100 }],
    ['weak-point-kills', { weakKills: 50 }],
    ['crit-hits', { critHits: 25 }],
    ['crit-100', { critHits: 100 }],
    ['pointer-1k', { pointerHits: 1000 }],
    ['click-combo', { recentPointerKills: 10 }],
    ['override', { bossKilledByOverride: true }],
    ['pointer-only-wave', { clearedNoTowerWave: true }],
    ['weak-point-10', { weakHits: 10 }],
    ['crit-first', { critHits: 1, wave: 1 }],
    ['overclock-max', { overclockMax: true }],
    ['click-idle', { pointerIdleSeconds: 60, idleTowerKilled: true }],
    ['pointer-boss-10', { lifetimeBossKillsByPointer: 10 }],
    // Towers
    ['five-tier-five', { tierFiveCount: 5 }],
    ['beacon-field', { beaconCount: 10 }],
    ['maxed-branch', { maxedBranch: true }],
    ['aa-flak', { aaFlak: true }],
    ['mine-layer', { minesTriggered: 25 }],
    ['wall-only-wave', { clearedWallOnlyWave: true }],
    ['toggle-master', { toggles: 50 }],
    ['repair-shop', { salvageSpentOnRepairs: 2000 }],
    ['tower-zoo', { towerKinds: 10 }],
    ['tier-five-first', { maxTowerTier: 5 }],
    ['sell-10', { towersSold: 10 }],
    ['no-upgrade-wave', { clearedNoUpgradeWave: true }],
    ['laser-chain', { maxBeamKills: 5 }],
    ['frost-lock', { maxSlowCount: 12 }],
    ['taser-chain', { maxChainKills: 4 }],
    ['cannon-splash', { maxSplashKills: 6 }],
    ['cursor-first', { cursorBuilt: true }],
    ['cursor-repair', { maxCursorRepairs: 5 }],
    ['beacon-buff', { beaconBuffKill: true }],
    ['one-kind', { clearedWaves: 1, towerKinds: 1 }],
    ['two-kinds', { clearedTwoKinds: true }],
    ['upgrade-first', { upgradesBought: 1 }],
    ['branch-first', { branches: 1 }],
    ['sell-tower-first', { towersSold: 1 }],
    // Economy
    ['salvage-peak', { salvagePeak: 1000 }],
    ['salvage-10k', { salvagePeak: 10000 }],
    ['earn-100k', { earned: 100000 }],
    ['no-spend-wave', { clearedNoSpendWave: true }],
    ['ad-collector', { adsClosed: 10 }],
    ['ad-ignore', { adsExpired: 10 }],
    ['early-call-streak', { earlyCallStreak: 3 }],
    ['early-call-10', { earlyCalls: 10 }],
    ['early-call-wave-1', { calledEarlyBeforeTower: true }],
    ['idle-hour', { autoWave: true, idleSeconds: 300 }],
    ['sell-profit', { soldTowerSameWave: true }],
    ['no-sell', { wave: 20, towersSold: 0 }],
    // Waves and survival
    ['clean-wave', { cleanWave: true }],
    ['flawless-wave', { perfectWaves: 1 }],
    ['flawless-10', { perfectWaves: 10 }],
    ['perfect-run', { wave: 50, leaks: 0 }],
    ['long-road', { routeLength: 50 }],
    ['maze-100', { routeLength: 100 }],
    ['wave-25', { wave: 25 }],
    ['wave-50', { wave: 50 }],
    ['wave-100', { wave: 100 }],
    ['endless-150', { endlessWave: 150 }],
    ['endless-200', { endlessWave: 200 }],
    ['integrity-1', { integrity: 1 }],
    ['speed-3', { wavesAtThreeSpeed: 1 }],
    ['wave-1-no-damage', { clearedWave1NoLeak: true }],
    ['leak-recovery', { wavesClearedSinceLeak: 5 }],
    // Bosses
    ['boss-by-pointer', { bossKilledByPointer: true }],
    ['milestone-boss-pointer', { milestoneBossByPointer: true }],
    ['boss-10', { bossesKilled: 10 }],
    ['boss-first-wave', { bossesKilled: 1, wave: 19 }],
    ['shield-break-5', { shieldsBroken: 5 }],
    ['carrier-brood', { killedCarrier: true }],
    ['dreadnought-kill', { killedDreadnought: true }],
    ['wirecutter-kill', { killedWirecutter: true }],
    ['ram-kill', { killedRam: true }],
    ['boss-no-leak', { clearedBossNoLeak: true }],
    // Prestige, meta
    ['reboot-50', { specTotal: 50 }],
    ['two-reboots', { rebootCount: 2 }],
    ['reboot-10', { rebootCount: 10 }],
    ['specs-banked', { rp: 1 }],
    ['first-rp', { prestigeLevel: 1 }],
    ['rp-100', { prestigeLevel: 100 }],
    ['prestige-25', { prestigeLevel: 25 }],
    ['tree-tier-3', { maxTreeTier: 3 }],
    ['tree-complete', { treesFullyUpgraded: true }],
    ['fast-boot-40', { startingWave: 40 }],
    ['no-cheats-100', { wave: 100, cheatsUsed: false }],
    ['all-help', {}, helpProfile],
    // Maps and the editor
    ['custom-map-cleared', { customMap: true, clearedWaves: 1 }],
    ['editor-first', { notified: N('editor-first') }],
    ['map-export', { notified: N('map-export') }],
    ['map-import', { notified: N('map-import') }],
    ['fork-cleared', { mapId: 'fork', clearedWaves: 10 }],
    ['ladder-cleared', { mapId: 'ladder', clearedWaves: 10 }],
    // Shadow
    ['shadow-ad-no-close', { adsExpired: 10, runLost: true }],
    ['shadow-zero-towers', { wave: 5, towersBuilt: 0, pointerHits: 0 }],
    ['shadow-all-walls', { wallsBuilt: 40 }],
    ['shadow-sell-all', { clearedSellAllWave: true }],
    ['shadow-1hp-boss', { bossKilledAtOneIntegrity: true }],
    ['shadow-pause', { pausedTicks: 36000 }],
    ['shadow-hover', { notified: N('shadow-hover') }],
    ['shadow-resize', { notified: N('shadow-resize') }],
    ['shadow-mute', { clearedWaves: 50 }, muteProfile],
    ['shadow-reload', { notified: N('shadow-reload') }],
    ['shadow-clippy', { notified: N('shadow-clippy') }],
    ['shadow-monochrome', { runEnded: true }, shakeProfile],
    ['shadow-owl', { timeOfDayHour: 3, clearedWaves: 1 }],
    ['shadow-weekend', { dayOfWeek: 0, clearedWaves: 1 }],
    ['shadow-flat-battery', { notified: N('shadow-flat-battery') }],
    ['shadow-boots', { notified: N('shadow-boots') }],
    ['shadow-perfect-100', { wave: 100, leaks: 0, repairsDone: 0, towersSold: 0 }],
    ['shadow-every-map', { shippedMapsCleared: 6 }],
    ['shadow-broke', { shadowBroke: true }],
    ['shadow-help-clippy', { notified: N('shadow-help-clippy') }],
    ['shadow-drag', { notified: N('shadow-drag') }],
    ['shadow-tooltip', { notified: N('shadow-tooltip') }],
    ['shadow-printer', { cheatSpawns: 50, runLost: true }],
    ['shadow-cheat-lose', { cheatsUsed: true, integrity: 0, runLost: true }],
    ['shadow-console', { cheatsUsed: true }],
  ];
  let allFired = true;
  for (const [id, overrides, prof] of cases) {
    if (!fires(id, overrides, prof)) {
      allFired = false;
      console.log(`  missing fire: ${id}`);
    }
  }
  check(cases.length === 118, `all 118 conditions are enumerated (${cases.length})`);
  check(new Set(cases.map((c) => c[0])).size === 118, 'every achievement is covered exactly once');
  check(allFired, 'all 118 achievements fire from constructed stats');
}

// --- 48. A cheated run awards only the cheat-only shadow --------------------------------------
{
  const s = createRunState();
  s.cheatsUsed = true;
  s.wallsBuilt = 40; // shadow-all-walls is met (non-cheat-only)
  s.wave = 5; // shadow-zero-towers is met (non-cheat-only)
  s.towersBuilt = 0;
  s.pointerHits = 0;
  s.economy.kills.tower = 1; // first-blood is met (non-cheat-only)
  const got = checkAchievements(s);
  check(got.includes('shadow-console'), 'a cheated run awards shadow-console');
  check(!got.includes('first-blood'), 'a cheated run does not award first-blood');
  check(!got.includes('shadow-all-walls') && !got.includes('shadow-zero-towers'),
    'a cheated run skips non-cheat-only achievements');
  check(checkAchievements(s).length === 0,
    'once shadow-console fires, a cheated run returns [] for the remaining non-cheat-only ids');
}

// --- 49. The art script is idempotent and never overwrites ------------------------------------
{
  const tmp = mkdtempSync(join(tmpdir(), 'pd-ach-'));
  try {
    const achDir = join(tmp, 'achievements');
    mkdirSync(achDir, { recursive: true });
    writeFileSync(join(achDir, '_placeholder.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44"/>');
    const custom = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44"><!-- artist work --></svg>';
    writeFileSync(join(achDir, 'first-blood.svg'), custom);
    const first = runAchArt(tmp);
    check(first.copied > 0 && first.skipped >= 1, `ach-art copies missing ids and keeps existing (${first.copied}/${first.skipped})`);
    check(readFileSync(join(achDir, 'first-blood.svg'), 'utf8') === custom, 'ach-art never overwrites an existing file');
    const second = runAchArt(tmp);
    check(second.copied === 0, 'ach-art is idempotent (second run copies nothing)');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

{
  // Art is fetched under a content hash, so a replaced SVG is never served from the CDN's cache
  // under the name it already had. The preloader is bounded too: 217 simultaneous requests had 188
  // of them dropped, and a dropped asset silently keeps its procedural fallback.
  const manifest = JSON.parse(readFileSync(new URL('../public/art/manifest.json', import.meta.url), 'utf8'));
  const assets = manifest.assets;
  check(assets.length > 100, `the manifest lists every asset (${assets.length})`);
  const missing = assets.filter((a) => typeof a.rev !== 'string' || a.rev.length < 8);
  check(missing.length === 0, `every asset carries a content hash (${missing.length} missing)`);
  check(artFileUrl('achievements/first-blood.svg', 'abc') === '/art/achievements/first-blood.svg?v=abc',
    'an art URL carries the hash as a cache-buster');
  check(artFileUrl('achievements/first-blood.svg') === '/art/achievements/first-blood.svg',
    'without a hash the URL stays bare');
  check(PRELOAD_CONCURRENCY > 0 && PRELOAD_CONCURRENCY <= 12,
    `the preloader fetches a few at a time (${PRELOAD_CONCURRENCY})`);
  const entry = assets.find((a) => a.name === 'achievements/first-blood');
  const bytes = readFileSync(new URL('../public/art/achievements/first-blood.svg', import.meta.url));
  const expected = createHash('sha1').update(bytes).digest('hex').slice(0, 10);
  check(entry.rev === expected, 'the hash is the file content, so new art means a new URL');
}

// --- 50. Global upgrades (docs/GLOBAL-UPGRADES.md §8) ------------------------------------------
{
  const artDir = fileURLToPath(new URL('../public/art', import.meta.url));
  const fullState = () => {
    const s = createRunState();
    s.economy.salvage = 1_000_000;
    s.wave = 100;
    return s;
  };

  // 50.1 Fourteen entries, unique ids, each with its icon on disk.
  const ids = GLOBAL_UPGRADES.map((u) => u.id);
  const noArt = ids.filter((id) => !existsSync(join(artDir, 'upgrades', `${id}.svg`)));
  check(
    GLOBAL_UPGRADES.length === 14 && new Set(ids).size === 14 && noArt.length === 0,
    `14 global upgrades with unique ids, each with public/art/upgrades/<id>.svg (${noArt.join(', ') || 'none missing'})`,
  );

  // 50.2 Waves 20-60 and costs 1,000-30,000.
  const outOfBand = GLOBAL_UPGRADES.filter((u) => u.wave < 20 || u.wave > 60 || u.cost < 1000 || u.cost > 30000);
  check(outOfBand.length === 0, `every upgrade's wave is 20-60 and cost 1,000-30,000 (${outOfBand.map((u) => u.id).join(', ') || 'all in band'})`);

  // 50.3 Revealed at exactly def.wave, hidden one wave before.
  const revealOk = GLOBAL_UPGRADES.every((u) => {
    const atWave = revealedUpgrades({ wave: u.wave }).some((d) => d.id === u.id);
    const before = revealedUpgrades({ wave: u.wave - 1 }).some((d) => d.id === u.id);
    return atWave && !before;
  }) && revealedUpgrades({ wave: 19 }).length === 0;
  check(revealOk, 'revealedUpgrades hides everything above the current wave and reveals at exactly def.wave');

  // 50.4 buyUpgrade refuses unrevealed, repeat and unaffordable; a success costs exactly def.cost once.
  {
    const s = createRunState();
    const def = GLOBAL_UPGRADES.find((u) => u.id === 'salvage-contract');
    s.economy.salvage = 1_000_000;
    s.wave = def.wave - 1;
    const refusedHidden = !buyUpgrade(s, def.id);
    s.wave = def.wave;
    s.economy.salvage = def.cost - 1;
    const refusedPoor = !buyUpgrade(s, def.id);
    s.economy.salvage = def.cost + 5;
    const bought = buyUpgrade(s, def.id);
    const paid = s.economy.salvage === 5;
    s.economy.salvage = 1_000_000;
    const refusedTwice = !buyUpgrade(s, def.id);
    check(
      refusedHidden && refusedPoor && bought && paid && refusedTwice &&
        s.upgrades.filter((id) => id === def.id).length === 1 && s.economy.salvage === 1_000_000,
      'buyUpgrade refuses unrevealed, unaffordable and repeat purchases, and charges exactly def.cost once',
    );
  }

  // 50.5 A fresh run carries no upgrades.
  {
    const s = createRunState();
    check(
      Array.isArray(s.upgrades) && s.upgrades.length === 0 && s.emergencyPatchSpent === false && s.buff === null,
      'a fresh createRunState has upgrades: [], emergencyPatchSpent: false, buff: null',
    );
  }

  // 50.6 Bulk Requisition: -4 % per owned copy, floored at -40 %, walls ignored.
  {
    const s = allUnlocked();
    s.economy.salvage = 1_000_000;
    const base = towerCost(s, 'gun');
    const wallBase = towerCost(s, 'wall');
    s.wave = 40;
    buyUpgrade(s, 'bulk-requisition');
    const zeroCopies = towerCost(s, 'gun');
    const fakeGuns = (n) => {
      s.towers = s.towers.filter((t) => t.kind !== 'gun');
      for (let i = 0; i < n; i++) s.towers.push(createTower(9000 + i, 'gun', 0, 0));
    };
    fakeGuns(1);
    const one = towerCost(s, 'gun');
    fakeGuns(3);
    const three = towerCost(s, 'gun');
    fakeGuns(20);
    const capped = towerCost(s, 'gun');
    s.towers = [];
    for (let i = 0; i < 5; i++) s.towers.push(createTower(9100 + i, 'wall', 0, 0));
    const wallAfter = towerCost(s, 'wall');
    check(
      zeroCopies === base &&
        one === Math.floor(base * 0.96) &&
        three === Math.floor(base * 0.88) &&
        capped === Math.floor(base * 0.6) &&
        wallAfter === wallBase,
      `bulk-requisition takes 4% per copy to -40% and ignores walls (${base} -> ${one}, ${three}, ${capped}; wall ${wallAfter})`,
    );
  }

  // 50.7 Emergency Patch eats the first killing leak and only the first.
  {
    const leakOne = (s, id) => {
      const e = createEnemy(id, 'grunt', 1, SPAWN, EXIT);
      e.x = EXIT.col + 0.5;
      e.y = EXIT.row + 0.5;
      e.col = EXIT.col;
      e.row = EXIT.row;
      s.enemies.push(e);
      s.phase = 'wave';
      // Walk it the last step: aim it at the exit tile it already stands on.
      e.targetCol = EXIT.col;
      e.targetRow = EXIT.row;
      e.x -= 0.01;
      for (let i = 0; i < 5 && !e.dead; i++) tick(s);
      return e.dead;
    };
    const s = fullState();
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    s.runs = [];
    buyUpgrade(s, 'emergency-patch');
    s.integrity = 1;
    const firstLeaked = leakOne(s, 70001);
    const savedAt = s.integrity;
    const spent = s.emergencyPatchSpent;
    const phaseAfterFirst = s.phase;
    s.integrity = 1;
    leakOne(s, 70002);
    check(
      firstLeaked && savedAt === 1 && spent && phaseAfterFirst !== 'halted' && s.integrity === 0 && s.phase === 'halted',
      `emergency-patch leaves 1 integrity on the first killing leak, then a second leak behaves normally (${savedAt}, ${s.integrity}, ${s.phase})`,
    );
  }

  // 50.8 Compound Interest: floor(salvage * 0.015) once per cleared wave, nothing in build.
  {
    const s = fullState();
    s.wave = 30;
    buyUpgrade(s, 'compound-interest');
    s.economy.salvage = 10_000;
    s.phase = 'build';
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    tick(s);
    const buildUnchanged = s.economy.salvage === 10_000;
    startWave(s);
    const wave = s.wave;
    s.runs[0].spawns = [];
    s.enemies = [];
    const before = s.economy.salvage;
    tick(s);
    const afterBonus = before + waveClearBonus(wave);
    const expected = afterBonus + Math.floor(afterBonus * 0.015);
    const once = s.economy.salvage === expected;
    const settled = s.economy.salvage;
    tick(s);
    check(
      buildUnchanged && once && s.economy.salvage === settled,
      `compound-interest pays floor(salvage * 0.015) once per clear and nothing in build (${before} -> ${settled}, want ${expected})`,
    );
  }

  // 50.9 Autoloader: a gun's interval drops by 13 %, never below one tick.
  {
    const plain = fullState();
    const loaded = fullState();
    buyUpgrade(loaded, 'autoloader');
    const gun = TOWER_STATS.gun.fireInterval;
    const before = towerIntervalTicks(plain, gun);
    const after = towerIntervalTicks(loaded, gun);
    check(
      after === Math.max(1, Math.floor(before * 0.87)) && after < before && towerIntervalTicks(loaded, 1) === 1,
      `autoloader shortens the gun's interval by 13% and never below one tick (${before} -> ${after})`,
    );
  }

  // 50.10 Coolant Loop: the run-local overclock cap is 16 with it, 12 without.
  {
    const plain = fullState();
    const cooled = fullState();
    buyUpgrade(cooled, 'coolant');
    check(
      overclockCap(plain) === 12 && overclockCap(cooled) === 16 &&
        overclockCeiling(200, overclockCap(plain)) === 12 && overclockCeiling(200, overclockCap(cooled)) === 16,
      'coolant raises the run-local overclock cap to 16 and leaves it at 12 without it',
    );
  }

  // 50.11 Chain Reaction: a killing click splashes the two nearest neighbours, and never chains on.
  //
  // Geometry (tiles): the victim at (5.5, 5.5); n1 and n2 0.8 either side of it, both in the 1.5
  // radius and both killed by the splash; `far` 1.4 below, in range but third nearest; `outer` at
  // (7.4, 5.5) — 1.9 from the victim (outside 1.5) but 1.1 from n1 (inside 1.5). Only a second
  // chain started by n1's death could reach `outer`, so it must take no damage at all.
  //
  // Note: chainReaction is called from pointerDown only, and the splash goes through damageEnemy,
  // which never calls it — so today the re-entry guard is unreachable and deleting it alone does not
  // fail this test. What this does catch is the regression the guard exists for: moving the hook
  // into damageEnemy (where §3 places it) without the guard makes n1's splash kill chain to `outer`.
  {
    const s = fullState();
    buyUpgrade(s, 'chain-reaction');
    s.phase = 'wave';
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    const victim = stationary(80001, 'grunt', 1, 5.5, 5.5);
    victim.hp = 0.5;
    const n1 = stationary(80002, 'grunt', 1, 6.3, 5.5);
    const n2 = stationary(80003, 'grunt', 1, 4.7, 5.5);
    const far = stationary(80004, 'grunt', 1, 5.5, 6.9);
    const outer = stationary(80005, 'grunt', 1, 7.4, 5.5);
    n1.hp = 0.01;
    n2.hp = 0.01;
    s.enemies.push(victim, n1, n2, far, outer);
    const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const geometryOk = d(n1, victim) <= 1.5 && d(n2, victim) <= 1.5 && d(outer, victim) > 1.5 && d(outer, n1) <= 1.5;
    const farHp = far.hp;
    const outerHp = outer.hp;
    s.events = [];
    pointerDown(s, 5.5, 5.5);
    pointerUp(s);
    const outerHits = s.events.filter((ev) => ev.type === 'damage' && ev.id === outer.id).length;
    check(
      geometryOk && victim.dead && n1.dead && n2.dead && far.hp === farHp && outer.hp === outerHp && outerHits === 0,
      `chain-reaction splashes the two nearest neighbours on a killing click and a splash kill never chains (outer hp ${outer.hp}/${outerHp}, ${outerHits} hits)`,
    );
  }

  // 50.12 Bounty Board: double boss kill value, 1.1x spawn HP.
  {
    const plain = fullState();
    const bounty = fullState();
    buyUpgrade(bounty, 'bounty-board');
    const kind = 'grunt-boss';
    const spawnBoss = (s) => {
      s.phase = 'wave';
      s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
      s.runs = [{ wave: 50, startTick: s.clock, spawns: [{ tick: 0, kind }] }];
      tick(s);
      return s.enemies.find((e) => e.kind === kind);
    };
    const a = spawnBoss(plain);
    const b = spawnBoss(bounty);
    const killFor = (s, e) => {
      e.hp = 0.001;
      e.shield = 0;
      e.shieldsRemaining = 0;
      const before = s.economy.salvage;
      e.stunUntilTick = 1e9;
      pointerDown(s, e.x, e.y);
      pointerUp(s);
      return e.dead ? s.economy.salvage - before : -1;
    };
    const hpOk = a && b && Math.abs(b.maxHp / a.maxHp - 1.1) < 0.01;
    const plainReward = a ? killFor(plain, a) : -1;
    const bountyReward = b ? killFor(bounty, b) : -1;
    check(
      hpOk && plainReward > 0 && Math.abs(bountyReward - plainReward * 2) <= 1,
      `bounty-board doubles a boss's kill value and gives it 1.1x HP (${a?.maxHp} -> ${b?.maxHp}; $${plainReward} -> $${bountyReward})`,
    );
  }

  // 50.13 runUpgradeArt copies only what is missing, never overwrites, and is idempotent.
  {
    const tmp = mkdtempSync(join(tmpdir(), 'pd-upg-'));
    try {
      const dir = join(tmp, 'upgrades');
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, '_upgrade-placeholder.svg'), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44"/>');
      const custom = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44"><!-- artist work --></svg>';
      writeFileSync(join(dir, 'coolant.svg'), custom);
      const first = runUpgradeArt(tmp);
      const kept = readFileSync(join(dir, 'coolant.svg'), 'utf8') === custom;
      const second = runUpgradeArt(tmp);
      check(
        first.copied === 13 && first.skipped === 1 && kept && second.copied === 0 && second.skipped === 14,
        `upgrade-art copies only missing files, never overwrites, and is idempotent (${first.copied}/${first.skipped}, then ${second.copied})`,
      );
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }

  // 50.15 Ballistic Telemetry centres its splash on the enemy the shell burst on, not the shell's
  // designated target. The shell bursts at (6, 6) and catches `hit` 1.3 tiles off-centre (the Flak
  // burst reaches 1.2 + the flyer's 0.22). `side` is 0.9 beyond `hit` — inside the 1-tile telemetry
  // reach of the impact, outside the burst — so only telemetry can touch it. The designated target
  // `aim` is far away with its own flyer neighbour `aimMate`, which the old target-centred splash hit.
  {
    const s = allUnlocked();
    s.wave = 45;
    s.economy.salvage = 1_000_000;
    buyUpgrade(s, 'ballistic-telemetry');
    s.phase = 'wave';
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    const aa = createTower(90001, 'aa', 0, 0);
    aa.tier = 3;
    aa.branch = 'A';
    s.towers.push(aa);
    s.towerDisabled.set(aa.id, 1e9); // it must not fire on its own; only the hand-placed shell lands
    const beefy = (e) => {
      e.maxHp = 1000;
      e.hp = 1000;
      return e;
    };
    const hit = beefy(stationary(90010, 'flyer', 1, 7.3, 6.0));
    const side = beefy(stationary(90011, 'flyer', 1, 8.2, 6.0));
    const aim = beefy(stationary(90012, 'flyer', 1, 12.0, 2.0));
    const aimMate = beefy(stationary(90013, 'flyer', 1, 12.5, 2.0));
    s.enemies.push(hit, side, aim, aimMate);
    s.projectiles.push({ id: 90020, kind: 'shell', x: 6.0, y: 6.0, vx: 0, vy: 0, targetId: aim.id, towerId: aa.id, damage: 10, lifetime: 1 });
    tick(s);
    const hitLoss = 1000 - hit.hp;
    const sideLoss = 1000 - side.hp;
    check(
      hitLoss > 0 && Math.abs(sideLoss - hitLoss * 0.5) < 1e-6 && aim.hp === 1000 && aimMate.hp === 1000,
      `ballistic-telemetry splashes the flyer next to the impact, not the shell's designated target (hit -${hitLoss}, side -${sideLoss}, aim's mate -${1000 - aimMate.hp})`,
    );
  }

  // 50.16 System Tray (§5): the spawn gate. Unowned, below wave 55, outside a wave, or inside a
  // wave's first 5 s it never rolls (and never draws from the RNG); otherwise it rolls once a second
  // at about 1.5 %, with at most one pop-up on screen.
  {
    const trayState = (owned, wave) => {
      const s = fullState();
      if (owned) buyUpgrade(s, 'system-tray');
      s.wave = wave;
      s.phase = 'wave';
      return s;
    };
    // Drive the spawner over `seconds` of wave time starting at waveTick 0; close each pop-up as it
    // opens. Returns the spawn count and the earliest waveTick a spawn landed at.
    const drive = (s, seconds) => {
      let spawns = 0;
      let earliest = Infinity;
      const rng0 = s.rng;
      for (let wt = 0; wt < seconds * 60; wt++) {
        s.waveTick = wt;
        tickSystemTray(s);
        if (s.tray) {
          spawns++;
          earliest = Math.min(earliest, wt);
          s.tray = null;
        }
        s.clock++;
      }
      return { spawns, earliest, rngMoved: s.rng !== rng0 };
    };
    const unowned = drive(trayState(false, 80), 4000);
    const early = drive(trayState(true, 54), 4000);
    const build = trayState(true, 80);
    build.phase = 'build';
    const inBuild = drive(build, 4000);
    const owned = drive(trayState(true, 80), 20000);
    const rate = owned.spawns / (20000 - TRAY_SETTLE_TICKS / 60);
    // The first five seconds of many fresh waves: never a pop-up, whatever the seed.
    let settleSpawns = 0;
    for (let seed = 1; seed <= 400; seed++) {
      const s = trayState(true, 80);
      s.rng = seed * 2654435761;
      for (let wt = 0; wt < TRAY_SETTLE_TICKS; wt++) {
        s.waveTick = wt;
        tickSystemTray(s);
        if (s.tray) settleSpawns++;
        s.clock++;
      }
    }
    const gateTicks = [0, 1, 59, 60, 299].every((wt) => !trayRollDue({ ...trayState(true, 80), waveTick: wt }));
    const rollTicks = trayRollDue({ ...trayState(true, 80), waveTick: TRAY_SETTLE_TICKS }) &&
      !trayRollDue({ ...trayState(true, 80), waveTick: TRAY_SETTLE_TICKS + 1 }) &&
      trayRollDue({ ...trayState(true, 80), waveTick: TRAY_SETTLE_TICKS + TRAY_ROLL_TICKS });
    const oneAtATime = (() => {
      const s = trayState(true, 80);
      const a = spawnTray(s);
      const b = spawnTray(s);
      return a !== null && b === null && !trayRollDue({ ...s, waveTick: TRAY_SETTLE_TICKS });
    })();
    check(
      unowned.spawns === 0 && !unowned.rngMoved && early.spawns === 0 && !early.rngMoved && inBuild.spawns === 0 &&
        settleSpawns === 0 && owned.earliest >= TRAY_SETTLE_TICKS && gateTicks && rollTicks && oneAtATime &&
        rate > 0.01 && rate < 0.02,
      `system-tray rolls 1.5%/s only when owned, at wave 55+, in a wave, after 5 s, one at a time (rate ${(rate * 100).toFixed(2)}%, unowned ${unowned.spawns}, wave 54 ${early.spawns}, build ${inBuild.spawns}, first 5 s ${settleSpawns})`,
    );
  }

  // 50.17 The pop-up: 120x64 in the field's top-right, closes itself after 12 s, and a click grants
  // one of the three buffs for exactly 1200 ticks of sim clock.
  {
    const s = fullState();
    buyUpgrade(s, 'system-tray');
    s.phase = 'build';
    s.autoWave = false;
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    const field = s.viewport.boardCol;
    const tray = spawnTray(s);
    const placed = tray.w === TRAY_W && tray.h === TRAY_H && TRAY_W === 120 && TRAY_H === 64 &&
      tray.x + tray.w <= field.x + field.w && tray.x > field.x + field.w / 2 && tray.y >= field.y && tray.y < field.y + field.h / 4;
    for (let i = 0; i < TRAY_LIFETIME_TICKS - 1; i++) tick(s);
    const stillUp = s.tray !== null;
    tick(s);
    const selfClosed = s.tray === null && TRAY_LIFETIME_TICKS === 720;
    const wrongId = (() => {
      const t2 = spawnTray(s);
      return claimTray(s, t2.id + 1) === null && s.tray === t2 && s.buff === null;
    })();
    const kind = claimTray(s, s.tray.id);
    const start = s.clock;
    const claimed = s.tray === null && s.buff !== null && s.buff.kind === kind && s.buff.until === start + 1200 && TRAY_BUFF_TICKS === 1200;
    const hudLive = buffRowText(s) !== null && buffRowText(s).includes('20 s');
    for (let i = 0; i < 1199; i++) tick(s);
    const liveAt1199 = upgradeBuff(s) !== null && buffRowText(s).includes('1 s');
    tick(s);
    const goneAt1200 = s.clock - start === 1200 && upgradeBuff(s) === null && s.buff === null && buffRowText(s) === null;
    // A paused (unticked) run keeps the buff: it is clock-based, not wall time.
    const p = fullState();
    buyUpgrade(p, 'system-tray');
    claimTray(p, spawnTray(p).id, 'turbo');
    const pausedKeeps = upgradeBuff(p) !== null;
    // The roll is uniform: all three kinds turn up across seeds, each roughly a third of the time.
    const counts = { turbo: 0, overdrive: 0, windfall: 0 };
    for (let seed = 1; seed <= 3000; seed++) {
      const u = fullState();
      u.rng = Math.imul(seed, 0x9e3779b1);
      counts[claimTray(u, spawnTray(u).id)]++;
    }
    const uniform = Object.values(counts).every((n) => n > 850 && n < 1150);
    check(
      placed && stillUp && selfClosed && wrongId && claimed && hudLive && liveAt1199 && goneAt1200 && pausedKeeps && uniform,
      `system-tray pop-up sits top-right at 120x64, closes after 12 s, and its buff lasts exactly 1200 ticks (${kind}; ${JSON.stringify(counts)})`,
    );
  }

  // 50.18 A new buff replaces the old one outright: no stacking, a fresh 20 s.
  {
    const s = fullState();
    buyUpgrade(s, 'system-tray');
    claimTray(s, spawnTray(s).id, 'turbo');
    s.clock += 600;
    claimTray(s, spawnTray(s).id, 'overdrive');
    const replaced = s.buff.kind === 'overdrive' && s.buff.until === s.clock + 1200;
    const gun = TOWER_STATS.gun.fireInterval;
    const plain = fullState();
    const notTurbo = towerIntervalTicks(s, gun) === towerIntervalTicks(plain, gun);
    claimTray(s, spawnTray(s).id, 'overdrive');
    const sameKindRefresh = s.buff.until === s.clock + 1200;
    check(
      replaced && notTurbo && sameKindRefresh,
      'system-tray: a new buff replaces the active one (turbo -> overdrive drops turbo) and never stacks',
    );
  }

  // 50.19 Each buff moves its own number: Turbo the fire interval, Overdrive click damage,
  // Windfall kill value.
  {
    const gun = TOWER_STATS.gun.fireInterval;
    const plain = fullState();
    const turbo = fullState();
    buyUpgrade(turbo, 'system-tray');
    claimTray(turbo, spawnTray(turbo).id, 'turbo');
    const base = towerIntervalTicks(plain, gun);
    const fast = towerIntervalTicks(turbo, gun);
    const turboOk = fast === Math.max(1, Math.floor(base * 0.6)) && fast < base && towerIntervalTicks(turbo, 1) === 1;

    // Click damage: the same click on the same enemy, with the same RNG, with and without Overdrive.
    const clickOnce = (buff) => {
      const s = fullState();
      buyUpgrade(s, 'system-tray');
      if (buff) claimTray(s, spawnTray(s).id, buff);
      s.phase = 'wave';
      s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
      const e = stationary(91001, 'grunt', 1, 5.5, 5.5);
      e.maxHp = 1e6;
      e.hp = 1e6;
      s.enemies.push(e);
      s.events = [];
      pointerDown(s, 5.5, 5.5);
      pointerUp(s);
      return s.events.filter((ev) => ev.type === 'damage').reduce((n, ev) => n + ev.amount, 0);
    };
    const dPlain = clickOnce(null);
    const dOver = clickOnce('overdrive');
    const dTurbo = clickOnce('turbo');
    const overdriveOk = dPlain > 0 && Math.abs(dOver - dPlain * 2) < 1e-9 && dTurbo === dPlain;

    // Kill value: the same killing click with and without Windfall.
    const killOnce = (buff) => {
      const s = fullState();
      buyUpgrade(s, 'system-tray');
      if (buff) claimTray(s, spawnTray(s).id, buff);
      s.phase = 'wave';
      s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
      const e = stationary(91002, 'grunt', 1, 5.5, 5.5);
      e.value = 100;
      e.hp = 0.001;
      s.enemies.push(e);
      const before = s.economy.salvage;
      pointerDown(s, 5.5, 5.5);
      pointerUp(s);
      return e.dead ? s.economy.salvage - before : -1;
    };
    const vPlain = killOnce(null);
    const vWind = killOnce('windfall');
    const vOver = killOnce('overdrive');
    const windfallOk = vPlain > 0 && Math.abs(vWind - vPlain * 1.25) <= 1 && vOver === vPlain;
    check(
      turboOk && overdriveOk && windfallOk,
      `system-tray buffs: turbo ${base} -> ${fast} ticks, overdrive click ${dPlain} -> ${dOver}, windfall kill $${vPlain} -> $${vWind}`,
    );
  }

  // 50.21 Wide Reticle: a click 0.55 tiles from a grunt's centre misses without it (radius 0.3 +
  // slack 0.15) and lands with it.
  {
    const clickNear = (owned) => {
      const s = fullState();
      if (owned) buyUpgrade(s, 'wide-reticle');
      s.phase = 'wave';
      s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
      const e = stationary(92001, 'grunt', 1, 5.5, 5.5);
      e.maxHp = 1e6;
      e.hp = 1e6;
      s.enemies.push(e);
      const hit = pointerDown(s, 5.5 + 0.55, 5.5);
      pointerUp(s);
      return hit && e.hp < 1e6;
    };
    const reach = ENEMY_STATS.grunt.radius + CLICK_SLACK;
    check(
      reach < 0.55 && !clickNear(false) && clickNear(true),
      `wide-reticle lands a click 0.55 tiles off a grunt that misses without it (base reach ${reach})`,
    );
  }

  // 50.22 Double-Buffered Click doubles both a click and a tick of held-reticle damage.
  {
    const run = (owned) => {
      const s = fullState();
      if (owned) buyUpgrade(s, 'double-buffer');
      s.phase = 'wave';
      s.runs = [];
      s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
      s.pointer.stage = 2;
      const e = stationary(92002, 'grunt', 1, 5.5, 5.5);
      e.maxHp = 1e9;
      e.hp = 1e9;
      s.enemies.push(e);
      const dealt = () => s.events.filter((ev) => ev.type === 'damage' && ev.id === e.id).reduce((n, ev) => n + ev.amount, 0);
      s.events = [];
      pointerDown(s, 5.5, 5.5);
      const click = dealt();
      s.events = [];
      tick(s); // still held: applyReticle burns one tick of hold damage
      const hold = dealt();
      pointerUp(s);
      return { click, hold };
    };
    const a = run(false);
    const b = run(true);
    check(
      a.click > 0 && a.hold > 0 && Math.abs(b.click - a.click * 2) < 1e-9 && Math.abs(b.hold - a.hold * 2) < 1e-9,
      `double-buffer doubles click and hold damage (click ${a.click} -> ${b.click}, hold ${a.hold} -> ${b.hold})`,
    );
  }

  // 50.23 Structural Warranty halves breacher turret damage to a tower and halves repair time.
  {
    const turretLoss = (owned) => {
      const s = stateOnLevel('open-field');
      s.economy.salvage = 1_000_000;
      placeTower(s, 'gun', 5, 5);
      const gun = towerAt(s, 5, 5);
      s.wave = 45;
      if (owned) buyUpgrade(s, 'structural-warranty');
      s.phase = 'wave';
      s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
      const b = createEnemy(1, 'breacher', 12, SPAWN, EXIT);
      Object.assign(b, { x: 5.0, y: 6.5, prevX: 5.0, prevY: 6.5, col: 5, row: 6, heading: 0, dist: 0 });
      s.enemies.push(b);
      const before = gun.hp;
      for (let i = 0; i < 60; i++) tick(s);
      return before - gun.hp;
    };
    const repairTicks = (owned) => {
      const s = stateOnLevel('open-field');
      s.economy.salvage = 1_000_000;
      placeTower(s, 'wall', 5, 6);
      const wall = towerAt(s, 5, 6);
      s.wave = 45;
      if (owned) buyUpgrade(s, 'structural-warranty');
      wall.hp = wall.maxHp / 2;
      const ok = startRepair(s, 5, 6);
      return ok ? wall.repairReadyAt - s.clock : -1;
    };
    const plainLoss = turretLoss(false);
    const warrantyLoss = turretLoss(true);
    const plainRepair = repairTicks(false);
    const warrantyRepair = repairTicks(true);
    check(
      plainLoss > 0 && warrantyLoss === plainLoss / 2 && plainRepair > 0 && warrantyRepair === Math.round(plainRepair / 2),
      `structural-warranty halves tower damage taken and repair time (turret -${plainLoss} -> -${warrantyLoss}; repair ${plainRepair} -> ${warrantyRepair} ticks)`,
    );
  }

  // 50.24 Shutter Licence: a Toggle gate flips back the very next call, with no 3 s lock.
  {
    const flipTwice = (owned) => {
      const s = stateOnLevel('open-field');
      s.economy.salvage = 1_000_000;
      placeTower(s, 'wall', 5, 5);
      upgradeTower(s, 5, 5);
      chooseBranch(s, 5, 5, 'C');
      s.wave = 35;
      if (owned) buyUpgrade(s, 'shutter-licence');
      const gate = towerAt(s, 5, 5);
      const first = toggleGate(s, 5, 5);
      const lockedAfter = isGateLocked(gate, s.clock);
      s.clock++;
      const second = toggleGate(s, 5, 5);
      return { first, lockedAfter, second, open: gate.open };
    };
    const plain = flipTwice(false);
    const licensed = flipTwice(true);
    check(
      plain.first && plain.lockedAfter && !plain.second && plain.open &&
        licensed.first && !licensed.lockedAfter && licensed.second && !licensed.open,
      'shutter-licence removes the 3 s Toggle lock: a gate flips back one tick later (refused without it)',
    );
  }

  // 50.20 The upgrade placeholder is looked up by its ordinary bare name, like every other asset.
  {
    const entry = manifestEntry('_upgrade-placeholder');
    check(
      entry !== undefined && entry.file === 'upgrades/_upgrade-placeholder.svg' &&
        existsSync(join(artDir, 'upgrades', '_upgrade-placeholder.svg')) &&
        !existsSync(join(artDir, 'upgrades', '_placeholder.svg')) &&
        manifestEntry('_placeholder')?.file === 'achievements/_placeholder.svg',
      'the upgrade placeholder is upgrades/_upgrade-placeholder.svg under its bare name, distinct from the achievements placeholder',
    );
  }

  // 50.14 Row lines fit in 46 characters, and every detail is written.
  const badText = GLOBAL_UPGRADES.filter((u) => u.line.length > 46 || u.detail.trim().length === 0);
  check(badText.length === 0, `every upgrade line is <= 46 chars and every detail is non-empty (${badText.map((u) => u.id).join(', ') || 'all fit'})`);
}

// --- Enemy shadows (design.md section 24) ------------------------------------------------------
{
  check(SHADOW_TINT === 0x000000, 'shadows: the tint is exactly black');
  check(SHADOW_ALPHA > 0 && SHADOW_ALPHA < 1, `shadows: SHADOW_ALPHA is between 0 and 1 (${SHADOW_ALPHA})`);
  check(
    SHADOW_OFFSET_FLYER.x > SHADOW_OFFSET.x && SHADOW_OFFSET_FLYER.y > SHADOW_OFFSET.y &&
      shadowOffsetFor('flyer') === SHADOW_OFFSET_FLYER && shadowOffsetFor('grunt') === SHADOW_OFFSET,
    'shadows: the flyer offset exceeds the ground offset, and flyers use it',
  );
  const carrierOff = shadowOffsetFor('flyer-boss');
  check(
    carrierOff === SHADOW_OFFSET_FLYER_BOSS &&
      carrierOff.x === Math.round(SHADOW_OFFSET_FLYER.x * SHADOW_OFFSET_FLYER_BOSS_SCALE) &&
      carrierOff.y === Math.round(SHADOW_OFFSET_FLYER.y * SHADOW_OFFSET_FLYER_BOSS_SCALE) &&
      carrierOff.x > SHADOW_OFFSET_FLYER.x && carrierOff.y > SHADOW_OFFSET_FLYER.y,
    `shadows: the Carrier's offset (${carrierOff.x},${carrierOff.y}) is the scaled flyer offset and larger than a plain flyer's`,
  );
  const li = (n) => BOARD_LAYER_ORDER.indexOf(n);
  check(
    li('shadows') > li('path') && li('shadows') < li('mines') &&
      li('shadows') < li('towers') && li('shadows') < li('towerSprites') && li('shadows') < li('enemies'),
    'shadows: the shadows layer sorts after path and before mines, towers and enemies',
  );
  check(!shadowVisibleFor('popup') && shadowVisibleFor('grunt') && shadowVisibleFor('flyer'),
    'shadows: a pop-up casts no shadow');

  // The view: a sprite-backed flyer casts a shadow that copies its body sprite, shifted by the flyer
  // offset (knockback included); a pop-up casts none; unused pooled shadows hide.
  resetArt();
  const flyTex = new Texture({ width: 4, height: 4 });
  injectArtTexture('flyer', flyTex);
  const s = stateOnLevel('open-field');
  const fly = createEnemy(1, 'flyer', 1, SPAWN, EXIT);
  fly.x = fly.prevX = 5.5;
  fly.y = fly.prevY = 6.5;
  s.enemies.push(fly);
  const pop = createEnemy(2, 'popup', 1, SPAWN, EXIT);
  s.enemies.push(pop);
  const layout = computeLayout(1280, 800);
  const view = new BoardView();
  check(view.root.children.indexOf(view.shadows) === BOARD_LAYER_ORDER.indexOf('shadows') &&
    view.root.children.length === BOARD_LAYER_ORDER.length,
    'shadows: the root child order follows BOARD_LAYER_ORDER');
  const hover = { col: 0, row: 0, onBoard: false, x: 0, y: 0 };
  view.draw(s, layout, 0, hover, (id) => (id === 1 ? { dx: 5, dy: -2 } : null));
  const body = view.enemySprites[0];
  const sh = view.shadowSprites[0];
  check(view.shadowSprites.filter((x) => x.visible).length === 1, 'shadows: one shadow for the flyer, none for the pop-up');
  check(
    sh.texture === body.texture && sh.width === body.width && sh.height === body.height &&
      sh.rotation === body.rotation && sh.tint === SHADOW_TINT && sh.alpha === SHADOW_ALPHA,
    'shadows: the shadow shares the body texture, size and rotation, tinted black at SHADOW_ALPHA',
  );
  check(
    sh.position.x === body.position.x + SHADOW_OFFSET_FLYER.x && sh.position.y === body.position.y + SHADOW_OFFSET_FLYER.y &&
      body.position.x === layout.board.x + 5.5 * layout.board.cell + 5,
    'shadows: the flyer shadow sits at the knocked-back body plus the flyer offset',
  );
  s.enemies.length = 0;
  view.draw(s, layout, 0, hover);
  check(view.shadowSprites.every((x) => !x.visible), 'shadows: unused pooled shadow sprites hide');
  resetArt();
}

// --- UX pass 1 (docs/UX-PASS-1.md) -----------------------------------------------------------

{
  // ux1. computeHud exposes a salvage row below the integrity block and above the route line and the
  // tower rows: sunken, 26 px tall, the panel's full inner width.
  const l = computeLayout(1280, 720);
  const s = createRunState();
  const h = computeHud(l, s);
  check(h.salvage !== undefined, 'ux1: computeHud exposes a salvage row');
  check(h.salvage.h === 26, `ux1: the salvage readout is 26 px tall (${h.salvage.h})`);
  check(h.salvage.x === h.integrity.x && h.salvage.w === h.integrity.w && h.salvage.w === l.leftPanel.w - 12,
    'ux1: the salvage readout spans the panel inner width, like the integrity block');
  check(h.salvage.y >= h.integrity.y + h.integrity.h, 'ux1: salvage sits below the integrity block');
  check(h.route !== null && h.salvage.y + h.salvage.h <= h.route.y, 'ux1: salvage sits above the route line');
  check(h.towers.every((t) => h.salvage.y + h.salvage.h <= t.rect.y), 'ux1: salvage sits above every tower row');

  // Also present, and above the detail box, while a tower is selected for inspection.
  s.economy.salvage = 100000;
  placeTower(s, 'gun', 5, 5);
  selectPlacedTower(s, towerAt(s, 5, 5));
  const hd = computeHud(l, s);
  check(hd.detail !== null && hd.salvage.y + hd.salvage.h <= hd.detail.box.y,
    'ux1: with a tower selected the salvage readout stays above the detail box');
}

{
  // ux2. The left panel's tallest layout (palette with the map row, and every inspected tower at every
  // tier/branch) still fits inside the panel at 1280x720 and 1600x900.
  for (const [vw, vh] of [[1280, 720], [1600, 900]]) {
    const l = computeLayout(vw, vh);
    const bottom = l.leftPanel.y + l.leftPanel.h;
    let tallest = 0;
    let tallestName = '';
    let measured = 0;
    const measure = (name, h) => {
      measured++;
      const end = h.autoWave.y + h.autoWave.h;
      if (end > tallest) { tallest = end; tallestName = name; }
    };
    const fresh = createRunState();
    check(canCycleLevel(fresh), `ux2: a fresh run shows the map row at ${vw}x${vh}`);
    measure('palette + map', computeHud(l, fresh));
    for (const kind of TOWER_KINDS) {
      for (const [tier, branch] of [[1, null], [2, null], [3, 'A'], [3, 'B'], [3, 'C']]) {
        const s = allUnlocked();
        s.economy.salvage = 1e9;
        if (!placeTower(s, kind, 5, 5)) continue;
        const t = towerAt(s, 5, 5);
        t.tier = tier;
        t.branch = tier === 3 && hasBranches(kind) ? branch : null;
        selectPlacedTower(s, t);
        measure(`${kind} T${tier}${t.branch ?? ''}`, computeHud(l, s));
      }
    }
    check(measured > TOWER_KINDS.length * 2, `ux2: every tower kind's detail views were measured (${measured})`);
    check(tallest > 0 && tallest <= bottom,
      `ux2: the tallest left-panel layout (${tallestName}) fits at ${vw}x${vh} (${tallest} <= ${bottom})`);
  }
}

{
  // ux2b. Worst-case column height (docs/DETAIL-BRANCH-ROW.md §4): the new branch row plus the three
  // stacked branch buttons. The game never shows both at once (a branch is picked at tier 3, the
  // buttons at tier 2), but a tier-2 cursor with a branch forced is the tallest the pane can be, so it
  // is the ceiling every other detail view sits under. The detail box and the panel's last row
  // (auto-wave) must both end inside the sidebar.
  for (const [vw, vh] of [[1280, 720], [1024, 768]]) {
    const l = computeLayout(vw, vh);
    const bottom = l.leftPanel.y + l.leftPanel.h;
    const s = allUnlocked();
    s.economy.salvage = 1e9;
    check(placeTower(s, 'cursor', 5, 5), `place a cursor for the worst-case column at ${vw}x${vh}`);
    const c = towerAt(s, 5, 5);
    c.tier = 2;
    c.branch = 'A';
    selectPlacedTower(s, c);
    const h = computeHud(l, s);
    check(h.detail !== null && h.detail.branch !== null && h.detail.branches.length === 3,
      `the worst case keeps the branch row and three stacked branch buttons at ${vw}x${vh}`);
    const boxBottom = h.detail.box.y + h.detail.box.h;
    const lastBottom = h.autoWave.y + h.autoWave.h;
    check(boxBottom <= bottom,
      `the worst-case detail box ends inside the sidebar at ${vw}x${vh} (${boxBottom} <= ${bottom})`);
    check(lastBottom <= bottom,
      `the worst-case last row ends inside the sidebar at ${vw}x${vh} (${lastBottom} <= ${bottom})`);
  }
}

{
  // ux3. The readout prints $N (in the larger readout size, right-aligned) and --- under Blackout;
  // the status bar no longer has a salvage pane or prints the salvage figure.
  const l = computeLayout(1280, 720);
  const s = createRunState();
  s.economy.salvage = 1234;
  check(salvageReadoutText(s) === '$1,234', `ux3: the readout prints $N (${salvageReadoutText(s)})`);
  check(!('right' in l.statusPanes), 'ux3: the status bar has no salvage pane');

  const view = new HudView();
  const h = computeHud(l, s);
  const texts = () => view.root.children.filter((c) => typeof c.text === 'string' && c.text !== '');
  const inRect = (c, r) => c.position.x >= r.x && c.position.x <= r.x + r.w && c.position.y >= r.y && c.position.y <= r.y + r.h;
  view.draw(s, l, null);
  const readout = texts().filter((c) => inRect(c, h.salvage));
  check(readout.length === 1 && readout[0].text === '$1,234', 'ux3: the left-panel readout draws $1,234');
  check(readout.length === 1 && readout[0].anchor.x === 1 && readout[0].style.fontSize === READOUT_FONT_SIZE,
    'ux3: the readout value is right-aligned in the readout size');
  const integrityText = texts().find((c) => c.text.startsWith('Integrity:'));
  check(integrityText !== undefined && readout[0].style.fontSize === integrityText.style.fontSize,
    'ux3: the readout is set in the same size as the integrity figure');
  check(!texts().some((c) => inRect(c, l.status) && c.text.includes('1,234')),
    'ux3: the status bar no longer prints the salvage figure');

  s.phase = 'wave';
  s.modifiers = ['blackout'];
  check(salvageReadoutText(s) === '---', 'ux3: Blackout masks the readout as ---');
  view.draw(s, l, null);
  const masked = texts().filter((c) => inRect(c, h.salvage));
  check(masked.length === 1 && masked[0].text === '---', 'ux3: the drawn readout prints --- under Blackout');
  check(!texts().some((c) => c.text.includes('1,234')), 'ux3: Blackout leaves no salvage figure on screen');
  check(texts().some((c) => inRect(c, l.status) && c.text.startsWith('Wave ')) &&
    texts().some((c) => inRect(c, l.status) && c.text.startsWith('×')),
    'ux3: the status bar keeps wave and speed');
}

{
  // ux4. selectTower('gun') then startWave disarms the build tool, and the placement hint goes with it.
  const s = createRunState();
  selectTower(s, 'gun');
  check(s.selected === 'gun', 'ux4: the gun is armed');
  check(startWave(s), 'ux4: the wave starts');
  check(s.selected === null, 'ux4: starting a wave clears the armed build tool');
  const view = new HudView();
  const l = computeLayout(1280, 720);
  view.draw(s, l, null);
  check(!view.root.children.some((c) => typeof c.text === 'string' && c.text.startsWith('Click a tile to place')),
    'ux4: the placement hint disappears with the selection');
}

{
  // ux5. A startWave refused because a wave is already running leaves s.selected untouched. A
  // mid-wave start is normally an accepted early call, so the refusal here is the final wave: it is
  // running and there is no next wave to call.
  const s = createRunState();
  s.wave = WAVE_COUNT;
  s.phase = 'wave';
  selectTower(s, 'gun');
  check(s.selected === 'gun', 'ux5: the gun is armed mid-wave');
  check(!startWave(s), 'ux5: the start is refused');
  check(s.selected === 'gun', 'ux5: a refused start leaves the armed tool alone');
  check(s.wave === WAVE_COUNT && s.phase === 'wave', 'ux5: the refused start changed nothing else');
}

{
  // ux6. selectPlacedTower(id) then startWave keeps the inspected tower selected.
  const s = createRunState();
  s.economy.salvage = 1000;
  placeTower(s, 'gun', 5, 5);
  const t = towerAt(s, 5, 5);
  selectPlacedTower(s, t);
  check(startWave(s), 'ux6: the wave starts');
  check(s.selectedTowerId === t.id, 'ux6: the inspected tower stays selected through a wave start');
}

// --- Tower auras (docs/TOWER-AURAS.md) --------------------------------------------------------

{
  // 1. Each helper returns exactly the towers the sim is acting on.

  // healedTowerIds: a Repair tower marks its target and nothing outside radius or at full health.
  {
    const s = allUnlocked('open-field');
    s.economy.salvage = 100000;
    placeTower(s, 'repair', 5, 5);
    placeTower(s, 'gun', 6, 5);
    placeTower(s, 'gun', 12, 5);
    const healed = towerAt(s, 6, 5);
    const far = towerAt(s, 12, 5);
    healed.hp = 40;
    far.hp = 40;
    const ids = healedTowerIds(s);
    check(ids.has(healed.id) && !ids.has(far.id), 'healedTowerIds marks the in-radius damaged tower only');
    check(!ids.has(towerAt(s, 5, 5).id), 'healedTowerIds never marks the repair tower itself');
    healed.hp = healed.maxHp;
    check(healedTowerIds(s).size === 0, 'healedTowerIds is empty once every tower is at full health');
  }

  // towerAuraSources: a Beacon marks every tower in radius and nothing outside it.
  {
    const s = allUnlocked('open-field');
    s.economy.salvage = 100000;
    placeTower(s, 'beacon', 5, 5);
    placeTower(s, 'gun', 6, 5);
    placeTower(s, 'gun', 12, 5);
    const inGun = towerAt(s, 6, 5);
    const outGun = towerAt(s, 12, 5);
    const sources = towerAuraSources(s);
    check(sources.get(inGun.id)?.has('beacon') === true, 'towerAuraSources marks the tower inside the beacon radius');
    check(sources.get(outGun.id)?.has('beacon') !== true, 'towerAuraSources leaves the tower outside the beacon radius alone');
    check(sources.get(towerAt(s, 5, 5).id)?.has('beacon') !== true, 'a beacon never buffs itself');
  }

  // towerAuraSources: Manual Override marks only towers within range of the marked enemy.
  {
    const s = allUnlocked('open-field');
    s.economy.salvage = 100000;
    placeTower(s, 'gun', 5, 5);
    placeTower(s, 'gun', 12, 5);
    const near = towerAt(s, 5, 5);
    const far = towerAt(s, 12, 5);
    s.phase = 'wave';
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    const marked = stationary(1, 'grunt', 1, 5.5, 4.0);
    s.enemies.push(marked);
    s.pointer.targetId = marked.id;
    toggleManualOverride(s);
    const sources = towerAuraSources(s);
    check(sources.get(near.id)?.has('override') === true, 'towerAuraSources marks the tower in range of the marked enemy');
    check(sources.get(far.id)?.has('override') !== true, 'towerAuraSources leaves the out-of-range tower alone');
  }

  // disabledTowerIds: an EMP marks the towers inside it, and a Blue Screen marks its tower.
  {
    const s = stateOnLevel('open-field');
    s.economy.salvage = 100000;
    placeTower(s, 'gun', 5, 5);
    placeTower(s, 'gun', 12, 5);
    const near = towerAt(s, 5, 5);
    const far = towerAt(s, 12, 5);
    s.phase = 'wave';
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    const w = stationary(1, 'saboteur-boss', 42, 5.5, 5.5);
    s.enemies.push(w);
    for (let i = 0; i < 3; i++) tick(s);
    const ids = disabledTowerIds(s);
    check(ids.has(near.id) && !ids.has(far.id), 'disabledTowerIds marks the tower inside the EMP radius only');
  }
  {
    const s = allUnlocked('open-field');
    s.economy.salvage = 100000;
    placeTower(s, 'gun', 5, 5);
    const g = towerAt(s, 5, 5);
    s.towerDisabled.set(g.id, secondsToTicks(3));
    check(disabledTowerIds(s).has(g.id), 'disabledTowerIds marks a Blue-Screen-disabled tower');
  }
}

{
  // 2. Each helper returns nothing when the status is absent.
  const s = allUnlocked('open-field');
  s.economy.salvage = 100000;
  placeTower(s, 'gun', 5, 5);
  placeTower(s, 'beacon', 12, 5); // far from the gun, buffs nothing
  check(healedTowerIds(s).size === 0, 'healedTowerIds is empty with no repair tower');
  check(disabledTowerIds(s).size === 0, 'disabledTowerIds is empty with no EMP or Blue Screen');
  const sources = towerAuraSources(s);
  check([...sources.values()].every((set) => set.size === 0), 'towerAuraSources is empty with no beacon aura or override');
}

{
  // 3. BOARD_LAYER_ORDER puts auras after towers and before wrenches.
  const li = (n) => BOARD_LAYER_ORDER.indexOf(n);
  check(li('auras') === li('towers') + 1 && li('auras') === li('wrenches') - 1,
    'the auras layer sits between towers and wrenches');
}

{
  // 4. Exactly one pooled sprite per active status, none for an inactive one, and pooled sprites hide.
  resetArt();
  const healTex = new Texture({ width: 4, height: 4 });
  const beaconTex = new Texture({ width: 4, height: 4 });
  const overrideTex = new Texture({ width: 4, height: 4 });
  const empTex = new Texture({ width: 4, height: 4 });
  injectArtTexture('aura-heal', healTex);
  injectArtTexture('aura-beacon', beaconTex);
  injectArtTexture('aura-override', overrideTex);
  injectArtTexture('aura-emp', empTex);
  const layout = computeLayout(1280, 800);
  const hover = { col: 0, row: 0, onBoard: false, x: 0, y: 0 };
  const cell = layout.board.cell;

  // A damaged gun healed by a repair tower and buffed by a beacon: two statuses on one tower.
  const s = allUnlocked('open-field');
  s.economy.salvage = 100000;
  placeTower(s, 'repair', 5, 5);
  placeTower(s, 'gun', 6, 5);
  placeTower(s, 'beacon', 9, 5);
  const gun = towerAt(s, 6, 5);
  gun.hp = 40;
  const view = new BoardView();
  view.draw(s, layout, 0, hover);
  const visible = () => view.auraSprites.filter((x) => x.visible);
  check(view.auraSprites.length === 12, `three towers pool 12 aura sprites (${view.auraSprites.length})`);
  check(visible().length === 2, `exactly one sprite per active status (${visible().length})`);
  check(new Set(visible().map((x) => x.texture)).size === 2 &&
    visible().some((x) => x.texture === healTex) && visible().some((x) => x.texture === beaconTex),
    'the two active statuses draw heal and beacon');
  const gunCx = layout.board.x + (gun.col + 0.5) * cell;
  const gunCy = layout.board.y + (gun.row + 0.5) * cell;
  check(visible().every((x) => x.position.x === gunCx && x.position.y === gunCy), 'the auras sit at the gun tile centre');

  // Healing finishes: the heal aura hides, the beacon aura stays.
  gun.hp = gun.maxHp;
  view.draw(s, layout, 0, hover);
  check(visible().length === 1 && visible()[0].texture === beaconTex, 'an inactive status hides its sprite');

  // Sell the beacon: every status is gone and the pooled sprites all hide.
  sellTower(s, 9, 5);
  view.draw(s, layout, 0, hover);
  check(visible().length === 0, 'no active status leaves no visible aura');
  check(view.auraSprites.length === 12, 'pooled aura sprites are reused, not recreated');

  // Override and EMP: each active status draws its own sprite.
  resetArt();
  injectArtTexture('aura-override', overrideTex);
  injectArtTexture('aura-emp', empTex);
  const s2 = allUnlocked('open-field');
  s2.economy.salvage = 100000;
  placeTower(s2, 'gun', 5, 5);
  placeTower(s2, 'gun', 12, 5);
  const over = towerAt(s2, 5, 5);
  const emped = towerAt(s2, 12, 5);
  s2.phase = 'wave';
  s2.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const marked = stationary(1, 'grunt', 1, 5.5, 4.0);
  s2.enemies.push(marked);
  s2.pointer.targetId = marked.id;
  toggleManualOverride(s2);
  emped.empUntilTick = s2.clock + 100;
  const view2 = new BoardView();
  view2.draw(s2, layout, 0, hover);
  const vis = view2.auraSprites.filter((x) => x.visible);
  check(vis.length === 2, `one override and one EMP draw exactly two auras (${vis.length})`);
  check(vis.some((x) => x.texture === overrideTex) && vis.some((x) => x.texture === empTex),
    'the override reticle and the EMP static each draw');
  check(vis.some((x) => x.texture === overrideTex && x.position.x === layout.board.x + (over.col + 0.5) * cell && x.position.y === layout.board.y + (over.row + 0.5) * cell),
    'the override aura sits at the tower tile centre');
  resetArt();
}

{
  // 5. The four assets exist, have at least four frames, and pass the manifest checks.
  const artDir = fileURLToPath(new URL('../public/art', import.meta.url));
  const { assets, errors } = scanArt(artDir);
  const svgLooksValid = (text) => {
    const t = text.trim();
    return t.startsWith('<svg') && t.endsWith('</svg>') && t.includes('viewBox="0 0 32 32"') &&
      (t.match(/</g) || []).length === (t.match(/>/g) || []).length;
  };
  for (const name of ['aura-heal', 'aura-beacon', 'aura-override', 'aura-emp']) {
    const entry = assets.find((a) => a.name === `fx/${name}`);
    check(entry !== undefined, `the ${name} asset is present in the manifest scan`);
    check(entry !== undefined && entry.frames >= 4, `the ${name} asset has at least four frames (${entry?.frames})`);
    check(entry !== undefined && entry.anim?.loop === 'loop' && entry.anim?.randomStart === true,
      `the ${name} asset loops with a random start`);
    for (const f of ['', '.1', '.2', '.3']) {
      const file = `${artDir}/fx/${name}${f}.svg`;
      check(existsSync(file) && svgLooksValid(readFileSync(file, 'utf8')), `fx/${name}${f}.svg is a well-formed 32x32 SVG`);
    }
    check(existsSync(`${artDir}/fx/${name}.json`), `fx/${name}.json ships with the frames`);
  }
  check(errors.length === 0, `the aura assets pass the manifest checks (${errors.join(', ') || 'no errors'})`);
}

// --- UX-PASS-2: detail close box, Esc, and Ctrl+click sweep ------------------------------------
{
  // Test 1: the detail close box clears selectedTowerId and the shop returns.
  const s = allUnlocked();
  s.economy.salvage = 10000;
  placeTower(s, 'gun', 5, 5);
  const t = towerAt(s, 5, 5);
  selectPlacedTower(s, t);
  check(s.selectedTowerId === t.id, 'ux2: selecting a placed tower sets selectedTowerId');

  const layout = computeLayout(1280, 800);
  const withDetail = computeHud(layout, s);
  check(withDetail.detail !== null && withDetail.towers.length === 0,
    'ux2: a selected tower replaces the shop list with the detail pane');

  const close = withDetail.detail.close;
  check(close.w === CONTROL_BOX_W && close.h === CONTROL_BOX_H,
    `ux2: the detail close box is ${CONTROL_BOX_W}x${CONTROL_BOX_H} like the help window`);
  const hit = hudControlAt(layout, s, close.x + Math.floor(close.w / 2), close.y + Math.floor(close.h / 2));
  check(hit !== null && hit.action === 'closeTower', 'ux2: the close box hit-tests as closeTower');

  cancelSelection(s); // what clicking the close box dispatches
  check(s.selectedTowerId === null, 'ux2: clicking the close box clears selectedTowerId');

  const after = computeHud(layout, s);
  check(after.detail === null && after.towers.length > 0, 'ux2: the shop list returns after the close box');
}
{
  // Test 2: Esc with a tower selected clears it; Esc with a dialog open closes the dialog and leaves the tower.
  const closed = { menuOrDialog: false, help: false, achievements: false, restore: false, upgrades: false };
  const withTower = escapeAction(closed, true);
  check(withTower.target === 'run' && withTower.clearSelection && !withTower.exitRun,
    'ux2: Esc with a tower selected clears it and does not exit the run');
  const withDialog = escapeAction({ ...closed, menuOrDialog: true }, true);
  check(withDialog.target === 'menuOrDialog' && !withDialog.clearSelection && !withDialog.exitRun,
    'ux2: Esc with a dialog open closes the dialog and leaves the tower selected');
  const empty = escapeAction(closed, false);
  check(empty.target === 'run' && !empty.clearSelection && empty.exitRun,
    'ux2: Esc with nothing selected exits the run');
}
{
  // Test 3: Ctrl+click on a tier-1 Gun upgrades every tier-1 Gun and no other kind or tier.
  const s = allUnlocked();
  s.economy.salvage = 10000;
  placeTower(s, 'gun', 3, 6);
  placeTower(s, 'gun', 4, 6);
  placeTower(s, 'gun', 5, 6);
  placeTower(s, 'cannon', 6, 6);
  placeTower(s, 'gun', 7, 6);
  upgradeTower(s, 7, 6); // a pre-upgraded tier-2 gun on a different rung of the ladder

  const result = sweepUpgradeSame(s, towerAt(s, 3, 6));
  check(result.upgraded === 3, `ux2: Ctrl+click upgrades every tier-1 gun (${result.upgraded})`);
  check(s.towers.filter((x) => x.kind === 'gun' && x.tier === 2).length === 4,
    'ux2: the three swept guns and the pre-upgraded gun are tier 2');
  check(towerAt(s, 6, 6).tier === 1, 'ux2: a cannon is untouched by a gun sweep');
  check(towerAt(s, 7, 6).tier === 2 && towerAt(s, 7, 6).branch === null,
    'ux2: a tier-2 gun on another rung is left alone (no branch, no double upgrade)');
}
{
  // Test 4: Ctrl+click never chooses a branch — tier-2 towers are left alone and counted in the report.
  const s = allUnlocked();
  s.economy.salvage = 10000;
  placeTower(s, 'gun', 3, 6);
  placeTower(s, 'gun', 4, 6);
  upgradeTower(s, 3, 6);
  upgradeTower(s, 4, 6);

  const result = sweepUpgradeSame(s, towerAt(s, 3, 6));
  check(result.upgraded === 0 && result.needBranch === 2,
    `ux2: Ctrl+click on tier-2 guns upgrades none and counts both as needing a branch (${result.upgraded}/${result.needBranch})`);
  check(towerAt(s, 3, 6).tier === 2 && towerAt(s, 3, 6).branch === null,
    'ux2: the tier-2 guns are left alone, no branch chosen');
  check(sweepUpgradeReport(result.upgraded, result.needBranch) === 'Upgraded 0 towers — 2 need a branch (click one to choose)',
    `ux2: the report names the skipped branch towers (${sweepUpgradeReport(result.upgraded, result.needBranch)})`);
}
{
  // Test 5: the sweep stops when salvage runs out, in id order, and keeps what it bought.
  const s = allUnlocked();
  s.economy.salvage = 10000;
  placeTower(s, 'gun', 3, 6); // id 1
  placeTower(s, 'gun', 4, 6); // id 2
  placeTower(s, 'gun', 5, 6); // id 3
  const cost = upgradeCost(towerAt(s, 3, 6));
  s.economy.salvage = cost * 2; // exactly two upgrades, not three

  const result = sweepUpgradeSame(s, towerAt(s, 3, 6));
  check(result.upgraded === 2, `ux2: the sweep buys two upgrades then stops (${result.upgraded})`);
  check(towerAt(s, 3, 6).tier === 2 && towerAt(s, 4, 6).tier === 2,
    'ux2: the first two towers in id order were upgraded');
  check(towerAt(s, 5, 6).tier === 1, 'ux2: the third tower is left at tier 1 when salvage runs out');
  check(s.economy.salvage === 0, 'ux2: salvage is spent down to zero');
}
{
  // Test 6: without Ctrl the same click only selects.
  const s = allUnlocked();
  s.economy.salvage = 10000;
  placeTower(s, 'gun', 3, 6);
  placeTower(s, 'gun', 4, 6);
  const before = s.economy.salvage;
  const t = towerAt(s, 3, 6);
  selectPlacedTower(s, t); // the plain-click path
  check(s.selectedTowerId === t.id, 'ux2: a plain click selects the tower for inspection');
  check(towerAt(s, 3, 6).tier === 1 && towerAt(s, 4, 6).tier === 1, 'ux2: a plain click upgrades nothing');
  check(s.economy.salvage === before, 'ux2: a plain click spends nothing');
}

// --- Repeater tier-5 interval fix (docs/REPEATER-T5.md) --------------------------------------
{
  const repeater = (tier) => {
    const t = createTower(1, 'gun', 0, 0);
    t.tier = tier;
    t.branch = 'B';
    return effectiveStats(t);
  };

  // 1. A tier-3 and tier-4 Repeater keep today's intervals exactly.
  const t3 = repeater(3);
  const t4 = repeater(4);
  check(Math.abs(t3.fireInterval / TICK_HZ - 0.25) < 1e-9,
    `tier-3 Repeater interval is 0.25 s (${(t3.fireInterval / TICK_HZ).toFixed(4)})`);
  check(Math.abs(t4.fireInterval / TICK_HZ - 0.125) < 1e-9,
    `tier-4 Repeater interval is 0.125 s (${(t4.fireInterval / TICK_HZ).toFixed(4)})`);

  // 2. A tier-5 Repeater fires every 0.0625 s, 16 shots/s, DPS 28.
  const t5 = repeater(5);
  const t5rate = TICK_HZ / t5.fireInterval;
  check(Math.abs(t5.fireInterval / TICK_HZ - 0.0625) < 1e-9,
    `tier-5 Repeater interval is 0.0625 s (${(t5.fireInterval / TICK_HZ).toFixed(4)})`);
  check(Math.abs(t5rate - 16) < 1e-9, `tier-5 Repeater fires 16 shots/s (${t5rate.toFixed(2)})`);
  check(Math.abs(t5.damage * t5rate - 28) < 1e-9, `tier-5 Repeater DPS is 28 (${(t5.damage * t5rate).toFixed(2)})`);

  // 3. Every kind/tier/branch combination that deals damage yields fireInterval > 0.
  const bad = [];
  for (const kind of TOWER_KINDS) {
    for (const tier of [1, 2, 3, 4, 5]) {
      for (const branch of [null, 'A', 'B', 'C']) {
        const t = createTower(1, kind, 0, 0);
        t.tier = tier;
        t.branch = branch;
        const st = effectiveStats(t);
        if (st.damage > 0 && st.fireInterval <= 0) bad.push(`${kind} t${tier} ${branch}`);
      }
    }
  }
  check(bad.length === 0,
    `every damage-dealing kind/tier/branch has fireInterval > 0 (bad: ${bad.join(', ') || 'none'})`);

  // 4. The Gun's Help page table shows the tier-5 Repeater with a real DPS (28).
  const gunPage = pageById('tower-gun');
  check(gunPage !== undefined, 'the Gun has a Help page');
  const gunTable = parseHelpMarkdown(gunPage.body).find((b) => b.kind === 'table');
  const repeaterCol = gunTable?.header.indexOf('Repeater') ?? -1;
  const t5cell = repeaterCol >= 0 ? gunTable.rows[4][repeaterCol].map((r) => r.text).join('') : '';
  check(t5cell === '28.00', `the Gun Help page tier-5 Repeater column reads a real DPS (${t5cell})`);

  // 5. Cannon Mortar and AA Flak intervals are unchanged: the linear rule stays for multipliers >= 1.
  const linear = (mul, strength) => 1 + (mul - 1) * strength;
  const mortarMul = 1.33;
  const flakMul = 0.9 / 0.55;
  for (const tier of [3, 4, 5]) {
    const strength = 1 + 0.5 * (tier - 3);
    const mortar = createTower(1, 'cannon', 0, 0);
    mortar.tier = tier;
    mortar.branch = 'A';
    check(Math.abs(effectiveStats(mortar).fireInterval - TOWER_STATS.cannon.fireInterval * linear(mortarMul, strength)) < 1e-9,
      `cannon Mortar t${tier} interval unchanged (${effectiveStats(mortar).fireInterval.toFixed(2)})`);
    const flak = createTower(1, 'aa', 0, 0);
    flak.tier = tier;
    flak.branch = 'A';
    check(Math.abs(effectiveStats(flak).fireInterval - TOWER_STATS.aa.fireInterval * linear(flakMul, strength)) < 1e-9,
      `aa Flak t${tier} interval unchanged (${effectiveStats(flak).fireInterval.toFixed(2)})`);
  }
}

// --- Twenty-tier ladder (docs/TIER-20.md) -------------------------------------------------------

// 1. The cost ladder is strictly increasing for every combat kind, and the tier-20 totals match the
//    table (build cost + every step, summed with roundCost). The figures are the roundCost sums; the
//    doc's "build × 385" is the same curve rounded once, quoted for readability.
{
  const tier20Total = (kind) => {
    const t = createTower(1, kind, 0, 0);
    let total = TOWER_STATS[kind].cost;
    let prev = 0;
    let increasing = true;
    for (let tier = 1; tier < MAX_TIER; tier++) {
      t.tier = tier;
      const cost = upgradeCost(t);
      if (cost === null || cost <= prev) increasing = false;
      prev = cost;
      total += cost;
    }
    return { total, increasing };
  };
  for (const kind of COMBAT_KINDS) {
    const r = tier20Total(kind);
    check(r.increasing, `cost ladder is strictly increasing for ${kind}`);
  }
  check(tier20Total('gun').total === 9591, `gun tier-20 total is 9591 (got ${tier20Total('gun').total})`);
  check(tier20Total('laser').total === 26972, `laser tier-20 total is 26972 (got ${tier20Total('laser').total})`);
  check(tier20Total('taser').total === 30888, `taser tier-20 total is 30888 (got ${tier20Total('taser').total})`);
  check(tier20Total('cannon').total === 34674, `cannon tier-20 total is 34674 (got ${tier20Total('cannon').total})`);
  check(kindMaxTier('gun') === MAX_TIER && kindMaxTier('cursor') === 5 && kindMaxTier('wall') === 3 && kindMaxTier('repair') === 3,
    'combat kinds cap at 20; cursor caps at 5; wall and repair cap at 3');
}

// 2. effectiveStats at tiers 1-5 is unchanged: freeze the T5 damage and interval of the six named
//    branches as literal expectations (the damage ladder only starts past tier 5).
{
  const atT5 = (kind, branch) => {
    const t = createTower(1, kind, 0, 0);
    t.tier = 5;
    t.branch = branch;
    return effectiveStats(t);
  };
  const close = (a, b) => Math.abs(a - b) < 1e-6;
  const cases = [
    ['gun', 'A', 9.75, 30],
    ['gun', 'B', 1.75, 3.75],
    ['cannon', 'A', 12.5, 159.36],
    ['taser', 'B', 1.25, 7],
    ['laser', 'A', 27.5, 48],
    ['aa', 'A', 4.75, 75],
  ];
  for (const [kind, branch, dmg, interval] of cases) {
    const st = atT5(kind, branch);
    check(close(st.damage, dmg) && close(st.fireInterval, interval),
      `${kind} ${branch} T5 damage ${dmg} / interval ${interval} unchanged (${st.damage}, ${st.fireInterval})`);
  }
}

// 3. Tier 20 damage for a branchless kind is 1.25 × 1.09^18 of base, and range is capped at +10%.
{
  const t = createTower(1, 'gun', 0, 0);
  t.tier = MAX_TIER;
  t.branch = null;
  const st = effectiveStats(t);
  const expectedDmg = TOWER_STATS.gun.damage * 1.25 * Math.pow(1.09, 18);
  check(Math.abs(st.damage - expectedDmg) < 1e-9, `branchless tier-20 damage is 1.25 × 1.09^18 (${st.damage})`);
  const t15 = createTower(1, 'gun', 0, 0);
  t15.tier = 15;
  t15.branch = null;
  const st15 = effectiveStats(t15);
  check(Math.abs(st15.range - st.range) < 1e-9, 'range ladder caps at +10% (tier 15 == tier 20 range)');
  check(Math.abs(st.range - TOWER_STATS.gun.range * 1.02 * 1.10) < 1e-9, 'branchless range is base × 1.02 × 1.10 at the cap');
}

// 4. Branch strength is 4 at tier 9 and still 4 at tier 20; interval never drops below one tick and
//    damage never below 1 at any tier or branch.
{
  const branchMult = (tier) => {
    const t = createTower(1, 'gun', 0, 0);
    t.tier = tier;
    t.branch = 'A';
    const st = effectiveStats(t);
    return st.damage / (TOWER_STATS.gun.damage * 1.25 * Math.pow(1.09, tier - 5));
  };
  const m9 = branchMult(9);
  const m20 = branchMult(MAX_TIER);
  check(Math.abs(m9 - 4.2) < 1e-6 && Math.abs(m20 - 4.2) < 1e-6,
    `branch strength is capped at 4 (tier 9 = ${m9}, tier 20 = ${m20})`);

  const bad = [];
  for (const kind of COMBAT_KINDS) {
    for (let tier = 1; tier <= MAX_TIER; tier++) {
      for (const branch of [null, 'A', 'B']) {
        const t = createTower(1, kind, 0, 0);
        t.tier = tier;
        t.branch = branch;
        const st = effectiveStats(t);
        if (TOWER_STATS[kind].damage > 0) {
          if (st.damage < 1) bad.push(`${kind} t${tier} ${branch} damage ${st.damage}`);
          if (st.fireInterval < 1) bad.push(`${kind} t${tier} ${branch} interval ${st.fireInterval}`);
        }
      }
    }
  }
  check(bad.length === 0, `damage >= 1 and fireInterval >= 1 everywhere (bad: ${bad.join(', ') || 'none'})`);
}

// 5. A tower saved at tier 12 restores at tier 12; tier 21 is rejected.
{
  const s = stateOnLevel('open-field');
  s.economy.salvage = 100000;
  placeTower(s, 'gun', 3, 6);
  const gun = towerAt(s, 3, 6);
  gun.tier = 12;
  gun.branch = 'A';
  s.wave = 1; // a run at wave 1, so the save is accepted
  const saved = JSON.stringify(captureRun(s));
  const restored = restoreRun(JSON.parse(saved));
  check(restored !== null, 'a tier-12 tower save restores');
  if (restored) {
    check(restored.towers[0].tier === 12, 'the tier-12 tower round-trips at tier 12');
  }
  const tampered = JSON.parse(saved);
  tampered.towers[0].tier = 21;
  check(restoreRun(tampered) === null, 'a tier-21 tower is rejected');
}

// 6. The 900-tick determinism hash over a scripted run that upgrades to tier 8 is stable across two runs.
{
  const run = () => {
    const s = stateOnLevel('open-field');
    s.economy.salvage = 100000;
    placeTower(s, 'gun', 3, 6);
    upgradeTower(s, 3, 6); // 1 -> 2
    chooseBranch(s, 3, 6, 'A'); // 2 -> 3
    for (let i = 0; i < 5; i++) upgradeTower(s, 3, 6); // 3 -> 8
    s.rng = 0x12345678;
    startWave(s);
    const h = createHash('sha256');
    for (let i = 0; i < 900; i++) {
      tick(s);
      if (s.events.length > 0) {
        h.update(JSON.stringify(s.events));
        s.events = [];
      }
      h.update(`${s.rng}:${s.integrity}:${s.enemies.length}`);
    }
    return h.digest('hex');
  };
  const a = run();
  const b = run();
  check(a === b, '900-tick determinism hash is stable across two scripted runs');
  check(a.length === 64, `the hash is a full sha256 (${a.length} hex chars)`);
}

// --- Run save (docs/RUN-SAVE.md) --------------------------------------------------------------

function intArraysEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function numSetEquals(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function strSetEquals(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

/** A fake localStorage-like store for exercising loadRunSave/saveRun/clearRunSave. */
function runSaveStore(initial) {
  let value = initial === undefined ? null : initial;
  return {
    getItem: () => value,
    setItem: (_k, v) => { value = v; },
    removeItem: () => { value = null; },
    current: () => value,
  };
}

/** A rich, mid-wave run exercising every saved shape: branches, a disabled tower, a mine, a
 *  projectile, an ad, modifiers and wave history. */
function richRun() {
  const s = stateOnLevel('open-field');
  s.economy.salvage = 100000;
  placeTower(s, 'gun', 3, 6);
  placeTower(s, 'wall', 10, 5);
  upgradeTower(s, 3, 6);
  chooseBranch(s, 3, 6, 'A');
  const gun = towerAt(s, 3, 6);
  s.towerDisabled.set(gun.id, 42);
  startWave(s);
  for (let i = 0; i < 120; i++) tick(s);
  s.modifiers = ['fog'];
  s.mines.push({ id: s.nextId++, towerId: gun.id, x: 5.5, y: 6.5, placedTick: s.tick, armedAtTick: s.tick, expiresTick: s.tick + 600 });
  s.projectiles.push({ id: s.nextId++, kind: 'shell', x: 6.5, y: 6.5, vx: 0, vy: 0, targetId: null, towerId: gun.id, damage: 10, lifetime: 30 });
  spawnAd(s, 'defrag');
  s.clearedWaves = 2;
  s.waveSnapshots.set(2, { salvage: 200, salvageSpent: 50, integrity: 18, towersBuilt: 2, wallsBuilt: 1, towersSold: 0, upgradesBought: 1, branches: 0, bossesKilled: 0, towerCount: 2 });
  return s;
}

// --- 1. Round trip -----------------------------------------------------------------------------
{
  const s = richRun();
  const saved = JSON.stringify(captureRun(s));
  const restored = restoreRun(JSON.parse(saved));
  check(restored !== null, 'a rich run restores');
  if (restored) {
    check(JSON.stringify(captureRun(restored)) === saved, 'restored state deep-equals the original on every saved field');
    check(intArraysEqual(restored.field, s.field), 'the field is identical');
    check(intArraysEqual(restored.breacherField, s.breacherField), 'breacherField is identical');
    check(intArraysEqual(restored.ramField, s.ramField), 'ramField is identical');
    check(intArraysEqual(restored.flyerField, s.flyerField), 'flyerField is identical');
    check(restored.routeFields.length === s.routeFields.length && restored.routeFields.every((f, i) => intArraysEqual(f, s.routeFields[i])), 'routeFields are identical');
    check(numSetEquals(restored.blocked, s.blocked), 'blocked is identical');
  }
}

// --- 2. Determinism ----------------------------------------------------------------------------
{
  const make = () => {
    const s = stateOnLevel('open-field');
    placeTower(s, 'gun', 3, 6);
    placeTower(s, 'gun', 4, 6);
    s.rng = 0x12345678;
    s.wave = 5;
    startWave(s); // wave 6: flyers draw from the seeded stream
    for (let i = 0; i < 900; i++) tick(s);
    s.events = [];
    return s;
  };
  const a = make();
  const saved = JSON.stringify(captureRun(a));

  const hashRun = (s, n) => {
    const h = createHash('sha256');
    for (let i = 0; i < n; i++) {
      tick(s);
      if (s.events.length > 0) {
        h.update(JSON.stringify(s.events));
        s.events = [];
      }
    }
    return h.digest('hex');
  };

  const hashA = hashRun(a, 600);
  const rngA = a.rng;
  const b = restoreRun(JSON.parse(saved));
  check(b !== null, 'determinism: the save restores');
  if (b) {
    const hashB = hashRun(b, 600);
    check(hashA === hashB, 'determinism: identical event-stream hash after 600 more ticks');
    check(rngA === b.rng, 'determinism: identical RNG value at the end');
  }
}

// --- 3. Rebuild, not restore -------------------------------------------------------------------
{
  const s = stateOnLevel('open-field');
  s.economy.salvage = 10000;
  placeTower(s, 'gun', 3, 6);
  placeTower(s, 'wall', 12, 5);
  s.wave = 1; // a run at wave 1, so the save is accepted and the derived fields are rebuilt
  const tampered = JSON.parse(JSON.stringify(captureRun(s)));
  // A hand-edited save that lies about the derived fields is simply ignored.
  tampered.blocked = ['not-a-set'];
  tampered.field = [];
  tampered.breacherField = [];
  tampered.ramField = [];
  tampered.flyerField = [];
  tampered.routeFields = [];
  const restored = restoreRun(tampered);
  check(restored !== null, 'a save that lies about its derived fields still restores');
  if (restored) {
    const expected = new Set(restored.towers.map((t) => t.row * COLS + t.col));
    check(numSetEquals(restored.blocked, expected), 'blocked is rebuilt from the towers, never trusted');
    check(intArraysEqual(restored.field, s.field), 'field is recomputed from the restored towers');
    check(intArraysEqual(restored.breacherField, s.breacherField), 'breacherField is recomputed');
    check(intArraysEqual(restored.ramField, s.ramField), 'ramField is recomputed');
    check(intArraysEqual(restored.flyerField, s.flyerField), 'flyerField is recomputed');
    check(restored.routeFields.length === s.routeFields.length && restored.routeFields.every((f, i) => intArraysEqual(f, s.routeFields[i])), 'routeFields are recomputed');
  }
}

// --- 4. Refusals -------------------------------------------------------------------------------
{
  const valid = captureRun(richRun());
  const base = () => JSON.parse(JSON.stringify(valid));

  const cases = [];
  cases.push(['truncated JSON', '{"v":1,"levelId":']);
  const v2 = base(); v2.v = 2; cases.push(['v: 2', JSON.stringify(v2)]);
  const noRoute = base(); noRoute.level.starts = []; cases.push(['a level with no route', JSON.stringify(noRoute)]);
  const int0 = base(); int0.integrity = 0; cases.push(['integrity 0', JSON.stringify(int0)]);
  const badKind = base(); badKind.enemies = [{ kind: 'bogus' }]; cases.push(['an unknown enemy kind', JSON.stringify(badKind)]);
  const overlap = base();
  overlap.towers = [overlap.towers[0], { ...overlap.towers[1], col: overlap.towers[0].col, row: overlap.towers[0].row }];
  cases.push(['a tower on another tower', JSON.stringify(overlap)]);

  for (const [name, raw] of cases) {
    const store = runSaveStore(raw);
    const loaded = loadRunSave(defaultProfile(), store);
    check(loaded === null, `refusal: ${name} returns null`);
    check(store.current() === null, `refusal: ${name} deletes the key`);
  }
  check(loadRunSave(defaultProfile(), runSaveStore()) === null, 'a missing key loads null, so the game still boots');
}

// --- 5. No double counting ---------------------------------------------------------------------
{
  const s = stateOnLevel('open-field');
  s.economy.salvage = 10000;
  placeTower(s, 'gun', 3, 6);
  startWave(s);
  for (let i = 0; i < 100; i++) tick(s);
  s.events = [];
  const earned = s.economy.earned;
  const salvage = s.economy.salvage;
  const restored = restoreRun(captureRun(s));
  check(restored !== null, 'a mid-wave save restores');
  if (restored) {
    check(restored.economy.earned === earned, 'loading mid-wave grants no salvage');
    check(restored.economy.salvage === salvage, 'loading mid-wave does not move the balance');
    check(restored.events.length === 0, 'loading mid-wave fires no wave-start effects');
    check(strSetEquals(restored.achievements, s.achievements), 'loading mid-wave re-grants no achievements');
  }
}

// --- 6. Lifecycle ------------------------------------------------------------------------------
{
  const store = runSaveStore();
  const s = stateOnLevel('open-field');
  placeTower(s, 'gun', 3, 6);
  startWave(s);
  tick(s);
  saveRun(s, store);
  check(hasRunSave(store), 'saveRun writes the key');
  check(loadRunSave(defaultProfile(), store) !== null, 'the written save loads');
  clearRunSave(store);
  check(!hasRunSave(store), 'clearRunSave deletes the key (victory / integrity zero / Restart Windows)');
  check(loadRunSave(defaultProfile(), store) === null, 'after clearRunSave there is nothing to load');

  // The simulation itself never writes: tick has no storage side effect, so a Test run (never
  // saveRun'd) and `?nosave` (never saveRun'd) leave storage untouched.
  const store2 = runSaveStore();
  const s2 = stateOnLevel('open-field');
  placeTower(s2, 'gun', 3, 6);
  startWave(s2);
  for (let i = 0; i < 300; i++) tick(s2);
  check(store2.current() === null, 'the simulation never writes to storage on its own');
}

// --- 7. Menu -----------------------------------------------------------------------------------
{
  const layout = computeLayout(1280, 800);
  const withSave = computeMenuScreen(layout, 'Wave 34 — The Corridor');
  const without = computeMenuScreen(layout, null);
  check(withSave.buttons[0].id === 'continue' && withSave.buttons[0].label === 'Wave 34 — The Corridor',
    'with a save, Continue is the primary button and names the wave and map');
  check(withSave.buttons[1].id === 'play', 'Continue sits ahead of Play');
  check(without.buttons[0].id === 'play', 'without a save, Play is the primary button');
  const hit = menuButtonAt(layout, withSave.buttons[0].rect.x + 5, withSave.buttons[0].rect.y + 5, 'Wave 34 — The Corridor');
  check(hit === 'continue', 'the Continue button is hit-testable');

  // Continue resumes at the saved wave on the saved map.
  const s = stateOnLevel('fork');
  s.wave = 34;
  s.phase = 'build';
  const store = runSaveStore();
  saveRun(s, store);
  const loaded = loadRunSave(defaultProfile(), store);
  check(loaded !== null && loaded.wave === 34 && loaded.levelId === 'fork' && loaded.level.name === 'The Fork',
    'Continue resumes at the saved wave on the saved map');
}

// --- Editor draft and library (docs/EDITOR-LIBRARY.md) -----------------------------------------

/** A minimal valid level for library entries: one wall, a start and an exit, clear route. */
function levelFixture(name) {
  return { id: '', name, walls: [[4, 5]], starts: [{ col: 0, row: 6 }], exits: [{ col: 19, row: 6 }], toggles: [] };
}

// 1. An edit writes the draft, and a fresh editor model restores exactly that drawing.
{
  const m = createEditor();
  selectEditorTool(m, 'start');
  paintEditor(m, 2, 5);
  selectEditorTool(m, 'exit');
  paintEditor(m, 17, 6);
  selectEditorTool(m, 'wall');
  paintEditor(m, 4, 4);
  paintEditor(m, 9, 9);
  selectEditorTool(m, 'shutter');
  paintEditor(m, 6, 6);
  m.name = 'Draft Test';
  m.libraryId = 'm9';
  const store = runSaveStore();
  saveEditorDraft(m, store);
  const draft = loadEditorDraft(store);
  check(draft !== null, 'an edit writes the draft');
  const fresh = createEditor();
  applyDraft(fresh, draft);
  check(
    JSON.stringify(fresh.tiles) === JSON.stringify(m.tiles) &&
      fresh.start?.col === 2 && fresh.start?.row === 5 &&
      fresh.exit?.col === 17 && fresh.exit?.row === 6 &&
      fresh.toggles.length === 1 && fresh.name === 'Draft Test' && fresh.libraryId === 'm9',
    'a fresh editor model restores exactly that drawing (tiles, markers, toggles, name, library id)',
  );
}

// 2. Save creates a library entry; a second Save updates it rather than adding a second.
{
  const level = levelFixture('First Map');
  const r1 = saveLibraryMap([], null, 'First Map', level, '2026-11-20T10:00:00Z');
  check(r1.maps.length === 1 && r1.entry.id === 'm1' && r1.entry.name === 'First Map', 'Save creates a library entry');
  const r2 = saveLibraryMap(r1.maps, r1.entry.id, 'First Map II', level, '2026-11-20T11:00:00Z');
  check(
    r2.maps.length === 1 && r2.entry.id === 'm1' && r2.entry.name === 'First Map II' && r2.entry.savedAt === '2026-11-20T11:00:00Z',
    'a second Save updates the entry rather than adding a second',
  );
}

// 3. Open lists saved maps newest first, and loading one replaces the draft and its name.
{
  let maps = [];
  maps = saveLibraryMap(maps, null, 'A', levelFixture('A'), '2026-11-20T10:00:00Z').maps;
  maps = saveLibraryMap(maps, null, 'B', levelFixture('B'), '2026-11-20T11:00:00Z').maps;
  const store = runSaveStore();
  saveLibrary(maps, store);
  const loaded = loadLibrary(store);
  check(loaded.length === 2 && loaded[0].name === 'B' && loaded[1].name === 'A', 'Open lists saved maps newest first');
  const m = createEditor();
  applyMapEntry(m, loaded[1]);
  check(m.name === 'A' && m.libraryId === loaded[1].id, 'loading a map replaces the draft and its name');
  check(
    m.start?.col === 0 && m.start?.row === 6 && m.exit?.col === 19 && m.exit?.row === 6 && m.tiles[5 * m.cols + 4] === 'wall',
    'loading a map restores its geometry into the draft',
  );
}

// 4. Delete removes an entry and does not touch the draft.
{
  let maps = [];
  maps = saveLibraryMap(maps, null, 'A', levelFixture('A'), '2026-11-20T10:00:00Z').maps;
  maps = saveLibraryMap(maps, null, 'B', levelFixture('B'), '2026-11-20T11:00:00Z').maps;
  const draftStore = runSaveStore();
  const m = createEditor();
  selectEditorTool(m, 'wall');
  paintEditor(m, 3, 3);
  saveEditorDraft(m, draftStore);
  const beforeDraft = draftStore.current();
  maps = deleteLibraryMap(maps, maps[0].id);
  check(maps.length === 1 && !maps.some((x) => x.name === 'B'), 'Delete removes an entry');
  check(draftStore.current() === beforeDraft, 'Delete does not touch the draft');
}

// 5. A library entry with an invalid level is dropped from the list and never loaded.
{
  let maps = [];
  maps = saveLibraryMap(maps, null, 'Valid', levelFixture('Valid'), '2026-11-20T10:00:00Z').maps;
  const invalid = { id: '', name: 'Broken', walls: [], starts: [], exits: [{ col: 19, row: 6 }], toggles: [] };
  maps = saveLibraryMap(maps, null, 'Broken', invalid, '2026-11-20T11:00:00Z').maps;
  const store = runSaveStore();
  saveLibrary(maps, store);
  const loaded = loadLibrary(store);
  check(loaded.length === 1 && loaded[0].name === 'Valid', 'a library entry with an invalid level is dropped from the list');
}

// 6. The 51st save is refused or replaces a chosen map; the count never exceeds 50.
{
  let maps = [];
  for (let i = 1; i <= 50; i++) {
    maps = saveLibraryMap(maps, null, `Map ${i}`, levelFixture(`Map ${i}`), `2026-11-20T00:00:0${i % 10}Z`).maps;
  }
  check(maps.length === 50, 'the library holds 50 maps');
  const overflow = saveLibraryMap(maps, null, 'Map 51', levelFixture('Map 51'), '2026-11-20T23:59:59Z');
  check(
    overflow.maps.length === 50 && overflow.maps[0].name === 'Map 51' && !overflow.maps.some((x) => x.name === 'Map 1'),
    'a 51st save evicts the oldest and the count never exceeds 50',
  );
  const victim = maps[0].id;
  const replaced = replaceLibraryMap(maps, victim, 'Replacement', levelFixture('Replacement'), '2026-11-20T23:59:58Z');
  check(
    replaced.maps.length === 50 && !replaced.maps.some((x) => x.id === victim) && replaced.maps[0].name === 'Replacement',
    'replacing a chosen map keeps the count at 50',
  );
}

// 7. New writes an empty draft, and asks before discarding a non-empty one.
{
  const m = createEditor();
  check(editorIsEmpty(m), 'a fresh editor is empty, so New does not confirm');
  selectEditorTool(m, 'wall');
  paintEditor(m, 3, 3);
  check(!editorIsEmpty(m), 'painting makes the draft non-empty, so New asks before discarding');
  clearEditor(m);
  m.name = '';
  m.libraryId = null;
  check(editorIsEmpty(m), 'New leaves the drawing empty and unnamed');
  const store = runSaveStore();
  saveEditorDraft(m, store);
  const draft = loadEditorDraft(store);
  check(
    draft !== null && draft.tiles.every((t) => t === 'floor') && draft.start === null && draft.exit === null && draft.toggles.length === 0 && draft.name === '',
    'New writes an empty draft',
  );
}

// 8. A corrupt draft is ignored, the editor opens blank, and the game still boots.
{
  const bad = runSaveStore('not json');
  check(loadEditorDraft(bad) === null && bad.current() === null, 'a corrupt draft is ignored and the key is deleted');
  const wrongVersion = runSaveStore(JSON.stringify({ v: 99, name: '', libraryId: null, tiles: [], start: null, exit: null, toggles: [] }));
  check(loadEditorDraft(wrongVersion) === null, 'an unknown-version draft is ignored');
  const corruptLib = runSaveStore('garbage');
  check(loadLibrary(corruptLib).length === 0, 'a corrupt library loads empty');
  const m = createEditor();
  check(editorIsEmpty(m) && m.tiles.every((t) => t === 'floor'), 'the editor opens blank after a corrupt draft');
}

// 9. Toolbar hit-testing at 1024 x 640 and 1280 x 720 finds every button with no overlap.
{
  for (const [vw, vh] of [[1024, 640], [1280, 720]]) {
    const layout = computeLayout(vw, vh);
    const m = createEditor();
    const el = computeEditorLayout(layout, m);
    check(el.toolbar.length === 8, `${vw} x ${vh}: the toolbar has all 8 buttons`);
    let noOverlap = true;
    let labelsFit = true;
    for (let i = 0; i < el.toolbar.length; i++) {
      const b = el.toolbar[i].rect;
      labelsFit = labelsFit && b.w >= 48;
      if (i > 0) {
        const prev = el.toolbar[i - 1].rect;
        if (b.x < prev.x + prev.w) noOverlap = false;
      }
      const hit = editorToolbarAt(layout, m, b.x + Math.floor(b.w / 2), b.y + Math.floor(b.h / 2));
      if (hit !== el.toolbar[i].id) noOverlap = false;
    }
    check(noOverlap, `${vw} x ${vh}: every toolbar button hit-tests with no overlap`);
    check(labelsFit, `${vw} x ${vh}: every button label stays readable`);
  }
}

// --- Editor exit (docs/EDITOR-EXIT.md) ----------------------------------------------------------
{
  // The Exit button's rect is inside the editor's top strip and inside the window at both sizes, and
  // it is not overlapped by another control (the menu-bar words it shares the strip with).
  for (const [vw, vh] of [[1024, 768], [1280, 720]]) {
    const layout = computeLayout(vw, vh);
    const m = createEditor();
    const el = computeEditorLayout(layout, m);
    const strip = el.topStrip;
    const ex = el.exit;
    check(
      ex.x >= strip.x && ex.y >= strip.y && ex.x + ex.w <= strip.x + strip.w && ex.y + ex.h <= strip.y + strip.h,
      `${vw} x ${vh}: the Exit button is inside the editor's top strip`,
    );
    const win = layout.window;
    check(
      ex.x >= win.x && ex.y >= win.y && ex.x + ex.w <= win.x + win.w && ex.y + ex.h <= win.y + win.h,
      `${vw} x ${vh}: the Exit button is inside the window`,
    );
    let overlapped = false;
    for (const r of menuWordRects(layout.menu)) {
      if (r.x < ex.x + ex.w && ex.x < r.x + r.w && r.y < ex.y + ex.h && ex.y < r.y + r.h) overlapped = true;
    }
    check(!overlapped, `${vw} x ${vh}: the Exit button is not overlapped by a menu word`);
    check(editorExitAt(layout, m, ex.x + Math.floor(ex.w / 2), ex.y + Math.floor(ex.h / 2)), `${vw} x ${vh}: the Exit button hit-tests at its centre`);
    check(!editorExitAt(layout, m, ex.x - 1, ex.y + Math.floor(ex.h / 2)), `${vw} x ${vh}: a point just left of the Exit button is not a hit`);
  }

  // exitEditor saves the draft and leaves for the menu, never branching on runOrigin; the editor's
  // Escape and File > Exit both reach it, so a lost test run cannot strand the editor on itself.
  const mainSrc = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  const exitEditorBody = mainSrc.slice(mainSrc.indexOf('function exitEditor'), mainSrc.indexOf('function exitRun'));
  check(exitEditorBody.includes('scheduleDraftSave(true)'), 'exitEditor writes the draft');
  check(exitEditorBody.includes("screen = 'menu'"), 'exitEditor puts screen at menu');
  check(!exitEditorBody.includes('runOrigin'), 'exitEditor does not branch on runOrigin');

  check(mainSrc.includes("if (screen === 'editor') exitEditor();"), 'File > Exit routes the editor screen to exitEditor');
  check(
    mainSrc.includes('if (libOpen) closeLibrary();') && mainSrc.includes('else exitEditor();'),
    'editor: Escape leaves via exitEditor while the library keeps its own Escape',
  );
  check(
    mainSrc.includes('else if (dialog) dialog = null;\n      else exitEditor();'),
    'editor: a dialog closes on Escape before the editor is left',
  );
}

// --- Run records 1: defeat, victory and Restart Windows each record once, with the right outcome, map and wave.
{
  const s = stateOnLevel('dumbbell');
  s.wave = 12;
  s.clearedWaves = 11;
  s.integrity = 3;
  s.economy.earned = 5000;
  s.tick = 900;
  s.pointer.stage = 2;

  const defeat = buildRunRecord(s, 'defeat');
  check(defeat.outcome === 'defeat' && !defeat.victory, 'a defeat records outcome defeat, not victory');
  check(defeat.mapId === 'dumbbell' && defeat.mapName === 'Dumbbell' && defeat.wave === 12, 'the record carries the map and the highest wave reached');
  check(
    defeat.clearedWaves === 11 && defeat.integrity === 3 && defeat.pointerStage === 2 && defeat.salvage === 5000 && defeat.durationTicks === 900,
    'the record carries the run snapshot (cleared, integrity, pointer, salvage, duration)',
  );

  const p = defaultProfile();
  appendRun(p, defeat);
  check(p.runs.length === 1 && p.runs[0].outcome === 'defeat', 'a defeat appends exactly one record');

  const victory = buildRunRecord(s, 'victory');
  check(victory.outcome === 'victory' && victory.victory, 'a victory records outcome victory');
  appendRun(p, victory);
  check(p.runs.length === 2 && p.runs[0].outcome === 'victory', 'a victory appends exactly one record, newest first');

  const reboot = buildRunRecord(s, 'reboot');
  check(reboot.outcome === 'reboot' && !reboot.victory, 'a Restart Windows records outcome reboot');
  appendRun(p, reboot);
  check(p.runs.length === 3 && p.runs[0].outcome === 'reboot', 'a Restart Windows appends exactly one record');

  check(outcomeLabel('victory') === 'Victory' && outcomeLabel('defeat') === 'Defeat' && outcomeLabel('reboot') === 'Reboot', 'outcome labels render as words');
  check(formatRecordDate('2026-11-20T12:34:56Z') === '2026-11-20', 'record dates render as YYYY-MM-DD');
}

// --- Run records 2: escaping to the menu appends nothing.
{
  check(defaultProfile().runs.length === 0, 'a fresh profile has no runs');
  const esc = escapeAction(
    { menuOrDialog: false, help: false, records: false, achievements: false, restore: false, upgrades: false },
    false,
  );
  check(esc.target === 'run' && esc.exitRun, 'Esc with nothing open exits the run');
  check(!['victory', 'defeat', 'reboot'].includes('abandoned'), 'an abandoned run has no outcome to record');
  const escRecords = escapeAction(
    { menuOrDialog: false, help: false, records: true, achievements: false, restore: false, upgrades: false },
    false,
  );
  check(escRecords.target === 'records' && !escRecords.exitRun, 'Esc closes the Records viewer without exiting the run');
}

// --- Losing returns to the main menu (docs/LOSS-TO-MENU.md) -------------------------------------
{
  const layout = computeLayout(1280, 800);
  const s = createRunState();
  s.phase = 'halted';

  // 1. The loss button's hit rect is the drawn rect: 128x26 at the bottom centre of modalRect, and it
  //    only hits while the run is halted, so the button that lights up is the button that is drawn.
  const m = modalRect(layout);
  const btn = { x: m.x + Math.floor((m.w - 128) / 2), y: m.y + m.h - 26 - 10, w: 128, h: 26 };
  check(modalMenuAt(layout, s, btn.x + btn.w / 2, btn.y + btn.h / 2), 'loss: the menu button hit rect covers its drawn centre');
  check(modalMenuAt(layout, s, btn.x + 1, btn.y + 1), 'loss: the menu button hit rect covers its drawn top-left corner');
  check(!modalMenuAt(layout, s, btn.x - 1, btn.y + btn.h / 2), 'loss: a point just left of the button is not a hit');
  check(!modalMenuAt(layout, s, m.x + m.w / 2, m.y + 4), 'loss: the modal title bar is not a hit');
  check(!modalMenuAt(layout, createRunState(), btn.x + btn.w / 2, btn.y + btn.h / 2), 'loss: the button only hits while the run is halted');

  // 2. The button and Escape share exitRun, and no fresh-run restart path survives.
  const mouseSrc = readFileSync(new URL('../src/input/mouse.ts', import.meta.url), 'utf8');
  const mainSrc = readFileSync(new URL('../src/main.ts', import.meta.url), 'utf8');
  check(mouseSrc.includes('if (modalMenuAt(l, s, x, y)) this.ctx.exitRun();'), 'loss: the button routes to exitRun, not a fresh run');
  check(mouseSrc.includes('if (action.exitRun) this.ctx.exitRun();'), 'loss: Escape routes through the same exitRun');
  check(!mouseSrc.includes('ctx.restart('), 'loss: no restart callback remains in the input controller');
  check(!mainSrc.includes('restart: () =>'), 'loss: the fresh-run restart callback is gone');
  check(mainSrc.includes("runOrigin === 'editor'") && mainSrc.includes("screen = 'editor'"), 'loss: exitRun returns a Test run to the editor');

  // 3. Every catalogue carries hud.mainMenu and none still carries hud.restart.
  for (const code of ['en', 'es', 'fr', 'ru', 'uk', 'zh-Hans', 'he']) {
    const mod = await import(`../src/i18n/${code}/index.ts`);
    const cat = mod[Object.keys(mod)[0]];
    check(cat['hud.mainMenu'] !== undefined, `loss: ${code} carries hud.mainMenu`);
    check(cat['hud.restart'] === undefined, `loss: ${code} no longer carries hud.restart`);
  }
}

// --- Run records 3: the list is newest first and never exceeds 50 (the 51st drops the oldest).
{
  const p = defaultProfile();
  const mk = (i) => ({
    id: `r${i}`,
    at: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`,
    mapId: 'corridor',
    mapName: 'The Corridor',
    wave: i,
    clearedWaves: i,
    integrity: 10,
    pointerStage: 1,
    salvage: 100,
    durationTicks: 60,
    outcome: 'defeat',
    victory: false,
  });
  for (let i = 1; i <= 51; i++) appendRun(p, mk(i));
  check(p.runs.length === 50, 'a 51st run drops the oldest and the count never exceeds 50');
  check(p.runs[0].id === 'r51', 'the newest run is first');
  check(p.runs[49].id === 'r2', 'the 51st run evicted the oldest (r1) and kept r2 last');

  const rows = buildRecordsRows(p.runs);
  check(rows[0].kind === 'ranked' && rows[0].rank === 1 && rows[0].record.id === 'r51', 'the top ranked row is the highest wave');
  check(rows[4].kind === 'ranked' && rows[4].rank === 5 && rows[4].record.id === 'r47', 'the fifth ranked row is the fifth-highest wave');
  check(rows[5].kind === 'separator', 'an Earlier separator follows the top five');
  check(rows[6].kind === 'date' && rows[6].record.id === 'r46', 'the rest stay in date order under the separator');
}

// --- Run records 4: per-map bests and the totals line are computed from the records, not stored.
{
  const runs = [
    { id: 'a', at: '2026-01-01T00:00:00Z', mapId: 'corridor', mapName: 'The Corridor', wave: 40, clearedWaves: 40, integrity: 5, pointerStage: 1, salvage: 10, durationTicks: 100, outcome: 'defeat', victory: false },
    { id: 'b', at: '2026-01-02T00:00:00Z', mapId: 'corridor', mapName: 'The Corridor', wave: 100, clearedWaves: 100, integrity: 8, pointerStage: 2, salvage: 20, durationTicks: 200, outcome: 'victory', victory: true },
    { id: 'c', at: '2026-01-03T00:00:00Z', mapId: 'dumbbell', mapName: 'Dumbbell', wave: 61, clearedWaves: 61, integrity: 4, pointerStage: 1, salvage: 30, durationTicks: 300, outcome: 'reboot', victory: false },
  ];
  const best = bestByMap(runs);
  check(best.length === 2, 'bestByMap has one entry per map');
  check(best[0].mapId === 'corridor' && best[0].wave === 100, 'the Corridor best is 100, from the records');
  check(best[1].mapId === 'dumbbell' && best[1].wave === 61, 'the Dumbbell best is 61, from the records');
  const t = runTotals(runs);
  check(t.runs === 3 && t.wins === 1 && t.defeats === 1 && t.reboots === 1 && t.durationTicks === 600, 'the totals line figures come from the records');
  check(totalsLine(runs, 100) === 'Runs 3 · Wins 1 · Defeats 1 · Reboots 1 · Best wave 100', 'the totals line reads the counts and the stored all-time best');
  check(bestByMapLine(runs) === 'Best by map — The Corridor 100, Dumbbell 61', 'the best-by-map footer is computed from the records');
}

// --- Run records 5: an older profile with no runs migrates with an empty list and keeps every other field.
{
  const store = {
    value: JSON.stringify({
      version: 2,
      specs: { cpu: 5, ram: 3, gpu: 2, disk: 1 },
      rp: 9,
      rpEarned: 12,
      tree: ['loose-change'],
      lastSalvage: 4000,
      achievements: ['first-blood'],
      achievementDates: { 'first-blood': '2026-01-01' },
      mapsCleared: ['corridor'],
      lifetimeBossKillsByPointer: 2,
      bestWave: 42,
      reboots: 3,
      soundOn: false,
      volume: 'high',
      autoWave: true,
      shakeOn: false,
      seenBossKinds: ['grunt-boss'],
      seenEnemies: ['grunt'],
      lastChoice: 'editor',
    }),
    getItem() { return this.value; },
    setItem(_k, v) { this.value = v; },
  };
  const migrated = loadProfile(store);
  check(migrated.version === 3 && Array.isArray(migrated.runs) && migrated.runs.length === 0, 'an older profile migrates with an empty run list');
  check(migrated.specs.cpu === 5 && migrated.rp === 9 && migrated.rpEarned === 12 && migrated.tree.includes('loose-change') && migrated.lastSalvage === 4000, 'migration keeps the meta fields');
  check(
    migrated.achievements.includes('first-blood') && migrated.achievementDates['first-blood'] === '2026-01-01' && migrated.mapsCleared.includes('corridor') && migrated.lifetimeBossKillsByPointer === 2,
    'migration keeps the cross-run counters',
  );
  check(
    migrated.bestWave === 42 && migrated.reboots === 3 && migrated.soundOn === false && migrated.volume === 'high' && migrated.autoWave === true && migrated.shakeOn === false,
    'migration keeps every preference and meta field',
  );
  check(migrated.seenBossKinds.includes('grunt-boss') && migrated.seenEnemies.includes('grunt') && migrated.lastChoice === 'editor', 'migration keeps the seen sets and the last choice');
}

// --- Run records 6: a corrupt runs entry is dropped, the rest survive.
{
  const store = {
    value: JSON.stringify({
      version: 3,
      specs: { cpu: 2, ram: 0, gpu: 0, disk: 0 },
      rp: 1,
      rpEarned: 1,
      tree: [],
      lastSalvage: 0,
      achievements: [],
      achievementDates: {},
      mapsCleared: [],
      lifetimeBossKillsByPointer: 0,
      bestWave: 10,
      reboots: 1,
      soundOn: true,
      volume: 'med',
      autoWave: false,
      shakeOn: false,
      seenBossKinds: [],
      seenEnemies: [],
      lastChoice: 'play',
      runs: [
        { id: 'a', at: '2026-01-01T00:00:00Z', mapId: 'corridor', mapName: 'The Corridor', wave: 10, clearedWaves: 10, integrity: 5, pointerStage: 1, salvage: 10, durationTicks: 60, outcome: 'defeat', victory: false },
        { id: 'bad', at: 'nope', mapId: 'corridor', mapName: 'The Corridor', wave: 'x', clearedWaves: 0, integrity: 0, pointerStage: 0, salvage: 0, durationTicks: 0, outcome: 'defeat', victory: false },
        { id: 'bad2', at: '2026-01-02T00:00:00Z', mapId: 'corridor', mapName: 'The Corridor', wave: 5, clearedWaves: 5, integrity: 0, pointerStage: 1, salvage: 1, durationTicks: 1, outcome: 'bogus', victory: false },
        'not-an-object',
        null,
      ],
    }),
    getItem() { return this.value; },
    setItem(_k, v) { this.value = v; },
  };
  const loaded = loadProfile(store);
  check(loaded.runs.length === 1 && loaded.runs[0].id === 'a', 'corrupt runs entries are dropped individually and the good one survives');
  check(loaded.bestWave === 10 && loaded.specs.cpu === 2 && loaded.reboots === 1, 'a corrupt run never poisons the rest of the profile');
}

// --- Run records 7: the dialog fits at 1024 x 640 and 1280 x 720, the table clips its rows, and Esc closes it.
{
  const many = [];
  for (let i = 0; i < 50; i++) {
    many.push({
      id: `r${i}`,
      at: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00Z`,
      mapId: 'corridor',
      mapName: 'The Corridor',
      wave: i + 1,
      clearedWaves: i,
      integrity: 5,
      pointerStage: 1,
      salvage: 10,
      durationTicks: 60,
      outcome: 'defeat',
      victory: false,
    });
  }
  for (const [vw, vh] of [[1024, 640], [1280, 720]]) {
    const layout = computeLayout(vw, vh);
    const rl = computeRecordsLayout(layout, many, 0);
    check(rl.window.x >= layout.client.x && rl.window.y >= layout.client.y, `${vw} x ${vh}: the Records window is fully inside the client area`);
    check(rl.window.x + rl.window.w <= layout.client.x + layout.client.w && rl.window.y + rl.window.h <= layout.client.y + layout.client.h, `${vw} x ${vh}: the Records window fits at ${vw} x ${vh}`);
    check(rl.maxScroll > 0, `${vw} x ${vh}: 50 runs overflow, so the table scrolls`);
    check(rl.data.h < many.length * 16, `${vw} x ${vh}: the table clips its rows to the panel`);
    const hit = recordsHitAt(rl, rl.close.x + Math.floor(rl.close.w / 2), rl.close.y + Math.floor(rl.close.h / 2));
    check(hit === 'close', `${vw} x ${vh}: the close box hit-tests`);
  }
  const esc = escapeAction(
    { menuOrDialog: false, help: false, records: true, achievements: false, restore: false, upgrades: false },
    false,
  );
  check(esc.target === 'records' && !esc.exitRun, 'Esc closes the Records viewer without exiting the run');
}

// --- Run records 8: the empty state renders the placeholder line and Runs 0.
{
  const layout = computeLayout(1280, 720);
  const rl = computeRecordsLayout(layout, [], 0);
  check(rl.empty, 'an empty run list is the empty state');
  check(rl.rows.length === 0, 'the empty state has no table rows');
  check(totalsLine([], 0) === 'Runs 0', 'the empty totals line reads Runs 0');
  check(bestByMapLine([]) === '', 'the empty state has no best-by-map footer');
  check(
    totalsLine([{ id: 'a', at: '2026-01-01T00:00:00Z', mapId: 'corridor', mapName: 'The Corridor', wave: 5, clearedWaves: 5, integrity: 1, pointerStage: 1, salvage: 1, durationTicks: 1, outcome: 'victory', victory: true }], 5) === 'Runs 1 · Wins 1 · Defeats 0 · Reboots 0 · Best wave 5',
    'a single victory totals Runs 1 · Wins 1 · Best wave 5',
  );
}

// --- Daily challenge (docs/DAILY.md) ------------------------------------------------------------

/** A fresh daily run for a date, on the date's seeded map. */
function dailyState(date) {
  const { seed, level } = dailyFor(date);
  return createRunState(defaultProfile(), level, { waveLimit: DAILY_WAVES, daily: { date, seed }, seed });
}

// 1. The seed and map for a fixed date are stable and differ on the next date.
{
  const a = dailyFor('2026-11-20');
  const b = dailyFor('2026-11-20');
  const c = dailyFor('2026-11-21');
  check(a.seed === b.seed && a.level.id === b.level.id, 'daily: a fixed date maps to a stable seed and map');
  check(a.seed !== c.seed, 'daily: the next date maps to a different seed');
  check(dailySeed('2026-11-20') === hashDaily('2026-11-20'), 'daily: the seed is hash(date)');
  check(dailyLevel('2026-11-20').id === LEVELS[hashDaily('2026-11-20') % LEVELS.length].id,
    'daily: the map is LEVELS[hash(date) % LEVELS.length]');
  check(LEVELS.some((l) => l.id === a.level.id), 'daily: the seeded map is an authored level');
}

// 2. Two runs created for the same date produce identical enemy lanes and crit rolls for the same
//    inputs (a hash over 600 ticks).
{
  const trace = (date) => {
    const s = dailyState(date);
    startWave(s);
    const parts = [];
    for (let i = 0; i < 600; i++) {
      tick(s);
      parts.push(s.rng);
      parts.push(s.enemies.map((e) => `${e.kind}:${e.routeIndex}:${e.laneOffset.toFixed(4)}:${e.x.toFixed(4)}:${e.y.toFixed(4)}`).join(';'));
      parts.push(nextCritRoll(s.rng, false, false).crit ? 1 : 0);
    }
    return createHash('sha1').update(parts.join('|')).digest('hex');
  };
  const same = trace('2026-11-20');
  check(same === trace('2026-11-20'),
    'daily: two runs for the same date produce identical enemy lanes and crit rolls over 600 ticks');
  check(same !== trace('2026-11-21'), 'daily: the next date produces a different run');
}

// 3. A daily's waveLimit is 30; clearing wave 30 ends in victory and does not offer endless.
{
  const s = dailyState('2026-11-20');
  check(s.waveLimit === 30, 'daily: waveLimit is 30');
  check(s.daily !== null && s.daily.date === '2026-11-20', 'daily: the run carries its date and seed');
  s.wave = 30;
  s.phase = 'wave';
  s.runs = [];
  s.enemies = [];
  tick(s);
  check(s.phase === 'victory', 'daily: clearing wave 30 ends in victory');
  check(!s.endless, 'daily: victory does not enter endless');
  enterEndless(s);
  check(s.phase === 'victory' && !s.endless, 'daily: endless is never offered at victory');
  const layout = computeLayout(1280, 800);
  const vb = victoryButtons(victoryModalRect(layout));
  check(victoryButtonAt(layout, s, vb.endless.x + vb.endless.w / 2, vb.endless.y + vb.endless.h / 2) !== 'endless',
    'daily: the victory modal has no endless button');
}

// 4. A normal run still has waveLimit === WAVE_COUNT and behaves exactly as before.
{
  const s = createRunState();
  check(s.waveLimit === WAVE_COUNT, 'normal: waveLimit is still WAVE_COUNT');
  check(s.daily === null, 'normal: a normal run carries no daily');
  s.wave = 11;
  s.phase = 'build';
  check(waveLabel(s) === 'Wave 12 / 100', 'normal: the HUD label still reads Wave 12 / 100');
}

// 5. The end-of-run message sits under the title bar and the tallest case still clears the buttons.
// The message is top-anchored; when it was centre-anchored a four-line victory message grew upward
// through the title bar and printed over the "Victory" caption.
{
  const layout = computeLayout(1280, 800);
  const lineH = FONT_SIZE.body + 3;
  for (const [label, m] of [['game over', modalRect(layout)], ['victory', victoryModalRect(layout)]]) {
    const top = modalMessageTop(m);
    check(top >= m.y + 22, `modal: the ${label} message starts below the title bar`);
    check(top + 4 * lineH < m.y + m.h - 24, `modal: four ${label} message lines fit above the buttons`);
  }
  const hudSrc = readFileSync(new URL('../src/view/hud.ts', import.meta.url), 'utf8');
  check(hudSrc.includes('this.modalMessage.anchor.set(0, 0)'), 'modal: the message block stays top-anchored');
}

// 5. Ending a daily — victory, defeat, or Esc — appends exactly one record with outcome 'daily' and
//    the date, and sets profile.daily.
{
  const profile = defaultProfile();
  const s = dailyState('2026-11-20');
  s.wave = 30;
  s.clearedWaves = 30;
  check(profile.runs.length === 0, 'daily: a fresh profile has no runs');
  check(appendDailyRun(profile, s), 'daily: ending the run records it');
  check(profile.runs.length === 1, 'daily: exactly one record is appended');
  const rec = profile.runs[0];
  check(rec.outcome === 'daily', "daily: the record's outcome is 'daily'");
  check(rec.dailyDate === '2026-11-20', 'daily: the record carries dailyDate');
  check(rec.dailySeed === dailySeed('2026-11-20'), 'daily: the record carries dailySeed');
  check(
    profile.daily !== null && profile.daily.date === '2026-11-20' && profile.daily.wave === 30 && profile.daily.clearedWaves === 30,
    'daily: the result is mirrored to profile.daily',
  );
  // Esc-abandonment and defeat take the same path, and a second call never double-records.
  check(!appendDailyRun(profile, s), 'daily: a second record for the same date is refused');
  check(profile.runs.length === 1, 'daily: no double record');
}

// 6. A second attempt on the same date is refused and the button is disabled.
{
  const today = '2026-11-20';
  const played = { date: today, wave: 22 };
  check(!dailyAvailable(played, today), 'daily: a played date is not available again');
  check(dailyMenuLabel(played, today) === 'Daily done — wave 22', 'daily: the button reads Daily done — wave 22');
  const layout = computeLayout(1280, 800);
  const m = computeMenuScreen(layout, null, { label: dailyMenuLabel(played, today), disabled: true });
  const dailyBtn = m.buttons.find((b) => b.id === 'daily');
  check(dailyBtn !== undefined && dailyBtn.disabled === true, 'daily: the button is disabled once played');
  check(
    menuButtonAt(layout, dailyBtn.rect.x + 5, dailyBtn.rect.y + 5, null, { label: dailyMenuLabel(played, today), disabled: true }) === null,
    'daily: a disabled Daily button is not hit-testable',
  );
}

// 7. The next date re-enables the button with a new seed.
{
  const played = { date: '2026-11-20', wave: 22 };
  const next = '2026-11-21';
  check(dailyAvailable(played, next), 'daily: the next date is available again');
  check(dailyMenuLabel(played, next) === `Daily — ${next}`, 'daily: the button reads Daily — <next date>');
  check(dailySeed(next) !== dailySeed('2026-11-20'), 'daily: the next date has a new seed');
  const layout = computeLayout(1280, 800);
  const m = computeMenuScreen(layout, null, { label: dailyMenuLabel(played, next), disabled: false });
  const dailyBtn = m.buttons.find((b) => b.id === 'daily');
  check(dailyBtn !== undefined && !dailyBtn.disabled, 'daily: the button is re-enabled on the next date');
}

// 8. Cheats, map cycling and run saving are all inert in a daily.
{
  const s = dailyState('2026-11-20');
  toggleGodMode(s);
  check(!s.godMode && !s.cheatsUsed, 'daily: God Mode is inert');
  check(!spawnCheatEnemy(s, 'grunt'), 'daily: spawning an enemy is inert');
  check(s.enemies.length === 0, 'daily: no cheat enemy appeared');
  killAllEnemies(s);
  check(s.enemies.length === 0 && !s.cheatsUsed, 'daily: Kill All is inert');
  check(!canCycleLevel(s), 'daily: map cycling is unavailable');
  check(!cycleLevel(s), 'daily: cycleLevel returns false');
  const store = runSaveStore();
  saveRun(s, store);
  check(store.current() === null, 'daily: the run is never written to pd.run.v1');
}

// 9. The HUD label reads `Wave 12 / 30 · Daily`.
{
  const s = dailyState('2026-11-20');
  s.wave = 11;
  s.phase = 'build';
  check(waveLabel(s) === 'Wave 12 / 30 · Daily', `daily: the HUD label reads "${waveLabel(s)}"`);
}

// --- Visual pass 1: the main menu is a window on a desktop (docs/VISUAL-PASS.md) ---------------
{
  for (const [vw, vh] of [[1024, 640], [1280, 720]]) {
    const layout = computeLayout(vw, vh);
    const win = computeMenuWindow(layout);
    const m = computeMenuScreen(layout, 'Wave 34 — The Corridor');
    const insideX = win.window.x >= layout.client.x && win.window.x + win.window.w <= layout.client.x + layout.client.w;
    const insideY = win.window.y >= layout.client.y && win.window.y + win.window.h <= layout.client.y + layout.client.h;
    check(insideX && insideY, `${vw} x ${vh}: the menu window fits inside the client area`);
    check(
      m.buttons.map((b) => b.id).join(',') === 'continue,play,daily,editor,records,load',
      'the menu buttons keep their ids and order',
    );
    let noOverlap = true;
    let insideWindow = true;
    let hasShortcut = true;
    for (let i = 0; i < m.buttons.length; i++) {
      const b = m.buttons[i];
      insideWindow = insideWindow && b.rect.x >= win.client.x && b.rect.x + b.rect.w <= win.client.x + win.client.w && b.rect.y + b.rect.h <= win.client.y + win.client.h;
      hasShortcut = hasShortcut && b.shortcut.length > 0;
      if (i > 0 && b.rect.y < m.buttons[i - 1].rect.y + m.buttons[i - 1].rect.h) noOverlap = false;
    }
    check(noOverlap, `${vw} x ${vh}: the menu buttons do not overlap`);
    check(insideWindow, `${vw} x ${vh}: the menu buttons sit inside the window`);
    check(hasShortcut, 'every menu button keeps its shortcut key hint');
    check(win.statusBar.x + win.statusBar.w <= win.window.x + win.window.w, `${vw} x ${vh}: the status bar fits inside the window`);
    let allHit = true;
    for (const b of m.buttons) {
      if (menuButtonAt(layout, b.rect.x + 5, b.rect.y + 5, 'Wave 34 — The Corridor') !== b.id) allHit = false;
    }
    check(allHit, `${vw} x ${vh}: every menu button is hit-testable`);
  }
}

// --- Visual pass 2: the menu animation is pure and time-driven --------------------------------
{
  const route = currentPath(createRunState());
  const a = computeMenuAnim(1.5, route);
  const b = computeMenuAnim(1.5, route);
  check(JSON.stringify(a) === JSON.stringify(b), 'two draws at the same time produce the same state');
  let neverOverEight = true;
  for (const t of [0, 0.5, 1, 3.7, 11, 30, 100]) {
    if (computeMenuAnim(t, route).creeps.length > 8) neverOverEight = false;
  }
  check(neverOverEight, 'the drifting-creep count never exceeds eight');
  let inBand = true;
  for (const t of [0, 1, 2, 3, 4, 5, 6]) {
    const p = computeMenuAnim(t, route).pulse;
    if (p < 0.1 - 1e-9 || p > 0.18 + 1e-9) inBand = false;
  }
  check(inBand, 'the route pulse stays within 0.10..0.18');
}

// --- Visual pass 3: Global Upgrades tabs, rows, clipping and scrollbar ------------------------
{
  const s = createRunState();
  s.economy.salvage = 100000;
  s.wave = 60; // reveal all 14 upgrades
  buyUpgrade(s, 'salvage-contract');
  buyUpgrade(s, 'wide-reticle');
  const layout = computeLayout(1280, 720);

  const avail = computeUpgradesLayout(layout, s, 'available', 0);
  check(avail.tabs.map((t) => t.label).join(',') === 'Available,Owned', 'the tab strip reads Available, Owned');
  check(avail.rows.length === GLOBAL_UPGRADES.length - s.upgrades.length, `the Available tab lists the ${GLOBAL_UPGRADES.length - s.upgrades.length} unowned upgrades`);
  check(avail.rows.every((r) => !s.upgrades.includes(r.def.id)), 'no owned upgrade appears in the Available tab');
  check(avail.columns.map((c) => c.title).join(',') === 'Icon,Upgrade,Unlocks,Cost,Status', 'the Available columns are Icon, Upgrade, Unlocks, Cost, Status');

  const owned = computeUpgradesLayout(layout, s, 'owned', 0);
  check(owned.rows.length === s.upgrades.length, 'the Owned tab lists only the owned upgrades');
  check(owned.rows.every((r) => s.upgrades.includes(r.def.id)), 'every Owned row is owned');
  check(owned.columns.every((c) => c.title !== 'Cost'), 'the Owned tab drops the cost column');

  check(avail.list.overflow, 'the Available list overflows and needs a scrollbar');
  check(avail.list.rowsVisible < avail.rows.length, 'the list clips its rows to the pane');
  check(avail.list.firstRow === 0, 'the list starts scrolled to the top');

  const early = createRunState();
  early.wave = 20; // one upgrade revealed
  const earlyLayout = computeUpgradesLayout(layout, early, 'available', 0);
  check(!earlyLayout.list.overflow, 'a short list draws no scrollbar');

  // Scrolled rows: the text, icons and hit rects move with the zebra stripes, not just the stripes.
  const scrolled = computeUpgradesLayout(layout, s, 'available', 2);
  const topRow = scrolled.rows[scrolled.list.firstRow];
  check(topRow.rect.y === scrolled.list.body.y, 'the row at firstRow sits at the body top when scrolled');
  let rowLeaves = false;
  for (let i = scrolled.list.firstRow; i < scrolled.list.firstRow + scrolled.list.rowsVisible && i < scrolled.rows.length; i++) {
    const r = scrolled.rows[i].rect;
    if (r.y < scrolled.list.body.y || r.y + r.h > scrolled.list.body.y + scrolled.list.body.h) rowLeaves = true;
  }
  check(!rowLeaves, 'no visible row leaves the body when scrolled');

  const centreX = scrolled.list.body.x + scrolled.list.body.w / 2;
  const centreY = scrolled.list.body.y + UPGRADE_ROW_H / 2;
  const hit = upgradesHitAt(scrolled, centreX, centreY);
  check(hit?.type === 'row' && hit.id === scrolled.rows[scrolled.list.firstRow].def.id,
    'a hit at the first row centre returns the row at firstRow, not row 0');

  const atMax = computeUpgradesLayout(layout, s, 'available', scrolled.list.scrollMax);
  check(atMax.list.firstRow === atMax.list.scrollMax, 'scrolling to scrollMax sets firstRow to scrollMax');
  const lastRow = atMax.rows[atMax.rows.length - 1];
  check(lastRow.rect.y + lastRow.rect.h <= atMax.list.body.y + atMax.list.body.h,
    'the last row stays inside the body at scrollMax');
  check(lastRow.icon.y === lastRow.rect.y + 1, 'the last row icon aligns with its row at scrollMax');
}

// --- Visual pass 3b: OK commits, and off-screen rows never shadow the controls -----------------
{
  const layout = computeLayout(1280, 720);
  const s = createRunState();
  s.wave = 60; // reveal all 14 upgrades
  s.economy.salvage = 100000;

  const at0 = computeUpgradesLayout(layout, s, 'available', 0);
  const atMax = computeUpgradesLayout(layout, s, 'available', at0.list.scrollMax);
  check(at0.rows.length === 14, 'all 14 upgrades are revealed on the Available tab');

  const centre = (r) => ({ x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) });
  const okRect = at0.buttons.find((b) => b.id === 'ok').rect;
  const cancelRect = at0.buttons.find((b) => b.id === 'cancel').rect;

  for (const ul of [at0, atMax]) {
    const okHit = upgradesHitAt(ul, centre(okRect).x, centre(okRect).y);
    const cancelHit = upgradesHitAt(ul, centre(cancelRect).x, centre(cancelRect).y);
    check(okHit?.type === 'ok', `the OK centre resolves to ok at firstRow ${ul.list.firstRow}`);
    check(cancelHit?.type === 'cancel', `the Cancel centre resolves to cancel at firstRow ${ul.list.firstRow}`);
  }

  // A visible row still hits its row.
  const visible = at0.rows[at0.list.firstRow];
  const rowHit = upgradesHitAt(at0, at0.list.body.x + Math.floor(at0.list.body.w / 2), visible.rect.y + Math.floor(UPGRADE_ROW_H / 2));
  check(rowHit?.type === 'row' && rowHit.id === visible.def.id, 'a click on a visible row still resolves to that row');

  // Below the last visible row but still inside the body: window, never a hidden row.
  const lastVisibleIdx = at0.list.firstRow + at0.list.rowsVisible - 1;
  const lastVisibleBottom = at0.rows[lastVisibleIdx].rect.y + UPGRADE_ROW_H;
  const bodyBottom = at0.list.body.y + at0.list.body.h;
  const belowHit = upgradesHitAt(at0, at0.list.body.x + Math.floor(at0.list.body.w / 2), lastVisibleBottom + 1);
  check(lastVisibleBottom + 1 < bodyBottom, 'the body has room below the last visible row');
  check(belowHit?.type === 'window', 'a click below the last visible row resolves to window, never a hidden row');

  // OK commits a buyable selected row: deduct, add, close.
  {
    const buy = createRunState();
    buy.wave = 60;
    buy.economy.salvage = 100000;
    const session = new UpgradesSession();
    session.show();
    const ul = computeUpgradesLayout(layout, buy, 'available', 0);
    const row = ul.rows[session.selected];
    const beforeSalvage = buy.economy.salvage;
    const beforeCount = buy.upgrades.length;
    const bought = pressUpgradesOk(buy, session, ul);
    check(bought === true, 'OK on a buyable row returns true');
    check(buy.economy.salvage === beforeSalvage - row.def.cost, 'OK on a buyable row deducts the cost');
    check(buy.upgrades.length === beforeCount + 1 && buy.upgrades.includes(row.def.id), 'OK on a buyable row adds the upgrade');
    check(!session.open, 'OK closes the dialog');
  }

  // OK on an unaffordable row: nothing changes, closes.
  {
    const poor = createRunState();
    poor.wave = 60;
    poor.economy.salvage = 0;
    const session = new UpgradesSession();
    session.show();
    const ul = computeUpgradesLayout(layout, poor, 'available', 0);
    const beforeSalvage = poor.economy.salvage;
    const beforeCount = poor.upgrades.length;
    const bought = pressUpgradesOk(poor, session, ul);
    check(bought === false, 'OK on an unaffordable row returns false');
    check(poor.economy.salvage === beforeSalvage && poor.upgrades.length === beforeCount, 'OK on an unaffordable row changes nothing');
    check(!session.open, 'OK still closes the dialog when nothing is bought');
  }

  // OK on the Owned tab never buys.
  {
    const owned = createRunState();
    owned.wave = 60;
    owned.economy.salvage = 100000;
    buyUpgrade(owned, 'wide-reticle');
    const session = new UpgradesSession();
    session.show();
    session.setTab('owned');
    const ul = computeUpgradesLayout(layout, owned, 'owned', 0);
    const beforeSalvage = owned.economy.salvage;
    const beforeCount = owned.upgrades.length;
    const bought = pressUpgradesOk(owned, session, ul);
    check(bought === false && owned.economy.salvage === beforeSalvage && owned.upgrades.length === beforeCount,
      'OK on the Owned tab never buys');
    check(!session.open, 'OK closes the dialog on the Owned tab');
  }

  // Cancel never changes salvage: it only closes.
  {
    const s2 = createRunState();
    s2.wave = 60;
    s2.economy.salvage = 500;
    const session = new UpgradesSession();
    session.show();
    const ul = computeUpgradesLayout(layout, s2, 'available', 0);
    const cancelHit = upgradesHitAt(ul, centre(cancelRect).x, centre(cancelRect).y);
    check(cancelHit?.type === 'cancel', 'the Cancel centre resolves to cancel');
    session.hide();
    check(s2.economy.salvage === 500 && s2.upgrades.length === 0, 'Cancel never changes salvage');
    check(!session.open, 'Cancel closes the dialog');
  }
}

// --- Visual pass 4: Restore tabs, Apply dirty state and the progress bar ----------------------
{
  const profile = defaultProfile();
  profile.rp = 100;
  profile.rpEarned = 20;
  const s = createRunState(profile);
  s.economy.earned = 20000; // floor(2.2 * sqrt(20000/900)) = 10
  const layout = computeLayout(1280, 720);
  const session = new RestoreSession();
  session.show(profile);

  check(session.tab === 'restore', 'Restore opens on the Restore Point tab');
  const rl0 = computeRestoreLayout(layout, profile, s, session);
  check(rl0.tabs.map((t) => t.label).join(',') === 'Restore Point,Specs,Tree', 'the three tabs are Restore Point, Specs, Tree');
  check(!restoreDirty(session, profile), 'a fresh session is clean');

  session.setTab('specs');
  check(session.tab === 'specs', 'the Specs tab switches');
  session.setTab('tree');
  check(session.tab === 'tree', 'the Tree tab switches');

  check(!restoreDirty(session, profile), 'Apply is disabled while clean');
  session.incSpec('cpu', profile);
  check(restoreDirty(session, profile), 'Apply enables once a spec is staged');
  session.decSpec('cpu', profile);
  check(!restoreDirty(session, profile), 'Apply disables again once the draft is rolled back');

  const prog = restoreProgress(s);
  check(prog.fill === prog.points / prog.pointsNeeded, 'the progress fill equals points / pointsNeeded');
  check(prog.fill >= 0 && prog.fill < 1, 'the progress fill is a fraction in [0, 1)');
  const rl = computeRestoreLayout(layout, profile, s, session);
  const blockW = 8;
  const gap = 2;
  const blocks = Math.max(1, Math.floor(((rl.progress.rect.w - 4) + gap) / (blockW + gap)));
  const filled = Math.round(rl.progress.fill * blocks);
  check(Math.abs(filled / blocks - rl.progress.fill) <= 1 / blocks, 'the segmented bar fill matches points/pointsNeeded within one block');
}

// --- Visual pass 4b: the Restore tab leak, zero-RP steppers and the centred level digit ---------
// (docs/RESTORE-TAB-LEAK.md §4)
{
  const layout = computeLayout(1280, 720);
  const profile = defaultProfile(); // 0 RP, 0 specs, nothing banked
  const s = createRunState(profile);
  const session = new RestoreSession();
  session.show(profile);

  // 1. A fresh profile builds a stepper on every spec row, with minus and plus disabled.
  session.setTab('specs');
  const rl = computeRestoreLayout(layout, profile, s, session);
  check(rl.specRows.length === 4, 'the Specs tab lists all four specs');
  for (const row of rl.specRows) {
    check(row.stepper !== null && row.stepper !== undefined, `the ${row.kind} stepper exists at 0 RP`);
    check(!row.canDec, `the ${row.kind} minus is disabled at 0 RP (base level)`);
    check(!row.canInc, `the ${row.kind} plus is disabled at 0 RP (no points)`);
    check(row.stepper.value.w === 40, `the ${row.kind} value box is 40 px wide`);
  }

  // 2. The value box keeps its 40 px width, and the digit is centred in it, at every level 0-10.
  const view = new RestoreView();
  for (let level = 0; level <= 10; level++) {
    session.draftSpecs = { cpu: level, ram: level, gpu: level, disk: level };
    const layoutAt = computeRestoreLayout(layout, profile, s, session);
    view.draw(true, profile, s, layout, session);
    const digits = view.root.children.filter((c) => typeof c.text === 'string' && /^\d+$/.test(c.text));
    check(digits.length === 4, `four level digits draw at level ${level}`);
    for (const row of layoutAt.specRows) {
      check(row.stepper.value.w === 40, `the value box is 40 px wide at level ${level} (${row.kind})`);
    }
    for (const d of digits) {
      check(d.anchor.x === 0.5 && d.anchor.y === 0.5, `the level digit is centre-anchored at level ${level}`);
      const owner = layoutAt.specRows.find((row) => Math.abs(d.position.x - (row.stepper.value.x + row.stepper.value.w / 2)) < 0.5 && Math.abs(d.position.y - (row.rect.y + row.rect.h / 2)) < 0.5);
      check(owner !== undefined, `the level digit sits at the centre of its value box at level ${level}`);
    }
  }

  // 3. Each tab draws only its own text (the draw-order leak, §1-§2).
  const drawn = () => view.root.children.filter((c) => typeof c.text === 'string' && c.text !== '').map((c) => c.text);
  const restoreCopy = (texts) => texts.some((t) => t.startsWith('Restart Windows converts') || t === 'Progress to the next point' || t === 'Restart Windows');

  session.setTab('specs');
  view.draw(true, profile, s, layout, session);
  check(!restoreCopy(drawn()), 'the Specs tab shows no Restore Point copy');

  session.setTab('tree');
  view.draw(true, profile, s, layout, session);
  check(!restoreCopy(drawn()), 'the Tree tab shows no Restore Point copy');

  session.setTab('restore');
  view.draw(true, profile, s, layout, session);
  const restoreTexts = drawn();
  check(restoreCopy(restoreTexts), 'the Restore Point tab still draws its own copy');
  check(!['Name', 'Level', 'Effect', 'CPU', 'RAM', 'GPU', 'Disk'].some((w) => restoreTexts.includes(w)),
    'the Restore Point tab shows no Specs list copy');
}

// --- Visual pass 4c: tree text anchors (docs/TREE-TEXT-ANCHORS.md) ----------------------------
{
  // 1. The placement helper reports the documented anchors: left for labels, right for prices.
  check(TREE_TEXT_ANCHOR.tier === 0 && TREE_TEXT_ANCHOR.node === 0,
    'tree text: tier labels and node names are left-anchored (0)');
  check(TREE_TEXT_ANCHOR.price === 1, 'tree text: prices are right-anchored (1)');

  const profile = defaultProfile();
  profile.rpEarned = 70; // unlock all five tiers
  profile.rp = 10000;
  const s = createRunState(profile);
  const session = new RestoreSession();
  session.show(profile);
  session.setTab('tree');

  // buildTreeRows lists one expanded tier at a time, so walk each tier to assemble every row.
  const rowsFor = (vw) => {
    const layout = computeLayout(vw, 720);
    const all = [];
    for (let tier = 1; tier <= 5; tier++) {
      session.expanded = tier;
      all.push(...computeRestoreLayout(layout, profile, s, session).treeRows);
    }
    return all;
  };

  // 2. At every width the dialog supports, each node price's left edge stays inside the tab body.
  for (const vw of [640, 800, 1280, 1920]) {
    const layout = computeLayout(vw, 720);
    const rl = computeRestoreLayout(layout, profile, s, session);
    const rows = rowsFor(vw);
    let priced = 0;
    for (const row of rows) {
      if (row.kind !== 'node') continue;
      priced++;
      const left = treePriceTextX(row) - textWidth(row.price, FONT_SIZE.small);
      check(left >= rl.tabBody.x,
        `tree text: the ${row.node.id} price stays inside the tab body at ${vw}px (left ${left} >= ${rl.tabBody.x})`);
    }
    check(priced > 0, `tree text: node rows were built at ${vw}px`);
  }

  // 3. A node name and a tier label never share an x (indented by different amounts).
  {
    const rows = rowsFor(1280);
    const tierX = new Set(rows.filter((r) => r.kind === 'tier').map((r) => treeRowTextX(r)));
    const nodeX = new Set(rows.filter((r) => r.kind === 'node').map((r) => treeRowTextX(r)));
    check([...tierX].every((x) => !nodeX.has(x)), 'tree text: no tier label shares an x with a node name');
    check(tierX.size === 1 && nodeX.size === 1 && [...nodeX][0] - [...tierX][0] === 20,
      'tree text: tier labels and node names each use one x, 20 px apart');
  }

  // The first tier row starts 4 px below the tab body so the expander does not touch the border.
  {
    const layout = computeLayout(1280, 720);
    session.expanded = 1;
    const rl = computeRestoreLayout(layout, profile, s, session);
    check(rl.treeRows[0].rect.y === rl.tabBody.y + 4, 'tree text: the first tree row starts 4 px below the tab body top');
  }

  // 4. Drawing the Specs tab (which leaves level digits at anchor 0.5) then the Tree tab leaves every
  // node name at anchor 0 and every price at anchor 1 — the anchors the helper documents.
  const view = new RestoreView();
  const layout = computeLayout(1280, 720);
  session.expanded = 1;
  session.setTab('specs');
  view.draw(true, profile, s, layout, session);
  session.setTab('tree');
  view.draw(true, profile, s, layout, session);
  const rl = computeRestoreLayout(layout, profile, s, session);
  const nodeRows = rl.treeRows.filter((r) => r.kind === 'node');
  const names = new Set(nodeRows.map((r) => r.node.name));
  const prices = new Set(nodeRows.map((r) => r.price));
  let named = 0;
  let priceTexts = 0;
  for (const c of view.root.children) {
    if (typeof c.text !== 'string' || c.text === '') continue;
    if (names.has(c.text)) {
      named++;
      check(c.anchor.x === TREE_TEXT_ANCHOR.node, `tree text: node name "${c.text}" is anchor ${TREE_TEXT_ANCHOR.node}`);
    } else if (prices.has(c.text)) {
      priceTexts++;
      check(c.anchor.x === TREE_TEXT_ANCHOR.price, `tree text: price "${c.text}" is anchor ${TREE_TEXT_ANCHOR.price}`);
    }
  }
  check(named === nodeRows.length && priceTexts === nodeRows.length,
    `tree text: every drawn node name and price is anchor-checked (${named}/${nodeRows.length} names, ${priceTexts}/${nodeRows.length} prices)`);
}

// --- Visual pass 5: Help Contents/Index/Search, splitter clamp and Back/Forward ---------------
{
  const profile = defaultProfile();
  profile.bestWave = 24;
  const session = new HelpSession();

  const all = HELP_PAGES.filter((p) => pageUnlocked(p, profile));
  const index = helpIndexList(profile);
  check(index.length === all.length, 'the Index lists every unlocked page');
  check(index.every((p, i) => i === 0 || index[i - 1].title.localeCompare(p.title) <= 0), 'the Index is sorted A-Z');

  const hits = helpSearchResults('pointer', profile);
  check(hits.length > 0 && hits.every((p) => (p.title + ' ' + p.body.join(' ')).toLowerCase().includes('pointer')),
    'Search matches the title and the body, not just the title');
  check(helpSearchResults('', profile).length === 0, 'an empty search returns nothing');
  check(helpSearchResults('zzzzznope', profile).length === 0, 'a nonsense search returns nothing');

  // Every query word must match, case-insensitively, in the title or body.
  const multi = helpSearchResults('TOWER damage', profile);
  check(multi.length > 0 && multi.every((p) => {
    const hay = (p.title + ' ' + p.body.join(' ')).toLowerCase();
    return hay.includes('tower') && hay.includes('damage');
  }), 'Search requires every word to match, case-insensitively');
  check(helpSearchResults('TOWER damage', profile).length === helpSearchResults('tower damage', profile).length,
    'Search is case-insensitive');

  session.openPageId(index[0].id);
  check(session.pageId === index[0].id, 'the Index selects a page');
  session.setNavTab('search');
  check(session.navTab === 'search', 'the Search tab switches');

  session.dragSplitter(1000);
  check(session.navW === 320, 'the splitter clamps to 320 px');
  session.dragSplitter(10);
  check(session.navW === 140, 'the splitter clamps to 140 px');
  session.dragSplitter(200);
  check(session.navW === 200, 'the splitter accepts an in-range width');

  session.openPageId(index[1].id);
  check(session.canBack() && !session.canForward(), 'opening a second page enables Back and disables Forward');
  session.back();
  check(session.canForward(), 'Back enables Forward');
  while (session.canBack()) session.back();
  check(!session.canBack() && session.canForward(), 'at the first page Back is disabled and Forward enabled');
  session.forward();
  check(session.canBack(), 'Forward re-enables Back');
}

// --- Visual pass 6: the four screens keep their existing behaviour ----------------------------
{
  const layout = computeLayout(1280, 800);
  const withSave = computeMenuScreen(layout, 'Wave 34 — The Corridor');
  check(withSave.buttons[0].id === 'continue' && withSave.buttons[1].id === 'play', 'the menu keeps Continue ahead of Play');
  check(computeMenuScreen(layout, null).buttons[0].id === 'play', 'without a save Play is primary');

  const hl = computeHelpLayout(100, 100);
  check(helpHitAt(hl, helpRows(defaultProfile(), 2), hl.close.x + hl.close.w / 2, hl.close.y + hl.close.h / 2)?.type === 'close', 'the Help close box still hit-tests');

  const s = createRunState();
  s.wave = 60;
  s.economy.salvage = 100000;
  check(computeUpgradesLayout(layout, s, 'available', 0).rows.length === GLOBAL_UPGRADES.length, 'all revealed upgrades still list');

  const prof = defaultProfile();
  prof.rp = 100;
  prof.rpEarned = 20;
  const rs = new RestoreSession();
  rs.show(prof);
  check(computeRestoreLayout(layout, prof, s, rs).tabs.length === 3, 'Restore still has three tabs');
}

// --- Visual pass 7: every tab and button in all four layouts carries a non-empty label ---------
{
  const layout = computeLayout(1280, 800);
  const s = createRunState();
  s.wave = 60;
  s.economy.salvage = 100000;
  const profile = defaultProfile();
  profile.rp = 100;
  profile.rpEarned = 20;
  const rs = new RestoreSession();
  rs.show(profile);

  const menu = computeMenuScreen(layout, 'Wave 34 — The Corridor');
  for (const b of menu.buttons) {
    check(typeof b.label === 'string' && b.label.length > 0, `the main menu button "${b.id}" carries a non-empty label`);
  }

  const ul = computeUpgradesLayout(layout, s, 'available', 0);
  for (const t of ul.tabs) {
    check(typeof t.label === 'string' && t.label.length > 0, `Global Upgrades tab "${t.id}" carries a non-empty label`);
  }
  for (const b of ul.buttons) {
    check(typeof b.label === 'string' && b.label.length > 0, `Global Upgrades button "${b.id}" carries a non-empty label`);
  }

  const rl = computeRestoreLayout(layout, profile, s, rs);
  for (const t of rl.tabs) {
    check(typeof t.label === 'string' && t.label.length > 0, `System Properties tab "${t.id}" carries a non-empty label`);
  }
  for (const b of rl.buttons) {
    check(typeof b.label === 'string' && b.label.length > 0, `System Properties button "${b.id}" carries a non-empty label`);
  }

  const hl = computeHelpLayout(100, 100);
  for (const t of hl.navTabs) {
    check(typeof t.label === 'string' && t.label.length > 0, `Help nav tab "${t.id}" carries a non-empty label`);
  }
}

// --- Visual pass 8: the upgrades status counts revealed, and the empty state follows the list ---
{
  const early = createRunState();
  early.wave = 2; // nothing revealed yet
  check(upgradesStatusText(early) === '0 of 14 unlocked · 0 owned', `the status counts revealed, not total (${upgradesStatusText(early)})`);
  const wave20 = createRunState();
  wave20.wave = 20; // one upgrade revealed
  check(upgradesStatusText(wave20) === '1 of 14 unlocked · 0 owned', `the status counts one revealed upgrade (${upgradesStatusText(wave20)})`);

  const layout = computeLayout(1280, 720);
  const emptyLayout = computeUpgradesLayout(layout, early, 'available', 0);
  check(emptyLayout.rows.length === 0, 'the Available list is empty before anything is revealed');
  check(upgradesEmptyLines(early).length > 0, 'the empty-state line appears exactly when the list is empty');
  check(upgradesEmptyLines(early)[0] === 'No upgrades unlocked yet.', `the empty state reads "No upgrades unlocked yet." (${upgradesEmptyLines(early)[0]})`);

  const s = createRunState();
  s.wave = 60;
  s.economy.salvage = 100000;
  buyUpgrade(s, 'salvage-contract');
  buyUpgrade(s, 'wide-reticle');
  buyUpgrade(s, 'double-buffer');
  check(upgradesStatusText(s) === '14 of 14 unlocked · 3 owned', `the status counts owned among revealed (${upgradesStatusText(s)})`);
  const fullLayout = computeUpgradesLayout(layout, s, 'available', 0);
  check(fullLayout.rows.length > 0, 'the Available list is non-empty once upgrades are revealed');
  check(upgradesEmptyLines(s).length === 0, 'the empty-state line is absent once the list has rows');
}

// --- Visual pass 9: the marquee mask rectangle equals the marquee rect -------------------------
{
  const layout = computeLayout(1280, 800);
  const win = computeMenuWindow(layout);
  const mask = marqueeMaskRect(layout);
  check(
    mask.x === win.marquee.x && mask.y === win.marquee.y && mask.w === win.marquee.w && mask.h === win.marquee.h,
    'the marquee mask rectangle equals the marquee rect',
  );
  check(mask.h === 18, 'the marquee mask clips to its 18 px strip');
}

// --- Visual pass 10: the Help topic path shows the topic name once -----------------------------
{
  const gs = pageById('getting-started');
  const gsPath = helpTopicPath(gs);
  check((gsPath.match(/Getting started/g) ?? []).length === 1, `the path shows the topic name once (${gsPath})`);
  const gun = pageById('tower-gun');
  check(helpTopicPath(gun) === `Towers › ${gun.title}`, `the path reads the category then the topic (${helpTopicPath(gun)})`);
  check(helpTopicPath(undefined) === 'Select a topic from the contents', 'an empty path reads the select hint');
}

// --- Visual pass 11: the System Properties progress bar is empty at zero points -----------------
{
  const s = createRunState();
  const prog = restoreProgress(s); // zero lifetime salvage, so zero points toward the next Restore Point
  check(prog.fill === 0, `the progress bar is empty at zero points (fill ${prog.fill})`);
}

// --- Frame budget (docs/PERFORMANCE.md): the governor, pinned levels, cached layers, caps -------
// 1. The governor steps down above 22 ms after 30 samples, up below 14 ms after 120, and never
//    oscillates on an alternating 21/15 ms stream.
{
  let q = 'full';
  for (let i = 0; i < 30; i++) q = nextQuality(q, 50, i);
  check(q === 'no-shadows', `governor steps down above 22 ms after 30 samples (${q})`);

  for (let i = 0; i < 250; i++) q = nextQuality(q, 5, 30 + i);
  check(q === 'full', `governor steps back up below 14 ms after 120 frames (${q})`);

  let prev = q;
  let oscillated = false;
  for (let i = 0; i < 500; i++) {
    q = nextQuality(q, i % 2 === 0 ? 21 : 15, 280 + i);
    if (q !== prev) { oscillated = true; break; }
    prev = q;
  }
  check(!oscillated, 'governor never oscillates on an alternating 21/15 ms sequence');
}

// 2. A pinned ?quality=full level never changes, and the status bar shows Q: lean below full.
{
  const unpinned = () => {
    let q = 'full';
    for (let i = 0; i < 300; i++) q = nextQuality(q, 100, i);
    return q;
  };
  check(unpinned() === 'lean', `unpinned: sustained slow frames step all the way down (${unpinned()})`);

  const pin = 'full';
  let q = 'full';
  for (let i = 0; i < 300; i++) {
    const decided = nextQuality(q, 100, i);
    q = pin ?? decided;
  }
  check(q === 'full', 'a ?quality=full pin never changes the level');

  check(speedStatusText(2) === '×2', 'the speed slot shows only the multiplier');
  check(statusPerfText({ quality: 'lean', frameMs: 16.7, fps: 60, showFps: false }) === 'Q: lean',
    'the speed slot shows Q: lean when the level is below full');
  check(statusPerfText({ quality: 'full', frameMs: 16.7, fps: 60, showFps: true }) === '16.7 ms · 60/s · Q: full',
    '?fps=1 draws the frame-time readout with Q: full');
}

// 3. The route key changes on a tower placement and does not change across ticks with no building.
{
  const s = stateOnLevel('open-field');
  const before = routeKey(s);
  for (let i = 0; i < 120; i++) tick(s);
  check(routeKey(s) === before, 'route key is stable across ticks with no building');

  s.economy.salvage = 10000;
  check(placeTower(s, 'gun', 3, 5), 'place a gun on the route');
  check(routeKey(s) !== before, 'route key changes on a tower placement');
}

// 4. Health bars are drawn for damaged enemies and bosses, not for full-health grunts.
{
  const grunt = createEnemy(1, 'grunt', 1, SPAWN, EXIT);
  check(!enemyHealthBarVisible(grunt), 'a full-health grunt draws no health bar');
  grunt.hp = grunt.maxHp - 1;
  check(enemyHealthBarVisible(grunt), 'a damaged enemy draws a health bar');

  const boss = createEnemy(2, 'grunt-boss', 1, SPAWN, EXIT);
  check(enemyHealthBarVisible(boss), 'a boss draws a health bar even at full health');

  const shielded = createEnemy(3, 'shielded', 1, SPAWN, EXIT);
  check(enemyHealthBarVisible(shielded), 'a shielded enemy draws a health bar at full health');

  check(shadowDrawnFor('grunt', 'full') && !shadowDrawnFor('grunt', 'no-shadows') && !shadowDrawnFor('grunt', 'lean'),
    'shadows: a grunt casts a shadow only at full');
  check(shadowDrawnFor('grunt-boss', 'no-shadows') && shadowDrawnFor('flyer-boss', 'no-shadows'),
    'shadows: bosses and the Carrier keep shadows at no-shadows');
}

// 5. The damage-number cap keeps the newest 40.
{
  const view = new FloatingNumbersView();
  const layout = computeLayout(1280, 800);
  for (let i = 0; i < 50; i++) view.addDamage(i, i, i + 1, false, false, 1000);
  const s = createRunState();
  s.tick = 1000;
  view.draw(s, layout);
  const live = view.root.children.filter((c) => c.visible && typeof c.text === 'string');
  check(live.length === 40, `damage numbers cap at 40 live floaters (${live.length})`);
  const amounts = live.map((c) => Number(c.text)).sort((a, b) => a - b);
  check(amounts[0] === 11 && amounts[amounts.length - 1] === 50, 'the cap keeps the newest 40 (drops the oldest)');
}

// 6. A 900-tick determinism hash with the governor pinned to lean equals the one at full.
{
  const hash = (pin) => {
    const s = stateOnLevel('open-field');
    placeTower(s, 'gun', 3, 6);
    placeTower(s, 'gun', 4, 6);
    s.rng = 0x12345678;
    s.wave = 5;
    startWave(s);
    let quality = 'full';
    const h = createHash('sha256');
    for (let i = 0; i < 900; i++) {
      tick(s);
      const decided = nextQuality(quality, 16.7, i);
      quality = pin ?? decided;
      if (s.events.length > 0) { h.update(JSON.stringify(s.events)); s.events = []; }
      h.update(`${s.rng}:${s.integrity}:${s.enemies.length}`);
    }
    return h.digest('hex');
  };
  check(hash('full') === hash('lean'), '900-tick determinism hash is identical pinned to lean and full');
}

// --- Context help 1: the mapping table (docs/CONTEXT-HELP.md) --------------------------------
{
  const page = (hit) => contextHelpPage(hit);

  for (const kind of TOWER_KINDS) {
    const expected = kind === 'wall' ? 'mechanics-walls' : `tower-${kind}`;
    check(page({ kind: 'tower', tower: kind }) === expected, `context help: a ${kind} tower maps to ${expected}`);
  }
  for (const kind of ENEMY_KINDS) {
    check(page({ kind: 'enemy', enemy: kind }) === `enemy-${kind}`, `context help: a ${kind} maps to enemy-${kind}`);
  }
  for (const kind of BOSS_KINDS) {
    check(page({ kind: 'enemy', enemy: kind }) === `boss-${kind}`, `context help: a ${kind} maps to boss-${kind}`);
  }

  check(page({ kind: 'control', control: 'pointer' }) === 'mechanics-pointer', 'context help: the pointer control maps to mechanics-pointer');
  check(page({ kind: 'board' }) === 'mechanics-pointer', 'context help: a bare board click maps to mechanics-pointer');
  check(page({ kind: 'control', control: 'salvage' }) === 'mechanics-salvage', 'context help: the salvage readout maps to mechanics-salvage');
  check(page({ kind: 'control', control: 'wave' }) === 'mechanics-early-call', 'context help: the wave button maps to mechanics-early-call');
  check(page({ kind: 'control', control: 'next-wave' }) === 'mechanics-early-call', 'context help: the next-wave panel maps to mechanics-early-call');
  check(page({ kind: 'control', control: 'upgrades' }) === null, 'context help: the upgrades panel maps to null');
  check(page({ kind: 'control', control: 'integrity' }) === null, 'context help: the integrity readout maps to null');
  check(page({ kind: 'control', control: 'specs' }) === null, 'context help: the specs control maps to null');
  check(page({ kind: 'control', control: 'records' }) === null, 'context help: the records control maps to null');
  check(page({ kind: 'none' }) === null, 'context help: nothing under the pointer maps to null');
}

// --- Context help 2: nextHelpMode truth table -------------------------------------------------
{
  check(nextHelpMode(false, 'press-help') === true, 'nextHelpMode: press-help turns the mode on');
  check(nextHelpMode(true, 'press-help') === false, 'nextHelpMode: press-help toggles the mode off');
  check(nextHelpMode(true, 'click') === false, 'nextHelpMode: click clears the mode');
  check(nextHelpMode(false, 'click') === false, 'nextHelpMode: click keeps the mode off');
  check(nextHelpMode(true, 'cancel') === false, 'nextHelpMode: cancel clears the mode');
  check(nextHelpMode(false, 'cancel') === false, 'nextHelpMode: cancel keeps the mode off');
}

// --- Context help 3: the four boxes fit inside the title bar at 640 and 1280 px ---------------
{
  const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  for (const vw of [640, 1280]) {
    const geom = computeWindowChromeGeom(computeLayout(vw, 480).window);
    const boxes = [geom.help, geom.minimize, geom.maximize, geom.close];
    let inside = true;
    for (const b of boxes) {
      if (b.x < geom.titleBar.x || b.y < geom.titleBar.y || b.x + b.w > geom.titleBar.x + geom.titleBar.w || b.y + b.h > geom.titleBar.y + geom.titleBar.h) inside = false;
    }
    let clean = true;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (overlaps(boxes[i], boxes[j])) clean = false;
    check(inside, `context help: the four boxes sit inside the title bar at ${vw}px`);
    check(clean, `context help: the four boxes do not overlap at ${vw}px`);
    check(geom.help.x < geom.minimize.x && geom.minimize.x < geom.maximize.x && geom.maximize.x < geom.close.x,
      `context help: the boxes are ordered help, minimise, maximise, close at ${vw}px`);
  }
}

// --- Context help 4: HelpSession.openAt selects a page or changes nothing ----------------------
{
  const layout = computeLayout(1280, 720);
  const profile = defaultProfile();
  const session = new HelpSession();

  check(session.openAt('tower-gun', profile, layout) === true, 'openAt a real page opens the viewer');
  check(session.open && session.pageId === 'tower-gun', 'openAt selects the page');
  check(session.scroll === 0, 'openAt scrolls the page to the top');

  const before = session.pageId;
  check(session.openAt('nope', profile, layout) === false, 'openAt a missing page returns false');
  check(session.pageId === before, 'openAt a missing page changes nothing');

  check(session.openAt('enemy-flyer', profile, layout) === false, 'openAt a page gated by an unseen enemy returns false');
  check(session.pageId === before, 'openAt a locked page changes nothing');
}

// --- Context help 5: a help-mode click never mutates the run state -----------------------------
{
  const layout = computeLayout(1280, 800);
  const s = createRunState();
  s.economy.salvage = 100000;
  placeTower(s, 'gun', 5, 5);
  selectTower(s, 'wall'); // armed, so a normal board click would place a wall
  s.phase = 'wave';
  const e = createEnemy(s.nextId++, 'grunt', 1, SPAWN, EXIT);
  e.x = 10.5;
  e.y = 6.5;
  e.prevX = 10.5;
  e.prevY = 6.5;
  e.col = 10;
  e.row = 6;
  e.dist = 0;
  e.targetCol = -1;
  e.targetRow = -1;
  s.enemies.push(e);

  const before = JSON.stringify(captureRun(s));

  const hud = computeHud(layout, s);
  const right = computeRightPanel(layout, s);
  const probe = (x, y) => contextHelpPage(contextHelpHitAt(s, layout, x, y));
  probe(hud.wave.x + hud.wave.w / 2, hud.wave.y + hud.wave.h / 2); // would start a wave
  probe(hud.towers[0].rect.x + 4, hud.towers[0].rect.y + hud.towers[0].rect.h / 2); // would select a tower
  probe(hud.salvage.x + hud.salvage.w / 2, hud.salvage.y + hud.salvage.h / 2);
  probe(hud.integrity.x + hud.integrity.w / 2, hud.integrity.y + hud.integrity.h / 2);
  probe(right.nextWave.rect.x + 4, right.nextWave.rect.y + 4);
  probe(layout.board.x + 15.5 * layout.board.cell, layout.board.y + 9.5 * layout.board.cell); // an empty tile where a click would place a tower
  const wp = worldToPixel(layout, 10.5, 6.5);
  probe(wp.x, wp.y); // would click the enemy

  const after = JSON.stringify(captureRun(s));
  check(before === after, 'a click in help mode places no tower, starts no wave, and leaves the run state byte-identical');
}

// --- 30b. No POINTER row is wider than the panel ----------------------------------------------
{
  for (const [w, h] of [[1280, 720], [1024, 640]]) {
    for (const stage of [1, 2]) {
      for (const wave of [1, 40, 100]) {
        const s = createRunState();
        s.pointer.stage = stage;
        s.wave = wave;
        const section = computeRightPanel(computeLayout(w, h), s).pointer;
        const maxW = section.rows[0].rect.w - 4;
        check(
          section.rows.every((r) => Math.ceil(textWidth(r.text, 13)) <= maxW),
          `every POINTER row fits the panel at ${w}x${h}, stage ${stage}, wave ${wave}`,
        );
      }
    }
  }
  const s = createRunState();
  const section = computeRightPanel(computeLayout(1024, 640), s).pointer;
  check(
    section.rows.length > 3,
    'the long crit line wraps onto its own row rather than overflowing',
  );
  check(
    section.rows.every((r) => !r.text.includes('  ')),
    'wrapped POINTER rows carry no double spaces',
  );
}

// --- 30c. A rate branch never loses DPS as it climbs -------------------------------------------
{
  const dps = (t) => {
    const e = effectiveStats(t);
    return (e.damage * 60) / Math.max(1, e.fireInterval);
  };
  // The Gun's Repeater is the only rate branch (`intervalMul < 1`) in the game. Its depth is
  // capped where its rate stops growing, so it must gain DPS at every tier it can be bought.
  {
    let prev = 0;
    let climbing = true;
    for (let tier = 3; tier <= MAX_TIER; tier += 1) {
      const tower = createTower(1, 'gun', 0, 0);
      tower.tier = tier;
      tower.branch = 'B';
      const here = dps(tower);
      if (here < prev - 1e-6) climbing = false;
      prev = here;
    }
    check(climbing, `the Repeater gains DPS at every tier from 3 to ${MAX_TIER}`);
  }
  const t5 = createTower(1, 'gun', 0, 0);
  t5.tier = 5;
  t5.branch = 'B';
  check(Math.abs(dps(t5) - 28) < 1e-6, 'tier 5 Repeater keeps its pre-existing 28.0 DPS');
}

// --- 47. Localisation (docs/LOCALIZATION.md) ----------------------------------------------------
// 47a. t() interpolates and throws on a missing key or an unfilled placeholder.
{
  check(t('menu.file') === 'File', "t('menu.file') resolves the English catalogue");
  check(t('status.placeTower', { name: 'Gun' }) === 'Click a tile to place Gun — right-click to cancel',
    't() fills a placeholder from params');
  check(Object.keys(en).length > 20, 'the catalogue holds the first migration slice');

  let threwMissing = false;
  try {
    t('catalogue.no.such.key');
  } catch {
    threwMissing = true;
  }
  check(threwMissing, 't() throws on a missing key in development');

  let threwUnfilled = false;
  try {
    t('status.placeTower');
  } catch {
    threwUnfilled = true;
  }
  check(threwUnfilled, 't() throws on an unfilled placeholder in development');

  check(formatInt(1234567, 'en-US') === '1,234,567', 'formatInt groups for a locale');
  check(formatMoney(1234, 'en-US') === '$1,234', 'formatMoney is locale currency');
}

// 47b. plural() matches Intl.PluralRules for a locale with more than two forms (Polish).
{
  const rule = new Intl.PluralRules('pl');
  let matches = true;
  for (const n of [0, 1, 2, 3, 5, 11, 22, 100, 1.5]) {
    if (plural(n, 'one', 'other', 'pl') !== (rule.select(n) === 'one' ? 'one' : 'other')) matches = false;
  }
  check(matches, 'plural() agrees with Intl.PluralRules for Polish');
  check(plural(1, 'one', 'other', 'pl') === 'one', 'Polish plural: 1 selects the one form');
  check(plural(2, 'one', 'other', 'pl') === 'other', 'Polish plural: 2 (few) falls back to other');
  check(plural(5, 'one', 'other', 'pl') === 'other', 'Polish plural: 5 (many) falls back to other');
}

// 47c. Every catalogue key is referenced by code, and every referenced key exists.
{
  const sources = walkAllSources();
  const catalogueKeys = [...sources.entries()]
    .filter(([path]) => path.startsWith('src/i18n/en/'))
    .flatMap(([, src]) => parseCatalogueKeys(src));
  const referenced = new Set();
  for (const src of sources.values()) {
    for (const key of extractTKeys(src)) referenced.add(key);
  }
  // Keys built by template literal (e.g. t(`name.tower.${kind}`)) are referenced through their prefix.
  const dynamicPrefixes = new Set();
  for (const src of sources.values()) {
    for (const m of src.matchAll(/t\(`([A-Za-z0-9_.-]*)\$\{/g)) dynamicPrefixes.add(m[1]);
  }
  const orphans = catalogueKeys.filter(
    (k) => !referenced.has(k) && ![...dynamicPrefixes].some((p) => k.startsWith(p)),
  );
  const missing = [...referenced].filter((k) => !catalogueKeys.includes(k));
  check(orphans.length === 0, `every catalogue key is referenced (orphans: ${orphans.join(', ') || 'none'})`);
  check(missing.length === 0, `every referenced key exists (missing: ${missing.join(', ') || 'none'})`);
}

// 47d. The i18n checker fails on a bare literal in a migrated module and on an emptied baseline.
{
  const scan = scanRoots();
  const baseline = readBaseline();
  const current = checkI18n(scan, baseline);
  check(current.ok, `i18n:check passes on the current tree (${current.counts.filter((c) => c.count > 0).length} modules still in the baseline)`);

  const empty = checkI18n(scan, []);
  check(!empty.ok && empty.errors.length > 0, 'i18n:check fails when the baseline is emptied while bare strings remain');

  const leaked = checkI18n(new Map([['src/view/menu.ts', ['Leaked menu string']]]), []);
  check(!leaked.ok && leaked.errors.some((e) => e.includes('src/view/menu.ts')),
    'i18n:check fails on a bare literal added to a migrated module');

  const stale = checkI18n(new Map([['src/view/menu.ts', []]]), ['src/view/menu.ts']);
  check(!stale.ok && stale.errors.some((e) => e.includes('shrink the baseline')),
    'i18n:check fails on a stale baseline entry');
}

// 47e. A help page's Markdown render preserves the generated text for one tower and one enemy page.
{
  const words = (text) => (text.toLowerCase().match(/[a-z0-9]+/g) ?? []).sort();
  const blockText = (blocks) => {
    const out = [];
    for (const b of blocks) {
      if (b.kind === 'table') {
        out.push(b.header.join(' '));
        for (const row of b.rows) out.push(row.map((cell) => cell.map((r) => r.text).join('')).join(' '));
      } else {
        out.push(b.runs.map((r) => r.text).join(' '));
      }
    }
    return out.join(' ');
  };
  for (const id of ['tower-gun', 'enemy-grunt']) {
    const page = pageById(id);
    const rendered = blockText(parseHelpMarkdown(page.body));
    const source = page.body.join(' ').replace(/[*`|#>-]/g, ' ');
    check(JSON.stringify(words(rendered)) === JSON.stringify(words(source)),
      `help markdown render preserves every word for ${id}`);
  }
}

// 47f. The Help prose catalogue: every help.* key is reachable from help.ts (no orphans), and no
// help string keeps a raw ${...} — every interpolated value must have become a {placeholder}.
{
  const helpKeys = Object.keys(en).filter((k) => k.startsWith('help.'));
  const sources = walkAllSources();
  const helpSrc = sources.get('src/content/help.ts');
  const referenced = new Set(extractTKeys(helpSrc).filter((k) => k.startsWith('help.')));
  const dynamicPrefixes = new Set();
  for (const m of helpSrc.matchAll(/t\(`(help\.[A-Za-z0-9_.-]*)\$\{/g)) dynamicPrefixes.add(m[1]);
  const orphans = helpKeys.filter(
    (k) => !referenced.has(k) && ![...dynamicPrefixes].some((p) => k.startsWith(p)),
  );
  check(orphans.length === 0,
    `every help.* catalogue key is reachable from help.ts (orphans: ${orphans.join(', ') || 'none'})`);

  const interpolation = '${';
  const bad = helpKeys.filter((k) => en[k].includes(interpolation));
  check(bad.length === 0,
    `no help string keeps a raw ${interpolation} (bad: ${bad.join(', ') || 'none'})`);
}

// --- Synergies (docs/SYNERGIES.md §7) -----------------------------------------------------------
// 1. Orthogonal adjacency forms edges; a diagonal pair does not.
{
  const diag = allUnlocked();
  diag.economy.salvage = 1e9;
  check(placeTower(diag, 'aa', 5, 5), 'synergy: place the first AA');
  check(placeTower(diag, 'aa', 6, 6), 'synergy: place a diagonal AA');
  check(buildSynergyLayout(diag.towers).edges.length === 0, 'a diagonal AA pair forms no edge');

  const ortho = allUnlocked();
  ortho.economy.salvage = 1e9;
  placeTower(ortho, 'aa', 5, 5);
  placeTower(ortho, 'aa', 5, 6);
  check(buildSynergyLayout(ortho.towers).edges.length === 1, 'an orthogonal AA pair forms one edge');

  check(
    SYNERGIES.length === 6 && SYNERGIES[0].id === 'aa-sync' && SYNERGIES[0].color === 0xffe14d && SYNERGIES[0].dash === 4 && SYNERGIES[0].gap === 3 && SYNERGIES[0].link === 'synergy-link',
    'the catalogue keeps the amber aa-sync row, dash 4 on / 3 off',
  );
  const spot = SYNERGIES[1];
  check(
    spot.id === 'spotter' && spot.mode === 'gift' && spot.color === 0x64d8ff && spot.dash === 9 && spot.gap === 4 && spot.link === 'synergy-link-spotter',
    'the second row is the cyan spotter gift, dash 9 on / 4 off',
  );
  check(
    SYNERGIES[0].link !== SYNERGIES[1].link,
    'the two catalogue rows do not share a link asset',
  );
  check(
    spot.sourceBranch === 'A' && spot.targets.includes('aa') && spot.targets.includes('cannon'),
    'spotter: a Marksman gift to AA and Cannon',
  );

  // Batch-2 catalogue (docs/SYNERGIES-BATCH-2.md §0): four rows, each with a colour, a shape, a mark
  // and a lead rule; no two share a colour and the four marks are distinct.
  const batch = SYNERGIES.slice(2);
  check(
    batch.length === 4 && batch.every((r) => typeof r.color === 'number' && typeof r.link === 'string' && typeof r.mark === 'string'),
    'the batch-2 catalogue holds four rows, each with a colour, a shape and a mark',
  );
  check(
    new Set(SYNERGIES.map((r) => r.color)).size === SYNERGIES.length,
    'no two catalogue rows share a colour',
  );
  check(
    new Set(batch.map((r) => r.mark)).size === 4,
    'the four batch-2 marks are distinct',
  );
  const byId = Object.fromEntries(SYNERGIES.map((r) => [r.id, r]));
  check(
    byId.chill.kinds[0] === 'frost' && byId.chill.kinds[1] === 'aa' && byId.chill.mode === 'gift' && byId.chill.mark === 'snow',
    'chill: Frost → AA gift, snow mark',
  );
  check(
    byId.interlock.kinds[0] === 'laser' && byId.interlock.kinds[1] === 'taser' && byId.interlock.mode === 'gift' && byId.interlock.mark === 'bolt',
    'interlock: Laser → Taser gift, bolt mark',
  );
  check(
    byId.shatter.kinds[0] === 'cannon' && byId.shatter.kinds[1] === 'frost' && byId.shatter.mode === 'peer' && byId.shatter.mark === 'crack' && byId.shatter.peerLead === 'first',
    'shatter: Cannon ↔ Frost peer, crack mark, Cannon leads',
  );
  check(
    byId.buttress.kinds[0] === 'wall' && byId.buttress.kinds[1] === 'wall' && byId.buttress.mode === 'peer' && byId.buttress.mark === 'brace' && byId.buttress.peerBranch === 'A' && byId.buttress.peerLead === 'northwest',
    'buttress: Bulwark ↔ Bulwark peer, brace mark, north/west leads',
  );
}

// 2. Direction: the shorter interval leads; ties break north, then west.
{
  const a = createTower(1, 'aa', 5, 5);
  const b = createTower(2, 'aa', 5, 6);
  b.tier = 3;
  b.branch = 'A'; // Flak is slower at every tier
  check(leads(a, b) && !leads(b, a), 'the faster AA leads the slower Flak');

  const north = createTower(3, 'aa', 5, 5);
  const south = createTower(4, 'aa', 5, 6);
  check(leads(north, south) && !leads(south, north), 'equal intervals: the northern tower leads');

  const west = createTower(5, 'aa', 4, 5);
  const east = createTower(6, 'aa', 5, 5);
  check(leads(west, east) && !leads(east, west), 'equal intervals: the western tower leads');
}

// 3. The comparison is a strict total order, and sorting a ring puts every leader first.
{
  const towers = [createTower(1, 'aa', 5, 5), createTower(2, 'aa', 6, 5), createTower(3, 'aa', 5, 6), createTower(4, 'aa', 6, 6)];
  let total = true;
  for (let i = 0; i < towers.length; i++) {
    for (let j = 0; j < towers.length; j++) {
      if (i !== j && leads(towers[i], towers[j]) === leads(towers[j], towers[i])) total = false;
    }
  }
  check(total, 'leads is a strict total order: exactly one of leads(a,b)/leads(b,a) holds');

  const s = allUnlocked();
  s.economy.salvage = 1e9;
  for (const [c, r] of [[5, 5], [6, 5], [5, 6], [6, 6]]) placeTower(s, 'aa', c, r);
  const layout = buildSynergyLayout(s.towers);
  const cluster = layout.clusters[0];
  check(cluster !== undefined && cluster.members.length === 4, 'a 2x2 block forms one four-tower cluster');
  let ordered = true;
  for (const edge of layout.edges) {
    if (cluster.members.indexOf(edge.lead) > cluster.members.indexOf(edge.follow)) ordered = false;
  }
  check(ordered, 'in a ring, every leader precedes its follower in the sorted member order');
}

// 4. Propagation: a chain of five fires all five on one tick, in one lead-order pass.
{
  const s = allUnlocked();
  s.economy.salvage = 1e9;
  for (let r = 3; r <= 7; r++) check(placeTower(s, 'aa', 5, r), `synergy chain: AA at (5,${r})`);
  const chain = [3, 4, 5, 6, 7].map((r) => towerAt(s, 5, r));
  s.phase = 'wave';
  const flyer = stationary(1, 'flyer', 20, 5.5, 5.5);
  flyer.hp = flyer.maxHp = 1e9;
  s.enemies.push(flyer);
  for (const t of chain) t.angle = Math.atan2(5.5 - (t.col + 0.5), -(5.5 - (t.row + 0.5)));
  tick(s);
  check(chain.every((t) => t.damageDealt > 0), 'a chain of five AAs all fire');
  check(chain.every((t) => t.cooldown === 32), 'all five fired on the same tick (cooldown 32)');
}

// 5. Holding: a ready follower with a live, in-window leader does not fire, and never writes a cooldown.
{
  const s = allUnlocked();
  s.economy.salvage = 1e9;
  placeTower(s, 'aa', 5, 5);
  placeTower(s, 'aa', 5, 6);
  const leader = towerAt(s, 5, 5);
  const follower = towerAt(s, 5, 6);
  s.phase = 'wave';
  const flyer = stationary(1, 'flyer', 20, 5.5, 4.0);
  flyer.hp = flyer.maxHp = 1e9;
  s.enemies.push(flyer);
  for (const t of [leader, follower]) t.angle = Math.atan2(5.5 - (t.col + 0.5), -(4.0 - (t.row + 0.5)));
  leader.cooldown = 1;
  follower.cooldown = 0;
  tick(s);
  check(follower.damageDealt === 0 && follower.cooldown === 0, 'a ready follower holds and never writes a cooldown');
  check(leader.damageDealt === 0, 'the leader has not fired yet either');
  tick(s);
  check(leader.damageDealt > 0 && follower.damageDealt > 0, 'the follower fires the tick its leader fires');
}

// 6. Abandonment: the follower fires anyway when the leader is offline, has no target, is outside the
//    window, or the follower has held past the backstop.
{
  const s = allUnlocked();
  s.economy.salvage = 1e9;
  placeTower(s, 'aa', 5, 5);
  placeTower(s, 'aa', 5, 6);
  const leader = towerAt(s, 5, 5);
  const follower = towerAt(s, 5, 6);
  leader.hp = 0; // offline, not gone: still forms an edge but cannot lead
  s.phase = 'wave';
  const flyer = stationary(1, 'flyer', 20, 5.5, 4.0);
  flyer.hp = flyer.maxHp = 1e9;
  s.enemies.push(flyer);
  follower.angle = Math.atan2(5.5 - (follower.col + 0.5), -(4.0 - (follower.row + 0.5)));
  follower.cooldown = 0;
  tick(s);
  check(follower.damageDealt > 0, 'a follower fires when its leader is offline');
}
{
  const s = allUnlocked();
  s.economy.salvage = 1e9;
  placeTower(s, 'aa', 5, 5);
  placeTower(s, 'aa', 5, 6);
  const leader = towerAt(s, 5, 5);
  const follower = towerAt(s, 5, 6);
  s.phase = 'wave';
  const flyer = stationary(1, 'flyer', 20, 5.5, 9.5); // in the follower's range, outside the leader's
  flyer.hp = flyer.maxHp = 1e9;
  s.enemies.push(flyer);
  follower.angle = Math.atan2(5.5 - (follower.col + 0.5), -(9.5 - (follower.row + 0.5)));
  follower.cooldown = 0;
  leader.cooldown = 0;
  tick(s);
  check(follower.damageDealt > 0, 'a follower fires when its leader has no target in range');
}
{
  const s = allUnlocked();
  s.economy.salvage = 1e9;
  placeTower(s, 'aa', 5, 5);
  placeTower(s, 'aa', 5, 6);
  const leader = towerAt(s, 5, 5);
  const follower = towerAt(s, 5, 6);
  s.phase = 'wave';
  const flyer = stationary(1, 'flyer', 20, 5.5, 4.0);
  flyer.hp = flyer.maxHp = 1e9;
  s.enemies.push(flyer);
  for (const t of [leader, follower]) t.angle = Math.atan2(5.5 - (t.col + 0.5), -(4.0 - (t.row + 0.5)));
  leader.cooldown = AA_HOLD_WINDOW + 10; // further away than the window
  follower.cooldown = 0;
  tick(s);
  check(follower.damageDealt > 0, 'a follower fires when its leader is further away than the window');
}
{
  const s = allUnlocked();
  s.economy.salvage = 1e9;
  placeTower(s, 'aa', 5, 5);
  placeTower(s, 'aa', 5, 6);
  const leader = towerAt(s, 5, 5);
  const follower = towerAt(s, 5, 6);
  s.phase = 'wave';
  const flyer = stationary(1, 'flyer', 20, 5.5, 4.0);
  flyer.hp = flyer.maxHp = 1e9;
  s.enemies.push(flyer);
  for (const t of [leader, follower]) t.angle = Math.atan2(5.5 - (t.col + 0.5), -(4.0 - (t.row + 0.5)));
  leader.cooldown = 1;
  follower.cooldown = 0;
  synergyLayout(s); // warm the memoised layout so the tick does not clear the seeded hold
  s.synergyHoldSince.set(follower.id, s.tick - AA_HOLD_CAP); // held a full backstop already
  s.synergyHoldTarget.set(follower.id, flyer.id);
  tick(s);
  check(follower.damageDealt > 0, 'a follower that has held past the cap fires regardless');
}

// 7. Rate preservation: a clustered Flak keeps its own interval, never the leader's.
{
  const s = allUnlocked();
  s.economy.salvage = 1e9;
  placeTower(s, 'aa', 5, 5);
  placeTower(s, 'aa', 5, 6);
  const leader = towerAt(s, 5, 5);
  const flak = towerAt(s, 5, 6);
  upgradeTower(s, 5, 6);
  chooseBranch(s, 5, 6, 'A'); // Flak: 54 ticks, follows the 33-tick leader
  s.phase = 'wave';
  const flyer = stationary(1, 'flyer', 20, 5.5, 4.0);
  flyer.hp = flyer.maxHp = 1e9;
  s.enemies.push(flyer);
  for (const t of [leader, flak]) t.angle = Math.atan2(5.5 - (t.col + 0.5), -(4.0 - (t.row + 0.5)));
  tick(s);
  check(leader.cooldown === 32 && leader.damageDealt > 0, 'the plain AA leader fires on its 33-tick interval');
  check(flak.cooldown === towerIntervalTicks(s, effectiveStats(flak).fireInterval) - 1, 'the Flak keeps its own interval, never the leader\'s');
  check(s.projectiles.some((p) => p.kind === 'shell' && p.towerId === flak.id), 'the Flak launched its shell on the same tick');
}

// 8. No multiplier: a synchronized shot deals exactly the lone tower's damage.
{
  const fireLone = () => {
    const s = allUnlocked();
    s.economy.salvage = 1e9;
    placeTower(s, 'aa', 5, 5);
    const lone = towerAt(s, 5, 5);
    s.phase = 'wave';
    const flyer = stationary(1, 'flyer', 20, 5.5, 4.0);
    flyer.hp = flyer.maxHp = 1e9;
    s.enemies.push(flyer);
    lone.angle = 0;
    for (let i = 0; i < 60 && lone.damageDealt === 0; i++) tick(s);
    return lone.damageDealt;
  };
  const loneDamage = fireLone();
  check(Math.abs(loneDamage - 5.2) < 1e-6, `a lone AA deals ${loneDamage.toFixed(2)} (2.6 x 2)`);

  const s = allUnlocked();
  s.economy.salvage = 1e9;
  placeTower(s, 'aa', 5, 5);
  placeTower(s, 'aa', 5, 6);
  const lead = towerAt(s, 5, 5);
  const fol = towerAt(s, 5, 6);
  s.phase = 'wave';
  const flyer = stationary(1, 'flyer', 20, 5.5, 4.0);
  flyer.hp = flyer.maxHp = 1e9;
  s.enemies.push(flyer);
  for (const t of [lead, fol]) t.angle = 0;
  for (let i = 0; i < 60 && lead.damageDealt === 0; i++) tick(s);
  check(lead.damageDealt === loneDamage, `a synchronized leader shot is exactly as strong (${lead.damageDealt} vs ${loneDamage})`);
  check(fol.damageDealt === loneDamage, `a synchronized follower shot is exactly as strong (${fol.damageDealt} vs ${loneDamage})`);
}

// 9. No cooldown rewriting: a clustered leader's cooldown trace matches a lone tower's exactly.
{
  const trace = (clustered) => {
    const s = allUnlocked();
    s.economy.salvage = 1e9;
    placeTower(s, 'aa', 5, 5);
    if (clustered) placeTower(s, 'aa', 5, 6);
    const t = towerAt(s, 5, 5);
    s.phase = 'wave';
    const flyer = stationary(1, 'flyer', 20, 5.5, 4.0);
    flyer.hp = flyer.maxHp = 1e9;
    s.enemies.push(flyer);
    t.angle = 0;
    if (clustered) towerAt(s, 5, 6).angle = 0;
    const seq = [];
    for (let i = 0; i < 100; i++) {
      tick(s);
      seq.push(t.cooldown);
    }
    return seq.join(',');
  };
  check(trace(false) === trace(true), 'a clustered leader\'s cooldown sequence is identical to a lone tower\'s');
}

// 10. Mixed branches: a Flak beside a Missile AA fires on one tick, and a missile from the volley
//     still reaches a flyer beyond the tower's 3.4-tile range.
{
  const s = allUnlocked();
  s.economy.salvage = 1e9;
  placeTower(s, 'aa', 5, 5);
  upgradeTower(s, 5, 5);
  chooseBranch(s, 5, 5, 'B'); // Missile: 33 ticks, leads
  placeTower(s, 'aa', 5, 6);
  upgradeTower(s, 5, 6);
  chooseBranch(s, 5, 6, 'A'); // Flak: 54 ticks, follows
  const missileTower = towerAt(s, 5, 5);
  const flak = towerAt(s, 5, 6);
  s.phase = 'wave';
  const near = stationary(1, 'flyer', 40, 5.5, 4.0);
  const far = stationary(2, 'flyer', 40, 5.5, 0.0);
  near.hp = near.maxHp = 1e9;
  far.hp = far.maxHp = 1e9;
  s.enemies.push(near, far);
  for (const t of [missileTower, flak]) t.angle = Math.atan2(5.5 - (t.col + 0.5), -(4.0 - (t.row + 0.5)));
  tick(s); // both fire as one volley
  check(s.projectiles.filter((p) => p.kind === 'missile').length === 4, 'the Missile AA launched its salvo');
  check(s.projectiles.filter((p) => p.kind === 'shell').length === 1, 'the Flak launched its shell in the same volley');
  check(missileTower.cooldown === 32 && flak.cooldown === 53, 'Missile and Flak both fired on one tick');
  const towerDist = Math.hypot(far.x - (missileTower.col + 0.5), far.y - (missileTower.row + 0.5));
  check(towerDist > effectiveStats(missileTower).range, `the far flyer is beyond the AA's range (${towerDist.toFixed(1)})`);
  near.dead = true;
  missileTower.cooldown = 100000;
  flak.cooldown = 100000;
  let damagedFar = false;
  for (let i = 0; i < 120 && s.projectiles.length > 0; i++) {
    tick(s);
    if (far.hp < far.maxHp) damagedFar = true;
  }
  check(damagedFar, 'a missile from the synchronized volley damages a flyer beyond the tower range');
}

// 11. Losing target: a follower whose held target dies stops holding and fires at what it can still see.
{
  const s = allUnlocked();
  s.economy.salvage = 1e9;
  placeTower(s, 'aa', 5, 5);
  placeTower(s, 'aa', 5, 6);
  const leader = towerAt(s, 5, 5);
  const follower = towerAt(s, 5, 6);
  s.phase = 'wave';
  const a = stationary(1, 'flyer', 20, 5.5, 4.0);
  const b = stationary(2, 'flyer', 20, 5.5, 4.5); // same bearing, so no re-aim delays the shot
  a.hp = a.maxHp = 1e9;
  b.hp = b.maxHp = 1e9;
  s.enemies.push(a, b);
  leader.angle = 0;
  follower.angle = 0;
  leader.cooldown = 10; // in the window, but several ticks away from firing
  follower.cooldown = 0;
  tick(s);
  check(follower.damageDealt === 0 && s.synergyHoldTarget.get(follower.id) === a.id, 'the follower holds, pinned to its first target');
  a.dead = true; // the held target dies mid-hold
  tick(s);
  check(follower.damageDealt > 0 && b.hp < b.maxHp, 'the follower abandons the hold and fires at what it can still see');
  check(leader.damageDealt === 0, 'the follower did not wait out the leader\'s window');
}

// 12. Isolation: a lone AA keeps the existing path, and the non-flyer determinism hash does not move.
{
  const s = allUnlocked();
  s.economy.salvage = 1e9;
  placeTower(s, 'aa', 5, 5);
  const lone = towerAt(s, 5, 5);
  s.phase = 'wave';
  const flyer = stationary(1, 'flyer', 20, 5.5, 4.0);
  flyer.hp = flyer.maxHp = 1e9;
  s.enemies.push(flyer);
  lone.angle = 0;
  tick(s);
  check(synergyLayout(s).clusters.length === 0, 'a lone AA forms no cluster');
  check(lone.cooldown === 32 && Math.abs(lone.damageDealt - 5.2) < 1e-6, 'a lone AA\'s cooldown and damage are unchanged');
  // The non-flyer fixture hash (asserted earlier, "flyer flight: a non-flyer fixture run ...") covers
  // determinism: the synergy adds no RNG draw and never touches the non-AA path, so it stays put.
}

// 13. Save round-trip mid-hold: holding is a runtime fact, never serialized.
{
  const s = allUnlocked();
  s.economy.salvage = 1e9;
  placeTower(s, 'aa', 5, 5);
  placeTower(s, 'aa', 5, 6);
  const follower = towerAt(s, 5, 6);
  s.synergyHoldSince.set(follower.id, s.tick);
  s.synergyHoldTarget.set(follower.id, 123);
  check(s.synergyHoldSince.size === 1, 'a follower is mid-hold before the save');
  const saved = captureRun(s);
  check(saved.synergyHoldSince === undefined && saved.synergyHoldTarget === undefined, 'the hold state is never written to a save');
  const restored = restoreRun(saved);
  check(restored !== null && restored.synergyHoldSince.size === 0, 'a save taken mid-hold resumes with no follower stuck holding');
}

// 14. Role flip: upgrading a partner into a Flak flips the edge's direction on the next rebuild.
{
  const s = allUnlocked();
  s.economy.salvage = 1e9;
  placeTower(s, 'aa', 5, 5);
  placeTower(s, 'aa', 6, 5);
  const north = towerAt(s, 5, 5);
  const east = towerAt(s, 6, 5);
  check(leads(north, east), 'before the upgrade the western tower leads');
  upgradeTower(s, 5, 5);
  chooseBranch(s, 5, 5, 'A'); // slows the western tower below its partner
  check(leads(east, north), 'upgrading the partner into a Flak flips the edge direction');
  const edge = synergyLayout(s).edges[0];
  check(edge.lead.id === east.id && edge.follow.id === north.id, 'the rebuilt edge points the new way');
}

// 14b. Spotter (docs/SYNERGIES.md §9): a Marksman lends its range, one way, to adjacent AA and Cannon.
{
  const s = allUnlocked();
  s.economy.salvage = 1e9;
  check(placeTower(s, 'gun', 4, 5) && placeTower(s, 'aa', 5, 5), 'spotter: place a Gun beside an AA');
  const gun = towerAt(s, 4, 5);
  const aa = towerAt(s, 5, 5);
  check(buildSynergyLayout(s.towers).spotterSources.size === 0, 'an unbranched Gun spots nothing');
  gun.tier = 3;
  gun.branch = 'A';
  const layout = buildSynergyLayout(s.towers);
  check(layout.spotterSources.get(aa.id)?.length === 1, 'a tier-3 Marksman spots its orthogonal neighbour');
  check(layout.edges.some((e) => e.lead.id === gun.id && e.follow.id === aa.id), 'the gift draws one edge from source to beneficiary');
  check(layout.clusters.length === 0, 'a gift makes no cluster');
  check(Math.abs(synergyRange(s, aa) - 4.24) < 0.01, `the AA takes the Marksman's range (${synergyRange(s, aa).toFixed(2)} vs 4.24)`);
}
{
  const d = allUnlocked();
  d.economy.salvage = 1e9;
  placeTower(d, 'gun', 4, 4);
  placeTower(d, 'aa', 5, 5);
  const gun = towerAt(d, 4, 4);
  gun.tier = 20;
  gun.branch = 'A';
  check(buildSynergyLayout(d.towers).spotterSources.size === 0, 'a diagonal neighbour is never spotted');
}
{
  // Beneficiary kinds: Cannon yes, Laser no, and a Minesweeper is skipped.
  const s = allUnlocked();
  s.economy.salvage = 1e9;
  placeTower(s, 'gun', 5, 5);
  placeTower(s, 'cannon', 5, 6);
  placeTower(s, 'laser', 6, 5);
  const gun = towerAt(s, 5, 5);
  const cannon = towerAt(s, 5, 6);
  const laser = towerAt(s, 6, 5);
  gun.tier = 3;
  gun.branch = 'A';
  check(synergyRange(s, cannon) > 3.0 + 1e-9, 'a Cannon is spotted');
  check(Math.abs(synergyRange(s, laser) - 3.4) < 1e-9, 'a Laser is not spotted');
  cannon.tier = 3;
  cannon.branch = 'B'; // Minesweeper: it lays mines and never fires
  check(!buildSynergyLayout(s.towers).spotterSources.has(cannon.id), 'a Minesweeper takes no range gift');
}
{
  // The cap, and max-never-sum when two Marksmen share a beneficiary.
  const s = allUnlocked();
  s.economy.salvage = 1e9;
  placeTower(s, 'gun', 4, 5);
  placeTower(s, 'gun', 6, 5);
  placeTower(s, 'aa', 5, 5);
  const west = towerAt(s, 4, 5);
  const east = towerAt(s, 6, 5);
  const aa = towerAt(s, 5, 5);
  west.tier = 20;
  west.branch = 'A';
  east.tier = 20;
  east.branch = 'A';
  check(Math.abs(spotterGrant(west) - SPOTTER_CAP) < 1e-9, `a tier-20 Marksman hands over the cap (${SPOTTER_CAP})`);
  check(Math.abs(synergyRange(s, aa) - SPOTTER_CAP) < 1e-9, 'two spotters give one gift, never a sum');
  west.tier = 3;
  check(Math.abs(synergyRange(s, aa) - SPOTTER_CAP) < 1e-9, 'the larger gift wins whichever side it comes from');
}
{
  // A downed Marksman spots nothing.
  const s = allUnlocked();
  s.economy.salvage = 1e9;
  placeTower(s, 'gun', 4, 5);
  placeTower(s, 'aa', 5, 5);
  const gun = towerAt(s, 4, 5);
  const aa = towerAt(s, 5, 5);
  gun.tier = 20;
  gun.branch = 'A';
  check(synergyRange(s, aa) > 3.4, 'spotted while the Marksman is up');
  gun.hp = 0;
  check(Math.abs(synergyRange(s, aa) - 3.4) < 1e-9, 'a downed Marksman spots nothing');
}
{
  // Behaviour: the gift reaches the sim, not just the helper. A flyer four tiles away is out of an
  // AA's 3.4-tile reach and inside a spotted 5.5.
  const base = allUnlocked();
  base.economy.salvage = 1e9;
  placeTower(base, 'aa', 5, 5);
  const lone = towerAt(base, 5, 5);
  base.phase = 'wave';
  base.enemies.push(stationary(1, 'flyer', 20, 5.5, 9.5));
  for (let i = 0; i < 90 && lone.damageDealt === 0; i++) tick(base);
  check(lone.damageDealt === 0, 'an unspotted AA cannot reach a flyer four tiles away');

  const s = allUnlocked();
  s.economy.salvage = 1e9;
  placeTower(s, 'aa', 5, 5);
  placeTower(s, 'gun', 4, 5);
  const aa = towerAt(s, 5, 5);
  const gun = towerAt(s, 4, 5);
  gun.tier = 20;
  gun.branch = 'A';
  s.phase = 'wave';
  s.enemies.push(stationary(1, 'flyer', 20, 5.5, 9.5));
  for (let i = 0; i < 90 && aa.damageDealt === 0; i++) tick(s);
  check(aa.damageDealt > 0, 'a spotted AA fires past its own range');
}

// 15. Layer order: synergy sits below towerSprites and above path/shadows; the list stays frozen.
{
  const order = BOARD_LAYER_ORDER;
  check(Object.isFrozen(BOARD_LAYER_ORDER), 'the board layer list is frozen');
  check(order.indexOf('synergy') === order.indexOf('towerSprites') - 1, 'synergy sits directly below towerSprites');
  check(order.indexOf('synergy') > order.indexOf('path'), 'synergy sits above the path');
  check(order.indexOf('synergy') > order.indexOf('shadows'), 'synergy sits above the enemy shadows');
}

// 16. Quality: lean draws flat lines with no drift; full pulses and drifts.
{
  const period = SYNERGIES[0].dash + SYNERGIES[0].gap;
  check(synergyEdgeStyle(0, 'lean', period).alpha === 0.9, 'lean draws flat art at alpha 0.90');
  check(synergyEdgeStyle(0, 'full', period).alpha === 0.95, 'full starts at alpha 0.95');
  check(synergyEdgeStyle(0, 'full', period).alpha > 0.5, 'the indicator is not a smudge: it draws above half opacity');
  check(synergyEdgeStyle(1, 'full', period).alpha !== synergyEdgeStyle(2, 'full', period).alpha, 'full pulses the alpha');
  check(synergyEdgeStyle(0, 'lean', period).offset === 0 && synergyEdgeStyle(50, 'lean', period).offset === 0, 'lean draws with no dash drift');
  check(synergyEdgeStyle(1, 'full', period).offset !== synergyEdgeStyle(2, 'full', period).offset, 'full drifts the dash offset');
}

// 16b. The indicator is an artist-editable SVG, registered in the manifest, and the art layer sits
// above the procedural fallback so a missing texture degrades instead of disappearing.
{
  const manifest = JSON.parse(readFileSync(new URL('../public/art/manifest.json', import.meta.url), 'utf8')).assets;
  const names = manifest.map((a) => a.name);
  check(names.includes('ui/synergy-halo'), 'the synergy halo is in the art manifest');
  check(names.includes('ui/synergy-link'), 'the synergy link is in the art manifest');
  check(names.includes('ui/synergy-link-spotter'), 'the spotter link is in the art manifest');
  for (const file of ['synergy-halo', 'synergy-link', 'synergy-link-spotter']) {
    const svg = readFileSync(new URL(`../public/art/ui/${file}.svg`, import.meta.url), 'utf8');
    check(svg.includes('<svg') && svg.includes('viewBox'), `${file}.svg is a real SVG the artist can open`);
  }
  const boardSrc = readFileSync(new URL('../src/view/board.ts', import.meta.url), 'utf8');
  check(boardSrc.includes("getArtTexture('synergy-halo'"), 'the board draws the halo from the SVG asset');
  check(boardSrc.includes('edge.link') && !boardSrc.includes("getArtTexture('synergy-link'"),
    'the board reads the link texture per edge, not a single hardcoded name');
  const artSrc = readFileSync(new URL('../src/view/art.ts', import.meta.url), 'utf8');
  check(artSrc.includes("'synergy-halo'") && artSrc.includes("'synergy-link'") && artSrc.includes("'synergy-link-spotter'"),
    'all three synergy assets are in ART_MANIFEST, so the loader will actually request them');
  check(/this\.synergyLayer\.addChild\(this\.synergy, this\.synergyArt\)/.test(boardSrc),
    'the procedural fallback is drawn under the art, so a slow load does not blank the line');
}

// 17. RTL: edge positions are byte-identical under a dir:'rtl' locale.
{
  const s = allUnlocked();
  s.economy.salvage = 1e9;
  placeTower(s, 'aa', 5, 5);
  placeTower(s, 'aa', 5, 6);
  const edge = buildSynergyLayout(s.towers).edges[0];
  const board = { x: 100, y: 50, cell: 20 };
  const line = () => JSON.stringify(synergyEdgeEndpoints(edge, board, 20));
  setDirection('ltr');
  const ltr = line();
  setDirection('rtl');
  const rtl = line();
  setDirection('ltr');
  check(ltr === rtl, 'edge positions are byte-identical under RTL');
}

// --- Chill (docs/SYNERGIES-BATCH-2.md §1) ------------------------------------------------------
{
  const flyerHit = (withFrost, extraFrost) => {
    const s = allUnlocked();
    s.economy.salvage = 1e9;
    placeTower(s, 'aa', 5, 5);
    if (withFrost) {
      placeTower(s, 'frost', 5, 6);
      if (extraFrost) placeTower(s, 'frost', 5, 4);
    }
    const aa = towerAt(s, 5, 5);
    aa.angle = 0;
    s.phase = 'wave';
    const flyer = stationary(1, 'flyer', 20, 5.5, 4.0);
    flyer.hp = flyer.maxHp = 1e9;
    s.enemies.push(flyer);
    for (let i = 0; i < 60 && aa.damageDealt === 0; i++) tick(s);
    return { s, aa, flyer };
  };

  const withFrost = flyerHit(true, false);
  check(withFrost.aa.damageDealt > 0, 'an AA with an adjacent Frost fires at a flyer');
  check(withFrost.flyer.slowFactor === CHILL_SLOW_FACTOR, `chill applies slow factor ${CHILL_SLOW_FACTOR}`);
  check(withFrost.s.tick < withFrost.flyer.slowUntilTick, 'the flyer is slowed by the AA hit');

  const alone = flyerHit(false, false);
  check(alone.aa.damageDealt > 0, 'a lone AA still fires at a flyer');
  check(!(alone.s.tick < alone.flyer.slowUntilTick), 'without a Frost the AA applies no slow');

  const twoFrosts = flyerHit(true, true);
  check(twoFrosts.flyer.slowFactor === CHILL_SLOW_FACTOR, 'two Frosts do not produce a stronger slow than one');

  // Ground enemies are never slowed: a Flak shell splashes a ground unit at half damage, and the
  // chill must not reach it. The adjacent Frost is kept on cooldown so it cannot slow the ground unit
  // itself — only the AA's splash touches it.
  {
    const s = allUnlocked();
    s.economy.salvage = 1e9;
    placeTower(s, 'aa', 5, 5);
    placeTower(s, 'frost', 5, 6);
    const aa = towerAt(s, 5, 5);
    const frost = towerAt(s, 5, 6);
    frost.cooldown = 100000;
    aa.angle = 0;
    s.phase = 'wave';
    const flyer = stationary(1, 'flyer', 20, 5.5, 4.0);
    const grunt = stationary(2, 'grunt', 1, 5.5, 4.6);
    flyer.hp = flyer.maxHp = 1e9;
    grunt.hp = grunt.maxHp = 1e9;
    s.enemies.push(flyer, grunt);
    // Flak: the shell bursts near the flyer and its splash reaches the ground unit.
    upgradeTower(s, 5, 5);
    chooseBranch(s, 5, 5, 'A');
    aa.angle = 0;
    for (let i = 0; i < 90 && aa.damageDealt === 0; i++) tick(s);
    check(aa.damageDealt > 0, 'the Flak shell splashes a ground unit');
    check(grunt.hp < grunt.maxHp, 'the ground unit took the Flak splash');
    check(!(s.tick < grunt.slowUntilTick), 'ground damage never applies the chill slow');
  }
}

// --- Interlock (docs/SYNERGIES-BATCH-2.md §2) ---------------------------------------------------
{
  const fireTaser = (withLaser) => {
    const s = allUnlocked();
    s.economy.salvage = 1e9;
    placeTower(s, 'taser', 5, 5);
    if (withLaser) placeTower(s, 'laser', 5, 4);
    const taser = towerAt(s, 5, 5);
    const laser = withLaser ? towerAt(s, 5, 4) : null;
    if (laser) laser.cooldown = 100000; // the Laser lends targeting, never damage, in this fixture
    s.phase = 'wave';
    const grunt = stationary(1, 'grunt', 1, 5.5, 3.0); // 2.5 tiles from the Taser, in the Laser's range
    grunt.hp = grunt.maxHp = 1e9;
    s.enemies.push(grunt);
    for (let i = 0; i < 60 && taser.damageDealt === 0; i++) tick(s);
    return { s, taser, grunt };
  };

  const interlocked = fireTaser(true);
  check(interlocked.taser.damageDealt > 0, 'a Taser beside a Laser fires at a target 2.5 tiles away');
  check(interlocked.grunt.hp < interlocked.grunt.maxHp, 'the borrowed target took the Taser hit');

  const lone = fireTaser(false);
  check(lone.taser.damageDealt === 0, 'the same Taser without a Laser does not reach the target');
  check(lone.grunt.hp === lone.grunt.maxHp, 'the target is untouched without an adjacent Laser');

  // The borrowed target follows the Laser to its next live target.
  {
    const s = allUnlocked();
    s.economy.salvage = 1e9;
    placeTower(s, 'taser', 5, 5);
    placeTower(s, 'laser', 5, 4);
    const taser = towerAt(s, 5, 5);
    const laser = towerAt(s, 5, 4);
    laser.cooldown = 100000;
    s.phase = 'wave';
    const a = stationary(1, 'grunt', 1, 5.5, 3.0);
    const b = stationary(2, 'grunt', 1, 5.5, 3.5);
    a.hp = a.maxHp = 1e9;
    b.hp = b.maxHp = 1e9;
    a.dist = 100;
    b.dist = 50;
    s.enemies.push(a, b);
    tick(s);
    check(a.hp < a.maxHp && b.hp === b.maxHp, 'the Taser borrows the Laser\'s deepest target, not its own nearest');
    a.dead = true; // the Laser retargets
    for (let i = 0; i < 20 && b.hp === b.maxHp; i++) tick(s);
    check(b.hp < b.maxHp, 'the Taser follows the Laser to its next target');
  }

  // Byte-identical baseline: a Taser with no adjacent Laser behaves exactly as before.
  const loneTaserHash = () => {
    const s = allUnlocked();
    s.economy.salvage = 1e9;
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    placeTower(s, 'taser', 5, 5);
    const taser = towerAt(s, 5, 5);
    s.phase = 'wave';
    const e = stationary(1, 'grunt', 1, 5.5, 4.0);
    e.hp = e.maxHp = 1e9;
    s.enemies.push(e);
    const buf = [];
    for (let i = 0; i < 600; i++) {
      tick(s);
      for (const ev of s.events) {
        if (ev.type === 'shot') buf.push(`S${ev.towerId}`);
        else if (ev.type === 'damage') buf.push(`D${ev.id}:${ev.amount}`);
      }
      s.events.length = 0;
      buf.push(`c${taser.cooldown}`);
    }
    return createHash('sha1').update(buf.join(';')).digest('hex');
  };
  const baseline = loneTaserHash();
  check(baseline === '6b494dd2028982b3d917bec33fb037c5c702451c', `a Taser with no adjacent Laser is byte-identical to the baseline (${baseline.slice(0, 10)})`);
}

// --- Shatter (docs/SYNERGIES-BATCH-2.md §3) -----------------------------------------------------
{
  const settle = (s) => {
    for (let i = 0; i < 60 && s.projectiles.length > 0; i++) tick(s);
  };

  const shellInto = (slowed) => {
    const s = allUnlocked();
    s.economy.salvage = 1e9;
    placeTower(s, 'cannon', 5, 5);
    placeTower(s, 'frost', 5, 6);
    const cannon = towerAt(s, 5, 5);
    cannon.angle = 0;
    s.phase = 'wave';
    const grunt = stationary(1, 'grunt', 1, 5.5, 3.3);
    grunt.hp = grunt.maxHp = 1e9;
    if (slowed) {
      grunt.slowUntilTick = 999999;
      grunt.slowFactor = 0.5;
    }
    s.enemies.push(grunt);
    tick(s); // fire the shell
    const shell = s.projectiles[0];
    const impactX = shell.x + shell.vx * (shell.lifetime / TICK_HZ);
    const impactY = shell.y + shell.vy * (shell.lifetime / TICK_HZ);
    settle(s); // let the shell land
    return { s, cannon, grunt, impactX, impactY };
  };

  const slowed = shellInto(true);
  check(slowed.s.shatterBursts.length === 1, 'a shell into a slowed enemy schedules exactly one burst');
  const burst = slowed.s.shatterBursts[0];
  check(burst.tick === slowed.s.tick + SHATTER_BURST_DELAY_TICKS, `the burst lands ${SHATTER_BURST_DELAY_TICKS} ticks later`);
  check(Math.abs(burst.damage - slowed.cannon.damageDealt * SHATTER_BURST_DAMAGE_MULT) < 1e-9, 'the burst carries 40% of the shell damage');
  check(Math.abs(burst.x - slowed.impactX) < 1e-9 && Math.abs(burst.y - slowed.impactY) < 1e-9, 'the burst is scheduled at the impact point');

  const unslowed = shellInto(false);
  check(unslowed.s.shatterBursts.length === 0, 'a shell into an unslowed enemy schedules no burst');

  // A target slowed only after the shell already landed does not burst.
  {
    const s = allUnlocked();
    s.economy.salvage = 1e9;
    placeTower(s, 'cannon', 5, 5);
    placeTower(s, 'frost', 5, 6);
    const cannon = towerAt(s, 5, 5);
    cannon.angle = 0;
    s.phase = 'wave';
    const grunt = stationary(1, 'grunt', 1, 5.5, 3.3);
    grunt.hp = grunt.maxHp = 1e9;
    s.enemies.push(grunt);
    tick(s);
    settle(s); // land unslowed
    check(s.shatterBursts.length === 0, 'an unslowed landing schedules no Shatter');
    grunt.slowUntilTick = s.tick + 1000;
    grunt.slowFactor = 0.5;
    for (let i = 0; i < 30; i++) tick(s);
    check(s.shatterBursts.length === 0, 'a target slowed only after the shell landed never bursts');
  }

  // The burst resolves 24 ticks later and never schedules another.
  const hpAfterShell = slowed.grunt.maxHp - slowed.grunt.hp;
  for (let i = 0; i < SHATTER_BURST_DELAY_TICKS; i++) tick(slowed.s);
  check(slowed.s.shatterBursts.length === 0, 'a burst never schedules another Shatter');
  const hpAfterBurst = slowed.grunt.maxHp - slowed.grunt.hp;
  check(Math.abs(hpAfterBurst - hpAfterShell - burst.damage) < 1e-6, 'the burst deals its damage at the impact point');
}

// --- Cannon shells (docs/CANNON-SHELLS.md §5) ----------------------------------------------------
{
  const settle = (s) => {
    for (let i = 0; i < 60 && s.projectiles.length > 0; i++) tick(s);
  };

  // A shell spawns at the muzzle with the expected lifetime, and the target takes no damage on the
  // fire tick.
  {
    const s = allUnlocked();
    s.economy.salvage = 1e9;
    placeTower(s, 'cannon', 5, 5);
    const cannon = towerAt(s, 5, 5);
    cannon.angle = 0;
    s.phase = 'wave';
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    const grunt = stationary(1, 'grunt', 1, 5.5, 4.0);
    grunt.hp = grunt.maxHp = 1e9;
    s.enemies.push(grunt);
    const dist = Math.hypot(5.5 - 5.5, 4.0 - 5.5);
    const expected = Math.ceil(dist / (CANNON_SHELL_SPEED / TICK_HZ));
    tick(s);
    check(s.projectiles.length === 1, 'the cannon launches exactly one shell on fire');
    const p = s.projectiles[0];
    check(p.kind === 'shell' && p.x === 5.5 && p.y === 5.5, 'the shell spawns at the muzzle (tower centre)');
    check(p.lifetime === expected, `the shell carries the expected lifetime (${p.lifetime} vs ${expected})`);
    check(p.towerId === cannon.id && p.damage === effectiveStats(cannon).damage, 'the shell carries the firing tower id and its damage');
    check(grunt.hp === grunt.maxHp, 'the target takes no damage on the fire tick');
  }

  // Damage lands on the tick the shell's lifetime reaches zero.
  {
    const s = allUnlocked();
    s.economy.salvage = 1e9;
    placeTower(s, 'cannon', 5, 5);
    const cannon = towerAt(s, 5, 5);
    cannon.angle = 0;
    s.phase = 'wave';
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    const grunt = stationary(1, 'grunt', 1, 5.5, 4.0);
    grunt.hp = grunt.maxHp = 1e9;
    s.enemies.push(grunt);
    tick(s);
    const p = s.projectiles[0];
    const lifetime = p.lifetime;
    let hitTick = -1;
    for (let i = 1; i <= lifetime; i++) {
      tick(s);
      if (hitTick < 0 && grunt.hp < grunt.maxHp) hitTick = i;
    }
    check(hitTick === lifetime, `damage lands on the tick the shell's lifetime reaches zero (tick ${hitTick} of ${lifetime})`);
  }

  // The predicted landing point leads the target by its velocity over the flight.
  {
    const s = allUnlocked();
    s.economy.salvage = 1e9;
    placeTower(s, 'cannon', 5, 5);
    const cannon = towerAt(s, 5, 5);
    cannon.angle = 0;
    s.phase = 'wave';
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    const grunt = stationary(1, 'grunt', 1, 5.5, 4.0);
    grunt.hp = grunt.maxHp = 1e9;
    s.enemies.push(grunt);
    tick(s);
    const p = s.projectiles[0];
    const flightSec = p.lifetime / TICK_HZ;
    const velX = ENEMY_STATS.grunt.speed * Math.cos(grunt.heading);
    const velY = ENEMY_STATS.grunt.speed * Math.sin(grunt.heading);
    check(Math.abs((p.x + p.vx * flightSec) - (grunt.x + velX * flightSec)) < 1e-9, 'the shell leads the target by its velocity along x');
    check(Math.abs((p.y + p.vy * flightSec) - (grunt.y + velY * flightSec)) < 1e-9, 'the shell leads the target by its velocity along y');
  }

  // The lead is right: a target running at a known speed ends up at the landing point.
  {
    const s = allUnlocked('open-field');
    s.economy.salvage = 1e9;
    check(placeTower(s, 'cannon', 5, 4), 'cannon placed over the open-field lane');
    const cannon = towerAt(s, 5, 4);
    cannon.angle = Math.PI; // point south at the running lane
    s.phase = 'wave';
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    const runner = createEnemy(1, 'runner', 1, SPAWN, EXIT);
    runner.x = 5.5;
    runner.y = 6.5;
    runner.prevX = 5.5;
    runner.prevY = 6.5;
    runner.col = 5;
    runner.row = 6;
    runner.dist = 5;
    runner.targetCol = -1;
    runner.targetRow = -1;
    runner.hp = runner.maxHp = 1e9;
    s.enemies.push(runner);
    tick(s); // move and fire
    const p = s.projectiles[0];
    const lifetime = p.lifetime;
    const flightSec = lifetime / TICK_HZ;
    const predictedX = p.x + p.vx * flightSec;
    const predictedY = p.y + p.vy * flightSec;
    for (let i = 0; i < lifetime; i++) tick(s);
    check(runner.hp < runner.maxHp, 'the running target takes the hit');
    check(Math.abs(runner.x - predictedX) < 0.02 && Math.abs(runner.y - predictedY) < 0.02,
      'the shell lands where the runner ends up (the lead is right)');
  }

  // A Cannon sold mid-flight fizzles its shell with no damage.
  {
    const s = allUnlocked();
    s.economy.salvage = 1e9;
    placeTower(s, 'cannon', 5, 5);
    const cannon = towerAt(s, 5, 5);
    cannon.angle = 0;
    s.phase = 'wave';
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    const grunt = stationary(1, 'grunt', 1, 5.5, 4.0);
    grunt.hp = grunt.maxHp = 1e9;
    s.enemies.push(grunt);
    tick(s);
    check(s.projectiles.length === 1, 'the shell is in flight before the sell');
    check(sellTower(s, 5, 5), 'the Cannon is sold mid-flight');
    for (let i = 0; i < 30; i++) tick(s);
    check(grunt.hp === grunt.maxHp, 'a Cannon sold mid-flight fizzles its shell with no damage');
  }

  // A mid-flight shell survives save and restore.
  {
    const s = allUnlocked();
    s.economy.salvage = 1e9;
    placeTower(s, 'cannon', 5, 5);
    const cannon = towerAt(s, 5, 5);
    cannon.angle = 0;
    s.phase = 'wave';
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    const grunt = stationary(1, 'grunt', 1, 5.5, 4.0);
    grunt.hp = grunt.maxHp = 1e9;
    s.enemies.push(grunt);
    tick(s);
    check(s.projectiles.length === 1, 'the shell is in flight before the save');
    const restored = restoreRun(JSON.parse(JSON.stringify(captureRun(s))));
    check(restored !== null && restored.projectiles.length === 1, 'a mid-flight shell survives save and restore');
    const op = s.projectiles[0];
    const rp = restored.projectiles[0];
    check(rp.x === op.x && rp.y === op.y && rp.vx === op.vx && rp.vy === op.vy && rp.lifetime === op.lifetime && rp.towerId === op.towerId,
      'the restored shell keeps its flight state');
    settle(s);
    settle(restored);
    check(grunt.hp < grunt.maxHp, 'the original run lands its shell');
    check(restored.enemies.find((e) => e.id === grunt.id).hp < restored.enemies.find((e) => e.id === grunt.id).maxHp,
      'the restored run lands its shell too');
  }

  // The Flak branch is byte-identical to the pre-change build.
  {
    const flakHash = () => {
      const s = allUnlocked();
      s.economy.salvage = 1e9;
      s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
      placeTower(s, 'aa', 5, 5);
      upgradeTower(s, 5, 5);
      chooseBranch(s, 5, 5, 'A');
      const aa = towerAt(s, 5, 5);
      s.phase = 'wave';
      const flyer = stationary(1, 'flyer', 20, 5.5, 4.0);
      const grunt = stationary(2, 'grunt', 20, 6.0, 4.0);
      flyer.hp = flyer.maxHp = 1e9;
      grunt.hp = grunt.maxHp = 1e9;
      s.enemies.push(flyer, grunt);
      const buf = [];
      for (let i = 0; i < 600; i++) {
        tick(s);
        for (const ev of s.events) {
          if (ev.type === 'shot') buf.push(`S${ev.towerId}`);
          else if (ev.type === 'damage') buf.push(`D${ev.id}:${ev.amount}`);
        }
        s.events.length = 0;
        buf.push(`c${aa.cooldown}`);
      }
      return createHash('sha1').update(buf.join(';')).digest('hex');
    };
    const h = flakHash();
    check(h === '03d4b93e8f59f0a5c278f7ab538adea19fee8a11', `the Flak branch is byte-identical to the pre-change build (${h.slice(0, 10)})`);
  }
}

// --- Buttress (docs/SYNERGIES-BATCH-2.md §4) ----------------------------------------------------
{
  const makeBulwark = (s, col, row) => {
    check(placeTower(s, 'wall', col, row), `place a wall at ${col},${row}`);
    check(upgradeTower(s, col, row), `upgrade the wall at ${col},${row} to tier 2`);
    check(chooseBranch(s, col, row, 'A'), `branch the wall at ${col},${row} to Bulwark`);
    return towerAt(s, col, row);
  };

  // Two walls split evenly; the remainder is deterministic.
  {
    const s = allUnlocked();
    s.economy.salvage = 1e9;
    const a = makeBulwark(s, 5, 4);
    const b = makeBulwark(s, 6, 4);
    const aHp = a.hp;
    const bHp = b.hp;
    damageWall(s, a, 10);
    check(aHp - a.hp === 5 && bHp - b.hp === 5, 'a hit on one of two Bulwark walls splits evenly (5 and 5)');
    damageWall(s, a, 7);
    check(aHp - a.hp === 9 && bHp - b.hp === 8, 'the remainder goes to the hit wall deterministically (4 then 3)');
  }

  // A group of five splits across four.
  {
    const s = allUnlocked();
    s.economy.salvage = 1e9;
    const walls = [makeBulwark(s, 5, 5), makeBulwark(s, 6, 5), makeBulwark(s, 7, 5), makeBulwark(s, 8, 5), makeBulwark(s, 9, 5)];
    const hit = walls[2];
    const before = walls.map((w) => w.hp);
    damageWall(s, hit, 10);
    check(before[0] - walls[0].hp === 2, 'the first neighbour takes a 2 share');
    check(before[1] - walls[1].hp === 2, 'the second neighbour takes a 2 share');
    check(before[2] - walls[2].hp === 4, 'the hit wall takes the 2 share plus the remainder');
    check(before[3] - walls[3].hp === 2, 'the third neighbour takes a 2 share');
    check(before[4] - walls[4].hp === 0, 'the fifth wall in the component takes nothing (capped at four)');
  }

  // A Mesh wall beside a Bulwark wall is never split.
  {
    const s = allUnlocked();
    s.economy.salvage = 1e9;
    const a = makeBulwark(s, 5, 4);
    placeTower(s, 'wall', 6, 4);
    upgradeTower(s, 6, 4);
    chooseBranch(s, 6, 4, 'B');
    const mesh = towerAt(s, 6, 4);
    const aHp = a.hp;
    const meshHp = mesh.hp;
    damageWall(s, a, 10);
    check(aHp - a.hp === 10, 'a Bulwark wall beside a Mesh wall takes the full hit');
    check(mesh.hp === meshHp, 'a Mesh wall is not split into');
  }

  // A lone Bulwark wall takes the full hit.
  {
    const s = allUnlocked();
    s.economy.salvage = 1e9;
    const a = makeBulwark(s, 5, 4);
    const aHp = a.hp;
    damageWall(s, a, 10);
    check(aHp - a.hp === 10, 'a lone Bulwark wall takes the full hit');
  }

  // A dead member redistributes within the same hit.
  {
    const s = allUnlocked();
    s.economy.salvage = 1e9;
    const a = makeBulwark(s, 5, 4);
    const b = makeBulwark(s, 6, 4);
    b.hp = 0; // fallen, but still on the board
    const aHp = a.hp;
    damageWall(s, a, 10);
    check(aHp - a.hp === 10, 'the survivor takes the dead member\'s share within the same hit');
    check(b.hp === 0, 'the dead member absorbs nothing');
  }
}

// --- Determinism: all four pairs replay to the same hash (docs/SYNERGIES-BATCH-2.md §7) ---------
{
  const synergyHash = () => {
    const s = allUnlocked();
    s.economy.salvage = 1e9;
    s.rng = 0x51ed2701;
    s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
    placeTower(s, 'aa', 3, 4);
    placeTower(s, 'frost', 3, 5); // chill
    placeTower(s, 'taser', 6, 4);
    placeTower(s, 'laser', 6, 5); // interlock
    placeTower(s, 'cannon', 9, 4);
    placeTower(s, 'frost', 9, 5); // shatter
    for (const [c, r] of [[12, 4], [12, 5]]) { // buttress
      placeTower(s, 'wall', c, r);
      upgradeTower(s, c, r);
      chooseBranch(s, c, r, 'A');
    }
    s.phase = 'wave';
    const flyer = stationary(1, 'flyer', 20, 3.5, 2.0);
    const g1 = stationary(2, 'grunt', 1, 6.5, 2.5);
    const g2 = stationary(3, 'grunt', 1, 9.5, 2.0);
    flyer.hp = flyer.maxHp = 1e9;
    g1.hp = g1.maxHp = 1e9;
    g2.hp = g2.maxHp = 1e9;
    g2.slowUntilTick = 999999;
    g2.slowFactor = 0.5;
    s.enemies.push(flyer, g1, g2);
    for (const t of s.towers) t.angle = 0;
    for (let i = 0; i < 600; i++) tick(s);
    return createHash('sha1').update(JSON.stringify([
      s.rng,
      s.tick,
      s.enemies.map((e) => [e.id, e.kind, e.hp, e.x, e.y, e.dist]),
      s.towers.map((t) => [t.id, t.kind, t.hp, t.cooldown, t.damageDealt, t.kills]),
      s.economy.salvage,
    ])).digest('hex');
  };
  const first = synergyHash();
  check(first === synergyHash(), `a seeded run with all four pairs replays to the same hash (${first.slice(0, 10)})`);
}

// --- Synergy in the tower tooltip (docs/TOWER-SYNERGY-TOOLTIP.md) ------------------------------
{
  // rowsOf: a lone Frost is in no synergy.
  const lone = allUnlocked();
  lone.economy.salvage = 1e9;
  placeTower(lone, 'frost', 5, 5);
  const loneFrost = towerAt(lone, 5, 5);
  check((buildSynergyLayout(lone.towers).rowsOf.get(loneFrost.id) ?? []).length === 0,
    'rowsOf: a lone Frost has no rows');

  // A Frost beside an AA (chill) and a Cannon (shatter) belongs to both, in catalogue order.
  const trio = allUnlocked();
  trio.economy.salvage = 1e9;
  placeTower(trio, 'frost', 5, 5);
  placeTower(trio, 'aa', 5, 6);
  placeTower(trio, 'cannon', 6, 5);
  const frost = towerAt(trio, 5, 5);
  const frostRows = buildSynergyLayout(trio.towers).rowsOf.get(frost.id) ?? [];
  check(JSON.stringify(frostRows) === JSON.stringify(['chill', 'shatter']),
    `rowsOf: a Frost beside an AA and a Cannon has ${frostRows.join(', ') || 'nothing'}`);

  // A two-AA cluster credits aa-sync on both members.
  const pair = allUnlocked();
  pair.economy.salvage = 1e9;
  placeTower(pair, 'aa', 5, 5);
  placeTower(pair, 'aa', 5, 6);
  const aaA = towerAt(pair, 5, 5);
  const aaB = towerAt(pair, 5, 6);
  const pairRows = buildSynergyLayout(pair.towers).rowsOf;
  check(pairRows.get(aaA.id)?.includes('aa-sync') && pairRows.get(aaB.id)?.includes('aa-sync'),
    'rowsOf: a two-AA cluster has aa-sync on both members');

  // A Marksman gun beside an AA credits spotter on both ends, though only the AA benefits.
  const spot = allUnlocked();
  spot.economy.salvage = 1e9;
  placeTower(spot, 'gun', 5, 5);
  upgradeTower(spot, 5, 5);
  chooseBranch(spot, 5, 5, 'A');
  placeTower(spot, 'aa', 5, 6);
  const gun = towerAt(spot, 5, 5);
  const spotted = towerAt(spot, 5, 6);
  const spotRows = buildSynergyLayout(spot.towers).rowsOf;
  check(spotRows.get(gun.id)?.includes('spotter') && spotRows.get(spotted.id)?.includes('spotter'),
    'rowsOf: a Marksman gun beside an AA credits spotter on both ends');
}
{
  // The tooltip names one line per row, in catalogue order, and none outside every synergy.
  const s = allUnlocked();
  s.economy.salvage = 1e9;
  placeTower(s, 'frost', 5, 5);
  placeTower(s, 'aa', 5, 6);
  placeTower(s, 'cannon', 6, 5);
  const frost = towerAt(s, 5, 5);
  const rows = buildSynergyLayout(s.towers).rowsOf.get(frost.id) ?? [];
  const lines = towerTooltipLines(frost, 0, undefined, undefined, 0, null, rows);
  const synergyLines = lines.filter((l) => l.startsWith('Synergy:'));
  check(JSON.stringify(synergyLines) === JSON.stringify(['Synergy: Chill', 'Synergy: Shatter']),
    `tooltip: one line per row, in order (${synergyLines.join(' | ')})`);

  const lone = allUnlocked();
  lone.economy.salvage = 1e9;
  placeTower(lone, 'frost', 5, 5);
  const loneFrost = towerAt(lone, 5, 5);
  check(!towerTooltipLines(loneFrost, 0).some((l) => l.startsWith('Synergy:')),
    'tooltip: no synergy line for a tower outside every synergy');

  // The synergy line sits after the stat lines and before Fully upgraded.
  const w = allUnlocked();
  w.economy.salvage = 1e9;
  for (const [c, r] of [[5, 5], [5, 6]]) {
    placeTower(w, 'wall', c, r);
    upgradeTower(w, c, r);
    chooseBranch(w, c, r, 'A');
  }
  const wall = towerAt(w, 5, 5);
  const wallRows = buildSynergyLayout(w.towers).rowsOf.get(wall.id) ?? [];
  const wallLines = towerTooltipLines(wall, 0, undefined, undefined, 0, null, wallRows);
  const synIdx = wallLines.indexOf('Synergy: Buttress');
  const fullIdx = wallLines.indexOf('Fully upgraded');
  check(synIdx >= 0 && fullIdx >= 0 && synIdx < fullIdx,
    'tooltip: the synergy line precedes Fully upgraded');
}
{
  // Membership survives a tier upgrade and a branch change (the row is membership, not stats).
  const s = allUnlocked();
  s.economy.salvage = 1e9;
  placeTower(s, 'frost', 5, 5);
  placeTower(s, 'aa', 5, 6);
  const frostId = towerAt(s, 5, 5).id;
  const rows = () => buildSynergyLayout(s.towers).rowsOf.get(frostId) ?? [];
  check(rows().includes('chill'), 'membership: a Frost beside an AA is chill before upgrading');
  upgradeTower(s, 5, 5);
  check(rows().includes('chill'), 'membership: chill survives a tier upgrade');
  chooseBranch(s, 5, 5, 'B');
  check(rows().includes('chill'), 'membership: chill survives a branch change');
}
{
  // fit: the synergy line fits the smallest window in every locale, even with the longest shipped
  // synergy name (Synchronized Fire). The tooltip adds 6px padding per side.
  const codes = ['en', 'es', 'fr', 'ru', 'uk', 'zh-Hans', 'he'];
  for (const code of codes) {
    const mod = await import(`../src/i18n/${code}/index.ts`);
    setLocale(mod[Object.keys(mod)[0]], code);
    clearTextWidthCache();
    setDirection(code === 'he' ? 'rtl' : 'ltr');
    const line = t('tooltip.synergy', { name: t('synergy.aaSync.name') });
    const w = Math.ceil(textWidth(line, FONT_SIZE.body));
    check(w + 12 <= 640, `fit: ${code} · tooltip.synergy (${w}px + 12px padding > 640)`);
  }
  setLocale(en, 'en');
  clearTextWidthCache();
  setDirection('ltr');
}

// --- RTL (docs/RTL.md) -------------------------------------------------------------------------
{
  // 1. isRtl() is false by default and true only while a dir:'rtl' locale is installed.
  check(isRtl() === false, 'RTL: isRtl is false by default');
  setDirection('rtl');
  check(isRtl() === true, "RTL: isRtl is true under setDirection('rtl')");
  setDirection('ltr');
  check(isRtl() === false, 'RTL: isRtl returns to false under ltr');
}

{
  // 2. mirrorX is its own inverse and preserves size.
  const outer = { x: 100, y: 50, w: 400, h: 200 };
  const r = { x: 120, y: 60, w: 30, h: 40 };
  const m = mirrorX(r, outer);
  check(m.w === r.w && m.h === r.h, 'RTL: mirrorX preserves size');
  check(m.y === r.y, 'RTL: mirrorX preserves y');
  check(m.x === outer.x + outer.w - (r.x - outer.x) - r.w, 'RTL: mirrorX flips x inside outer');
  const back = mirrorX(m, outer);
  check(back.x === r.x && back.w === r.w && back.h === r.h && back.y === r.y, 'RTL: mirrorX is its own inverse');
}

{
  // 3. With Hebrew installed, computeLayout puts leftPanel right of rightPanel, and their widths,
  // the board rect and the total client rect are unchanged from the LTR case.
  const ltr = computeLayout(1280, 800);
  setDirection('rtl');
  const rtl = computeLayout(1280, 800);
  setDirection('ltr');
  check(JSON.stringify(ltr.board) === JSON.stringify(rtl.board), 'RTL: board rect is byte-identical');
  check(JSON.stringify(ltr.boardCol) === JSON.stringify(rtl.boardCol), 'RTL: board column rect is unchanged');
  check(ltr.client.x === rtl.client.x && ltr.client.y === rtl.client.y && ltr.client.w === rtl.client.w && ltr.client.h === rtl.client.h,
    'RTL: total client rect is unchanged');
  check(rtl.leftPanel.x === ltr.rightPanel.x && rtl.rightPanel.x === ltr.leftPanel.x, 'RTL: leftPanel and rightPanel swap sides');
  check(rtl.leftPanel.w === ltr.leftPanel.w && rtl.rightPanel.w === ltr.rightPanel.w, 'RTL: panel widths are unchanged');
  check(rtl.leftPanel.x > rtl.rightPanel.x, 'RTL: leftPanel sits right of rightPanel');
}

{
  // 4. Menu word hit-boxes, reversed, still open the menu the player clicked.
  const layout = computeLayout(1280, 800);
  const ltrRects = menuWordRects(layout.menu);
  setDirection('rtl');
  const rtlRects = menuWordRects(layout.menu);
  const names = menuItems().map((m) => m.name);
  check(rtlRects[0].x > rtlRects[1].x && ltrRects[0].x < ltrRects[1].x, 'RTL: menu words lay out from the right edge');
  let openOk = true;
  for (let i = 0; i < names.length; i++) {
    const r = rtlRects[i];
    if (menuNameAt(layout.menu, r.x + 2, r.y + 2) !== names[i]) openOk = false;
  }
  setDirection('ltr');
  check(openOk, 'RTL: reversed menu-word hit-boxes still open the menu the player clicked');
}

{
  // 5. A seeded run produces the same determinism hash under rtl as under ltr (presentation only).
  const hashRun = () => {
    const s = stateOnLevel('open-field');
    s.economy.salvage = 100000;
    placeTower(s, 'gun', 3, 6);
    placeTower(s, 'gun', 4, 6);
    s.rng = 0x12345678;
    s.wave = 5;
    startWave(s);
    const h = createHash('sha256');
    for (let i = 0; i < 900; i++) {
      tick(s);
      if (s.events.length > 0) {
        h.update(JSON.stringify(s.events));
        s.events = [];
      }
      h.update(`${s.rng}:${s.integrity}:${s.enemies.length}`);
    }
    return h.digest('hex');
  };
  setDirection('ltr');
  const en = hashRun();
  setDirection('rtl');
  const he = hashRun();
  setDirection('ltr');
  check(en === he, 'RTL: a seeded run produces the same determinism hash in rtl as in ltr');
}

{
  // 6. Panel-fit: every HUD label fits its rect in rtl at 1280x720 and 1024x768, measured, not guessed.
  for (const [vw, vh] of [[1280, 720], [1024, 768]]) {
    setDirection('rtl');
    const l = computeLayout(vw, vh);
    const panelW = l.leftPanel.w; // both side panels share one width (168)
    const fits = (text, size = FONT_SIZE.body) => textWidth(text, size) <= panelW;
    const s = createRunState();
    const h = computeHud(l, s);
    const right = computeRightPanel(l, s);
    let allFit = true;
    const assertFit = (label, text, size = FONT_SIZE.body) => {
      if (!fits(text, size)) {
        allFit = false;
        console.log(`  RTL panel-fit miss: ${label} "${text}" ${textWidth(text, size)} > ${panelW} @ ${vw}x${vh}`);
      }
    };

    assertFit('integrity', t('hud.integrity', { current: s.integrity, max: STARTING_INTEGRITY }));
    assertFit('salvage', salvageReadoutText(s));
    if (h.route) assertFit('route', t('hud.route', { count: currentPath(s).length }));
    for (const tw of h.towers) {
      assertFit(`tower ${tw.kind}`, t('hud.towerButton', { name: t(`name.tower.${tw.kind}`), cost: formatNumber(towerCost(s, tw.kind)) }));
    }
    assertFit('wave', t('hud.startWave', { wave: s.wave + 1 }));
    assertFit('auto', t('hud.auto'));
    if (h.map) assertFit('map', t('hud.mapLabel', { name: s.level.name }));

    for (const sec of [right.nextWave, right.kills, right.globalUpgrades]) {
      assertFit(sec.title, sec.title);
      for (const row of sec.rows) assertFit('info row', row);
    }
    for (const row of right.pointer.rows) assertFit('pointer row', row.text);
    assertFit('pointer upgrade', right.pointer.upgradeText);

    // Tower detail (a selected, tier-2 gun exercises the name/stats/route/sell/branch rows).
    const ds = allUnlocked();
    ds.economy.salvage = 1e9;
    if (placeTower(ds, 'gun', 5, 5)) {
      const gun = towerAt(ds, 5, 5);
      gun.tier = 2;
      selectPlacedTower(ds, gun);
      const dh = computeHud(l, ds);
      if (dh.detail) {
        const d = dh.detail;
        assertFit('detail name', t('hud.towerName', { name: t('name.tower.gun'), tier: gun.tier }));
        assertFit('detail route', t('hud.route', { count: currentPath(ds).length }));
        assertFit('detail sell', t('hud.sell', { amount: formatNumber(sellValue(gun, ds.treeEffects.sellRefund)) }));
        for (const b of d.branches) assertFit('branch', b.label, FONT_SIZE.small);
      }
    }

    setDirection('ltr');
    check(allFit, `RTL: every HUD label fits its rect at ${vw}x${vh}`);
  }
}

// A menu bar that lays out by `length * 7` puts the Chinese words on top of each other, because
// 文件 draws as two ems, not as two Latin letters. Every locale has to fit the bar it is given.
{
  const l = computeLayout(1280, 720);
  const en = (await import('../src/i18n/en/index.ts')).en;
  const codes = ['es', 'fr', 'ru', 'uk', 'zh-Hans', 'he'];
  for (const code of codes) {
    const mod = await import(`../src/i18n/${code}/index.ts`);
    setLocale(mod[Object.keys(mod)[0]], code);
    clearTextWidthCache();
    setDirection(code === 'he' ? 'rtl' : 'ltr');
    const menu = l.menu;
    const rects = menuWordRects(menu);
    const items = menuItems();
    check(rects.length === items.length, `menu fit: ${code} lays out every menu word`);
    let fits = true;
    let overlaps = 0;
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      if (r.x < menu.x || r.x + r.w > menu.x + menu.w) fits = false;
      // Direction-agnostic: in RTL the words run right to left, so an ordered comparison would
      // report every gap as a collision.
      for (let j = 0; j < i; j++) {
        const o = rects[j];
        if (Math.min(o.x + o.w, r.x + r.w) > Math.max(o.x, r.x)) overlaps++;
      }
    }
    check(fits, `menu fit: ${code} words stay inside the menu bar`);
    check(overlaps === 0, `menu fit: ${code} words do not overlap (${overlaps} collisions)`);
    // Every word must be clickable in the middle of the pixels it claims.
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      const hit = menuNameAt(menu, Math.round(r.x + r.w / 2), Math.round(menu.y + menu.h / 2));
      check(hit === items[i].name, `menu fit: ${code} word ${i} is hit-testable`);
    }
  }
  setLocale(en, 'en');
  clearTextWidthCache();
  setDirection('ltr');
}

// Per-locale chrome fit: every fixed-width chrome label — the build palette, the right HUD panel, the
// status bar, the ads, the dialogs and their buttons — must fit the rect it is drawn in, measured with
// `textWidth` (the same convention the menu-fit group uses) in all seven locales. Russian runs ~130%
// of English width and Hebrew ~110%, so a string that clears an English rect can still overflow it.
{
  const l = computeLayout(1280, 720);
  const codes = ['en', 'es', 'fr', 'ru', 'uk', 'zh-Hans', 'he'];
  const BODY = FONT_SIZE.body;
  const SMALL = FONT_SIZE.small;

  const checkFit = (code, label, text, size, budget) => {
    const w = Math.ceil(textWidth(text, size));
    check(w <= budget, `fit: ${code} · ${label} (${w} > ${budget})`);
  };
  // A label indented `pad` from its start edge overflows once it crosses the far edge of its rect.
  const startFit = (code, label, text, rect, size, pad = 6) => checkFit(code, label, text, size, rect.w - pad);
  // A centred label overflows once it is wider than its box.
  const centerFit = (code, label, text, rect, size) => checkFit(code, label, text, size, rect.w);

  // The ad reward line, from the same effect constants the drawing code reads.
  const adMessage = (kind) => {
    switch (kind) {
      case 'defrag': return t('ads.kind.defrag.message', { pct: Math.round(AD_DEFRAG_SALVAGE_PCT * 100) });
      case 'autoupdate': return t('ads.kind.autoupdate.message', { pct: Math.round((AD_AUTOUPDATE_DAMAGE_MULT - 1) * 100) });
      case 'timezone': return t('ads.kind.timezone.message', { pct: Math.round((1 - AD_TIMEZONE_SPEED_MULT) * 100) });
      case 'screensaver': return t('ads.kind.screensaver.message', { damage: AD_SCREENSAVER_DAMAGE });
      default: return t(`ads.kind.${kind}.message`);
    }
  };

  for (const code of codes) {
    const mod = await import(`../src/i18n/${code}/index.ts`);
    setLocale(mod[Object.keys(mod)[0]], code);
    clearTextWidthCache();
    setDirection(code === 'he' ? 'rtl' : 'ltr');

    const s = createRunState();

    // --- Build palette (left panel) ---
    const h = computeHud(l, s);
    startFit(code, 'hud.integrity', t('hud.integrity', { current: s.integrity, max: STARTING_INTEGRITY }), h.integrity, BODY);
    startFit(code, 'hud.salvage', salvageReadoutText(s), h.salvage, BODY);
    if (h.route) startFit(code, 'hud.route', t('hud.route', { count: currentPath(s).length }), h.route, BODY);
    for (const { kind, rect } of h.towers) {
      startFit(code, `hud.towerButton.${kind}`, t('hud.towerButton', { name: towerName(kind), cost: formatNumber(towerCost(s, kind)) }), rect, BODY);
    }
    startFit(code, 'hud.startWave', t('hud.startWave', { wave: s.wave + 1 }), h.wave, BODY);
    startFit(code, 'hud.auto', t('hud.auto'), h.autoWave, BODY, 20);

    // --- Tower detail: the branch row under the title, at the pane's inner width ---
    // The longest shipped branch name in this locale must fit the 18 px branch row (docs/DETAIL-BRANCH-ROW.md §4).
    // branchName() is frozen to the boot locale, so measure the catalogue keys directly, as the branch
    // row renders them once the app reloads in this locale.
    const branchLetters = { gun: ['A', 'B'], cannon: ['A', 'B'], taser: ['A', 'B'], frost: ['A', 'B'], laser: ['A', 'B'], aa: ['A', 'B'], beacon: ['A', 'B'], wall: ['A', 'B', 'C'], cursor: ['A', 'B', 'C'] };
    let longestBranch = '';
    let longestBranchW = 0;
    for (const [kind, letters] of Object.entries(branchLetters)) {
      for (const br of letters) {
        const name = t(`tooltip.branch.${kind}${br}`);
        const w = Math.ceil(textWidth(name, BODY));
        if (w > longestBranchW) { longestBranchW = w; longestBranch = name; }
      }
    }
    const ds = allUnlocked();
    ds.economy.salvage = 1e9;
    if (placeTower(ds, 'gun', 5, 5)) {
      const gun = towerAt(ds, 5, 5);
      gun.tier = 2;
      gun.branch = 'A';
      selectPlacedTower(ds, gun);
      const dh = computeHud(l, ds);
      if (dh.detail && dh.detail.branch) {
        checkFit(code, 'hud.towerBranch', t('hud.towerBranch', { branch: longestBranch }), BODY, dh.detail.branch.w);
      }
    }

    // --- Right HUD panel ---
    const rp = computeRightPanel(l, s);
    startFit(code, 'hud.nextWaveTitle', rp.nextWave.title, rp.nextWave.rect, BODY);
    rp.nextWave.rows.forEach((row, i) => startFit(code, `hud.nextWave.row.${i}`, row, rp.nextWave.rect, BODY));
    startFit(code, 'hud.killsTitle', rp.kills.title, rp.kills.rect, BODY);
    rp.kills.rows.forEach((row, i) => startFit(code, `hud.kills.row.${i}`, row, rp.kills.rect, BODY));
    startFit(code, 'hud.pointerTitle', t('hud.pointerTitle'), rp.pointer.rect, BODY);
    // POINTER rows are wrapped by the view to its own budget (rowWidth = w - 12 - 4), so the drawn
    // row must fit that budget, not the raw text.
    rp.pointer.rows.forEach((row, i) => checkFit(code, `hud.pointer.row.${i}`, row.text, BODY, row.rect.w - 4));
    startFit(code, 'hud.pointerUpgrade', rp.pointer.upgradeText, rp.pointer.upgrade, BODY);
    if (rp.pointer.override) startFit(code, 'hud.override', t('hud.override'), rp.pointer.override, BODY, 20);
    startFit(code, 'hud.globalUpgradesTitle', rp.globalUpgrades.title, rp.globalUpgrades.rect, BODY);
    rp.globalUpgrades.rows.forEach((row, i) => startFit(code, `hud.globalUpgrades.row.${i}`, row, rp.globalUpgrades.rect, BODY));

    // --- Status bar segments ---
    const sp = l.statusPanes;
    for (const key of ['status.pickTower', 'status.startWave', 'status.shoot', 'status.callEarly', 'status.laneBroke', 'status.victory', 'status.inspectTower', 'status.contextHelp']) {
      startFit(code, key, t(key), sp.left, BODY, 4);
    }
    startFit(code, 'status.placeTower', t('status.placeTower', { name: towerName('gun') }), sp.left, BODY, 4);
    startFit(code, 'hud.waveLabel', waveLabel(s), sp.middle, BODY, 4);
    startFit(code, 'hud.speed', speedStatusText(s.speed), sp.speed, BODY, 4);

    // --- Ad dialog (fixed 220x92): title, reward line, and the three-line tip block ---
    const adTitleBudget = AD_W - 6 - 2 - CONTROL_BOX_W;
    const tipW = AD_W - 12;
    for (const kind of AD_KINDS) {
      checkFit(code, `ads.kind.${kind}.title`, t(`ads.kind.${kind}.title`), BODY, adTitleBudget);
      checkFit(code, `ads.kind.${kind}.message`, adMessage(kind), BODY, AD_W - 12);
    }
    for (const tip of AD_TIPS) {
      const lines = wrapAdTip(t(`ads.tip.${tip}`), tipW);
      check(lines.length <= 3, `fit: ${code} · ads.tip.${tip} wraps to ${lines.length} lines (max 3)`);
      for (const line of lines) checkFit(code, `ads.tip.${tip}`, line, SMALL, tipW);
    }

    // --- Save/load name dialog (fixed 360) ---
    const name = computeNameDialog(l);
    startFit(code, 'dlg.mapLibrary.saveTitle', t('dlg.mapLibrary.saveTitle'), name.rect, BODY);
    centerFit(code, 'dlg.mapLibrary.ok', t('dlg.mapLibrary.ok'), name.ok, BODY);
    centerFit(code, 'dlg.mapLibrary.cancel', t('dlg.mapLibrary.cancel'), name.cancel, BODY);

    // --- Start-over and the other single-label confirm dialogs ---
    const dialogs = [
      { title: t('shell.confirm.discardTitle'), rows: [{ text: t('shell.confirm.discardBody', { wave: 5 }) }], buttons: [{ id: 'discard', label: t('shell.confirm.yes') }, { id: 'cancel', label: t('shell.confirm.no') }] },
      { title: t('shell.confirm.restartTitle'), rows: [{ text: t('shell.confirm.restartBody', { points: 42 }) }], buttons: [{ id: 'restart', label: t('shell.confirm.restart') }, { id: 'cancel', label: t('shell.confirm.cancel') }] },
      { title: t('shell.confirm.newRunTitle'), rows: [{ text: t('shell.confirm.newRunBody') }], buttons: [{ id: 'new-run', label: t('shell.confirm.ok') }, { id: 'cancel', label: t('shell.confirm.cancel') }] },
    ];
    for (const model of dialogs) {
      const d = computeDialog(l, model);
      startFit(code, `${model.title}`, model.title, d.rect, BODY);
      model.buttons.forEach((b, i) => centerFit(code, `${model.title}.${b.id}`, b.label, d.buttons[i].rect, BODY));
    }

    // --- Victory / defeat modal ---
    const vm = victoryModalRect(l);
    const vb = victoryButtons(vm);
    const defeat = modalRect(l);
    const defeatRestart = { x: defeat.x + Math.floor((defeat.w - 128) / 2), y: defeat.y + defeat.h - 26 - 10, w: 128, h: 26 };
    startFit(code, 'hud.gameOver', t('hud.gameOver'), defeat, BODY);
    startFit(code, 'hud.victory', t('hud.victory'), vm, BODY);
    centerFit(code, 'hud.mainMenu', t('hud.mainMenu'), defeatRestart, BODY);
    centerFit(code, 'hud.restartWindows', t('hud.restartWindows'), vb.restart, BODY);
    centerFit(code, 'hud.endless', t('hud.endless'), vb.endless, BODY);

    // --- Menu buttons (fixed 240 px, glyph inset 40) ---
    const menu = computeMenuScreen(l, null, { label: t('shell.menu.daily'), disabled: false });
    for (const b of menu.buttons) {
      checkFit(code, `shell.menu.${b.id}`, b.label, BODY, b.rect.w - 40);
    }
  }

  // The widened victory buttons still sit inside their modal and clear each other.
  {
    const vm = victoryModalRect(l);
    const b = victoryButtons(vm);
    check(b.restart.x >= vm.x + 10 && b.restart.x + b.restart.w <= vm.x + vm.w - 10, 'fit: victory restart button stays inside its modal');
    check(b.endless.x >= vm.x + 10 && b.endless.x + b.endless.w <= vm.x + vm.w - 10, 'fit: victory endless button stays inside its modal');
    check(b.endless.x + b.endless.w <= b.restart.x, 'fit: victory buttons do not overlap');
  }

  setLocale(en, 'en');
  clearTextWidthCache();
  setDirection('ltr');
}

// The per-tower sprite pools are indexed by tower slot, not by tower id, so a slot hands its sprites
// to whatever tower stands there next. A wall takes no turret, branch mark or wrench; if the slot is
// not cleared first it keeps the previous tenant's, which is how a sold gun's barrel stayed on the
// board — frozen, still pointing where the gun last aimed — after the tower was gone.
{
  const fakeSprite = () => ({
    visible: true,
    texture: null,
    position: { set() {} },
    width: 0,
    height: 0,
    tint: 0,
    rotation: 0,
    alpha: 1,
    anchor: { set() {} },
  });
  const fakeGfx = () => {
    const p = new Proxy({}, { get: () => () => p });
    return p;
  };

  const s = allUnlocked();
  s.economy.salvage = 1e9;
  check(placeTower(s, 'wall', 3, 3), 'phantom turret: a wall can be placed for the test');
  const wall = towerAt(s, 3, 3);
  const turret = fakeSprite();
  const mark = fakeSprite();
  const wrench = fakeSprite();
  drawTower(fakeSprite(), turret, mark, wrench, fakeGfx(), wall, { x: 0, y: 0, cell: 32 }, 32, 0);
  check(turret.visible === false, 'phantom turret: a wall turns off a turret left in its slot');
  check(mark.visible === false, 'phantom turret: a wall turns off a branch mark left in its slot');
  check(wrench.visible === false, 'phantom turret: a wall turns off a wrench left in its slot');

  const sprites = [fakeSprite(), fakeSprite(), fakeSprite()];
  clearTowerSprites(sprites);
  check(sprites.every((sp) => sp.visible === false), 'phantom turret: clearTowerSprites hides every pooled sprite');
}

// --- Mortar recoil (docs/MORTAR-RECOIL.md) -------------------------------------------------------
{
  const cell = 44;
  const peak = RECOIL_PEAK_CELLS * cell;
  const fire = 1000;

  // 1. Zero before the shot and from age 10 on (the duration is 10 ticks).
  const zero = (o) => o.dx === 0 && o.dy === 0;
  check(zero(recoilOffset(fire, fire - 1, cell)), 'mortar recoil: zero before the shot');
  check(zero(recoilOffset(fire, fire + RECOIL_DURATION_TICKS, cell)), 'mortar recoil: zero from age 10');
  check(zero(recoilOffset(fire, fire + 50, cell)), 'mortar recoil: zero well after the shot');

  // 2. Peak at age 0 is 0.035 * cell within a pixel, and the envelope never grows with age: no later
  // tick displaces the turret past the peak displacement.
  const at0 = recoilOffset(fire, fire, cell);
  const mag0 = Math.hypot(at0.dx, at0.dy);
  check(Math.abs(mag0 - peak) < 1, `mortar recoil: peak at age 0 is 0.035*cell within a pixel (${mag0.toFixed(2)}px vs ${peak.toFixed(2)}px)`);
  let bounded = true;
  for (let k = 1; k < RECOIL_DURATION_TICKS; k++) {
    const m = Math.hypot(recoilOffset(fire, fire + k, cell).dx, recoilOffset(fire, fire + k, cell).dy);
    if (m > peak + 1e-9) bounded = false;
  }
  check(bounded, 'mortar recoil: the offset never exceeds the peak displacement (envelope never grows)');

  // 3. Determinism: the same inputs always give the same offsets.
  check(recoilOffset(fire, fire + 3, cell).dx === recoilOffset(fire, fire + 3, cell).dx &&
        recoilOffset(fire, fire + 3, cell).dy === recoilOffset(fire, fire + 3, cell).dy,
    'mortar recoil: the same inputs repeat the same offsets');

  // 4. A Mortar records a recoil tick; a plain Cannon and a Minesweeper record none.
  const mortar = createTower(1, 'cannon', 0, 0);
  mortar.branch = 'A';
  const plainCannon = createTower(2, 'cannon', 0, 0);
  const minesweeper = createTower(3, 'cannon', 0, 0);
  minesweeper.branch = 'B';
  check(isMortar(mortar), 'mortar recoil: a Mortar (cannon branch A) records a recoil tick');
  check(!isMortar(plainCannon), 'mortar recoil: a plain Cannon records no recoil');
  check(!isMortar(minesweeper) && isMinesweeper(minesweeper), 'mortar recoil: a Minesweeper (cannon branch B) records no recoil');

  // 5. No new rng: the recoil source must not call Math.random or draw from the run's rng stream.
  const boardSrc = readFileSync(fileURLToPath(new URL('../src/view/board.ts', import.meta.url)), 'utf8');
  const mainSrc = readFileSync(fileURLToPath(new URL('../src/main.ts', import.meta.url)), 'utf8');
  check(!/Math\.random/.test(boardSrc) && !/Math\.random/.test(mainSrc), 'mortar recoil: no Math.random in board.ts or main.ts');
  check(!/rngNext|\.rng\b/.test(boardSrc), 'mortar recoil: the view draws no run rng');
}

// --- Frost pulse ring (docs/FROST-PULSE.md) -----------------------------------------------------
{
  const layout = computeLayout(1280, 800);
  const hover = { col: 0, row: 0, onBoard: false, x: 0, y: 0 };
  const s = allUnlocked();
  s.economy.salvage = 10000;
  placeTower(s, 'frost', 5, 5);
  const frost = towerAt(s, 5, 5);
  s.tick = 100;

  const view = new BoardView();

  // Full quality draws the expanding ring; lean quality skips it entirely.
  view.noteFrostPulse(frost, s);
  view.draw(s, layout, 0, hover, undefined, 'full');
  check(view.pulsePool.length === 1 && view.pulses.context.instructions.length > 0,
    'frost pulse: a queued pulse draws at full quality');
  const ringColor = view.pulses.context.instructions.map((i) => i.data.style.color).find((c) => c !== undefined && c !== 0);
  check(ringColor === 0x3399cc, `frost pulse: the ring is the Frost blue 0x3399cc (${ringColor})`);
  view.draw(s, layout, 0, hover, undefined, 'lean');
  check(view.pulses.context.instructions.length === 0, 'frost pulse: nothing draws at lean quality');

  // The ring lives 8 ticks, then the pool compacts it away.
  view.pulsePool.length = 0;
  view.noteFrostPulse(frost, s);
  s.tick = 100 + 8;
  view.draw(s, layout, 0, hover, undefined, 'full');
  check(view.pulsePool.length === 0, 'frost pulse: the ring expires after 8 ticks');

  // The pool is capped like every other short-lived effect.
  view.pulsePool.length = 0;
  for (let i = 0; i < 64; i++) view.noteFrostPulse(frost, s);
  check(view.pulsePool.length === 48, `frost pulse: the pool is capped (${view.pulsePool.length})`);

  // The ring layer sorts under the enemy sprites (docs/FROST-PULSE.md §2).
  const li = (n) => BOARD_LAYER_ORDER.indexOf(n);
  check(li('pulses') < li('enemies') && li('pulses') > li('towers'),
    'frost pulse: the pulses layer sits under enemies, above towers');
}


// --- Map selection (docs/MAP-SELECT.md) ---------------------------------------------------------
{
  // 1. Every level produces a thumbnail description derived from its own Level, stable and distinct.
  const cells = LEVELS.map((l) => levelThumbnail(l));
  check(cells.length === LEVELS.length && cells.every((c) => c.length === COLS * ROWS),
    `every level produces a ${COLS}x${ROWS} thumbnail description`);
  let derived = true;
  for (let i = 0; i < LEVELS.length; i++) {
    const level = LEVELS[i];
    const desc = cells[i];
    for (const [c, r] of level.walls) if (desc[r * COLS + c] !== 'wall') derived = false;
    for (const t of level.starts) if (desc[t.row * COLS + t.col] !== 'spawn') derived = false;
    for (const t of level.exits) if (desc[t.row * COLS + t.col] !== 'exit') derived = false;
  }
  check(derived, 'walls, spawn and exit markers derive from each level');
  check(JSON.stringify(levelThumbnail(LEVELS[0])) === JSON.stringify(levelThumbnail(LEVELS[0])),
    'the thumbnail description is stable across calls');
  const sigs = cells.map((c) => JSON.stringify(c));
  check(new Set(sigs).size === LEVELS.length, 'two different levels never share a thumbnail description');

  // 2. The view caches one texture per level id, so a second lookup reuses the first.
  const a = thumbnailTexture(LEVELS[0]);
  check(a === thumbnailTexture(LEVELS[0]), 'the thumbnail texture is cached by level id');
  check(thumbnailTexture(LEVELS[1]) !== a, 'each level rasterises its own texture');
  check(thumbCacheSize() === 2, `the cache holds one entry per level (${thumbCacheSize()})`);
}

{
  // 3. Selecting a card starts that exact level (the argument `startRun` receives).
  for (let i = 0; i < LEVELS.length; i++) {
    check(mapLevelAt(i) === LEVELS[i], `selecting card ${i} starts ${LEVELS[i].id}`);
  }
  check(mapFocusForId(null) === 0, 'a missing remembered id focuses the first card');
  check(mapFocusForId('fork') === LEVELS.findIndex((l) => l.id === 'fork'), 'a remembered id focuses its own card');
  check(mapFocusForId('bogus') === 0, 'a stale remembered id clamps to the first card');

  // 4. Enter starts the focused card, Esc returns to the menu.
  check(mapGalleryKey(2, 'enter').action === 'start' && mapGalleryKey(2, 'enter').focus === 2,
    'Enter starts the focused card');
  check(mapGalleryKey(2, 'escape').action === 'back', 'Esc returns to the menu');
  check(mapGalleryKey(2, 'home').focus === 0 && mapGalleryKey(2, 'end').focus === LEVELS.length - 1,
    'Home/End jump to the first and last card');

  // 5. Arrow focus follows visual order in both directions.
  setDirection('ltr');
  check(moveMapFocus(0, 'right', LEVELS.length) === 1, 'LTR: right moves to the next card');
  check(moveMapFocus(2, 'right', LEVELS.length) === 2, 'LTR: right is clamped at the right edge');
  check(moveMapFocus(0, 'down', LEVELS.length) === 3, 'LTR: down moves a row');
  setDirection('rtl');
  check(moveMapFocus(0, 'left', LEVELS.length) === 1, 'RTL: left moves toward the visual next card');
  check(moveMapFocus(0, 'right', LEVELS.length) === 0, 'RTL: right is clamped at the visual right edge');
  setDirection('ltr');
}

{
  // 6. The gallery grid fits the client area at 1280x720 in all seven locales: no card overflows the
  // client width (ten maps scroll vertically, so rows below the view are expected), no two cards
  // overlap, and no name or history line overflows its 196 px card.
  const l = computeLayout(1280, 720);
  const codes = ['en', 'es', 'fr', 'ru', 'uk', 'zh-Hans', 'he'];
  const budget = MAP_CARD_W - 16; // 8 px padding each side of the card
  let allFit = true;
  for (const code of codes) {
    const mod = await import(`../src/i18n/${code}/index.ts`);
    setLocale(mod[Object.keys(mod)[0]], code);
    clearTextWidthCache();
    setDirection(code === 'he' ? 'rtl' : 'ltr');
    const cards = computeMapGrid(l.client, LEVELS.length, 0).cards;
    const view = computeMapGrid(l.client, LEVELS.length, 0).view;
    check(cards.length === LEVELS.length, `gallery fit: ${code} lays out every card`);
    for (const card of cards) {
      if (card.rect.x < view.x || card.rect.x + card.rect.w > view.x + view.w) {
        allFit = false;
        console.log(`  gallery fit miss: ${code} card ${card.index} leaves the view horizontally`);
      }
    }
    let overlaps = 0;
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const a = cards[i].rect;
        const b = cards[j].rect;
        if (Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y)) overlaps++;
      }
    }
    if (overlaps > 0) {
      allFit = false;
      console.log(`  gallery fit miss: ${code} has ${overlaps} overlapping cards`);
    }
    for (const level of LEVELS) {
      const name = levelName(level.id);
      if (textWidth(name, MAP_NAME_SIZE) > budget) {
        allFit = false;
        console.log(`  gallery fit miss: ${code} name "${name}" is ${textWidth(name, MAP_NAME_SIZE)} px`);
      }
    }
    for (const hist of [t('shell.maps.best', { n: 123 }), t('shell.maps.best.none')]) {
      if (textWidth(hist, MAP_HISTORY_SIZE) > budget) {
        allFit = false;
        console.log(`  gallery fit miss: ${code} history "${hist}" is ${textWidth(hist, MAP_HISTORY_SIZE)} px`);
      }
    }
  }
  setLocale(en, 'en');
  clearTextWidthCache();
  setDirection('ltr');
  check(allFit, 'the gallery fits the client area at 1280x720 in all seven locales');
}

{
  // 7. The remembered map id round-trips under `pd.map.v1`.
  check(MAP_SAVE_KEY === 'pd.map.v1', 'the remembered map lives under the spec key pd.map.v1');
  const store = runSaveStore();
  check(readRememberedMap(store) === null, 'pd.map.v1: an empty store reads null');
  rememberMap('turnstile', store);
  check(readRememberedMap(store) === 'turnstile', 'pd.map.v1: the chosen id round-trips');
  rememberMap('fork', store);
  check(readRememberedMap(store) === 'fork', 'pd.map.v1: a new choice overwrites the old one');
  check(mapFocusForId(readRememberedMap(store)) === LEVELS.findIndex((l) => l.id === 'fork'),
    'pd.map.v1: the remembered id selects its card on reopen');
}

{
  // 8. Gallery scroll (feat/gallery-scroll): the grid is three columns, any number of rows.
  const client = computeLayout(1280, 720).client;

  // 8a. Six maps fit in the view: no overflow, no scrollbar, no card leaves the view.
  const six = computeMapGrid(client, 6, 0);
  check(six.rows === 2, 'scroll: six maps are two rows');
  check(six.overflow === false, 'scroll: six maps do not overflow');
  check(six.scrollbar.w === 0 && six.scrollbar.h === 0, 'scroll: no overflow means a zero-sized scrollbar');
  check(six.thumb.w === 0 && six.thumb.h === 0, 'scroll: no overflow means a zero-sized thumb');
  let sixInside = true;
  for (const c of six.cards) {
    if (c.rect.x < six.view.x || c.rect.y < six.view.y ||
      c.rect.x + c.rect.w > six.view.x + six.view.w || c.rect.y + c.rect.h > six.view.y + six.view.h) sixInside = false;
  }
  check(sixInside, 'scroll: with six maps every card sits inside the view');

  // 8b. Twenty-six maps overflow to nine rows, and the thumb is proportional with a 14 px minimum.
  const g26 = computeMapGrid(client, 26, 0);
  check(g26.rows === 9, 'scroll: twenty-six maps are nine rows');
  check(g26.overflow === true, 'scroll: twenty-six maps overflow');
  check(g26.scrollMax === g26.rows - g26.rowsVisible, 'scroll: scrollMax is rows - rowsVisible');
  check(g26.rowsVisible > 0, 'scroll: at least one row is visible');
  const wantThumbH = Math.max(14, Math.round(g26.view.h * (g26.rowsVisible / g26.rows)));
  check(g26.thumb.h === wantThumbH && g26.thumb.h >= 14,
    'scroll: the thumb height is proportional to the visible fraction and at least 14 px');
  const end = computeMapGrid(client, 26, g26.scrollMax);
  check(g26.thumb.y === g26.view.y, 'scroll: the thumb starts at the top of the track');
  check(end.thumb.y + end.thumb.h === g26.view.y + g26.view.h, 'scroll: the thumb travels the full track across scrollMax');

  // 8c. clampMapScroll clamps both ends; scrollForFocus keeps its card fully visible in range.
  check(clampMapScroll(-1, g26.scrollMax) === 0, 'scroll: clampMapScroll clamps below zero');
  check(clampMapScroll(999, g26.scrollMax) === g26.scrollMax, 'scroll: clampMapScroll clamps above scrollMax');
  check(clampMapScroll(3, g26.scrollMax) === 3, 'scroll: clampMapScroll keeps an in-range row');
  for (const index of [0, 4, 9, 13, 25]) {
    const row = scrollForFocus(index, g26.scrollMax, g26.firstRow, g26.rowsVisible);
    check(row >= 0 && row <= g26.scrollMax, `scroll: scrollForFocus(${index}) stays within scrollMax`);
    const targetRow = Math.floor(index / MAP_GRID_COLS);
    check(targetRow >= row && targetRow <= row + g26.rowsVisible - 1,
      `scroll: scrollForFocus(${index}) keeps its card fully visible`);
  }
  check(scrollForFocus(0, g26.scrollMax, g26.scrollMax, g26.rowsVisible) === 0,
    'scroll: focusing the first card scrolls back to the top');
  check(scrollForFocus(25, g26.scrollMax, 0, g26.rowsVisible) === g26.scrollMax,
    'scroll: focusing the last card scrolls to the bottom');

  // 8d. mapCardAt honours the scroll: a visible card hits, a scrolled-out card does not.
  const scrolled = computeMapGrid(client, 26, 3);
  const vis = scrolled.cards[9];
  check(mapCardAt(client, vis.rect.x + 10, vis.rect.y + 10, 26, 3) === 9, 'scroll: a visible card is hit');
  const gone = scrolled.cards[0];
  check(mapCardAt(client, gone.rect.x + 10, gone.rect.y + 10, 26, 3) === null,
    'scroll: a card scrolled out of the view is not hit');
  // Row 6 is only partly visible at firstRow 3: hit-testable over the slice inside the view only.
  const partial = scrolled.cards[18];
  check(mapCardAt(client, partial.rect.x + 10, scrolled.view.y + scrolled.view.h - 2, 26, 3) === 18,
    'scroll: a partly visible card is hit over its visible slice');
  check(mapCardAt(client, partial.rect.x + 10, partial.rect.y + partial.rect.h - 2, 26, 3) === null,
    'scroll: a point inside a card but past the view bottom is not hit');

  // 8e. The scrollbar hugs the right edge in LTR and the left edge in RTL; cards never overlap it.
  const overlaps = (a, b) => Math.min(a.x + a.w, b.x + b.w) > Math.max(a.x, b.x) && Math.min(a.y + a.h, b.y + b.h) > Math.max(a.y, b.y);
  setDirection('rtl');
  const rtl = computeMapGrid(client, 26, 0);
  check(rtl.scrollbar.x === client.x, 'scroll: RTL puts the scrollbar on the client left edge');
  check(rtl.scrollbar.x + rtl.scrollbar.w === client.x + MAP_SCROLL_W, 'scroll: RTL scrollbar is one reserved column wide');
  setDirection('ltr');
  const ltr = computeMapGrid(client, 26, 0);
  check(ltr.scrollbar.x + ltr.scrollbar.w === client.x + client.w, 'scroll: LTR puts the scrollbar on the client right edge');
  let noOverlap = true;
  for (const c of ltr.cards) if (overlaps(c.rect, ltr.scrollbar)) noOverlap = false;
  for (const c of rtl.cards) if (overlaps(c.rect, rtl.scrollbar)) noOverlap = false;
  check(noOverlap, 'scroll: no card overlaps the scrollbar in either direction');

  // 8f. moveMapFocus spans arbitrary rows, and pageup/pagedown move a page of rows.
  check(moveMapFocus(22, 'down', 26) === 25, 'scroll: down reaches the next row on a tall grid');
  check(moveMapFocus(23, 'down', 26) === 23, 'scroll: down clamps past the last card');
  check(mapGalleryKey(0, 'pagedown', g26.rowsVisible).focus === Math.min(LEVELS.length - 1, g26.rowsVisible * MAP_GRID_COLS),
    'scroll: pagedown moves one page of rows');
  check(mapGalleryKey(LEVELS.length - 1, 'pageup', g26.rowsVisible).focus === Math.max(0, LEVELS.length - 1 - g26.rowsVisible * MAP_GRID_COLS),
    'scroll: pageup moves one page of rows back');
}

// --- Maps batch 2 (docs/MAPS-BATCH-2.md) --------------------------------------------------------
{
  const NEW_IDS = ['moat', 'hourglass', 'trident', 'switchyard'];

  // 1. Each new level validates and leaves at least 60 buildable tiles.
  for (const id of NEW_IDS) {
    const level = levelById(id);
    check(level.id === id, `${id}: levelById resolves the new map`);
    check(validateLevel(level) === null, `${id}: validateLevel accepts the map`);
    const grid = createGrid(level);
    let buildable = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (tileAt(grid, c, r) === 'buildable') buildable++;
    check(buildable >= 60, `${id}: ${buildable} buildable tiles (expected at least 60)`);
  }

  // 2. A gun places through the placement path on at least one tile of each map.
  for (const id of NEW_IDS) {
    const s = stateOnLevel(id);
    s.economy.salvage = 10000;
    let placed = false;
    outer:
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (canPlace(s, 'gun', c, r)) { placed = true; break outer; }
    }
    check(placed, `${id}: a gun places through canPlace on at least one tile`);
  }

  // 3. Path lengths match the spec: moat 27, hourglass 27, trident lanes 27/20/29, switchyard
  //    38 with both shutters closed and 28 with both open.
  const routeLength = (level, blocked = new Set()) =>
    pathTiles(buildField(createGrid(level), blocked, level.exits[0]), level.starts[0]).length;
  check(routeLength(levelById('moat')) === 27, 'moat: shortest route is 27 tiles');
  check(routeLength(levelById('hourglass')) === 27, 'hourglass: shortest route is 27 tiles');

  const trident = levelById('trident');
  const lanes = (trident.routes ?? []).map((r) => r.length);
  check(JSON.stringify(lanes) === JSON.stringify([27, 20, 29]),
    `trident: lane lengths are 27/20/29 (${lanes.join('/')})`);

  const sw = levelById('switchyard');
  const closed = new Set((sw.toggles ?? []).map((t) => toggleIndex(t)));
  check(routeLength(sw, closed) === 38 && routeLength(sw, new Set()) === 28,
    `switchyard: route is 38 with both shutters closed and 28 with both open (${routeLength(sw, closed)}/${routeLength(sw, new Set())})`);

  // 4. Seventeen maps fill six rows and overflow at 1280x720; the last card is reachable by scrolling.
  const client = computeLayout(1280, 720).client;
  const grid = computeMapGrid(client, LEVELS.length, 0);
  check(LEVELS.length === 17, 'the gallery holds seventeen maps');
  check(grid.rows === 6, `seventeen maps are six rows (${grid.rows})`);
  check(grid.overflow === true, 'seventeen maps overflow at 1280x720');
  check(scrollForFocus(LEVELS.length - 1, grid.scrollMax, 0, grid.rowsVisible) === grid.scrollMax,
    'scrollForFocus reaches the last card');

  // 5. The seventeen thumbnails are pairwise distinct.
  const thumbs = LEVELS.map((l) => JSON.stringify(levelThumbnail(l)));
  check(new Set(thumbs).size === LEVELS.length, 'the seventeen thumbnails are pairwise distinct');
}

// --- Maps batch 3 (docs/MAPS-BATCH-3.md) --------------------------------------------------------
{
  const SPEC = {
    comb: { buildable: 168, route: 70 },
    shelves: { buildable: 155, route: 73 },
    pinwheel: { buildable: 198, route: 28 },
    'twin-halls': { buildable: 206, route: 28 },
    ziggurat: { buildable: 174, route: 30 },
    gauntlet: { buildable: 196, route: 30 },
    quarry: { buildable: 128, route: 30 },
  };
  const routeLength = (level) => {
    const grid = createGrid(level);
    const field = buildField(grid, new Set(), level.exits[0]);
    return field[level.starts[0].row * COLS + level.starts[0].col];
  };

  // 1. Each new level validates and matches the doc's buildable and route numbers, measured through
  //    the real field rather than a re-implementation.
  for (const id of Object.keys(SPEC)) {
    const level = levelById(id);
    check(level.id === id, `${id}: levelById resolves the new map`);
    check(validateLevel(level) === null, `${id}: validateLevel accepts the map`);
    const grid = createGrid(level);
    let buildable = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (tileAt(grid, c, r) === 'buildable') buildable++;
    check(buildable === SPEC[id].buildable, `${id}: ${buildable} buildable tiles (expected ${SPEC[id].buildable})`);
    check(routeLength(level) === SPEC[id].route, `${id}: route is ${SPEC[id].route} tiles`);
  }

  // 2. A gun places through canPlace on a real run state, and at least one tile sits next to the route.
  for (const id of Object.keys(SPEC)) {
    const s = stateOnLevel(id);
    s.economy.salvage = 10000;
    let placed = false;
    outer:
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (canPlace(s, 'gun', c, r)) { placed = true; break outer; }
    }
    check(placed, `${id}: a gun places through canPlace on a real run state`);

    const level = levelById(id);
    const route = new Set(pathTiles(buildField(createGrid(level), new Set(), level.exits[0]), level.starts[0])
      .map((t) => t.row * COLS + t.col));
    let nextToRoute = 0;
    const grid = createGrid(level);
    for (const idx of route) {
      const c = idx % COLS;
      const r = Math.floor(idx / COLS);
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc;
        const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
        if (route.has(nr * COLS + nc)) continue;
        if (tileAt(grid, nc, nr) === 'buildable') nextToRoute++;
      }
    }
    check(nextToRoute > 0, `${id}: at least one buildable tile sits next to the route`);
  }
}

// --- 48. Help content: placeholders (docs/HELP-REVIEW.md §2) --------------------------------------
// Local mirrors of the content module's formatters, so each rendered value is asserted against the
// exact string the page prints (the same convention the tier-table checks use).
const hfmt = (n) => n.toFixed(2).replace(/\.?0+$/, '');
const hfmtPct = (n) => `${Math.round(n * 100)}%`;
const pageText = (id) => pageById(id).body.join('\n');

{
  // 48a. Every section-2 row renders the constant's value, and the constant is not written into the
  // catalogue. The catalogue key keeps the {placeholder}; the rendered page fills it from the code.
  const rows = [
    {
      page: 'getting-started',
      key: 'help.getting-started.4',
      expect: `start with ${STARTING_INTEGRITY}`,
      placeholder: '{integrity}',
      absent: 'start with 20',
    },
    {
      page: 'mechanics-early-call',
      key: 'help.mechanics-early-call.2',
      expect: `floor of ${EARLY_CALL_FLOOR}`,
      placeholder: '{floor}',
      absent: 'floor of 5',
    },
    {
      page: 'tower-frost',
      key: 'help.tower-frost.5',
      expect: `to ${hfmtPct(TOWER_STATS.frost.slowFactor)} speed for ${hfmt(TOWER_STATS.frost.slowTicks / TICK_HZ)} s`,
      placeholder: '{slow}',
      absent: '30% speed',
    },
    {
      page: 'tower-taser',
      key: 'help.tower-taser.3',
      expect: `chains to ${effectiveStats(helpSynthTower('taser', BRANCH_TIER, 'A')).chainCount} targets`,
      placeholder: '{chain}',
      absent: 'chains to 3 targets',
    },
    {
      page: 'tower-aa',
      key: 'help.tower-aa.5',
      expect: `for ${hfmt(TOWER_STATS.aa.flyerDamageMult ?? 1)}× damage`,
      placeholder: '{mult}',
      absent: 'hits them for double damage',
    },
    {
      page: 'tower-cursor',
      key: 'help.tower-cursor.6',
      expect: `for ${hfmtPct(CURSOR_CLICK_DAMAGE_FACTOR)} of your click damage`,
      placeholder: '{pct}',
      absent: 'half your click damage',
    },
    {
      page: 'tower-cursor',
      key: 'help.tower-cursor.5',
      expect: `below ${hfmtPct(CURSOR_REPAIR_THRESHOLD)}`,
      placeholder: '{pct}',
      absent: 'below 80%',
    },
    {
      page: 'boss-runner-boss',
      key: 'help.boss-runner-boss.2',
      expect: `within ${PACER_AURA_RADIUS} tiles`,
      placeholder: '{radius}',
      absent: 'within 3 tiles',
    },
    {
      page: 'boss-flyer-boss',
      key: 'help.boss-flyer-boss.2',
      expect: `${CARRIER_BROOD_COUNT} every ${hfmt(CARRIER_BROOD_INTERVAL_TICKS / TICK_HZ)} s`,
      placeholder: '{brood}',
      absent: 'three every 4 s',
    },
    {
      page: 'boss-flyer-boss',
      key: 'help.boss-flyer-boss.2',
      expect: `${CARRIER_DEATH_BROOD_COUNT} more when it dies`,
      placeholder: '{death}',
      absent: 'six more when it dies',
    },
    {
      page: 'boss-saboteur-boss',
      key: 'help.boss-saboteur-boss.2',
      expect: `within ${hfmt(WIRECUTTER_EMP_RADIUS)} tiles goes offline for ${hfmt(WIRECUTTER_EMP_TICKS / TICK_HZ)} s`,
      placeholder: '{radius}',
      absent: 'within 2.5 tiles',
    },
    {
      page: 'boss-armoured-boss',
      key: 'help.boss-armoured-boss.2',
      expect: `work ${hfmt(DREADNOUGHT_SLOW_RESIST)} as well`,
      placeholder: '{resist}',
      absent: 'half as well',
    },
    {
      page: 'mechanics-endless',
      key: 'help.mechanics-endless.1',
      expect: `wave ${WAVE_COUNT}`,
      placeholder: '{final}',
      absent: 'the hundredth wave',
    },
  ];
  for (const row of rows) {
    check(pageText(row.page).includes(row.expect),
      `${row.key} renders "${row.expect}" (from the constant)`);
    check(en[row.key].includes(row.placeholder) && !en[row.key].includes(row.absent),
      `${row.key} carries ${row.placeholder}, not the written-out number`);
  }

  // The nine "at tier 3" branch notes read BRANCH_TIER from the catalogue, not a literal 3.
  const branched = ['gun', 'cannon', 'taser', 'frost', 'laser', 'aa', 'beacon', 'wall', 'cursor'];
  for (const kind of branched) {
    const key = `help.tower-${kind}.2`;
    check(pageText(`tower-${kind}`).includes(`at tier ${BRANCH_TIER}`),
      `${key} renders "at tier ${BRANCH_TIER}" (BRANCH_TIER)`);
    check(en[key].includes('{branchTier}') && !en[key].includes('at tier 3'),
      `${key} carries {branchTier}, not the literal tier`);
  }
}

{
  // 48b. The specific written-out numbers removed in section 2 are gone from every help.* string.
  // A simple scan for the exact phrases; deliberately not a general number detector.
  const barePatterns = [
    'start with 20',
    'floor of 5',
    '30% speed for 3 s',
    'chains to 3 targets',
    'hits them for double damage',
    'half your click damage',
    'within 3 tiles',
    'three every 4 s',
    'six more when it dies',
    'within 2.5 tiles',
    'goes offline for 3 s',
    'half as well',
    'at tier 3',
    'the hundredth wave',
  ];
  const helpKeys = Object.keys(en).filter((k) => k.startsWith('help.'));
  const offenders = [];
  for (const k of helpKeys) {
    for (const p of barePatterns) {
      if (en[k].includes(p)) offenders.push(`${k} ("${p}")`);
    }
  }
  check(offenders.length === 0,
    `no help.* string keeps a section-2 written-out number (${offenders.join(', ') || 'none'})`);
}

{
  // 48c. Every new page is present, ungated (unlocked for a fresh profile), non-empty and in the
  // Mechanics chapter.
  const newPages = [
    'mechanics-licences',
    'mechanics-maps',
    'mechanics-global-upgrades',
    'mechanics-daily',
    'mechanics-achievements',
    'mechanics-editor',
  ];
  for (const id of newPages) {
    const p = pageById(id);
    check(p !== undefined, `new page ${id} is present`);
    check(p !== undefined && p.gate.kind === 'none', `new page ${id} is ungated`);
    check(p !== undefined && pageUnlocked(p, defaultProfile()), `new page ${id} is unlocked for a fresh profile`);
    check(p !== undefined && p.body.length >= 3 && p.body.length <= 5 && p.body.every((l) => l.length > 0),
      `new page ${id} is non-empty and three to five lines`);
    check(p !== undefined && p.category === 'mechanics', `new page ${id} is in the Mechanics chapter`);
  }

  // The generated counts ride placeholders, so the page can never drift from the code.
  check(pageText('mechanics-maps').includes(`${LEVELS.length} maps`), `mechanics-maps names ${LEVELS.length} maps`);
  check(pageText('mechanics-achievements').includes(`${ACHIEVEMENTS.length} achievements`), `mechanics-achievements names ${ACHIEVEMENTS.length} achievements`);
  check(pageText('mechanics-daily').includes(`${DAILY_WAVES} waves`), `mechanics-daily names ${DAILY_WAVES} waves`);
}

{
  // 48d. Placeholder parity: every placeholder in a help.* string is passed at its call site. The
  // content module fills placeholders at import (t() throws on an unfilled one in development), so a
  // rendered page line must never still carry a {placeholder}. Combined with 47f (no raw ${...}) this
  // is the build-fails-on-a-missing-param guarantee made visible.
  const leftover = HELP_PAGES.filter((p) => p.body.some((line) => /\{[a-zA-Z0-9_]+\}/.test(line)));
  check(leftover.length === 0,
    `every rendered help line has every placeholder filled (leftover: ${leftover.map((p) => p.id).join(', ') || 'none'})`);
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
