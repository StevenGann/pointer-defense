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

import {
  createRunState,
  cursorMaintenanceStatus,
  placeTower,
  canPlace,
  startWave,
  tick,
  pointerDown,
  pointerUp,
  step,
  currentPath,
  upgradeTower,
  chooseBranch,
  sellTower,
  towerAt,
  cycleLevel,
  canCycleLevel,
  closePopupEnemy,
  toggleGate,
  selectPlacedTower,
  selectTower,
  cancelSelection,
  placementSealsUnderToggles,
  toggleAtTile,
  cycleTargetMode,
  startRepair,
  upgradePointer,
  toggleManualOverride,
  toggleAutoWave,
  anyTowerRepairing,
  autoWaveStatus,
  noBuildActive,
  NO_BUILD_MESSAGE,
  AUTO_WAVE_DELAY_TICKS,
} from '../src/core/state.ts';
import { TOWER_STATS, TOWER_KINDS, TOWER_UNLOCK_WAVE, towerUnlockWave, isTowerUnlocked, effectiveStats, upgradeCost, createTower, sellValue, wallMaxHp, wallBlocksFlyers, isGateLocked, isToggleGate, isRepairing, isOffline, hasBranches, recomputeAuras, repairCost, repairDurationTicks, TOGGLE_LOCK_TICKS, CURSOR_REPAIR_THRESHOLD, cursorRadius, cursorClickRate, cursorClickIntervalTicks, cursorClickDamageFactor, isFullyUpgraded, repairHealingCount, repairHealTargets } from '../src/core/towers.ts';
import { killReward, waveClearBonus } from '../src/core/economy.ts';
import { formatNumber } from '../src/core/format.ts';
import { buildSchedule, earlyCallBonus, endlessCountBase, endlessIntervalScale, isBossWave, isTypeBossWave, MODIFIER_POOL, popupCountForWave, typeBossKindForWave, typeBossUnlockWave, waveDef, waveEnemyCount, waveKillValue, waveModifiers } from '../src/core/waves.ts';
import { TICK_HZ, TICK_MS, secondsToTicks } from '../src/core/time.ts';
import { buildField, pathTiles, stepToward } from '../src/core/pathfield.ts';
import { COLS, ROWS, tileAt } from '../src/core/grid.ts';
import { LEVELS, DEFAULT_LEVEL, createGrid, levelById, toggleOpenAt, validateLevel, MAX_TOGGLES } from '../src/core/levels.ts';
import { baseEnemyKind, BASTION_SHIELD_LAYERS, BASTION_SHIELD_LAYER_VALUE, createEnemy, enemyKillValue, ENEMY_STATS, isBossKind, isBossVariant, isPopupEnemy, PACER_AURA_RADIUS, waveHpScale, waveValueScale, BREACHER_TURRET_RANGE, BREACHER_TURRET_DAMAGE, BREACHER_TURRET_INTERVAL_TICKS } from '../src/core/enemies.ts';
import { missileSeed } from '../src/core/projectiles.ts';
import { rngNext } from '../src/core/rng.ts';
import { spawnAd, dismissAd, AD_W, AD_H, AD_LIFETIME_TICKS } from '../src/core/ads.ts';
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
  nextCritRoll,
  critChance,
  CRIT_MULTIPLIER,
  MARKED_DAMAGE_MULT,
} from '../src/core/pointer.ts';
import { loadProfile, saveProfile, defaultProfile, prefersReducedMotion } from '../src/core/save.ts';
import { restartWindows, checkAchievements, enterEndless, pointerDamageMult } from '../src/core/state.ts';
import { dashRects, offsetSegment, routeOffset } from '../src/view/route.ts';
import { enemyDrawOrder, popupCloseHit, popupCloseRect, popupWindowRect, POPUP_TITLE_H, POPUP_CLOSE_W, POPUP_CLOSE_H } from '../src/view/popupEnemy.ts';
import { adCloseRect } from '../src/view/ad.ts';
import {
  hatchSegments,
  lerpColor,
  wallFocusRect,
  wallFootprintSize,
  wallSpec,
  WALL_FACE,
  WALL_FACE_DISABLED,
  WALL_FACE_PRESSED,
} from '../src/view/wallAppearance.ts';
import { towerTooltipLines, upgradeTooltipLines, tooltipText, targetModeDisplay, targetLockReason, pointerTooltipLines, fmtClickDamage, paletteTooltipLines, lockedPaletteLine, cursorTooltipLines, cursorUpgradeTooltipLines, cursorBranchTooltipLines, repairUpgradeTooltipLines, branchName } from '../src/view/tooltipText.ts';
import { BoardView, staticLayerKey, ENEMY_COLOR, SHIELD_COLOR } from '../src/view/board.ts';
import { branchMarkSpec, healthBarRect, pipRect, pipUsesBottomCorner } from '../src/view/branchMarks.ts';
import { computeLayout, pixelToWorld, worldToPixel, TITLE_H, CONTROL_BOX_W, CONTROL_BOX_H, FONT_SIZE } from '../src/view/chrome.ts';
import { computeHud, computeRightPanel, hudControlAt, textWidth } from '../src/view/hud.ts';
import {
  advanceBossBars,
  barFillPx,
  bossBarFrame,
  bossBarRect,
  bossGimmick,
  bossName,
  bossShield,
  livingBosses,
  visibleBossBars,
} from '../src/view/bossBars.ts';
import { backingStorePixelSize } from '../src/view/screen.ts';
import {
  ART_MANIFEST,
  ART_VIEWBOX,
  ART_SILHOUETTE,
  manifestEntry,
  cacheKey,
  rasterPixelSize,
  artSpriteSize,
  artNameForEnemy,
  artNameForTowerBase,
  artNameForTowerTurret,
  artNameForBranch,
  getArtTexture,
  getArtFrames,
  animationOf,
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
} from '../src/view/art.ts';
import { Texture } from 'pixi.js';
import { readdirSync, existsSync, readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { animFrame, currentAnimFrame, DEFAULT_ANIM, entityOffset } from '../src/view/anim.ts';
import { scanArt } from './art-manifest.mjs';
import { EffectsView } from '../src/view/effects.ts';
import { fileURLToPath } from 'node:url';
import {
  CameraShake,
  shakeImpulseFor,
  SHAKE_AMPLITUDE,
  SHAKE_DECAY_TICKS,
  SHAKE_MAX_TICKS,
  SHAKE_LEAK_FREEZE_MS,
} from '../src/view/shake.ts';

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

// --- 5e. Authored levels: walkable ends, expected route length, sealing, mazing, cycling -------
{
  // Every level loads with a walkable start and exit and a route of the documented length.
  const ROUTE_TOLERANCE = 2;
  const ROUTE_LENGTHS = { corridor: 48, dumbbell: 28, 'open-field': 22, turnstile: 20 };
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
  check(empty.version === 1, 'empty storage returns a default profile (version 1)');
  check(
    empty.specs.cpu === 0 && empty.specs.ram === 0 && empty.specs.gpu === 0 && empty.specs.disk === 0,
    'default spec levels are all zero',
  );
  check(
    empty.unspentSpecs === 0 && empty.achievements.length === 0 && empty.bestWave === 0 && empty.reboots === 0,
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
  p.unspentSpecs = 3;
  p.achievements.push('first-blood');
  saveProfile(p, store);
  const loaded = loadProfile(store);
  check(
    loaded.specs.cpu === 7 && loaded.unspentSpecs === 3 && loaded.achievements.includes('first-blood'),
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

// --- 14. restartWindows banks the right number of specs and resets the run ---------------------
{
  const s = createRunState();
  s.economy.earned = 5000; // sqrt(5000 / 500) = sqrt(10) = 3.16 -> floor 3
  s.wave = 52;
  const before = defaultProfile();
  const { gained, profile } = restartWindows(s, before);
  check(gained === 3, `restartWindows banks floor(sqrt(earned/500)) = ${gained}`);
  check(profile.unspentSpecs === 3, 'banked specs land in unspentSpecs');
  check(profile.reboots === 1, 'reboot count increments');
  check(profile.bestWave === 52, 'bestWave records the run wave');

  const s2 = createRunState(profile);
  check(s2.wave === 0 && s2.phase === 'build', 'the reboot resets the run');
  check(s2.unspentSpecs === 3, 'the fresh run carries the banked specs');
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

// --- 16. The hundred: generator, bosses, modifiers, victory, endless ---------------------------
{
  check(waveEnemyCount(1) === 8, 'wave 1 is unchanged (8 grunts)');

  const d100 = waveDef(100);
  check(d100 !== null && d100.groups.length > 0, 'wave 100 exists');
  check(buildSchedule(100).length > 0, 'wave 100 produces a spawn schedule');

  for (const w of [10, 25, 50, 75, 100]) {
    const bosses = buildSchedule(w).filter((sp) => sp.kind === 'boss');
    check(bosses.length === 1, `wave ${w} has exactly one boss (${bosses.length})`);
    check(isBossWave(w), `wave ${w} is marked a boss wave`);
  }

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

// --- 16b. Endless curve: 1-100 unchanged, HP bands, count/interval, modifier stacking ---------
{
  // Waves 1..100 must be byte-identical: hash the full balance table (HP scale, value scale,
  // enemy count and kill value per wave) and compare against the committed pre-curve hash.
  let table = '';
  for (let w = 1; w <= 100; w++) {
    table += `${waveHpScale(w)}|${waveValueScale(w)}|${waveEnemyCount(w)}|${waveKillValue(w)}\n`;
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < table.length; i++) {
    h ^= table.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  check((h >>> 0).toString(16) === '96749030', `waves 1..100 balance table unchanged (hash ${(h >>> 0).toString(16)})`);
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
  check(start === Math.round(0.25 * waveKillValue(3)),
    `early call: wave 3 starts at a quarter of its kill value (${start} = ${Math.round(0.25 * waveKillValue(3))})`);
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
  b.attackWallId = wall.id;
  b.x = wall.col + 0.5 - 0.6;
  b.y = wall.row + 0.5;
  b.prevX = b.x;
  b.prevY = b.y;
  b.col = wall.col - 1;
  b.row = wall.row;
  s.enemies.push(b);

  const hpBefore = wall.hp;
  check(startRepair(s, first.col, first.row), 'the repair starts under a breacher');
  check(b.attackWallId === null, 'starting a repair releases the breacher');
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

  tick(s);
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
  // 20j. Every other enemy kind still costs integrity exactly as it does today: a boss costs 3,
  // every non-boss costs 1.
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
  check(leakCost('boss') === 3, 'a boss still costs 3 integrity');
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
  // A Frost locked to 'close' slows the nearest enemy, ignoring a stored 'strong' preference.
  const s = allUnlocked();
  s.economy.salvage = 10000;
  placeTower(s, 'frost', 5, 5);
  const frost = towerAt(s, 5, 5);
  frost.targetMode = 'strong';
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const near = stationary(1, 'grunt', 1, 5.5, 5.0);
  const far = stationary(2, 'grunt', 1, 5.5, 4.0);
  far.hp = 500;
  s.enemies.push(near, far);
  tick(s);
  check(near.hp < near.maxHp, `frost with target=strong still fires at the closest enemy (near hp ${near.hp})`);
  check(near.slowFactor === 0.3, `frost slows the closest enemy (slowFactor ${near.slowFactor})`);
  check(far.hp === 500, `the farther enemy is untouched (far hp ${far.hp})`);
}

{
  // Manual Override still beats Frost's lock: while the marked enemy is in range, the frost fires at
  // it even though a closer enemy would normally be chosen.
  const s = allUnlocked();
  s.economy.salvage = 10000;
  placeTower(s, 'frost', 5, 5);
  s.phase = 'wave';
  s.nextAdAttemptTick = Number.MAX_SAFE_INTEGER;
  const near = stationary(1, 'grunt', 1, 5.5, 5.0);
  const marked = stationary(2, 'grunt', 1, 5.5, 4.0);
  marked.hp = 1;
  s.enemies.push(near, marked);
  s.pointer.targetId = marked.id;
  toggleManualOverride(s);

  tick(s);
  check(marked.dead, 'override: the frost fires at the marked enemy instead of the closest');
  check(near.hp === near.maxHp, 'override: the closer enemy is untouched while the mark lives');
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
  tick(s);
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
    tooltipText(pointerTooltipLines(g.pointer, g.economy.salvage, g.wave)[0]) === 'Wave 8 unlocks overclock 1',
    'the tooltip names the unlocking wave',
  );
  g.wave = 8;
  check(upgradePointer(g), 'overclock 1 buys once wave 8 arrives');
  check(g.pointer.clickLevel === 1, 'clickLevel becomes 1');
  check(upgradePointer(g) === false, 'overclock 2 is refused before wave 16');
  check(tooltipText(pointerTooltipLines(g.pointer, g.economy.salvage, g.wave)[0]) === 'Wave 16 unlocks overclock 2',
    'the tooltip names the next unlocking wave');
  g.wave = 16;
  check(upgradePointer(g), 'overclock 2 buys once wave 16 arrives');
  g.pointer.clickLevel = MAX_OVERCLOCK_LEVEL;
  check(pointerTooltipLines(g.pointer, g.economy.salvage, g.wave)[0] === 'Max level', 'the ladder reads Max level at the cap');
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

  tick(s);
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
  const lines = cursorTooltipLines(c, s.pointer, s.specs);
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
  check(Math.abs(first - 0.5 * clickDamage(s.pointer) * pointerDamageMult(s.specs)) < 1e-9,
    `cursor click damage is half the player's click damage (${first} = 0.5 x ${clickDamage(s.pointer)})`);

  check(upgradePointer(s), 'buy the reticle mid-wave');
  let clicks = 0;
  for (let i = 0; i < 1000 && clicks < 2; i++) {
    tick(s);
    clicks = s.events.filter((ev) => ev.type === 'damage').length;
  }
  const second = s.economy.damage.pointer - first;
  check(Math.abs(second - 0.5 * clickDamage(s.pointer) * pointerDamageMult(s.specs)) < 1e-9,
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
  check(shakeImpulseFor({ type: 'kill', kind: 'boss' }).amplitude === SHAKE_AMPLITUDE.bossDeath,
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
  gun.tier = 5;
  check(isFullyUpgraded(gun), 'a tier-5 branched gun is fully upgraded');
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
  check(right.pointer.rows.length === 3, 'the POINTER section lists stage, overclock and crits');
  check(right.globalUpgrades.title === 'GLOBAL UPGRADES', 'the right column ends with GLOBAL UPGRADES');
  check(
    right.globalUpgrades.rows.length === 1 && right.globalUpgrades.rows[0] === 'No upgrades yet',
    'GLOBAL UPGRADES is a reserved empty section',
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
  // GLOBAL UPGRADES adds no clickable controls: a point in its body is not a HUD control.
  const l = computeLayout(1280, 720);
  const s = createRunState();
  const right = computeRightPanel(l, s);
  const gx = right.globalUpgrades.rect.x + right.globalUpgrades.rect.w / 2;
  const gy = right.globalUpgrades.rect.y + right.globalUpgrades.rect.h - 4;
  check(hudControlAt(l, s, gx, gy) === null, 'GLOBAL UPGRADES has no clickable controls');
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
  const placed = cursorTooltipLines(cursorTower(3, 'C'), rs.pointer, rs.specs, 'Repairing Gun 42%');
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
  recomputeAuras(s.towers);
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
    ['enemies', 'towers', 'branches', 'board', 'fx', 'ui'].every((c) => categories.has(c)),
    'the manifest covers enemies, towers, branches, board, fx and ui',
  );
  check(ART_VIEWBOX === 32 && ART_SILHOUETTE === 28,
    `the viewBox contract is ${ART_VIEWBOX}x${ART_VIEWBOX}, silhouette ${ART_SILHOUETTE}px`);

  // 37b. Every shipped manifest file exists on disk, and no SVG on disk is unreferenced. The
  // shipped set grows as each art phase lands (towers, branches, board); the manifest itself lists
  // the whole contract from the start, so unshipped entries simply fall back to procedural drawing.
  const shippedCategories = ['enemies', 'towers', 'branches', 'board', 'fx', 'ui'];
  const missing = ART_MANIFEST.filter(
    (e) => shippedCategories.includes(e.category) && !existsSync(`${artDir}/${e.file}`),
  );
  check(missing.length === 0, `every shipped manifest file exists (${missing.map((m) => m.file).join(', ') || 'none missing'})`);

  // Every fx and ui asset parses as SVG: a single 32x32-viewBox root that closes cleanly. A malformed
  // file (truncated, wrong viewBox, unbalanced tags) would fail the rasteriser, so it is rejected here
  // rather than silently falling back to the procedural drawing.
  const svgLooksValid = (text) => {
    const t = text.trim();
    return (
      t.startsWith('<svg') &&
      t.endsWith('</svg>') &&
      t.includes('viewBox="0 0 32 32"') &&
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
  const unreferenced = onDisk.filter((f) => !referenced.has(f));
  check(unreferenced.length === 0, `no unreferenced SVG in public/art (${unreferenced.join(', ') || 'none'})`);
}

{
  // 37c. Every enemy and tower kind resolves an asset name, and the naming helpers agree.
  for (const kind of ['grunt', 'runner', 'shielded', 'flyer', 'armoured', 'saboteur', 'breacher', 'boss']) {
    check(artNameForEnemy(kind) === kind, `enemy ${kind} resolves an asset name`);
  }
  check(artNameForEnemy('popup') === null, 'the pop-up stays runtime (no asset)');
  for (const kind of ['gun', 'cannon', 'laser', 'taser', 'frost', 'aa', 'beacon', 'cursor', 'repair', 'wall']) {
    check(artNameForTowerBase(kind) === `${kind}-base`, `tower ${kind} resolves a base`);
  }
  for (const kind of ['gun', 'cannon', 'laser', 'taser', 'frost', 'aa']) {
    check(artNameForTowerTurret(kind) === `${kind}-turret`, `tower ${kind} resolves a turret`);
  }
  for (const kind of ['beacon', 'cursor', 'repair', 'wall']) {
    check(artNameForTowerTurret(kind) === null, `tower ${kind} ships no turret`);
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
  const wallBase = new Texture({ width: 6, height: 6 });
  injectArtTexture('gun-base', gunBase);
  injectArtTexture('gun-turret', gunTurret);
  injectArtTexture('beacon-base', beaconBase);
  injectArtTexture('wall-base', wallBase);

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

  // The wall preview uses the wall base art at the default (closed, un-upgraded) appearance.
  const s3 = stateOnLevel('open-field');
  s3.economy.salvage = 10000;
  const view3 = new BoardView();
  selectTower(s3, 'wall');
  view3.draw(s3, layout, 0, hover);
  check(view3.ghostBase.visible, 'ghost: the wall preview uses the wall base art');
  check(view3.ghostBase.texture === wallBase, 'ghost: the wall base is the injected texture');
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
  check(!isBossVariant('boss') && !isBossVariant('grunt'), 'the marker boss and ordinary enemies are not variants');
  check(isBossKind('boss') && isBossKind('shielded-boss'), 'boss variants and the marker boss are all bosses');
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
  // after that, favouring the newest type, and never replacing a marker boss.
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
  for (const w of [32, 40, 48, 56, 64, 72, 80, 88, 96]) {
    check(isTypeBossWave(w), `wave ${w} is a type-boss wave`);
    check(buildSchedule(w).filter((sp) => sp.kind.endsWith('-boss')).length === 1, `wave ${w} carries one type boss`);
  }
  for (const w of [10, 25, 50, 75, 100]) {
    check(buildSchedule(w).filter((sp) => sp.kind.endsWith('-boss')).length === 0,
      `a type boss never replaces the marker boss on wave ${w}`);
  }
  check(typeBossKindForWave(32) === typeBossKindForWave(32), 'type-boss selection is deterministic');
  check(isTypeBossWave(32) && !isTypeBossWave(31) && !isTypeBossWave(100), 'the eighth-wave cadence holds after wave 24');
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
  check(bossGimmick('boss') === null, 'the marker boss has no teaching subtitle');
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
  const marker = createEnemy(3, 'boss', 10, SPAWN, EXIT);
  const markerShield = bossShield(marker);
  check(markerShield.segments === 1 && markerShield.ratio === 1, 'the marker boss shows a single shield fill');
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
  // 40f. The bar never intersects a side panel or the field's top edge at two common resolutions.
  for (const [vw, vh] of [[1280, 720], [1600, 900]]) {
    const l = computeLayout(vw, vh);
    const r = bossBarRect(l, 0);
    const intersects = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    check(!intersects(r, l.leftPanel), `${vw}x${vh}: the bar never intersects the left panel`);
    check(!intersects(r, l.rightPanel), `${vw}x${vh}: the bar never intersects the right panel`);
    check(r.y >= l.board.y, `${vw}x${vh}: the bar sits below the field's top edge (and any wave banner)`);
    check(r.w <= l.boardW - 48, `${vw}x${vh}: the bar width clears the board edges (${r.w})`);
    const cx = l.board.x + l.boardW / 2;
    check(Math.abs(r.x + r.w / 2 - cx) <= 1, `${vw}x${vh}: the bar is centred over the board field`);
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

console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
