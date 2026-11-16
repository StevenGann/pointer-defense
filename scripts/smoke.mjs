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
} from '../src/core/state.ts';
import { TOWER_STATS } from '../src/core/towers.ts';
import { killReward } from '../src/core/economy.ts';
import { formatNumber } from '../src/core/format.ts';
import { waveEnemyCount } from '../src/core/waves.ts';
import { TICK_MS } from '../src/core/time.ts';
import { buildField } from '../src/core/pathfield.ts';
import { createGrid, SPAWN, EXIT, COLS, ROWS } from '../src/core/grid.ts';
import { createEnemy } from '../src/core/enemies.ts';

let failures = 0;
function check(cond, msg) {
  console.log(`${cond ? 'ok  ' : 'FAIL'}  ${msg}`);
  if (!cond) failures++;
}

// --- 1. Towers alone clear wave 1 -------------------------------------------------------------
{
  const s = createRunState();
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
  const s = createRunState();
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
    return JSON.stringify([s.economy, s.integrity, s.enemies.map((e) => [e.id, e.hp, e.dist])]);
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
  const s2 = createRunState();
  const before = currentPath(s2).length;
  s2.economy.salvage = 10000;
  for (const [c, r] of [[11, 5], [12, 5], [11, 7], [12, 7]]) {
    check(placeTower(s2, 'gun', c, r), `wall tower placed at ${c},${r}`);
  }
  const after = currentPath(s2).length;
  check(after > before, `detour lengthens the route (${before} -> ${after} tiles)`);

  // 5c. buildField: finite at the exit, -1 once the board is sealed.
  const grid = createGrid();
  const open = buildField(grid, new Set());
  check(open[EXIT.row * COLS + EXIT.col] === 0, 'buildField gives the exit a finite distance (0)');
  const wall = new Set();
  for (let r = 0; r < ROWS; r++) wall.add(r * COLS + 10);
  const sealed = buildField(grid, wall);
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

console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
