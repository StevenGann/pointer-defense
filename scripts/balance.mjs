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
} from '../src/core/state.ts';
import { TOWER_KINDS, TOWER_STATS, upgradeCost } from '../src/core/towers.ts';
import { radiusOf } from '../src/core/enemies.ts';
import { buildField, isSealed, pathTiles } from '../src/core/pathfield.ts';
import { COLS, ROWS, SPAWN, EXIT, tileAt } from '../src/core/grid.ts';
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
// --no-support: run the control (Frost/Beacon replaced by Guns) instead of the standard spread.
const support = !hasFlag('--no-support');
// --no-build: a click-only player — never place a tower, spend salvage on the pointer instead.
const noBuild = hasFlag('--no-build');
// --call: run normally, calling the next wave once the current spawn queue is exhausted and enemies
// are still on the board. --call-all: chain every remaining wave at tick zero (a stress test).
// --call-sweep: call every wave at 25%, 50% and 75% of its spawn window, one run per timing.
const callMode = hasFlag('--call');
const callAllMode = hasFlag('--call-all');
const callSweepMode = hasFlag('--call-sweep');

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
const rng = makeRng(0x9e3779b9 ^ (Math.round(accuracy * 1000) << 8) ^ Math.round(cps * 10));

// --- The maze ---------------------------------------------------------------------------------
// A fixed serpentine of three partial walls (top-anchored, bottom-anchored, top-anchored). Single
// towers cannot maze an open board; only contiguous walls force the route around their end. This
// plan lengthens the route from 22 to 40 tiles and never seals at any prefix. Each wall is built
// from the spawn/exit row outward so every early tower both blocks the route and covers it.
function wallOutward(col, rows) {
  const sorted = [...rows].sort((a, b) => Math.abs(a - 6) - Math.abs(b - 6) || a - b);
  return sorted.map((row) => ({ col, row }));
}
const WALL_PLAN = [
  ...wallOutward(6, [0, 1, 2, 3, 4, 5, 6, 7, 8]), // wall 1, gap at bottom
  ...wallOutward(10, [3, 4, 5, 6, 7, 8, 9, 10, 11]), // wall 2, gap at top
  ...wallOutward(14, [0, 1, 2, 3, 4, 5, 6, 7, 8]), // wall 3, gap at bottom
];

/** Cap on towers: the maze walls plus a full ring of route coverage, a competent-not-expert board. */
const MAX_TOWERS = 45;
/** The sweep has no reboot to bank for, so it may keep spending bonus salvage on extra Guns. */
const SWEEP_MAX_TOWERS = 60;

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

/** A tile is a legal coverage placement: buildable, unblocked, not sealing, not re-routing. */
function legalPlacement(s, path, c, r) {
  if (tileAt(s.grid, c, r) !== 'buildable') return false;
  const i = idx(c, r);
  if (s.blocked.has(i)) return false;
  const blocked = new Set(s.blocked);
  blocked.add(i);
  if (isSealed(s.grid, blocked, SPAWN, EXIT)) return false;
  return pathTiles(buildField(s.grid, blocked), SPAWN).length === path.length;
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

/** Pick the tower kind for a coverage placement, per the build policy. */
function decideKind(counts, wave) {
  if (counts.frost < frostTarget(wave)) return 'frost';
  if (counts.beacon < beaconTarget(wave)) return 'beacon';
  if (counts.laser < laserTarget(wave)) return 'laser';
  if (counts.taser < taserTarget(wave)) return 'taser';
  if (counts.cannon < cannonTarget(wave)) return 'cannon';
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

/** Build-phase policy: finish the maze, upgrade cheaply, then place coverage towers. */
function buildPhase(s, wave, wallIdx, counts, useSupport, spendSurplus = false, maxTowers = MAX_TOWERS) {
  if (noBuild) {
    // Click-only player: no towers, spend salvage on the pointer when it is affordable.
    while (upgradePointer(s)) {
      /* keep spending while affordable */
    }
    return wallIdx;
  }
  let nextWall = wallIdx;
  while (nextWall < WALL_PLAN.length && s.towers.length < maxTowers && s.economy.salvage >= TOWER_STATS.gun.cost) {
    const t = WALL_PLAN[nextWall];
    if (!placeTower(s, 'gun', t.col, t.row)) break;
    nextWall++;
  }
  upgradePass(s);
  const path = currentPath(s);
  for (let guard = 0; guard < 400; guard++) {
    if (s.towers.length >= maxTowers) break;
    const kind = decideKind(counts, wave);
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
  return nextWall;
}

// --- Click policy -----------------------------------------------------------------------------

function frontMostEnemy(s) {
  let best = null;
  for (const e of s.enemies) {
    if (e.dead) continue;
    if (!best || e.dist > best.dist) best = e;
  }
  return best;
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

function playWave(s, wave, leakList) {
  if (!startWave(s)) return { status: 'ended' };
  const clickInterval = Math.max(1, Math.round(TICK_HZ / cps));
  const dmgStart = { tower: s.economy.damage.tower, pointer: s.economy.damage.pointer };
  let clicks = 0;
  let guard = 0;
  while (s.phase === 'wave') {
    if (s.enemies.length > 0 && clicks % clickInterval === 0) doClick(s);
    tick(s);
    clicks++;
    if (++guard > TICK_HZ * 300) break; // safety; a wave never lasts 5 minutes
  }
  const towerDmg = s.economy.damage.tower - dmgStart.tower;
  const clickDmg = s.economy.damage.pointer - dmgStart.pointer;
  const total = towerDmg + clickDmg;
  const towerPct = total > 0 ? Math.round((towerDmg / total) * 100) : 0;
  const leaks = s.leaksByWave.get(wave) ?? 0;
  leakList.push({ wave, leaks });
  if (!quiet) {
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
function playRun(profile, rebootAtWave, label, useSupport) {
  const s = createRunState(profile);
  const leakList = [];
  const counts = { gun: 0, cannon: 0, taser: 0, frost: 0, laser: 0, beacon: 0 };
  let wallIdx = 0;
  if (!quiet) console.log(`--- ${label} ---`);
  for (let wave = 1; ; wave++) {
    wallIdx = buildPhase(s, wave, wallIdx, counts, useSupport);
    const result = playWave(s, wave, leakList);
    if (result.status === 'died') {
      return {
        reached: false,
        wave,
        clearedWaves: s.clearedWaves,
        integrity: s.integrity,
        earned: s.economy.earned,
        state: s,
        leakList,
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
      };
    }
  }
}

/** Play a full session (reboot at --reboot-at, then run to completion) with a given support policy. */
function runSession(useSupport, label) {
  let profile = defaultProfile();
  let totalSpecs = 0;
  let reboots = 0;
  let final = null;

  for (let run = 1; ; run++) {
    const result = playRun(profile, run === 1 ? rebootAt : 0, `${label} run ${run}`, useSupport);
    reboots = run - 1;
    if (result.reached || !result.reboot) {
      final = result;
      break;
    }
    const { gained, profile: nextProfile } = restartWindows(result.state, profile);
    totalSpecs += gained;
    allocateSpecs(nextProfile);
    profile = nextProfile;
    if (!quiet) console.log(`reboot at wave ${result.wave} -> ${gained} specs`);
  }

  return { final, totalSpecs, reboots };
}

/**
 * The --call strategy: play normally, and whenever every in-flight wave has emptied its spawn queue
 * while enemies are still alive, call the next wave immediately (paying the early-call bonus).
 * --call-all chains every remaining wave at tick zero instead, as a stress test of overlap.
 * Returns the same shape as playRun.
 */
function playRunCall(profile, label, allAtOnce) {
  const s = createRunState(profile);
  const counts = { gun: 0, cannon: 0, taser: 0, frost: 0, laser: 0, beacon: 0 };
  let wallIdx = 0;
  const leakList = [];
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
  const s = createRunState(profile);
  const counts = { gun: 0, cannon: 0, taser: 0, frost: 0, laser: 0, beacon: 0 };
  let wallIdx = 0;
  let bonusPaid = 0;
  let spanWave = -1;
  let span = 0;
  const leakList = [];
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

const mainSupport = support;
const main = runSession(mainSupport, mainSupport ? 'standard run' : 'control run (--no-support)');
const mainTable = runSummary(main.final, main.totalSpecs, main.reboots, mainSupport ? 'standard run' : 'control run');

if (mainSupport) {
  // The control: identical policy, but Frost and Beacon are replaced by Guns.
  const control = runSession(false, 'control run');
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

process.exit(main.final.reached ? 0 : 1);
