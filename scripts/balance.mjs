// Headless balance harness: a deterministic, scripted player that plays the whole game with no
// rendering, importing src/core directly (Node 22.18+/23.6+ strips TypeScript types natively).
//
// The player is "competent but not expert": it builds a serpentine wall maze (forcing the route to
// lengthen, which is the mazing mechanic), covers the route with a spread of towers (each placed to
// play to its role), upgrades cheaply, and clicks the front-most enemy at a fixed rate with a
// configurable weak-point accuracy. It never sells. It may reboot once at a configurable wave and
// replay with the banked specs.
//
// Exit code 0 when the session reaches --to, 1 when the run ends early (integrity hit 0).

import {
  createRunState,
  placeTower,
  startWave,
  tick,
  pointerDown,
  pointerUp,
  currentPath,
  upgradeTower,
  upgradePointer,
  chooseBranch,
  towerAt,
  restartWindows,
  spawnTile,
  exitTile,
  cycleLevel,
  closePopupEnemy,
} from '../src/core/state.ts';
import { TOWER_KINDS, TOWER_STATS, upgradeCost, repairCost, isRepairing, isTowerUnlocked } from '../src/core/towers.ts';
import { spend } from '../src/core/economy.ts';
import { radiusOf, isPopupEnemy, setBreacherTurretDamage } from '../src/core/enemies.ts';
import { buildField, isSealed, pathTiles } from '../src/core/pathfield.ts';
import { COLS, ROWS, tileAt } from '../src/core/grid.ts';
import { LEVELS, levelById, toggleOpenAt, toggleCombinations } from '../src/core/levels.ts';
import { defaultProfile, SPEC_CAPS } from '../src/core/save.ts';
import { buildSchedule } from '../src/core/waves.ts';
import { TICK_HZ } from '../src/core/time.ts';

// --- CLI flags --------------------------------------------------------------------------------
const args = process.argv.slice(2);
function flag(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : fallback;
}
function hasFlag(name) {
  return args.includes(name);
}

const to = Math.max(1, parseInt(flag('--to', '100'), 10) || 100);
const rebootAtRaw = parseInt(flag('--reboot-at', '60'), 10);
const rebootAt = Number.isFinite(rebootAtRaw) ? rebootAtRaw : 60; // 0 disables rebooting
const accuracy = Math.min(1, Math.max(0, parseFloat(flag('--accuracy', '0.35')) || 0));
const cps = Math.max(0.1, parseFloat(flag('--cps', '3')) || 3);
const quiet = hasFlag('--quiet');
// --click <ticks>: close each pop-up enemy that many ticks after it spawns (a human's reaction
// time). --no-click never closes them, leaving the shield up for the whole walk as the control.
const noClick = hasFlag('--no-click');
const clickDelay = noClick ? null : Math.max(1, parseInt(flag('--click', '45'), 10) || 45);
// --no-support: run the control (Frost/Beacon replaced by Guns) instead of the standard spread.
const support = !hasFlag('--no-support');
// --no-build: a click-only player — never place a tower, spend salvage on the pointer instead.
const noBuild = hasFlag('--no-build');
// --wall: the standard build, but the maze is built from wall towers instead of Guns, and the
// walls are kept upgraded so breachers have something to chew on.
// --repair: the wall build, judged twice — once as-is and once with the bot auto-repairing any wall
// below 50% HP during the build phase — so the breacher-heavy run reports with and without repairs.
// --repair implies --wall (the breacher-heavy maze is what repairs are tested against).
const repairMode = hasFlag('--repair');
const wallMode = hasFlag('--wall') || repairMode;
// Toggled by the --repair comparison; when true the build phase patches damaged walls. Mutable
// because the comparison runs the same wall build with the switch off and on.
let autoRepair = false;
/** Salvage spent on repairs in the current run (reset by playRun, summed by runSession). */
let repairSpend = 0;
// --call: run normally, calling the next wave once the current spawn queue is exhausted and enemies
// are still on the board. --call-all: chain every remaining wave at tick zero (a stress test).
// --call-sweep: call every wave at 25%, 50% and 75% of its spawn window, one run per timing.
const callMode = hasFlag('--call');
const callAllMode = hasFlag('--call-all');
const callSweepMode = hasFlag('--call-sweep');
// --clicker (alias --advantage): the clicker comparison — a player clicking at 2 clicks/s and buying
// pointer levels whenever affordable (clicker-first), judged against the same build with no clicking
// at all, and against the standard tower build. The advantage is the clicker-first integrity over the
// standard run; the pointer ladder may pull ahead, but it must not dominate (cap +8 integrity).
const clickerMode = hasFlag('--clicker') || hasFlag('--advantage');
// --cursor: the cursor comparison — the standard plan plus two cursors bought from wave 60, judged
// against the standard tower build. The advantage is the cursor build's integrity over the standard
// run, so the cursor's own contribution is measured against the tower baseline it sits on.
const cursorMode = hasFlag('--cursor');
// --repair-tower: the repair-tower scenario — the standard build, but the bot also buys a repair
// tower once a wave is deep enough to have damaged towers to heal. It proves the harness can place
// and pay for the new kind; the default plan never buys one, so the standard numbers stay put.
const repairTowerMode = hasFlag('--repair-tower');
// --turret-damage <n>: override the breacher turret's per-shot damage for a balance sweep (0 as the
// control, then the candidate rates). Absent, the harness plays the committed constant.
const turretDamageRaw = flag('--turret-damage', null);
const turretDamageOverride = turretDamageRaw === null ? null : Math.max(0, parseFloat(turretDamageRaw) || 0);
// --level <id> selects one authored map; the default runs all three and prints one line each.
const levelFlag = flag('--level', null);
const activeLevels = levelFlag ? [levelById(levelFlag)] : [...LEVELS];
const singleLevel = activeLevels.length === 1;
// Suppresses the per-wave and per-run chatter while the map loop runs; the map lines are the point.
let silent = false;

// Apply the turret-damage override once, before any run reads the committed constant.
if (turretDamageOverride !== null) setBreacherTurretDamage(turretDamageOverride);

// --- Deterministic PRNG (mulberry32), independent of the sim's own stream ----------------------
function makeRng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}
// The click RNG is the one piece of harness state that outlives a single run. It is a module-level
// closure, so if the map loop shares it, each map inherits whatever stream position the previous map
// left behind and the same map's numbers drift with the batch order. Every run resets it to the same
// seed (resetClickRng below), so a map plays identically alone, first, last, or in any order.
function clickSeed() {
  return 0x9e3779b9 ^ (Math.round(accuracy * 1000) << 8) ^ Math.round(cps * 10);
}
let rng = makeRng(clickSeed());
function resetClickRng() {
  rng = makeRng(clickSeed());
}

/** A fresh run on a specific authored map, reached by cycling from the default level. */
function createStateOn(profile, levelId) {
  const s = createRunState(profile);
  while (s.levelId !== levelId) cycleLevel(s);
  return s;
}

// --- The maze ---------------------------------------------------------------------------------
// A serpentine of full-height walls (top- or bottom-anchored), one plan per authored map. Single
// towers cannot maze an open board; only contiguous walls force the route around their end. Each
// wall is built from the spawn/exit row outward so every early tower both blocks the route and
// covers it.
function wallOutward(col, rows) {
  const sorted = [...rows].sort((a, b) => Math.abs(a - 6) - Math.abs(b - 6) || a - b);
  return sorted.map((row) => ({ col, row }));
}

/** Per-map maze plans. Open Field and Corridor share the classic three-wall serpentine; Dumbbell
 *  forces its route up through the halls by walling the bottom corridors and one neck-adjacent
 *  column. */
const WALL_PLANS = {
  corridor: [
    ...wallOutward(6, [0, 1, 2, 3, 4, 5, 6, 7, 8]), // wall 1, gap at bottom
    ...wallOutward(10, [3, 4, 5, 6, 7, 8, 9, 10, 11]), // wall 2, gap at top
    ...wallOutward(14, [0, 1, 2, 3, 4, 5, 6, 7, 8]), // wall 3, gap at bottom
  ],
  dumbbell: [
    ...wallOutward(1, [3, 4, 5, 6, 7, 8, 9, 10, 11]), // left column, gap at top
    ...wallOutward(7, [3, 4, 5, 6, 7, 8, 9, 10, 11]), // left hall, gap at top
    ...wallOutward(10, [0, 1, 2, 3, 4, 5, 6, 7, 8]), // across the neck, gap at bottom
    ...wallOutward(18, [3, 4, 5, 6, 7, 8, 9, 10, 11]), // right column, gap at top
  ],
  'open-field': [
    ...wallOutward(6, [0, 1, 2, 3, 4, 5, 6, 7, 8]), // wall 1, gap at bottom
    ...wallOutward(10, [3, 4, 5, 6, 7, 8, 9, 10, 11]), // wall 2, gap at top
    ...wallOutward(14, [0, 1, 2, 3, 4, 5, 6, 7, 8]), // wall 3, gap at bottom
  ],
  // Turnstile's two corridors stack between the ceiling and the drawer seal. The maze walls the
  // direct lane shut at every column and mazes the upper hall with four three-tall walls, so the
  // route always runs the hall and the two shutters only gate the un-mazed lane. The final wall
  // targets the direct gate itself — a shutter, so it never goes down.
  turnstile: [
    ...wallOutward(2, [1, 2, 3]), // upper hall wall 1, gap at row 0
    ...wallOutward(6, [0, 1, 2]), // upper hall wall 2, gap at row 3
    ...wallOutward(10, [1, 2, 3]), // upper hall wall 3, gap at row 0
    ...wallOutward(13, [0, 1, 2]), // upper hall wall 4, gap at row 3
    ...wallOutward(1, [5]), // direct lane seal, left half
    ...wallOutward(2, [6]),
    ...wallOutward(3, [5]),
    ...wallOutward(4, [6]),
    ...wallOutward(5, [5]),
    ...wallOutward(6, [6]),
    ...wallOutward(7, [5]),
    ...wallOutward(8, [6]),
    ...wallOutward(9, [5]),
    ...wallOutward(11, [6]), // direct lane seal, right half
    ...wallOutward(12, [5]),
    ...wallOutward(13, [6]),
    ...wallOutward(14, [5]),
    ...wallOutward(15, [6]),
    ...wallOutward(16, [5]),
    ...wallOutward(17, [6]),
    ...wallOutward(18, [5]),
    ...wallOutward(10, [6]), // the direct gate itself: never buildable
  ],
};

/** Cap on towers: the maze walls plus a full ring of route coverage, a competent-not-expert board. */
const MAX_TOWERS = 45;
/** The sweep has no reboot to bank for, so it may keep spending bonus salvage on extra Guns. */
const SWEEP_MAX_TOWERS = 60;
/** The map loop plays a stronger board (coverage guns, higher cap) so every authored map is beatable. */
const MAP_MAX_TOWERS = 60;

// --- Build policy -----------------------------------------------------------------------------

const idx = (c, r) => r * COLS + c;

function neighbours(c, r) {
  const out = [];
  if (c > 0) out.push([c - 1, r]);
  if (c < COLS - 1) out.push([c + 1, r]);
  if (r > 0) out.push([c, r - 1]);
  if (r < ROWS - 1) out.push([c, r + 1]);
  return out;
}

function adjacentToPath(path, c, r) {
  return neighbours(c, r).some(([nc, nr]) => path.some((t) => t.col === nc && t.row === nr));
}

function coverCount(path, c, r, range) {
  let n = 0;
  for (const t of path) {
    const dx = t.col + 0.5 - (c + 0.5);
    const dy = t.row + 0.5 - (r + 0.5);
    if (dx * dx + dy * dy <= range * range) n++;
  }
  return n;
}

const tileDist2 = (a, b) => (a.col - b.col) ** 2 + (a.row - b.row) ** 2;

/** Tile indices where the route changes direction (the corners of the maze). */
function pathCorners(path) {
  const set = new Set();
  for (let i = 1; i < path.length - 1; i++) {
    const a = path[i - 1];
    const b = path[i];
    const c = path[i + 1];
    if (b.col - a.col !== c.col - b.col || b.row - a.row !== c.row - b.row) {
      set.add(idx(b.col, b.row));
    }
  }
  return set;
}

/** Maximal straight (axis-aligned) runs of the path, length >= 2 tiles. */
function straightRuns(path) {
  const runs = [];
  if (path.length < 2) return runs;
  let run = [path[0]];
  let dir = null;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const d = `${b.col - a.col},${b.row - a.row}`;
    if (dir === d) {
      run.push(b);
    } else {
      if (run.length >= 2) runs.push(run);
      run = [a, b];
      dir = d;
    }
  }
  if (run.length >= 2) runs.push(run);
  return runs;
}

/** A tile is a legal coverage placement: buildable, unblocked, not sealing, not re-routing. On a
 *  toggle map the closed shutters block exactly like towers for ground pathing, so both the sealing
 *  check (every toggle combination, like placeTower) and the re-route check (the current state, so
 *  a mid-wave route change does not reject every adjacent tile) must account for the toggles. */
function legalPlacement(s, path, c, r) {
  if (tileAt(s.grid, c, r) !== 'buildable') return false;
  const i = idx(c, r);
  if (s.blocked.has(i)) return false;
  const base = new Set(s.blocked);
  for (const closed of toggleCombinations(s.toggles)) {
    const blocked = new Set(base);
    blocked.add(i);
    for (const t of closed) blocked.add(t);
    if (isSealed(s.grid, blocked, spawnTile(s), exitTile(s))) return false;
  }
  const blocked = new Set(s.blocked);
  for (const t of s.toggles) if (!toggleOpenAt(t, s.clock)) blocked.add(t.row * COLS + t.col);
  blocked.add(i);
  return pathTiles(buildField(s.grid, blocked, exitTile(s)), spawnTile(s)).length === path.length;
}

function adjacentCandidates(s, path) {
  const out = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!adjacentToPath(path, c, r)) continue;
      if (legalPlacement(s, path, c, r)) out.push({ col: c, row: r });
    }
  }
  return out;
}

function allCandidates(s, path) {
  const out = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (legalPlacement(s, path, c, r)) out.push({ col: c, row: r });
    }
  }
  return out;
}

function bestTile(candidates, score) {
  let best = null;
  let bestScore = -Infinity;
  for (const tile of candidates) {
    const v = score(tile.col, tile.row);
    if (v > bestScore) {
      bestScore = v;
      best = tile;
    }
  }
  return best;
}

// Frost: cover the longest single straight run of route (it slows, so it goes in front of damage).
function frostScore(path, c, r, range) {
  let best = 0;
  for (const run of straightRuns(path)) {
    let n = 0;
    for (const t of run) if (tileDist2(t, { col: c, row: r }) <= range * range) n++;
    best = Math.max(best, n);
  }
  return best;
}

// Laser: pierce wants a line, so it goes on a straight stretch its beam can travel along.
function laserScore(path, c, r, range) {
  let best = 0;
  for (const run of straightRuns(path)) {
    const sameRow = run.every((t) => t.row === run[0].row);
    const sameCol = run.every((t) => t.col === run[0].col);
    if ((sameRow && r === run[0].row) || (sameCol && c === run[0].col)) {
      let n = 0;
      for (const t of run) if (tileDist2(t, { col: c, row: r }) <= range * range) n++;
      best = Math.max(best, n);
    }
  }
  return best;
}

// Taser: short-range close work, so it wants a corner where the route turns (ideally twice) nearby.
function taserScore(path, c, r, range, cornerSet) {
  let n = 0;
  for (const key of cornerSet) {
    const col = key % COLS;
    const row = (key - col) / COLS;
    if (tileDist2({ col, row }, { col: c, row: r }) <= range * range) n++;
  }
  return n;
}

// Beacon: the maze's centre, so its aura covers the most tower tiles.
function beaconScore(s, c, r, range) {
  let n = 0;
  for (const t of s.towers) {
    if (tileDist2({ col: t.col, row: t.row }, { col: c, row: r }) <= range * range) n++;
  }
  return n;
}

function chooseFrostTile(s, path) {
  return bestTile(adjacentCandidates(s, path), (c, r) => frostScore(path, c, r, TOWER_STATS.frost.range));
}
function chooseLaserTile(s, path) {
  return bestTile(adjacentCandidates(s, path), (c, r) => laserScore(path, c, r, TOWER_STATS.laser.range));
}
function chooseTaserTile(s, path) {
  const corners = pathCorners(path);
  return bestTile(adjacentCandidates(s, path), (c, r) => taserScore(path, c, r, TOWER_STATS.taser.range, corners));
}
function chooseBeaconTile(s, path) {
  return bestTile(allCandidates(s, path), (c, r) => beaconScore(s, c, r, TOWER_STATS.beacon.range));
}
function chooseCoverageTile(s, path) {
  const corners = pathCorners(path);
  return bestTile(adjacentCandidates(s, path), (c, r) => {
    const cover = coverCount(path, c, r, TOWER_STATS.gun.range);
    const corner = neighbours(c, r).some(([nc, nr]) => corners.has(idx(nc, nr)));
    return cover * 10 + (corner ? 1 : 0);
  });
}

function tileForKind(s, path, kind) {
  switch (kind) {
    case 'frost':
      return chooseFrostTile(s, path);
    case 'beacon':
      return chooseBeaconTile(s, path);
    case 'laser':
      return chooseLaserTile(s, path);
    case 'taser':
      return chooseTaserTile(s, path);
    case 'cannon':
      return chooseCoverageTile(s, path);
    default:
      return chooseCoverageTile(s, path);
  }
}

function frostTarget(wave) {
  return wave >= 12 ? Math.min(4, 1 + Math.floor((wave - 12) / 12)) : 0;
}
function beaconTarget(wave) {
  return wave >= 16 ? Math.min(3, 1 + Math.floor((wave - 16) / 25)) : 0;
}
function laserTarget(wave) {
  return wave >= 20 ? Math.min(3, 1 + Math.floor((wave - 20) / 25)) : 0;
}
function taserTarget(wave) {
  return wave >= 18 ? Math.min(3, 1 + Math.floor((wave - 18) / 20)) : 0;
}
function cannonTarget(wave) {
  return wave >= 4 ? Math.min(5, 1 + Math.floor((wave - 4) / 15)) : 0;
}
function cursorTarget(wave) {
  // Cursors are a late buy: two of them once the click ladder is strong enough to feed them, at
  // wave 60 when click damage is roughly 20+. This target is only consulted by the --cursor
  // scenario; the default baseline buys none.
  return wave >= 60 ? 2 : 0;
}
function repairTowerTarget(wave) {
  // One repair tower from wave 40, a second from wave 70 — a support buy, only consulted by the
  // --repair-tower scenario. The default plan buys none.
  return wave >= 70 ? 2 : wave >= 40 ? 1 : 0;
}

/** Specialist slots still needed to reach wave 100's roster, so extra Guns never crowd them out. */
function futureSpecialistSlots(counts) {
  return (
    Math.max(0, frostTarget(100) - counts.frost) +
    Math.max(0, beaconTarget(100) - counts.beacon) +
    Math.max(0, laserTarget(100) - counts.laser) +
    Math.max(0, taserTarget(100) - counts.taser) +
    Math.max(0, cannonTarget(100) - counts.cannon)
  );
}

/** Pick the tower kind for a coverage placement, per the build policy. A specialist the policy
 *  wants but that has not unlocked yet (e.g. the Cannon the plan asks for as wave 4 opens) is skipped,
 *  so the policy falls back to the always-available Gun instead of failing the placement. */
function decideKind(s, counts, wave) {
  if (counts.frost < frostTarget(wave) && isTowerUnlocked('frost', s.wave)) return 'frost';
  if (counts.beacon < beaconTarget(wave) && isTowerUnlocked('beacon', s.wave)) return 'beacon';
  if (counts.laser < laserTarget(wave) && isTowerUnlocked('laser', s.wave)) return 'laser';
  if (counts.taser < taserTarget(wave) && isTowerUnlocked('taser', s.wave)) return 'taser';
  if (counts.cannon < cannonTarget(wave) && isTowerUnlocked('cannon', s.wave)) return 'cannon';
  return 'gun';
}

/** Upgrade any tower whose next step is cheaper than a new tower of the same kind. */
function upgradePass(s) {
  for (let guard = 0; guard < 400; guard++) {
    let done = true;
    for (const t of s.towers) {
      const cost = upgradeCost(t);
      if (cost === null || cost >= TOWER_STATS[t.kind].cost) continue;
      if (s.economy.salvage < cost) continue;
      if (upgradeTower(s, t.col, t.row)) {
        done = false;
        break;
      }
    }
    if (done) break;
  }
}

/**
 * Auto-repair: patch any wall below 50% HP during the build phase. The build phase has no enemies and
 * no time pressure, so the repair is modelled as its up-front cost returning the wall to full before
 * the next wave — the timed, off-the-field risk only bites when a repair runs mid-battle, which this
 * bot deliberately avoids. Repair spending competes with tower purchases, so walls stay alive longer
 * without becoming immortal.
 */
function repairWallsDuringBuild(s) {
  for (let guard = 0; guard < 10000; guard++) {
    const target = s.towers.find((t) => t.kind === 'wall' && t.hp < t.maxHp * 0.5);
    if (!target) break;
    const cost = repairCost(target);
    if (!spend(s.economy, cost)) break;
    repairSpend += cost;
    target.hp = target.maxHp;
  }
}

/** The salvage cost of the next tower the bot still wants to buy (0 once the board is full). */
function nextTowerCost(s, counts, wave, wallIdx, maxTowers) {
  if (s.towers.length >= maxTowers) return 0;
  const plan = WALL_PLANS[s.levelId] ?? WALL_PLANS['open-field'];
  if (wallIdx < plan.length) {
    const mazeKind = wallMode ? 'wall' : 'gun';
    return TOWER_STATS[mazeKind].cost;
  }
  return TOWER_STATS[decideKind(s, counts, wave)].cost;
}

/**
 * Auto-repair of non-wall towers between waves: a player whose tower went offline spends idle salvage
 * bringing it back, where the original bot left it dark and spiralled. Only the build phase qualifies
 * (a repair takes the tower off the field, so it must never run while the tower is the lanekeeper),
 * and only after the normal build policy has spent what it can — a repair is paid out of surplus and
 * is skipped when it would eat into the cost of the next tower the bot still wants. The most valuable
 * damaged tower (highest spent, build + upgrade) is fixed first. Walls are never repaired: they heal
 * or die on their own, and the aura covers them.
 */
function repairTowersDuringBuild(s, counts, wave, wallIdx, maxTowers) {
  if (s.phase !== 'build') return; // a repair takes the tower offline; never mid-wave
  const reserve = nextTowerCost(s, counts, wave, wallIdx, maxTowers);
  for (let guard = 0; guard < 10000; guard++) {
    let target = null;
    for (const t of s.towers) {
      if (t.kind === 'wall') continue;
      if (t.maxHp <= 0) continue;
      if (isRepairing(t, s.clock)) continue;
      if (t.hp <= 0 || t.hp < t.maxHp * 0.35) {
        if (!target || t.spent > target.spent) target = t;
      }
    }
    if (!target) break;
    const cost = repairCost(target);
    if (cost <= 0) break;
    if (s.economy.salvage - cost < reserve) break;
    if (!spend(s.economy, cost)) break;
    repairSpend += cost;
    target.hp = target.maxHp;
  }
}

/** Build-phase policy: finish the maze, upgrade cheaply, then place coverage towers. */
function buildPhase(s, wave, wallIdx, counts, useSupport, spendSurplus = false, maxTowers = MAX_TOWERS, coverage = false, buyPointer = false, buyCursor = true) {
  if (noBuild) {
    // Click-only player: no towers, spend salvage on the pointer when it is affordable.
    while (upgradePointer(s)) {
      /* keep spending while affordable */
    }
    return wallIdx;
  }
  const plan = WALL_PLANS[s.levelId] ?? WALL_PLANS['open-field'];
  const mazeKind = wallMode ? 'wall' : 'gun';
  const mazeCost = TOWER_STATS[mazeKind].cost;
  let nextWall = wallIdx;
  while (nextWall < plan.length && s.towers.length < maxTowers && s.economy.salvage >= mazeCost) {
    const t = plan[nextWall];
    if (!placeTower(s, mazeKind, t.col, t.row)) break;
    nextWall++;
  }
  // A clicker spends on the pointer before tower upgrades: the maze keeps the lane, then the pointer
  // gets priority so the click ladder is what carries the run.
  if (buyPointer) {
    while (upgradePointer(s)) {
      /* keep spending while affordable */
    }
  }
  upgradePass(s);
  const path = currentPath(s);
  for (let guard = 0; guard < 400; guard++) {
    if (s.towers.length >= maxTowers) break;
    const kind = decideKind(s, counts, wave);
    // Coverage slots are reserved for the specialists; the maze walls already provide the Guns.
    if (kind === 'gun') break;
    const tile = tileForKind(s, path, kind);
    if (!tile) break;
    // The control run keeps the policy identical but replaces the two support towers with Guns.
    const placedKind = !useSupport && (kind === 'frost' || kind === 'beacon') ? 'gun' : kind;
    if (s.economy.salvage < TOWER_STATS[placedKind].cost) break;
    placeTower(s, placedKind, tile.col, tile.row);
    counts[kind]++;
    // Prefer one upgrade when a Frost or Beacon is first built, so it is not left at tier 1.
    if (placedKind === 'frost' || placedKind === 'beacon') {
      const t = towerAt(s, tile.col, tile.row);
      if (t && t.tier === 1 && s.economy.salvage >= upgradeCost(t)) upgradeTower(s, tile.col, tile.row);
    }
  }

  // Coverage guns come only after the maze is fully built, so they never crowd a wall tile out, and
  // only into slots the future specialist roster does not need. The map loop asks for them outright
  // so every authored map is beatable. A short route after the maze also falls back to coverage.
  if (nextWall >= plan.length && (coverage || currentPath(s).length < 30)) {
    const reserve = futureSpecialistSlots(counts);
    for (let guard = 0; guard < 400; guard++) {
      if (s.towers.length + reserve >= maxTowers) break;
      if (s.economy.salvage < TOWER_STATS.gun.cost) break;
      const tile = chooseCoverageTile(s, currentPath(s));
      if (!tile || !placeTower(s, 'gun', tile.col, tile.row)) break;
    }
  }

  // Cursor towers: a mid-game buy that turns the click ladder into autonomous board damage. The
  // default baseline buys none; only the --cursor scenario opts in (two, upgraded to tier 2 by the
  // pass above like every cheap tower), so the tower build's own integrity stays the measured thing.
  if (buyCursor && nextWall >= plan.length) {
    const want = cursorTarget(wave) - s.towers.filter((t) => t.kind === 'cursor').length;
    for (let guard = 0; guard < want; guard++) {
      if (s.towers.length >= maxTowers || s.economy.salvage < TOWER_STATS.cursor.cost) break;
      const tile = chooseCoverageTile(s, currentPath(s));
      if (!tile || !placeTower(s, 'cursor', tile.col, tile.row)) break;
    }
  }

  // Repair towers: a support buy placed at the maze's centre so its aura covers the most towers.
  // Only the --repair-tower scenario opts in; the default plan buys none.
  if (repairTowerMode && nextWall >= plan.length) {
    const want = repairTowerTarget(wave) - s.towers.filter((t) => t.kind === 'repair').length;
    for (let guard = 0; guard < want; guard++) {
      if (s.towers.length >= maxTowers || s.economy.salvage < TOWER_STATS.repair.cost) break;
      const tile = chooseBeaconTile(s, currentPath(s));
      if (!tile || !placeTower(s, 'repair', tile.col, tile.row)) break;
    }
  }

  // A wall maze needs to stay alive: upgrade walls to tier 2 and then branch Bulwark with whatever
  // salvage is left after the standard towers are bought.
  if (wallMode && nextWall >= plan.length) {
    for (let guard = 0; guard < 400; guard++) {
      let acted = false;
      for (const t of s.towers) {
        if (t.kind !== 'wall') continue;
        const cost = upgradeCost(t);
        if (cost === null || s.economy.salvage < cost) continue;
        if (t.tier === 2 && t.branch === null) {
          if (chooseBranch(s, t.col, t.row, 'A')) {
            acted = true;
            break;
          }
        } else if (upgradeTower(s, t.col, t.row)) {
          acted = true;
          break;
        }
      }
      if (!acted) break;
    }
  }

  if (wallMode && autoRepair) repairWallsDuringBuild(s);

  if (spendSurplus) {
    // The normal policy stops once every specialist slot is filled, so its early-call bonus sits in
    // the bank. The sweep spends it: take every tower up its branch and tier ladder, buy the pointer,
    // then add extra Guns only where they will not crowd out a specialist the roster still needs.
    for (let guard = 0; guard < 20000; guard++) {
      let acted = false;
      for (const t of s.towers) {
        const cost = upgradeCost(t);
        if (cost === null || s.economy.salvage < cost) continue;
        if (t.tier === 2 && t.branch === null) {
          if (chooseBranch(s, t.col, t.row, 'A')) {
            acted = true;
            break;
          }
        } else if (upgradeTower(s, t.col, t.row)) {
          acted = true;
          break;
        }
      }
      if (!acted) break;
    }
    while (upgradePointer(s)) {
      /* spend what is left on the pointer */
    }
    const reserve = futureSpecialistSlots(counts);
    for (let guard = 0; guard < 400; guard++) {
      if (s.towers.length + reserve >= maxTowers || s.economy.salvage < TOWER_STATS.gun.cost) break;
      const tile = chooseCoverageTile(s, currentPath(s));
      if (!tile || !placeTower(s, 'gun', tile.col, tile.row)) break;
    }
  }

  repairTowersDuringBuild(s, counts, wave, nextWall, maxTowers);
  return nextWall;
}

// --- Click policy -----------------------------------------------------------------------------

function frontMostEnemy(s) {
  let best = null;
  for (const e of s.enemies) {
    if (e.dead || isPopupEnemy(e)) continue; // a human clicks enemies, not the window body
    if (!best || e.dist > best.dist) best = e;
  }
  return best;
}

// --- Pop-up reaction --------------------------------------------------------------------------
// A human clicks each pop-up's close box a fixed reaction time after it spawns. The harness calls
// the same reducer the mouse handler uses (closePopupEnemy), so the shield really turns off. With
// --no-click the tracker only counts spawns and leaks so the punishing case stays comparable.
function newPopupTracker() {
  return { spawnTick: new Map(), closed: new Set() };
}

function popupCounts(tracker, s) {
  const spawned = tracker.spawnTick.size;
  const closed = tracker.closed.size;
  const alive = s.enemies.filter((e) => isPopupEnemy(e) && !e.dead).length;
  return { spawned, closed, leaked: spawned - closed - alive };
}

function reactToPopups(s, tracker) {
  for (const e of s.enemies) {
    if (!isPopupEnemy(e) || e.dead) continue;
    if (!tracker.spawnTick.has(e.id)) tracker.spawnTick.set(e.id, s.tick);
  }
  if (clickDelay === null) return;
  for (const e of s.enemies) {
    if (!isPopupEnemy(e) || e.dead || tracker.closed.has(e.id)) continue;
    if (s.tick - tracker.spawnTick.get(e.id) >= clickDelay && closePopupEnemy(s, e.id)) {
      tracker.closed.add(e.id);
    }
  }
}

function doClick(s) {
  const target = frontMostEnemy(s);
  if (!target) return;
  const r = radiusOf(target);
  const h = target.heading;
  const weak = rng() < accuracy;
  const ang = weak ? h : h + Math.PI / 2;
  pointerDown(s, target.x + 0.5 * r * Math.cos(ang), target.y + 0.5 * r * Math.sin(ang));
  pointerUp(s);
}

// --- Spec allocation --------------------------------------------------------------------------

/** Spend banked specs into levels: tower damage first, a little integrity, then the rest. */
function allocateSpecs(profile) {
  const buy = (kind, max) => {
    while (profile.unspentSpecs > 0 && profile.specs[kind] < max && profile.specs[kind] < SPEC_CAPS[kind]) {
      profile.specs[kind] += 1;
      profile.unspentSpecs -= 1;
    }
  };
  buy('cpu', 6);
  buy('disk', 6);
  buy('cpu', SPEC_CAPS.cpu);
  buy('gpu', SPEC_CAPS.gpu);
  buy('ram', SPEC_CAPS.ram);
}

// --- Wave / session loop ----------------------------------------------------------------------

function playWave(s, wave, leakList, popups, clicksPerSec = cps, clicking = true) {
  if (!startWave(s)) return { status: 'ended' };
  const clickInterval = Math.max(1, Math.round(TICK_HZ / clicksPerSec));
  const dmgStart = { tower: s.economy.damage.tower, pointer: s.economy.damage.pointer };
  let clicks = 0;
  let guard = 0;
  while (s.phase === 'wave') {
    if (clicking && s.enemies.length > 0 && clicks % clickInterval === 0) doClick(s);
    tick(s);
    reactToPopups(s, popups);
    clicks++;
    if (++guard > TICK_HZ * 300) break; // safety; a wave never lasts 5 minutes
  }
  const towerDmg = s.economy.damage.tower - dmgStart.tower;
  const clickDmg = s.economy.damage.pointer - dmgStart.pointer;
  const total = towerDmg + clickDmg;
  const towerPct = total > 0 ? Math.round((towerDmg / total) * 100) : 0;
  const leaks = s.leaksByWave.get(wave) ?? 0;
  leakList.push({ wave, leaks });
  if (!quiet && !silent) {
    const w = String(wave).padStart(2, '0');
    console.log(
      `w ${w} leaks ${leaks} hp ${s.integrity} sal ${s.economy.salvage} ` +
        `towers ${s.towers.length} route ${currentPath(s).length} ` +
        `towerDmg ${towerPct}% clickDmg ${100 - towerPct}%`,
    );
  }
  if (s.phase === 'halted') return { status: 'died' };
  if (s.phase === 'victory' || wave >= to) return { status: 'reached' };
  return { status: 'cleared' };
}

/** Play one full run from a fresh state; returns the outcome. */
function playRun(profile, rebootAtWave, label, useSupport, levelId, maxTowers = MAX_TOWERS, coverage = false, clicksPerSec = cps, clicking = true, buyPointer = false, buyCursor = false) {
  resetClickRng();
  repairSpend = 0;
  const s = createStateOn(profile, levelId);
  const leakList = [];
  const popups = newPopupTracker();
  const counts = { gun: 0, cannon: 0, taser: 0, frost: 0, laser: 0, beacon: 0 };
  let wallIdx = 0;
  if (!quiet && !silent) console.log(`--- ${label} ---`);
  for (let wave = 1; ; wave++) {
    wallIdx = buildPhase(s, wave, wallIdx, counts, useSupport, false, maxTowers, coverage, buyPointer, buyCursor);
    const result = playWave(s, wave, leakList, popups, clicksPerSec, clicking);
    if (result.status === 'died') {
      return {
        reached: false,
        wave,
        clearedWaves: s.clearedWaves,
        integrity: s.integrity,
        earned: s.economy.earned,
        state: s,
        leakList,
        popups: popupCounts(popups, s),
      };
    }
    if (result.status === 'reached') {
      return {
        reached: true,
        wave,
        clearedWaves: s.clearedWaves,
        integrity: s.integrity,
        earned: s.economy.earned,
        state: s,
        leakList,
        popups: popupCounts(popups, s),
      };
    }
    if (rebootAtWave > 0 && wave >= rebootAtWave) {
      return {
        reached: false,
        reboot: true,
        wave,
        clearedWaves: s.clearedWaves,
        integrity: s.integrity,
        earned: s.economy.earned,
        state: s,
        leakList,
        popups: popupCounts(popups, s),
      };
    }
  }
}

/** Play a full session (reboot at --reboot-at, then run to completion) with a given support policy. */
function runSession(useSupport, label, levelId, maxTowers = MAX_TOWERS, coverage = false, clicksPerSec = cps, clicking = true, buyPointer = false, buyCursor = false) {
  let profile = defaultProfile();
  let totalSpecs = 0;
  let reboots = 0;
  let totalRepairSpend = 0;
  let final = null;

  for (let run = 1; ; run++) {
    const result = playRun(profile, run === 1 ? rebootAt : 0, `${label} run ${run}`, useSupport, levelId, maxTowers, coverage, clicksPerSec, clicking, buyPointer, buyCursor);
    reboots = run - 1;
    totalRepairSpend += repairSpend;
    if (result.reached || !result.reboot) {
      final = result;
      break;
    }
    const { gained, profile: nextProfile } = restartWindows(result.state, profile);
    totalSpecs += gained;
    allocateSpecs(nextProfile);
    profile = nextProfile;
    if (!quiet && !silent) console.log(`reboot at wave ${result.wave} -> ${gained} specs`);
  }

  return { final, totalSpecs, reboots, repairSpend: totalRepairSpend };
}

/**
 * The --call strategy: play normally, and whenever every in-flight wave has emptied its spawn queue
 * while enemies are still alive, call the next wave immediately (paying the early-call bonus).
 * --call-all chains every remaining wave at tick zero instead, as a stress test of overlap.
 * Returns the same shape as playRun.
 */
function playRunCall(profile, label, allAtOnce) {
  resetClickRng();
  const s = createRunState(profile);
  const counts = { gun: 0, cannon: 0, taser: 0, frost: 0, laser: 0, beacon: 0 };
  let wallIdx = 0;
  const leakList = [];
  const popups = newPopupTracker();
  if (!quiet) console.log(`--- ${label} ---`);

  for (;;) {
    wallIdx = buildPhase(s, s.wave + 1, wallIdx, counts, true);
    if (!startWave(s)) break;
    if (allAtOnce) {
      // Chain every remaining wave immediately, up to --to or the normal-run cap (wave 100).
      while (s.wave < to && startWave(s)) {
        /* each call is an early call and pays the bonus */
      }
    }
    const clickInterval = Math.max(1, Math.round(TICK_HZ / cps));
    let clicks = 0;
    let guard = 0;
    while (s.phase === 'wave') {
      if (s.enemies.length > 0 && clicks % clickInterval === 0) doClick(s);
      if (allAtOnce) wallIdx = buildPhase(s, s.wave, wallIdx, counts, true);
      tick(s);
      reactToPopups(s, popups);
      if (!allAtOnce && s.phase === 'wave' && s.wave < to) {
        const spawning = s.runs.some((r) => r.spawns.length > 0);
        if (!spawning && s.enemies.length > 0) {
          wallIdx = buildPhase(s, s.wave + 1, wallIdx, counts, true);
          startWave(s);
        }
      }
      clicks++;
      if (++guard > TICK_HZ * 900) break; // safety; a call run is over in well under 15 min
    }
    for (const [wave, leaks] of s.leaksByWave) {
      if (leaks > 0 && !leakList.some((l) => l.wave === wave)) leakList.push({ wave, leaks });
    }
    if (s.phase === 'halted') {
      return {
        reached: false,
        wave: s.wave,
        clearedWaves: s.clearedWaves,
        integrity: s.integrity,
        earned: s.economy.earned,
        state: s,
        leakList,
        popups: popupCounts(popups, s),
      };
    }
    if (s.phase === 'victory' || s.wave >= to) {
      return {
        reached: true,
        wave: s.wave,
        clearedWaves: s.clearedWaves,
        integrity: s.integrity,
        earned: s.economy.earned,
        state: s,
        leakList,
        popups: popupCounts(popups, s),
      };
    }
  }
  return {
    reached: false,
    wave: s.wave,
    clearedWaves: s.clearedWaves,
    integrity: s.integrity,
    earned: s.economy.earned,
    state: s,
    leakList,
    popups: popupCounts(popups, s),
  };
}

/** Run a call scenario as a single run (no mid-run reboot: an early-call chain has no checkpoint). */
function runSessionCall(label, allAtOnce) {
  const final = playRunCall(defaultProfile(), label, allAtOnce);
  return { final, totalSpecs: 0, reboots: 0 };
}

/** The spawn-window span earlyCallBonus uses for a wave: its last spawn tick, floored at 60. */
function waveSpan(wave) {
  const schedule = buildSchedule(wave);
  const last = schedule.length > 0 ? schedule[schedule.length - 1].tick : 0;
  return Math.max(60, last);
}

/**
 * The --call-sweep strategy: call the next wave when the current wave has burned `timing` of its
 * spawn window, measured by the same span earlyCallBonus uses. Unlike --call, this line spends the
 * bonus (extra Guns, branches, tiers and pointer) instead of banking it. `timing === null` is the
 * control: the same build policy with no early calls. Returns the bonus actually paid by startWave
 * alongside the usual run result.
 */
function playRunSweep(profile, label, timing) {
  resetClickRng();
  const s = createRunState(profile);
  const counts = { gun: 0, cannon: 0, taser: 0, frost: 0, laser: 0, beacon: 0 };
  let wallIdx = 0;
  let bonusPaid = 0;
  let spanWave = -1;
  let span = 0;
  const leakList = [];
  const popups = newPopupTracker();
  if (!quiet) console.log(`--- ${label} ---`);

  for (;;) {
    wallIdx = buildPhase(s, s.wave + 1, wallIdx, counts, true, true, SWEEP_MAX_TOWERS);
    if (!startWave(s)) break;
    const clickInterval = Math.max(1, Math.round(TICK_HZ / cps));
    let clicks = 0;
    let guard = 0;
    while (s.phase === 'wave') {
      if (s.enemies.length > 0 && clicks % clickInterval === 0) doClick(s);
      tick(s);
      reactToPopups(s, popups);
      if (timing !== null && s.phase === 'wave' && s.wave < to) {
        if (spanWave !== s.wave) {
          span = waveSpan(s.wave);
          spanWave = s.wave;
        }
        const threshold = Math.max(1, Math.round(span * timing));
        if (s.waveTick >= threshold) {
          wallIdx = buildPhase(s, s.wave + 1, wallIdx, counts, true, true, SWEEP_MAX_TOWERS);
          const before = s.economy.salvage;
          if (startWave(s)) {
            bonusPaid += s.economy.salvage - before;
            // Spend the bonus that was just paid, so the timing is tested rather than banked.
            wallIdx = buildPhase(s, s.wave, wallIdx, counts, true, true, SWEEP_MAX_TOWERS);
          }
        }
      }
      clicks++;
      if (++guard > TICK_HZ * 900) break; // safety; a call run is over in well under 15 min
    }
    for (const [wave, leaks] of s.leaksByWave) {
      if (leaks > 0 && !leakList.some((l) => l.wave === wave)) leakList.push({ wave, leaks });
    }
    if (s.phase === 'halted') {
      return {
        reached: false,
        wave: s.wave,
        clearedWaves: s.clearedWaves,
        integrity: s.integrity,
        earned: s.economy.earned,
        bonusPaid,
        state: s,
        leakList,
        popups: popupCounts(popups, s),
      };
    }
    if (s.phase === 'victory' || s.wave >= to) {
      return {
        reached: true,
        wave: s.wave,
        clearedWaves: s.clearedWaves,
        integrity: s.integrity,
        earned: s.economy.earned,
        bonusPaid,
        state: s,
        leakList,
        popups: popupCounts(popups, s),
      };
    }
  }
  return {
    reached: false,
    wave: s.wave,
    clearedWaves: s.clearedWaves,
    integrity: s.integrity,
    earned: s.economy.earned,
    bonusPaid,
    state: s,
    leakList,
    popups: popupCounts(popups, s),
  };
}

/** One sweep leg from a fresh profile; no reboot, because the early-call line has no checkpoint. */
function runSessionSweep(timing) {
  const label = `call sweep ${Math.round(timing * 100)}%`;
  const final = playRunSweep(defaultProfile(), label, timing);
  return { timing, final, bonusPaid: final.bonusPaid, totalSpecs: 0, reboots: 0 };
}

// --- Reporting --------------------------------------------------------------------------------

function towerTable(final, label) {
  const rows = TOWER_KINDS.map((kind) => {
    const towers = final.state.towers.filter((t) => t.kind === kind);
    const dmg = towers.reduce((a, t) => a + t.damageDealt, 0);
    const kills = towers.reduce((a, t) => a + t.kills, 0);
    const spent = towers.reduce((a, t) => a + t.spent, 0);
    return { kind, count: towers.length, dmg, kills, spent };
  });
  const total = rows.reduce((a, r) => a + r.dmg, 0);
  const withStats = rows.map((r) => ({
    ...r,
    pct: total > 0 ? (r.dmg / total) * 100 : 0,
    dps: r.spent > 0 ? r.dmg / r.spent : 0,
  }));
  withStats.sort((a, b) => b.dps - a.dps);
  console.log(`\n${label} — per tower kind (sorted by damage per salvage)`);
  console.log(`  kind      dmg%    kills   spent  dmg/salv  towers`);
  for (const r of withStats) {
    const pct = r.pct.toFixed(1).padStart(5);
    const dps = r.spent > 0 ? r.dps.toFixed(2).padStart(8) : '       -';
    console.log(
      `  ${r.kind.padEnd(7)}  ${pct}%  ${String(r.kills).padStart(6)} ${String(r.spent).padStart(7)}  ${dps}  ${String(r.count).padStart(5)}`,
    );
  }
  return { total, rows: withStats };
}

function runSummary(final, totalSpecs, reboots, label) {
  const leakSummary = final.leakList
    .filter((l) => l.leaks > 0)
    .map((l) => `${l.wave}:${l.leaks}`)
    .join(' ');
  console.log(`\n=== ${label} ===`);
  console.log(`waves cleared: ${final.clearedWaves}`);
  console.log(`last wave started: ${final.wave}`);
  console.log(`integrity: ${final.integrity}`);
  console.log(`total salvage: ${final.earned}`);
  console.log(`specs earned: ${totalSpecs}`);
  console.log(`leaks per wave: ${leakSummary || 'none'}`);
  console.log(`pop-ups: ${final.popups.closed} closed, ${final.popups.leaked} leaked`);
  console.log(`reboots: ${reboots}`);
  return towerTable(final, label);
}

function callSweepTable(rows) {
  console.log('\n=== call sweep ===');
  console.log('  timing   bonus earned   waves cleared   last started   integrity   salvage');
  for (const row of rows) {
    const timing = row.timing === null ? 'control' : `${Math.round(row.timing * 100)}%`;
    console.log(
      `  ${timing.padStart(6)}   ${String(row.bonusPaid).padStart(12)}   ` +
        `${String(row.final.clearedWaves).padStart(13)}   ${String(row.final.wave).padStart(12)}   ` +
        `${String(row.final.integrity).padStart(9)}   ${String(row.final.earned).padStart(7)}`,
    );
  }
}

// --- Main -------------------------------------------------------------------------------------

// One standard run per selected map (the control replaces it under --no-support), kept quiet so
// the map table is the whole output. Runtime stays sane because each authored map already forces a
// long route, so the scripted player reaches wave 100 without the extra control comparison.
const mapRows = [];
let allReached = true;

// Every map is judged on the same board, alone or in a batch: coverage guns plus the higher tower
// cap. A single --level run used to keep the maze-only policy for the support comparison, but that
// made the same map report different numbers depending on how it was invoked. The stronger board is
// the canonical one, so the loop always uses it.
silent = !singleLevel;
const loopMaxTowers = MAP_MAX_TOWERS;
const loopCoverage = true;

if (repairMode) {
  // The breacher-heavy repair comparison: the same wall build, run with and without the bot
  // auto-repairing any wall below 50% HP during the build phase. Repair spend competes with tower
  // purchases, so repairs keep more walls alive at a real salvage cost without making them immortal.
  silent = true;
  console.log('\n=== wall repair ===');
  console.log('  map          mode  waves cleared   integrity   salvage   breacher dmg   walls left   repair spent');
  let repairReached = true;
  for (const level of activeLevels) {
    autoRepair = false;
    const off = runSession(true, 'repair off', level.id, MAP_MAX_TOWERS, true);
    autoRepair = true;
    const on = runSession(true, 'repair on', level.id, MAP_MAX_TOWERS, true);
    for (const [mode, run] of [
      ['off', off],
      ['on ', on],
    ]) {
      const st = run.final.state;
      const wallsLeft = st.towers.filter((t) => t.kind === 'wall').length;
      console.log(
        `  ${level.id.padEnd(11)}  ${mode}  ${String(run.final.clearedWaves).padStart(13)}  ` +
          `${String(run.final.integrity).padStart(9)}  ${String(run.final.earned).padStart(7)}  ` +
          `${String(Math.round(st.wallDamageTaken)).padStart(13)}  ${String(wallsLeft).padStart(10)}  ` +
          `${String(run.repairSpend).padStart(12)}`,
      );
    }
    if (!on.final.reached) repairReached = false;
  }
  silent = false;
  process.exit(repairReached ? 0 : 1);
}

if (clickerMode) {
  // The clicker comparison: a player clicking at 2 clicks/s and buying pointer levels whenever
  // affordable, against the same board with the pointer switched off. The clicker leg is the
  // clicker-first policy (pointer bought before tower upgrades); the no-click leg is the standard
  // build policy with clicking disabled, so a weak no-click row cannot be blamed on the clicker's
  // build. The standard leg is the tower build at the normal click rate, so the advantage — how far
  // the clicker-first pointer gets ahead of the tower build — is measured against it directly. All
  // three legs use the canonical map board.
  const CLICKER_CPS = 2;
  const ADVANTAGE_CAP = 8;
  silent = true;
  console.log('\n=== pointer clicker ===');
  console.log('  map          mode      waves cleared   integrity   salvage   click dmg%');
  let clickerReached = true;
  let maxAdvantage = -Infinity;
  for (const level of activeLevels) {
    const standard = runSession(support, 'standard', level.id, MAP_MAX_TOWERS, true, cps, true, false, false);
    const clicker = runSession(true, 'clicker', level.id, MAP_MAX_TOWERS, true, CLICKER_CPS, true, true, false);
    const noclick = runSession(true, 'no-click', level.id, MAP_MAX_TOWERS, true, cps, false, false, false);
    const advantage = clicker.final.integrity - standard.final.integrity;
    maxAdvantage = Math.max(maxAdvantage, advantage);
    for (const [mode, run] of [
      ['standard', standard],
      ['clicker', clicker],
      ['no-click', noclick],
    ]) {
      const f = run.final;
      const total = f.state.economy.damage.tower + f.state.economy.damage.pointer;
      const pct = total > 0 ? Math.round((f.state.economy.damage.pointer / total) * 100) : 0;
      console.log(
        `  ${level.id.padEnd(11)}  ${mode.padEnd(8)}  ${String(f.clearedWaves).padStart(13)}  ` +
          `${String(f.integrity).padStart(9)}  ${String(f.earned).padStart(7)}  ${String(pct).padStart(9)}%`,
      );
    }
    console.log(
      `  ${level.id.padEnd(11)}  advantage  clicker ${clicker.final.integrity} - standard ${standard.final.integrity} = +${advantage}  (clicker overclock L${clicker.final.state.pointer.clickLevel})`,
    );
    if (!clicker.final.reached) clickerReached = false;
  }
  silent = false;
  console.log(`\nmax clicker advantage over standard: +${maxAdvantage} integrity (cap +${ADVANTAGE_CAP})`);
  if (maxAdvantage > ADVANTAGE_CAP) {
    console.log(`WARNING: the clicker-first pointer is ${maxAdvantage - ADVANTAGE_CAP} integrity too far ahead of the tower build.`);
  }
  process.exit(clickerReached ? 0 : 1);
}

if (cursorMode) {
  // The cursor comparison: the standard tower build against the same build plus two cursors bought
  // from wave 60. The cursor's clicks are pointer-sourced, so both legs use the same click rate and
  // the only difference is the two cursors — the integrity gap is the cursor's own contribution.
  silent = true;
  console.log('\n=== pointer cursor ===');
  console.log('  map          mode      waves cleared   integrity   salvage   pointer dmg%');
  let cursorReached = true;
  let maxAdvantage = -Infinity;
  for (const level of activeLevels) {
    const standard = runSession(support, 'standard', level.id, MAP_MAX_TOWERS, true, cps, true, false, false);
    const cursor = runSession(true, 'cursor', level.id, MAP_MAX_TOWERS, true, cps, true, false, true);
    const advantage = cursor.final.integrity - standard.final.integrity;
    maxAdvantage = Math.max(maxAdvantage, advantage);
    for (const [mode, run] of [
      ['standard', standard],
      ['cursor', cursor],
    ]) {
      const f = run.final;
      const total = f.state.economy.damage.tower + f.state.economy.damage.pointer;
      const pct = total > 0 ? Math.round((f.state.economy.damage.pointer / total) * 100) : 0;
      console.log(
        `  ${level.id.padEnd(11)}  ${mode.padEnd(8)}  ${String(f.clearedWaves).padStart(13)}  ` +
          `${String(f.integrity).padStart(9)}  ${String(f.earned).padStart(7)}  ${String(pct).padStart(9)}%`,
      );
    }
    const cursorCount = cursor.final.state.towers.filter((t) => t.kind === 'cursor').length;
    console.log(
      `  ${level.id.padEnd(11)}  advantage  cursor ${cursor.final.integrity} - standard ${standard.final.integrity} = +${advantage}  (${cursorCount} cursors)`,
    );
    if (!cursor.final.reached) cursorReached = false;
  }
  silent = false;
  console.log(`\nmax cursor advantage over standard: +${maxAdvantage} integrity`);
  process.exit(cursorReached ? 0 : 1);
}

if (repairTowerMode) {
  // The repair-tower scenario: the standard build, but the bot also buys repair towers from wave 40.
  // It is not a new baseline — the point is that the harness can place and pay for the kind, and the
  // repair row of the tower table (run with --level) reports a non-zero count while the default plan
  // reports zero.
  silent = true;
  console.log('\n=== repair tower ===');
  console.log('  map          waves cleared   integrity   salvage   repair towers');
  let repairReached = true;
  for (const level of activeLevels) {
    const run = runSession(support, `repair tower [${level.id}]`, level.id, MAP_MAX_TOWERS, true);
    const st = run.final.state;
    const repairs = st.towers.filter((t) => t.kind === 'repair').length;
    console.log(
      `  ${level.id.padEnd(11)}  ${String(run.final.clearedWaves).padStart(13)}  ` +
        `${String(run.final.integrity).padStart(9)}  ${String(run.final.earned).padStart(7)}  ` +
        `${String(repairs).padStart(13)}`,
    );
    if (!run.final.reached) repairReached = false;
  }
  silent = false;
  process.exit(repairReached ? 0 : 1);
}

if (wallMode) {
  // The wall-heavy scenario: the standard build, but the maze is walls (kept upgraded) rather than
  // Guns. Reports how much damage breachers did to walls, so wall cost and breacher DPS can be tuned.
  silent = true;
  console.log('\n=== wall build ===');
  console.log('  map          waves cleared   integrity   salvage   breacher dmg   walls left');
  // Walls do no damage, so the wall build needs the coverage Guns the map-summary loop buys (a
  // higher cap and coverage, the same "stronger board" policy every authored map is judged against).
  for (const level of activeLevels) {
    const wall = runSession(true, `wall run [${level.id}]`, level.id, MAP_MAX_TOWERS, true);
    const st = wall.final.state;
    const wallsLeft = st.towers.filter((t) => t.kind === 'wall').length;
    console.log(
      `  ${level.id.padEnd(11)}  ${String(wall.final.clearedWaves).padStart(13)}  ` +
        `${String(wall.final.integrity).padStart(9)}  ${String(wall.final.earned).padStart(7)}  ` +
        `${String(Math.round(st.wallDamageTaken)).padStart(13)}  ${String(wallsLeft).padStart(10)}`,
    );
    if (!wall.final.reached) allReached = false;
  }
} else {
  for (const level of activeLevels) {
    const std = runSession(support, `${support ? 'standard' : 'control'} run [${level.id}]`, level.id, loopMaxTowers, loopCoverage);
    mapRows.push({ level, std });
    if (!std.final.reached) allReached = false;
  }
  silent = false;

  console.log('\n=== maps ===');
  console.log('  map          waves cleared   integrity   salvage   closed   leaked   tower dmg%');
  for (const { level, std } of mapRows) {
    const p = std.final.popups;
    const tower = std.final.state.economy.damage.tower;
    const pointer = std.final.state.economy.damage.pointer;
    const towerPct = tower + pointer > 0 ? Math.round((tower / (tower + pointer)) * 100) : 0;
    console.log(
      `  ${level.id.padEnd(11)}  ${String(std.final.clearedWaves).padStart(13)}  ` +
        `${String(std.final.integrity).padStart(9)}  ${String(std.final.earned).padStart(7)}  ` +
        `${String(p.closed).padStart(6)}  ${String(p.leaked).padStart(6)}  ${String(towerPct).padStart(10)}%`,
    );
  }
  // The standard run is a tower build that clicks; the towers must stay the primary damage source.
  // If the pointer (the "ladder") alone out-carries them, call that out with the actual share.
  const minTowerPct = Math.min(
    ...mapRows.map(({ std }) => {
      const tower = std.final.state.economy.damage.tower;
      const pointer = std.final.state.economy.damage.pointer;
      return tower + pointer > 0 ? (tower / (tower + pointer)) * 100 : 100;
    }),
  );
  if (minTowerPct < 60) {
    console.log(`\nWARNING: towers fall below 60% of standard-run damage (${minTowerPct.toFixed(1)}% on the weakest map).`);
  }

  // A single-map run keeps the original detailed summary, tower table and support comparison.
  if (singleLevel) {
    const main = mapRows[0].std;
    const mainTable = runSummary(
      main.final,
      main.totalSpecs,
      main.reboots,
      `${support ? 'standard' : 'control'} run [${mapRows[0].level.id}]`,
    );

    if (support) {
      // The control: identical policy, but Frost and Beacon are replaced by Guns.
      const control = runSession(false, 'control run', mapRows[0].level.id);
      const controlTable = runSummary(control.final, control.totalSpecs, control.reboots, 'control run (no support)');

      const stdTotal = mainTable.total;
      const ctrlTotal = controlTable.total;
      const stdWave = main.final.clearedWaves;
      const ctrlWave = control.final.clearedWaves;
      const stdPerWave = stdWave > 0 ? stdTotal / stdWave : 0;
      const ctrlPerWave = ctrlWave > 0 ? ctrlTotal / ctrlWave : 0;
      const delta = ctrlTotal > 0 ? ((stdTotal - ctrlTotal) / ctrlTotal) * 100 : Infinity;
      console.log(`\nenabling effect (Frost + Beacon vs. Guns in their slots):`);
      console.log(`  total tower damage:  standard ${Math.round(stdTotal)}  control ${Math.round(ctrlTotal)}  (${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%)`);
      console.log(`  per wave:            standard ${stdPerWave.toFixed(0)}  control ${ctrlPerWave.toFixed(0)}`);
      console.log(`  (control ${ctrlWave < 100 ? `died at wave ${ctrlWave}` : 'reached ' + ctrlWave})`);
    }
  }

  if (callMode) {
    // The early-call scenario: call the next wave once the spawn queue is exhausted, as a player would.
    const call = runSessionCall('call run (--call)', false);
    runSummary(call.final, call.totalSpecs, call.reboots, 'call run (--call)');
  }

  if (callAllMode) {
    // The stress test: chain every remaining wave at tick zero to exercise heavy overlap.
    const callAll = runSessionCall('call-all run (--call-all)', true);
    runSummary(callAll.final, callAll.totalSpecs, callAll.reboots, 'call-all run (--call-all)');
  }

  if (callSweepMode) {
    // The trade curve: one run per timing, each paying the real early-call bonus and spending it,
    // plus a control leg using the same build policy with no early calls.
    const sweep = [0.25, 0.5, 0.75].map((timing) => runSessionSweep(timing));
    sweep.push({
      timing: null,
      final: playRunSweep(defaultProfile(), 'call sweep control', null),
      bonusPaid: 0,
      totalSpecs: 0,
      reboots: 0,
    });
    callSweepTable(sweep);
  }
}

process.exit(allReached ? 0 : 1);
