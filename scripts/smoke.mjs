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
  cancelSelection,
  placementSealsUnderToggles,
  toggleAtTile,
  cycleTargetMode,
  startRepair,
  upgradePointer,
  toggleManualOverride,
} from '../src/core/state.ts';
import { TOWER_STATS, effectiveStats, upgradeCost, createTower, sellValue, wallMaxHp, wallBlocksFlyers, isGateLocked, isToggleGate, isRepairing, repairCost, repairDurationTicks, TOGGLE_LOCK_TICKS } from '../src/core/towers.ts';
import { killReward, waveClearBonus } from '../src/core/economy.ts';
import { formatNumber } from '../src/core/format.ts';
import { buildSchedule, earlyCallBonus, isBossWave, MODIFIER_POOL, popupCountForWave, waveDef, waveEnemyCount, waveKillValue, waveModifiers } from '../src/core/waves.ts';
import { TICK_HZ, TICK_MS, secondsToTicks } from '../src/core/time.ts';
import { buildField, pathTiles, stepToward } from '../src/core/pathfield.ts';
import { COLS, ROWS, tileAt } from '../src/core/grid.ts';
import { LEVELS, DEFAULT_LEVEL, createGrid, levelById, toggleOpenAt, validateLevel, MAX_TOGGLES } from '../src/core/levels.ts';
import { createEnemy, isPopupEnemy } from '../src/core/enemies.ts';
import { spawnPopup, dismissPopup } from '../src/core/popups.ts';
import {
  comboMultiplier,
  clickDamage,
  holdDps,
  nextOverclockCost,
  nextPointerCost,
  nextCritRoll,
  critChance,
  CRIT_MULTIPLIER,
  MARKED_DAMAGE_MULT,
} from '../src/core/pointer.ts';
import { loadProfile, saveProfile, defaultProfile } from '../src/core/save.ts';
import { restartWindows, checkAchievements, enterEndless } from '../src/core/state.ts';
import { dashRects, offsetSegment, routeOffset } from '../src/view/route.ts';
import { enemyDrawOrder, popupCloseHit, popupCloseRect, popupWindowRect } from '../src/view/popupEnemy.ts';
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
import { towerTooltipLines, upgradeTooltipLines, tooltipText, targetModeDisplay, targetLockReason, pointerTooltipLines, fmtClickDamage } from '../src/view/tooltipText.ts';
import { BoardView, staticLayerKey } from '../src/view/board.ts';
import { computeLayout } from '../src/view/chrome.ts';

// All v0.10b levels share a single spawn and exit, so the older maze checks keep a local gate.
const SPAWN = DEFAULT_LEVEL.starts[0];
const EXIT = DEFAULT_LEVEL.exits[0];

/** A fresh run on a specific level, reached by cycling from the default. */
function stateOnLevel(id) {
  const s = createRunState();
  while (s.levelId !== id) cycleLevel(s);
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
      s.nextPopupAttemptTick,
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
  const s2 = createRunState();
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
    const s = createRunState();
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
  const s = createRunState();
  s.economy.salvage = 10000;
  placeTower(s, 'gun', 5, 5);
  placeTower(s, 'beacon', 6, 5);
  const gun = towerAt(s, 5, 5);
  check(Math.abs(gun.auraDamage - 1.6) < 1e-9,
    `beacon raises neighbouring gun damage by 60% (auraDamage=${gun.auraDamage.toFixed(4)})`);
}

// --- 9. Laser damages more than one enemy in a line ------------------------------------------
{
  const s = createRunState();
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
  const s = createRunState();
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
  const s2 = createRunState();
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

// --- 11. Pop-ups: timing in wave 1, no build-phase spawns, one alive, freeware and bluescreen --
{
  // No towers: wave 1's grunts live long enough for the first attempt to find two on the board.
  const s = createRunState();
  check(startWave(s), 'pop-up timing: wave 1 started with no towers');
  const limit = secondsToTicks(20);
  let firstSeen = -1;
  for (let i = 0; i < limit; i++) {
    tick(s);
    if (firstSeen < 0 && s.popup) firstSeen = s.tick;
  }
  check(firstSeen > 0 && firstSeen <= limit,
    `wave 1 produces a pop-up within 20 s (first seen at tick ${firstSeen})`);
}

{
  const s = createRunState();
  check(startWave(s), 'pop-up timing: wave 1 started for the build-phase check');
  let spawnedInBuild = false;
  let previousId = null;
  for (let i = 0; i < secondsToTicks(120); i++) {
    const phase = s.phase;
    tick(s);
    const id = s.popup?.id ?? null;
    if (id !== null && id !== previousId && phase === 'build') spawnedInBuild = true;
    previousId = id;
  }
  check(s.phase === 'build', 'wave 1 ended and the run waits in build');
  check(!spawnedInBuild, 'no pop-up ever spawns during build phase');
}

{
  const s = createRunState();
  for (let i = 0; i < 1000; i++) tick(s);
  check(s.popup === null, 'no pop-up ever spawns in an untouched build phase');

  const first = spawnPopup(s, 'defrag');
  check(first !== null, 'a pop-up spawns on demand');
  check(spawnPopup(s, 'freeware') === null, 'two pop-ups never coexist (a second is refused)');
  s.popup = null;
}

{
  const s = createRunState();
  const routeBefore = currentPath(s).length;
  const popup = spawnPopup(s, 'freeware');
  check(dismissPopup(s, popup.id), 'dismiss freeware');
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
  const popup = spawnPopup(s, 'bluescreen');
  const before = s.economy.salvage;
  check(dismissPopup(s, popup.id), 'dismiss bluescreen');
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
  s.nextPopupAttemptTick = Number.MAX_SAFE_INTEGER; // no pop-ups mid-test
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
  wall.hp = 40; // 20 damage taken

  check(upgradeTower(s, 5, 5), 'upgrade wall 1 -> 2');
  check(wall.tier === 2 && wall.maxHp === 180 && wall.hp === 160,
    `wall HP survives upgrade (${wall.hp}/180)`);

  check(chooseBranch(s, 5, 5, 'A'), 'choose Bulwark (2 -> 3)');
  check(wall.tier === 3 && wall.branch === 'A' && wall.maxHp === 1080 && wall.hp === 1060,
    `Bulwark doubles the total and keeps damage (${wall.hp}/1080)`);
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
    s.nextPopupAttemptTick = Number.MAX_SAFE_INTEGER;
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
  s.nextPopupAttemptTick = Number.MAX_SAFE_INTEGER;
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
  s.nextPopupAttemptTick = Number.MAX_SAFE_INTEGER;
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
  s.nextPopupAttemptTick = Number.MAX_SAFE_INTEGER;
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
  const s = createRunState();
  s.economy.salvage = 10000;
  placeTower(s, 'cannon', 5, 6);
  s.phase = 'wave';
  s.nextPopupAttemptTick = Number.MAX_SAFE_INTEGER;
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
  check(close.w === 14 && close.h === 12, `close box is 14x12 px (${close.w}x${close.h})`);

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
  s.nextPopupAttemptTick = Number.MAX_SAFE_INTEGER;
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

// --- 23. Targeting locks: Taser (close), Laser (first), Cannon (strong), Gun (player's choice) --
{
  // A Taser locked to 'close' ignores a stored 'strong' preference and fires at the nearest enemy.
  const s = createRunState();
  s.economy.salvage = 10000;
  placeTower(s, 'taser', 5, 5);
  const taser = towerAt(s, 5, 5);
  taser.targetMode = 'strong';
  s.phase = 'wave';
  s.nextPopupAttemptTick = Number.MAX_SAFE_INTEGER;
  const near = stationary(1, 'grunt', 1, 5.5, 5.0);
  const far = stationary(2, 'grunt', 1, 5.5, 4.0);
  far.hp = 500;
  s.enemies.push(near, far);
  tick(s);
  check(near.hp < near.maxHp, `taser with target=strong still fires at the closest enemy (near hp ${near.hp})`);
  check(far.hp === 500, `the stronger, farther enemy is untouched (far hp ${far.hp})`);
}

{
  // A Laser locked to 'first' fires at the furthest-along enemy, ignoring a stored 'strong' choice.
  const s = createRunState();
  s.economy.salvage = 10000;
  placeTower(s, 'laser', 5, 5);
  const laser = towerAt(s, 5, 5);
  laser.targetMode = 'strong';
  s.phase = 'wave';
  s.nextPopupAttemptTick = Number.MAX_SAFE_INTEGER;
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
  const s = createRunState();
  s.economy.salvage = 10000;
  placeTower(s, 'cannon', 5, 5);
  const cannon = towerAt(s, 5, 5);
  cannon.targetMode = 'first';
  s.phase = 'wave';
  s.nextPopupAttemptTick = Number.MAX_SAFE_INTEGER;
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
    s.nextPopupAttemptTick = Number.MAX_SAFE_INTEGER;
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
  check(targetModeDisplay(createTower(2, 'laser', 0, 0)) === 'First (fixed)', 'laser panel reads "First (fixed)"');
  check(targetModeDisplay(createTower(3, 'cannon', 0, 0)) === 'Strong (fixed)', 'cannon panel reads "Strong (fixed)"');
  const gun = createTower(4, 'gun', 0, 0);
  check(targetModeDisplay(gun) === 'First', 'gun panel reads its stored mode');
  check(targetLockReason('taser') === 'A Tesla coil discharges into whatever is nearest.', 'taser tooltip explains the lock');
  check(targetLockReason('laser') !== null && targetLockReason('cannon') !== null, 'laser and cannon tooltips each explain their lock');
  check(targetLockReason('gun') === null, 'the configurable gun has no lock reason');

  const s = createRunState();
  s.economy.salvage = 10000;
  placeTower(s, 'taser', 5, 5);
  placeTower(s, 'gun', 6, 5);
  const taser = towerAt(s, 5, 5);
  taser.targetMode = 'strong';
  cycleTargetMode(s, 5, 5);
  check(taser.targetMode === 'strong', 'the target key/click does not change a locked taser');
  const g = towerAt(s, 6, 5);
  g.targetMode = 'first';
  cycleTargetMode(s, 6, 5);
  check(g.targetMode === 'strong', 'the target key/click still cycles a configurable gun');
}

// --- 24. Pointer overclock ladder, crits and Manual Override --------------------------------
{
  // 24a. The ladder: cost and damage follow the formulas, and the tooltip's "after" is the value
  // actually applied once the level is bought.
  const s = createRunState();
  s.economy.salvage = 100000;
  check(upgradePointer(s), 'pointer upgrades stage 1 -> 2');
  check(s.pointer.stage === 2, 'pointer is at stage 2');
  check(s.pointer.clickLevel === 0, 'clickLevel starts at 0');
  check(nextOverclockCost(s.pointer) === Math.round(120 * 1.55 ** 0), 'first overclock costs 120');
  check(clickDamage(s.pointer) === 4, 'stage-2 click damage is 4 at level 0');
  check(holdDps(s.pointer) === 10, 'stage-2 hold dps is 10 at level 0');

  const sal = s.economy.salvage;
  check(upgradePointer(s), 'buy overclock level 1');
  check(s.pointer.clickLevel === 1, 'clickLevel becomes 1');
  check(s.economy.salvage === sal - 120, 'level 1 costs 120');
  check(Math.abs(clickDamage(s.pointer) - 4 * 1.35) < 1e-9, 'click damage follows 4 * 1.35^1');
  check(Math.abs(holdDps(s.pointer) - clickDamage(s.pointer) * 2.5) < 1e-9, 'hold dps scales with click');
  check(nextOverclockCost(s.pointer) === Math.round(120 * 1.55 ** 1), 'next overclock cost follows the formula');
  check(nextPointerCost(s.pointer) === nextOverclockCost(s.pointer), 'nextPointerCost is the overclock cost at stage 2');

  // Buying the level the tooltip previewed must raise the damage to the tooltip's "after" value.
  const tooltipLine = pointerTooltipLines(s.pointer, s.economy.salvage)[0];
  const previewAfter = fmtClickDamage(clickDamage({ ...s.pointer, clickLevel: s.pointer.clickLevel + 1 }));
  check(tooltipText(tooltipLine).includes(previewAfter), `overclock tooltip previews the applied damage (${tooltipText(tooltipLine)})`);
  upgradePointer(s);
  check(fmtClickDamage(clickDamage(s.pointer)) === previewAfter, 'the tooltip after-value matches the damage applied after buying');
}

{
  // 24b. A click on a marked enemy deals 1.5x an unmarked click (crits suppressed by a chosen seed).
  const findNoCritSeed = (seed) => {
    let r = seed;
    for (let i = 0; i < 10000; i++) {
      if (!nextCritRoll(r, true, false).crit) return r; // marked worst-case chance (25%) does not crit
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
  pointerDown(unmarked.s, unmarked.e.x, unmarked.e.y + 0.15);
  const unmarkedDmg = unmarked.e.maxHp - unmarked.e.hp;

  const marked = make();
  marked.s.pointer.targetId = marked.e.id; // mark without clicking
  pointerDown(marked.s, marked.e.x, marked.e.y + 0.15);
  const markedDmg = marked.e.maxHp - marked.e.hp;

  check(Math.abs(markedDmg - unmarkedDmg * MARKED_DAMAGE_MULT) < 1e-9,
    `a marked click deals ${MARKED_DAMAGE_MULT}x an unmarked click (${markedDmg} vs ${unmarkedDmg})`);
}

{
  // 24c. Crits: with a forced seed, clicks crit at the base rate over a thousand samples, and a
  // crit deals 2.5x.
  check(critChance(false, false) === 0.1, 'base crit chance is 10%');
  check(critChance(true, false) === 0.25, 'marked crit chance is 25%');
  check(critChance(false, true) === 0.3, 'weak-point crit chance is 30%');

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
  check(crits >= 60 && crits <= 140, `clicks crit at ~10% over 1000 samples (${crits} crits)`);

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
  const s = createRunState();
  s.economy.salvage = 10000;
  placeTower(s, 'cannon', 5, 5); // locked to 'strong'
  s.phase = 'wave';
  s.nextPopupAttemptTick = Number.MAX_SAFE_INTEGER;
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
  s.nextPopupAttemptTick = Number.MAX_SAFE_INTEGER;
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
      s.nextPopupAttemptTick,
    ]);
  };
  const at60 = run(TICK_MS);
  check(at60 === run(1000 / 144), 'a click in the mix: same result at 60 Hz and 144 Hz frames');
  check(at60 === run(1000 / 23), 'a click in the mix: same result at 23 Hz frames');
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
