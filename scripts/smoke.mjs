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
} from '../src/core/state.ts';
import { TOWER_STATS, effectiveStats, upgradeCost, createTower } from '../src/core/towers.ts';
import { killReward } from '../src/core/economy.ts';
import { formatNumber } from '../src/core/format.ts';
import { buildSchedule, isBossWave, MODIFIER_POOL, waveDef, waveEnemyCount, waveModifiers } from '../src/core/waves.ts';
import { TICK_HZ, TICK_MS, secondsToTicks } from '../src/core/time.ts';
import { buildField } from '../src/core/pathfield.ts';
import { createGrid, SPAWN, EXIT, COLS, ROWS, tileAt } from '../src/core/grid.ts';
import { createEnemy } from '../src/core/enemies.ts';
import { spawnPopup, dismissPopup } from '../src/core/popups.ts';
import { comboMultiplier } from '../src/core/pointer.ts';
import { loadProfile, saveProfile, defaultProfile } from '../src/core/save.ts';
import { restartWindows, checkAchievements, enterEndless } from '../src/core/state.ts';

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
  const s3 = createRunState();
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
  s.schedule = [];
  s.enemies = [];
  tick(s);
  check(s.phase === 'victory', 'clearing wave 100 sets victory');
}

{
  const s = createRunState();
  s.wave = 99;
  s.phase = 'build';
  startWave(s);
  s.schedule = [];
  s.enemies = [];
  tick(s);
  check(s.phase === 'victory', 'endless setup: victory reached');
  enterEndless(s);
  check(s.endless && s.phase === 'build', 'endless returns to build phase');
  check(startWave(s), 'endless starts wave 101');
  check(s.wave === 101, 'endless continues at 101');
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
